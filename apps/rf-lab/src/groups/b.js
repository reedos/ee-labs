// Group B: the Smith chart.
//
// Four experiments, and one claim. The chart is a map, its curves come out of
// that map in closed form, adding line is a rotation on it, and turning the
// picture half a turn turns impedance into admittance.
//
// Nothing here is drawn from a chart image. `packages/rf/src/smith.js` returns
// centres and radii, `SmithCanvas` turns them into pixels, and B2 is the
// experiment that shows the circles being derived.

import { NormPos, Norm, Ohms, React_, Ref } from '../knobs.js'
import { lineKnobs, loadKnobs } from './a.js'

export const GROUP = 'B · The Smith chart'

export const B = [
  {
    id: 'b1',
    group: GROUP,
    kind: 'mismatch',
    name: 'The chart is one map',
    terms: ['smithchart', 'mobius', 'normalised'],
    params: loadKnobs(100, 0),
    view: 'chart',
    views: ['chart', 'numbers'],
    // The named points every reader looks for first. Each is checked against
    // the map written out again, so the picture cannot drift from the algebra.
    landmarks: [
      { name: 'open', ZL: Infinity },
      { name: 'short', ZL: 0 },
      { name: 'match', ZL: 1 },
      { name: 'twice', ZL: 2 },
      { name: 'half', ZL: 0.5 },
      { name: 'inductor', ZL: [0, 1] },
      { name: 'capacitor', ZL: [0, -1] },
    ],
    headline: (x) => ({ value: x.place.mag, unit: '', label: 'Distance from the centre of the chart' }),
  },
  {
    id: 'b2',
    group: GROUP,
    kind: 'chart',
    name: 'The circles come out of the map',
    terms: ['constantresistance', 'constantreactance'],
    params: [
      NormPos('r', 'Normalised resistance', 1, 'The circle every impedance with this resistance sits on'),
      Norm('x', 'Normalised reactance', 1, 'The arc every impedance with this reactance sits on'),
      Ref('z0', 'Reference impedance', 50, 'What the normalising divides by'),
    ],
    view: 'chart',
    views: ['chart', 'numbers'],
    headline: (x) => ({ value: x.circles.r.radius, unit: '', label: 'Radius of the constant-resistance circle' }),
  },
  {
    id: 'b3',
    group: GROUP,
    kind: 'line',
    name: 'Adding line turns the point',
    terms: ['towardsgenerator', 'vswrcircle'],
    params: lineKnobs(0),
    view: 'chart',
    views: ['chart', 'line', 'numbers'],
    headline: (x) => ({ value: x.turn.deg, unit: '°', label: 'Angle the length of line turns' }),
  },
  {
    id: 'b4',
    group: GROUP,
    kind: 'mismatch',
    name: 'The admittance chart is the same picture',
    terms: ['admittance', 'susceptance'],
    params: [
      // A short has no finite admittance, so the knob does not reach one. The
      // admittance chart is about what a shunt element does, and a shunt
      // element across a short does nothing a reader can watch.
      Ohms('RL', 'Load resistance', 100, 'The real part of the load', 0.1, 5000),
      React_('XL', 'Load reactance', 0),
      Ref('z0', 'Reference impedance', 50),
      Norm('b', 'Shunt susceptance added', 0, 'Normalised, and a shunt element moves along one circle', -5, 5),
    ],
    view: 'chart',
    views: ['chart', 'numbers'],
    headline: (x) => ({ value: x.y[0], unit: '', label: 'Normalised conductance of the load' }),
  },
]
