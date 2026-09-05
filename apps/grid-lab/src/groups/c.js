// Group C: the line and the transformer. GRID_LAB_PLAN.md §5, group C.

import { Km, Loading, Xtx, Pload, Qload, Tap, Bsh } from './shared.js'

const line = (over) => ({
  kind: 'line',
  group: 'The line and the transformer',
  network: 'twoBus',
  views: ['lineplot', 'oneline', 'reading', 'math'],
  view: 'lineplot',
  ...over,
})

export const GROUP_C = [
  line({
    id: 'c1',
    name: 'The line as a π model',
    terms: ['pimodel', 'charging', 'perunit'],
    params: [Km(), Xtx(), Pload(), Qload()],
    claim: { pi: true },
  }),
  line({
    id: 'c2',
    name: 'Surge impedance loading',
    terms: ['surgeimpedance', 'charging'],
    params: [Loading(), Km(200), Xtx(), Pload()],
    claim: { sil: true },
  }),
  line({
    id: 'c3',
    name: 'Where the π model stops',
    terms: ['pimodel', 'longline', 'ferranti'],
    params: [Km(200), Loading(), Xtx(), Pload()],
    claim: { longline: true },
  }),
  line({
    id: 'c4',
    name: 'The transformer’s drop, and the two ways to fix it',
    terms: ['voltagedrop', 'tapchanger', 'shuntcompensation'],
    params: [Xtx(), Qload(), Tap(), Bsh(), Pload()],
    view: 'oneline',
    claim: { drop: true },
    // The core the winding sits on is Power Lab's Group D, planned with no
    // overseer, so the reference is named and deferred.
    crossRef: { lab: 'power-lab', id: 'd1', why: 'the magnetic core a transformer winding sits on' },
  }),
]
