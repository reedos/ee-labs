// Every number the brief, the plan and the lessons quote, computed from the
// engine before it is written.
//
//   node apps/system-lab/scripts/pins.mjs
//
// `PROGRAM.md` §3 requires that a quoted number is computed by a script before
// it reaches a document. This is that script. One labelled line per figure, in
// the order the groups use them, so a figure in a note can be found here and
// re-run. Nothing below is typed in except the block records, which are the
// defaults the experiments carry.

import { KT0_DBM_HZ, T0, cascade, chainOf, bypass, levels, noiseFloorDbm, passiveNf, reorder } from '@ee-labs/rf'

const line = (label, value, unit = '') => console.log(`${label.padEnd(54)} ${value}${unit ? ' ' + unit : ''}`)
const sig = (x, n = 6) => (Number.isFinite(x) ? Number(x).toPrecision(n) : String(x))
const pct = (x) => `${Number(100 * x).toPrecision(4)} %`
const head = (t) => console.log(`\n--- ${t} ---`)

// The reference chain of SYSTEM_LAB_PLAN.md §4.3. Six blocks, and every passive
// block's noise figure is computed from its loss rather than typed.
const REFERENCE = [
  { id: 'presel', name: 'Preselect filter', kind: 'filter', gainDb: -2 },
  { id: 'lna', name: 'Low-noise amplifier', kind: 'lna', gainDb: 15, nfDb: 1.5, iip3Dbm: -5, powerMw: 33 },
  { id: 'image', name: 'Image filter', kind: 'filter', gainDb: -2 },
  { id: 'mixer', name: 'Mixer', kind: 'mixer', gainDb: 8, nfDb: 8, iip3Dbm: 5, powerMw: 45 },
  { id: 'iffilt', name: 'IF filter', kind: 'filter', gainDb: -3 },
  { id: 'ifamp', name: 'IF amplifier', kind: 'amp', gainDb: 22, nfDb: 10, iip3Dbm: 20, powerMw: 60 },
]

const PIN = -80
const NARROW = 2e5
const WIDE = 2e7

const chain = chainOf(REFERENCE)
const c = cascade(chain)

head('The constants, computed rather than memorised')
line('reference temperature T_0', sig(T0, 3), 'K')
line('k T_0', sig(KT0_DBM_HZ), 'dBm/Hz')
line('  rounded in prose to', '-174', 'dBm/Hz')
line('the floor over 200 kHz', sig(noiseFloorDbm(NARROW)), 'dBm')
line('the floor over 20.00 MHz', sig(noiseFloorDbm(WIDE)), 'dBm')
line('  the difference is ten times the bandwidth', sig(noiseFloorDbm(WIDE) - noiseFloorDbm(NARROW)), 'dB')
line('the floor over 200 kHz with the chain’s figure', sig(noiseFloorDbm(NARROW, c.nfDb)), 'dBm')
line('the floor over 20.00 MHz with it', sig(noiseFloorDbm(WIDE, c.nfDb)), 'dBm')

head('A1: four numbers describe a block')
for (const [gainDb, nfDb, iip3Dbm, powerMw] of [
  [15, 1.5, -5, 33],
  [25, 1.5, -5, 33],
  [15, 1.5, 5, 33],
  [15, 3, -5, 33],
  [15, 1.5, -5, 66],
]) {
  const one = cascade(chainOf([{ id: 'lna', kind: 'lna', gainDb, nfDb, iip3Dbm, powerMw }]))
  line(
    `  G ${sig(gainDb, 3)} dB, NF ${sig(nfDb, 2)} dB, IIP3 ${sig(iip3Dbm, 2)} dBm, ${sig(powerMw, 3)} mW`,
    `total gain ${sig(one.gainDb)} dB  NF ${sig(one.nfDb)} dB  IIP3 ${sig(one.iip3Dbm)} dBm  OIP3 ${sig(one.oip3Dbm)} dBm  P ${sig(one.powerMw)} mW`,
  )
}
const oneBlock = cascade(chainOf([{ id: 'lna', kind: 'lna', gainDb: 15, nfDb: 1.5, iip3Dbm: -5, powerMw: 33 }]))
line('with one block the two addition rules agree', `${sig(oneBlock.iip3Dbm)} and ${sig(oneBlock.iip3PowerDbm)}`, 'dBm')

head('A2: gain in decibels adds')
line('the six blocks’ gains', REFERENCE.map((b) => sig(b.gainDb, 3)).join(', '), 'dB')
line('cumulative gain, node by node', c.blocks.map((b) => sig(b.cumGainDb, 5)).join(', '), 'dB')
line('the total', sig(c.gainDb), 'dB')
line('  the same as a power ratio', sig(c.gain))
line('  the six ratios multiplied', sig(REFERENCE.reduce((p, b) => p * Math.pow(10, b.gainDb / 10), 1)))
for (const id of ['presel', 'lna', 'ifamp']) {
  const cut = cascade(bypass(chain, id))
  line(`  with ${id} bypassed`, `${sig(cut.gainDb)} dB, a shift of ${sig(cut.gainDb - c.gainDb, 4)} dB`)
}
for (const g of [25]) {
  const raised = cascade(chain.map((b) => (b.id === 'lna' ? { ...b, gainDb: g } : b)))
  line(`  with the LNA at ${sig(g, 3)} dB`, `${sig(raised.gainDb)} dB total, NF ${sig(raised.nfDb)} dB, IIP3 ${sig(raised.iip3Dbm)} dBm`)
}

head('A3: a passive block is not free')
for (const lossDb of [2, 3, 6]) {
  for (const tempK of [4, 20, 77, 150, T0, 400]) {
    line(`  loss ${sig(lossDb, 2)} dB at ${sig(tempK, 3)} K`, sig(passiveNf(lossDb, tempK)), 'dB')
  }
}

head('A4: the levels along the chain')
const v = levels(chain, { pinDbm: PIN, bandwidthHz: NARROW })
line('input level', sig(PIN, 3), 'dBm')
line('noise bandwidth', sig(NARROW, 4), 'Hz')
line('the floor', sig(v.floorDbm), 'dBm')
line('the ratio at the input', sig(v.snrInDb), 'dB')
for (const node of v.nodes) {
  line(
    `  node ${node.index} (${node.id})`,
    `signal ${sig(node.signalDbm)} dBm  noise ${sig(node.noiseDbm)} dBm  ratio ${sig(node.snrDb)} dB  cum gain ${sig(node.cumGainDb, 5)} dB  cum NF ${sig(node.cumNfDb, 5)} dB`,
  )
}
line('the ratio at the output', sig(v.snrOutDb), 'dB')
line('  which is the input ratio less the chain’s figure', sig(v.snrInDb - c.nfDb), 'dB')
line('the block with the least backoff', `${v.limits.id}, ${sig(v.limits.backoffDb)} dB`)
const wide = levels(chain, { pinDbm: PIN, bandwidthHz: WIDE })
line('the same chain over 20.00 MHz, output ratio', sig(wide.snrOutDb), 'dB')
const strong = levels(chain, { pinDbm: -60, bandwidthHz: NARROW })
line('at -60 dBm in, output ratio', sig(strong.snrOutDb), 'dB')
const fast = levels(
  chain.map((b) => (b.id === 'lna' ? { ...b, gainDb: 25 } : b)),
  { pinDbm: PIN, bandwidthHz: NARROW },
)
line('with the LNA at 25 dB, output ratio', sig(fast.snrOutDb), 'dB')
line('  the chain’s figure then', sig(fast.cascade.nfDb), 'dB')
line('  which is better by', sig(c.nfDb - fast.cascade.nfDb), 'dB')

head('The reference chain’s four totals, and the three sets of shares')
line('cumulative gain', sig(c.gainDb), 'dB')
line('cascaded noise figure', sig(c.nfDb), 'dB')
line('cascaded input IP3, aligned phase', sig(c.iip3Dbm), 'dBm')
line('  the same by power addition', sig(c.iip3PowerDbm), 'dBm')
line('  output IP3', sig(c.oip3Dbm), 'dBm')
line('total DC power', sig(c.powerMw, 4), 'mW')
for (const b of c.blocks) {
  line(`  ${b.id}`, `noise ${pct(b.noiseShare)}  IP3 ${pct(b.ip3Share)}  power ${pct(b.powerShare)}  cum NF ${sig(b.cumNfDb, 5)} dB`)
}
line('the noise shares sum to', pct(c.blocks.reduce((s, b) => s + b.noiseShare, 0)))
line('the IP3 shares sum to', pct(c.blocks.reduce((s, b) => s + b.ip3Share, 0)))
line('the power shares sum to', pct(c.blocks.reduce((s, b) => s + b.powerShare, 0)))

head('What later phases will need, computed here so the plan’s figures are checked')
const moved = cascade(reorder(chain, 'presel', 'lna'))
line('the LNA in front of the preselect filter, NF', sig(moved.nfDb), 'dB')
line('  a gain of', sig(c.nfDb - moved.nfDb), 'dB')
line('  its input IP3', sig(moved.iip3Dbm), 'dBm')
line('  a loss of', sig(c.iip3Dbm - moved.iip3Dbm, 4), 'dB')
const raised = cascade(chain.map((b) => (b.id === 'lna' ? { ...b, gainDb: 25 } : b)))
line('the LNA at 25.0 dB, NF', sig(raised.nfDb), 'dB')
line('  better by', sig(c.nfDb - raised.nfDb), 'dB')
line('  its input IP3', sig(raised.iip3Dbm), 'dBm')
line('  worse by', sig(c.iip3Dbm - raised.iip3Dbm, 4), 'dB')
line('sensitivity at 10 dB over 200 kHz', sig(noiseFloorDbm(NARROW, c.nfDb) + 10), 'dBm')
line('sensitivity at 10 dB over 20.00 MHz', sig(noiseFloorDbm(WIDE, c.nfDb) + 10), 'dBm')

// ---------------------------------------------------------------------------
// What phases 4, 5 and 6 will pin.
//
// Their engine is not written. `dynamicRange` waits on the RF Lab's 1 dB
// compression point and `link.js` waits on the Fields Lab's antenna gain, per
// `apps/system-lab/NEEDS.md` §3. The closed forms are stated here so that the
// brief's figures are computed rather than copied, and so that the lane which
// writes the engine has a number to land on. Each line names the form it used.
// When the engine lands, these lines move onto it and the values must not move.

head('Phase 4: dynamic range, from the two slopes and the floor')
// The cubic model's own offset, and a property of that model rather than a
// convention. With v_out = a_1 v + a_3 v³ the fundamental grows as
// a_1 A − (3/4)|a_3| A³, so the third-order intercept sits at
// A² = 4a_1/(3|a_3|) and the 1 dB compression point at (1 − 10^(−1/20)) of it.
// The ratio of the two is a power ratio, so ten times its logarithm.
const P1DB_BELOW_IIP3 = 10 * Math.log10(1 - Math.pow(10, -0.05))
line('the cubic model puts the 1 dB compression point below IIP3 by', sig(-P1DB_BELOW_IIP3), 'dB')
const p1db = c.iip3Dbm + P1DB_BELOW_IIP3
line('so the chain’s input 1 dB compression point is', sig(p1db), 'dBm')
for (const [name, B] of [
  ['200 kHz', NARROW],
  ['20.00 MHz', WIDE],
]) {
  const floor = noiseFloorDbm(B, c.nfDb)
  line(`  over ${name}, the floor`, sig(floor), 'dBm')
  line('    spurious-free dynamic range, (2/3)(IIP3 − floor)', sig((2 / 3) * (c.iip3Dbm - floor)), 'dB')
  line('    linear dynamic range, P1dB − floor', sig(p1db - floor), 'dB')
}
line('widening 200 kHz to 20.00 MHz costs the floor', sig(noiseFloorDbm(WIDE, c.nfDb) - noiseFloorDbm(NARROW, c.nfDb)), 'dB')
line('  and the spurious-free range two thirds of that', sig((2 / 3) * (noiseFloorDbm(NARROW, c.nfDb) - noiseFloorDbm(WIDE, c.nfDb))), 'dB')

head('Phase 5: the link, from 20 log(4π d / λ)')
const C0_MS = 299792458
const fsl = (dM, fHz) => 20 * Math.log10((4 * Math.PI * dM * fHz) / C0_MS)
const linkOf = ({ ptDbm, gtDbi, grDbi, dM, fHz, nfDb, bHz, reqDb }) => {
  const loss = fsl(dM, fHz)
  const prx = ptDbm + gtDbi + grDbi - loss
  const floor = noiseFloorDbm(bHz, nfDb)
  return { loss, prx, floor, snr: prx - floor, margin: prx - floor - reqDb, cn0: prx - (KT0_DBM_HZ + nfDb) }
}
const LINKS = [
  ['2.400 GHz over 100 m ', { ptDbm: 20, gtDbi: 2, grDbi: 2, dM: 100, fHz: 2.4e9, nfDb: 6, bHz: WIDE, reqDb: 20 }],
  ['the same at 1.000 km ', { ptDbm: 20, gtDbi: 2, grDbi: 2, dM: 1000, fHz: 2.4e9, nfDb: 6, bHz: WIDE, reqDb: 20 }],
  ['900 MHz over 10.00 km', { ptDbm: 30, gtDbi: 8, grDbi: 2, dM: 1e4, fHz: 9e8, nfDb: 8, bHz: NARROW, reqDb: 12 }],
  ['12.00 GHz, 35786 km  ', { ptDbm: 50, gtDbi: 34, grDbi: 41, dM: 3.5786e7, fHz: 1.2e10, nfDb: 2, bHz: 2.7e7, reqDb: 10 }],
]
for (const [name, spec] of LINKS) {
  const l = linkOf(spec)
  line(`  ${name}`, `loss ${sig(l.loss)} dB  received ${sig(l.prx)} dBm  floor ${sig(l.floor)} dBm  ratio ${sig(l.snr)} dB  margin ${sig(l.margin)} dB`)
}
line('the wavelength at 2.400 GHz', sig(C0_MS / 2.4e9, 4), 'm')
line('ten times the distance costs', sig(fsl(1000, 2.4e9) - fsl(100, 2.4e9)), 'dB')
line('twice the distance costs', sig(fsl(200, 2.4e9) - fsl(100, 2.4e9)), 'dB')
const first = linkOf(LINKS[0][1])
line('C/N_0 for the 100 m link', sig(first.cn0), 'dB-Hz')
for (const rb of [1e6, 1e7, 5.4e7]) line(`  E_b/N_0 at ${sig(rb, 4)} bit/s`, sig(first.cn0 - 10 * Math.log10(rb)), 'dB')

head('Phase 6: reciprocal mixing, against the floor the chain already has')
const PHASE_NOISE_DBC_HZ = -117
const leaked = PHASE_NOISE_DBC_HZ + 10 * Math.log10(NARROW)
line('a local oscillator at -117.0 dBc/Hz over 200 kHz', sig(leaked), 'dBc')
line('  so a blocker at -30 dBm leaves', `${sig(-30 + leaked)} dBm in the channel`)
line('  which is above the chain’s floor by', sig(-30 + leaked - noiseFloorDbm(NARROW, c.nfDb)), 'dB')
