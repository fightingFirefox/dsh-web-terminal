// Files panel: grouped list of followed edits with in-panel preview and tab cleanup.

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'

import {
  clearFollowedFiles,
  filesForSession,
  followedFilesVersion,
  groupFollowedFiles,
  markFollowedRead,
  removeFollowedFile,
  removeFollowedFiles,
  subscribeFollowedFiles,
  type FollowedFile,
} from './follow-store'
import { BRAND_ICONS, TYPE_ICONS } from './type-icons'

export interface FilesPanelProps {
  t?: (key: string, params?: Record<string, unknown>) => string
  currentSession?: () => string | undefined
  openFile?: (address: string, line: number) => void
  closeFileTabs?: () => number
  closeOtherTabs?: () => number
  closeFileTab?: (address: string) => void
  openTerminal?: () => void
}

const PREVIEW_LINE_LIMIT = 4000
const WIDTH_STORAGE_KEY = 'dsh-web-terminal.files-list-width'
const MIN_LIST_WIDTH = 200
const MAX_LIST_WIDTH = 720

interface TypeIcon {
  label: string
  color: string
  dark?: boolean
}

const ICONS: Record<string, TypeIcon> = {
  text: { label: 'TX', color: '#9ca3af' },
  config: { label: 'CF', color: '#f59e0b', dark: true },
  data: { label: 'DB', color: '#14b8a6' },
  image: { label: 'IM', color: '#a855f7' },
  other: { label: 'FI', color: '#9ca3af' },
}

function iconFor(category: string): TypeIcon {
  return ICONS[category] ?? ICONS.other
}

const CUSTOM_BADGES: Record<string, { label: string; bg: string; fg: string }> = {
  javascript: { label: 'JS', bg: '#f7df1e', fg: '#1f2328' },
}

function TypeBadge({ category }: { category: string }): JSX.Element {
  const custom = CUSTOM_BADGES[category]
  if (custom !== undefined) {
    return (
      <span
        className="dshtp-files-logo dshtp-files-badge"
        title={category}
        style={{ background: custom.bg, color: custom.fg }}
      >
        {custom.label}
      </span>
    )
  }
  const official = BRAND_ICONS[category]
  if (official !== undefined) {
    return (
      <span className="dshtp-files-logo" title={official.title}>
        <svg viewBox="0 0 24 24" width={18} height={18} aria-hidden="true">
          <path d={official.path} fill={'#' + official.hex} />
        </svg>
      </span>
    )
  }
  const brand = TYPE_ICONS[category]
  if (brand !== undefined) {
    return (
      <span className="dshtp-files-logo" title={category}>
        <svg
          viewBox={'0 0 ' + brand.width + ' ' + brand.height}
          width={18}
          height={18}
          aria-hidden="true"
          dangerouslySetInnerHTML={{ __html: brand.body }}
        />
      </span>
    )
  }
  const fallback = iconFor(category)
  return (
    <span
      className="dshtp-files-icon"
      data-dark={fallback.dark === true ? 'true' : 'false'}
      style={{ background: fallback.color }}
    >
      {fallback.label}
    </span>
  )
}

function storedWidth(): number {
  try {
    const value = Number(globalThis.localStorage?.getItem(WIDTH_STORAGE_KEY))
    if (Number.isFinite(value) && value >= MIN_LIST_WIDTH && value <= MAX_LIST_WIDTH) return value
  } catch { /* ignore */ }
  return 300
}

function commonDir(files: FollowedFile[]): string {
  if (files.length === 0) return ''
  const split = (value: string): string[] => value.split(/[\\/]/u)
  let prefix = split(files[0].path).slice(0, -1)
  for (const file of files.slice(1)) {
    const parts = split(file.path).slice(0, -1)
    let index = 0
    while (index < prefix.length && index < parts.length && prefix[index].toLowerCase() === parts[index].toLowerCase()) {
      index += 1
    }
    prefix = prefix.slice(0, index)
  }
  return prefix.join('\\')
}

function relativePath(path: string, base: string): string {
  if (base === '') return path
  const normalized = path.toLowerCase()
  const prefix = base.toLowerCase()
  if (!normalized.startsWith(prefix)) return path
  return path.slice(base.length).replace(/^[\\/]+/u, '')
}

function splitRel(rel: string): { dir: string; name: string } {
  const index = Math.max(rel.lastIndexOf('\\'), rel.lastIndexOf('/'))
  if (index === -1) return { dir: '', name: rel }
  return { dir: rel.slice(0, index), name: rel.slice(index + 1) }
}

function lineNumbers(text: string, highlight: number): JSX.Element[] {
  const lines = text.split(/\r?\n/u)
  const capped = lines.length > PREVIEW_LINE_LIMIT ? lines.slice(0, PREVIEW_LINE_LIMIT) : lines
  return capped.map((line, index) => (
    <div key={index + 1} className="dshtp-files-line" data-hit={(index + 1) === highlight ? 'true' : 'false'}>
      <span className="dshtp-files-gutter">{index + 1}</span>
      <span className="dshtp-files-code">{line === '' ? ' ' : line}</span>
    </div>
  ))
}

export function FilesPanel(props: FilesPanelProps): JSX.Element {
  const t = props.t ?? ((key: string) => key)
  useSyncExternalStore(subscribeFollowedFiles, followedFilesVersion, () => 0)
  const sessionId = props.currentSession?.()
  const files = filesForSession(sessionId)
  const [query, setQuery] = useState('')
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const [selectedPath, setSelectedPath] = useState<string | undefined>(undefined)
  const [note, setNote] = useState('')
  const [listWidth, setListWidth] = useState<number>(storedWidth)
  const draggingRef = useRef(false)

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (needle === '') return files
    return files.filter((file) => file.path.toLowerCase().includes(needle))
  }, [files, query])

  const base = useMemo(() => commonDir(filtered), [filtered])
  const groups = useMemo(() => groupFollowedFiles(filtered), [filtered])
  const selected: FollowedFile | undefined =
    selectedPath === undefined ? filtered[0] : filtered.find((file) => file.path === selectedPath) ?? filtered[0]

  useEffect(() => {
    try { globalThis.localStorage?.setItem(WIDTH_STORAGE_KEY, String(listWidth)) } catch { /* ignore */ }
  }, [listWidth])

  useEffect(() => {
    const onMove = (event: PointerEvent): void => {
      if (!draggingRef.current) return
      const next = Math.min(MAX_LIST_WIDTH, Math.max(MIN_LIST_WIDTH, event.clientX - (listOriginRef.current ?? 0)))
      setListWidth(next)
    }
    const onUp = (): void => { draggingRef.current = false }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
  }, [])

  const listOriginRef = useRef<number | null>(null)
  const listRef = useRef<HTMLDivElement | null>(null)
  const startDrag = useCallback((event: ReactPointerEvent<HTMLDivElement>): void => {
    draggingRef.current = true
    const rect = listRef.current?.getBoundingClientRect()
    listOriginRef.current = rect === undefined ? 0 : rect.left
    event.preventDefault()
  }, [])

  const select = (file: FollowedFile): void => {
    setSelectedPath(file.path)
    markFollowedRead(sessionId, file.path)
  }

  const removeOne = (file: FollowedFile): void => {
    props.closeFileTab?.(file.address)
    removeFollowedFile(sessionId, file.path)
    if (selectedPath === file.path) setSelectedPath(undefined)
  }

  const clearGroup = (items: FollowedFile[]): void => {
    for (const file of items) props.closeFileTab?.(file.address)
    removeFollowedFiles(sessionId, items.map((file) => file.path))
    setSelectedPath(undefined)
  }

  const closeFiles = (): void => {
    const closed = props.closeFileTabs?.() ?? 0
    clearFollowedFiles(sessionId)
    setSelectedPath(undefined)
    setNote(t('files.closedFiles', { count: String(closed) }))
  }

  const closeOthers = (): void => {
    const closed = props.closeOtherTabs?.() ?? 0
    setNote(t('files.closedOthers', { count: String(closed) }))
  }

  return (
    <div className="dshtp-files">
      <div className="dshtp-files-head">
        <button type="button" className="dshtp-files-back" onClick={() => props.openTerminal?.()}>
          {t('files.terminal')}
        </button>
        <span className="dshtp-files-title">{t('files.title')}</span>
        <span className="dshtp-files-count">{files.length}</span>
        <span className="dshtp-files-spacer" />
        <input
          className="dshtp-files-search"
          value={query}
          placeholder={t('files.search')}
          onChange={(event) => { setQuery(event.target.value) }}
          aria-label={t('files.search')}
        />
        <button type="button" className="dshtp-files-action" onClick={closeFiles}>
          {t('files.closeFiles')}
        </button>
        <button type="button" className="dshtp-files-action" data-danger="true" onClick={closeOthers}>
          {t('files.closeOthers')}
        </button>
      </div>

      <div className="dshtp-files-body">
        <div className="dshtp-files-list" ref={listRef} style={{ width: listWidth + 'px' }} role="list">
          {groups.length === 0 ? (
            <div className="dshtp-files-empty">{t('files.empty')}</div>
          ) : groups.map((group) => {
            return (
              <section key={group.key} className="dshtp-files-group">
                <div className="dshtp-files-group-row">
                  <button
                    type="button"
                    className="dshtp-files-group-head"
                    aria-expanded={collapsed[group.key] !== true}
                    onClick={() => { setCollapsed((previous) => ({ ...previous, [group.key]: previous[group.key] !== true })) }}
                  >
                    <span className="dshtp-files-chevron" data-open={collapsed[group.key] !== true}>
                      {'\u203a'}
                    </span>
                    <TypeBadge category={group.key} />
                    <span className="dshtp-files-group-label">{group.label}</span>
                    <span className="dshtp-files-group-count">{group.items.length}</span>
                  </button>
                  <button
                    type="button"
                    className="dshtp-files-group-clear"
                    title={t('files.clearGroup')}
                    aria-label={t('files.clearGroup')}
                    onClick={() => { clearGroup(group.items) }}
                  >
                    {'\u2715'}
                  </button>
                </div>
                {collapsed[group.key] === true ? null : group.items.map((file) => {
                  const rel = relativePath(file.path, base)
                  const parts = splitRel(rel)
                  const folderParts = parts.dir === '' ? [] : parts.dir.split(/[\\/]/u).filter((part) => part !== '')
                  const mainFolder = folderParts[0]
                  const subFolder = folderParts.slice(1).join('\\')
                  return (
                    <div
                      key={file.path}
                      className="dshtp-files-item"
                      role="listitem"
                      data-active={selected?.path === file.path ? 'true' : 'false'}
                      data-unread={file.unread ? 'true' : 'false'}
                      title={file.path}
                    >
                      <button type="button" className="dshtp-files-item-main" onClick={() => select(file)}>
                        <span className="dshtp-files-item-name">{parts.name}</span>
                        <span className="dshtp-files-item-dir">
                          {mainFolder === undefined ? t('files.rootFolder') : '\uD83D\uDCC1 ' + mainFolder}
                          {subFolder === '' ? '' : ' \u203a ' + subFolder}
                        </span>
                        <span className="dshtp-files-item-meta">
                          {t('files.line', { line: String(file.line) })}
                          {file.added === undefined ? '' : ' \u00b7 +' + file.added}
                          {file.removed === undefined ? '' : ' / -' + file.removed}
                        </span>
                      </button>
                      <button
                        type="button"
                        className="dshtp-files-item-close"
                        title={t('files.removeItem')}
                        aria-label={t('files.removeItem')}
                        onClick={() => { removeOne(file) }}
                      >
                        {'\u2715'}
                      </button>
                      <button
                        type="button"
                        className="dshtp-files-item-open"
                        title={t('files.openTab')}
                        aria-label={t('files.openTab')}
                        onClick={() => { props.openFile?.(file.address, file.line) }}
                      >
                        {'\u2197'}
                      </button>
                    </div>
                  )
                })}
              </section>
            )
          })}
        </div>

        <div
          className="dshtp-files-splitter"
          role="separator"
          aria-orientation="vertical"
          onPointerDown={startDrag}
        />

        <div className="dshtp-files-preview">
          {selected === undefined ? (
            <div className="dshtp-files-empty">{t('files.pick')}</div>
          ) : selected.preview === undefined ? (
            <div className="dshtp-files-empty">{t('files.noPreview')}</div>
          ) : (
            <>
              <div className="dshtp-files-preview-head">
                <TypeBadge category={selected.category} />
                <span className="dshtp-files-preview-name">{selected.name}</span>
                <span className="dshtp-files-preview-path">{relativePath(selected.path, base)}</span>
              </div>
              <div className="dshtp-files-preview-body">{lineNumbers(selected.preview, selected.line)}</div>
            </>
          )}
        </div>
      </div>

      {note === '' ? null : <div className="dshtp-files-note">{note}</div>}
    </div>
  )
}
