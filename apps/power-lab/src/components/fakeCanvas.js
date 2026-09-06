// A 2D context that remembers what was asked of it, for testing pure drawing
// functions without a browser: every method call is recorded with its
// arguments, every property set is accepted, and text measures at a fixed
// width per character.
//
// Each call also carries the alignment in force when it was made, because a
// fillText's x and y say where the text is anchored and not where it sits.
// Asking whether two labels overlap needs the box, and the box needs the
// alignment (REVIEW_PLAYBOOK.md class 6, occlusion).

const CHAR = 7

export function fakeCtx() {
  const calls = []
  const state = {}
  const ctx = new Proxy(
    {},
    {
      get(_, name) {
        if (name === 'calls') return calls
        if (name === 'measureText') return (t) => ({ width: String(t).length * CHAR })
        if (name in state) return state[name]
        return (...args) => {
          calls.push({ name, args, align: state.textAlign, baseline: state.textBaseline, font: state.font, fill: state.fillStyle })
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
export const texts = (ctx) =>
  ctx.calls
    .filter((c) => c.name === 'fillText')
    .map((c) => ({ text: String(c.args[0]), x: c.args[1], y: c.args[2], align: c.align, baseline: c.baseline, font: c.font, fill: c.fill }))

/**
 * The rectangle a drawn string covers, from its anchor and the alignment in
 * force. The height is the font's own size, which is what a line of this text
 * occupies.
 */
export function textBox(t) {
  const w = t.text.length * CHAR
  const size = Number((/(\d+(?:\.\d+)?)px/.exec(t.font || '') || [0, 11])[1])
  const x0 = t.align === 'right' ? t.x - w : t.align === 'center' ? t.x - w / 2 : t.x
  const y0 = t.baseline === 'bottom' ? t.y - size : t.baseline === 'middle' ? t.y - size / 2 : t.y
  return { x0, x1: x0 + w, y0, y1: y0 + size }
}

/** Whether two drawn strings share any pixels. */
export const overlaps = (a, b) => {
  const p = textBox(a)
  const q = textBox(b)
  return p.x0 < q.x1 && p.x1 > q.x0 && p.y0 < q.y1 && p.y1 > q.y0
}
