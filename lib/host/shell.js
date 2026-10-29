export function executableName(path) {
  const text = typeof path === 'string' ? path : ''
  const base = text.slice(Math.max(text.lastIndexOf('/'), text.lastIndexOf('\\')) + 1)
  return base.toLowerCase().replace(/\.exe$/u, '')
}

export function shellKind(path) {
  const name = executableName(path)
  if (name === 'pwsh' || name === 'powershell' || name === 'cmd') return name
  if (name === 'bash' || name === 'zsh' || name === 'sh') return name
  return 'other'
}

export function interactiveArgv(shell) {
  if (shell.kind === 'pwsh' || shell.kind === 'powershell') return [shell.path, '-NoLogo']
  if (shell.kind === 'cmd') return [shell.path]
  return [shell.path, '-i']
}

export function commandArgv(shell, command) {
  if (shell.kind === 'pwsh' || shell.kind === 'powershell') {
    return [shell.path, '-NoLogo', '-NoProfile', '-NonInteractive', '-Command', command]
  }
  if (shell.kind === 'cmd') return [shell.path, '/d', '/s', '/c', command]
  return [shell.path, '-c', command]
}

const KIND_HINT_FAMILIES = {
  pwsh: ['pwsh', 'powershell'],
  bash: ['bash', 'zsh', 'sh'],
}

function hintCandidates(kindHint) {
  if (kindHint === 'pwsh') return ['pwsh', 'powershell']
  if (kindHint === 'bash') return ['bash']
  return [kindHint]
}

function kindHintFamily(kindHint) {
  const family = Object.hasOwn(KIND_HINT_FAMILIES, kindHint) ? KIND_HINT_FAMILIES[kindHint] : undefined
  return family ?? [kindHint]
}

export function shellCandidates(platform, configured, defaultShell, kindHint) {
  if (typeof configured === 'string' && configured.length > 0) return [configured]
  const candidates = []
  if (typeof kindHint === 'string' && kindHint.length > 0) candidates.push(...hintCandidates(kindHint))
  if (platform === 'windows') {
    candidates.push('pwsh', 'powershell')
    if (typeof defaultShell === 'string' && defaultShell.length > 0) candidates.push(defaultShell)
    candidates.push('cmd.exe')
    return [...new Set(candidates)]
  }
  candidates.push('bash')
  if (typeof defaultShell === 'string' && defaultShell.length > 0) candidates.push(defaultShell)
  return [...new Set(candidates)]
}

export async function resolveShell({ subprocess, shellPath, signal, kindHint }) {
  if (subprocess === undefined || subprocess === null) {
    throw new Error('dsh-web-terminal: the subprocess service is unavailable; cannot spawn a terminal')
  }
  const hint = typeof kindHint === 'string' && kindHint.trim().length > 0 ? kindHint.trim() : undefined
  const expectedKinds = hint === undefined ? undefined : kindHintFamily(hint)
  const hintNote = hint === undefined ? '' : ` for shell kind ${hint}`
  const environment = typeof subprocess.terminalEnvironment === 'function' ? await subprocess.terminalEnvironment(signal) : undefined
  const platform = environment?.platform === 'windows' ? 'windows' : 'posix'
  const candidates = shellCandidates(platform, shellPath, environment?.defaultShell, hint)
  const failures = []
  for (const candidate of candidates) {
    try {
      const path = await subprocess.resolveExecutable(candidate, undefined, signal)
      const kind = shellKind(path)
      if (expectedKinds !== undefined && !expectedKinds.includes(kind)) {
        failures.push(`${candidate}: resolved to ${kind} (${path}), expected ${hint}`)
        continue
      }
      return { path, kind }
    } catch (error) {
      failures.push(`${candidate}: ${error instanceof Error ? error.message : String(error)}`)
    }
  }
  if (shellPath !== undefined) {
    throw new Error(`dsh-web-terminal: configured shellPath ${JSON.stringify(shellPath)} could not be resolved${hintNote} (${failures.join('; ')})`)
  }
  throw new Error(`dsh-web-terminal: no usable shell found${hintNote} (${failures.join('; ')})`)
}
