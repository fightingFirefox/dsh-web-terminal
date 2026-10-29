// Command ledger: one structured record per command terminal.
import { appendFile, mkdir } from 'node:fs/promises'
import { dirname } from 'node:path'

export class CommandLedger {
  #entries = []
  #byId = new Map()
  #limit
  #file
  #persist

  constructor(options = {}) {
    this.#limit = Number.isInteger(options.limit) && options.limit > 0 ? options.limit : 500
    this.#file = typeof options.file === 'string' && options.file !== '' ? options.file : undefined
    this.#persist = options.persist !== false && this.#file !== undefined
  }

  start(session) {
    const entry = {
      id: session.id,
      kind: session.kind,
      title: session.title,
      command: session.command ?? undefined,
      group: session.group,
      cwd: session.cwd,
      sessionId: session.sessionId,
      agentId: session.agentId,
      owner: session.owner,
      shellKind: session.shellKind,
      state: 'running',
      startedAt: session.startedAt,
    }
    this.#entries.push(entry)
    this.#byId.set(entry.id, entry)
    while (this.#entries.length > this.#limit) {
      const dropped = this.#entries.shift()
      if (dropped !== undefined) this.#byId.delete(dropped.id)
    }
    this.#write(entry)
    return entry
  }

  finish(session) {
    const entry = this.#byId.get(session.id)
    if (entry === undefined) return undefined
    entry.state = session.state
    entry.exitCode = session.exitCode
    entry.signal = session.signal
    entry.endedAt = session.endedAt
    entry.durationMs = session.durationMs
    entry.ports = session.info.ports
    this.#write(entry)
    return entry
  }

  list(options = {}) {
    const limit = Number.isInteger(options.limit) ? Math.max(1, Math.min(this.#limit, options.limit)) : 50
    const terminalId = typeof options.terminalId === 'string' ? options.terminalId : undefined
    const sessionId = typeof options.sessionId === 'string' ? options.sessionId : undefined
    const rows = this.#entries.filter(
      (entry) =>
        (terminalId === undefined || entry.id === terminalId) &&
        (sessionId === undefined || entry.sessionId === sessionId),
    )
    return rows.slice(-limit).reverse().map((entry) => ({ ...entry }))
  }

  exportText(format = 'markdown') {
    const rows = this.#entries
    if (format === 'jsonl') return rows.map((entry) => JSON.stringify(entry)).join('\n') + '\n'
    const header = '| started | duration | exit | cwd | command |\n| --- | --- | --- | --- | --- |\n'
    return header + rows
      .map((entry) => {
        const started = new Date(entry.startedAt).toISOString()
        const duration = entry.durationMs === undefined ? '-' : Math.round(entry.durationMs / 1000) + 's'
        const exit = entry.exitCode === undefined || entry.exitCode === null ? '-' : String(entry.exitCode)
        const command = String(entry.command ?? entry.title ?? '').replace(/\|/g, '\\|')
        return '| ' + started + ' | ' + duration + ' | ' + exit + ' | ' + (entry.cwd ?? '') + ' | ' + command + ' |'
      })
      .join('\n') + '\n'
  }

  #write(entry) {
    if (!this.#persist || this.#file === undefined) return
    void (async () => {
      try {
        await mkdir(dirname(this.#file), { recursive: true })
        await appendFile(this.#file, JSON.stringify(entry) + '\n', 'utf8')
      } catch {

      }
    })()
  }
}

