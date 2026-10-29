const OSC_ST = /\u001B\][\s\S]*?\u001B\\/g

const OSC_BEL = /\u001B\][^\u0007]*\u0007/g

const STRING_ST = /\u001B[P^_X][\s\S]*?\u001B\\/g

const ANSI = new RegExp(
  [
    '[\\u001B\\u009B][[\\]()#;?]*(?:(?:(?:(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]+)*|[a-zA-Z\\d]+(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]*)*)?\\u0007)',
    '(?:(?:\\d{1,4}(?:;\\d{0,4})*)?[\\dA-PR-TZcf-nq-uy=><~]))',
  ].join('|'),
  'g',
)

const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g

export function stripAnsi(text) {
  if (typeof text !== 'string' || text.length === 0) return ''
  return text
    .replace(OSC_ST, '')
    .replace(OSC_BEL, '')
    .replace(STRING_ST, '')
    .replace(ANSI, '')
}

export function normalizeTerminalText(text) {
  if (typeof text !== 'string' || text.length === 0) return ''
  return stripAnsi(text)
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(CONTROL, '')
}

export function trimLineEnds(text) {
  if (typeof text !== 'string' || text.length === 0) return ''
  return text
    .split('\n')
    .map((line) => line.replace(/[ \u00A0]+$/u, ''))
    .join('\n')
}

export function commandOutputText(text) {
  const normalized = normalizeTerminalText(text)
  return normalized.replace(/\n+$/u, '')
}
