// The props each view takes, computed from the analysis.
//
// The panes draw what they are given. Nothing below computes physics: every
// number here came out of `analyse`, which is the only thing in the app that
// calls the engine. Keeping the two apart is what lets `experiments.test.js`
// check a picture's numbers without rendering anything.

import { KT0_DBM_HZ } from '@ee-labs/rf'
import { bandwidth, db, dbm, kelvin, mw, num, pct, plain } from './format.js'

/** The four budgets, in the order the table's columns run. */
export const COLUMNS = [
  { key: 'gain', label: 'Gain', unit: 'dB', title: 'The cumulative gain up to and including this block' },
  { key: 'nf', label: 'Noise figure', unit: 'dB', title: 'The cumulative noise figure up to and including this block' },
  { key: 'iip3', label: 'Input IP3', unit: 'dBm', title: 'The cumulative input IP3, with every stage’s product added as an aligned voltage: the worst case' },
  { key: 'power', label: 'DC power', unit: 'mW', title: 'What this block draws from the supply' },
]

/**
 * The budget table: one row per block, one column per budget.
 *
 * Each cell carries the cumulative value and the block's own share, and the
 * pane shows one or the other. The share is what names the block to change, so
 * it is a toggle rather than a second table.
 */
export function tablePropsFor(exp, p, x) {
  const rows = x.c.blocks.map((b) => ({
    id: b.id,
    name: b.name,
    kind: b.kind,
    passive: b.passive,
    cells: {
      gain: { value: db(b.cumGainDb), own: `${plain(b.gainDb, 4)} dB`, share: null },
      nf: { value: db(b.cumNfDb), own: `${plain(b.nfDb, 4)} dB`, share: pct(b.noiseShare) },
      iip3: { value: dbm(b.cumIip3Dbm), own: dbm(b.iip3Dbm), share: b.iip3Dbm === Infinity ? '—' : pct(b.ip3Share) },
      power: { value: mw(b.powerMw), own: mw(b.powerMw), share: b.powerMw === null ? 'unknown' : pct(b.powerShare) },
    },
  }))

  return {
    columns: COLUMNS,
    rows,
    totals: {
      gain: db(x.c.gainDb),
      nf: db(x.c.nfDb),
      iip3: dbm(x.c.iip3Dbm),
      power: mw(x.c.powerMw),
    },
    // A number without its bandwidth means nothing here, so the table prints
    // the one its levels were read at, whether or not this experiment turns it.
    caption:
      `${x.c.n} block${x.c.n === 1 ? '' : 's'}, ${db(x.c.gainDb)} of gain, ${db(x.c.nfDb)} of noise figure. ` +
      `Levels are read at ${dbm(x.input.pinDbm)} in a ${bandwidth(x.input.bandwidthHz)} noise bandwidth.`,
  }
}

/**
 * The levels view: the signal and the noise at every node, and their gap.
 *
 * The two lines are drawn on one decibel axis, which is what makes the gap
 * legible. `SYSTEM_LAB_PLAN.md` §4.2 asks for the flow strip's level axis, and
 * this is that axis at full size, with the numbers under it.
 */
export function levelPropsFor(exp, p, x) {
  const nodes = x.v.nodes.map((n) => ({
    index: n.index,
    id: n.id,
    name: n.name,
    signalDbm: n.signalDbm,
    noiseDbm: n.noiseDbm,
    snrDb: n.snrDb,
    cumGainDb: n.cumGainDb,
    cumNfDb: n.cumNfDb,
  }))
  const values = nodes.flatMap((n) => [n.signalDbm, n.noiseDbm])
  const top = Math.max(...values)
  const bottom = Math.min(...values)
  // A range that adapts must not fidget, so it is padded to a whole number of
  // decibels above and below and re-framed only when the content leaves it.
  const pad = Math.max(4, 0.08 * (top - bottom))
  return {
    nodes,
    from: Math.floor((bottom - pad) / 10) * 10,
    to: Math.ceil((top + pad) / 10) * 10,
    floorDbm: x.v.floorDbm,
    pinDbm: x.v.pinDbm,
    bandwidthHz: x.v.bandwidthHz,
    snrInDb: x.v.snrInDb,
    snrOutDb: x.v.snrOutDb,
    limits: x.v.limits,
    caption:
      `Signal and noise in dBm at every node, over a ${bandwidth(x.v.bandwidthHz)} noise bandwidth. ` +
      `The ratio starts at ${db(x.v.snrInDb)} and ends at ${db(x.v.snrOutDb)}, and the chain’s noise figure is the difference.`,
  }
}

/** Every closed form this experiment used, with the formula it came from. */
export function numberRowsFor(exp, p, x) {
  if (x.declined) return []
  const row = (label, value, formula) => ({ label, value, formula })
  const c = x.c
  const v = x.v

  const rows = [
    row('Blocks in the chain', plain(c.n, 3), 'the chain'),
    row('Cumulative gain', db(c.gainDb), 'the sum of the gains in decibels'),
    row('  as a power ratio', plain(c.gain, 6), 'the product of the ratios'),
    row('Cascaded noise figure', db(c.nfDb), 'F = F_1 + (F_2 − 1)/G_1 + …'),
    row('Cascaded input IP3, worst case', dbm(c.iip3Dbm), '1/A = 1/A_1 + G_1/A_2 + …, voltages aligned'),
    row('  by power addition', dbm(c.iip3PowerDbm), '1/A² = Σ (G_before/A_k)²'),
    row('Output IP3', dbm(c.oip3Dbm), 'input IP3 plus the cumulative gain'),
    row('Total DC power', mw(c.powerMw), 'the sum of the stated powers'),
    row('k T_0 at 290 K', `${plain(KT0_DBM_HZ, 6)} dBm/Hz`, 'Boltzmann’s constant times the reference temperature'),
    row('Noise bandwidth', bandwidth(v.bandwidthHz), 'the knob, or the lab’s 200 kHz channel'),
    row('Noise floor', dbm(v.floorDbm), 'k T_0 in dBm/Hz plus ten times the log of the bandwidth'),
    row('Input level', dbm(v.pinDbm), 'the knob, or the lab’s −80 dBm'),
    row('Ratio at the input', db(v.snrInDb), 'the input level less the floor'),
    row('Ratio at the output', db(v.snrOutDb), 'the input ratio less the cascaded noise figure'),
  ]

  if (x.kind === 'passive') {
    const b = c.blocks[0]
    rows.push(row('Physical temperature', kelvin(b.tempK), 'the knob'))
    rows.push(row('Loss as a power ratio', plain(Math.pow(10, -b.gainDb / 10), 6), 'L = 10^(loss/10)'))
    rows.push(row('Noise factor', plain(Math.pow(10, b.nfDb / 10), 6), 'F = 1 + (L − 1) T/T_0'))
  }

  if (c.n > 1) {
    rows.push(row('Largest noise share', `${c.blocks.reduce((a, b) => (b.noiseShare > a.noiseShare ? b : a)).name}, ${pct(Math.max(...c.blocks.map((b) => b.noiseShare)))}`, '(F_k − 1)/G_before, over the total excess'))
    rows.push(row('Block with the least backoff', `${v.limits.name}, ${db(v.limits.backoffDb)}`, 'its input IP3 less the level arriving at it'))
  }

  return rows
}

/**
 * The flow strip: the chain as a row of blocks, each with its four numbers.
 *
 * The strip is above every view rather than inside one, because the chain is
 * what the whole lab is about and a reader should never have to switch views to
 * see it.
 */
export function flowPropsFor(exp, p, x) {
  if (x.declined) return { blocks: [], input: null }
  return {
    input: { label: 'In', value: dbm(x.v.pinDbm) },
    blocks: x.c.blocks.map((b, i) => ({
      id: b.id,
      name: b.name,
      kind: b.kind,
      passive: b.passive,
      gain: `${plain(b.gainDb, 4)} dB`,
      nf: `${plain(b.nfDb, 4)} dB`,
      iip3: b.iip3Dbm === Infinity ? '∞' : `${plain(b.iip3Dbm, 4)} dBm`,
      power: b.powerMw === null ? 'unknown' : `${plain(b.powerMw, 4)} mW`,
      signal: dbm(x.v.nodes[i + 1].signalDbm),
      cum: db(b.cumGainDb),
    })),
    out: { label: 'Out', value: dbm(x.v.nodes[x.v.nodes.length - 1].signalDbm) },
  }
}

export { num }
