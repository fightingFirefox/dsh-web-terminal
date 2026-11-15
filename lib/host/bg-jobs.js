// Background commands run in their own visible command terminal, so their
// output is in the panel while the tool call returns immediately. The job_*
// tools are answered from here for the dsht-* ids; every other job stays with
// the host's own job service.
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

  /** Background capture must be explicitly enabled and unconfined. */
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
    return {
      id: job.id,
      kind: 'background',
      label: job.title,
      status: job.state === 'running' ? 'running' : job.killed === true ? 'killed' : 'completed',
      startedAt: job.startedAt,
      finishedAt: job.endedAt,
      exitCode: job.exitCode,
      sessionId: job.sessionId,
    }
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
    this.#jobs.set(job.id, job)
    session.whenExited.then(({ exitCode, signal }) => {
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
