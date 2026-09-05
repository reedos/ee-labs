import { it } from 'vitest'
import { GROUP_A } from './groups/a.js'
import { GROUP_C } from './groups/c.js'
import { analyse } from './math.js'
import { clipOf, peakOf, slopeOf } from './math.js'

const defaults = (e) => Object.fromEntries(e.params.map((k) => [k.key, k.default]))
it('numbers', () => {
for (const e of [...GROUP_A, ...GROUP_C]) {
  const p = defaults(e)
  const x = analyse(e, p)
  const line = { id: e.id }
  if (x.refusal) {
    console.log(e.id, 'REFUSED', x.refusal.code, x.refusal.message)
    if (x.refusal.detail && x.refusal.detail.cause) console.log('  cause:', x.refusal.detail.cause.code, x.refusal.detail.cause.message)
    continue
  }
  line.vout = x.sol.v.out
  line.regions = JSON.stringify(x.regions)
  if (x.gain !== undefined) line.gain = x.gain
  if (x.corner) line.corner = x.corner.high
  if (x.poles) line.poles = x.poles.map((q) => q.hz)
  if (x.tr) {
    line.slope = slopeOf(x, 'out')
    line.clip = clipOf(x, 'out')
    line.peak = peakOf(x, 'out')
    line.events = x.tr.events.map((ev) => `${ev.id} ${ev.from}->${ev.to} @${(ev.t * 1e6).toFixed(2)}us`)
    line.tEnd = x.tEnd
  }
  if (x.signalRefusal) line.sigErr = x.signalRefusal.message.slice(0, 80)
  if (x.junction) line.junction = Object.fromEntries(Object.entries(x.junction).filter(([k, v]) => typeof v === 'number'))
  console.log(JSON.stringify(line, null, 1))
}
})
