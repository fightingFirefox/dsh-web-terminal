import { createRequire } from 'node:module'
import { trimLineEnds } from './ansi.js'

const requireFromHere = createRequire(import.meta.url)

let modules

export function loadXtermModules() {
  if (modules !== undefined) return modules
  const headless = requireFromHere('@xterm/headless')
  const serialize = requireFromHere('@xterm/addon-serialize')
  const Terminal = headless?.Terminal ?? headless?.default?.Terminal
  const SerializeAddon = serialize?.SerializeAddon ?? serialize?.default?.SerializeAddon
  if (typeof Terminal !== 'function' || typeof SerializeAddon !== 'function') {
    throw new Error('dsh-web-terminal: @xterm/headless or @xterm/addon-serialize is not usable')
  }
  modules = { Terminal, SerializeAddon }
  return modules
}

export class ScreenMirror {

  #terminal

  #serializer

  #cols

  #rows

  #disposed = false


  constructor({ cols, rows, scrollback }) {
    const { Terminal, SerializeAddon } = loadXtermModules()
    this.#terminal = new Terminal({ cols, rows, scrollback, allowProposedApi: true })
    this.#serializer = new SerializeAddon()
    this.#terminal.loadAddon(this.#serializer)
    this.#cols = cols
    this.#rows = rows
  }


  get cols() {
    return this.#cols
  }


  get rows() {
    return this.#rows
  }


  get disposed() {
    return this.#disposed
  }


  write(data) {
    if (this.#disposed) return Promise.reject(new Error('terminal screen mirror disposed'))
    return new Promise((resolve, reject) => {
      try {
        this.#terminal.write(data, resolve)
      } catch (error) {
        reject(error)
      }
    })
  }


  resize(cols, rows) {
    if (this.#disposed) return
    this.#terminal.resize(cols, rows)
    this.#cols = cols
    this.#rows = rows
  }


  visibleText() {



    if (this.#disposed) return ''
    return this.#bufferText(this.#viewportStart(), this.#rows)
  }


  fullText() {
    if (this.#disposed) return ''
    return this.#bufferText(0, this.#retainedLines())
  }


  cursor() {
    if (this.#disposed) return { x: 0, y: 0 }
    const buffer = this.#terminal.buffer.active
    return { x: buffer.cursorX, y: buffer.cursorY }
  }


  serialize(options) {
    if (this.#disposed) return ''
    try {
      return this.#serializer.serialize(options)
    } catch {
      return ''
    }
  }


  dispose() {
    if (this.#disposed) return
    this.#disposed = true
    try {
      this.#terminal.dispose()
    } catch {

    }
  }

  #viewportStart() {
    const buffer = this.#terminal.buffer.active


    if (typeof buffer.baseY === 'number' && buffer.baseY > 0) {
      return Math.max(0, Math.min(buffer.baseY, this.#terminal.buffer.active.length - this.#rows))
    }
    return 0
  }

  #retainedLines() {
    const length = this.#terminal.buffer.active.length
    const viewportStart = this.#viewportStart()
    return Math.max(0, Math.min(length, viewportStart + this.#rows) )
  }

  #bufferText(start, count) {
    if (this.#disposed) return ''
    const lines = []
    for (let index = start; index < start + count; index += 1) {
      const line = this.#terminal.buffer.active.getLine(index)
      if (line === undefined) break
      lines.push(line.translateToString(true))
    }
    while (lines.length > 0 && lines[lines.length - 1].trim() === '') lines.pop()
    return trimLineEnds(lines.join('\n'))
  }
}
