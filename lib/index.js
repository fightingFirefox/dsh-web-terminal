// Cordis plugin entry for dsh-web-terminal (host half).

import { homedir } from 'node:os'
import { join } from 'node:path'

import { registerIntercept } from './host/intercept.js'
import { registerPrompt } from './host/prompt.js'
import { TerminalRegistry } from './host/registry.js'
import { registerRoutes } from './host/routes.js'
import { registerTools } from './host/tools.js'

export const name = 'dsh-web-terminal'

export const inject = ['tools']

export const DEFAULT_CONFIG = Object.freeze({
  interceptShellTools: true,
  shellPath: undefined,
  scrollback: 2000,
  maxOutputBytes: 262144,
  maxSessions: 16,
  perSessionMaxSessions: 8,
  commandTimeoutMs: 180000,
  retainExited: 10,
  historySize: 20,
  historyPath: undefined,
  historyPersist: true,
  interceptMinVisibleMs: 1500,
  autoCloseCommandDelayMs: 8000,
  autoCloseFailedDelayMs: 30000,
  autoCloseToolTerminals: true,
  autoCloseNotice: 'all',
  requireSandbox: false,
  allowUnconfined: true,
  portDetection: true,
})

export function resolveConfig(input) {
  const source = input !== null && typeof input === 'object' && !Array.isArray(input) ? input : {}
  const historyPath = typeof source.historyPath === 'string' && source.historyPath.trim().length > 0
    ? source.historyPath.trim()
    : source.historyPath === ''
      ? undefined
      : join(homedir(), '.dsh', 'dsh-web-terminal', 'history.json')
  return {
    interceptShellTools: source.interceptShellTools === undefined ? true : source.interceptShellTools === true,
    shellPath: typeof source.shellPath === 'string' && source.shellPath.trim().length > 0 ? source.shellPath.trim() : undefined,
    scrollback: boundInteger(source.scrollback, DEFAULT_CONFIG.scrollback, 0, 100_000),
    maxOutputBytes: boundInteger(source.maxOutputBytes, DEFAULT_CONFIG.maxOutputBytes, 1024, 16 * 1024 * 1024),
    maxSessions: boundInteger(source.maxSessions, DEFAULT_CONFIG.maxSessions, 1, 128),
    perSessionMaxSessions: boundInteger(source.perSessionMaxSessions, DEFAULT_CONFIG.perSessionMaxSessions, 1, 128),
    commandTimeoutMs: boundInteger(source.commandTimeoutMs, DEFAULT_CONFIG.commandTimeoutMs, 1000, 3_600_000),
    retainExited: boundInteger(source.retainExited, DEFAULT_CONFIG.retainExited, 0, 128),
    historySize: boundInteger(source.historySize, DEFAULT_CONFIG.historySize, 0, 512),
    historyPath,
    historyPersist: source.historyPersist === undefined ? true : source.historyPersist === true,

    interceptMinVisibleMs: boundInteger(source.interceptMinVisibleMs, DEFAULT_CONFIG.interceptMinVisibleMs, 0, 60_000),

    autoCloseCommandDelayMs: boundInteger(source.autoCloseCommandDelayMs, DEFAULT_CONFIG.autoCloseCommandDelayMs, -1, 600_000),
    autoCloseFailedDelayMs: boundInteger(source.autoCloseFailedDelayMs, DEFAULT_CONFIG.autoCloseFailedDelayMs, -1, 600_000),
    autoCloseToolTerminals: source.autoCloseToolTerminals === undefined ? true : source.autoCloseToolTerminals === true,
    autoCloseNotice: source.autoCloseNotice === 'failed' || source.autoCloseNotice === 'none' ? source.autoCloseNotice : 'all',
    requireSandbox: source.requireSandbox === true,
    allowUnconfined: source.allowUnconfined === undefined ? true : source.allowUnconfined === true,
    portDetection: source.portDetection === undefined ? true : source.portDetection === true,
  }
}

export function readSandboxPolicy(getService, agent) {
  const fallback = { mode: 'danger-full-access', workspaceRoot: undefined, available: false }
  try {
    const policy = getService()
    if (policy === undefined || policy === null || typeof policy.resolve !== 'function') return fallback
    const resolved = policy.resolve({ session: agent?.session })
    const mode = typeof resolved?.mode === 'string' ? resolved.mode : fallback.mode
    return {
      mode,
      workspaceRoot: typeof resolved?.workspaceRoot === 'string' ? resolved.workspaceRoot : undefined,
      available: true,
    }
  } catch {
    return fallback
  }
}

export function apply(ctx, config) {
  const resolved = resolveConfig(config)
  const getService = (name) => {
    try {
      return ctx.get(name)
    } catch {
      return undefined
    }
  }
  const getSandboxPolicy = () => getService('sandboxPolicy')
  const resolveSandboxPolicy = (agent) => readSandboxPolicy(getSandboxPolicy, agent)

  const plugin = {
    config: resolved,
    registry: undefined,
    logger: ctx.logger,
    getAttachments: () => getService('attachments'),
    getJobs: () => getService('jobs'),
    getAgents: () => getService('agents'),
    resolveSandboxPolicy,
  }
  const log = (level, message) => {
    try {
      ctx.logger?.[level]?.(message)
    } catch {

    }
  }


  registerTools(ctx, plugin)


  registerIntercept(ctx, plugin)


  registerPrompt(ctx)


  const initRegistry = (services) => {
    if (plugin.registry !== undefined) return
    const registry = new TerminalRegistry({
      subprocess: services.subprocess,
      workingDirectory: services.workingDirectory,
      getSessionStore: () => getService('sessions'),
      getSessionQuery: () => getService('sessionQuery'),
      getSandboxPolicy,
      resolveSandboxPolicy,
      logger: ctx.logger,
      config: resolved,
    })
    plugin.registry = registry
    ctx.effect(
      () => async () => {
        await registry.dispose()
      },
      'dsh-web-terminal: terminal sessions',
    )
    log('info', `[dsh-web-terminal] terminal backend ready (shell: ${resolved.shellPath ?? 'auto'}, maxSessions=${resolved.maxSessions}, history=${resolved.historySize})`)
  }
  const subprocess = getService('subprocess')
  const workingDirectory = getService('workingDirectory')
  if (subprocess !== undefined && workingDirectory !== undefined) {
    initRegistry({ subprocess, workingDirectory })
  } else {
    ctx.inject(['subprocess', 'workingDirectory'], (svcCtx) => initRegistry(svcCtx))
  }


  const webServer = getService('webServer')
  const connection = getService('connection')
  if (webServer !== undefined && connection !== undefined) {
    registerRoutes(ctx, plugin)
  } else {
    ctx.inject(['webServer', 'connection'], (webCtx) => {
      registerRoutes(webCtx, plugin)
    })
  }

  log(
    'info',
    `[dsh-web-terminal] host half 1.3.1 loaded (interceptShellTools=${resolved.interceptShellTools}, routes=${
      webServer !== undefined && connection !== undefined ? 'direct' : 'deferred'
    })`,
  )
}

function boundInteger(value, fallback, min, max) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback
  return Math.min(max, Math.max(min, Math.floor(value)))
}
