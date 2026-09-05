// Every number the plan and the brief quote, produced from the engine.
//
// Run it with `node packages/comms/scripts/pins.mjs`. This script is the source
// of the figures in COMMUNICATIONS_LAB_PLAN.md §4.3 and in the pins table of
// apps/comms-lab/AGENT_BRIEF.md §6. A lane that wants to check a number runs
// this rather than trusting a document.

import {
  CONSTELLATIONS,
  constellation,
  adjacency,
  naturalLabels,
  amSidebandDb,
  amSidebandPower,
  besselJ,
  firstZeroJ0,
  carsonFraction,
  meritAm,
  meritFm,
  meritDb,
  shapedBandwidth,
  streamPeak,
  eyeOpening,
  shapeTaps,
  residualIsi,
  berClosed,
  serClosed,
  ebN0For,
  relativeHalfWidth,
  errorsFor,
  symbolsFor,
  ofdmRate,
  paprCcdf,
  paprLevel,
  loopFilter,
  loopSnrDb,
  channelResponse,
  twoRay,
  tapsReal,
  rayleighBer,
  rayleighThreshold,
  linearEqualiser,
  equaliserQuality,
  ktDbm,
  noiseFloorDbm,
  wavelength,
  pathLossDb,
  friisNoiseFigure,
  linkBudget,
  implementationLoss,
  HARD_DECISION_DB,
} from '../index.js'

const f = (x, n = 6) => Number(x).toPrecision(n)
const row = (label, value) => console.log(`  ${label.padEnd(46)} ${value}`)
const head = (s) => console.log(`\n${s}`)

head('Group A: analog modulation')
for (const m of [0.25, 0.5, 1]) {
  row(`sideband level at m = ${m}`, `${f(amSidebandDb(m), 5)} dB`)
  row(`sideband power at m = ${m}`, `${f(amSidebandPower(m) * 100, 5)} %`)
}
for (let n = 0; n <= 4; n++) row(`J${n}(2)`, f(besselJ(n, 2), 5))
row('first zero of J0', f(firstZeroJ0(), 7))
row('deviation at the carrier null', `${f(firstZeroJ0() * 250, 4)} Hz`)
row("Carson's bandwidth at beta = 2", '1500 Hz')
row('power inside it', `${f(carsonFraction({ beta: 2 }) * 100, 6)} %`)
row('merit, AM at m = 0.5', `${f(meritDb(meritAm(0.5)), 4)} dB`)
row('merit, AM at m = 1', `${f(meritDb(meritAm(1)), 4)} dB`)
row('merit, FM at beta = 2', `${f(meritDb(meritFm(2)), 4)} dB`)

head('Group B: constellations')
for (const name of CONSTELLATIONS) {
  const c = constellation(name)
  row(
    `${c.label}`,
    `${c.bits} bits, d = ${f(c.minDistance, 5)}, papr ${f(c.paprDb, 4)} dB, mean square ${f(c.meanSquare, 3)}`,
  )
}
row('QPSK adjacency, Gray', String(adjacency('qpsk')))
row('QPSK adjacency, natural binary', String(adjacency('qpsk', naturalLabels('qpsk'))))
row('16-QAM symbol rate at 10 dB', f(serClosed('qam16', 10), 5))
row('16-QAM ratio to four times the bit rate', f(serClosed('qam16', 10) / (4 * berClosed('qam16', 10)), 5))

head('Group C: the pulse and the eye')
for (const beta of [0, 0.25, 0.35, 1]) {
  row(`bandwidth at beta = ${beta}`, `${f(shapedBandwidth(beta, 1000), 5)} Hz`)
}
for (const beta of [0, 0.35, 1]) {
  const p = streamPeak(beta)
  row(`stream peak at beta = ${beta}`, `${f(p.peak, 5)}, ${f(p.db, 5)} dB`)
}
for (const beta of [0, 0.35, 1]) {
  const e = [0.05, 0.1, 0.2].map((x) => f(eyeOpening(beta, x), 5)).join('  ')
  row(`eye opening at beta = ${beta}`, e)
}
for (const span of [4, 6, 12, 16]) {
  const r = residualIsi(shapeTaps({ kind: 'rrc', beta: 0.35, span, sps: 8 }), 8)
  row(`residual ISI at span ${span}`, `near ${f(r.near, 3)}, peak ${f(r.peak, 3)}, sum ${f(r.sum, 3)}`)
}

head('Group D: the bit error rate')
for (const s of ['bpsk', 'fskCoherent', 'qam16', 'qam64']) {
  row(`${s} at 10 dB`, f(berClosed(s, 10), 5))
}
for (const s of ['bpsk', 'qpsk', 'fskCoherent', 'fskNoncoherent', 'dbpsk', 'qam16', 'qam64']) {
  row(`${s} for a rate of 1e-5`, `${f(ebN0For(s, 1e-5), 5)} dB`)
}
row('the orthogonal penalty', `${f(ebN0For('fskCoherent', 1e-5) - ebN0For('bpsk', 1e-5), 5)} dB`)
for (const d of [0, 2, 4, 6, 8]) row(`BPSK exact at ${d} dB`, f(berClosed('bpsk', 10 ** (d / 10)), 5))
row('half width at 100 errors', `${f(relativeHalfWidth(100) * 100, 3)} %`)
row('half width at 1000 errors', `${f(relativeHalfWidth(1000) * 100, 3)} %`)
row('errors for a tenth', String(errorsFor(0.1)))
for (const d of [0, 4, 6, 8, 10]) {
  row(`symbols for 100 errors at ${d} dB`, f(symbolsFor('bpsk', d, 100), 6))
}

head('Group E: the loops')
const lf = loopFilter({ bnT: 0.02, zeta: 0.707, symbolRate: 1000 })
row('Bn', `${f(lf.bn, 4)} Hz`)
row('wn', `${f(lf.wn, 4)} rad/s`)
row('settling to 1 %', `${f(lf.settleTo(0.01) * 1000, 5)} ms, ${lf.settleSymbols(0.01)} symbols`)
row('settling at bnT = 0.005', `${loopFilter({ bnT: 0.005, zeta: 0.707, symbolRate: 1000 }).settleSymbols(0.01)} symbols`)
row('loop ratio at bnT = 0.02', `${f(loopSnrDb(0.02), 4)} dB`)
row('loop ratio at bnT = 0.005', `${f(loopSnrDb(0.005), 4)} dB`)
row('loop ratio at bnT = 0.05', `${f(loopSnrDb(0.05), 4)} dB`)

head('Group F: OFDM')
const g = ofdmRate({ n: 64, cp: 16, used: 52, pilots: 4, bitsPerSymbol: 4, sampleRate: 8000 })
row('subcarrier spacing', `${f(g.spacing, 4)} Hz`)
row('useful symbol', `${f(g.usefulMs, 3)} ms`)
row('prefix', `${f(g.prefixMs, 3)} ms`)
row('whole symbol', `${f(g.symbolMs, 4)} ms`)
row('symbol rate', `${f(g.symbolRate, 4)} a second`)
row('occupied bandwidth', `${f(g.occupied, 4)} Hz`)
row('uncoded 16-QAM rate', `${f(g.bitRate, 5)} bit/s`)
row('prefix cost', `${f(g.prefixCostDb, 4)} dB`)
row('pilot cost', `${f(g.pilotCostDb, 4)} dB`)
row('prefix cost at N = 128', `${f(ofdmRate({ n: 128, cp: 16 }).prefixCostDb, 4)} dB`)
row('worst PAPR', `${f(g.worstPaprDb, 5)} dB`)
row('PAPR above 10 dB', f(paprCcdf(10, 64), 5))
row('PAPR above 12 dB', f(paprCcdf(12, 64), 5))
for (const n of [64, 256, 1024]) row(`level once in 10 000 at N = ${n}`, `${f(paprLevel(1e-4, n), 5)} dB`)

head('Group G: multipath, equalisation, fading')
const ch = channelResponse(twoRay(0.5, 4), 8000, 4001)
row('peak', `${f(ch.peakDb, 5)} dB`)
row('notch', `${f(ch.notchDb, 5)} dB`)
row('notch spacing', `${f(ch.notchSpacing, 4)} Hz`)
row('first notch', `${f(ch.firstNotch, 4)} Hz`)
row('coherence bandwidth', `${f(ch.coherenceBandwidth, 4)} Hz`)
row('notch at a tap of 0.9', `${f(channelResponse(twoRay(0.9, 4), 8000, 4001).notchDb, 5)} dB`)
for (const taps of [21, 41]) {
  const e = linearEqualiser({ channel: tapsReal(twoRay(0.5, 4)), taps })
  const q = equaliserQuality({ channel: tapsReal(twoRay(0.5, 4)), w: e.taps, delay: e.delay })
  row(`zero forcing, ${taps} taps`, `residual ${f(q.residual, 3)}, noise ${f(q.noiseGainDb, 4)} dB`)
}
row('Rayleigh at 10 dB', f(rayleighBer(10), 5))
row('Rayleigh at 20 dB', f(rayleighBer(20), 5))
row('Rayleigh for 1e-5', `${f(rayleighThreshold(1e-5), 4)} dB`)
row('the fading penalty', `${f(rayleighThreshold(1e-5) - ebN0For('bpsk', 1e-5), 4)} dB`)

head('Group H: the link budget')
row('kT at 290 K', `${f(ktDbm(290), 7)} dBm/Hz`)
row('noise in 1 MHz at 6 dB', `${f(noiseFloorDbm({ bandwidth: 1e6, noiseFigureDb: 6 }), 6)} dBm`)
row('wavelength at 2.4 GHz', `${f(wavelength(2.4e9) * 1000, 5)} mm`)
for (const d of [100, 1000, 10000]) row(`path loss at ${d} m`, `${f(pathLossDb({ distance: d }), 6)} dB`)
const b = linkBudget({})
row('received', `${f(b.received, 6)} dBm`)
row('ratio', `${f(b.snr, 6)} dB`)
row('Eb/N0 at 2 Mbit/s', `${f(b.ebN0, 6)} dB`)
row('margin over QPSK', `${f(b.margin, 5)} dB`)
row('range at zero margin', `${f(b.range, 5)} m`)
row(
  'noise figure, amplifier then mixer',
  `${f(friisNoiseFigure([{ gainDb: 12, noiseFigureDb: 1.5 }, { gainDb: 10, noiseFigureDb: 4 }]).db, 4)} dB`,
)
row(
  'noise figure, the other order',
  `${f(friisNoiseFigure([{ gainDb: 10, noiseFigureDb: 4 }, { gainDb: 12, noiseFigureDb: 1.5 }]).db, 4)} dB`,
)
const loss = implementationLoss({
  prefixCostDb: g.prefixCostDb,
  pilotCostDb: g.pilotCostDb,
  hardDecisionDb: HARD_DECISION_DB,
  timingLossDb: -20 * Math.log10(eyeOpening(0.35, 0.05)),
})
for (const r of loss.rows) row(`${r.name} (${r.from})`, `${f(r.db, 4)} dB`)
row('total implementation loss', `${f(loss.total, 4)} dB`)
console.log('')
