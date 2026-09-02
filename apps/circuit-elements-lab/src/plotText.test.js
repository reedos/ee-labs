import { describe, it, expect } from 'vitest'
import { clearRow, drawEndLabels, frameArea, overlapping, placeLabels, textBox, trackText } from './components/timePlot.js'

// The text on a chart never covers other text (student review, Phase 7). The
// canvases keep that promise with three small pieces — a box per fillText, a
// pair-finder over the boxes, a resolver that moves labels clear of one
// another and of the marks — and this file holds each piece to its promise
// with a fake 2-D context: monospace-ish measureText, a settable transform.
// verify.mjs then reads the real boxes back from the browser on every chart.

function fakeCtx({ dpr = 1, rotate = false } = {}) {
  const calls = []
  const ctx = {
    canvas: {},
    font: '11px x',
    textAlign: 'left',
    textBaseline: 'alphabetic',
    fillStyle: '#000',
    globalAlpha: 1,
    measureText: (s) => ({ width: 0.6 * parseFloat(ctx.font) * String(s).length }),
    getTransform: () => (rotate ? { a: 0, b: -dpr, c: dpr, d: 0, e: 0, f: 0 } : { a: dpr, b: 0, c: 0, d: dpr, e: 0, f: 0 }),
    fillText: (text, x, y) => calls.push({ text, x, y }),
    fillRect: () => {},
    save: () => {},
    restore: () => {},
    calls,
  }
  return ctx
}

describe('the box a piece of text covers', () => {
  it('is its measured width by its font size, placed by the alignment and baseline in force', () => {
    const ctx = fakeCtx()
    ctx.font = '10px x'
    ctx.textAlign = 'right'
    ctx.textBaseline = 'middle'
    const b = textBox(ctx, 'abcd', 100, 50)
    expect(b.x1).toBeCloseTo(100)
    expect(b.x0).toBeCloseTo(100 - 24)
    expect(b.y0).toBeCloseTo(45)
    expect(b.y1).toBeCloseTo(55)
    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'
    const c = textBox(ctx, 'ab', 100, 50)
    expect([c.x0, c.x1, c.y0, c.y1].map((v) => Math.round(v))).toEqual([94, 106, 50, 60])
    expect(textBox(ctx, '   ', 0, 0)).toBeNull()
  })

  it('comes out in CSS pixels whatever the device scale, and follows a rotation', () => {
    const ctx = fakeCtx({ dpr: 2 })
    trackText(ctx)
    expect(ctx.canvas.__dpr).toBe(2)
    ctx.textBaseline = 'top'
    const b = textBox(ctx, 'abcd', 10, 20)
    // The transform doubles every coordinate; dividing by the recorded dpr undoes it.
    expect(b.x0).toBeCloseTo(10)
    expect(b.x1).toBeCloseTo(10 + 26.4)
    expect(b.y0).toBeCloseTo(20)
    expect(b.y1).toBeCloseTo(31)
    const r = fakeCtx({ rotate: true })
    trackText(r)
    r.textAlign = 'center'
    r.textBaseline = 'middle'
    const t = textBox(r, 'abcdef', 0, 0) // an axis title, drawn at the rotated origin
    expect(t.x1 - t.x0).toBeCloseTo(11) // tall and narrow: the font size across…
    expect(t.y1 - t.y0).toBeCloseTo(39.6) // …and the measured width down
  })

  it('trackText records every fillText as a box and starts each draw with an empty list', () => {
    const ctx = fakeCtx()
    trackText(ctx)
    ctx.fillText('one', 10, 10)
    ctx.fillText('two', 50, 10)
    ctx.fillText('  ', 90, 10)
    expect(ctx.canvas.__texts.map((b) => b.text)).toEqual(['one', 'two'])
    expect(ctx.calls.length).toBe(3) // the underlying fillText still runs
    trackText(ctx)
    expect(ctx.canvas.__texts).toEqual([])
    ctx.fillText('three', 10, 10)
    expect(ctx.canvas.__texts.length).toBe(1) // wrapped once, not twice
  })
})

describe('finding overlaps', () => {
  const box = (x0, y0, x1, y1, text) => ({ x0, y0, x1, y1, text })
  it('reports each pair whose boxes intersect once shrunk by the tolerance, and nothing else', () => {
    const a = box(0, 0, 40, 10, 'a')
    const b = box(30, 5, 70, 15, 'b') // overlaps a
    const c = box(39.5, 0, 80, 10, 'c') // touches a within 1 px: not an overlap
    const d = box(0, 10, 40, 20, 'd') // shares an edge with a
    const pairs = overlapping([a, b, c, d])
    expect(pairs.map(([p, q]) => p.text + q.text)).toEqual(['ab', 'bc', 'bd'])
    expect(overlapping([a, c], 0).length).toBe(1)
  })
})

describe('placing labels', () => {
  const item = (y, x0 = 100, x1 = 160, h = 13) => ({ x0, x1, y, h })

  it('leaves labels that already sit clear where they asked to be', () => {
    expect(placeLabels([item(20), item(60)], [], 0, 100)).toEqual([20, 60])
  })

  it('pushes labels that share a column apart to the gap, keeps their order, and never moves ones that do not share it', () => {
    const ys = placeLabels([item(50), item(52), item(51, 300, 340)], [], 0, 200, 2)
    expect(ys[1] - ys[0]).toBeCloseTo(15)
    expect(ys[2]).toBe(51)
    expect((ys[0] + ys[1]) / 2).toBeCloseTo(51) // spread about where they were
  })

  it('keeps every label inside the frame, even when the frame is too short for all of them', () => {
    const ys = placeLabels([item(2), item(3), item(4)], [], 0, 60)
    for (const y of ys) {
      expect(y - 6.5).toBeGreaterThanOrEqual(-1e-9)
      expect(y + 6.5).toBeLessThanOrEqual(60 + 1e-9)
    }
    expect(Math.max(...ys) - Math.min(...ys)).toBeGreaterThanOrEqual(2 * 15 - 1e-3) // converges to within a thousandth of a pixel
  })

  it('moves a label off an obstacle the shorter way, and the long way when the short way leaves the frame', () => {
    const mark = { x0: 90, y0: 40, x1: 200, y1: 52, text: 'E = 5 V' }
    const [y] = placeLabels([item(44)], [mark], 0, 200)
    expect(y + 6.5).toBeLessThanOrEqual(40 - 2 + 1e-9) // up and clear of it
    const [y2] = placeLabels([item(48)], [mark], 0, 200)
    expect(y2 - 6.5).toBeGreaterThanOrEqual(52 + 2 - 1e-9) // down: the closer way
    const [y3] = placeLabels([item(44)], [mark], 40, 200) // no room above
    expect(y3 - 6.5).toBeGreaterThanOrEqual(54 - 1e-9)
    const [y4] = placeLabels([item(44, 300, 340)], [mark], 0, 200) // beside, not over
    expect(y4).toBe(44)
  })

  it('a label between two marks’ names, with no room between them, settles clear of both instead of bouncing', () => {
    // F3 at the 63.2 % instant: the ring's name above the dot, the tangent's name below it, 13 px apart.
    const above = { x0: 395, y0: 86.5, x1: 531, y1: 100.5 }
    const below = { x0: 257, y0: 113.5, x1: 453, y1: 127.5 }
    const [y] = placeLabels([item(108.65, 395, 434, 16.7)], [above, below], 14, 300)
    const box = { x0: 395, x1: 434, y0: y - 8.35, y1: y + 8.35 }
    expect(overlapping([box, above, below], 0)).toEqual([])
    expect(Math.abs(y - 108.65)).toBeLessThan(40) // the nearest clear row, not the far side of the frame
  })

  it('resolves a crowd: several labels and several obstacles end with no pair overlapping', () => {
    const items = [item(30), item(31), item(35), item(70), item(72), item(200, 120, 180)]
    const obstacles = [
      { x0: 80, y0: 60, x1: 220, y1: 72 },
      { x0: 80, y0: 190, x1: 220, y1: 204 },
    ]
    const ys = placeLabels(items, obstacles, 0, 300)
    const boxes = items.map((it, i) => ({ x0: it.x0, x1: it.x1, y0: ys[i] - it.h / 2, y1: ys[i] + it.h / 2, text: `#${i}` }))
    expect(overlapping([...boxes, ...obstacles], 0)).toEqual([])
    for (const b of boxes) {
      expect(b.y0).toBeGreaterThanOrEqual(-1e-9)
      expect(b.y1).toBeLessThanOrEqual(300 + 1e-9)
    }
  })
})

describe('a single label stepping clear', () => {
  it('keeps its row when nothing is there, steps below what it would cover, and above when the frame ends below', () => {
    const ctx = fakeCtx()
    trackText(ctx)
    ctx.font = '10px x'
    ctx.textBaseline = 'bottom'
    ctx.fillText('f₀', 796, 37) // a time mark's name: box y 27..37
    expect(clearRow(ctx, 'free', 100, 60, 14, 300)).toBe(60)
    // A curve's name at the peak, y 26..36, would cover it: it steps to just below.
    const y = clearRow(ctx, 'peaking at Q at f₀', 800, 36, 14, 300)
    expect(y - 10).toBeCloseTo(37 + 2)
    // With the frame ending right under the mark's name, it steps above instead.
    const up = clearRow(ctx, 'peaking at Q at f₀', 800, 36, 14, 40)
    expect(up).toBeCloseTo(27 - 2)
    // Two names stacked: it steps over both.
    ctx.fillText('second', 800, 50) // y 40..50
    const twice = clearRow(ctx, 'peaking at Q at f₀', 800, 36, 14, 300)
    expect(twice - 10).toBeCloseTo(52)
  })
})

describe('naming the series at their ends', () => {
  it('draws a right-aligned label per series on the frame’s right edge, clear of one another and of the texts already on the canvas', () => {
    const ctx = fakeCtx()
    trackText(ctx)
    const area = { x: 84, y: 14, w: 500, h: 300, k: 1 }
    // A mark label already drawn where the second series ends.
    ctx.font = '11px x'
    ctx.textBaseline = 'middle'
    ctx.fillText('V_th = 6.00 V', 420, 150)
    const rows = drawEndLabels(ctx, area, [
      { label: 'v_A', color: '#111', y: 150 },
      { label: 'v_B', color: '#222', y: 153 },
      { label: 'i_L (own scale)', color: '#333', y: 290, dim: true },
      { label: 'off', color: '#444', y: NaN },
    ], [{ label: '4.20 V', color: '#555', x: 300, y: 151 }])
    expect(rows.length).toBe(4) // three labels and the pinned value; the NaN one skipped
    const boxes = ctx.canvas.__texts
    expect(boxes.map((b) => b.text)).toEqual(['V_th = 6.00 V', 'v_A', 'v_B', 'i_L (own scale)', '4.20 V'])
    expect(overlapping(boxes)).toEqual([])
    for (const b of boxes.slice(1)) {
      expect(b.x1).toBeLessThanOrEqual(area.x + area.w)
      expect(b.y0).toBeGreaterThanOrEqual(area.y)
      expect(b.y1).toBeLessThanOrEqual(area.y + area.h)
    }
    // End labels hug the right edge; the pinned value sits beside its dot.
    expect(boxes[1].x1).toBeCloseTo(area.x + area.w - 4)
    expect(boxes[4].x0).toBeCloseTo(308)
  })

  it('puts a pinned value to the left of a dot that is near the right edge', () => {
    const ctx = fakeCtx()
    trackText(ctx)
    const area = { x: 84, y: 14, w: 500, h: 300, k: 1 }
    drawEndLabels(ctx, area, [], [{ label: '4.20 V', color: '#555', x: 570, y: 100 }])
    const [b] = ctx.canvas.__texts
    expect(b.x1).toBeLessThanOrEqual(570 - 8 + 1e-9)
  })
})

describe('the frame’s gutters', () => {
  it('leave room on the left for a seven-character tick label clear of the rotated axis title, at every scale', () => {
    for (const w of [360, 600, 1150, 2600]) {
      const a = frameArea(w, 400)
      const k = a.k
      const tick = 7 * 0.6 * 11 * k // "−100 mV" in the 11k mono tick face
      const tickLeft = a.x - 8 * k - tick
      const titleRight = 18 * k + 6 * k // the title is rotated about x = 18k, 12k tall
      expect(tickLeft, `w = ${w}`).toBeGreaterThanOrEqual(titleRight)
      const r = frameArea(w, 400, { rightAxis: true })
      expect(r.x).toBe(a.x)
      expect(a.w - r.w).toBeCloseTo(6 * k + 46 * k) // the second axis's 64k gutter, plus 6k
    }
  })
})
