// Cordis plugin entry for dsh-web-terminal (host half).

import { createRequire } from 'node:module'
import { homedir } from 'node:os'
import { join } from 'node:path'

import { registerIntercept } from './host/intercept.js'
import { registerPrompt } from './host/prompt.js'
import { TerminalRegistry } from './host/registry.js'
import { registerRoutes } from './host/routes.js'
import { registerLedgerTools, registerTools } from './host/tools.js'

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
  autoOpenPolicy: 'all',
  autoOpenIncludeInteractive: true,
  autoOpenReopenAfterClose: true,
  sshProfiles: [],
  ledgerEnabled: true,
  ledgerSize: 500,
  ledgerPath: undefined,
  ledgerPersist: true,
  watchdogIdleMs: 300000,
  exposeTools: 'none',
  singleCommandTab: true,
})

function unwrapVolatile(value, depth = 0) {
  if (depth > 6 || value === null || typeof value !== 'object' || Array.isArray(value)) return value
  if (typeof value.get === 'function') {
    try {
      return unwrapVolatile(value.get(), depth + 1)
    } catch {
      return value
    }
  }
  const keys = Object.keys(value)
  if (keys.length === 1 && keys[0] === 'value') return unwrapVolatile(value.value, depth + 1)
  return value
}

export function resolveConfig(input) {
  const raw = input !== null && typeof input === 'object' && !Array.isArray(input) ? input : {}
  const source = {}
  for (const [key, value] of Object.entries(raw)) source[key] = unwrapVolatile(value)
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
    autoOpenPolicy:
      source.autoOpenPolicy === 'off' || source.autoOpenPolicy === 'intercepted' ? source.autoOpenPolicy : 'all',
    autoOpenIncludeInteractive:
      source.autoOpenIncludeInteractive === undefined ? true : source.autoOpenIncludeInteractive === true,
    autoOpenReopenAfterClose:
      source.autoOpenReopenAfterClose === undefined ? true : source.autoOpenReopenAfterClose === true,
    sshProfiles: normalizeSshProfiles(source.sshProfiles),
    ledgerEnabled: source.ledgerEnabled === undefined ? true : source.ledgerEnabled === true,
    ledgerSize: boundInteger(source.ledgerSize, DEFAULT_CONFIG.ledgerSize, 1, 5000),
    ledgerPath: typeof source.ledgerPath === 'string' && source.ledgerPath.trim() !== '' ? source.ledgerPath.trim() : undefined,
    ledgerPersist: source.ledgerPersist === undefined ? true : source.ledgerPersist === true,
    watchdogIdleMs: boundInteger(source.watchdogIdleMs, DEFAULT_CONFIG.watchdogIdleMs, 0, 86_400_000),
    exposeTools:
      source.exposeTools === 'core' || source.exposeTools === 'full' ? source.exposeTools : 'none',
    singleCommandTab: source.singleCommandTab === undefined ? true : source.singleCommandTab === true,
  }
}

function normalizeSshProfiles(value) {
  if (!Array.isArray(value)) return []
  const profiles = []
  for (const raw of value) {
    if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) continue
    const name = typeof raw.name === 'string' ? raw.name.trim() : ''
    const host = typeof raw.host === 'string' ? raw.host.trim() : ''
    if (name === '' || host === '') continue
    const user = typeof raw.user === 'string' && raw.user.trim() !== '' ? raw.user.trim() : undefined
    const port = typeof raw.port === 'number' && Number.isFinite(raw.port) ? Math.min(65535, Math.max(1, Math.floor(raw.port))) : undefined
    const identityFile = typeof raw.identityFile === 'string' && raw.identityFile.trim() !== '' ? raw.identityFile.trim() : undefined
    profiles.push({ name, host, ...(user === undefined ? {} : { user }), ...(port === undefined ? {} : { port }), ...(identityFile === undefined ? {} : { identityFile }) })
  }
  return profiles.slice(0, 32)
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
  const liveConfig = () => resolveConfig(config)
  const resolved = liveConfig()
  const getService = (name) => {
    try {
      return ctx.get(name)
    } catch {
      return undefined
    }
  }
  try {
    ctx.on('session/event', (session, event) => {
      if (event?.type !== 'turn/start') return
      const turn = event.data?.turn
      if (typeof turn !== 'number') return
      const key = String(session?.id ?? '')
      if (key !== '') turns.set(key, turn)
    })
  } catch {

  }
  const getSandboxPolicy = () => getService('sandboxPolicy')
  const resolveSandboxPolicy = (agent) => readSandboxPolicy(getSandboxPolicy, agent)

  const turns = new Map()
  const plugin = {
    config: resolved,
    getConfig: liveConfig,
    commandGroup: (exec) => {
      const sessionId = String(exec?.agent?.session?.id ?? exec?.agent?.id ?? '')
      const turn = turns.get(sessionId)
      if (sessionId !== '' && typeof turn === 'number') return `turn:${sessionId}:${turn}`
      const root = exec?.rootCallId
      return typeof root === 'string' ? root : undefined
    },
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


  const CORE_TOOLS = new Set([
    'live_terminal_screenshot',
    'live_terminal_read',
    'live_terminal_send',
    'live_terminal_list',
    'live_terminal_status',
    'live_terminal_close',
  ])
  if (resolved.exposeTools === 'full') {
    registerTools(ctx, plugin)
    registerLedgerTools(ctx, plugin)
  } else if (resolved.exposeTools === 'core') {
    registerTools(ctx, plugin, CORE_TOOLS)
  }


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
      getConfig: liveConfig,
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

/* Settings form (official DSH mechanism): a Schemastery Config schema whose
 * live fields are marked volatile, so Settings -> Plugins renders the standard
 * form for this row with no custom UI and every theme applies. */
let schemaLib
try {
  const require = createRequire(import.meta.url)
  const loaded = require('@deepseek-ai/schemastery')
  schemaLib = loaded?.default ?? loaded
} catch {
  schemaLib = undefined
}

function volatileField(schema) {
  if (typeof schema.volatile === 'function') return schema.volatile()
  if (schema !== null && typeof schema === 'object' && schema.meta !== undefined) schema.meta.volatile = true
  return schema
}

export const Config = schemaLib === undefined
  ? undefined
  : schemaLib.object({
      interceptShellTools: volatileField(schemaLib.boolean().default(true).description('Agent 前台 shell 调用镜像到面板 / stream agent shell calls into the panel')),
      autoOpenPolicy: volatileField(
        schemaLib
          .union([schemaLib.const('all'), schemaLib.const('intercepted'), schemaLib.const('off')])
          .default('all')
          .description('自动弹出策略：all 任意 agent 终端 / intercepted 仅被接管的 shell 命令 / off 手动 / auto-open policy'),
      ),
      autoOpenIncludeInteractive: volatileField(
        schemaLib.boolean().default(true).description('agent 打开的交互终端也自动弹出 / auto-open interactive terminals created by the agent'),
      ),
      autoOpenReopenAfterClose: volatileField(
        schemaLib.boolean().default(true).description('手动关闭面板后，下一条命令仍会重新弹出 / reopen after the panel was closed manually'),
      ),
      interceptMinVisibleMs: volatileField(schemaLib.number().default(1500).description('短命令上屏阈值（毫秒）/ minimum visible duration for intercepted commands')),
      autoCloseCommandDelayMs: volatileField(schemaLib.number().default(8000).description('成功结束自动关闭延迟（毫秒，-1 永不）/ auto-close delay after success')),
      autoCloseFailedDelayMs: volatileField(schemaLib.number().default(30000).description('失败结束自动关闭延迟（毫秒）/ auto-close delay after failure')),
      autoCloseToolTerminals: volatileField(schemaLib.boolean().default(true).description('live_terminal_run 终端同样自动关闭 / auto-close tool terminals')),
      historySize: volatileField(schemaLib.number().default(20).description('命令历史条数 / closed-command history size')),
      historyPersist: volatileField(schemaLib.boolean().default(true).description('历史落盘 / persist history to disk')),
      portDetection: volatileField(schemaLib.boolean().default(true).description('识别 loopback 端口并生成链接 / detect loopback ports')),
      allowUnconfined: volatileField(schemaLib.boolean().default(true).description('允许未套 DSH 沙箱的 agent 终端 / allow unconfined agent terminals')),
      requireSandbox: volatileField(schemaLib.boolean().default(false).description('非 danger-full-access 时拒绝接管 / require a confined sandbox before intercepting')),
      exposeTools: volatileField(
        schemaLib
          .union([schemaLib.const('none'), schemaLib.const('core'), schemaLib.const('full')])
          .default('none')
          .description('向模型暴露的终端工具：none 不注册（仅自动上屏）/ core 阅读与交互 / full 全部 / agent tools exposed'),
      ),
      singleCommandTab: volatileField(
        schemaLib.boolean().default(true).description('命令终端只保留一个标签：新命令替换旧命令终端（被钉住的除外）/ reuse one command tab'),
      ),
      ledgerEnabled: volatileField(schemaLib.boolean().default(true).description('命令台账 / command ledger')),
      ledgerSize: volatileField(schemaLib.number().default(500).description('台账条数上限 / ledger entries kept')),
      ledgerPersist: volatileField(schemaLib.boolean().default(true).description('台账落盘 / persist ledger to disk')),
      watchdogIdleMs: volatileField(
        schemaLib.number().default(300000).description('挂起判定：命令无输出多久后标记（0 关闭）/ idle watchdog threshold in ms (0 = off)'),
      ),
      shellPath: schemaLib.string().description('交互 shell 路径；空表示自动探测 / interactive shell path (empty = auto)'),
      scrollback: schemaLib.number().default(2000).description('回滚行数 / scrollback lines'),
      maxOutputBytes: schemaLib.number().default(262144).description('单会话保留输出字节 / retained output bytes per session'),
      maxSessions: schemaLib.number().default(16).description('全局终端上限 / global terminal limit'),
      perSessionMaxSessions: schemaLib.number().default(8).description('单会话终端上限 / per-DSH-session limit'),
      commandTimeoutMs: schemaLib.number().default(180000).description('live_terminal_run 默认等待超时 / default run timeout'),
      retainExited: schemaLib.number().default(10).description('保留的已退出会话数 / retained exited sessions'),
      historyPath: schemaLib.string().description('历史文件路径；空表示默认 / history file path'),
      autoCloseNotice: schemaLib.union([schemaLib.const('all'), schemaLib.const('failed'), schemaLib.const('none')]).default('all').description('关闭通知范围 / auto-close notice scope'),
      sshProfiles: schemaLib
        .array(
          schemaLib.object({
            name: schemaLib.string().required().description('配置名 / profile name'),
            host: schemaLib.string().required().description('主机 / host'),
            user: schemaLib.string().description('用户名 / user'),
            port: schemaLib.number().description('端口 / port'),
            identityFile: schemaLib.string().description('私钥路径 / identity file'),
          }),
        )
        .default([])
        .description('SSH 终端配置 / SSH terminal profiles'),
    })
