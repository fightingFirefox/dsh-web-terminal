// HTTP/SSE client for the host half.

import {
  parseCaptureRequest,
  parseConfigInfo,
  parseExit,
  parseHistoryPayload,
  parseNotice,
  parseOutput,
  parseSessionInfo,
  parseSessionPatch,
  parseSnapshot,
  parseSessionsPayload,
  type CaptureRequestFrame,
  type ConfigInfo,
  type ExitFrame,
  type HistoryEntry,
  type Notice,
  type OutputFrame,
  type SessionInfo,
  type SessionInfoPatch,
  type SnapshotFrame,
} from './types'

export const API_PREFIX = '/dsh-terminal-panel'

const REQUEST_TIMEOUT_MS = 10_000

export const CLIENT_ID_STORAGE_KEY = 'dsh-web-terminal.client-id'

let cachedClientId: string | null = null

function makeRandomId(): string {
  try {
    const cryptoObject = globalThis.crypto
    if (cryptoObject && typeof cryptoObject.randomUUID === 'function') {
      return cryptoObject.randomUUID()
    }
  } catch {

  }

  const random = Math.random().toString(36).slice(2)
  return `client-${Date.now().toString(36)}-${random}`
}

export function getClientId(): string {
  if (cachedClientId !== null) return cachedClientId
  let stored: string | null = null
  try {
    stored = globalThis.localStorage?.getItem(CLIENT_ID_STORAGE_KEY) ?? null
  } catch {
    stored = null
  }
  if (typeof stored === 'string' && stored.length > 0) {
    cachedClientId = stored
    return stored
  }
  const created = makeRandomId()
  try {
    globalThis.localStorage?.setItem(CLIENT_ID_STORAGE_KEY, created)
  } catch {

  }
  cachedClientId = created
  return created
}

export class ApiError extends Error {
  readonly status: number
  readonly code: string | undefined

  constructor(message: string, status: number, code?: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined
}

async function requestJson(path: string, init?: RequestInit): Promise<unknown> {
  const response = await fetch(API_PREFIX + path, {
    credentials: 'same-origin',
    ...init,


    signal: init?.signal ?? AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  })
  const text = await response.text()
  let payload: unknown
  if (text !== '') {
    try {
      payload = JSON.parse(text)
    } catch {
      payload = text
    }
  }
  if (!response.ok) {
    const record = asRecord(payload)
    const message =
      (record && readString(record.error)) ||
      (typeof payload === 'string' && payload !== '' ? payload : `HTTP ${response.status}`)
    const code = record ? readString(record.code) : undefined
    throw new ApiError(message, response.status, code)
  }
  return payload
}

function postJson(path: string, body: unknown): Promise<unknown> {
  return requestJson(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function readSessionPayload(value: unknown): SessionInfo | null {
  const record = asRecord(value)
  if (!record) return parseSessionInfo(value)
  const nested = record.session ?? record.info ?? record.terminal
  if (nested !== undefined) {
    const info = parseSessionInfo(nested)
    if (info) return info
  }
  return parseSessionInfo(record)
}

export async function fetchConfig(): Promise<ConfigInfo> {
  const payload = await requestJson('/config')
  const parsed = parseConfigInfo(payload)
  if (!parsed) throw new ApiError('config returned an invalid payload', 500)
  return parsed
}

export async function listSessions(options?: { sessionId?: string }): Promise<SessionInfo[]> {
  const query =
    options?.sessionId !== undefined && options.sessionId !== ''
      ? `?sessionId=${encodeURIComponent(options.sessionId)}`
      : ''
  const payload = await requestJson(`/sessions${query}`)
  const record = asRecord(payload)
  const rawList = Array.isArray(payload)
    ? payload
    : record && Array.isArray(record.sessions)
      ? record.sessions
      : []
  return rawList
    .map((item) => parseSessionInfo(item))
    .filter((item): item is SessionInfo => item !== null)
}

export async function fetchHistory(options?: {
  limit?: number
  terminalId?: string
}): Promise<HistoryEntry[]> {
  const params = new URLSearchParams()
  if (typeof options?.limit === 'number' && Number.isFinite(options.limit)) {
    params.set('limit', String(Math.max(1, Math.round(options.limit))))
  }
  if (options?.terminalId !== undefined && options.terminalId !== '') {
    params.set('terminalId', options.terminalId)
  }
  const query = params.toString()
  const payload = await requestJson(`/history${query === '' ? '' : `?${query}`}`)
  return parseHistoryPayload(payload)
}

export async function fetchSnapshot(id: string): Promise<SnapshotFrame> {
  const payload = await requestJson(`/snapshot?id=${encodeURIComponent(id)}`)
  const frame = parseSnapshot(payload)
  if (!frame) throw new ApiError('snapshot returned an invalid payload', 500)
  return frame
}

export async function fetchReplay(
  id: string,
  fromSeq: number,
): Promise<{ frames: OutputFrame[]; nextSeq: number }> {
  const payload = await requestJson(
    `/replay?id=${encodeURIComponent(id)}&fromSeq=${encodeURIComponent(String(Math.max(0, Math.floor(fromSeq))))}`,
  )
  const record = asRecord(payload)
  const rawFrames = record && Array.isArray(record.frames) ? record.frames : []
  const frames = rawFrames
    .map((frame) => parseOutput(frame))
    .filter((frame): frame is OutputFrame => frame !== null)
  const nextSeq =
    record && typeof record.nextSeq === 'number' && Number.isFinite(record.nextSeq)
      ? record.nextSeq
      : fromSeq
  return { frames, nextSeq }
}

export interface CreateSessionOptions {
  cols: number
  rows: number
  title?: string
  cwd?: string
  shell?: 'pwsh' | 'bash' | 'cmd'

  sessionId?: string
  env?: Record<string, string>
}

export async function createSession(options: CreateSessionOptions): Promise<SessionInfo> {
  const payload = await postJson('/create', {
    cols: Math.max(2, Math.round(options.cols)),
    rows: Math.max(1, Math.round(options.rows)),
    ...(options.title !== undefined ? { title: options.title } : {}),
    ...(options.cwd !== undefined ? { cwd: options.cwd } : {}),
    ...(options.shell !== undefined ? { shell: options.shell } : {}),
    ...(options.sessionId !== undefined ? { sessionId: options.sessionId } : {}),
    ...(options.env !== undefined ? { env: options.env } : {}),
  })
  const info = readSessionPayload(payload)
  if (!info) throw new ApiError('create returned an invalid session payload', 500)
  return info
}

export async function sendInput(
  id: string,
  data: string,
  inputClientId: string = getClientId(),
): Promise<void> {
  if (data === '') return
  await postJson('/input', { id, data, clientId: inputClientId })
}

export async function resizeSession(id: string, cols: number, rows: number): Promise<void> {
  await postJson('/resize', {
    id,
    cols: Math.max(2, Math.round(cols)),
    rows: Math.max(1, Math.round(rows)),
  })
}

export async function closeSession(id: string): Promise<string | null> {
  const payload = await postJson('/close', { id })
  const record = asRecord(payload)
  return record ? readString(record.historyId) ?? null : null
}

export async function keepSession(id: string): Promise<SessionInfo | null> {
  const payload = await postJson('/keep', { id })
  return readSessionPayload(payload)
}

export async function setAutoClosePaused(
  id: string,
  paused: boolean,
  reason?: string,
): Promise<SessionInfo | null> {
  const payload = await postJson('/auto-close', {
    id,
    action: paused ? 'pause' : 'resume',
    ...(reason !== undefined ? { reason } : {}),
  })
  return readSessionPayload(payload)
}

export async function renameSession(id: string, title: string): Promise<SessionInfo | null> {
  const payload = await postJson('/rename', { id, title })
  return readSessionPayload(payload)
}

export async function takeControl(
  id: string,
  inputClientId: string = getClientId(),
): Promise<string | null> {
  const payload = await postJson('/take-control', { id, clientId: inputClientId })
  const record = asRecord(payload)
  return record ? readString(record.writerClientId) ?? null : null
}

export async function signalSession(
  id: string,
  signal: 'SIGINT' | 'SIGTERM' | 'SIGKILL' | 'SIGHUP',
): Promise<string> {
  const payload = await postJson('/signal', { id, signal })
  const record = asRecord(payload)
  return (record && readString(record.delivered)) ?? signal
}

export async function postCapture(
  id: string,
  requestId: string,
  dataUrl: string,
  size?: { width: number; height: number },
): Promise<void> {
  await postJson('/capture', {
    id,
    requestId,
    dataUrl,
    ...(size !== undefined ? { width: size.width, height: size.height } : {}),
  })
}

export function exportUrl(id: string, format: 'text' | 'ansi' = 'text'): string {
  return `${API_PREFIX}/export?id=${encodeURIComponent(id)}&format=${format}`
}

function parseSseData(event: Event): unknown {
  const data = (event as MessageEvent).data
  if (typeof data !== 'string') return data
  try {
    return JSON.parse(data)
  } catch {
    return data
  }
}

function listenSse(
  source: EventSource,
  name: string,
  handler: (payload: unknown) => void,
): void {
  source.addEventListener(name, (event) => {
    try {
      handler(parseSseData(event))
    } catch (error) {
      console.warn('[dsh-web-terminal] failed to handle SSE frame', name, error)
    }
  })
}

export interface SessionStreamHandlers {
  onOpen?: () => void
  onError?: () => void
  onSnapshot?: (frame: SnapshotFrame) => void
  onOutput?: (frame: OutputFrame) => void
  onState?: (patch: SessionInfoPatch) => void
  onExit?: (frame: ExitFrame) => void

  onCaptureRequest?: (frame: CaptureRequestFrame) => void
}

export interface OpenSessionStreamOptions extends SessionStreamHandlers {

  clientId?: string

  fromSeq?: number

  handlers?: SessionStreamHandlers
}

export function openSessionStream(
  id: string,
  options: OpenSessionStreamOptions,
): () => void {
  const handlers: SessionStreamHandlers = options.handlers ?? {
    onOpen: options.onOpen,
    onError: options.onError,
    onSnapshot: options.onSnapshot,
    onOutput: options.onOutput,
    onState: options.onState,
    onExit: options.onExit,
    onCaptureRequest: options.onCaptureRequest,
  }
  const params = new URLSearchParams({ id })
  params.set('clientId', options.clientId ?? getClientId())
  if (
    typeof options.fromSeq === 'number' &&
    Number.isFinite(options.fromSeq) &&
    options.fromSeq >= 0
  ) {
    params.set('fromSeq', String(Math.floor(options.fromSeq)))
  }
  const source = new EventSource(`${API_PREFIX}/events?${params.toString()}`)
  listenSse(source, 'snapshot', (payload) => {
    const frame = parseSnapshot(payload)
    if (frame) handlers.onSnapshot?.(frame)
  })
  listenSse(source, 'output', (payload) => {
    const frame = parseOutput(payload)
    if (frame) handlers.onOutput?.(frame)
  })

  listenSse(source, 'replay', (payload) => {
    const record = asRecord(payload)
    const raw = record && Array.isArray(record.frames)
      ? record.frames
      : Array.isArray(payload)
        ? payload
        : []
    for (const item of raw) {
      const frame = parseOutput(item)
      if (frame) handlers.onOutput?.(frame)
    }
  })
  listenSse(source, 'state', (payload) => {
    const patch = parseSessionPatch(payload)
    if (patch) handlers.onState?.(patch)
  })
  listenSse(source, 'exit', (payload) => {
    const frame = parseExit(payload)
    if (frame) handlers.onExit?.(frame)
  })
  listenSse(source, 'capture-request', (payload) => {
    const frame = parseCaptureRequest(payload)
    if (frame) handlers.onCaptureRequest?.(frame)
  })
  source.addEventListener('open', () => {
    try {
      handlers.onOpen?.()
    } catch (error) {
      console.warn('[dsh-web-terminal] SSE open handler failed', error)
    }
  })
  source.addEventListener('error', () => {
    try {
      handlers.onError?.()
    } catch (error) {
      console.warn('[dsh-web-terminal] SSE error handler failed', error)
    }
  })
  return () => source.close()
}

export interface SessionsStreamHandlers {
  onOpen?: () => void
  onError?: () => void
  onSessions: (payload: SessionInfo[] | SessionInfo) => void

  onNotice?: (notice: Notice) => void

  onCaptureRequest?: (frame: CaptureRequestFrame) => void
}

interface SessionsFeed {
  source: EventSource
  subscribers: Set<SessionsStreamHandlers>

  opened: boolean
}

let sessionsFeed: SessionsFeed | null = null

function fanoutSessions(
  subscribers: Set<SessionsStreamHandlers>,
  dispatch: (handlers: SessionsStreamHandlers) => void,
): void {
  for (const handlers of Array.from(subscribers)) {
    try {
      dispatch(handlers)
    } catch (error) {
      console.warn('[dsh-web-terminal] sessions SSE subscriber failed', error)
    }
  }
}

function fanoutCaptureRequest(
  subscribers: Set<SessionsStreamHandlers>,
  frame: CaptureRequestFrame,
): void {
  fanoutSessions(subscribers, (subscriber) => subscriber.onCaptureRequest?.(frame))
}

export function openSessionsStream(handlers: SessionsStreamHandlers): () => void {
  if (sessionsFeed === null) {
    const subscribers = new Set<SessionsStreamHandlers>()
    const source = new EventSource(`${API_PREFIX}/events`)
    const feed: SessionsFeed = { source, subscribers, opened: false }
    listenSse(source, 'sessions', (payload) => {
      const parsed = parseSessionsPayload(payload)
      if (!parsed) return
      fanoutSessions(subscribers, (subscriber) => subscriber.onSessions(parsed))
    })
    listenSse(source, 'notice', (payload) => {
      const notice = parseNotice(payload)
      if (!notice) return
      if (notice.type === 'capture-request') {
        fanoutCaptureRequest(subscribers, {
          terminalId: notice.terminalId,
          requestId: notice.requestId,
        })
        return
      }
      fanoutSessions(subscribers, (subscriber) => subscriber.onNotice?.(notice))
    })
    listenSse(source, 'capture-request', (payload) => {
      const frame = parseCaptureRequest(payload)
      if (frame) fanoutCaptureRequest(subscribers, frame)
    })
    source.addEventListener('open', () => {
      feed.opened = true
      fanoutSessions(subscribers, (subscriber) => subscriber.onOpen?.())
    })
    source.addEventListener('error', () => {
      feed.opened = false
      fanoutSessions(subscribers, (subscriber) => subscriber.onError?.())
    })
    sessionsFeed = feed
  }
  const feed = sessionsFeed
  feed.subscribers.add(handlers)


  if (feed.opened) {
    queueMicrotask(() => {
      if (!feed.subscribers.has(handlers)) return
      try {
        handlers.onOpen?.()
      } catch (error) {
        console.warn('[dsh-web-terminal] sessions SSE replay failed', error)
      }
    })
  }
  let disposed = false
  return () => {
    if (disposed) return
    disposed = true
    feed.subscribers.delete(handlers)
    if (feed.subscribers.size === 0 && sessionsFeed === feed) {
      feed.source.close()
      sessionsFeed = null
    }
  }
}

export type { ConfigInfo, HistoryEntry, Notice }
