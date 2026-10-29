import { randomUUID } from 'node:crypto'
import { homedir } from 'node:os'
import { isAbsolute, join, resolve as resolvePath } from 'node:path'
import { CommandHistory } from './history.js'
import { CommandLedger } from './ledger.js'
import { IdleWatchdog } from './watchdog.js'
import { commandArgv, interactiveArgv, resolveShell, sshArgv, sshTitle, withEchoHeader } from './shell.js'
import { sleep, TerminalPanelSession } from './session.js'
import { commandTitle } from './wrapper.js'

export const DEFAULT_COLS = 120

export const DEFAULT_ROWS = 30

export const MAX_COLS = 500

export const MAX_ROWS = 200

const TERMINAL_TYPE = 'xterm-256color'

const COMMAND_TRANSCRIPT_LIMIT = 200_000

const GRACE_MS = 1000

const VISIBILITY_FALLBACK_MS = 4000

const HISTORY_TEXT_BYTES = 64 * 1024

const DEFAULT_WAIT_TIMEOUT_MS = 30_000

const WAIT_TEXT_BYTES = 16 * 1024

export function normalizeDimensions(cols, rows) {
  const width = Number.isSafeInteger(cols) && cols >= 2 && cols <= MAX_COLS ? cols : DEFAULT_COLS
  const height = Number.isSafeInteger(rows) && rows >= 1 && rows <= MAX_ROWS ? rows : DEFAULT_ROWS
  return { cols: width, rows: height }
}

export class TerminalRegistry {

  #sessions = new Map()

  #agentTerminals = new Map()

  #startingDefaults = new Set()

  #hidden = new Set()

  #visibilityTimers = new Map()

  #visibilityFallbackTimers = new Map()

  #autoCloseTimers = new Map()

  #commandMeta = new Map()

  #lastSessionsSignature = '[]'

  #creating = new Map()

  #eventSubscribers = new Set()

  #ledger

  #watchdog

  #subprocess

  #workingDirectory

  #sessionStore

  #getSessionStore

  #sessionQuery

  #getSessionQuery

  #logger

  #config

  #getConfig

  #echoHeaders = new Map()

  #lastCommandSession = new Map()

  #transcripts = new Map()

  #seedBySession = new Map()

  #transcriptKeyBySession = new Map()

  #resolveSandboxPolicy

  #history

  #shellPromises = new Map()

  #pending = 0

  #pendingBySession = new Map()

  #disposed = false


  constructor({
    subprocess,
    workingDirectory,
    sessions,
    getSessionStore,
    sessionQuery,
    getSessionQuery,
    logger,
    config,
    getConfig,
    resolveSandboxPolicy,
  }) {
    if (subprocess === undefined || subprocess === null) throw new Error('dsh-web-terminal: subprocess service is required')
    this.#subprocess = subprocess
    this.#workingDirectory = workingDirectory
    this.#sessionStore = sessions
    this.#getSessionStore = typeof getSessionStore === 'function' ? getSessionStore : undefined
    this.#sessionQuery = sessionQuery
    this.#getSessionQuery = typeof getSessionQuery === 'function' ? getSessionQuery : undefined
    this.#logger = logger
    this.#config = config !== null && typeof config === 'object' ? config : {}
    this.#getConfig = typeof getConfig === 'function' ? getConfig : undefined
    this.#resolveSandboxPolicy = typeof resolveSandboxPolicy === 'function' ? resolveSandboxPolicy : undefined
    this.#history = new CommandHistory({
      size: this.#configInteger('historySize', 20, 0, 500),
      file: this.#configString('historyPath'),
      persist: this.#configFlag('historyPersist', true),
      logger: logger,
    })
    this.#ledger = this.#configFlag('ledgerEnabled', true)
      ? new CommandLedger({
          limit: this.#configInteger('ledgerSize', 500, 1, 5000),
          file: this.#configString('ledgerPath') ?? join(homedir(), '.dsh', 'dsh-web-terminal', 'ledger.jsonl'),
          persist: this.#configFlag('ledgerPersist', true),
        })
      : undefined
    const idleMs = this.#configInteger('watchdogIdleMs', 300_000, 0, 86_400_000)
    this.#watchdog = new IdleWatchdog({
      idleMs,
      onHung: (session, hung) => {
        if (!hung) return
        this.#emitEvent('notice', {
          type: 'hung',
          terminalId: session.id,
          title: session.title,
          idleMs,
        })
      },
    })
  }

  get ledger() {
    return this.#ledger
  }


  get size() {
    return this.#sessions.size
  }


  get config() {
    return this.#config
  }


  get history() {
    return this.#history
  }


  list() {
    return [...this.#sessions.values()]
      .filter((session) => !this.#hidden.has(session.id))
      .sort((left, right) => left.createdAt - right.createdAt)
      .map((session) => session.info)
  }


  lookup(id) {
    if (typeof id !== 'string') return undefined
    return this.#sessions.get(id)
  }


  resolveForAgent(agent, terminalId) {
    if (typeof terminalId === 'string' && terminalId.length > 0) return this.lookup(terminalId)
    if (agent === undefined || agent === null) return undefined
    const mapped = this.#agentTerminals.get(agent.id)
    return mapped === undefined ? undefined : this.lookup(mapped)
  }


  resolveRecentForAgent(agent, options = {}) {
    const agentId = agent?.id
    if (typeof agentId !== 'string' || agentId.length === 0) return undefined
    const owned = [...this.#sessions.values()]
      .map((session, index) => ({ session, index }))
      .filter(
        (entry) =>
          !this.#hidden.has(entry.session.id) &&
          entry.session.owner === 'agent' &&
          entry.session.agentId === agentId,
      )
    if (owned.length === 0) return undefined
    const prefer = options.prefer === 'command' || options.prefer === 'any' ? options.prefer : 'active'


    const newest = (left, right) => right.session.createdAt - left.session.createdAt || right.index - left.index
    const pick = (entries) => (entries.length > 0 ? entries.sort(newest)[0].session : undefined)
    if (prefer === 'any') return pick(owned)
    if (prefer === 'command') {
      const commands = owned.filter((entry) => entry.session.kind === 'command')
      return pick(commands) ?? pick(owned)
    }
    const running = owned.filter((entry) => entry.session.state === 'running')
    const active = pick(running)
    if (active !== undefined) return active
    const commands = owned.filter((entry) => entry.session.kind === 'command')
    return pick(commands) ?? pick(owned)
  }


  resolveVisible(agent, terminalId, options = {}) {
    if (typeof terminalId !== 'string' || terminalId.length === 0) throw new Error('terminalId must be a non-empty string')
    const session = this.lookup(terminalId)
    if (session === undefined) throw new Error(`terminal ${terminalId} not found`)
    const writable = options.writable === true
    if (session.owner === 'user') {
      if (writable) throw new Error(`terminal ${terminalId} is user-owned and read-only to agents; it cannot be written to or closed`)
      return session
    }
    if (session.agentId !== agent?.id) {
      throw new Error(`terminal ${terminalId} belongs to another agent and is not ${writable ? 'writable' : 'visible'} from this agent`)
    }
    return session
  }


  setDefaultTerminal(agentId, sessionId) {
    if (typeof agentId !== 'string' || agentId.length === 0) throw new Error('agentId must be a non-empty string')
    if (typeof sessionId !== 'string' || sessionId.length === 0) throw new Error('sessionId must be a non-empty string')
    const session = this.lookup(sessionId)
    if (session === undefined) return undefined
    this.#agentTerminals.set(agentId, sessionId)
    return session.info
  }


  perSessionCount(sessionId) {
    if (typeof sessionId !== 'string' || sessionId.length === 0) return 0
    let count = 0
    for (const session of this.#sessions.values()) {
      if (session.sessionId === sessionId) count += 1
    }
    return count
  }


  sandboxFor(agent) {
    return this.#sandboxFor(agent)
  }


  waitForExit(id, options = {}) {
    const session = this.#requireSession(id)
    const timeoutMs = positiveInteger(options.timeoutMs, DEFAULT_WAIT_TIMEOUT_MS)
    const pattern = typeof options.pattern === 'string' && options.pattern.length > 0 ? options.pattern : undefined
    const mode = options.mode === 'exit' || options.mode === 'pattern' ? options.mode : pattern === undefined ? 'exit' : 'either'
    const since = options.since === 'now' ? 'now' : 'unread'
    if (mode === 'exit' && session.state !== 'running') return Promise.resolve(this.#waitOutcome(session, false, false, 'already-exited'))
    let matcher
    if (pattern !== undefined) {
      try {
        matcher = new RegExp(pattern)
      } catch (error) {
        return Promise.reject(new Error(`invalid regular expression: ${error instanceof Error ? error.message : String(error)}`))
      }
    }
    return new Promise((resolve) => {
      let settled = false
      let timer
      let unsubscribe = () => {}

      let haystack = ''
      const onAbort = () => finish(false, false, 'aborted')
      const finish = (timedOut, matched, reason) => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        options.signal?.removeEventListener?.('abort', onAbort)
        try {
          unsubscribe()
        } catch {

        }
        resolve(this.#waitOutcome(session, timedOut, matched, reason))
      }
      const check = (text) => {
        if (matcher === undefined) return false
        return matcher.test(text)
      }


      if (mode !== 'exit' && since !== 'now' && matcher !== undefined) {
        try {
          haystack = session.plainText()
        } catch {
          haystack = ''
        }
        if (check(haystack)) {
          finish(false, true, 'pattern')
          return
        }
        haystack = haystack.slice(-65_536)
      }
      if (mode === 'pattern' && matcher === undefined) {
        finish(false, false, 'no-pattern')
        return
      }
      if (session.state !== 'running' && mode !== 'exit') {
        finish(false, false, 'already-exited')
        return
      }
      if (options.signal?.aborted === true) {
        finish(false, false, 'aborted')
        return
      }
      unsubscribe = session.subscribe((name, data) => {
        if (name === 'exit') {
          finish(false, false, 'exit')
          return
        }
        if (mode !== 'exit' && name === 'output' && matcher !== undefined && typeof data?.chunk === 'string') {
          haystack = `${haystack}${data.chunk}`.slice(-65_536)
          if (check(haystack)) finish(false, true, 'pattern')
        }
      })
      options.signal?.addEventListener?.('abort', onAbort, { once: true })



      timer = setTimeout(() => finish(true, false, 'timeout'), timeoutMs)
      session.whenExited.then(
        () => finish(false, false, 'exit'),
        () => finish(false, false, 'exit'),
      )
    })
  }


  historyList(limit, terminalId) {
    return this.#history.list({ limit, terminalId })
  }


  replay(id, fromSeq = 0) {
    const session = this.#requireSession(id)
    const from = Number.isSafeInteger(fromSeq) && fromSeq > 0 ? fromSeq : 0
    const frames = session.framesSince(from)
    const last = frames.length > 0 ? frames[frames.length - 1].seq + 1 : from
    return { frames, nextSeq: last }
  }


  exportSession(id, format = 'text') {
    const session = this.lookup(id)
    if (session !== undefined) return session.exportText(format)
    const entry = this.#history.get(id)
    if (entry === undefined) throw new Error(`terminal ${id} not found`)
    return { text: entry.text, bytes: Buffer.byteLength(entry.text, 'utf8'), truncated: entry.truncated }
  }


  attachClient(id, clientId) {
    return this.#requireSession(id).attachClient(clientId)
  }


  detachClient(id, clientId) {
    const session = this.lookup(id)
    if (session === undefined) return { writerClientId: null }
    return session.detachClient(clientId)
  }


  takeControl(id, clientId) {
    return this.#requireSession(id).takeControl(clientId)
  }


  isWritable(id, clientId) {
    const session = this.lookup(id)
    if (session === undefined) return false
    return session.isWritable(clientId)
  }


  requestCapture(id, options = {}) {
    return this.#requireSession(id).requestCapture(options)
  }


  resolveCapture(id, requestId, payload) {
    return this.#requireSession(id).resolveCapture(requestId, payload)
  }


  subscribeEvents(listener) {
    this.#eventSubscribers.add(listener)
    return () => {
      this.#eventSubscribers.delete(listener)
    }
  }


  async createCommandSession(options) {
    const command = typeof options.command === 'string' ? options.command : ''
    if (command.trim().length === 0) throw new Error('command must be a non-empty string')
    const dimensions = normalizeDimensions(options.cols, options.rows)
    const origin = options.origin === 'intercept' ? 'intercept' : 'tool'
    const keepOpen = options.keepOpen === true
    const owner = options.owner === 'agent' || options.owner === 'user' ? options.owner : options.agentId === undefined ? 'user' : 'agent'
    const requireSandbox = options.requireSandbox === undefined ? this.#requireSandbox() : options.requireSandbox === true
    const sandbox = this.#sandboxFor(options.agent, requireSandbox)
    if (owner === 'agent' && (requireSandbox || this.#allowUnconfined() === false) && sandbox.mode !== 'danger-full-access') {
      throw sandboxRequiredError(sandbox)
    }
    const shell = await this.#shell(options.signal, options.shellKindHint)
    const cwd = await this.#resolveCwd({ agent: options.agent, cwd: options.cwd, signal: options.signal })
    await this.#reserveSlot(options.sessionId)
    const hideForMs = origin === 'intercept' && !keepOpen ? this.#interceptMinVisibleMs() : 0
    const echoHeader = 'PS ' + cwd + '> ' + String(command).split(/\r?\n/u)[0]
    const transcriptKey = options.sessionId ?? options.agentId ?? '__page__'
    const seedText = this.#configFlag('singleCommandTab', true)
      ? (this.#transcripts.get(transcriptKey) ?? '')
      : ''
    const group = typeof options.group === 'string' && options.group.length > 0 ? options.group : undefined
    const echoed = withEchoHeader(shell, command, 'PS ' + cwd)
    const session = await this.#spawn({
      argv: commandArgv(shell, echoed),
      kind: 'command',
      owner,
      command,
      title: options.title ?? commandTitle(command),
      cols: dimensions.cols,
      rows: dimensions.rows,
      cwd,
      sessionId: options.sessionId,
      agentId: options.agentId,
      shellKind: shell.kind,
      sandbox,
      env: options.env,
      signal: options.signal,
      commandMeta: { origin, keepOpen },
      hideForMs,
      group,
      seedText,
      transcriptKey,
    })
    this.#echoHeaders.set(session.id, echoHeader)
    if (this.#echoHeaders.size > 200) {
      const oldest = this.#echoHeaders.keys().next().value
      if (oldest !== undefined) this.#echoHeaders.delete(oldest)
    }
    if (origin === 'intercept' && this.#configFlag('singleCommandTab', true)) {
      this.#retirePreviousCommandSession(session)
    }
    return session
  }


  async createInteractive(options = {}) {
    const dimensions = normalizeDimensions(options.cols, options.rows)
    const owner = options.owner === 'agent' || options.owner === 'user' ? options.owner : 'user'
    const requireSandbox = options.requireSandbox === undefined ? this.#requireSandbox() : options.requireSandbox === true
    const sandbox = this.#sandboxFor(options.agent, requireSandbox)
    if (
      owner === 'agent' &&
      (requireSandbox || this.#allowUnconfined() === false) &&
      sandbox.mode !== 'danger-full-access'
    ) {
      throw sandboxRequiredError(sandbox)
    }
    const ssh = options.ssh
    if (ssh !== undefined && typeof ssh.host === 'string' && ssh.host.length > 0) {
      const sshPath = await this.#subprocess.resolveExecutable('ssh', undefined, options.signal)
      const sshTarget = { path: sshPath, host: ssh.host, user: ssh.user, port: ssh.port, identityFile: ssh.identityFile }
      await this.#reserveSlot(options.sessionId)
      return this.#spawn({
        argv: sshArgv(sshTarget),
        kind: 'interactive',
        owner,
        title: options.title ?? sshTitle(sshTarget),
        cols: dimensions.cols,
        rows: dimensions.rows,
        cwd: options.cwd ?? homedir(),
        sessionId: options.sessionId,
        agentId: options.agentId,
        shellKind: 'ssh',
        sandbox,
        env: options.env,
        signal: options.signal,
        startingDefault: options.startingDefault === true,
      })
    }
    const shell = await this.#shell(options.signal, options.shellKindHint)
    const cwd = await this.#resolveCwd({ agent: options.agent, cwd: options.cwd, signal: options.signal })
    await this.#reserveSlot(options.sessionId)
    return this.#spawn({
      argv: interactiveArgv(shell),
      kind: 'interactive',
      owner,
      title: options.title ?? defaultShellTitle(shell.kind),
      cols: dimensions.cols,
      rows: dimensions.rows,
      cwd,
      sessionId: options.sessionId,
      agentId: options.agentId,
      shellKind: shell.kind,
      sandbox,
      env: options.env,
      signal: options.signal,
      startingDefault: options.startingDefault === true,
    })
  }


  async ensureAgentTerminal(agent, options = {}) {
    const agentId = agent?.id
    if (typeof agentId !== 'string' || agentId.length === 0) {
      throw new Error('terminal tools require an initiating agent')
    }
    const existingId = this.#agentTerminals.get(agentId)
    if (existingId !== undefined) {
      const existing = this.lookup(existingId)
      if (existing !== undefined && existing.running) return existing
      if (existing !== undefined) await this.close(existingId)
      this.#agentTerminals.delete(agentId)
    }
    const pending = this.#creating.get(agentId)
    if (pending !== undefined) return pending
    const creation = (async () => {
      const session = await this.createInteractive({
        agent,
        agentId,
        sessionId: agent.session?.id,
        owner: 'agent',
        title: options.title,
        cwd: options.cwd,
        cols: options.cols,
        rows: options.rows,
        shellKindHint: options.shellKindHint,
        env: options.env,
        signal: options.signal,
        startingDefault: true,
      })
      try {
        try {
          await session.waitReady({ signal: options.signal })
        } catch {

        }
        if (session.state !== 'running') {
          await this.close(session.id)
          throw new Error('terminal shell exited during startup')
        }
        this.#agentTerminals.set(agentId, session.id)
        return session
      } finally {
        this.#startingDefaults.delete(session.id)
      }
    })()
    this.#creating.set(agentId, creation)
    try {
      return await creation
    } finally {
      if (this.#creating.get(agentId) === creation) this.#creating.delete(agentId)
    }
  }


  #renderTranscriptBlock(session) {
    const command = String(session.command ?? session.title ?? '').split(/\r?\n/u)[0]
    let text = ''
    try {
      text = session.plainText()
    } catch {
      text = ''
    }
    const lines = ['\u001b[2mPS ' + session.cwd + '> ' + command + '\u001b[0m']
    for (const line of text.split('\n')) lines.push(line)
    lines.push('')
    return lines.join('\r\n') + '\r\n'
  }

  #appendTranscript(key, block) {
    const previous = this.#transcripts.get(key) ?? ''
    let next = previous + block
    if (next.length > COMMAND_TRANSCRIPT_LIMIT) next = next.slice(next.length - COMMAND_TRANSCRIPT_LIMIT)
    this.#transcripts.set(key, next)
  }

  #retirePreviousCommandSession(session) {
    const key = session.sessionId ?? session.agentId ?? '__page__'
    this.#lastCommandSession.set(key, { id: session.id, group: session.group })
    for (const other of this.#sessions.values()) {
      if (other.id === session.id || other.kind !== 'command') continue
      if ((other.sessionId ?? other.agentId ?? '__page__') !== key) continue
      if (other.pinned === true || other.running) continue
      this.close(other.id).catch(() => {})
    }
  }

  async waitForCommandSession(session, options = {}) {
    const timeoutMs = positiveInteger(options.timeoutMs, this.#configInteger('commandTimeoutMs', 180_000, 1, 3_600_000))
    const outcome = await waitForExit(session, timeoutMs, options.signal)
    if (outcome.kind !== 'exit') {
      try {
        await session.terminate()
      } catch {

      }
      await settleWithGrace(session, 1500)
    }
    const tail = session.plainTail(this.#maxOutputBytes())
    const header = this.#echoHeaders.get(session.id)
    let output = tail.text
    if (header !== undefined && output.startsWith(header)) {
      output = output.slice(header.length).replace(/^\r?\n/u, '')
    }
    return {
      output,
      truncated: tail.truncated,
      exitCode: outcome.kind === 'exit' ? session.exitCode : null,
      signal: outcome.kind === 'exit' ? session.signal : 'SIGTERM',
      timedOut: outcome.kind === 'timeout',
      aborted: outcome.kind === 'aborted',
      durationMs: session.durationMs,
      ports: [...session.ports.values()].map((port) => ({ ...port })),
      sandbox: { ...session.sandbox },
    }
  }


  resolveCwd(agent, cwd, signal) {
    return this.#resolveCwd({ agent, cwd, signal })
  }


  async resolveSessionCwd(sessionId) {
    if (typeof sessionId !== 'string' || sessionId.length === 0) return undefined
    const store = this.#getSessionStore?.() ?? this.#sessionStore
    if (store !== undefined && store !== null) {
      const session = findLiveSession(store, sessionId)
      if (session !== undefined && session !== null) {
        const directory = this.#directoryOf(session)
        if (directory !== undefined) return directory
      }
    }
    return this.#querySessionCwd(sessionId)
  }


  async #querySessionCwd(sessionId) {
    const query = this.#getSessionQuery?.() ?? this.#sessionQuery
    if (query === undefined || query === null) return undefined
    const candidates = sessionIdCandidates(sessionId)
    if (typeof query.filterSessions === 'function') {
      try {
        const records = await query.filterSessions([{ kind: 'id', values: candidates }])
        const directory = headerCwdOf(records)
        if (directory !== undefined) return directory
      } catch {

      }
    }
    if (typeof query.listSessions === 'function') {
      try {
        const records = await query.listSessions()
        if (Array.isArray(records)) {
          const found = records.find((record) => candidates.includes(record?.header?.id))
          const directory = headerCwdOf(found === undefined ? undefined : [found])
          if (directory !== undefined) return directory
        }
      } catch {

      }
    }
    return undefined
  }


  #directoryOf(session) {
    const getDirectory = this.#workingDirectory?.get
    if (typeof getDirectory === 'function') {
      try {
        const directory = getDirectory.call(this.#workingDirectory, session)
        if (isAbsolute(directory) && directory.length > 0) return directory
      } catch {

      }
    }
    const headerCwd = session.header?.cwd
    return typeof headerCwd === 'string' && isAbsolute(headerCwd) ? headerCwd : undefined
  }


  keep(id) {
    const session = this.#requireSession(id)
    const meta = this.#commandMeta.get(id)
    if (meta !== undefined) meta.keepOpen = true
    session.setKeepOpen(true)
    session.setPinned(true)
    this.#clearAutoCloseTimer(id)
    session.setAutoClosePaused(false)
    session.setAutoCloseAt(null)
    this.#emitSessions()
    return session.info
  }


  pauseAutoClose(id) {
    const session = this.#requireSession(id)
    this.#clearAutoCloseTimer(id)
    session.pauseAutoClose('manual')
    this.#emitSessions()
    return session.info
  }


  resumeAutoClose(id) {
    const session = this.#requireSession(id)
    this.#clearAutoCloseTimer(id)
    session.resumeAutoClose()
    const meta = this.#commandMeta.get(id) ?? { origin: 'tool', keepOpen: false }
    if (session.state === 'running') {
      session.setAutoCloseAt(null)
    } else if (!session.pinned && meta.keepOpen !== true) {
      const delayMs = this.#autoCloseDelayMs(meta, isFailedCommand(session))
      if (delayMs !== undefined) this.#scheduleAutoClose(id, delayMs)
    }
    this.#emitSessions()
    return session.info
  }


  setTitle(id, title) {
    return this.#requireSession(id).setTitle(title)
  }


  signal(id, name) {
    return this.#requireSession(id).sendSignal(name)
  }


  async close(id, options = {}) {



    this.#clearVisibilityTimer(id)
    this.#clearVisibilityFallback(id)
    this.#clearAutoCloseTimer(id)
    this.#hidden.delete(id)
    this.#startingDefaults.delete(id)
    const session = this.#sessions.get(id)
    if (session === undefined) {
      this.#commandMeta.delete(id)
      return false
    }
    if (session.kind === 'command') {


      const closeReason = isFailedCommand(session)
        ? 'failed'
        : options.reason === 'auto-close'
          ? 'auto-close'
          : 'closed'
      this.#recordHistory(session, closeReason)
    }
    this.#commandMeta.delete(id)
    this.#sessions.delete(id)
    if (session.agentId !== undefined && this.#agentTerminals.get(session.agentId) === id) {
      this.#agentTerminals.delete(session.agentId)
    }
    try {
      await session.dispose()
    } catch (error) {



      this.#logger?.warn?.(
        `[dsh-web-terminal] terminal ${id} was removed but process termination failed: ${error instanceof Error ? error.message : String(error)}`,
      )
    } finally {
      this.#emitSessions()
    }
    return true
  }


  async dispose() {
    if (this.#disposed) return
    this.#disposed = true
    for (const timer of this.#visibilityTimers.values()) clearTimeout(timer)
    this.#visibilityTimers.clear()
    for (const timer of this.#visibilityFallbackTimers.values()) clearTimeout(timer)
    this.#visibilityFallbackTimers.clear()
    for (const timer of this.#autoCloseTimers.values()) clearTimeout(timer)
    this.#autoCloseTimers.clear()
    this.#watchdog?.dispose()
    const sessions = [...this.#sessions.values()]
    for (const session of sessions) {
      if (session.kind === 'command') this.#recordHistory(session, 'closed')
    }
    this.#sessions.clear()
    this.#hidden.clear()
    this.#commandMeta.clear()
    this.#lastSessionsSignature = '[]'
    this.#agentTerminals.clear()
    this.#startingDefaults.clear()
    this.#creating.clear()
    this.#shellPromises.clear()
    this.#eventSubscribers.clear()
    this.#pending = 0
    this.#pendingBySession.clear()
    await Promise.allSettled(sessions.map((session) => session.dispose()))
    this.#history.dispose()
  }


  #requireSession(id) {
    if (typeof id !== 'string' || id.length === 0) throw new Error('terminalId must be a non-empty string')
    const session = this.lookup(id)
    if (session === undefined) throw new Error(`terminal ${id} not found`)
    return session
  }


  async #spawn(options) {
    try {
      if (this.#disposed) throw new Error('terminal registry disposed')
      let handle
      try {
        const env = this.#sanitizeEnv(options.env)
        if (options.sessionId !== undefined) env.DSH_SESSION_ID = options.sessionId
        const hasEnv = Object.keys(env).length > 0
        handle = await this.#subprocess.spawnTerminal({
          argv: options.argv,
          cwd: options.cwd,
          cols: options.cols,
          rows: options.rows,
          terminalType: TERMINAL_TYPE,
          ...(hasEnv ? { env } : {}),
          shellActivity: false,
          graceMs: GRACE_MS,
          signal: options.signal,
        })
      } catch (error) {
        this.#logger?.warn?.(`[dsh-web-terminal] failed to spawn terminal: ${error instanceof Error ? error.message : String(error)}`)
        throw error
      }
      const id = randomUUID()
      try {
        const session = new TerminalPanelSession({
          id,
          title: options.title,
          kind: options.kind,
          owner: options.owner,
          sessionId: options.sessionId,
          agentId: options.agentId,
          command: options.command,
          group: options.group,
          handle,
          cwd: options.cwd,
          cols: options.cols,
          rows: options.rows,
          scrollback: this.#scrollback(),
          maxOutputBytes: this.#maxOutputBytes(),
          shellKind: options.shellKind,
          sandbox: options.sandbox,
          keepOpen: options.commandMeta?.keepOpen === true,
          portDetection: this.#portDetection(),
          onFirstOutput: (firstSession) => this.#onFirstOutput(firstSession),
          onPort: (ports) => this.#onPorts(id, ports),
          onChange: () => {
            const current = this.#sessions.get(id)
            if (current !== undefined) this.#watchdog?.touch(current)
            this.#emitSessions()
          },
          onExit: () => this.#handleExit(id),
        })
        this.#sessions.set(id, session)
        if (options.startingDefault === true) this.#startingDefaults.add(id)
        if (options.commandMeta !== undefined) this.#commandMeta.set(id, options.commandMeta)
        if (typeof options.seedText === 'string' && options.seedText.length > 0) {
          await session.seed(options.seedText)
        }
        if (typeof options.transcriptKey === 'string') {
          this.#seedBySession.set(id, options.seedText ?? '')
          this.#transcriptKeyBySession.set(id, options.transcriptKey)
        }
        this.#ledger?.start(session)
        this.#watchdog?.watch(session)



        if (typeof options.hideForMs === 'number' && options.hideForMs > 0) {
          this.#hidden.add(id)
          this.#scheduleVisibilityFallback(id)
        }
        this.#emitSessions()
        if (session.firstOutputAt !== null) this.#onFirstOutput(session)
        return session
      } catch (error) {
        try {
          await handle.terminate()
        } catch {

        }
        throw error
      }
    } finally {


      this.#releaseSlot(options.sessionId)
    }
  }


  #handleExit(id) {
    const session = this.#sessions.get(id)
    if (session === undefined) return
    this.#watchdog?.stop(id)
    this.#ledger?.finish(session)
    const transcriptKey = this.#transcriptKeyBySession.get(id)
    if (transcriptKey !== undefined) {
      const own = this.#renderTranscriptBlock(session)
      this.#transcripts.set(
        transcriptKey,
        (this.#seedBySession.get(id) ?? '') + own,
      )
      const stored = this.#transcripts.get(transcriptKey) ?? ''
      if (stored.length > COMMAND_TRANSCRIPT_LIMIT) {
        this.#transcripts.set(transcriptKey, stored.slice(stored.length - COMMAND_TRANSCRIPT_LIMIT))
      }
      this.#seedBySession.delete(id)
      this.#transcriptKeyBySession.delete(id)
    }
    if (session.agentId !== undefined && this.#agentTerminals.get(session.agentId) === id) {
      this.#agentTerminals.delete(session.agentId)
    }
    if (session.kind !== 'command') return
    const meta = this.#commandMeta.get(id) ?? { origin: 'tool', keepOpen: false }
    const failed = isFailedCommand(session)


    this.#recordHistory(session, failed ? 'failed' : 'closed')
    if (this.#hidden.has(id)) {




      this.#hidden.delete(id)
      this.#clearVisibilityTimer(id)
      this.#clearVisibilityFallback(id)
      this.#commandMeta.delete(id)
      const mode = this.#noticeMode()
      if (mode === 'all' || (failed && mode === 'failed')) {
        this.#emitAutoCloseNotice(session, failed ? 'failed' : 'succeeded')
      }
      void this.close(id, { reason: 'auto-close' }).catch(() => {})
      return
    }
    const delayMs = session.pinned || session.autoClosePaused ? undefined : this.#autoCloseDelayMs(meta, failed)
    if (delayMs !== undefined) {
      this.#scheduleAutoClose(id, delayMs)
    } else {


      this.#emitCommandFinished(session, meta.keepOpen === true || session.pinned)
    }
    void this.#pruneRetainedCommands()
  }


  #onPorts(id, ports) {
    const session = this.#sessions.get(id)
    if (session === undefined) return
    for (const port of ports) {
      this.#emitEvent('notice', {
        type: 'port',
        terminalId: id,
        url: port.url,
        port: port.port,
        host: port.host,
      })
    }
    this.#emitSessions()
  }


  #onFirstOutput(session) {
    if (this.#disposed) return
    const id = session.id
    if (!this.#hidden.has(id)) return
    if (this.#visibilityTimers.has(id)) return
    this.#clearVisibilityFallback(id)
    this.#scheduleReveal(id, this.#interceptMinVisibleMs())
  }


  #scheduleReveal(id, delayMs) {
    this.#clearVisibilityTimer(id)
    const timer = setTimeout(() => {
      this.#visibilityTimers.delete(id)
      if (!this.#hidden.delete(id)) return
      this.#emitSessions()
    }, Math.max(0, delayMs))
    timer.unref?.()
    this.#visibilityTimers.set(id, timer)
  }


  #scheduleVisibilityFallback(id) {
    this.#clearVisibilityFallback(id)
    const timer = setTimeout(() => {
      this.#visibilityFallbackTimers.delete(id)
      if (!this.#hidden.has(id)) return
      if (this.#visibilityTimers.has(id)) return
      const remaining = Math.max(0, this.#interceptMinVisibleMs() - VISIBILITY_FALLBACK_MS)
      this.#scheduleReveal(id, remaining)
    }, VISIBILITY_FALLBACK_MS)
    timer.unref?.()
    this.#visibilityFallbackTimers.set(id, timer)
  }


  #clearVisibilityTimer(id) {
    const timer = this.#visibilityTimers.get(id)
    if (timer === undefined) return
    this.#visibilityTimers.delete(id)
    clearTimeout(timer)
  }


  #clearVisibilityFallback(id) {
    const timer = this.#visibilityFallbackTimers.get(id)
    if (timer === undefined) return
    this.#visibilityFallbackTimers.delete(id)
    clearTimeout(timer)
  }


  #scheduleAutoClose(id, delayMs) {
    this.#clearAutoCloseTimer(id)
    const session = this.#sessions.get(id)
    if (session === undefined || session.pinned) return
    session.setAutoClosePaused(false)
    session.setAutoCloseAt(Date.now() + Math.max(0, delayMs))
    const timer = setTimeout(() => {
      this.#autoCloseTimers.delete(id)
      this.#autoCloseCommand(id)
    }, Math.max(0, delayMs))
    timer.unref?.()
    this.#autoCloseTimers.set(id, timer)
    this.#emitSessions()
  }


  #clearAutoCloseTimer(id) {
    const timer = this.#autoCloseTimers.get(id)
    if (timer === undefined) return
    this.#autoCloseTimers.delete(id)
    clearTimeout(timer)
  }


  #autoCloseCommand(id) {
    const session = this.#sessions.get(id)
    if (session === undefined) return
    if (session.pinned || session.autoClosePaused) return
    this.#commandMeta.delete(id)
    const failed = isFailedCommand(session)
    const mode = this.#noticeMode()
    if (mode === 'all' || (failed && mode === 'failed')) {
      this.#emitAutoCloseNotice(session, failed ? 'failed' : 'succeeded')
    }
    void this.close(id, { reason: 'auto-close' }).catch(() => {})
  }


  #emitAutoCloseNotice(session, reason) {
    this.#emitEvent('notice', {
      type: 'auto-close',
      reason,
      terminalId: session.id,
      historyId: session.id,
      title: session.title,
      exitCode: session.exitCode,
      signal: session.signal,
      excerpt: commandExcerpt(session, this.#maxOutputBytes()),
      durationMs: session.durationMs ?? 0,
    })
  }


  #emitCommandFinished(session, keepOpen) {
    this.#emitEvent('notice', {
      type: 'command-finished',
      terminalId: session.id,
      title: session.title,
      exitCode: session.exitCode,
      signal: session.signal,
      durationMs: session.durationMs ?? 0,
      keepOpen: keepOpen === true,
    })
  }


  #recordHistory(session, reason) {
    const tail = session.plainTail(Math.min(HISTORY_TEXT_BYTES, this.#maxOutputBytes()))
    return this.#history.add({
      id: session.id,
      title: session.title,
      command: session.command ?? '',
      cwd: session.cwd,
      kind: 'command',
      exitCode: session.exitCode,
      signal: session.signal,
      startedAt: session.startedAt,
      endedAt: session.endedAt ?? Date.now(),
      durationMs: session.durationMs ?? Math.max(0, (session.endedAt ?? Date.now()) - session.startedAt),
      cols: session.cols,
      rows: session.rows,
      reason,
      text: tail.text,
      truncated: tail.truncated,
      ports: [...session.ports.values()].map((port) => ({ ...port })),
      sandbox: { ...session.sandbox },
      ...(session.agentId === undefined ? {} : { agentId: session.agentId }),
      ...(session.sessionId === undefined ? {} : { sessionId: session.sessionId }),
      owner: session.owner,
    })
  }

  async #pruneRetainedCommands() {
    const exited = [...this.#sessions.values()]
      .filter((session) => session.kind === 'command' && session.state !== 'running' && !session.pinned)
      .sort((left, right) => left.updatedAt - right.updatedAt)
    while (exited.length > this.#retainExited()) {
      const oldest = exited.shift()
      if (oldest === undefined) break
      await this.close(oldest.id, { reason: 'closed' }).catch(() => {})
    }
  }


  #usedSlots() {
    return this.#sessions.size + this.#pending
  }


  #perSessionUsed(sessionId) {
    if (typeof sessionId !== 'string' || sessionId.length === 0) return 0
    return this.perSessionCount(sessionId) + (this.#pendingBySession.get(sessionId) ?? 0)
  }


  async #reserveSlot(sessionId) {
    await this.#ensureCapacity(sessionId)
    const limit = this.#maxSessions()
    if (this.#usedSlots() >= limit) {
      throw new Error(`terminal session limit reached (maxSessions=${limit})`)
    }
    const perLimit = this.#perSessionMaxSessions()
    if (typeof sessionId === 'string' && sessionId.length > 0 && this.#perSessionUsed(sessionId) >= perLimit) {
      throw new Error(`terminal session limit reached (perSessionMaxSessions=${perLimit})`)
    }
    this.#pending += 1
    if (typeof sessionId === 'string' && sessionId.length > 0) {
      this.#pendingBySession.set(sessionId, (this.#pendingBySession.get(sessionId) ?? 0) + 1)
    }
  }


  #releaseSlot(sessionId) {
    if (this.#pending > 0) this.#pending -= 1
    if (typeof sessionId === 'string' && sessionId.length > 0) {
      const next = (this.#pendingBySession.get(sessionId) ?? 0) - 1
      if (next > 0) this.#pendingBySession.set(sessionId, next)
      else this.#pendingBySession.delete(sessionId)
    }
  }


  #isReclaimableInteractive(session) {
    if (session.kind !== 'interactive' || session.owner !== 'agent') return false
    if (session.pinned) return false
    if (this.#startingDefaults.has(session.id)) return false
    if (session.agentId !== undefined && this.#agentTerminals.get(session.agentId) === session.id) return false
    return true
  }


  async #reclaimExitedCommands(sessionId, stillOver) {
    const candidates = [...this.#sessions.values()]
      .filter(
        (session) =>
          session.kind === 'command' &&
          session.state !== 'running' &&
          !session.pinned &&
          (sessionId === undefined || session.sessionId === sessionId),
      )
      .sort((left, right) => left.updatedAt - right.updatedAt)
    for (const session of candidates) {
      if (!stillOver()) return
      await this.close(session.id, { reason: 'closed' }).catch(() => {})
    }
  }


  async #reclaimAgentInteractives(sessionId, stillOver) {
    const candidates = [...this.#sessions.values()]
      .filter(
        (session) =>
          this.#isReclaimableInteractive(session) && (sessionId === undefined || session.sessionId === sessionId),
      )
      .sort((left, right) => left.updatedAt - right.updatedAt)
    for (const session of candidates) {
      if (!stillOver()) return
      await this.close(session.id, { reason: 'closed' }).catch(() => {})
    }
  }


  async #ensureCapacity(sessionId) {
    const limit = this.#maxSessions()
    const perLimit = this.#perSessionMaxSessions()
    const overGlobal = () => this.#usedSlots() >= limit
    const overSession = () =>
      typeof sessionId === 'string' && sessionId.length > 0 && this.#perSessionUsed(sessionId) >= perLimit
    if (overSession()) await this.#reclaimExitedCommands(sessionId, overSession)
    if (overGlobal()) await this.#reclaimExitedCommands(undefined, overGlobal)
    if (overGlobal()) await this.#reclaimAgentInteractives(undefined, overGlobal)
    if (overSession()) await this.#reclaimAgentInteractives(sessionId, overSession)
    if (overGlobal()) {
      throw new Error(`terminal session limit reached (maxSessions=${limit}); close a terminal or raise the limit`)
    }
    if (overSession()) {
      throw new Error(
        `terminal session limit reached (perSessionMaxSessions=${perLimit}); close another terminal of this DSH session`,
      )
    }
  }

  async #resolveCwd({ agent, cwd, signal }) {
    let base
    if (agent !== undefined && agent !== null && this.#workingDirectory?.ensure !== undefined) {
      base = await this.#workingDirectory.ensure(agent, signal)
    } else if (typeof this.#workingDirectory?.defaultDirectory === 'string') {
      base = this.#workingDirectory.defaultDirectory
    } else {
      base = process.cwd()
    }
    if (typeof cwd === 'string' && cwd.length > 0) {
      return isAbsolute(cwd) ? cwd : resolvePath(base, cwd)
    }
    return base
  }


  async #shell(signal, kindHint) {
    const hint = typeof kindHint === 'string' && kindHint.trim().length > 0 ? kindHint.trim() : ''
    const cached = this.#shellPromises.get(hint)
    if (cached !== undefined) return cached
    const promise = resolveShell({
      subprocess: this.#subprocess,
      shellPath: this.#configString('shellPath'),
      signal,
      kindHint: hint.length === 0 ? undefined : hint,
    }).then(
      (shell) => shell,
      (error) => {
        if (this.#shellPromises.get(hint) === promise) this.#shellPromises.delete(hint)
        throw error
      },
    )
    this.#shellPromises.set(hint, promise)
    return promise
  }


  #sandboxFor(agent, requiredOverride) {
    const required = requiredOverride === undefined ? this.#requireSandbox() : requiredOverride === true
    const fallback = { mode: 'danger-full-access', confined: false, required }
    if (this.#resolveSandboxPolicy === undefined) {



      return required ? { mode: 'unknown', confined: false, required } : fallback
    }
    try {
      const policy = this.#resolveSandboxPolicy(agent)
      if (policy === null || policy === undefined || typeof policy !== 'object') return fallback
      if (typeof policy.then === 'function') {
        this.#logger?.warn?.('[dsh-web-terminal] resolveSandboxPolicy must be synchronous; assuming danger-full-access')
        return required ? { mode: 'unknown', confined: false, required } : fallback
      }



      if (policy.available === false && (required || this.#allowUnconfined() === false)) {
        return { mode: 'unknown', confined: false, required }
      }
      const mode = typeof policy.mode === 'string' && policy.mode.length > 0 ? policy.mode : fallback.mode
      return {
        mode,
        confined: policy.confined === true,
        required: policy.required === undefined ? required : policy.required === true,
      }
    } catch (error) {
      this.#logger?.warn?.(
        `[dsh-web-terminal] failed to resolve the sandbox policy: ${error instanceof Error ? error.message : String(error)}`,
      )
      return required ? { mode: 'unknown', confined: false, required } : fallback
    }
  }


  #sanitizeEnv(env) {
    if (env === null || typeof env !== 'object' || Array.isArray(env)) return {}

    const out = {}
    let total = 0
    let count = 0
    for (const [key, value] of Object.entries(env)) {
      if (count >= 64) break
      if (typeof key !== 'string' || !/^[A-Za-z_][A-Za-z0-9_]{0,127}$/u.test(key)) continue
      if (typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'boolean') continue
      const text = String(value)
      if (text.length > 4096) continue
      total += key.length + text.length
      if (total > 32 * 1024) break
      out[key] = text
      count += 1
    }
    return out
  }

  #emitSessions() {
    const sessions = this.list()





    const signature = JSON.stringify(sessions)
    const changed = signature !== this.#lastSessionsSignature
    this.#lastSessionsSignature = signature
    if (!changed || this.#eventSubscribers.size === 0) return
    this.#emitEvent('sessions', { sessions })
  }


  #emitEvent(name, data) {
    for (const listener of this.#eventSubscribers) {
      try {
        listener(name, data)
      } catch {

      }
    }
  }


  #autoCloseDelayMs(meta, failed) {
    if (meta.keepOpen === true) return undefined
    if (meta.origin === 'tool' && this.#autoCloseToolTerminals() === false) return undefined
    const fallback = failed ? 30_000 : 8000
    const configured = this.#configInteger(
      failed ? 'autoCloseFailedDelayMs' : 'autoCloseCommandDelayMs',
      fallback,
      -1,
      600_000,
    )
    return configured >= 0 ? configured : undefined
  }


  #interceptMinVisibleMs() {
    return this.#configInteger('interceptMinVisibleMs', 1500, 0, 60_000)
  }


  #autoCloseToolTerminals() {
    return this.#configFlag('autoCloseToolTerminals', true)
  }


  #noticeMode() {
    const value = this.#configString('autoCloseNotice')
    return value === 'failed' || value === 'none' ? value : 'all'
  }


  #requireSandbox() {
    return this.#configFlag('requireSandbox', false)
  }


  #allowUnconfined() {
    return this.#configFlag('allowUnconfined', true)
  }


  #portDetection() {
    return this.#configFlag('portDetection', true)
  }


  #maxSessions() {
    return this.#configInteger('maxSessions', 16, 1, 128)
  }


  #perSessionMaxSessions() {
    return this.#configInteger('perSessionMaxSessions', 8, 1, 128)
  }


  #retainExited() {
    return this.#configInteger('retainExited', 10, 0, 128)
  }


  #maxOutputBytes() {
    return this.#configInteger('maxOutputBytes', 262_144, 1024, 16 * 1024 * 1024)
  }


  #scrollback() {
    return this.#configInteger('scrollback', 2000, 0, 100_000)
  }


  #peek(key) {
    const source = this.#getConfig === undefined ? this.#config : this.#getConfig()
    return source === null || typeof source !== 'object' ? undefined : source[key]
  }

  #configString(key) {
    const value = this.#peek(key)
    return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined
  }


  #configFlag(key, fallback) {
    const value = this.#peek(key)
    return value === undefined ? fallback : value === true
  }


  #configInteger(key, fallback, min, max) {
    const value = this.#peek(key)
    if (typeof value !== 'number' || !Number.isFinite(value)) return fallback
    return Math.min(max, Math.max(min, Math.floor(value)))
  }


  #waitOutcome(session, timedOut, matched, reason) {
    const tail = session.plainTail(WAIT_TEXT_BYTES)
    const durationMs =
      session.durationMs === null && (timedOut || matched)
        ? Math.max(0, Date.now() - session.startedAt)
        : session.durationMs
    return {
      terminalId: session.id,
      state: session.state,
      exitCode: session.exitCode,
      signal: session.signal,
      durationMs,
      timedOut,
      matched,
      text: tail.text,
      truncated: tail.truncated,
      reason,
    }
  }
}

function sandboxRequiredError(sandbox) {
  const error = new Error(
    `SANDBOX_REQUIRED: this terminal would run unsandboxed, but requireSandbox is enabled and the session sandbox mode is ${JSON.stringify(sandbox.mode)}`,
  )
  return Object.assign(error, { code: 'SANDBOX_REQUIRED', sandbox: { ...sandbox } })
}

function sessionIdCandidates(sessionId) {
  return [sessionId, sessionId.startsWith('session-') ? sessionId.slice('session-'.length) : `session-${sessionId}`]
}

function findLiveSession(store, sessionId) {
  const candidates = sessionIdCandidates(sessionId)
  for (const candidate of candidates) {
    if (typeof store.get === 'function') {
      try {
        const session = store.get(candidate)
        if (session !== undefined && session !== null) return session
      } catch {

      }
    }
    if (typeof store.list === 'function') {
      try {
        const entries = store.list()
        if (Array.isArray(entries)) {
          const found = entries.find((entry) => entry?.id === candidate)
          if (found !== undefined) return found
        }
      } catch {

      }
    }
  }
  return undefined
}

function headerCwdOf(records) {
  if (!Array.isArray(records)) return undefined
  for (const record of records) {
    const cwd = record?.header?.cwd
    if (typeof cwd === 'string' && isAbsolute(cwd) && cwd.length > 0) return cwd
  }
  return undefined
}

async function waitForExit(session, timeoutMs, signal) {
  if (session.state !== 'running') return { kind: 'exit' }
  if (signal?.aborted === true) return { kind: 'aborted' }
  return new Promise((resolve) => {
    let settled = false
    const finish = (kind) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      signal?.removeEventListener('abort', onAbort)
      resolve({ kind })
    }
    const timer = setTimeout(() => finish('timeout'), timeoutMs)
    timer.unref?.()
    const onAbort = () => finish('aborted')
    signal?.addEventListener('abort', onAbort, { once: true })
    session.whenExited.then(
      () => finish('exit'),
      () => finish('exit'),
    )
  })
}

async function settleWithGrace(session, ms) {
  await Promise.race([session.whenExited, sleep(ms)])
}

function isFailedCommand(session) {
  if (session.state === 'failed') return true
  if (session.signal !== null && session.signal !== undefined) return true
  return typeof session.exitCode === 'number' && session.exitCode !== 0
}

function commandExcerpt(session, maxBytes) {
  let text = ''
  try {
    text = session.plainTail(Math.min(maxBytes, 64 * 1024)).text
  } catch {
    return ''
  }
  const lines = text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
  const last = lines.length > 0 ? lines[lines.length - 1] : ''
  return last.length > 160 ? `${last.slice(0, 159)}…` : last
}

function positiveInteger(value, fallback) {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) return Math.floor(value)
  return fallback
}

function defaultShellTitle(kind) {
  if (kind === 'pwsh' || kind === 'powershell') return 'PowerShell'
  if (kind === 'cmd') return 'cmd'
  if (kind === 'bash' || kind === 'zsh' || kind === 'sh') return kind
  return '终端'
}
