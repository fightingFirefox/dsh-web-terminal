import { randomUUID } from 'node:crypto'
import { normalizeTerminalText } from './ansi.js'

export const MARKER_PREFIX = '__DSH_TERMINAL_PANEL'

export function createMarkers(nonce = randomUUID()) {
  const suffix = nonce.replace(/[^A-Za-z0-9]/g, '')
  return {
    start: `${MARKER_PREFIX}_START_${suffix}__`,
    end: `${MARKER_PREFIX}_END_${suffix}:`,
  }
}

export function quoteForPwsh(value) {
  return String(value)
    .replaceAll('`', '``')
    .replaceAll('"', '`"')
    .replaceAll('$', '`$')
    .replaceAll('\r', '')
    .replaceAll('\n', '`n')
    .replaceAll('\x1B', '`e')
}

export function wrapPwshCommand(command, marker) {
  const body = quoteForPwsh(command)
  return [
    `Write-Output '${marker.start}'`,
    '$LASTEXITCODE = $null',
    '$__s = 1',
    '$__e0 = $Error.Count',
    `try { Invoke-Expression "${body}"; $__ok = $? -and ($Error.Count -eq $__e0) } catch { $__ok = $false }`,
    'if ($null -ne $LASTEXITCODE) { $__s = [int]$LASTEXITCODE } else { $__s = if ($__ok) { 0 } else { 1 } }',
    `Write-Output ('${marker.end}' + $__s)`,
  ].join('; ')
}

export function parseWrappedOutput(plainText, marker, wrapperText) {
  const text = typeof plainText === 'string' ? plainText : ''
  const end = text.lastIndexOf(marker.end)
  if (end < 0) return undefined
  const statusMatch = /^\s*(\d+)\s*(?:\n|$)/u.exec(text.slice(end + marker.end.length))
  if (statusMatch === null) return undefined
  const startMarker = text.lastIndexOf(marker.start, end)
  const start = startMarker < 0 ? 0 : startMarker + marker.start.length
  let captured = text.slice(start, end)
  if (typeof wrapperText === 'string' && wrapperText.length > 0) {
    captured = captured.split(wrapperText).join('')
  }
  return {
    output: trimCaptured(captured),
    exitCode: Number(statusMatch[1]),
    incomplete: startMarker < 0,
  }
}

export function partialWrappedOutput(plainText, marker, wrapperText, fallbackText = '') {
  const text = typeof plainText === 'string' ? plainText : ''
  const startIndex = text.lastIndexOf(marker.start)
  const removeWrapper = (value) => (typeof wrapperText === 'string' && wrapperText.length > 0 ? value.split(wrapperText).join('') : value)
  if (startIndex >= 0) {
    return { output: trimCaptured(removeWrapper(text.slice(startIndex + marker.start.length))), incomplete: false }
  }
  const fallback = typeof fallbackText === 'string' ? fallbackText : ''
  const fallbackStart = fallback.lastIndexOf(marker.start)
  const afterStart = fallbackStart < 0 ? fallback : fallback.slice(fallbackStart + marker.start.length)
  return { output: trimCaptured(removeWrapper(afterStart)), incomplete: fallbackStart < 0 }
}

export function commandTitle(command, maxLength = 80) {
  const text = typeof command === 'string' ? command : ''
  const firstLine = text.split(/\r?\n/u)[0]?.trim() ?? ''
  const fallback = firstLine.length > 0 ? firstLine : 'command'
  return fallback.length > maxLength ? `${fallback.slice(0, maxLength - 1)}…` : fallback
}

function trimCaptured(captured) {
  const normalized = normalizeTerminalText(captured)
  return normalized.replace(/^\n+/u, '').replace(/\n+$/u, '')
}
