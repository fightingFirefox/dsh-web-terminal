// Plugin-owned settings store used when the host config form is unavailable.
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'

const TYPES = {
  interceptShellTools: 'boolean',
  autoOpenPolicy: 'string',
  editFollow: 'boolean',
  autoOpenIncludeInteractive: 'boolean',
  autoOpenReopenAfterClose: 'boolean',
  exposeTools: 'string',
  autoCloseNotice: 'string',
  autoCloseCommandDelayMs: 'number',
  autoCloseFailedDelayMs: 'number',
  autoCloseToolTerminals: 'boolean',
  historySize: 'number',
  historyPersist: 'boolean',
  portDetection: 'boolean',
  allowUnconfined: 'boolean',
  requireSandbox: 'boolean',
  ledgerEnabled: 'boolean',
  ledgerSize: 'number',
  ledgerPersist: 'boolean',
  watchdogIdleMs: 'number',
  scrollback: 'number',
  maxOutputBytes: 'number',
  maxSessions: 'number',
  perSessionMaxSessions: 'number',
  commandTimeoutMs: 'number',
  retainExited: 'number',
}

const ENUMS = {
  autoOpenPolicy: ['all', 'intercepted', 'off'],
  exposeTools: ['none', 'core', 'full'],
  autoCloseNotice: ['all', 'failed', 'none'],
}

export const SETTINGS_FIELDS = Object.freeze({ ...TYPES })

export function settingsSnapshot(config) {
  const out = {}
  for (const key of Object.keys(TYPES)) {
    if (config[key] !== undefined) out[key] = config[key]
  }
  return out
}

export function settingsEntry(key, value) {
  const type = TYPES[key]
  if (type === undefined) throw new Error('unknown setting: ' + key)
  if (type === 'boolean') {
    if (typeof value !== 'boolean') throw new Error(key + ' expects a boolean')
  } else if (type === 'number') {
    if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(key + ' expects a number')
    value = Math.floor(value)
  } else {
    if (typeof value !== 'string' || value === '') throw new Error(key + ' expects a string')
    const allowed = ENUMS[key]
    if (allowed !== undefined && !allowed.includes(value)) throw new Error(key + ' expects one of ' + allowed.join(', '))
  }
  return { key, value }
}

export class SettingsStore {
  #file
  #values = {}

  constructor(file) {
    this.#file = file
    try {
      const parsed = JSON.parse(readFileSync(file, 'utf8'))
      if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) this.#values = parsed
    } catch {
      this.#values = {}
    }
  }

  get() {
    return { ...this.#values }
  }

  set(key, value) {
    const entry = settingsEntry(key, value)
    this.#values[entry.key] = entry.value
    this.#save()
    return entry
  }

  #save() {
    try {
      mkdirSync(dirname(this.#file), { recursive: true })
      const tmp = this.#file + '.tmp'
      writeFileSync(tmp, JSON.stringify(this.#values, null, 2) + '\n', 'utf8')
      renameSync(tmp, this.#file)
    } catch {

    }
  }
}
