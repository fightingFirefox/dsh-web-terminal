import { randomUUID } from 'node:crypto'
import { commandOutputText, normalizeTerminalText } from './ansi.js'
import { extractPorts } from './ports.js'
import { ByteTail, tailByBytes } from './ring.js'
import { ScreenMirror } from './screen.js'

export const POLL_INTERVAL_MS = 25

const TERMINAL_TYPE = 'xterm-256color'

const MAX_FRAME_BYTES = 4 * 1024 * 1024

const MAX_PORTS = 32

const DEFAULT_SANDBOX = Object.freeze({ mode: 'danger-full-access', confined: false, required: false })

const DEFAULT_CAPTURE_TIMEOUT_MS = 3000

const MIN_CAPTURE_TIMEOUT_MS = 50

const MAX_CAPTURE_TIMEOUT_MS = 30_000

export class TerminalPanelSession {

  id

  title

  kind

  owner

  sessionId

  agentId

  command

  cwd

  cols

  rows

  state = 'running'

  exitCode = null

  signal = null

  startedAt

  endedAt = null

  durationMs = null

  shellKind

  sandbox

  keepOpen = false

  ports = new Map()

  writerClientId = null

  autoCloseAt = null

  autoClosePaused = false

  pinned = false

  error

  createdAt

  updatedAt

  seq = 0


  #handle

  #screen

  #raw

  #subscribers = new Set()

  #decoder = new TextDecoder('utf-8', { ignoreBOM: true })

  #queue = Promise.resolve()

  #consuming = true

  #closing = false

  #termination

  #disposed

  #onExit

  #onChange

  #onPort

  #portDetection

  #portTail = ''

  #frames = []

  #frameBytes = 0

  #clients = new Set()

  #captures = new Map()

  #exited


  constructor(options) {
    this.id = options.id
    this.title = options.title
    this.kind = options.kind
    this.group = typeof options.group === 'string' && options.group.length > 0 ? options.group : undefined
    this.owner = options.owner
    this.sessionId = options.sessionId
    this.agentId = options.agentId
    this.command = options.command
    this.cwd = options.cwd
    this.cols = options.cols
    this.rows = options.rows
    this.shellKind = typeof options.shellKind === 'string' && options.shellKind.length > 0 ? options.shellKind : 'unknown'
    this.sandbox = normalizeSandbox(options.sandbox)
    this.keepOpen = options.keepOpen === true
    this.#portDetection = options.portDetection !== false
    this.createdAt = Date.now()
    this.startedAt = this.createdAt
    this.updatedAt = this.createdAt
    this.hung = false
    this.#handle = options.handle
    this.#raw = new ByteTail(options.maxOutputBytes)
    this.#onExit = options.onExit
    this.#onChange = options.onChange
    this.#onPort = options.onPort
    this.#screen = new ScreenMirror({ cols: options.cols, rows: options.rows, scrollback: options.scrollback })
    this.#exited = Promise.withResolvers()
    this.#consume().catch(() => {})
  }


  get running() {
    return this.state === 'running'
  }


  get info() {

    const info = {
      id: this.id,
      title: this.title,
      kind: this.kind,
    ...(this.group === undefined ? {} : { group: this.group }),
      owner: this.owner,
      cwd: this.cwd,
      cols: this.cols,
      rows: this.rows,
      state: this.state,
      exitCode: this.exitCode,
      signal: this.signal,
      startedAt: this.startedAt,
      endedAt: this.endedAt,
      durationMs: this.durationMs,
      shellKind: this.shellKind,
      ports: [...this.ports.values()].map((port) => ({ ...port })),
      sandbox: { ...this.sandbox },
      autoCloseAt: this.autoCloseAt,
      autoClosePaused: this.autoClosePaused,
      pinned: this.pinned,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    }
    if (this.sessionId !== undefined) info.sessionId = this.sessionId
    if (this.agentId !== undefined) info.agentId = this.agentId
    if (this.command !== undefined) info.command = this.command
    if (this.error !== undefined) info.error = this.error
    if (this.hung) info.hung = true
    return info
  }


  get whenExited() {
    return this.#exited.promise
  }


  snapshot(options = {}) {
    return {
      info: this.info,
      screen: this.#screen.serialize(options),
      text: this.#screen.visibleText(),
      cursor: this.#screen.cursor(),
      seq: this.seq,
      writerClientId: this.writerClientId,
    }
  }


  plainText() {
    return normalizeTerminalText(this.#raw.text())
  }


  plainTail(maxBytes = this.#raw.maxBytes) {
    const normalized = this.plainText()
    const bounded = tailByBytes(normalized, maxBytes)
    return { text: commandOutputText(bounded.text), truncated: bounded.truncated }
  }


  visibleText() {
    return this.#screen.visibleText()
  }


  fullText() {
    return this.#screen.fullText()
  }


  serialize(options) {
    return this.#screen.serialize(options)
  }


  readLines(options = {}) {
    const lines = clampInteger(options.lines, 50, 1, 500)
    const offset = clampInteger(options.offset, 0, 0, Number.MAX_SAFE_INTEGER)
    const all = splitLines(commandOutputText(this.plainText()))
    const total = all.length
    const endExclusive = Math.max(0, total - offset)
    const start = Math.max(0, endExclusive - lines)
    return {
      text: all.slice(start, endExclusive).join('\n'),
      startLine: total === 0 || endExclusive === 0 ? 0 : start + 1,
      endLine: endExclusive,
      totalLines: total,
      truncated: start > 0 || endExclusive < total,
    }
  }


  search(options = {}) {
    const pattern = typeof options.pattern === 'string' ? options.pattern : ''
    if (pattern.length === 0) throw new Error('pattern must be a non-empty string')
    if (pattern.length > 500) throw new Error('pattern must be at most 500 characters')
    const maxResults = clampInteger(options.maxResults, 50, 1, 500)
    const contextLines = clampInteger(options.contextLines, 0, 0, 5)
    const useRegex = options.regex === true
    let matcher
    if (useRegex) {
      try {
        matcher = new RegExp(pattern)
      } catch (error) {
        throw new Error(`invalid regular expression: ${error instanceof Error ? error.message : String(error)}`)
      }
    }
    const visible = options.scope === 'visible'
    const source = splitLines(visible ? this.visibleText() : commandOutputText(this.plainText()))

    const matches = []
    let truncated = false
    for (let index = 0; index < source.length; index += 1) {
      const line = source[index]
      const hit = matcher === undefined ? line.includes(pattern) : matcher.test(line)
      if (!hit) continue
      if (matches.length >= maxResults) {
        truncated = true
        break
      }

      const match = { line: index + 1, text: line }
      if (contextLines > 0) {
        match.before = source.slice(Math.max(0, index - contextLines), index)
        match.after = source.slice(index + 1, index + 1 + contextLines)
      }
      matches.push(match)
    }
    return { matches, truncated, totalLines: source.length }
  }


  framesSince(seq = 0) {
    const from = Number.isSafeInteger(seq) && seq >= 0 ? seq : 0
    return this.#frames.filter((frame) => frame.seq > from).map((frame) => ({ seq: frame.seq, chunk: frame.chunk }))
  }


  exportText(format = 'text') {
    const text = format === 'ansi' ? this.serialize() : commandOutputText(this.plainText())
    return { text, bytes: Buffer.byteLength(text, 'utf8'), truncated: false }
  }


  setTitle(title) {
    const value = typeof title === 'string' ? title.trim() : ''
    if (value.length === 0) throw new Error('title must be a non-empty string')
    this.title = value.slice(0, 200)
    this.updatedAt = Date.now()
    this.#onChange?.()
    this.#broadcastState()
    return this.info
  }


  setKeepOpen(value) {
    this.keepOpen = value === true
  }


  setPinned(value) {
    this.pinned = value === true
    this.updatedAt = Date.now()
    this.#broadcastState()
    return this.info
  }


  setAutoCloseAt(at) {
    this.autoCloseAt = typeof at === 'number' && Number.isFinite(at) ? at : null
    this.updatedAt = Date.now()
    this.#broadcastState()
  }


  setAutoClosePaused(value) {
    const next = value === true
    if (this.autoClosePaused === next) return
    this.autoClosePaused = next
    this.updatedAt = Date.now()
    this.#broadcastState()
  }


  pauseAutoClose(reason) {
    if (!this.autoClosePaused) {
      this.autoClosePaused = true
      this.updatedAt = Date.now()
    }
    this.#broadcastState()
    return this.info
  }


  resumeAutoClose() {
    if (this.autoClosePaused) {
      this.autoClosePaused = false
      this.updatedAt = Date.now()
    }
    this.#broadcastState()
    return this.info
  }


  async sendSignal(name) {
    const upper = typeof name === 'string' ? name.trim().toUpperCase() : ''
    if (upper === 'SIGINT') {
      if (this.state !== 'running') throw new Error(`terminal ${this.id} is not running`)
      await this.write('\x03')
      return { delivered: 'SIGINT' }
    }
    const allowed = new Set(['SIGTERM', 'SIGKILL', 'SIGHUP', 'SIGTSTP'])
    if (!allowed.has(upper)) {
      throw new Error(`unsupported signal ${JSON.stringify(name)}; allowed: SIGINT, SIGTERM, SIGKILL, SIGHUP, SIGTSTP`)
    }
    await this.terminate()
    return { delivered: upper }
  }


  write(data) {
    if (typeof data !== 'string' || data.length === 0) return Promise.resolve()
    return this.#enqueue(async () => {
      if (this.state !== 'running') throw new Error(`terminal ${this.id} is not running`)
      await this.#handle.write(data)
      this.updatedAt = Date.now()
    })
  }


  resize(cols, rows) {
    return this.#enqueue(async () => {
      if (this.state !== 'running') throw new Error(`terminal ${this.id} is not running`)
      await this.#handle.resize(cols, rows)
      this.#screen.resize(cols, rows)
      this.cols = cols
      this.rows = rows
      this.updatedAt = Date.now()
      this.#broadcastState()
      this.#onChange?.()
    })
  }


  attachClient(clientId) {
    assertClientId(clientId)
    this.#clients.add(clientId)
    if (this.writerClientId === null) this.writerClientId = clientId
    this.#broadcastState()
    return { writerClientId: this.writerClientId }
  }


  detachClient(clientId) {
    if (typeof clientId !== 'string' || clientId.length === 0) return { writerClientId: this.writerClientId }
    this.#clients.delete(clientId)
    if (this.writerClientId === clientId) {
      const next = this.#clients.values().next()
      this.writerClientId = next.done === true ? null : next.value
    }
    this.#broadcastState()
    return { writerClientId: this.writerClientId }
  }


  takeControl(clientId) {
    assertClientId(clientId)
    this.#clients.add(clientId)
    this.writerClientId = clientId
    this.#broadcastState()
    return { writerClientId: this.writerClientId }
  }


  isWritable(clientId) {
    if (this.writerClientId === null) return true
    return typeof clientId === 'string' && clientId === this.writerClientId
  }


  requestCapture(options = {}) {
    if (this.#disposed !== undefined) return Promise.reject(new Error('terminal screen mirror disposed'))
    const timeoutMs = clampInteger(options.timeoutMs, DEFAULT_CAPTURE_TIMEOUT_MS, MIN_CAPTURE_TIMEOUT_MS, MAX_CAPTURE_TIMEOUT_MS)
    const requestId = randomUUID()
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        const pending = this.#captures.get(requestId)
        if (pending === undefined) return
        this.#captures.delete(requestId)
        reject(Object.assign(new Error('capture request timed out'), { code: 'CAPTURE_TIMEOUT', requestId }))
      }, timeoutMs)
      this.#captures.set(requestId, { resolve, reject, timer })
      this.#broadcast('capture-request', { terminalId: this.id, requestId })
    })
  }


  resolveCapture(requestId, payload) {
    if (typeof requestId !== 'string' || requestId.length === 0) throw new Error('requestId is required')
    const pending = this.#captures.get(requestId)
    if (pending === undefined) return false
    const buffer = toImageBuffer(payload?.buffer)
    this.#captures.delete(requestId)
    clearTimeout(pending.timer)
    if (buffer === undefined) {
      pending.reject(Object.assign(new Error('capture payload is not a PNG/JPEG buffer'), { code: 'CAPTURE_INVALID' }))
      return false
    }
    pending.resolve({
      buffer,
      width: Number.isSafeInteger(payload?.width) ? payload.width : 0,
      height: Number.isSafeInteger(payload?.height) ? payload.height : 0,
    })
    return true
  }


  async waitReady(options = {}) {
    const quietMs = options.quietMs ?? 120
    const timeoutMs = options.timeoutMs ?? 3000
    const startedAt = Date.now()
    let lastBytes = this.#raw.byteLength
    let quietSince = Date.now()
    while (this.state === 'running') {
      if (options.signal?.aborted === true) return
      await sleep(POLL_INTERVAL_MS)
      const bytes = this.#raw.byteLength
      if (bytes !== lastBytes) {
        lastBytes = bytes
        quietSince = Date.now()
        continue
      }
      if (Date.now() - quietSince >= quietMs) return
      if (Date.now() - startedAt >= timeoutMs) return
    }
  }


  subscribe(listener) {
    this.#subscribers.add(listener)
    return () => {
      this.#subscribers.delete(listener)
    }
  }


  terminate() {
    if (this.#termination !== undefined) return this.#termination
    this.#closing = true
    this.#termination = (async () => {
      try {
        if (typeof this.#handle.terminate === 'function') await this.#handle.terminate()
      } catch {

      }
    })()
    return this.#termination
  }


  dispose() {
    if (this.#disposed !== undefined) return this.#disposed
    this.#disposed = (async () => {
      for (const [requestId, pending] of this.#captures) {
        clearTimeout(pending.timer)
        pending.reject(Object.assign(new Error('terminal disposed before the capture arrived'), { code: 'TERMINAL_DISPOSED', requestId }))
      }
      this.#captures.clear()
      this.#clients.clear()
      await this.terminate()
      this.#subscribers.clear()
      this.#screen.dispose()
    })()
    return this.#disposed
  }


  #output(data) {
    if (data.length === 0) return Promise.resolve()
    return this.#enqueue(async () => {
      await this.#screen.write(data)
      this.#raw.append(data)
      this.seq += 1
      this.updatedAt = Date.now()
      this.#recordFrame(this.seq, data)
      this.#detectPorts(data)
      this.#broadcast('output', { id: this.id, seq: this.seq, chunk: data })
    })
  }


  #detectPorts(data) {
    if (!this.#portDetection) return
    let cleaned
    try {
      cleaned = normalizeTerminalText(data)
    } catch {
      return
    }
    const combined = this.#portTail + cleaned
    this.#portTail = combined.length > 512 ? combined.slice(-512) : combined
    let found
    try {
      found = extractPorts(combined)
    } catch {
      return
    }
    if (found.length === 0) return

    const added = []
    for (const port of found) {
      const existing = this.ports.get(port.url)
      if (existing !== undefined) {
        existing.lastSeenAt = port.lastSeenAt
        continue
      }
      if (this.ports.size >= MAX_PORTS) {
        const oldest = [...this.ports.values()].sort((left, right) => left.firstSeenAt - right.firstSeenAt)[0]
        if (oldest !== undefined) this.ports.delete(oldest.url)
      }
      this.ports.set(port.url, port)
      added.push(port)
    }
    if (added.length === 0) return
    try {
      this.#onPort?.(added)
    } catch {

    }
  }


  #recordFrame(seq, chunk) {
    this.#frames.push({ seq, chunk })
    this.#frameBytes += Buffer.byteLength(chunk, 'utf8')
    while (this.#frameBytes > MAX_FRAME_BYTES && this.#frames.length > 1) {
      const dropped = this.#frames.shift()
      if (dropped === undefined) break
      this.#frameBytes -= Buffer.byteLength(dropped.chunk, 'utf8')
    }
  }


  #broadcastState() {
    this.#broadcast('state', { info: this.info, writerClientId: this.writerClientId })
  }

  async #consume() {
    const outcome = this.#handle.done.then(
      (value) => ({ ok: true, value }),
      (error) => ({ ok: false, error }),
    )
    try {
      for await (const chunk of this.#handle.output) {
        const data = this.#decoder.decode(chunk, { stream: true })
        await this.#output(data)
      }
      const flushed = this.#decoder.decode()
      await this.#output(flushed)
      const result = await outcome
      if (!result.ok) throw result.error
      const value = result.value ?? {}
      this.#finish({ state: 'exited', exitCode: value.exitCode ?? null, signal: value.signal ?? null })
    } catch (error) {




      void this.terminate().catch(() => {})
      this.#finish({
        state: 'failed',
        exitCode: null,
        signal: null,
        error: error instanceof Error ? error.message : String(error),
      })
    } finally {
      this.#consuming = false
    }
  }


  #finish(outcome) {
    if (this.state !== 'running') return
    this.state = outcome.state
    this.exitCode = outcome.exitCode
    this.signal = outcome.signal
    this.endedAt = Date.now()
    this.durationMs = Math.max(0, this.endedAt - this.startedAt)
    if (outcome.error !== undefined) this.error = outcome.error
    this.updatedAt = this.endedAt
    this.#exited.resolve({ exitCode: this.exitCode, signal: this.signal })
    this.#broadcastState()
    this.#broadcast('exit', { id: this.id, exitCode: this.exitCode, signal: this.signal, durationMs: this.durationMs })
    this.#onChange?.()
    try {
      this.#onExit?.(this.info)
    } catch {

    }
  }

  #enqueue(operation) {
    const run = this.#queue.then(operation, operation)
    this.#queue = run.then(
      () => undefined,
      () => undefined,
    )
    return run
  }

  #broadcast(name, data) {
    for (const listener of this.#subscribers) {
      try {
        listener(name, data)
      } catch {

      }
    }
  }
}

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function clampInteger(value, fallback, min, max) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback
  return Math.min(max, Math.max(min, Math.floor(value)))
}

function splitLines(text) {
  const value = typeof text === 'string' ? text : ''
  if (value.length === 0) return []
  return value.split('\n')
}

function normalizeSandbox(sandbox) {
  if (sandbox === null || sandbox === undefined || typeof sandbox !== 'object') return { ...DEFAULT_SANDBOX }
  return {
    mode: typeof sandbox.mode === 'string' && sandbox.mode.length > 0 ? sandbox.mode : DEFAULT_SANDBOX.mode,
    confined: sandbox.confined === true,
    required: sandbox.required === true,
  }
}

function assertClientId(clientId) {
  if (typeof clientId !== 'string' || clientId.length === 0 || clientId.length > 200) {
    throw new Error('clientId must be a non-empty string (max 200 chars)')
  }
}

function toImageBuffer(value) {
  let buffer
  if (Buffer.isBuffer(value)) buffer = value
  else if (value instanceof Uint8Array) buffer = Buffer.from(value)
  else if (typeof value === 'string' && value.length > 0) {
    const comma = value.indexOf(',')
    const base64 = value.startsWith('data:') && comma >= 0 ? value.slice(comma + 1) : value
    try {
      buffer = Buffer.from(base64, 'base64')
    } catch {
      return undefined
    }
  } else return undefined
  if (buffer.length < 8) return undefined
  const png = buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  const jpeg = buffer[0] === 0xff && buffer[1] === 0xd8
  const webp = buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP'
  if (!png && !jpeg && !webp) return undefined
  return buffer
}

export { TERMINAL_TYPE }
