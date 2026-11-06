// Follow agent edits: watch each session workspace and announce text file changes.
import { watch } from 'node:fs'
import { readdir, readFile, realpath, stat } from 'node:fs/promises'
import { basename, join, resolve } from 'node:path'

const IGNORED = /[\\/](node_modules|\.git)([\\/]|$)/
const GRACE_MS = 600
const DEBOUNCE_MS = 260
const MAX_TEXT_BYTES = 1_000_000
const CACHE_FILES = 40
const CACHE_BYTES = 256 * 1024
const MAX_WATCHERS = 4096
const MAX_DEPTH = 24
// Atomic tool writes land in a temp directory next to the target; its events are noise.
const TEMP_ARTIFACT = /\.[^\\/]+\.[0-9a-f-]{8,}\.tmpdir([\\/]|$)/iu

const encoder = new TextEncoder()
const utf8Decoder = new TextDecoder('utf-8', { fatal: true })

export function encodeSegment(segment) {
  return encodeURIComponent(segment).replace(/%3A/giu, ':')
}

export function sessionFileAddress(sessionId, path) {
  const normalized = String(path).replace(/\\/gu, '/').replace(/^(?:\.\/)+/u, '')
  return 'dsh-resource://file/session/' + encodeSegment(String(sessionId)) + '/' +
    normalized.split('/').map(encodeSegment).join('/')
}

export function sniffText(buffer) {
  if (buffer.length === 0) return true
  const sample = buffer.subarray(0, 8192)
  for (let index = 0; index < sample.length; index += 1) {
    if (sample[index] === 0) return false
  }
  try {
    utf8Decoder.decode(sample)
    return true
  } catch {
    let controls = 0
    for (let index = 0; index < sample.length; index += 1) {
      const byte = sample[index]
      if (byte < 9 || (byte > 13 && byte < 32)) controls += 1
    }
    return controls / sample.length < 0.02
  }
}

export function firstChangedLine(before, after) {
  if (before === after) return null
  if (before === undefined) return { line: 1, added: null, removed: null }
  const oldLines = before.split('\n')
  const newLines = after.split('\n')
  let head = 0
  while (head < oldLines.length && head < newLines.length && oldLines[head] === newLines[head]) head += 1
  let tail = 0
  while (
    tail < oldLines.length - head &&
    tail < newLines.length - head &&
    oldLines[oldLines.length - 1 - tail] === newLines[newLines.length - 1 - tail]
  ) tail += 1
  return {
    line: Math.min(head + 1, newLines.length),
    added: Math.max(0, newLines.length - head - tail),
    removed: Math.max(0, oldLines.length - head - tail),
  }
}

export function registerEditFollow(ctx, plugin) {
  const config = () => (typeof plugin.getConfig === 'function' ? plugin.getConfig() : plugin.config) ?? {}
  const enabled = () => config().editFollow !== false
  const windows = new Map()
  const watchers = new Map()
  const caches = new Map()
  const timers = new Map()
  let disposed = false

  const isOpen = (entry, now) => entry !== undefined && (entry.depth > 0 || now - entry.closedAt <= GRACE_MS)

  const ensureWindow = (sessionId) => {
    let entry = windows.get(sessionId)
    if (entry === undefined) {
      entry = { sessionId, depth: 0, closedAt: 0, paths: new Set(), cwd: undefined, resolving: undefined, ready: undefined }
      windows.set(sessionId, entry)
    }
    return entry
  }

  const resolveWorkspace = async (entry, agent, signal) => {
    if (entry.cwd !== undefined) return
    if (entry.resolving !== undefined) {
      try { await entry.resolving } catch {}
      return
    }
    entry.resolving = (async () => {
      try {
        const cwd = await plugin.registry?.resolveCwd?.(agent, undefined, signal)
        if (typeof cwd === 'string' && cwd !== '') {
          entry.cwd = cwd
          startWatcher(entry)
        }
      } catch {} finally {
        entry.resolving = undefined
      }
    })()
    try { await entry.resolving } catch {}
  }

  // The watcher must exist before the tool mutates anything: a write that lands
  // between dispatch and the first directory watch is invisible.
  const ensureWatching = async (entry, agent, signal, timeoutMs) => {
    const deadline = Date.now() + timeoutMs
    while (Date.now() < deadline) {
      if (entry.ready !== undefined) {
        try { await entry.ready } catch {}
        return entry.cwd !== undefined
      }
      await resolveWorkspace(entry, agent, signal)
      if (entry.cwd !== undefined) continue
      return false
    }
    return entry.cwd !== undefined
  }

  const startWatcher = (entry) => {
    if (entry.ready !== undefined) return
    if (entry.cwd === undefined) return
    entry.ready = (async () => {
      let root = entry.cwd
      try { root = await realpath(root) } catch {}
      if (disposed) return
      const state = { root, handles: new Map() }
      watchers.set(entry.sessionId, state)
      await walkDirectory(entry.sessionId, state, root, 0)
    })().catch(() => undefined)
  }

  const watchDirectory = (sessionId, state, dir) => {
    if (state.handles.has(dir) || state.handles.size >= MAX_WATCHERS) return
    let handle
    try {
      handle = watch(dir, { persistent: false }, (_event, filename) => {
        if (filename === null || filename === undefined) return
        const path = join(dir, String(filename))
        void handleEvent(sessionId, path)
        void stat(path).then((info) => {
          if (info.isDirectory()) void walkDirectory(sessionId, state, path, 0)
        }).catch(() => undefined)
      })
    } catch {
      return
    }
    handle.on('error', () => {
      try { handle.close() } catch {}
      state.handles.delete(dir)
    })
    state.handles.set(dir, handle)
  }

  const walkDirectory = async (sessionId, state, dir, depth) => {
    if (depth > MAX_DEPTH || state.handles.size >= MAX_WATCHERS) return
    watchDirectory(sessionId, state, dir)
    let entries
    try { entries = await readdir(dir, { withFileTypes: true }) } catch { return }
    for (const dirent of entries) {
      if (!dirent.isDirectory()) continue
      if (IGNORED.test(join(dir, dirent.name) + '/')) continue
      if (TEMP_ARTIFACT.test(join(dir, dirent.name))) continue
      if (dirent.name === 'node_modules' || dirent.name === '.git') continue
      await walkDirectory(sessionId, state, join(dir, dirent.name), depth + 1)
    }
  }

  const otherWindows = (sessionId, root, path) => {
    const now = Date.now()
    let otherOpen = false
    let otherClaims = false
    for (const entry of windows.values()) {
      if (entry.sessionId === sessionId) continue
      if (entry.cwd !== root) continue
      if (!isOpen(entry, now)) continue
      if (entry.paths.has(path)) otherClaims = true
      else otherOpen = true
    }
    return { otherOpen, otherClaims }
  }

  const handleEvent = async (sessionId, path) => {
    if (disposed) return
    const entry = windows.get(sessionId)
    if (entry === undefined) return
    if (IGNORED.test(path) || TEMP_ARTIFACT.test(path)) return
    if (!isOpen(entry, Date.now())) return
    const key = sessionId + '|' + path
    const pending = timers.get(key)
    if (pending !== undefined) clearTimeout(pending)
    const timer = setTimeout(() => {
      timers.delete(key)
      void processEvent(sessionId, path)
    }, DEBOUNCE_MS)
    timer.unref?.()
    timers.set(key, timer)
  }

  const processEvent = async (sessionId, path) => {
    if (disposed) return
    const entry = windows.get(sessionId)
    if (entry === undefined || entry.cwd === undefined) return
    if (!isOpen(entry, Date.now())) return
    const root = entry.cwd
    const { otherOpen, otherClaims } = otherWindows(sessionId, root, path)
    if (otherClaims) return
    if (otherOpen && !entry.paths.has(path)) return
    let info
    try { info = await stat(path) } catch { return }
    if (!info.isFile() || info.size > MAX_TEXT_BYTES) return
    let buffer
    try { buffer = await readFile(path) } catch { return }
    if (!sniffText(buffer)) return
    const text = buffer.toString('utf8')
    const cacheKey = sessionId + '|' + path
    const previous = caches.get(cacheKey)
    const change = firstChangedLine(previous?.text, text)
    if (change === null) return
    if (buffer.length <= CACHE_BYTES) {
      caches.delete(cacheKey)
      caches.set(cacheKey, { text, at: Date.now() })
      if (caches.size > CACHE_FILES) {
        const oldest = caches.keys().next().value
        if (oldest !== undefined) caches.delete(oldest)
      }
    }
    const notice = {
      type: 'file-changed',
      sessionId,
      path,
      address: sessionFileAddress(sessionId, path),
      line: change.line,
      added: change.added,
      removed: change.removed,
      title: basename(path),
      at: Date.now(),
    }
    try { plugin.registry?.emitNotice?.(notice) } catch {}
  }

  const collectPaths = (entry, result) => {
    const touched = new Set()
    const remember = (value) => {
      const path = resolve(entry.cwd ?? '.', value)
      entry.paths.add(path)
      touched.add(path)
    }
    const meta = result?.meta
    if (meta !== null && typeof meta === 'object') {
      const single = meta.path
      if (typeof single === 'string' && single !== '') remember(single)
      const diffs = meta.diffs
      if (Array.isArray(diffs)) {
        for (const diff of diffs) {
          if (diff !== null && typeof diff === 'object' && typeof diff.path === 'string' && diff.path !== '') {
            remember(diff.path)
          }
        }
      }
    }
    const value = result?.value
    if (value !== null && typeof value === 'object' && typeof value.path === 'string') {
      remember(value.path)
    }
    return touched
  }

  ctx.on('tools/execute', async (exec, next) => {
    if (!enabled()) return next()
    const sessionId = exec?.agent?.session?.id ?? exec?.agent?.id
    if (sessionId === undefined || sessionId === '') return next()
    const entry = ensureWindow(sessionId)
    await ensureWatching(entry, exec?.agent, exec?.signal, 1500)
    entry.depth += 1
    try {
      const result = await next()
      if (result !== undefined && result !== null) {
        const touched = collectPaths(entry, result)
        for (const path of touched) void handleEvent(sessionId, path)
      }
      return result
    } finally {
      entry.depth = Math.max(0, entry.depth - 1)
      if (entry.depth === 0) entry.closedAt = Date.now()
    }
  })

  const dispose = () => {
    disposed = true
    for (const state of watchers.values()) {
      for (const handle of state.handles.values()) {
        try { handle.close() } catch {}
      }
    }
    watchers.clear()
    for (const timer of timers.values()) clearTimeout(timer)
    timers.clear()
    windows.clear()
    caches.clear()
  }

  try {
    ctx.effect(() => () => dispose(), 'dsh-web-terminal: edit follow')
  } catch {}

  return { dispose }
}
