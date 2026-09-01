import { fmt, schematicGeometry as G } from '@ee-labs/ui'

/**
 * Does a schematic layout draw cleanly?
 *
 * The first screenshots of this lab had a source's reading clipped off the
 * left edge and one resistor's label sitting on its neighbour's reading —
 * and every browser probe had passed, because a probe reads the DOM and the
 * DOM was fine. So the geometry is checked as geometry: every text box,
 * symbol, wire and ground symbol the Schematic would draw is listed, using
 * the same placement rules the component uses, and no text may overlap
 * anything else, no wire may cross another wire or run through a symbol
 * without meeting it at its end, nothing may straddle a dashed frame's edge,
 * and nothing may leave the canvas.
 *
 * Returns a list of problems, each a sentence; an empty list is a clean
 * drawing. `meters` and `show` matter because readings are the widest text
 * a diagram carries and only appear once the circuit is solved.
 */
export function layoutProblems(layout, elements, meters, show = 'i', margin = 1) {
  const byId = new Map(elements.map((e) => [e.id, e]))
  const { w = 320, h = 160, items = [] } = layout
  const texts = [] // { box, what }
  const bodies = [] // { box, what }
  const wires = [] // { x1, y1, x2, y2, what }
  const edges = [] // { box, what } — the four sides of each dashed frame
  const problems = []

  const addText = (place, text, font, what) => {
    if (!text) return
    texts.push({ box: G.textBox(place, text.length * font.cw, font.size), what: `${what} “${text}”` })
  }

  for (const it of items) {
    if (it.box) {
      // Wires may cross a frame — that is how the device connects — but no text
      // or symbol may straddle its edge, or the drawing lies about what is inside.
      const [x0, y0, x1, y1] = it.box
      const what = `frame (${x0},${y0})–(${x1},${y1})`
      edges.push(
        { box: { x0: x0 - 0.5, x1: x0 + 0.5, y0, y1 }, what },
        { box: { x0: x1 - 0.5, x1: x1 + 0.5, y0, y1 }, what },
        { box: { x0, x1, y0: y0 - 0.5, y1: y0 + 0.5 }, what },
        { box: { x0, x1, y0: y1 - 0.5, y1: y1 + 0.5 }, what },
      )
    } else if (it.wire) {
      const [x1, y1, x2, y2] = it.wire
      wires.push({ x1, y1, x2, y2, what: `wire (${x1},${y1})→(${x2},${y2})` })
    } else if (it.gnd) {
      bodies.push({ box: G.gndBox(it.gnd), what: `ground at (${it.gnd[0]},${it.gnd[1]})` })
    } else if (it.node) {
      const volts = meters ? meters.v[it.node] : undefined
      const place = G.nodeTextPlace(it)
      const meter = Number.isFinite(volts) ? fmt(volts, 'V', 3) : ''
      const width = it.node.length * G.FONT.port.cw + (meter ? 4 + meter.length * G.FONT.meter.cw : 0)
      texts.push({ box: G.textBox(place, width, G.FONT.port.size), what: `node label “${it.node} ${meter}”` })
      bodies.push({ box: { x0: it.x - 3, x1: it.x + 3, y0: it.y - 3, y1: it.y + 3 }, what: `node dot ${it.node}`, dot: true })
    } else if (it.text) {
      addText({ x: it.x, y: it.y, anchor: it.anchor || 'middle' }, it.text, G.FONT.note, 'caption')
    } else if (it.el) {
      const e = byId.get(it.el)
      if (!e) {
        problems.push(`layout draws ${it.el}, which is not in the netlist`)
        continue
      }
      const reading = G.elementReading(e, meters, show)
      if (e.type === 'OPAMP') {
        bodies.push({ box: G.opampBodyBox(it), what: `op-amp ${e.id}` })
        const at = G.opampTextPlaces(it)
        addText(at.label, G.valueText(e), G.FONT.label, `${e.id} label`)
        addText(at.reading, reading, G.FONT.meter, `${e.id} reading`)
      } else {
        const arrow = show === 'i' && !!reading
        for (const box of G.elementBodyBoxes(it, e, arrow)) bodies.push({ box, what: `${e.id} symbol` })
        const at = G.elementTextPlaces(it)
        addText(at.label, G.valueText(e), G.FONT.label, `${e.id} label`)
        addText(at.reading, reading, G.FONT.meter, `${e.id} reading`)
      }
    }
  }

  const overlaps = (a, b) => a.x0 < b.x1 - margin && b.x0 < a.x1 - margin && a.y0 < b.y1 - margin && b.y0 < a.y1 - margin
  const inside = (b) => b.x0 >= 0 && b.y0 >= 0 && b.x1 <= w && b.y1 <= h
  const wireBox = (s) => ({
    x0: Math.min(s.x1, s.x2) - 0.75,
    x1: Math.max(s.x1, s.x2) + 0.75,
    y0: Math.min(s.y1, s.y2) - 0.75,
    y1: Math.max(s.y1, s.y2) + 0.75,
  })

  for (const t of texts) if (!inside(t.box)) problems.push(`${t.what} leaves the ${w}×${h} canvas`)
  for (const b of bodies) if (!inside(b.box)) problems.push(`${b.what} leaves the ${w}×${h} canvas`)
  for (const s of wires) if (!inside(wireBox(s))) problems.push(`${s.what} leaves the ${w}×${h} canvas`)
  for (const e of edges) if (!inside(e.box)) problems.push(`${e.what} leaves the ${w}×${h} canvas`)

  for (let a = 0; a < texts.length; a++) {
    for (let b = a + 1; b < texts.length; b++) {
      if (overlaps(texts[a].box, texts[b].box)) problems.push(`${texts[a].what} overlaps ${texts[b].what}`)
    }
    for (const body of bodies) {
      if (body.dot) continue
      if (overlaps(texts[a].box, body.box)) problems.push(`${texts[a].what} sits on ${body.what}`)
    }
    for (const s of wires) {
      if (overlaps(texts[a].box, wireBox(s))) problems.push(`${texts[a].what} sits on the ${s.what}`)
    }
    for (const e of edges) {
      if (overlaps(texts[a].box, e.box)) problems.push(`${texts[a].what} sits on the ${e.what}`)
    }
  }
  for (const body of bodies) {
    for (const e of edges) {
      if (overlaps(body.box, e.box)) problems.push(`${body.what} straddles the ${e.what}`)
    }
  }

  // A wire may end on a symbol's edge (that is how it connects) but not pass
  // through its interior.
  const shrink = (b, d) => ({ x0: b.x0 + d, x1: b.x1 - d, y0: b.y0 + d, y1: b.y1 - d })
  for (const s of wires) {
    for (const body of bodies) {
      if (body.dot) continue
      if (overlaps(wireBox(s), shrink(body.box, 1.5))) problems.push(`${s.what} runs through ${body.what}`)
    }
  }

  // Two wires crossing without either ending there is an unmarked junction
  // or, worse, a drawing that lies about what is connected.
  const vertical = (s) => s.x1 === s.x2
  for (let a = 0; a < wires.length; a++) {
    for (let b = a + 1; b < wires.length; b++) {
      const p = wires[a]
      const q = wires[b]
      if (vertical(p) === vertical(q)) continue
      const v = vertical(p) ? p : q
      const hz = vertical(p) ? q : p
      const [vy0, vy1] = [Math.min(v.y1, v.y2), Math.max(v.y1, v.y2)]
      const [hx0, hx1] = [Math.min(hz.x1, hz.x2), Math.max(hz.x1, hz.x2)]
      if (v.x1 > hx0 && v.x1 < hx1 && hz.y1 > vy0 && hz.y1 < vy1) problems.push(`${p.what} crosses ${q.what}`)
    }
  }

  return [...new Set(problems)]
}
