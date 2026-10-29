// Persistent interactive shell for intercepted agent commands.
// One real PTY per (conversation, shell kind): the prompt, the echoed
// command and the output all come from the shell itself. Completion is
// detected from the rendered prompt, and the exit code arrives through a
// prompt hook that appends to a small marker file (never drawn on screen).

import { randomUUID } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const POLL_MS = 40
const QUIET_MS = 140
const INIT_QUIET_MS = 250
const READY_TIMEOUT_MS = 30_000
const INIT_TIMEOUT_MS = 30_000
const MARKER_WAIT_MS = 600
const INTERRUPT_GRACE_MS = 5_000
const PROMPT_PATTERN = /^PS .*>\s*$/u

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function pwshQuote(value) {
  return "'" + String(value).replaceAll("'", "''") + "'"
}

function shQuote(value) {
  return "'" + String(value).replaceAll("'", "'\\''") + "'"
}

function lines(text) {
  return String(text).replace(/\r\n/gu, '\n').replace(/\r/gu, '').split('\n')
}

function trimRight(text) {
  return String(text).replace(/\s+$/u, '')
}

function tailLine(text) {
  const rows = lines(text).map((line) => line.trim()).filter((line) => line !== '')
  return rows[rows.length - 1] ?? ''
}

function lastMarker(text) {
  const rows = lines(text).map((line) => line.trim()).filter((line) => line !== '')
  const line = rows[rows.length - 1]
  if (line === undefined) return undefined
  const match = /^(-?\d+);([01])$/u.exec(line)
  if (match === null) return undefined
  return { code: Number(match[1]), ok: match[2] === '1' }
}

// Strip the pre-command screen prefix, the echoed command block and the
// trailing prompt, leaving only what the command printed.
function extractOutput(before, after, command) {
  const beforeLines = lines(before).map(trimRight)
  const afterLines = lines(after).map(trimRight)
  let shared = 0
  while (shared < beforeLines.length && shared < afterLines.length && beforeLines[shared] === afterLines[shared]) shared += 1
  const fresh = afterLines.slice(shared)
  const echo = lines(command).map((line) => line.trim()).filter((line) => line !== '')
  let cursor = 0
  let end = -1
  for (const want of echo) {
    let found = -1
    for (let index = cursor; index < fresh.length; index += 1) {
      if (fresh[index].trim().endsWith(want)) {
        found = index
        break
      }
    }
    if (found === -1) break
    cursor = found + 1
    end = found
  }
  const body = fresh.slice(end + 1)
  while (body.length > 0) {
    const tail = body[body.length - 1].trim()
    if (tail === '' || PROMPT_PATTERN.test(tail) || /^>>?\s*>?$/u.test(tail)) body.pop()
    else break
  }
  return body.join('\n').replace(/\n{3,}/gu, '\n\n').trim()
}

function screenText(session) {
  try {
    if (typeof session.fullText === 'function') return session.fullText()
    return session.plainText()
  } catch {
    return ''
  }
}

export class AgentShells {
  #plugin
  #entries = new Map()
  #creating = new Map()
  #closed = false

  constructor(plugin) {
    this.#plugin = plugin
  }

  async run(exec, options) {
    const kind = exec?.name === 'bash' ? 'bash' : 'pwsh'
    const conversation = conversationId(exec)
    const key = kind + ':' + conversation
    const cwd = options.cwd === undefined ? undefined : String(options.cwd)
    const timeoutMs = Number.isFinite(options.timeoutMs) && options.timeoutMs > 0 ? options.timeoutMs : 180_000
    const entry = await this.#ensure(key, kind, exec, conversation, cwd, options.signal)
    const queued = (entry.chain ?? Promise.resolve()).then(
      () => this.#execute(entry, cwd, timeoutMs, exec, options, key),
      () => this.#execute(entry, cwd, timeoutMs, exec, options, key),
    )
    entry.chain = queued.catch(() => {})
    return queued
  }

  async #execute(entry, cwd, timeoutMs, exec, options, key) {
    const session = entry.session
    if (session.running !== true) {
      this.#entries.delete(key)
      throw new Error('agent shell is not running')
    }
    if (typeof cwd === 'string' && cwd !== entry.cwd) {
      await this.#changeDirectory(entry, cwd, options.signal)
    }
    await this.#settleQuiet(entry)
    await writeFile(entry.mark, '', 'utf8').catch(() => {})
    const before = screenText(session)
    const startedAt = Date.now()
    const ledger = this.#ledger()
    const ledgerEntry = ledger === undefined ? undefined : ledger.start({
      id: entry.id + ':' + randomUUID(),
      kind: 'command',
      title: options.command,
      command: options.command,
      group: options.group,
      cwd: entry.cwd,
      sessionId: exec?.agent?.session?.id,
      agentId: exec?.agent?.id,
      owner: 'agent',
      shellKind: entry.kind,
      startedAt,
    })
    const finishLedger = (state, exitCode, signal) => {
      if (ledger === undefined || ledgerEntry === undefined) return
      ledger.finish({
        ...ledgerEntry,
        state,
        exitCode,
        signal: signal ?? null,
        endedAt: Date.now(),
        durationMs: Date.now() - startedAt,
        info: { ports: [] },
      })
    }
    let completed = false
    let timedOut = false
    let exitCode = null
    try {
      await this.#send(session, options.command)
      completed = await this.#waitPrompt(entry, before, timeoutMs, options.signal)
      if (!completed) {
        timedOut = options.signal?.aborted !== true
        await this.#interrupt(session)
        await this.#waitPrompt(entry, before, INTERRUPT_GRACE_MS)
      }
      const marker = await this.#readMarker(entry)
      exitCode = marker === undefined ? null : (marker.ok ? marker.code : (marker.code === 0 ? 1 : marker.code))
    } catch (error) {
      finishLedger('failed', null, null)
      throw error
    }
    const after = screenText(session)
    const output = extractOutput(before, after, options.command)
    if (session.running !== true) {
      this.#entries.delete(key)
      if (exitCode === null) exitCode = session.exitCode ?? null
    }
    finishLedger(timedOut ? 'failed' : 'closed', exitCode, timedOut ? 'SIGTERM' : null)
    return {
      output,
      exitCode,
      timedOut,
      aborted: timedOut && options.signal?.aborted === true,
      durationMs: Date.now() - startedAt,
      terminalId: session.id,
    }
  }

  // Wait until output goes quiet, then confirm the screen ends on a prompt.
  // Quiet detection uses the session frame counter, so the full screen text is
  // only rendered once per quiet window instead of on every poll.
  async #waitPrompt(entry, baseline, timeoutMs) {
    const deadline = Date.now() + timeoutMs
    let lastSeq = -1
    let quietSince = Date.now()
    let lastCheck = 0
    let sawChange = false
    while (entry.session.running === true) {
      const seq = typeof entry.session.seq === 'number' ? entry.session.seq : 0
      if (seq !== lastSeq) {
        lastSeq = seq
        quietSince = Date.now()
      } else if (Date.now() - quietSince >= QUIET_MS && Date.now() - lastCheck >= QUIET_MS) {
        lastCheck = Date.now()
        const text = screenText(entry.session)
        if (text !== baseline) sawChange = true
        if (sawChange && PROMPT_PATTERN.test(tailLine(text))) return true
      }
      if (Date.now() >= deadline) return false
      await sleep(POLL_MS)
    }
    return true
  }

  async #readMarker(entry) {
    const deadline = Date.now() + MARKER_WAIT_MS
    while (Date.now() < deadline) {
      const text = await readFile(entry.mark, 'utf8').catch(() => '')
      const marker = lastMarker(text)
      if (marker !== undefined) return marker
      await sleep(POLL_MS)
    }
    return undefined
  }

  async #changeDirectory(entry, cwd, signal) {
    const command = entry.kind === 'bash'
      ? 'cd -- ' + shQuote(cwd) + ' && export PS1=\'PS \\w> \''
      : 'Set-Location -LiteralPath ' + pwshQuote(cwd)
    const before = screenText(entry.session)
    await this.#send(entry.session, command)
    await this.#waitPrompt(entry, before, 15_000)
    entry.cwd = cwd
  }

  async #interrupt(session) {
    try {
      await session.write('\u0003')
    } catch {

    }
  }

  // Type like a person: text first, a short pause, then the Enter key.
  // Sending text and CR in one chunk makes PSReadLine print a blank line.
  async #send(session, command) {
    const rows = lines(command)
    for (let index = 0; index < rows.length; index += 1) {
      if (rows[index] !== '') {
        await session.write(rows[index])
        await sleep(15)
      }
      if (index < rows.length - 1) await session.write('\r')
    }
    await sleep(40)
    await session.write('\r')
  }

  #ledger() {
    const registry = this.#plugin?.registry
    return registry === undefined ? undefined : registry.ledger
  }

  async #ensure(key, kind, exec, conversation, cwd, signal) {
    const existing = this.#entries.get(key)
    if (existing !== undefined && existing.session.running === true) return existing
    if (existing !== undefined) this.#entries.delete(key)
    const pending = this.#creating.get(key)
    if (pending !== undefined) return pending
    const creation = this.#create(key, kind, exec, conversation, cwd, signal)
    this.#creating.set(key, creation)
    try {
      return await creation
    } finally {
      if (this.#creating.get(key) === creation) this.#creating.delete(key)
    }
  }

  async #create(key, kind, exec, conversation, cwd, signal) {
    const registry = this.#plugin?.registry
    if (registry === undefined) throw new Error('terminal registry is unavailable')
    const id = randomUUID()
    const dir = join(tmpdir(), 'dsh-web-terminal')
    await mkdir(dir, { recursive: true })
    const mark = join(dir, 'shell-' + id + '.mark')
    await writeFile(mark, '', 'utf8')
    await this.#retireCommandSessions(conversation)
    const session = await registry.createInteractive({
      agent: exec?.agent,
      agentId: exec?.agent?.id,
      ...(conversation.startsWith('unscoped:') ? {} : { sessionId: conversation }),
      owner: 'agent',
      title: kind,
      cwd,
      shellKindHint: kind,
      cols: 120,
      rows: 32,
      env: { DSH_WEB_TERMINAL_MARK: mark },
      signal,
    })
    const entry = { id, kind, mark, cwd: cwd ?? session.cwd, session }
    try {
      await session.waitReady({ signal, timeoutMs: READY_TIMEOUT_MS })
      await this.#initShell(entry)
    } catch (error) {
      await registry.close(session.id).catch(() => {})
      throw error
    }
    this.#entries.set(key, entry)
    return entry
  }

  async #initShell(entry) {
    const script = entry.kind === 'bash' ? bashInit() : pwshInit()
    const before = ''
    await this.#send(entry.session, script)
    const deadline = Date.now() + INIT_TIMEOUT_MS
    let ready = false
    while (Date.now() < deadline) {
      if (entry.session.running !== true) throw new Error('agent shell exited during setup')
      ready = await this.#waitPrompt(entry, before, 500)
      if (ready) break
    }
    if (!ready) throw new Error('agent shell did not reach a prompt')
    await this.#settleQuiet(entry)
    await writeFile(entry.mark, '', 'utf8').catch(() => {})
  }

  async #settleQuiet(entry) {
    let lastSeq = -1
    let quietSince = Date.now()
    while (Date.now() - quietSince < 5_000) {
      const seq = typeof entry.session.seq === 'number' ? entry.session.seq : 0
      if (seq !== lastSeq) {
        lastSeq = seq
        quietSince = Date.now()
      } else if (Date.now() - quietSince >= INIT_QUIET_MS) {
        return
      }
      await sleep(POLL_MS)
    }
  }

  async #retireCommandSessions(conversation) {
    const registry = this.#plugin?.registry
    if (registry === undefined) return
    if (conversation.startsWith('unscoped:')) return
    for (const info of registry.list()) {
      if (info.kind !== 'command' || info.state === 'running' || info.pinned === true) continue
      if (info.sessionId !== conversation) continue
      await registry.close(info.id).catch(() => {})
    }
  }

  async dispose() {
    if (this.#closed) return
    this.#closed = true
    const entries = [...this.#entries.values()]
    this.#entries.clear()
    for (const entry of entries) {
      await entry.session.terminate().catch(() => {})
    }
  }
}

function conversationId(exec) {
  const session = exec?.agent?.session?.id
  if (typeof session === 'string' && session !== '') return session
  const agent = exec?.agent?.id
  if (typeof agent === 'string' && agent !== '') return agent
  return 'unscoped:' + randomUUID()
}

function pwshInit() {
  return [
    'function global:prompt {',
    '  $dshOk = $?',
    '  $dshCode = [int]$LASTEXITCODE',
    '  $global:LASTEXITCODE = 0',
    '  try { [System.IO.File]::AppendAllText($env:DSH_WEB_TERMINAL_MARK, [string]$dshCode + \';\' + [string][int]$dshOk + "`n") } catch { }',
    "  'PS ' + $PWD.Path + '> '",
    '}',
    'Clear-Host',
  ].join('\n')
}

function bashInit() {
  return [
    '__dsh_mark() { printf \'%s\\n\' "$?" >> "$DSH_WEB_TERMINAL_MARK"; }',
    'PROMPT_COMMAND="__dsh_mark${PROMPT_COMMAND:+; $PROMPT_COMMAND}"',
    'PS1=\'PS \\w> \'',
    'clear',
  ].join('\n')
}
