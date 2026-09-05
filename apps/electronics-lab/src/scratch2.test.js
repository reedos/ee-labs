import { it } from 'vitest'
import { GROUP_A } from './groups/a.js'
import { GROUP_C } from './groups/c.js'
import { analyse, clipOf, peakOf, slopeOf } from './math.js'

const ALL = [...GROUP_A, ...GROUP_C]
const byId = Object.fromEntries(ALL.map((e) => [e.id, e]))
const defaults = (id) => Object.fromEntries(byId[id].params.map((k) => [k.key, k.default]))

const CASES = [
  ['a1', {}],
  ['a1', { Rf: 100000 }],
  ['a1', { Rf: 1000 }],
  ['a1', { vos: 1e-4 }],
  ['a1', { E: 0.001 }],
  ['a2', {}],
  ['a2', { Rp: (100000 * 10000) / 110000 }],
  ['a2', { ib: 1e-9 }],
  ['a2', { Rf: 1000000 }],
  ['a3', {}],
  ['a3', { Rf: 100000 }],
  ['a3', { Rf: 1000 }],
  ['a3', { gbw: 1e7 }],
  ['a4', {}],
  ['a4', { slewv: 2 }],
  ['a4', { step: 1 }],
  ['a5', {}],
  ['a5', { RL: 10000 }],
  ['a5', { imax: 100e-3 }],
  ['a5', { E: 5, RL: 10000 }],
  ['a6', {}],
  ['a6', { loop: false }],
  ['a6', { amp: 0.1 }],
  ['c1', {}],
  ['c1', { vsrc: -10 }],
  ['c1', { na: 1e24 }],
  ['c1', { T: 350 }],
  ['c2', {}],
  ['c2', { vsrc: 0 }],
  ['c2', { vsrc: -10 }],
  ['c2', { cj0: 10e-12 }],
  ['c3', {}],
  ['c3', { i: 4e-3 }],
  ['c3', { i: 0.25e-3 }],
  ['c3', { tauF: 2e-9 }],
  ['c4', {}],
  ['c4', { i: 1e-3 }],
  ['c4', { i: 0.12e-3 }],
  ['c4', { T: 350 }],
  ['c4', { T: 250 }],
]

it('numbers', () => {
  for (const [id, over] of CASES) {
    const e = byId[id]
    const p = { ...defaults(id), ...over }
    const x = analyse(e, p)
    const out = { id, over: JSON.stringify(over) }
    if (x.refusal) {
      console.log(id, JSON.stringify(over), 'REFUSED', x.refusal.code)
      continue
    }
    if (x.sol) out.v = Object.fromEntries(Object.entries(x.sol.v).map(([k, v]) => [k, +v.toPrecision(8)]))
    if (x.regions && Object.keys(x.regions).length) out.regions = JSON.stringify(x.regions)
    if (x.gain !== undefined) out.gain = +x.gain.toPrecision(8)
    if (x.corner) out.corner = +x.corner.high.toPrecision(8)
    if (x.tr) {
      out.slope = +slopeOf(x, 'out').toPrecision(8)
      out.peak = +peakOf(x, 'out').toPrecision(8)
      out.clip = clipOf(x, 'out')
      out.events = x.tr.events.map((ev) => `${ev.id} ${ev.from}->${ev.to} @${(ev.t * 1e6).toFixed(2)}us`)
    }
    if (x.junction)
      out.j = Object.fromEntries(
        ['v0', 'v', 'w', 'xp', 'xn', 'cj', 'i', 'gm', 'cd', 'cpi', 'fT', 'fTlimit', 'is', 'doubling', 'slope'].map((k) => [
          k,
          Number.isFinite(x.junction[k]) ? +x.junction[k].toPrecision(8) : x.junction[k],
        ]),
      )
    console.log(`${id} ${JSON.stringify(over)} :: ${JSON.stringify(out)}`)
  }
})
