const NAMED_KEYS = Object.freeze({
  enter: '\r',
  return: '\r',
  tab: '\t',
  'shift+tab': '\x1b[Z',
  esc: '\x1b',
  escape: '\x1b',
  backspace: '\x7f',
  delete: '\x1b[3~',
  del: '\x1b[3~',
  insert: '\x1b[2~',
  ins: '\x1b[2~',
  up: '\x1b[A',
  down: '\x1b[B',
  left: '\x1b[D',
  right: '\x1b[C',
  home: '\x1b[H',
  end: '\x1b[F',
  pageup: '\x1b[5~',
  'page-up': '\x1b[5~',
  pagedown: '\x1b[6~',
  'page-down': '\x1b[6~',
  space: ' ',
  f1: '\x1bOP',
  f2: '\x1bOQ',
  f3: '\x1bOR',
  f4: '\x1bOS',
  f5: '\x1b[15~',
  f6: '\x1b[17~',
  f7: '\x1b[18~',
  f8: '\x1b[19~',
  f9: '\x1b[20~',
  f10: '\x1b[21~',
  f11: '\x1b[23~',
  f12: '\x1b[24~',
})

export const KEY_VOCABULARY =
  'Enter / Tab / Shift+Tab / Esc / Backspace / Delete / Insert / Up / Down / Left / Right / Home / End / PageUp / PageDown / Space / F1-F12 / C-a..C-z / 单个字符'

const CTRL_SPEC = /^(?:c|ctrl|control)-([a-z])$/u

export const BRACKETED_PASTE_START = '\x1b[200~'
export const BRACKETED_PASTE_END = '\x1b[201~'

export function keySequence(name) {
  if (typeof name !== 'string') return undefined
  const raw = name.trim()
  if (raw.length === 0) return undefined
  const lower = raw.toLowerCase()
  const named = NAMED_KEYS[lower]
  if (named !== undefined) return named
  const ctrl = CTRL_SPEC.exec(lower)
  if (ctrl !== null) {
    return String.fromCharCode(ctrl[1].charCodeAt(0) & 0x1f)
  }
  if ([...raw].length === 1) return raw
  return undefined
}

export function resolveKeys(keys) {
  if (!Array.isArray(keys)) throw new Error('keys must be an array of key names')
  let out = ''
  for (const key of keys) {
    const sequence = keySequence(key)
    if (sequence === undefined) {
      throw new Error(`unknown key name: ${JSON.stringify(key)} (allowed: ${KEY_VOCABULARY})`)
    }
    out += sequence
  }
  return out
}

export function bracketPaste(text) {
  return `${BRACKETED_PASTE_START}${typeof text === 'string' ? text : ''}${BRACKETED_PASTE_END}`
}

export function isKnownKeys(keys) {
  return Array.isArray(keys) && keys.every((key) => keySequence(key) !== undefined)
}
