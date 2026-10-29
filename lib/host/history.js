import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

const FORMAT_VERSION = 1

const MAX_TEXT_BYTES = 64 * 1024

const SAVE_DEBOUNCE_MS = 500

function tailByBytes(text, maxBytes) {
  const value = typeof text === 'string' ? text : ''
  const bytes = Buffer.from(value, 'utf8')
  if (bytes.length <= maxBytes) return { text: value, truncated: false }
  let start = bytes.length - maxBytes
  while (start < bytes.length && (bytes[start] & 0xc0) === 0x80) start += 1
  return { text: bytes.subarray(start).toString('utf8'), truncated: true }
}

export class CommandHistory {

  #entries = []

  #size

  #file

  #logger

  #persist

  #saveTimer

  #dirty = false

  #disposed = false


  constructor(options = {}) {
    const requestedSize = Number.isSafeInteger(options.size) && options.size >= 0 ? options.size : 20
    this.#size = requestedSize
    this.#file = typeof options.file === 'string' && options.file.trim().length > 0 ? options.file.trim() : undefined
    this.#logger = options.logger
    this.#persist = options.persist !== false && this.#file !== undefined
    this.load()
  }


  get size() {
    return this.#entries.length
  }


  get persistent() {
    return this.#persist
  }


  get file() {
    return this.#file
  }


  add(entry) {
    const normalized = this.#normalize(entry)
    if (normalized === undefined) throw new Error('history entry requires an id')
    const existing = this.#entries.findIndex((item) => item.id === normalized.id)
    if (existing >= 0) this.#entries.splice(existing, 1)
    this.#entries.unshift(normalized)
    if (this.#entries.length > this.#size) this.#entries.length = this.#size
    this.#markDirty()
    return normalized
  }


  list(options = {}) {
    const requestedLimit = Number.isSafeInteger(options.limit) && options.limit >= 0 ? options.limit : 50
    const limit = Math.min(requestedLimit, this.#entries.length)
    const terminalId = typeof options.terminalId === 'string' && options.terminalId.length > 0 ? options.terminalId : undefined
    const source = terminalId === undefined ? this.#entries : this.#entries.filter((entry) => entry.id === terminalId)
    return source.slice(0, limit).map((entry) => structuredClone(entry))
  }


  get(id) {
    if (typeof id !== 'string' || id.length === 0) return undefined
    const entry = this.#entries.find((item) => item.id === id)
    return entry === undefined ? undefined : structuredClone(entry)
  }


  load() {
    if (!this.#persist || this.#file === undefined) return
    if (!existsSync(this.#file)) return
    try {
      const raw = readFileSync(this.#file, 'utf8')
      if (raw.trim().length === 0) return
      const parsed = JSON.parse(raw)
      const entries = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.entries) ? parsed.entries : undefined
      if (entries === undefined) throw new Error('history file has no entries array')
      const normalized = []
      for (const entry of entries) {
        const item = this.#normalize(entry)
        if (item !== undefined) normalized.push(item)
      }
      this.#entries = normalized.slice(0, this.#size)
    } catch (error) {
      this.#warn(`failed to load terminal history from ${this.#file}: ${error instanceof Error ? error.message : String(error)}`)
    }
  }


  save() {
    if (!this.#persist || this.#file === undefined || this.#disposed) return
    if (this.#saveTimer !== undefined) {
      clearTimeout(this.#saveTimer)
      this.#saveTimer = undefined
    }
    this.#dirty = false
    const tmp = `${this.#file}.${process.pid}.tmp`
    try {
      mkdirSync(dirname(this.#file), { recursive: true, mode: 0o700 })


      writeFileSync(tmp, JSON.stringify({ version: FORMAT_VERSION, entries: this.#entries }), { encoding: 'utf8', mode: 0o600 })
      renameOver(tmp, this.#file)
    } catch (error) {
      this.#warn(`failed to save terminal history to ${this.#file}: ${error instanceof Error ? error.message : String(error)}`)
      try {
        rmSync(tmp, { force: true })
      } catch {

      }
    }
  }


  #markDirty() {
    if (!this.#persist || this.#disposed) return
    this.#dirty = true
    if (this.#saveTimer !== undefined) return
    this.#saveTimer = setTimeout(() => {
      this.#saveTimer = undefined
      if (this.#dirty) this.save()
    }, SAVE_DEBOUNCE_MS)
    this.#saveTimer.unref?.()
  }


  dispose() {
    if (this.#disposed) return
    if (this.#dirty) this.save()
    this.#disposed = true
    if (this.#saveTimer !== undefined) {
      clearTimeout(this.#saveTimer)
      this.#saveTimer = undefined
    }
  }


  #normalize(entry) {
    if (entry === null || typeof entry !== 'object') return undefined
    const source =  (entry)
    if (typeof source.id !== 'string' || source.id.length === 0) return undefined
    const text = tailByBytes(typeof source.text === 'string' ? source.text : '', MAX_TEXT_BYTES)
    const startedAt = numberOr(source.startedAt, 0)
    const endedAt = numberOr(source.endedAt, startedAt)
    const durationMs = numberOr(source.durationMs, Math.max(0, endedAt - startedAt))
    const reason = source.reason === 'auto-close' || source.reason === 'failed' ? source.reason : 'closed'
    return {
      id: source.id,
      title: typeof source.title === 'string' ? source.title : source.id,
      command: typeof source.command === 'string' ? source.command : '',
      cwd: typeof source.cwd === 'string' ? source.cwd : '',
      kind: 'command',
      exitCode: typeof source.exitCode === 'number' ? source.exitCode : null,
      signal: typeof source.signal === 'string' ? source.signal : null,
      startedAt,
      endedAt,
      durationMs,
      cols: Number.isSafeInteger(source.cols) ? source.cols : 80,
      rows: Number.isSafeInteger(source.rows) ? source.rows : 24,
      reason,
      text: text.text,
      truncated: text.truncated || source.truncated === true,
      ports: Array.isArray(source.ports) ? source.ports.filter((port) => port !== null && typeof port === 'object').map((port) => ({ ...port })) : [],
      sandbox:
        source.sandbox !== null && typeof source.sandbox === 'object'
          ? { ...source.sandbox }
          : { mode: 'danger-full-access', confined: false, required: false },



      ...(typeof source.agentId === 'string' && source.agentId.length > 0 ? { agentId: source.agentId } : {}),
      ...(typeof source.sessionId === 'string' && source.sessionId.length > 0 ? { sessionId: source.sessionId } : {}),
      owner: source.owner === 'user' ? 'user' : 'agent',
    }
  }


  #warn(message) {
    try {
      this.#logger?.warn?.(`[dsh-web-terminal] ${message}`)
    } catch {

    }
  }
}

function numberOr(value, fallback) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function renameOver(tmp, target) {
  try {
    renameSync(tmp, target)
  } catch (error) {
    const code =  (error).code
    if (code !== 'EEXIST' && code !== 'EPERM' && code !== 'EACCES') throw error
    rmSync(target, { force: true })
    renameSync(tmp, target)
  }
}

export function historyFilePath(directory, name = 'history.json') {
  return join(directory, name)
}
