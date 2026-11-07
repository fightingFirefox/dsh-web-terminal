// Followed-file store shared by the notice handler and the files panel.

export interface FollowedFile {
  path: string
  address: string
  name: string
  ext: string
  category: string
  line: number
  added?: number
  removed?: number
  at: number
  size?: number
  preview?: string
  unread: boolean
}

const sessions = new Map<string, Map<string, FollowedFile>>()
const listeners = new Set<() => void>()
let version = 0
const MAX_FILES = 300

export const CATEGORY_ORDER = [
  'typescript', 'javascript', 'python', 'go', 'rust', 'java', 'c', 'shell', 'web',
  'markdown', 'text', 'json', 'yaml', 'config', 'data', 'image', 'other',
] as const

export const CATEGORY_LABELS: Record<string, string> = {
  typescript: 'TypeScript',
  javascript: 'JavaScript',
  python: 'Python',
  go: 'Go',
  rust: 'Rust',
  java: 'Java / Kotlin',
  c: 'C / C++',
  shell: 'Shell',
  web: 'HTML / CSS',
  markdown: 'Markdown',
  text: '\u6587\u672c',
  json: 'JSON',
  yaml: 'YAML',
  config: '\u914d\u7f6e',
  data: '\u6570\u636e',
  image: '\u56fe\u7247',
  other: '\u5176\u5b83',
}

const EXT_CATEGORY: Record<string, string> = {
  ts: 'typescript', tsx: 'typescript', mts: 'typescript', cts: 'typescript',
  js: 'javascript', jsx: 'javascript', mjs: 'javascript', cjs: 'javascript',
  py: 'python', pyi: 'python',
  go: 'go',
  rs: 'rust',
  java: 'java', kt: 'java', kts: 'java', scala: 'java', groovy: 'java',
  c: 'c', h: 'c', cc: 'c', cpp: 'c', hpp: 'c', cxx: 'c', hxx: 'c',
  sh: 'shell', bash: 'shell', zsh: 'shell', ps1: 'shell', bat: 'shell', cmd: 'shell',
  html: 'web', htm: 'web', css: 'web', scss: 'web', sass: 'web', less: 'web',
  vue: 'web', svelte: 'web', astro: 'web',
  md: 'markdown', markdown: 'markdown', mdx: 'markdown', rst: 'markdown', adoc: 'markdown',
  txt: 'text',
  json: 'json', jsonc: 'json', json5: 'json',
  yml: 'yaml', yaml: 'yaml',
  toml: 'config', ini: 'config', env: 'config', conf: 'config', cfg: 'config',
  csv: 'data', tsv: 'data', jsonl: 'data', ndjson: 'data', parquet: 'data', log: 'data',
  png: 'image', jpg: 'image', jpeg: 'image', gif: 'image', webp: 'image', svg: 'image',
  bmp: 'image', ico: 'image',
}

export function categoryOfExt(ext: string): string {
  return EXT_CATEGORY[ext.toLowerCase()] ?? 'other'
}

function bump(): void {
  version += 1
  for (const listener of listeners) {
    try { listener() } catch { /* ignore */ }
  }
}

export function subscribeFollowedFiles(listener: () => void): () => void {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

export function followedFilesVersion(): number {
  return version
}

export function recordFollowedFile(sessionId: string, notice: {
  path: string
  address: string
  line: number
  added?: number
  removed?: number
  size?: number
  preview?: string
}): void {
  const key = sessionId === '' ? '__page__' : sessionId
  let map = sessions.get(key)
  if (map === undefined) {
    map = new Map()
    sessions.set(key, map)
  }
  const path = notice.path
  const parts = path.split(/[\\/]/u)
  const name = parts[parts.length - 1] ?? path
  const dot = name.lastIndexOf('.')
  const ext = dot > 0 ? name.slice(dot + 1) : ''
  map.delete(path)
  map.set(path, {
    path,
    address: notice.address,
    name,
    ext,
    category: categoryOfExt(ext),
    line: notice.line,
    added: notice.added,
    removed: notice.removed,
    at: Date.now(),
    size: notice.size,
    preview: notice.preview,
    unread: true,
  })
  if (map.size > MAX_FILES) {
    const oldest = map.keys().next().value
    if (oldest !== undefined) map.delete(oldest)
  }
  bump()
}

export function filesForSession(sessionId: string | undefined): FollowedFile[] {
  const key = sessionId === undefined || sessionId === '' ? '__page__' : sessionId
  const map = sessions.get(key)
  if (map === undefined) return []
  return Array.from(map.values()).sort((a, b) => b.at - a.at)
}

export function markFollowedRead(sessionId: string | undefined, path: string): void {
  const key = sessionId === undefined || sessionId === '' ? '__page__' : sessionId
  const map = sessions.get(key)
  const file = map?.get(path)
  if (file === undefined || !file.unread) return
  file.unread = false
  bump()
}

export function clearFollowedFiles(sessionId?: string): void {
  if (sessionId === undefined) {
    sessions.clear()
  } else {
    const key = sessionId === '' ? '__page__' : sessionId
    sessions.delete(key)
  }
  bump()
}

export function groupFollowedFiles(files: FollowedFile[]): { key: string; label: string; items: FollowedFile[] }[] {
  const buckets = new Map<string, FollowedFile[]>()
  for (const file of files) {
    const bucket = buckets.get(file.category) ?? []
    bucket.push(file)
    buckets.set(file.category, bucket)
  }
  const groups: { key: string; label: string; items: FollowedFile[] }[] = []
  for (const category of CATEGORY_ORDER) {
    const items = buckets.get(category)
    if (items !== undefined && items.length > 0) {
      groups.push({ key: category, label: CATEGORY_LABELS[category] ?? category, items })
    }
  }
  return groups
}

let followTabLimit = 3

export function setFollowTabLimit(value: number): void {
  followTabLimit = Number.isFinite(value) && value > 0 ? Math.floor(value) : 3
}

export function getFollowTabLimit(): number {
  return followTabLimit
}

export function removeFollowedFile(sessionId: string | undefined, path: string): void {
  const key = sessionId === undefined || sessionId === '' ? '__page__' : sessionId
  const map = sessions.get(key)
  if (map === undefined || !map.delete(path)) return
  bump()
}

export function removeFollowedFiles(sessionId: string | undefined, paths: string[]): void {
  const key = sessionId === undefined || sessionId === '' ? '__page__' : sessionId
  const map = sessions.get(key)
  if (map === undefined) return
  let changed = false
  for (const path of paths) changed = map.delete(path) || changed
  if (changed) bump()
}
