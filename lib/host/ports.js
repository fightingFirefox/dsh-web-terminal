import { stripAnsi } from './ansi.js'

const LOOPBACK_HOSTS = '(?:localhost|127\\.0\\.0\\.1|\\[::1\\]|0\\.0\\.0\\.0)'

const URL_WITH_SCHEME = new RegExp(
  `(https?)://(${LOOPBACK_HOSTS})(?::(\\d{1,5}))?[^\\s"'<>()\\[\\]{}]*`,
  'gi',
)

const BARE_HOST_PORT = new RegExp(`(?<![\\w.:/-])(${LOOPBACK_HOSTS}):(\\d{1,5})(?![\\d])`, 'gi')

const TRAILING_PUNCTUATION = /[.,;:!?'"`)\]}>]+$/u

const MAX_PORTS_PER_CALL = 32

function normalizeHost(host) {
  return host.toLowerCase()
}

function parsePort(raw) {
  if (typeof raw !== 'string' || raw.length === 0) return undefined
  const port = Number.parseInt(raw, 10)
  if (!Number.isSafeInteger(port) || port < 1 || port > 65_535) return undefined
  return port
}

export function extractPorts(text) {
  if (typeof text !== 'string' || text.length === 0) return []
  const plain = stripAnsi(text)
  if (plain.length === 0) return []


  const found = new Map()
  const now = Date.now()


  const record = (url, port, host) => {
    const key = `${normalizeHost(host)}:${port}`
    if (found.has(key) || found.size >= MAX_PORTS_PER_CALL) return
    found.set(key, {
      url,
      port,
      host: normalizeHost(host),
      firstSeenAt: now,
      lastSeenAt: now,
    })
  }



  for (const match of plain.matchAll(URL_WITH_SCHEME)) {
    const scheme = match[1].toLowerCase()
    const host = match[2]
    const raw = match[0].replace(TRAILING_PUNCTUATION, '')
    const url = `${scheme}${raw.slice(raw.indexOf(':'))}`
    const port = parsePort(match[3]) ?? (scheme === 'https' ? 443 : 80)
    record(url, port, host)
  }

  for (const match of plain.matchAll(BARE_HOST_PORT)) {
    const host = match[1]
    const port = parsePort(match[2])
    if (port === undefined) continue
    record(`http://${normalizeHost(host)}:${port}`, port, host)
  }

  return [...found.values()]
}
