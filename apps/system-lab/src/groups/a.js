// Group A: the chain as a budget.
//
// Four experiments, and one argument. A block is four numbers, decibels of gain
// add along the chain, a passive block's loss is also its noise figure, and the
// level at every node follows from those two facts.
//
// The reference chain is `SYSTEM_LAB_PLAN.md` §4.3's six blocks. Every passive
// block's noise figure is COMPUTED from its loss and its temperature rather
// than typed as 2.0 dB, because A3's whole claim is that the two are the same
// number at 290 K and different numbers anywhere else.

import { bypass } from '@ee-labs/rf'
import { Bandwidth, Choice, Dbm, Gain, Kelvin, Loss, Milliwatt, NoiseFigure } from '../knobs.js'

export const GROUP = 'A · The chain as a budget'

/** The input this lab reads its levels at: −80 dBm in a 200 kHz channel. */
export const REFERENCE_INPUT = { pinDbm: -80, bandwidthHz: 2e5 }

/**
 * The six blocks of the reference chain, at the settings a knob may move.
 *
 * A block is a record rather than a circuit, which is Decision 4. `linksTo`
 * names the experiment that would solve the circuit behind it, and stays null
 * until that lab's group is built, because a lesson may not point at an
 * experiment that does not exist.
 */
export const referenceChain = (p = {}) => [
  { id: 'presel', name: 'Preselect filter', kind: 'filter', gainDb: -2, tempK: p.tempK ?? 290 },
  { id: 'lna', name: 'Low-noise amplifier', kind: 'lna', gainDb: p.lnaGainDb ?? 15, nfDb: 1.5, iip3Dbm: -5, powerMw: 33 },
  { id: 'image', name: 'Image filter', kind: 'filter', gainDb: -2, tempK: p.tempK ?? 290 },
  { id: 'mixer', name: 'Mixer', kind: 'mixer', gainDb: p.mixerGainDb ?? 8, nfDb: 8, iip3Dbm: 5, powerMw: 45 },
  { id: 'iffilt', name: 'IF filter', kind: 'filter', gainDb: -3, tempK: p.tempK ?? 290 },
  { id: 'ifamp', name: 'IF amplifier', kind: 'amp', gainDb: p.ifGainDb ?? 22, nfDb: 10, iip3Dbm: 20, powerMw: 60 },
]

/** Which block A2 leaves out, by id. The empty string leaves the chain whole. */
const BYPASS = Choice('bypass', 'Bypass a block', '', [
  { value: '', label: 'None' },
  { value: 'presel', label: 'Preselect' },
  { value: 'lna', label: 'LNA' },
  { value: 'ifamp', label: 'IF amp' },
], 'The block is taken out of the chain, not set to unity gain')

export const A = [
  {
    id: 'a1',
    group: GROUP,
    kind: 'block',
    name: 'Four numbers describe a block',
    terms: ['dbm', 'noisefigure', 'ip3', 'worstcase'],
    params: [
      Gain('gainDb', 'Gain', 15, 'What the block multiplies the signal power by, in decibels'),
      NoiseFigure('nfDb', 'Noise figure', 1.5, 'How much worse the ratio of signal to noise is after the block'),
      Dbm('iip3Dbm', 'Input IP3', -5, 'Where the third-order product would reach the wanted signal', -40, 50),
      Milliwatt('powerMw', 'DC power', 33, 'What the block draws from the supply', 300),
    ],
    chain: (p) => [{ id: 'lna', name: 'Low-noise amplifier', kind: 'lna', gainDb: p.gainDb, nfDb: p.nfDb, iip3Dbm: p.iip3Dbm, powerMw: p.powerMw }],
    view: 'table',
    views: ['table', 'levels', 'numbers'],
    headline: (x) => ({ value: x.c.oip3Dbm, unit: 'dBm', label: 'Output IP3' }),
  },
  {
    id: 'a2',
    group: GROUP,
    kind: 'chain',
    name: 'Gain in decibels adds',
    terms: ['cascade', 'availablegain'],
    params: [
      Gain('lnaGainDb', 'Amplifier gain', 15, 'The low-noise amplifier at the front'),
      Gain('ifGainDb', 'IF amplifier gain', 22, 'The amplifier at the back'),
      BYPASS,
      Gain('mixerGainDb', 'Mixer conversion gain', 8, 'What the mixer gives between its input and its output'),
    ],
    chain: (p) => bypass(referenceChain(p), p.bypass),
    view: 'table',
    views: ['table', 'levels', 'numbers'],
    headline: (x) => ({ value: x.c.gainDb, unit: 'dB', label: 'Cumulative gain' }),
  },
  {
    id: 'a3',
    group: GROUP,
    kind: 'passive',
    name: 'A passive block is not free',
    terms: ['referencetemperature', 'thermalnoise'],
    params: [
      Loss('lossDb', 'Insertion loss', 2, 'What the filter costs the signal, quoted positive'),
      Kelvin('tempK', 'Physical temperature', 290, 'The temperature of the filter itself, not of what it sees'),
    ],
    chain: (p) => [{ id: 'presel', name: 'Preselect filter', kind: 'filter', gainDb: -p.lossDb, tempK: p.tempK }],
    view: 'numbers',
    views: ['numbers', 'table', 'levels'],
    headline: (x) => ({ value: x.c.nfDb, unit: 'dB', label: 'Noise figure' }),
  },
  {
    id: 'a4',
    group: GROUP,
    kind: 'chain',
    name: 'Where the signal is, at every node',
    terms: ['noisefloor', 'signaltonoise', 'noisebandwidth'],
    params: [
      Dbm('pinDbm', 'Input level', -80, 'What arrives at the first block'),
      Bandwidth('bandwidthHz', 'Noise bandwidth', 2e5, 'The width the noise is counted over'),
      Gain('lnaGainDb', 'Amplifier gain', 15, 'The low-noise amplifier at the front'),
      Gain('ifGainDb', 'IF amplifier gain', 22, 'The amplifier at the back'),
    ],
    chain: (p) => referenceChain(p),
    input: (p) => ({ pinDbm: p.pinDbm, bandwidthHz: p.bandwidthHz }),
    view: 'levels',
    views: ['levels', 'table', 'numbers'],
    headline: (x) => ({ value: x.v.snrOutDb, unit: 'dB', label: 'Signal-to-noise ratio at the output' }),
  },
]
