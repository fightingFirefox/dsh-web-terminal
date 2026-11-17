import { randomUUID } from 'node:crypto'

const JOB_PREFIX = 'dsht-'
const CREATE_TIMEOUT_MS = 20_000
const OUTPUT_BYTES = 65_536

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function withTimeout(promise, timeoutMs, label) {
  let timer
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(label + ' timed out after ' + timeoutMs + 'ms')), timeoutMs)
    timer.unref?.()
  })
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer))
}

function firstLine(command) {
  return String(command).split(/\r?\n/u)[0].slice(0, 200)
}

function clip(text) {
  const value = String(text ?? '')
  return value.length <= OUTPUT_BYTES ? value : value.slice(value.length - OUTPUT_BYTES)
}

export class BackgroundJobs {
  #plugin
  #jobs = new Map()

  constructor(plugin) {
    this.#plugin = plugin
  }

  get config() {
    const plugin = this.#plugin
    return typeof plugin?.getConfig === 'function' ? plugin.getConfig() : (plugin?.config ?? {})
  }

  isJob(jobId) {
    return typeof jobId === 'string' && jobId.startsWith(JOB_PREFIX)
  }

  get enabled() {
    return this.config.backgroundTerminals !== false
  }

  #limit() {
    const value = Number(this.config.maxBackgroundTerminals ?? 2)
    return Number.isFinite(value) ? Math.max(1, Math.min(8, Math.floor(value))) : 2
  }

  #keepFinished() {
    const value = Number(this.config.keepFinishedBackground ?? 2)
    return Number.isFinite(value) ? Math.max(0, Math.min(8, Math.floor(value))) : 2
  }

  list() {
    return [...this.#jobs.values()].map((job) => this.#view(job))
  }

  #view(job) {
    const status = job.state === 'running'
      ? 'running'
      : job.killed === true
        ? 'killed'
        : job.exitCode !== null && job.exitCode !== 0
          ? 'failed'
          : 'completed'
    const detail = job.state === 'running' || job.exitCode === null ? undefined : 'exit code: ' + job.exitCode
    return {
      id: job.id,
      kind: 'background',
      label: job.title,
      status,
      ...(detail === undefined ? {} : { detail }),
      startedAt: job.startedAt,
      ...(job.endedAt === undefined ? {} : { finishedAt: job.endedAt }),
    }
  }

  async waitFor(jobId, timeoutMs) {
    const job = this.#jobs.get(jobId)
    if (job === undefined || job.state !== 'running') return
    await Promise.race([
      job.settled ?? Promise.resolve(),
      sleep(Math.max(1, Math.min(600_000, timeoutMs))),
    ])
  }

  async run(exec, options) {
    const registry = this.#plugin?.registry
    if (registry === undefined) throw new Error('terminal registry is unavailable')
    const conversation = options.sessionId
    const running = [...this.#jobs.values()].filter(
      (job) => job.conversation === conversation && job.state === 'running',
    )
    if (running.length >= this.#limit()) return undefined
    const session = await withTimeout(registry.createCommandSession({
      command: options.command,
      cwd: options.cwd,
      sessionId: conversation,
      owner: 'agent',
      ...(typeof exec?.agent?.id === 'string' ? { agentId: exec.agent.id } : {}),
      ...(options.group === undefined ? {} : { group: options.group }),
      origin: 'background',
      title: options.title ?? firstLine(options.command),
    }), CREATE_TIMEOUT_MS, 'background terminal creation')
    const job = {
      id: JOB_PREFIX + randomUUID(),
      sessionId: session.id,
      conversation,
      command: options.command,
      title: options.title ?? firstLine(options.command),
      startedAt: Date.now(),
      state: 'running',
      endedAt: undefined,
      exitCode: null,
      signal: null,
      killed: false,
    }
    job.settled = new Promise((resolve) => { job.settle = resolve })
    this.#jobs.set(job.id, job)
    session.whenExited.then(({ exitCode, signal }) => {
      try { job.settle?.() } catch {}
      job.state = 'closed'
      job.exitCode = exitCode ?? null
      job.signal = signal ?? null
      job.endedAt = Date.now()
      this.#trim(conversation)
      try {
        this.#plugin?.registry?.emitNotice?.({
          type: 'command-end',
          terminalId: session.id,
          sessionId: conversation,
          background: true,
          exitCode: job.exitCode,
          durationMs: job.endedAt - job.startedAt,
        })
      } catch {}
    }).catch(() => {})
    return { jobId: job.id, sessionId: session.id, startedAt: job.startedAt }
  }

  output(jobId) {
    const job = this.#jobs.get(jobId)
    if (job === undefined) return undefined
    const registry = this.#plugin?.registry
    const session = registry?.lookup?.(job.sessionId)
    const text = session === undefined ? '' : clip(session.plainText?.() ?? '')
    return { text, job: this.#view(job) }
  }

  async kill(jobId) {
    const job = this.#jobs.get(jobId)
    if (job === undefined) return undefined
    job.killed = true
    const registry = this.#plugin?.registry
    await registry?.close?.(job.sessionId).catch(() => {})
    if (job.state === 'running') {
      job.state = 'closed'
      job.endedAt = job.endedAt ?? Date.now()
      job.exitCode = job.exitCode ?? null
      try { job.settle?.() } catch {}
    }
    return { outcome: 'cancellation-requested', job: this.#view(job) }
  }

  #trim(conversation) {
    const registry = this.#plugin?.registry
    if (registry === undefined) return
    const finished = [...this.#jobs.values()]
      .filter((job) => job.conversation === conversation && job.state !== 'running')
      .sort((left, right) => (right.endedAt ?? 0) - (left.endedAt ?? 0))
    for (const job of finished.slice(this.#keepFinished())) {
      void registry.close?.(job.sessionId).catch(() => {})
      this.#jobs.delete(job.id)
    }
  }

  async dispose() {
    const registry = this.#plugin?.registry
    for (const job of this.#jobs.values()) {
      if (job.state === 'running') await registry?.close?.(job.sessionId).catch(() => {})
    }
    this.#jobs.clear()
  }
}

export { JOB_PREFIX }
