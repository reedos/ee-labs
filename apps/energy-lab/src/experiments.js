// The experiments: each is an array or a battery or a bus, the knobs on it, a
// note that makes a claim, and which pane best shows the claim.
//
// The models are data for `physics.js`, which solves them exactly. The note is
// prose, and prose drifts, so `experiments.test.js` loads every experiment at
// its defaults and measures the claim its note makes, from the same analysis
// the panes draw. A number in a note that the solver does not reproduce fails
// a test rather than misleading a reader.
//
// Groups follow ENERGY_LAB_PLAN.md §4. A is one cell and its curve, B is
// strings and what shade does to them, C is finding the maximum power point
// and holding it, D is the battery, and E is a day of the two together on one
// bus.
//
// The plan's letters live in the ids and nowhere a reader sees them.

import { LESSONS } from './lessons.js'

export const GROUPS = ['The cell', 'Strings and shade', 'Tracking', 'The battery', 'A day on one bus']

// What each group sets out to establish, read once at its boundary.
export const GROUP_INTROS = {
  'The cell': 'A photovoltaic cell is a diode with the light making a current through it. That one sentence gives the whole curve, both its intercepts, and everything that moves them.',
  'Strings and shade': 'Cells in series carry one current, so the worst of them decides what the rest may deliver. Shade one of twelve and see what it costs, then add the diode that gives the current a way round.',
  Tracking: 'The maximum power point moves with the light and a fixed load does not. This group finds it by walking the curve, then hands the job to a converter whose duty is a resistance knob.',
  'The battery': 'A cell is a store behind a resistance, and both halves are visible from the terminals. Here the state of charge is a capacitor, so it really is the integral of the current.',
  'A day on one bus': 'Put the array, the store and a load on one bus and the day has to balance. The profiles are data. Everything the balance does with them is arithmetic on exact solves.',
}

// ------------------------------------------------------------ knobs
const G = (def = 1000) => ({ key: 'G', label: 'Irradiance', unit: 'W/m²', min: 50, max: 1200, scale: 'linear', step: 10, default: def, eng: false, hint: 'Light arriving in the plane of the cell' })
const Tc = (def = 25) => ({ key: 'Tc', label: 'Cell temperature', unit: '°C', min: 0, max: 75, scale: 'linear', step: 0.5, default: def, eng: false, hint: 'The cell itself, which runs hotter than the air' })
const Load = (def, lo = 0.01, hi = 100) => ({ key: 'R', label: 'R_load', unit: 'Ω', min: lo, max: hi, scale: 'log', default: def, hint: 'The resistance across the terminals' })
const Iph = (def = 5) => ({ key: 'iph', label: 'I_ph at 1000 W/m²', unit: 'A', min: 0.5, max: 12, scale: 'linear', step: 0.1, default: def, hint: 'The photocurrent the standard condition makes' })
const Ideality = (def = 1) => ({ key: 'n', label: 'Ideality n', unit: '', min: 1, max: 2, scale: 'linear', step: 0.01, default: def, eng: false, hint: 'How far the junction is from the ideal diode law' })
const Series = (def = 12) => ({ key: 'Ns', label: 'Cells in series', unit: '', min: 1, max: 24, scale: 'linear', step: 1, default: def, eng: false, hint: 'One string of this many cells' })
const Parallel = (def = 1) => ({ key: 'Np', label: 'Strings in parallel', unit: '', min: 1, max: 4, scale: 'linear', step: 1, default: def, eng: false, hint: 'This many identical strings across the same terminals' })
const Gshade = (def = 300) => ({ key: 'Gshade', label: 'Light on the shaded cell', unit: 'W/m²', min: 0, max: 1000, scale: 'linear', step: 10, default: def, eng: false, hint: 'What reaches cell 1 while the other eleven are in full sun' })
const Duty = (def = 0.6) => ({ key: 'D', label: 'D', unit: '%', percent: true, min: 0.05, max: 0.95, scale: 'linear', step: 0.001, default: def, hint: 'The buck’s duty, which sets the resistance the array sees' })
const Step = (def = 0.2) => ({ key: 'step', label: 'Perturbation step', unit: 'V', min: 0.01, max: 0.6, scale: 'log', default: def, hint: 'How far the tracker moves the terminal each step' })
const Start = (def = 2) => ({ key: 'v0', label: 'Starting voltage', unit: 'V', min: 0.5, max: 7.5, scale: 'linear', step: 0.1, default: def, hint: 'Where the walk begins' })
const Steps = (def = 40) => ({ key: 'steps', label: 'Steps taken', unit: '', min: 10, max: 160, scale: 'linear', step: 1, default: def, eng: false, hint: 'How many perturbations to run' })
const Cur = (def = 1, lo = 0.1, hi = 10) => ({ key: 'i', label: 'Current', unit: 'A', min: lo, max: hi, scale: 'linear', step: 0.05, default: def, hint: 'Positive discharges the cell' })
const Window = (def = 1200) => ({ key: 'tEnd', label: 'Window', unit: 's', min: 60, max: 4000, scale: 'log', default: def, hint: 'How long the run lasts' })
const Soc = (def = 0.5) => ({ key: 'z0', label: 'Starting charge', unit: '', min: 0.1, max: 0.9, scale: 'linear', step: 0.01, default: def, eng: false, hint: 'State of charge before the run, inside the fit’s band' })
const Vlim = (def = 4.1) => ({ key: 'vlim', label: 'Voltage limit', unit: 'V', min: 3.9, max: 4.2, scale: 'linear', step: 0.01, default: def, hint: 'Where the charge stops raising the current and holds the terminal' })
const Bank = (def = 100) => ({ key: 'bankParallel', label: 'Cells in parallel', unit: '', min: 25, max: 200, scale: 'log', default: def, eng: false, hint: 'The bank’s width, which is its capacity' })
const Modules = (def = 30) => ({ key: 'modules', label: 'Modules', unit: '', min: 5, max: 60, scale: 'linear', step: 1, default: def, eng: false, hint: 'Panels of 36 cells on the bus' })
const Hour = (def = 12) => ({ key: 'hour', label: 'Hour', unit: '', min: 0, max: 23, scale: 'linear', step: 1, default: def, eng: false, hint: 'Which hour of the day the readout shows' })

/** A two-position knob: `on` and `off` are the texts of the two positions. */
const Toggle = (key, label, def, on, off, hint) => ({ key, label, kind: 'toggle', default: def, on, off, hint })
/** More than two positions of the same control. */
const Choice = (key, label, def, options, hint) => ({ key, label, kind: 'choice', default: def, options, hint })

const SERIES_R = Choice('Rs', 'Series resistance', 0, [
  { value: 0, label: 'absent' },
  { value: 5e-3, label: '5 mΩ' },
  { value: 20e-3, label: '20 mΩ' },
], 'The contacts and the fingers, in series with the junction')

const shuntKnob = (def) =>
  Choice('Rsh', 'Shunt resistance', def, [
    { value: 1e4, label: '10 kΩ' },
    { value: 5, label: '5 Ω' },
    { value: 1, label: '1 Ω' },
  ], 'The leakage path across the junction. A real cell always has one')
const SHUNT_R = shuntKnob(1e4)
// The shading experiments run at 5 Ω, because the shunt is this model's only
// reverse path and it is what limits the voltage a shaded cell is driven to.
// ENERGY_LAB_PLAN.md §2.4 states the guard that number carries.
const SHUNT_SHADE = shuntKnob(5)

const bypassKnob = (def) =>
  Toggle('bypass', 'Bypass diode', def, 'across the shaded cell', 'none', 'A diode that lets the string’s current go round a cell that cannot carry it')
const BYPASS = bypassKnob(false)
const BYPASS_ON = bypassKnob(true)

// ------------------------------------------------------------ views

export const VIEW_ORDER = ['iv', 'pv', 'string', 'track', 'scope', 'day', 'walk', 'profiles', 'ledger', 'reading', 'math']

// A view is either a picture or a table of numbers, and the screen shows one
// of each at once: the plot above, the panel below, as ENERGY_LAB_PLAN.md
// §3.1 lays the app out. Every experiment therefore offers at least one of
// each, which `experiments.test.js` checks rather than assumes.
export const PLOT_VIEWS = ['iv', 'pv', 'string', 'track', 'scope', 'day']
export const PANEL_VIEWS = ['walk', 'profiles', 'ledger', 'reading', 'math']
export const isPlot = (v) => PLOT_VIEWS.includes(v)

export const VIEW_LABELS = {
  iv: { label: 'I–V', title: 'Current against terminal voltage, one exact solve per point, with the load line and the maximum power rectangle' },
  pv: { label: 'P–V', title: 'Power against terminal voltage, with the maximum marked' },
  string: { label: 'String', title: 'Every cell of the string with its own voltage, so a shaded one is visible' },
  track: { label: 'Tracker', title: 'The perturb-and-observe walk drawn on the P–V curve it is climbing' },
  scope: { label: 'Scope', title: 'Terminal voltage, current and state of charge against time' },
  day: { label: 'Day', title: 'Twenty-four hours of array, load and store, with the state of charge over them' },
  walk: { label: 'Walk', title: 'The tracker’s own numbers, or the converter’s duty and both of its input currents' },
  profiles: { label: 'Hours', title: 'The day hour by hour, with the three data rows and the solves beside them' },
  ledger: { label: 'Ledger', title: 'Where the energy went, summing to what came in' },
  reading: { label: 'Reading', title: 'Every meter this experiment has at once' },
  math: { label: 'Math', title: 'Every formula the note leans on, evaluated beside what the solve measures' },
}

// ------------------------------------------------------------ shapes

const cell = (over) => ({
  kind: 'cell',
  headline: 'ff',
  params: [Load(0.11572), G(), Tc(), SERIES_R, SHUNT_R],
  views: ['iv', 'pv', 'reading', 'math'],
  view: 'iv',
  show: 'p',
  ...over,
})

const string = (over) => ({
  kind: 'string',
  headline: 'pmpp',
  params: [Load(1.3887, 0.05, 200), Series(), Parallel(), G(), SHUNT_R],
  views: ['iv', 'pv', 'string', 'reading', 'math'],
  view: 'iv',
  show: 'p',
  cell: { Ns: 12 },
  ...over,
})

const shaded = (over) => ({
  kind: 'string',
  headline: 'pmpp',
  params: [Load(1.3887, 0.05, 200), Gshade(), BYPASS, G(), SHUNT_SHADE],
  views: ['iv', 'pv', 'string', 'reading', 'math'],
  view: 'pv',
  show: 'p',
  cell: { Ns: 12, Rsh: 5 },
  shade: { k: 0, G: 300 },
  ...over,
})

const track = (over) => ({
  kind: 'track',
  headline: 'share',
  params: [Step(), Start(), Steps(), G(), Tc()],
  views: ['track', 'pv', 'walk', 'reading', 'math'],
  view: 'track',
  show: 'p',
  cell: { Ns: 12 },
  ...over,
})

const battery = (over) => ({
  kind: 'battery',
  headline: 'z',
  views: ['scope', 'ledger', 'reading', 'math'],
  view: 'scope',
  show: 'v',
  ...over,
})

export const EXPERIMENTS = [
  // ---------------------------------------------------------- A · the cell
  cell({
    id: 'a1',
    group: GROUPS[0],
    name: 'A diode in the light',
    terms: ['photocurrent', 'shortcircuit', 'opencircuit', 'singlediode'],
    view: 'reading',
    claim: { intercepts: true },
  }),
  cell({
    id: 'a2',
    group: GROUPS[0],
    name: 'The curve, one solve at a time',
    terms: ['loadline', 'operatingpoint', 'newton'],
    claim: { curve: true },
  }),
  cell({
    id: 'a3',
    group: GROUPS[0],
    name: 'The maximum power point',
    terms: ['mpp', 'operatingpoint'],
    view: 'pv',
    claim: { mpp: true },
  }),
  cell({
    id: 'a4',
    group: GROUPS[0],
    name: 'Fill factor',
    terms: ['fillfactor', 'mpp'],
    claim: { fill: true },
  }),
  cell({
    id: 'a5',
    group: GROUPS[0],
    name: 'Series resistance pulls the knee in',
    terms: ['seriesresistance', 'fillfactor'],
    params: [SERIES_R, Load(0.11572), G(), Tc(), SHUNT_R],
    claim: { series: true },
  }),
  cell({
    id: 'a6',
    group: GROUPS[0],
    name: 'Shunt resistance tilts the top',
    terms: ['shuntresistance', 'fillfactor'],
    params: [SHUNT_R, Load(0.11572), G(), Tc(), SERIES_R],
    claim: { shunt: true },
  }),
  cell({
    id: 'a7',
    group: GROUPS[0],
    name: 'Irradiance: one linear, one logarithmic',
    terms: ['photocurrent', 'thermalvoltage'],
    params: [G(), Load(0.11572), Tc(), SERIES_R, SHUNT_R],
    claim: { light: true },
  }),
  cell({
    id: 'a8',
    group: GROUPS[0],
    name: 'Temperature, and the law behind it',
    terms: ['thermalvoltage', 'saturationcurrent', 'bandgap'],
    params: [Tc(), G(), Load(0.11572), SERIES_R, SHUNT_R],
    claim: { temperature: true },
  }),

  // ------------------------------------------------- B · strings and shade
  string({
    id: 'b1',
    group: GROUPS[1],
    name: 'Twelve cells in series',
    terms: ['string', 'mpp'],
    view: 'string',
    claim: { series12: true },
  }),
  string({
    id: 'b2',
    group: GROUPS[1],
    name: 'Three strings in parallel',
    terms: ['string', 'mpp'],
    params: [Parallel(3), Load(0.4629, 0.05, 200), Series(), G(), SHUNT_R],
    cell: { Ns: 12, Np: 3 },
    claim: { parallel: true },
  }),
  shaded({
    id: 'b3',
    group: GROUPS[1],
    name: 'One shaded cell of twelve',
    terms: ['shading', 'string'],
    claim: { shade: true },
  }),
  shaded({
    id: 'b4',
    group: GROUPS[1],
    name: 'The hot spot',
    terms: ['shading', 'hotspot', 'breakdown'],
    params: [{ key: 'I', label: 'String current', unit: 'A', min: 0.1, max: 4.9, scale: 'linear', step: 0.01, default: 4.77793, hint: 'The current something outside is forcing through the string' }, Gshade(), BYPASS, SHUNT_SHADE],
    drive: 'i',
    view: 'string',
    claim: { hotspot: true },
  }),
  shaded({
    id: 'b5',
    group: GROUPS[1],
    name: 'The bypass diode, and two maxima',
    terms: ['bypass', 'shading', 'mpp'],
    params: [BYPASS_ON, Gshade(), Load(1.3887, 0.05, 200), SHUNT_SHADE],
    bypass: [0],
    view: 'pv',
    claim: { bypass: true },
  }),

  // ------------------------------------------------------------ C · tracking
  {
    ...string({
      id: 'c1',
      group: GROUPS[2],
      name: 'A resistor cannot follow the sun',
      terms: ['loadline', 'mpp'],
      params: [G(), Load(1.3887, 0.05, 200), Tc(), SHUNT_R],
      view: 'iv',
      claim: { fixed: true },
    }),
    headline: 'share',
  },
  track({
    id: 'c2',
    group: GROUPS[2],
    name: 'Perturb and observe',
    terms: ['mppt', 'perturbobserve'],
    claim: { walk: true },
  }),
  track({
    id: 'c3',
    group: GROUPS[2],
    name: 'The dither is the price',
    terms: ['mppt', 'dither'],
    params: [Step(), Steps(60), Start(), G()],
    claim: { dither: true },
  }),
  track({
    id: 'c4',
    group: GROUPS[2],
    name: 'Step size, both ways',
    terms: ['mppt', 'dither'],
    params: [Step(0.4), Steps(120), Start(), G()],
    claim: { stepsize: true },
  }),
  {
    kind: 'buck',
    id: 'c5',
    group: GROUPS[2],
    name: 'The buck is the resistance knob',
    terms: ['mppt', 'buck', 'inputresistance'],
    headline: 'share',
    params: [
      Duty(0.6),
      { key: 'R', label: 'R_load', unit: 'Ω', min: 0.1, max: 5, scale: 'log', default: 0.5, hint: 'What the converter drives' },
      { key: 'L', label: 'L', unit: 'H', min: 10e-6, max: 1e-3, scale: 'log', default: 100e-6, hint: 'The buck’s inductor' },
      { key: 'C', label: 'C', unit: 'F', min: 10e-6, max: 1e-3, scale: 'log', default: 100e-6, hint: 'The buck’s output capacitor' },
      { key: 'fs', label: 'f_s', unit: 'Hz', min: 20e3, max: 1e6, scale: 'log', default: 100e3, hint: 'Switching frequency' },
      G(),
    ],
    cell: { Ns: 12 },
    views: ['pv', 'iv', 'walk', 'reading', 'math'],
    view: 'pv',
    show: 'p',
    claim: { buck: true },
  },

  // ------------------------------------------------------------ D · battery
  battery({
    id: 'd1',
    group: GROUPS[3],
    name: 'The ladder, and the instant',
    terms: ['equivalentcircuit', 'internalresistance', 'timeconstant'],
    params: [Cur(1), Window(1200), Soc(0.5)],
    claim: { ladder: true },
  }),
  battery({
    id: 'd2',
    group: GROUPS[3],
    name: 'Charge is the integral of the current',
    terms: ['stateofcharge', 'capacity'],
    params: [Cur(1), Window(1200), Soc(0.5)],
    claim: { charge: true },
  }),
  battery({
    id: 'd3',
    group: GROUPS[3],
    name: 'What the resistance costs',
    terms: ['internalresistance', 'timeconstant'],
    params: [Cur(1), Window(1200), Soc(0.5)],
    view: 'ledger',
    claim: { cost: true },
  }),
  battery({
    id: 'd4',
    group: GROUPS[3],
    name: 'The round trip',
    terms: ['roundtrip', 'internalresistance'],
    mode: 'round',
    params: [Cur(2), { key: 'tEnd', label: 'Half-cycle', unit: 's', min: 120, max: 1800, scale: 'log', default: 900, hint: 'How long each half of the cycle lasts' }, Soc(0.5)],
    view: 'ledger',
    claim: { round: true },
  }),
  battery({
    id: 'd5',
    group: GROUPS[3],
    name: 'Constant current, then constant voltage',
    terms: ['cccv', 'stateofcharge'],
    mode: 'cccv',
    params: [Cur(2), Vlim(), { key: 'tEnd', label: 'Window', unit: 's', min: 600, max: 8000, scale: 'log', default: 4000 }, Soc(0.2)],
    claim: { cccv: true },
  }),

  // ------------------------------------------------------------ E · the day
  {
    kind: 'day',
    id: 'e1',
    group: GROUPS[4],
    name: 'The profiles are data',
    terms: ['labelleddata', 'irradiance'],
    headline: 'served',
    params: [Hour(), Modules(), Bank()],
    views: ['day', 'profiles', 'ledger', 'reading', 'math'],
    view: 'profiles',
    show: 'p',
    claim: { profiles: true },
  },
  {
    kind: 'day',
    id: 'e2',
    group: GROUPS[4],
    name: 'The balance closes',
    terms: ['curtailment', 'labelleddata'],
    headline: 'served',
    params: [Modules(), Bank(), Hour()],
    views: ['ledger', 'day', 'profiles', 'reading', 'math'],
    view: 'ledger',
    show: 'p',
    claim: { balance: true },
  },
  {
    kind: 'day',
    id: 'e3',
    group: GROUPS[4],
    name: 'The store is the constraint',
    terms: ['curtailment', 'unserved'],
    headline: 'served',
    params: [Bank(), Modules(), Hour()],
    views: ['day', 'profiles', 'ledger', 'reading', 'math'],
    view: 'day',
    show: 'p',
    claim: { store: true },
  },
]

// What the student reads lives in lessons.js: `see` at the defaults, `try` as
// knob moves with their readings, and `why` as the reasoning. `note` is the
// two prose registers run together, for the places that quote one paragraph.
for (const e of EXPERIMENTS) {
  const lesson = LESSONS[e.id]
  if (!lesson) throw new Error(`no lesson for ${e.id}`)
  Object.assign(e, lesson)
  e.note = `${lesson.see} ${lesson.why}`
}

export const byId = Object.fromEntries(EXPERIMENTS.map((e) => [e.id, e]))

/** The default setting of every knob an experiment has. */
export function defaultsOf(id) {
  const e = typeof id === 'string' ? byId[id] : id
  return Object.fromEntries(e.params.map((k) => [k.key, k.default]))
}

/** The groups in order, each with its experiments. */
export const byGroup = GROUPS.map((g) => ({ group: g, items: EXPERIMENTS.filter((e) => e.group === g) }))
