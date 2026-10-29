import {
  createMarkers,
  parseWrappedOutput,
  partialWrappedOutput,
  wrapPwshCommand,
} from './wrapper.js'

const POLL_INTERVAL_MS = 25

const DEFAULT_TIMEOUT_MS = 30_000

const MIN_TIMEOUT_MS = 100

const MAX_TIMEOUT_MS = 600_000

const CHAINS = new WeakMap()

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function dialectOf(kind) {
  const value = typeof kind === 'string' ? kind.toLowerCase() : ''
  if (value === 'pwsh' || value === 'powershell') return 'pwsh'
  if (value === 'bash' || value === 'zsh' || value === 'sh' || value === 'gitbash') return 'posix'
  return 'unsupported'
}

function quoteForPosix(value) {
  return String(value).replaceAll("'", "'\\''")
}

export function wrapPosixCommand(command, marker) {
  return [
    `printf '%s\\n' '${marker.start}'`,
    `eval '${quoteForPosix(command)}'`,
    '__dsh_exit=$?',
    `printf '%s%d\\n' '${marker.end}' "$__dsh_exit"`,
  ].join('; ')
}

function wrapCommand(command, marker, dialect) {
  return dialect === 'pwsh' ? wrapPwshCommand(command, marker) : wrapPosixCommand(command, marker)
}

export function execInSession(session, command, options = {}) {
  if (session === undefined || session === null) {
    return Promise.reject(new Error('execInSession requires a terminal session'))
  }
  const previous = CHAINS.get(session) ?? Promise.resolve()
  const run = previous.catch(() => undefined).then(() => execOnce(session, command, options))
  CHAINS.set(
    session,
    run.then(
      () => undefined,
      () => undefined,
    ),
  )
  return run
}

async function execOnce(session, command, options) {
  if (session === undefined || session === null) throw new Error('execInSession requires a terminal session')
  if (typeof command !== 'string' || command.trim().length === 0) throw new Error('command must be a non-empty string')
  if (session.state !== 'running') throw new Error(`terminal ${session.id} is not running`)
  const dialect = dialectOf(options.shellKind ?? session.shellKind)
  if (dialect === 'unsupported') {
    throw new Error(
      `cannot execute in a ${JSON.stringify(options.shellKind ?? session.shellKind)} shell: only PowerShell and POSIX shells support the marker wrapper`,
    )
  }
  const requestedTimeout = typeof options.timeoutMs === 'number' && Number.isFinite(options.timeoutMs) ? Math.floor(options.timeoutMs) : DEFAULT_TIMEOUT_MS
  const timeoutMs = Math.min(MAX_TIMEOUT_MS, Math.max(MIN_TIMEOUT_MS, requestedTimeout))
  const marker = createMarkers()
  const wrapperText = wrapCommand(command, marker, dialect)
  const startedAt = Date.now()


  const echoPrefix = options.echo === true ? `${command}\n` : ''

  await session.write(`${wrapperText}\r`)

  let lastText = ''
  while (Date.now() - startedAt < timeoutMs) {
    try {
      lastText = session.plainText()
    } catch {
      lastText = ''
    }
    const parsed = parseWrappedOutput(lastText, marker, wrapperText)
    if (parsed !== undefined) {
      return {
        exitCode: parsed.exitCode,
        output: `${echoPrefix}${parsed.output}`,
        timedOut: false,
        durationMs: Date.now() - startedAt,
      }
    }
    if (session.state !== 'running') break
    await sleep(POLL_INTERVAL_MS)
  }

  try {
    lastText = session.plainText()
  } catch {
    lastText = ''
  }
  const parsed = parseWrappedOutput(lastText, marker, wrapperText)
  if (parsed !== undefined) {
    return {
      exitCode: parsed.exitCode,
      output: `${echoPrefix}${parsed.output}`,
      timedOut: false,
      durationMs: Date.now() - startedAt,
    }
  }
  const partial = partialWrappedOutput(lastText, marker, wrapperText)
  return {
    exitCode: session.state === 'running' ? null : (session.exitCode ?? null),
    output: `${echoPrefix}${partial.output}`,
    timedOut: session.state === 'running',
    durationMs: Date.now() - startedAt,
  }
}

export { POLL_INTERVAL_MS }
