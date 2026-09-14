import { solveDC, transient } from '@ee-labs/network'

export const DEFAULTS = Object.freeze({
  drive: 'push-pull', ron: 25, rpu: 10000, cload: 50e-12, vdd: 3.3, vt: 0.7,
  riseBudget: 10e-9, loadCurrent: 8e-3, inductance: 5e-9, edgeTime: 2e-9, pins: 8,
})

export function thresholdsOf({ vdd, vt }) {
  if (!Number.isFinite(vdd) || !Number.isFinite(vt) || vt < 0 || vdd <= 2 * vt)
    throw new RangeError('Matched CMOS thresholds require VDD greater than twice Vt, with Vt nonnegative.')
  return { vil: (3 * vdd + 2 * vt) / 8, vih: (5 * vdd - 2 * vt) / 8, vm: vdd / 2 }
}

export function validatePin(p) {
  if (!['push-pull', 'open-drain'].includes(p.drive)) throw new RangeError('Select push-pull or open-drain drive.')
  for (const k of ['ron', 'rpu', 'cload', 'vdd'])
    if (!Number.isFinite(p[k]) || p[k] <= 0) throw new RangeError(`${k} must be finite and positive.`)
  return thresholdsOf(p)
}

export function pinNet(p, value) {
  return { elements: [
    { id: 'VDD', type: 'V', nodes: ['vdd', 'gnd'], value: p.vdd },
    ...(p.drive === 'push-pull'
      ? [{ id: 'SH', type: 'SW', nodes: ['vdd', 'pin'], ron: p.ron, closed: value === 1 }]
      : [{ id: 'Rpu', type: 'R', nodes: ['vdd', 'pin'], value: p.rpu }]),
    { id: 'SL', type: 'SW', nodes: ['pin', 'gnd'], ron: p.ron, closed: value === 0 },
    { id: 'Cload', type: 'C', nodes: ['pin', 'gnd'], value: p.cload },
  ] }
}

// Topology changes belong to the edge adapter. Network owns every state advance.
export function pinDrive(pin, edges, { tEnd, initial = 0 } = {}) {
  const thresholds = validatePin(pin)
  if (!Number.isFinite(tEnd) || tEnd <= 0) throw new RangeError('The time window must be finite and positive.')
  if (!Number.isFinite(initial) || initial < 0 || initial > pin.vdd) throw new RangeError('Initial voltage must lie between ground and VDD.')
  if (!Array.isArray(edges) || !edges.length || edges.length > 256 || edges[0].t !== 0)
    throw new RangeError('Provide one to 256 edges beginning at zero.')
  edges.forEach((e, i) => {
    if (!Number.isFinite(e.t) || e.t < 0 || e.t >= tEnd || (i && e.t <= edges[i - 1].t) || ![0, 1].includes(e.value))
      throw new RangeError('Edges must be ordered binary values inside the time window.')
  })
  const levels = { ...thresholds, v10: 0.1 * pin.vdd, v90: 0.9 * pin.vdd }
  const segments = []
  const crossings = []
  let voltage = initial
  edges.forEach((edge, i) => {
    const end = edges[i + 1]?.t ?? tEnd
    const net = pinNet(pin, edge.value)
    const run = transient(net, { t0: edge.t, tEnd: end, x0: [voltage], points: 2 })
    const target = solveDC(net).v.pin
    const tau = -1 / run.dyn.A[0][0]
    const segment = { start: edge.t, end, initial: voltage, target, tau, value: edge.value, net, run }
    segments.push(segment)
    for (const [level, v] of Object.entries(levels)) {
      const ratio = (v - target) / (voltage - target)
      if (!(ratio > 0 && ratio < 1)) continue
      const t = edge.t - tau * Math.log(ratio)
      if (t <= end) crossings.push({ t, level, dir: target > voltage ? 1 : -1, edge: i })
    }
    voltage = run.at(end).x[0]
  })
  crossings.sort((a, b) => a.t - b.t)
  const at = (t) => {
    if (!Number.isFinite(t) || t < 0 || t > tEnd) throw new RangeError('The cursor must lie inside the time window.')
    const segment = segments.findLast((s) => t >= s.start)
    return { ...segment.run.at(t), segment }
  }
  const wave = (t) => at(t).x[0]
  const samples = segments.flatMap((s) => {
    const ts = new Set([s.start, s.end])
    for (let i = 1; i <= 160; i++) {
      const t = s.start + s.tau * i / 16
      if (t < s.end) ts.add(t)
    }
    return [...ts].sort((a, b) => a - b).map((t) => ({ t, v: wave(t) }))
  })
  const crossing = (level, dir) => crossings.find((c) => c.level === level && c.dir === dir)
  const interval = (a, b, dir) => {
    const start = crossing(a, dir)
    const end = start && crossings.find((c) => c.level === b && c.dir === dir && c.edge === start.edge)
    return end ? end.t - start.t : null
  }
  const delay = (level, dir) => {
    const c = crossing(level, dir)
    return c ? c.t - edges[c.edge].t : null
  }
  return { at, wave, segments, samples, crossings, tEnd, thresholds,
    tr: interval('v10', 'v90', 1), tf: interval('v90', 'v10', -1),
    tpLH: delay('vih', 1), tpHL: delay('vil', -1) }
}

export function noiseMargins(p) {
  const thresholds = validatePin(p)
  for (const k of ['loadCurrent', 'inductance'])
    if (!Number.isFinite(p[k]) || p[k] < 0) throw new RangeError(`${k} must be finite and nonnegative.`)
  if (!Number.isFinite(p.edgeTime) || p.edgeTime <= 0 || !Number.isInteger(p.pins) || p.pins < 1 || p.pins > 32)
    throw new RangeError('Use a positive edge time and one to 32 pins.')
  if (p.loadCurrent > p.vdd / p.ron) throw new RangeError('The load exceeds the rail-limited switch current.')
  const loaded = (value) => {
    const net = pinNet({ ...p, drive: 'push-pull' }, value)
    net.elements.push({ id: 'Iload', type: 'I', nodes: ['pin', 'gnd'], value: value ? p.loadCurrent : -p.loadCurrent })
    return solveDC(net).v.pin
  }
  const vol = loaded(0)
  const voh = loaded(1)
  const nml = thresholds.vil - vol
  const nmh = voh - thresholds.vih
  const margin = Math.min(nml, nmh)
  const currentStep = p.vdd / p.ron
  const perPin = p.inductance * currentStep / p.edgeTime
  const bounce = p.pins * perPin
  return { vol, voh, nml, nmh, margin, currentStep, perPin, bounce, slack: margin - bounce,
    maxPins: margin < 0 ? 0 : perPin === 0 ? Infinity : Math.max(0, Math.floor(margin / perPin)) }
}

export function riseBudgetOf(run, limit) {
  if (!Number.isFinite(limit) || limit <= 0) throw new RangeError('The rise budget must be finite and positive.')
  if (!Number.isFinite(run.tr) || run.tr <= 0)
    return { slack: null, pass: null, reason: 'The waveform does not cross both rise levels.' }
  const slack = limit - run.tr
  return { slack, pass: slack >= 0, reason: null }
}

export function analyse(p) {
  validatePin(p)
  const tEnd = 8 * (p.drive === 'open-drain' ? p.rpu : p.ron) * p.cload
  const rise = pinDrive(p, [{ t: 0, value: 1 }], { tEnd })
  const fall = pinDrive(p, [{ t: 0, value: 0 }], { tEnd: 8 * p.ron * p.cload, initial: p.vdd })
  const resistance = p.drive === 'open-drain' ? p.rpu : p.ron
  return { rise, fall, thresholds: rise.thresholds, margins: noiseMargins(p),
    budget: { ...riseBudgetOf(rise, p.riseBudget), maxCap: p.riseBudget / (Math.log(9) * resistance) } }
}
