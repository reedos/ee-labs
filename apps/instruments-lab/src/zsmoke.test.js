import { it } from 'vitest'
import { EXPERIMENTS, defaultsOf } from './experiments.js'
import { analyse, experimentMath, snapNoise } from './math.js'
import { layoutProblems, layoutExtent } from './layoutCheck.js'
import { agrees } from '@ee-labs/explain'

const only = process.env.ONLY || ''
const fmtv = (v) => (Number.isFinite(v) ? Number(v.toPrecision(6)) : String(v))

it('smoke', () => {
  for (const e of EXPERIMENTS) {
    if (only && !e.id.startsWith(only)) continue
    const p = defaultsOf(e.id)
    let x
    try {
      x = analyse(e, p)
    } catch (err) {
      console.log(`${e.id}  THREW  ${err.message}`)
      continue
    }
    if (!x.sol) {
      console.log(`${e.id}  refused: ${x.refusal && x.refusal.message}`)
      continue
    }
    let m
    try {
      m = experimentMath(e, p, x)
    } catch (err) {
      console.log(`${e.id}  MATH THREW  ${err.message}`)
      continue
    }
    console.log(`\n=== ${e.id} ${e.name}  (KCL ${x.sol.maxResidual.toExponential(1)})`)
    const els = e.net(p).elements
    const lay = typeof e.layout === "function" ? e.layout(p) : e.layout
    const probs = layoutProblems({ ...lay, crop: layoutExtent(lay, els) }, els, snapNoise(x.sol), e.show)
    if (probs.length) console.log('  LAYOUT: ' + probs.slice(0, 8).join(' | '))
    for (const b of m.blocks) {
      if (b.kind === 'check')
        for (const r of b.rows)
          console.log(`  ${agrees(r) ? 'ok  ' : 'FAIL'} ${r.label}: theory ${fmtv(r.predicted)} measured ${fmtv(r.measured)} ${r.unit}`)
      if (b.kind === 'values') for (const r of b.rows) console.log(`  ·    ${r.label}: ${fmtv(r.value)} ${r.unit}${r.note ? `  (${r.note})` : ''}`)
    }
  }
}, 600000)
