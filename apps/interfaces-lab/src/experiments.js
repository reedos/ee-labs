import { DEFAULTS } from './pin.js'

export const GROUPS = ['A. The pin']
export const MODELS = [
  { id: 'pin.pp', name: 'Push-pull output', drive: 'push-pull' },
  { id: 'pin.in', name: 'CMOS receiver limits', drive: 'push-pull' },
  { id: 'pin.od', name: 'Open-drain output', drive: 'open-drain' },
]
export const KNOBS = {
  ron: { label: 'On resistance', unit: 'ohm', min: 5, max: 100, step: 1, presets: [10, 25, 50, 100] },
  rpu: { label: 'Pull-up resistance', unit: 'ohm', min: 500, max: 100000, scale: 'log', presets: [1000, 4700, 10000] },
  cload: { label: 'Load capacitance', unit: 'F', min: 10e-12, max: 1e-9, scale: 'log', presets: [10e-12, 50e-12, 200e-12, 500e-12] },
  vdd: { label: 'Supply VDD', unit: 'V', min: 1.8, max: 5, step: 0.1, presets: [1.8, 3.3, 5] },
  vt: { label: 'Device threshold Vt', unit: 'V', min: 0.2, max: 0.9, step: 0.05, presets: [0.5, 0.7, 0.9] },
  riseBudget: { label: 'Rise budget', unit: 's', min: 1e-9, max: 20e-6, scale: 'log', presets: [5e-9, 10e-9, 20e-9] },
  loadCurrent: { label: 'Static load current', unit: 'A', min: 0, max: 20e-3, step: 1e-3, presets: [0, 8e-3, 16e-3] },
  inductance: { label: 'Return inductance', unit: 'H', min: 0, max: 10e-9, step: 0.5e-9, presets: [0, 2e-9, 5e-9] },
  edgeTime: { label: 'Current ramp time', unit: 's', min: 0.5e-9, max: 50e-9, scale: 'log', presets: [2e-9, 5e-9, 10e-9, 20e-9] },
  pins: { label: 'Switching pins', unit: '', min: 1, max: 32, step: 1, presets: [1, 3, 4, 8] },
}

export const EXPERIMENTS = [
  { id: 'a1', name: 'The output is two switches', model: 'pin.pp', knobs: ['ron', 'cload', 'vdd'], terms: ['pin', 'pushPull', 'timeConstant'], refs: ['d5'] },
  { id: 'a2', name: 'The input has two thresholds', model: 'pin.in', knobs: ['vdd', 'vt', 'ron', 'cload'], terms: ['cmosInput', 'inverter', 'thresholds', 'timeConstant'], refs: ['d6'] },
  { id: 'a3', name: 'The pull-up sets the rise', model: 'pin.od', knobs: ['rpu', 'ron', 'cload', 'vdd'], terms: ['openDrain', 'thresholds'], refs: ['d5', 'd6'] },
  { id: 'a4', name: 'Capacitance sets the rise time', model: 'pin.pp', knobs: ['cload', 'ron', 'riseBudget'], terms: ['riseTime', 'timeConstant'], refs: ['d5'] },
  { id: 'a5', name: 'Ground bounce consumes noise margin', model: 'pin.pp', knobs: ['loadCurrent', 'pins', 'edgeTime', 'inductance', 'ron', 'vdd'], terms: ['noiseMargin', 'groundBounce'], refs: ['d6'] },
].map((e) => ({ ...e, group: GROUPS[0] }))
export const byId = Object.fromEntries(EXPERIMENTS.map((e) => [e.id, e]))
export const defaultsOf = (id) => ({ ...DEFAULTS, drive: MODELS.find((m) => m.id === byId[id].model).drive })

const wire = (...points) => ({ wire: points })
export function pinLayout(drive) {
  return { w: 460, h: 265, items: [
    wire(55, 30, 230, 30), wire(55, 30, 55, 110),
    { el: 'VDD', x: 55, y: 130, dir: 'v' }, wire(55, 150, 55, 230),
    wire(230, 30, 230, 60), { el: drive === 'open-drain' ? 'Rpu' : 'SH', x: 230, y: 80, dir: 'v' },
    wire(230, 100, 230, 160), { el: 'SL', x: 230, y: 180, dir: 'v' }, wire(230, 200, 230, 230),
    wire(230, 130, 365, 130), wire(365, 130, 365, 160),
    { el: 'Cload', x: 365, y: 180, dir: 'v' }, wire(365, 200, 365, 230),
    wire(55, 230, 365, 230), { gnd: [150, 230] },
    { node: 'pin', x: 330, y: 130, side: 't' }, { node: 'vdd', x: 125, y: 30, side: 't' },
  ] }
}
