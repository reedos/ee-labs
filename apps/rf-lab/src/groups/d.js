// Group D: S-parameters.
//
// Five experiments, and one argument. A wave is what a two-port is described
// by at a frequency where an open circuit is not open, that description comes
// out of two exact solves of a circuit this suite already had, it is one object
// with four faces and not every face exists for every two-port, blocks cascade
// two ways that agree, and what is not reflected or transmitted was dissipated.
//
// Every circuit here is built from the knobs. The pi attenuator's resistors are
// the closed form of the decibels asked for, and the transformer section's
// impedance is the geometric mean of the two it joins. Nothing is a table.

import { abcdToSparam, chainAbcd, chainS, elementAbcd, lineAbcd, lineSparam, phaseVelocity, quarterWaveZ0, sFromNetlist, transformerAbcd, uniformLine } from '@ee-labs/rf'
import { Choice, Count, Farad, Freq, Henry, Norm, Ohms, Ratio, React_, Ref } from '../knobs.js'

export const GROUP = 'D · S-parameters'

const F0 = 1e9
const EPSR = 2.1

/**
 * The pi attenuator that loses the decibels it is asked for, in a reference
 * impedance, and is matched at both ports while doing it.
 *
 *   K = 10^(dB/20)   R_series = Z0 (K² − 1)/(2K)   R_shunt = Z0 (K + 1)/(K − 1)
 *
 * At 3.000 dB in 50 ohms that is 17.615 ohms between two of 292.40 ohms. The
 * resistors are resistors, so the pad reads the same at every frequency, which
 * is the plainest two-port there is and the reason D2 uses it.
 */
export function piPad(db, z0) {
  const K = Math.pow(10, db / 20)
  const series = (z0 * (K * K - 1)) / (2 * K)
  const shunt = (z0 * (K + 1)) / (K - 1)
  return { db, K, series, shunt }
}

/** That pad as a netlist, for the solver, and as a chain matrix, for the closed form. */
export function padNetlist(pad, suffix = '') {
  return {
    elements: [
      { type: 'R', id: `Rsh1${suffix}`, nodes: ['p1', 'gnd'], value: pad.shunt },
      { type: 'R', id: `Rser${suffix}`, nodes: ['p1', 'p2'], value: pad.series },
      { type: 'R', id: `Rsh2${suffix}`, nodes: ['p2', 'gnd'], value: pad.shunt },
    ],
  }
}

/** The same pad written as three chain matrices, shunt then series then shunt. */
export const padAbcd = (pad, f) => chainAbcd([elementAbcd('Rp', pad.shunt, f), elementAbcd('R', pad.series, f), elementAbcd('Rp', pad.shunt, f)])

/** A quarter-wave section of the impedance that joins two resistances. */
export const section = (z0, RL, f0, epsr) => uniformLine({ Z0: quarterWaveZ0(z0, RL), epsr, len: phaseVelocity(epsr) / (4 * f0) })

/**
 * The series-L, shunt-C network D5 measures loss on, with a resistance in
 * series with the inductor.
 *
 * With that resistance at zero the network is lossless and S†S is the
 * identity. Turn it up and the squared magnitudes stop summing to one by
 * exactly the fraction the resistor took.
 */
export const lcNetlist = (L, Cap, Rs) => ({
  // A resistance of zero is a wire, and a wire is not a component. A resistor
  // of 1e-12 ohms in its place makes the node equations singular rather than
  // lossless, so the element is left out instead of made tiny.
  elements: [
    ...(Rs > 0 ? [{ type: 'R', id: 'Rs', nodes: ['p1', 'nm'], value: Rs }] : []),
    { type: 'L', id: 'L1', nodes: [Rs > 0 ? 'nm' : 'p1', 'p2'], value: L },
    { type: 'C', id: 'C1', nodes: ['p2', 'gnd'], value: Cap },
  ],
})

export const lcAbcd = (L, Cap, Rs, f) => chainAbcd([...(Rs > 0 ? [elementAbcd('R', Rs, f)] : []), elementAbcd('L', L, f), elementAbcd('Cp', Cap, f)])

/** The reference impedance and the frequency every experiment in this group carries. */
const refKnobs = (f = F0) => [Ref('z0', 'Reference impedance', 50, 'Every wave in this group is measured against it'), Freq('f', 'Frequency', f, 'One sine at a time, and this is the one')]

/** How many decibels the pad is designed to lose. */
const dbKnob = (def = 3) => Ratio('db', 'Attenuator loss', def, 'The decibels the pad is designed to lose, and its resistors follow from it', 0.5, 30)

export const D = [
  {
    id: 'd1',
    group: GROUP,
    kind: 'wave',
    name: 'A two-port is described by waves',
    terms: ['scattering', 'sparameter', 'terminated'],
    params: [
      Ohms('RL', 'Load resistance', 100, 'The real part of the one-port being measured', 0.1, 5000),
      React_('XL', 'Load reactance', 0, 'Negative is a capacitor, positive an inductor'),
      ...refKnobs(),
    ],
    view: 'numbers',
    views: ['numbers', 'equations', 'chart'],
    headline: (x) => ({ value: x.solvedMag, unit: '', label: 'S11 magnitude, solved' }),
  },
  {
    id: 'd2',
    group: GROUP,
    kind: 'twoport',
    name: 'S comes out of a circuit the suite solves',
    terms: ['attenuator', 'insertionloss'],
    params: [dbKnob(3), ...refKnobs(), Count('points', 'Points in the trace', 81, 'Each one a rebuild and a fresh solve')],
    view: 'numbers',
    views: ['numbers', 'sparam', 'equations', 'chart'],
    sweep: { from: 0.2e9, to: 4.2e9 },
    build(p, f) {
      const pad = piPad(p.db, p.z0)
      return {
        name: `${p.db} dB pi attenuator`,
        pad,
        elements: padNetlist(pad).elements,
        sp: sFromNetlist(padNetlist(pad), ['p1', 'p2'], f, { z0: p.z0 }),
        routes: [{ label: 'the chain matrix of the same three resistors', sp: abcdToSparam(padAbcd(pad, f), { f, z0: p.z0 }) }],
      }
    },
    headline: (x) => ({ value: x.s[21].db, unit: 'dB', label: 'Transmission through the pad' }),
  },
  {
    id: 'd3',
    group: GROUP,
    kind: 'twoport',
    name: 'One object with four descriptions',
    terms: ['chainmatrix', 'conversion'],
    params: [
      Choice(
        'object',
        'Two-port',
        'pad',
        [
          { value: 'pad', label: 'The pi attenuator' },
          { value: 'transformer', label: 'An ideal transformer' },
          { value: 'blocked', label: 'Two resistors, no path' },
        ],
        'Three two-ports, and they do not all have the same descriptions',
      ),
      dbKnob(3),
      Norm('n', 'Turns ratio', 2, 'The transformer’s ratio, and its S-matrix follows from it', 1.2, 8),
      ...refKnobs(),
    ],
    view: 'equations',
    views: ['equations', 'numbers', 'chart'],
    build(p, f) {
      if (p.object === 'transformer') {
        return { name: `ideal transformer, ratio ${p.n}`, sp: abcdToSparam(transformerAbcd(p.n), { f, z0: p.z0 }), routes: [] }
      }
      if (p.object === 'blocked') {
        const net = {
          elements: [
            { type: 'R', id: 'Rsh1', nodes: ['p1', 'gnd'], value: p.z0 },
            { type: 'R', id: 'Rsh2', nodes: ['p2', 'gnd'], value: p.z0 },
          ],
        }
        return { name: 'two shunt resistors with no path between them', elements: net.elements, sp: sFromNetlist(net, ['p1', 'p2'], f, { z0: p.z0 }), routes: [] }
      }
      const pad = piPad(p.db, p.z0)
      return {
        name: `${p.db} dB pi attenuator`,
        pad,
        elements: padNetlist(pad).elements,
        sp: sFromNetlist(padNetlist(pad), ['p1', 'p2'], f, { z0: p.z0 }),
        routes: [{ label: 'the chain matrix of the same three resistors', sp: abcdToSparam(padAbcd(pad, f), { f, z0: p.z0 }) }],
      }
    },
    headline: (x) => ({ value: x.conv.count, unit: '', label: 'Descriptions this two-port has' }),
  },
  {
    id: 'd4',
    group: GROUP,
    kind: 'twoport',
    name: 'Two-ports cascade, two ways that agree',
    terms: ['cascade'],
    params: [
      Choice(
        'chain',
        'Chain',
        'pads',
        [
          { value: 'pads', label: 'Attenuators in a row' },
          { value: 'section', label: 'A quarter-wave section' },
        ],
        'A chain of identical pads, or one line section split into halves',
      ),
      Count('stages', 'Attenuators in the chain', 2, 'Each one loses the same decibels', 1, 5),
      dbKnob(3),
      Ohms('RL', 'Load impedance', 100, 'The section is the geometric mean of this and the reference', 1, 5000),
      ...refKnobs(),
      Count('points', 'Points in the trace', 81, 'Each one a rebuild and a fresh solve'),
    ],
    view: 'sparam',
    views: ['sparam', 'numbers', 'equations', 'chart'],
    sweep: { from: 0.1e9, to: 3.1e9 },
    build(p, f) {
      if (p.chain === 'section') {
        const line = section(p.z0, p.RL, F0, EPSR)
        // The same section, split in two, cascaded back into one. Invariant 6
        // is what says those are the same object, and here it is on screen.
        const halves = [0, 1].map(() => lineSparam(line, f, { z0: p.z0, atLength: line.len / 2 }))
        return {
          name: 'a quarter-wave section, as two halves in cascade',
          line,
          blocks: halves,
          sp: chainS(halves),
          routes: [
            { label: 'the whole section in one step', sp: lineSparam(line, f, { z0: p.z0 }) },
            { label: 'the product of the two chain matrices', sp: abcdToSparam(chainAbcd([0, 1].map(() => lineAbcd(line, f, { atLength: line.len / 2 }).abcd)), { f, z0: p.z0 }) },
          ],
        }
      }
      const pad = piPad(p.db, p.z0)
      const one = sFromNetlist(padNetlist(pad), ['p1', 'p2'], f, { z0: p.z0 })
      const blocks = Array.from({ length: p.stages }, () => one)
      return {
        name: `${p.stages} attenuators of ${p.db} dB`,
        pad,
        blocks,
        sp: chainS(blocks),
        routes: [{ label: 'the product of the chain matrices', sp: abcdToSparam(chainAbcd(blocks.map(() => padAbcd(pad, f))), { f, z0: p.z0 }) }],
      }
    },
    headline: (x) => ({ value: x.s[21].db, unit: 'dB', label: 'Transmission through the chain' }),
  },
  {
    id: 'd5',
    group: GROUP,
    kind: 'twoport',
    name: 'Reciprocity, and where the power went',
    terms: ['reciprocity', 'unitary', 'dissipation'],
    params: [
      Ohms('Rs', 'Series resistance', 0, 'The only place this network can lose power', 0, 200),
      Henry('L', 'Series inductance', 8e-9, 'In series with that resistance'),
      Farad('C', 'Shunt capacitance', 1.6e-12, 'Across the output, to ground'),
      ...refKnobs(),
      Count('points', 'Points in the trace', 81, 'Each one a rebuild and a fresh solve'),
    ],
    view: 'numbers',
    views: ['numbers', 'sparam', 'equations', 'chart'],
    sweep: { from: 0.1e9, to: 4.1e9 },
    build(p, f) {
      return {
        name: 'a series inductor and a shunt capacitor',
        elements: lcNetlist(p.L, p.C, p.Rs).elements,
        sp: sFromNetlist(lcNetlist(p.L, p.C, p.Rs), ['p1', 'p2'], f, { z0: p.z0 }),
        routes: [{ label: 'the chain matrix of the same elements', sp: abcdToSparam(lcAbcd(p.L, p.C, p.Rs, f), { f, z0: p.z0 }) }],
      }
    },
    headline: (x) => ({ value: x.power.sum, unit: '', label: 'Power that comes back or gets through' }),
  },
]
