// Recent command-start focus shared between the watcher and the panel.
export interface CommandFocus {
  terminalId: string
  sessionId?: string
  at: number
}

let last: CommandFocus | null = null
const target = new EventTarget()

export function announceCommandStart(terminalId: string, sessionId?: string): void {
  if (terminalId === '') return
  last = { terminalId, ...(sessionId === undefined ? {} : { sessionId }), at: Date.now() }
  target.dispatchEvent(new Event('focus'))
}

export function onCommandFocus(listener: (focus: CommandFocus) => void): () => void {
  const handler = (): void => {
    if (last !== null) listener(last)
  }
  target.addEventListener('focus', handler)
  return () => target.removeEventListener('focus', handler)
}

export function consumeLastCommand(maxAgeMs = 10_000): CommandFocus | null {
  if (last === null) return null
  if (Date.now() - last.at > maxAgeMs) {
    last = null
    return null
  }
  const value = last
  last = null
  return value
}
