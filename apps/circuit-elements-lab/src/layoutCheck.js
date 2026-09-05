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
  const { w = 320, h = 160, crop = null } = layout
  const { texts, bodies, wires, edges, problems } = collect(layout, elements, meters, show)

  const overlaps = (a, b) => a.x0 < b.x1 - margin && b.x0 < a.x1 - margin && a.y0 < b.y1 - margin && b.y0 < a.y1 - margin
  // A cropped layout is judged against its frame, not the canvas it was drawn
  // on: the frame is what the reader sees, so nothing may leave it either.
  const [fx0, fy0, fx1, fy1] = crop || [0, 0, w, h]
  const frame = crop ? `${fx1 - fx0}×${fy1 - fy0} frame` : `${w}×${h} canvas`
  const inside = (b) => b.x0 >= fx0 && b.y0 >= fy0 && b.x1 <= fx1 && b.y1 <= fy1
  const wireBox = (s) => ({
    x0: Math.min(s.x1, s.x2) - 0.75,
    x1: Math.max(s.x1, s.x2) + 0.75,
    y0: Math.min(s.y1, s.y2) - 0.75,
    y1: Math.max(s.y1, s.y2) + 0.75,
  })

  for (const t of texts) if (!inside(t.box)) problems.push(`${t.what} leaves the ${frame}`)
  for (const b of bodies) if (!inside(b.box)) problems.push(`${b.what} leaves the ${frame}`)
  for (const s of wires) if (!inside(wireBox(s))) problems.push(`${s.what} leaves the ${frame}`)
  for (const e of edges) if (!inside(e.box)) problems.push(`${e.what} leaves the ${frame}`)

  for (let a = 0; a < texts.length; a++) {
    for (let b = a + 1; b < texts.length; b++) {
      if (overlaps(texts[a].box, texts[b].box)) problems.push(`${texts[a].what} overlaps ${texts[b].what}`)
    }
    for (const body of bodies) {
      if (body.dot) continue
      if (texts[a].owner && body.owner === texts[a].owner) continue
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

/** Room around the drawing inside its frame, in canvas units. */
export const CROP_PAD = 6

/**
 * The face the headline's callout is drawn in.
 *
 * A caption on a layout is a note: 9 px in the sans stack, 5.2 px a
 * character. The callout is the same size at weight 600 (styles.css,
 * `.sch-callout`), and bold runs wider than that. Measuring it as a note
 * understated it by up to 9 px, which is a character and a half, so the
 * placer packed it against a neighbour and the browser drew it over the top:
 * on A1 the callout covered "R1 1 kΩ", on F3 it covered "C1 1 µF". Measured
 * in a browser over the stand-in of every headline in the lab, the widest
 * advance is 6.04 px a character ("P = −1.23 mW"); 6.2 sits a little above
 * it, as the label estimate in schematicGeometry.js sits above its widest
 * label.
 */
export const CALLOUT_FONT = { size: 9, cw: 6.2 }

/**
 * The frame a layout needs: the smallest box, padded by CROP_PAD, that holds
 * everything the Schematic would draw in any meter view, clamped to the canvas.
 *
 * Every layout is drawn on the same 420 × 180 canvas so that the placement
 * rules can be shared, but a one-element circuit fills a third of it and the
 * rest is empty frame on the reader's screen. The Schematic shows this box
 * instead. It must not move when a knob turns or the meters switch — a frame
 * that breathes with the numbers is a distraction — so every reading, and every
 * number in a label, is taken as its widest plausible text rather than the
 * live value: with 3 significant figures a signed value with its unit is at
 * most 8 characters ("−1.23 mV"). The layout test checks at random settings
 * that nothing ever leaves the frame.
 */
export function layoutExtent(layout, elements) {
  const { w = 320, h = 160 } = layout
  const widest = '−1.23 mV'
  const stand = { reading: () => widest, nodeMeter: () => widest, label: standInLabel }
  let box = null
  const grow = (b) => {
    box = box ? { x0: Math.min(box.x0, b.x0), y0: Math.min(box.y0, b.y0), x1: Math.max(box.x1, b.x1), y1: Math.max(box.y1, b.y1) } : { ...b }
  }
  for (const show of ['i', 'v', 'p']) {
    const { texts, bodies, wires, edges } = collect(layout, elements, {}, show, stand)
    for (const t of texts) grow(t.box)
    for (const b of bodies) grow(b.box)
    for (const e of edges) grow(e.box)
    for (const s of wires) grow({ x0: Math.min(s.x1, s.x2), x1: Math.max(s.x1, s.x2), y0: Math.min(s.y1, s.y2), y1: Math.max(s.y1, s.y2) })
  }
  if (!box) return [0, 0, w, h]
  return [
    Math.max(0, Math.floor(box.x0 - CROP_PAD)),
    Math.max(0, Math.floor(box.y0 - CROP_PAD)),
    Math.min(w, Math.ceil(box.x1 + CROP_PAD)),
    Math.min(h, Math.ceil(box.y1 + CROP_PAD)),
  ]
}

/**
 * Where a headline's callout ("R_eq = 6.00 kΩ") can sit beside the element or
 * node `where` without touching anything the layout draws in any meter view.
 *
 * Candidates ring the thing the number belongs to, nearest first — under a
 * horizontal element's label, beside a vertical one's, the side of a node its
 * name is not on — and each is tried as a caption of `text` against every
 * box the Schematic would draw with readings at their widest. Of the clean
 * ones, the first that stays inside the frame the drawing already needs wins;
 * failing that, the one that grows the frame least. Null when nothing fits.
 */
export function placeCallout(layout, elements, where, text) {
  const { w = 320, h = 160, items = [] } = layout
  const it = items.find((i) => i.el === where || i.node === where)
  if (!it) return null
  const widest = '−1.23 mV'
  const stand = { reading: () => widest, nodeMeter: () => widest, label: standInLabel }
  const taken = []
  let extent = null
  const grow = (b) => {
    extent = extent ? { x0: Math.min(extent.x0, b.x0), y0: Math.min(extent.y0, b.y0), x1: Math.max(extent.x1, b.x1), y1: Math.max(extent.y1, b.y1) } : { ...b }
  }
  for (const show of ['i', 'v', 'p']) {
    const { texts, bodies, wires, edges } = collect(layout, elements, {}, show, stand)
    for (const t of texts) taken.push(t.box)
    for (const b of bodies) taken.push(b.box)
    for (const e of edges) taken.push(e.box)
    for (const s of wires) taken.push({ x0: Math.min(s.x1, s.x2) - 0.75, x1: Math.max(s.x1, s.x2) + 0.75, y0: Math.min(s.y1, s.y2) - 0.75, y1: Math.max(s.y1, s.y2) + 0.75 })
  }
  for (const b of taken) grow(b)

  // The anchor point is the element's centre or the node's dot; for an
  // op-amp, the middle of the triangle. Candidates are a grid of baselines
  // around it, every 8 px across and 4 px down, with the text hung from its
  // start, middle or end, ranked by distance from the anchor.
  const isOpamp = it.el && elements.find((e) => e.id === it.el)?.type === 'OPAMP'
  const ax = isOpamp ? it.x + 19 : it.x
  const ay = it.y
  const candidates = []
  for (let dx = -48; dx <= 48; dx += 8) {
    for (let dy = -56; dy <= 120; dy += 4) {
      for (const anchor of ['middle', 'start', 'end']) candidates.push({ x: ax + dx, y: ay + dy, anchor, d: Math.hypot(dx, dy) })
    }
  }
  candidates.sort((a, b) => a.d - b.d)

  const margin = 1
  const overlaps = (a, b) => a.x0 < b.x1 - margin && b.x0 < a.x1 - margin && a.y0 < b.y1 - margin && b.y0 < a.y1 - margin
  let best = null
  for (const at of candidates) {
    const box = G.textBox(at, text.length * CALLOUT_FONT.cw, CALLOUT_FONT.size)
    if (box.x0 < CROP_PAD || box.y0 < CROP_PAD || box.x1 > w - CROP_PAD || box.y1 > h - CROP_PAD) continue
    if (taken.some((b) => overlaps(box, b))) continue
    const union = {
      x0: Math.min(extent.x0, box.x0), y0: Math.min(extent.y0, box.y0), x1: Math.max(extent.x1, box.x1), y1: Math.max(extent.y1, box.y1),
    }
    const growth = (union.x1 - union.x0) * (union.y1 - union.y0) - (extent.x1 - extent.x0) * (extent.y1 - extent.y0)
    if (growth === 0) return { x: at.x, y: at.y, anchor: at.anchor }
    if (!best || growth < best.growth) best = { x: at.x, y: at.y, anchor: at.anchor, growth }
  }
  return best ? { x: best.x, y: best.y, anchor: best.anchor } : null
}

/**
 * An element's label with every value in it at its widest — "R1 1 kΩ" becomes
 * "R1 −1.23 mV", "V1 1 V sine · 1 kHz" becomes "V1 −1.23 mV sine · −1.23 mV",
 * a switch always reads "closed" — so the label's width does not depend on the
 * settings. Exported for the test that pins these examples.
 */
export function standInLabel(e) {
  const text = G.valueText(e)
  const id = text.startsWith(e.id) ? e.id : ''
  const rest = text
    .slice(id.length)
    .replace(/[-−]?\d[\d.]*(\s?[A-Za-zµΩ]+)?/g, '−1.23 mV')
    .replace(/\bopens?\b/, 'closes') // "open"/"closed", "opens at 0"/"closes at 0"
  return id + rest
}

/**
 * Everything a layout draws, as boxes: `texts` (labels, readings, node names,
 * captions, +/− marks), `bodies` (symbols, node dots, grounds), `wires`, and
 * `edges` (the four sides of each dashed frame). `stand` substitutes stand-in
 * text for the live readings — the extent above needs the widest case, the
 * checker the real one.
 */
function collect(layout, elements, meters, show, stand = null) {
  const byId = new Map(elements.map((e) => [e.id, e]))
  const { items = [] } = layout
  const texts = [] // { box, what }
  const bodies = [] // { box, what }
  const wires = [] // { x1, y1, x2, y2, what }
  const edges = [] // { box, what } — the four sides of each dashed frame
  const problems = []

  const addText = (place, text, font, what, owner = null) => {
    if (!text) return
    texts.push({ box: G.textBox(place, text.length * font.cw, font.size), what: `${what} “${text}”`, owner })
  }
  const readingOf = (e) => (stand ? stand.reading(e) : G.elementReading(e, meters, show))
  const labelOf = (e) => (stand ? stand.label(e) : G.valueText(e))
  const nodeMeterOf = (name) => {
    if (stand) return stand.nodeMeter(name)
    const volts = meters ? meters.v[name] : undefined
    return Number.isFinite(volts) ? fmt(volts, 'V', 3) : ''
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
      const place = G.nodeTextPlace(it)
      const meter = nodeMeterOf(it.node)
      const width = it.node.length * G.FONT.port.cw + (meter ? 4 + meter.length * G.FONT.meter.cw : 0)
      texts.push({ box: G.textBox(place, width, G.FONT.port.size), what: `node label “${it.node} ${meter}”` })
      bodies.push({ box: { x0: it.x - 3, x1: it.x + 3, y0: it.y - 3, y1: it.y + 3 }, what: `node dot ${it.node}`, dot: true })
    } else if (it.text) {
      addText({ x: it.x, y: it.y, anchor: it.anchor || 'middle' }, it.text, it.callout ? CALLOUT_FONT : G.FONT.note, it.callout ? 'callout' : 'caption')
    } else if (it.el) {
      const e = byId.get(it.el)
      if (!e) {
        problems.push(`layout draws ${it.el}, which is not in the netlist`)
        continue
      }
      const reading = readingOf(e)
      if (e.type === 'OPAMP') {
        bodies.push({ box: G.opampBodyBox(it), what: `op-amp ${e.id}` })
        const at = G.opampTextPlaces(it)
        addText(at.label, labelOf(e), G.FONT.label, `${e.id} label`)
        addText(at.reading, reading, G.FONT.meter, `${e.id} reading`)
      } else {
        const arrow = show === 'i' && !!reading
        for (const box of G.elementBodyBoxes(it, e, arrow)) bodies.push({ box, what: `${e.id} symbol`, owner: e.id })
        const at = G.elementTextPlaces(it)
        addText(at.label, labelOf(e), G.FONT.label, `${e.id} label`)
        addText(at.reading, reading, G.FONT.meter, `${e.id} reading`)
        // The + and − marks sit at the element's own terminals, so they may
        // touch its own symbol; anything else they land on is a collision.
        if (show === 'v' && (meters || stand)) {
          const signs = G.signPlaces(it)
          addText(signs.plus, '+', G.FONT.sign, `${e.id} + mark`, e.id)
          addText(signs.minus, '−', G.FONT.sign, `${e.id} − mark`, e.id)
        }
      }
    }
  }
  return { texts, bodies, wires, edges, problems }
}
