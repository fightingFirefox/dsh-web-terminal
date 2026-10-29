// Idle watchdog: flags command terminals that stop producing output.
export class IdleWatchdog {
  #timers = new Map()
  #idleMs
  #onHung

  constructor(options = {}) {
    this.#idleMs = Number.isInteger(options.idleMs) ? options.idleMs : 0
    this.#onHung = typeof options.onHung === 'function' ? options.onHung : () => {}
  }

  get enabled() {
    return this.#idleMs > 0
  }

  watch(session) {
    if (!this.enabled) return
    if (session.kind !== 'command') return
    this.#arm(session)
  }

  touch(session) {
    if (!this.enabled) return
    if (!this.#timers.has(session.id)) return
    if (session.hung === true) {
      session.hung = false
      this.#onHung(session, false)
    }
    this.#arm(session)
  }

  stop(id) {
    const timer = this.#timers.get(id)
    if (timer !== undefined) clearTimeout(timer)
    this.#timers.delete(id)
  }

  dispose() {
    for (const timer of this.#timers.values()) clearTimeout(timer)
    this.#timers.clear()
  }

  #arm(session) {
    this.stop(session.id)
    const timer = setTimeout(() => {
      this.#timers.delete(session.id)
      if (session.state !== 'running') return
      session.hung = true
      this.#onHung(session, true)
    }, this.#idleMs)
    if (typeof timer.unref === 'function') timer.unref()
    this.#timers.set(session.id, timer)
  }
}
