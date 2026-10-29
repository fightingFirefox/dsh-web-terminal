const CONTINUATION = 0b1000_0000
const CONTINUATION_MASK = 0b1100_0000

export function utf8ByteLength(text) {
  return Buffer.byteLength(text, 'utf8')
}

export function tailByBytes(text, maxBytes) {
  if (typeof text !== 'string' || text.length === 0) return { text: '', truncated: false }
  if (!Number.isSafeInteger(maxBytes) || maxBytes <= 0) return { text: '', truncated: text.length > 0 }
  const bytes = Buffer.from(text, 'utf8')
  if (bytes.length <= maxBytes) return { text, truncated: false }
  let start = bytes.length - maxBytes

  while (start < bytes.length && (bytes[start] & CONTINUATION_MASK) === CONTINUATION) start += 1
  return { text: bytes.subarray(start).toString('utf8'), truncated: true }
}

export class ByteTail {

  #parts = []

  #bytes = 0

  #maxBytes


  constructor(maxBytes) {
    if (!Number.isSafeInteger(maxBytes) || maxBytes <= 0) {
      throw new TypeError('ByteTail: maxBytes must be a positive safe integer')
    }
    this.#maxBytes = maxBytes
  }


  get byteLength() {
    return this.#bytes
  }


  get maxBytes() {
    return this.#maxBytes
  }


  append(text) {
    if (typeof text !== 'string' || text.length === 0) return
    const bytes = utf8ByteLength(text)
    this.#parts.push({ text, bytes })
    this.#bytes += bytes
    this.#trim()
  }


  reset(text = '') {
    this.#parts = []
    this.#bytes = 0
    this.append(text)
  }


  clear() {
    this.#parts = []
    this.#bytes = 0
  }


  text() {
    if (this.#parts.length === 0) return ''
    if (this.#parts.length === 1) return this.#parts[0].text
    let out = ''
    for (const part of this.#parts) out += part.text
    return out
  }

  #trim() {
    const max = this.#maxBytes

    while (this.#bytes > max && this.#parts.length > 1) {
      const first = this.#parts[0]
      if (first.bytes <= this.#bytes - max) {
        this.#parts.shift()
        this.#bytes -= first.bytes
        continue
      }
      break
    }
    if (this.#bytes > max) {

      const first = this.#parts[0]
      const targetBytes = Math.max(0, first.bytes - (this.#bytes - max))
      const kept = targetBytes === 0 ? { text: '' } : tailByBytes(first.text, targetBytes)
      const keptBytes = utf8ByteLength(kept.text)
      this.#bytes -= first.bytes - keptBytes
      this.#parts[0] = { text: kept.text, bytes: keptBytes }
    }
  }
}
