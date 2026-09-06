// Where each machine's circuit is drawn.
//
// `packages/ui`'s Schematic draws from data. An element symbol occupies the
// segment 20 either side of its centre, so a wire runs from one element's edge
// to the next one's. These layouts follow that idiom, and each one returns the
// SUBSET of the solved netlist a reader should see. The sense branch of
// `port.js` is not in any of them, because it has no voltage and no current of
// its own. Its two elements are replaced by the wire they are equivalent to.

const pick = (net, ids) => ids.map((id) => net.elements.find((e) => e.id === id)).filter(Boolean)

/** The DC machine's armature loop. The shaft is drawn beside it, not in it. */
export function dcDraw(x) {
  const net = x.net
  const elements = pick(net, ['Va', 'Ra', 'La', 'Vemf']).map((e) =>
    e.id === 'Vemf' ? { ...e, label: 'V_emf = k·ω' } : e,
  )
  return {
    elements,
    layout: {
      w: 420,
      h: 180,
      crop: [10, 10, 410, 172],
      items: [
        { el: 'Va', x: 50, y: 90, dir: 'v', label: `Va ${x.spec.Va.toPrecision(3)} V` },
        { wire: [50, 40, 50, 70] },
        { wire: [50, 110, 50, 140] },
        { wire: [50, 40, 120, 40] },
        { el: 'Ra', x: 140, y: 40, dir: 'h' },
        { wire: [160, 40, 210, 40] },
        { el: 'La', x: 230, y: 40, dir: 'h' },
        { wire: [250, 40, 340, 40] },
        { wire: [340, 40, 340, 70] },
        { el: 'Vemf', x: 340, y: 90, dir: 'v' },
        { wire: [340, 110, 340, 140] },
        { wire: [50, 140, 340, 140] },
        { gnd: [50, 140] },
        { node: 'arm', x: 50, y: 40, side: 't' },
        { node: 'n1', x: 185, y: 40, side: 't' },
        { node: 'n2', x: 340, y: 40, side: 'r' },
        { node: 'n3', x: 340, y: 140, side: 'r' },
        { text: 'armature', x: 195, y: 22 },
      ],
    },
  }
}

/** The transformer, at whichever stage the experiment has reached. */
export function transformerDraw(x) {
  const net = x.net
  const stage = x.spec.stage || 'full'
  const ideal = { ...net.elements.find((e) => e.id === 'T1.Es'), label: `ideal ${x.spec.n}:1` }
  const items = [
    { el: 'Vs', x: 40, y: 105, dir: 'v', label: `Vs ${x.spec.Vp} V` },
    { wire: [40, 50, 40, 85] },
    { wire: [40, 125, 40, 160] },
  ]
  const elements = [net.elements.find((e) => e.id === 'Vs')]
  let xEnd = 40
  if (stage !== 'ideal') {
    elements.push(...pick(net, ['R1', 'X1']))
    items.push({ wire: [40, 50, 80, 50] }, { el: 'R1', x: 100, y: 50, dir: 'h' })
    items.push({ wire: [120, 50, 160, 50] }, { el: 'X1', x: 180, y: 50, dir: 'h' })
    xEnd = 200
  }
  if (stage === 'full') {
    elements.push(...pick(net, ['Rc', 'Xm']))
    items.push({ wire: [xEnd, 50, 240, 50] })
    items.push({ wire: [240, 50, 240, 85] }, { el: 'Rc', x: 240, y: 105, dir: 'v' })
    items.push({ wire: [240, 125, 240, 160] })
    items.push({ wire: [240, 50, 290, 50] }, { wire: [290, 50, 290, 85] })
    items.push({ el: 'Xm', x: 290, y: 105, dir: 'v' }, { wire: [290, 125, 290, 160] })
    xEnd = 290
  }
  elements.push(ideal)
  items.push({ wire: [xEnd, 50, 350, 50] }, { wire: [350, 50, 350, 85] })
  items.push({ el: 'T1.Es', x: 350, y: 105, dir: 'v' }, { wire: [350, 125, 350, 160] })
  items.push({ box: [326, 70, 374, 140] })
  let out = 380
  if (stage !== 'ideal') {
    elements.push(...pick(net, ['R2', 'X2']))
    items.push({ wire: [350, 50, 400, 50] }, { el: 'R2', x: 420, y: 50, dir: 'h' })
    items.push({ wire: [440, 50, 470, 50] }, { el: 'X2', x: 490, y: 50, dir: 'h' })
    out = 510
  } else {
    items.push({ wire: [350, 50, 510, 50] })
  }
  elements.push(net.elements.find((e) => e.id === 'RL'))
  items.push({ wire: [out, 50, 540, 50] }, { wire: [540, 50, 540, 85] })
  items.push({ el: 'RL', x: 540, y: 105, dir: 'v' }, { wire: [540, 125, 540, 160] })
  items.push({ wire: [40, 160, 540, 160] }, { gnd: [40, 160] })
  items.push({ text: 'primary', x: 120, y: 26 }, { text: 'secondary', x: 460, y: 26 })
  return { elements: elements.filter(Boolean), layout: { w: 580, h: 190, crop: [10, 14, 570, 178], items } }
}

/** The induction machine's per-phase equivalent circuit. */
export function perPhaseDraw(x) {
  const net = x.net
  const has = (id) => !!net.elements.find((e) => e.id === id)
  const ids = ['V1', 'R1', 'X1', 'Xm', 'X2', 'R2s'].concat(has('Rc') ? ['Rc'] : [])
  const elements = pick(net, ids).map((e) =>
    e.id === 'R2s' ? { ...e, label: `R₂/s ${e.value.toPrecision(4)} Ω` } : e,
  )
  const items = [
    { el: 'V1', x: 40, y: 105, dir: 'v', label: 'V₁ per phase' },
    { wire: [40, 50, 40, 85] },
    { wire: [40, 125, 40, 160] },
    { wire: [40, 50, 80, 50] },
    { el: 'R1', x: 100, y: 50, dir: 'h' },
    { wire: [120, 50, 160, 50] },
    { el: 'X1', x: 180, y: 50, dir: 'h' },
    { wire: [200, 50, 300, 50] },
    { wire: [250, 50, 250, 85] },
    { el: 'Xm', x: 250, y: 105, dir: 'v' },
    { wire: [250, 125, 250, 160] },
    { wire: [300, 50, 340, 50] },
    { el: 'X2', x: 360, y: 50, dir: 'h' },
    { wire: [380, 50, 430, 50] },
    { wire: [430, 50, 430, 85] },
    { el: 'R2s', x: 430, y: 105, dir: 'v' },
    { wire: [430, 125, 430, 160] },
    { wire: [40, 160, 430, 160] },
    { gnd: [40, 160] },
    { node: 'g', x: 300, y: 50, side: 't' },
    { text: 'stator', x: 130, y: 26 },
    { text: 'rotor, referred', x: 380, y: 26 },
  ]
  if (has('Rc')) {
    items.splice(9, 0, { wire: [205, 50, 205, 85] }, { el: 'Rc', x: 205, y: 105, dir: 'v' }, { wire: [205, 125, 205, 160] })
  }
  return { elements, layout: { w: 470, h: 190, crop: [10, 14, 460, 178], items } }
}

/** The thermal model, which is an R and a C with the loss as a current. */
export function thermalDraw(x) {
  return {
    elements: x.net.elements.map((e) =>
      e.id === 'Ploss' ? { ...e, label: `P_loss ${x.split.loss.toPrecision(4)} W` } : e,
    ),
    layout: {
      w: 320,
      h: 180,
      crop: [10, 20, 310, 172],
      items: [
        { el: 'Ploss', x: 60, y: 90, dir: 'v' },
        { wire: [60, 40, 60, 70] },
        { wire: [60, 110, 60, 140] },
        { wire: [60, 40, 160, 40] },
        { wire: [160, 40, 160, 70] },
        { el: 'Rth', x: 160, y: 90, dir: 'v' },
        { wire: [160, 110, 160, 140] },
        { wire: [160, 40, 250, 40] },
        { wire: [250, 40, 250, 70] },
        { el: 'Cth', x: 250, y: 90, dir: 'v' },
        { wire: [250, 110, 250, 140] },
        { wire: [60, 140, 250, 140] },
        { gnd: [60, 140] },
        { node: 'hot', x: 160, y: 40, side: 't' },
        { text: 'rise in kelvins', x: 205, y: 26 },
      ],
    },
  }
}

/** The drawing for one analysis, or null when the model has no circuit. */
export function drawOf(x) {
  if (x.kind === 'dc') return dcDraw(x)
  if (x.kind === 'transformer') return transformerDraw(x)
  if (x.kind === 'im') return perPhaseDraw(x)
  if (x.kind === 'losses' && x.net) return thermalDraw(x)
  return null
}
