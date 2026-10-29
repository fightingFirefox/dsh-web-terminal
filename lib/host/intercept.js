// Intercept the built-in shell tools and run them inside a real PTY.
import { AgentShells } from './agent-shell.js'
import { commandOutputText } from './ansi.js'

export const INTERCEPT_DEFAULT_TIMEOUT_MS = 120_000

export const INTERCEPTED_TOOLS = ['pwsh', 'bash']

export const SHELL_KIND_HINTS = { bash: 'bash', pwsh: 'pwsh' }

export function registerIntercept(ctx, plugin) {
  const liveConfig = () => (typeof plugin.getConfig === 'function' ? plugin.getConfig() : plugin.config)
  const shells = new AgentShells(plugin)
  plugin.agentShells = shells
  try {
    ctx.effect(
      () => async () => {
        await shells.dispose()
      },
      'dsh-web-terminal: agent shell',
    )
  } catch {

  }
  ctx.on('tools/execute', async (exec, next) => {
    const config = liveConfig()
    if (config.interceptShellTools !== true) return next()
    const sandbox = typeof plugin.resolveSandboxPolicy === 'function'
      ? plugin.resolveSandboxPolicy(exec?.agent)
      : undefined
    if (!shouldIntercept(exec, config, sandbox)) return next()
    const registry = plugin.registry
    if (registry === undefined) return next()
    const command = exec.arguments.command
    const timeoutMs = positiveNumber(exec.arguments.timeoutMs) ?? INTERCEPT_DEFAULT_TIMEOUT_MS
    try {
      const cwd = await registry.resolveCwd(exec.agent, exec.arguments.workdir, exec.signal)
      const result = await shells.run(exec, {
        command,
        cwd,
        timeoutMs,
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
      plugin.logger?.warn?.(
        `[dsh-web-terminal] agent shell fell back to the built-in ${exec.name} tool: ${
          error instanceof Error ? error.message : String(error)
        }`,
      )
      return next()
    }
  })
}

export function shouldIntercept(exec, config, sandbox) {
  if (config?.interceptShellTools !== true) return false
  if (exec === undefined || exec === null) return false
  if (!INTERCEPTED_TOOLS.includes(exec.name)) return false
  if (exec.agent === undefined || exec.agent === null) return false
  const args = exec.arguments
  if (args === undefined || args === null || typeof args !== 'object') return false
  if (args.run_in_background === true) return false
  if (args.sandbox_permissions !== undefined) return false
  if (typeof args.command !== 'string' || args.command.trim().length === 0) return false
  if (exec.signal?.aborted === true) return false
  if (requiresConfinement(config, sandbox)) return false
  return true
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
