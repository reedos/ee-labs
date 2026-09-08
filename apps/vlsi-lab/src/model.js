import { newtonDC, solvePWL } from '@ee-labs/network'

export const CARD = Object.freeze({ vdd: 1.8, vt: 0.45, length: 0.18, width: 0.36,
  overlap: 0.05, cox: 8.62e-15, idsat: 216e-6, knPrime: 300e-6, mobilityRatio: 2 })
export const RU = 0.75 * CARD.vdd / CARD.idsat
export const CU = CARD.width * (CARD.length + 2 * CARD.overlap) * CARD.cox
export const DEFAULTS = Object.freeze({ fanout: 1, wp: 2, edge: 'fall', vin: 0.9, stages: 3 })

export function inverter({ wp = 2, vin = CARD.vdd, model = 'switch', vdd = CARD.vdd, vt = CARD.vt } = {}) {
  if (!Number.isFinite(wp) || wp < 1 || wp > 16) throw new Error('Pull-up width must be between 1 and 16 units.')
  if (!(vdd > 2 * vt) || !Number.isFinite(vdd) || !(vt > 0)) throw new Error('The supply must exceed twice the threshold.')
  const kn = CARD.knPrime * CARD.width / CARD.length
  return { id: 'inv', inputs: ['in'], output: 'out', vdd, model, net: { elements: [
    { type: 'V', id: 'VDD', nodes: ['vdd', 'gnd'], value: vdd },
    { type: 'V', id: 'Vin', nodes: ['in', 'gnd'], value: vin },
    { type: 'M', id: 'Mp', nodes: ['out', 'in', 'vdd'], polarity: 'p', model, vt,
      ron: RU * CARD.mobilityRatio / wp, kn: kn * wp / CARD.mobilityRatio, lambda: 0, width: wp, cgate: wp * CU, cdrain: wp * CU },
    { type: 'M', id: 'Mn', nodes: ['out', 'in', 'gnd'], polarity: 'n', model, vt,
      ron: RU, kn, lambda: 0, width: 1, cgate: CU, cdrain: CU },
  ] } }
}

export function dcPoint(vin, model = 'square') {
  const cell = inverter({ vin, model })
  if (model === 'square') return newtonDC(cell.net).sol
  try { return solvePWL(cell.net).sol } catch (error) {
    if (error.code === 'multi-state') return null
    throw error
  }
}

export function transfer() {
  const slope = (v) => (dcPoint(v + 1e-5).v.out - dcPoint(v - 1e-5).v.out) / 2e-5
  const root = (lo, hi) => {
    const sign = Math.sign(slope(lo) + 1)
    for (let i = 0; i < 40; i++) {
      const m = (lo + hi) / 2
      if (Math.sign(slope(m) + 1) === sign) lo = m
      else hi = m
    }
    return (lo + hi) / 2
  }
  const vil = root(CARD.vt + 0.02, CARD.vdd / 2 - 0.02)
  const vih = root(CARD.vdd / 2 + 0.02, CARD.vdd - CARD.vt - 0.02)
  const voh = dcPoint(vil).v.out
  const vol = dcPoint(vih).v.out
  const samples = Array.from({ length: 181 }, (_, i) => {
    const vin = CARD.vdd * i / 180
    return { vin, square: dcPoint(vin).v.out, switch: dcPoint(vin, 'switch')?.v.out ?? null }
  })
  return { vil, vih, voh, vol, nml: vil - vol, nmh: voh - vih, vm: CARD.vdd / 2, samples }
}

export const LAYOUT = {
  w: 500, h: 250,
  items: [
    { el: 'VDD', x: 55, y: 115, dir: 'v' },
    { el: 'Vin', x: 150, y: 174, dir: 'v' },
    { el: 'Mp', x: 300, y: 72, flip: true }, { el: 'Mn', x: 300, y: 176 },
    { el: 'CL', x: 420, y: 174, dir: 'v' },
    ...[[55, 95, 55, 28], [55, 28, 350, 28], [350, 28, 350, 52], [350, 52, 288, 52],
      [288, 92, 350, 92], [350, 92, 350, 156], [350, 156, 312, 156],
      [312, 196, 350, 196], [350, 196, 350, 226], [55, 135, 55, 226],
      [55, 226, 420, 226], [420, 226, 420, 194], [420, 154, 420, 124], [350, 124, 420, 124],
      [150, 154, 150, 124], [150, 124, 280, 124], [280, 124, 280, 176], [150, 194, 150, 226],
      [240, 124, 240, 110], [240, 110, 320, 110], [320, 110, 320, 72],
    ].map((wire) => ({ wire })),
    { node: 'vdd', x: 210, y: 28, side: 't' }, { node: 'in', x: 210, y: 124, side: 't' },
    { node: 'out', x: 400, y: 124, side: 't' }, { gnd: [250, 226] },
  ],
}
