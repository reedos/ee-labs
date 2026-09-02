// A 2D context that remembers what was asked of it, for testing pure drawing
// functions without a browser: every method call is recorded with its
// arguments, every property set is accepted, and text measures at a fixed
// width per character.

export function fakeCtx() {
  const calls = []
  const state = {}
  const ctx = new Proxy(
    {},
    {
      get(_, name) {
        if (name === 'calls') return calls
        if (name === 'measureText') return (t) => ({ width: String(t).length * 7 })
        if (name in state) return state[name]
        return (...args) => {
          calls.push({ name, args })
        }
      },
      set(_, name, value) {
        state[name] = value
        return true
      },
    },
  )
  return ctx
}

/** Every string drawn with fillText, with where it was drawn. */
export const texts = (ctx) => ctx.calls.filter((c) => c.name === 'fillText').map((c) => ({ text: String(c.args[0]), x: c.args[1], y: c.args[2] }))
