// Intercept the built-in shell tools and run them inside a real PTY.
import { AgentShells } from './agent-shell.js'
import { BackgroundJobs } from './bg-jobs.js'
import { commandOutputText } from './ansi.js'

export const INTERCEPT_DEFAULT_TIMEOUT_MS = 120_000

export const INTERCEPTED_TOOLS = ['pwsh', 'bash']

export const SHELL_KIND_HINTS = { bash: 'bash', pwsh: 'pwsh' }

export function registerIntercept(ctx, plugin) {
  const liveConfig = () => (typeof plugin.getConfig === 'function' ? plugin.getConfig() : plugin.config)
  const shells = new AgentShells(plugin)
  plugin.agentShells = shells
  const bgJobs = new BackgroundJobs(plugin)
  plugin.bgJobs = bgJobs
  try {
    ctx.effect(
      () => async () => {
        await shells.dispose()
      },
      'dsh-web-terminal: agent shell',
    )
  } catch {

  }
  const sleep = (ms) => new Promise((resolve) => { const timer = setTimeout(resolve, ms); timer.unref?.() })

  ctx.on('tools/execute', async (exec, next) => {
    const config = liveConfig()
    if (config.interceptShellTools !== true) return next()
    const sandbox = typeof plugin.resolveSandboxPolicy === 'function'
      ? plugin.resolveSandboxPolicy(exec?.agent)
      : undefined
    const job = await serveJobTool(exec, next, bgJobs)
    if (job !== undefined) return job
    const kind = interceptKind(exec, config, sandbox)
    if (kind === 'background') {
      // A stalled background capture must fail the call instead of holding the
      // agent forever: the race reports an error the model can react to.
      const guard = new Promise((resolve) => {
        const timer = setTimeout(() => resolve(undefined), 25_000)
        timer.unref?.()
      })
      const captured = await Promise.race([runBackground(exec, next, plugin, bgJobs, config), guard])
      if (captured !== undefined) return captured
      return {
        isError: true,
        error: { message: 'background terminal capture timed out' },
        content: [{ type: 'text', text: 'background terminal capture timed out; the command was not started' }],
      }
    }
    if (kind !== 'foreground') {
      const args = exec?.arguments
      if (args?.run_in_background === true && plugin.registry !== undefined) {
        const origin = exec?.agent?.session?.id ?? exec?.agent?.id
        const root = plugin.registry.resolveRootSession === undefined
          ? origin
          : await plugin.registry.resolveRootSession(origin).catch(() => origin)
        try {
          plugin.registry.emitNotice?.({
            type: 'background-command',
            ...(typeof root === 'string' && root !== '' ? { sessionId: root } : {}),
            title: String(args.command ?? '').split(/\r?\n/u)[0].slice(0, 200),
          })
        } catch {}
      }
      return next()
    }
    // The registry is initialised from injected services after apply(); a tool
    // call that races host startup must wait instead of silently running in the
    // hidden built-in shell.
    if (plugin.registry === undefined && plugin.registryReady !== undefined) {
      await Promise.race([plugin.registryReady, sleep(8000)])
    }
    const registry = plugin.registry
    const originSessionId = exec?.agent?.session?.id ?? exec?.agent?.id
    const rootSessionId = registry.resolveRootSession === undefined
      ? originSessionId
      : await registry.resolveRootSession(originSessionId) ?? originSessionId
    const sessionId = rootSessionId
    if (registry === undefined) {
      notifyTerminalError(plugin, sessionId, 'terminal registry is not ready')
      return next()
    }
    const command = exec.arguments.command
    const timeoutMs = positiveNumber(exec.arguments.timeoutMs) ?? INTERCEPT_DEFAULT_TIMEOUT_MS
    try {
      const cwd = await registry.resolveCwd(exec.agent, exec.arguments.workdir, exec.signal)
      const result = await shells.run(exec, {
        command,
        cwd,
        timeoutMs,
        sessionId: rootSessionId,
        group: plugin.commandGroup(exec),
      })
      return {
        value: buildForegroundValue({
          cwd,
          output: result.output,
          exitCode: result.exitCode,
          signal: null,
          timedOut: result.timedOut,
          aborted: result.aborted,
          timeoutMs,
          truncated: false,
        }),
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      plugin.logger?.warn?.(
        `[dsh-web-terminal] agent shell fell back to the built-in ${exec.name} tool: ${message}`,
      )
      notifyTerminalError(plugin, sessionId, message)
      return next()
    }
  })
}

function notifyTerminalError(plugin, sessionId, message) {
  try {
    plugin.registry?.emitNotice?.({
      type: 'terminal-error',
      ...(typeof sessionId === 'string' && sessionId !== '' ? { sessionId } : {}),
      message: String(message).slice(0, 500),
    })
  } catch {}
}

const JOB_TOOLS = new Set(['job_output', 'job_kill'])

/** Serve job_* calls that belong to a background terminal; other ids stay with the host. */
async function serveJobTool(exec, next, bgJobs) {
  if (exec === undefined || exec === null || !JOB_TOOLS.has(exec.name)) return undefined
  const args = exec.arguments
  const jobId = typeof args?.job_id === 'string' ? args.job_id : undefined
  if (jobId === undefined || !bgJobs.isJob(jobId)) return undefined
  if (exec.name === 'job_output') {
    if (args?.wait === true) {
      const timeout = Number.isFinite(args.timeout_ms) && args.timeout_ms > 0 ? args.timeout_ms : 30_000
      await bgJobs.waitFor(jobId, timeout)
    }
    const output = bgJobs.output(jobId)
    if (output === undefined) {
      return { value: { text: 'unknown job ' + jobId, job: { id: jobId, kind: 'background', status: 'failed', label: '' } } }
    }
    return { value: output }
  }
  const killed = await bgJobs.kill(jobId)
  if (killed === undefined) return { value: { outcome: 'already-finished', job: { id: jobId, kind: 'background', status: 'completed', label: '' } } }
  return { value: killed }
}

async function runBackground(exec, next, plugin, bgJobs, config) {
  if (plugin.registry === undefined && plugin.registryReady !== undefined) {
    await Promise.race([plugin.registryReady, new Promise((resolve) => setTimeout(resolve, 8000))])
  }
  const registry = plugin.registry
  if (registry === undefined) return next()
  const originSessionId = exec?.agent?.session?.id ?? exec?.agent?.id
  const rootSessionId = registry?.resolveRootSession === undefined
    ? originSessionId
    : await registry.resolveRootSession(originSessionId) ?? originSessionId
  const command = exec.arguments.command
  try {
    const cwd = await registry.resolveCwd(exec.agent, exec.arguments.workdir, exec.signal)
    const started = await bgJobs.run(exec, {
      command,
      cwd,
      sessionId: rootSessionId,
      group: plugin.commandGroup(exec),
      title: String(command).split(/\r?\n/u)[0].slice(0, 200),
    })
    if (started === undefined) {
      emitBackgroundSkip(plugin, rootSessionId, command, 'background terminal limit reached')
      return next()
    }
    plugin.registry?.emitNotice?.({
      type: 'command-start',
      terminalId: started.sessionId,
      sessionId: rootSessionId,
      title: String(command).split(/\r?\n/u)[0].slice(0, 200),
      background: true,
    })
    return {
      value: {
        kind: 'background',
        jobId: started.jobId,
        cwd,
      },
    }
  } catch (error) {
    emitBackgroundSkip(plugin, rootSessionId, command, error instanceof Error ? error.message : String(error))
    return next()
  }
}

function emitBackgroundSkip(plugin, sessionId, command, message) {
  try {
    plugin.registry?.emitNotice?.({
      type: 'background-command',
      ...(typeof sessionId === 'string' && sessionId !== '' ? { sessionId } : {}),
      title: String(command ?? '').split(/\r?\n/u)[0].slice(0, 200),
      message: String(message).slice(0, 200),
    })
  } catch {}
}

/** foreground, background, or nothing to intercept. */
export function interceptKind(exec, config, sandbox) {
  if (config?.interceptShellTools !== true) return undefined
  if (exec === undefined || exec === null) return undefined
  if (!INTERCEPTED_TOOLS.includes(exec.name)) return undefined
  if (exec.agent === undefined || exec.agent === null) return undefined
  const args = exec.arguments
  if (args === undefined || args === null || typeof args !== 'object') return undefined
  if (args.sandbox_permissions !== undefined) return undefined
  if (typeof args.command !== 'string' || args.command.trim().length === 0) return undefined
  if (exec.signal?.aborted === true) return undefined
  if (requiresConfinement(config, sandbox)) return undefined
  if (args.run_in_background === true) {
    if (config.backgroundTerminals === false) return undefined
    return 'background'
  }
  return 'foreground'
}

export function shouldIntercept(exec, config, sandbox) {
  return interceptKind(exec, config, sandbox) === 'foreground'
}

export function requiresConfinement(config, sandbox) {
  const mode = sandbox?.mode
  if (typeof mode !== 'string' || mode === 'danger-full-access') return false
  return config?.requireSandbox === true || config?.allowUnconfined === false
}

export function buildForegroundValue(options) {
  let text = commandOutputText(options.output ?? '')
  if (options.truncated === true) {
    const budget = options.maxOutputBytes === undefined ? '' : ` (last ${options.maxOutputBytes} bytes)`
    text = `[output truncated${budget}]\n${text}`
  }
  return {
    kind: 'foreground',
    cwd: options.cwd,
    exitCode: options.timedOut || options.aborted ? null : (options.exitCode ?? null),
    signal: options.timedOut || options.aborted ? 'SIGTERM' : (options.signal ?? null),
    timedOut: options.timedOut === true,
    aborted: options.aborted === true,
    timeoutMs: options.timeoutMs,
    stdout: { text, truncated: false },
    stderr: { text: '', truncated: false },
  }
}

function positiveNumber(value) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : undefined
}
