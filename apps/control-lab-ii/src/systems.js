import { polyMul, toStateSpace } from '@ee-labs/systems'
import { toTransferFunction } from '@ee-labs/systems'

// The plants, the controllers and the one nonlinearity.
//
// The plants are Control Lab's, so a reader arriving from there recognises every
// picture. What this file adds is a second description of each one. A plant
// carries both its transfer function and its state space, and the state space is
// written in a PHYSICAL basis, where each state has a name and a unit.
//
// That pairing is the subject of Group A. The controllable canonical form that
// `toStateSpace` builds is a perfectly good state space and its states are not
// anything in particular. The motor's position and speed are. Both give the same
// transfer function, and A3 measures that they do.

const P = (key, label, value, min, max, unit = '', scale = 'log') => ({
  key,
  label,
  value,
  min,
  max,
  unit,
  scale,
})

export const PLANT_GROUPS = ['First order', 'Two states', 'Hard to control', 'Not fully connected']

export const PLANTS = {
  firstOrder: {
    name: 'First order lag',
    group: 'First order',
    hint:
      'An RC network, a tank filling through a valve, a rail settling after a load step. One state, and that ' +
      'state is the output. Sampling it is where Group B starts, because a loop with one pole and one gain ' +
      'cannot be destabilised in continuous time, and a computer in the path destabilises it anyway.',
    params: [P('k', 'Gain K', 1, 0.001, 1e6), P('tau', 'Time constant τ', 1, 1e-4, 100, 's')],
    tf: (p) => ({ b: [p.k], a: [p.tau, 1] }),
    ss: (p) => ({ A: [[-1 / p.tau]], B: [p.k / p.tau], C: [1], D: 0, n: 1 }),
    states: [{ name: 'Output', symbol: 'y', unit: '' }],
    tex: 'P(s) = \\frac{K}{1 + \\tau s}',
  },

  motor: {
    name: 'Motor position',
    group: 'Two states',
    hint:
      'A DC motor under voltage drive, with position as the output. Two states with names. The speed is what ' +
      'the winding\'s lag sets, and the position is the speed integrated. Every state-space experiment in ' +
      'Group A runs on this plant, because a state whose name is "speed" is easier to reason about than a ' +
      'state whose name is x₂.',
    params: [P('k', 'Gain K', 1, 0.001, 1e6), P('tau', 'Time constant τ', 0.5, 1e-4, 100, 's')],
    tf: (p) => ({ b: [p.k], a: [p.tau, 1, 0] }),
    ss: (p) => ({
      A: [
        [0, 1],
        [0, -1 / p.tau],
      ],
      B: [0, p.k / p.tau],
      C: [1, 0],
      D: 0,
      n: 2,
    }),
    states: [
      { name: 'Position', symbol: 'y', unit: 'rad' },
      { name: 'Speed', symbol: 'v', unit: 'rad/s' },
    ],
    tex: 'P(s) = \\frac{K}{s(1 + \\tau s)}',
  },

  threePole: {
    name: 'Three lags',
    group: 'Hard to control',
    hint:
      'Three buffered RC stages in series. Together they reach −180° of phase while the gain is still above ' +
      'one, which is the condition for the loop to oscillate. Group D puts a saturating actuator in front of ' +
      'it and watches the oscillation stop growing.',
    params: [
      P('k', 'Gain K', 1, 0.001, 1e6),
      P('t1', 'τ₁', 1, 1e-4, 100, 's'),
      P('t2', 'τ₂', 0.5, 1e-4, 100, 's'),
      P('t3', 'τ₃', 0.25, 1e-4, 100, 's'),
    ],
    tf: (p) => ({ b: [p.k], a: polyMul(polyMul([p.t1, 1], [p.t2, 1]), [p.t3, 1]) }),
    ss: (p) => toStateSpace({ b: [p.k], a: polyMul(polyMul([p.t1, 1], [p.t2, 1]), [p.t3, 1]) }),
    states: [
      { name: 'State 1', symbol: 'x₁', unit: '' },
      { name: 'State 2', symbol: 'x₂', unit: '' },
      { name: 'State 3', symbol: 'x₃', unit: '' },
    ],
    tex: 'P(s) = \\frac{K}{(1+\\tau_1 s)(1+\\tau_2 s)(1+\\tau_3 s)}',
  },

  twoLag: {
    name: 'Two lags',
    group: 'Two states',
    hint:
      'Two buffered RC stages, and the plant Group E fits a model to. Its step looks first order to the eye ' +
      'and is not, which is the whole of that group\'s subject.',
    params: [
      P('k', 'Gain K', 1, 0.001, 1e6),
      P('t1', 'τ₁', 0.7, 1e-4, 100, 's'),
      P('t2', 'τ₂', 0.13, 1e-4, 100, 's'),
    ],
    tf: (p) => ({ b: [p.k], a: polyMul([p.t1, 1], [p.t2, 1]) }),
    ss: (p) => ({
      A: [
        [-1 / p.t1, 0],
        [1 / p.t2, -1 / p.t2],
      ],
      B: [p.k / p.t1, 0],
      C: [0, 1],
      D: 0,
      n: 2,
    }),
    states: [
      { name: 'First stage', symbol: 'x₁', unit: '' },
      { name: 'Second stage', symbol: 'x₂', unit: '' },
    ],
    tex: 'P(s) = \\frac{K}{(1+\\tau_1 s)(1+\\tau_2 s)}',
  },

  twin: {
    name: 'Twin sections',
    group: 'Not fully connected',
    hint:
      'Two lags driven by the same input, measured as their difference. With the two time constants equal, no ' +
      'input can ever make them differ, so one state combination is out of reach. The detuning knob puts the ' +
      'rank back and shows what "nearly unreachable" costs.',
    params: [
      P('tau', 'Time constant τ', 1, 1e-4, 100, 's'),
      P('detune', 'Detuning of the second', 0, 0, 0.5, '', 'linear'),
    ],
    tf: (p) =>
      toTransferFunction({
        A: [
          [-1 / p.tau, 0],
          [0, -1 / (p.tau * (1 + p.detune))],
        ],
        B: [1, 1],
        C: [1, -1],
        D: 0,
      }),
    ss: (p) => ({
      A: [
        [-1 / p.tau, 0],
        [0, -1 / (p.tau * (1 + p.detune))],
      ],
      B: [1, 1],
      C: [1, -1],
      D: 0,
      n: 2,
    }),
    states: [
      { name: 'First section', symbol: 'x₁', unit: 'V' },
      { name: 'Second section', symbol: 'x₂', unit: 'V' },
    ],
    tex: 'x_1\' = -x_1/\\tau + u, \\quad x_2\' = -x_2/\\tau_2 + u, \\quad y = x_1 - x_2',
  },

  split: {
    name: 'Split sections',
    group: 'Not fully connected',
    hint:
      'Two lags with different time constants, driven together, with only the first one measured. Every input ' +
      'reaches both, so the plant is controllable. The output carries no trace of the second, so it is not ' +
      'observable, and no observer can estimate a state that leaves no trace.',
    params: [P('t1', 'τ₁', 1, 1e-4, 100, 's'), P('t2', 'τ₂', 0.2, 1e-4, 100, 's')],
    tf: (p) => ({ b: [1], a: [p.t1, 1] }),
    ss: (p) => ({
      A: [
        [-1 / p.t1, 0],
        [0, -1 / p.t2],
      ],
      B: [1, 1],
      C: [1, 0],
      D: 0,
      n: 2,
    }),
    states: [
      { name: 'Measured section', symbol: 'x₁', unit: 'V' },
      { name: 'Hidden section', symbol: 'x₂', unit: 'V' },
    ],
    tex: 'y = x_1 \\text{ only}',
  },
}

export const CONTROLLERS = {
  p: {
    name: 'Proportional',
    hint:
      'Output proportional to error. In Group B it is the whole controller, because a plant with one pole and ' +
      'a proportional gain is the simplest loop a computer can break.',
    params: [P('kp', 'Kp', 1, 0.001, 1000, '', 'linear')],
    tf: (c) => ({ b: [c.kp], a: [1] }),
    ss: (c) => ({ A: [], B: [], C: [], D: c.kp, n: 0 }),
    tex: 'C(s) = K_p',
  },
  lag: {
    name: 'Filtered gain',
    hint:
      'A gain with a first-order filter on it, which is what a real controller has so that measurement noise ' +
      'does not reach the actuator. Its own pole is what B7 emulates three ways, because a fast pole is where ' +
      'the three rules stop agreeing with each other.',
    params: [P('kc', 'Kc', 1, 0.001, 1000, '', 'linear'), P('p', 'Filter pole', 100, 0.1, 1e5, 'rad/s')],
    tf: (c) => ({ b: [c.kc * c.p], a: [1, c.p] }),
    ss: (c) => ({ A: [[-c.p]], B: [c.p], C: [c.kc], D: 0, n: 1 }),
    tex: 'C(s) = \\frac{K_c}{1 + s/p}',
  },
  pi: {
    name: 'PI',
    hint:
      'A proportional term and an integrator. The integrator drives the steady-state error to zero and gives ' +
      'the loop a state of its own, which is the second axis of Group C\'s phase plane.',
    params: [P('kp', 'Kp', 2, 0.001, 1000, '', 'linear'), P('ki', 'Ki', 4, 0.001, 1000, '', 'linear')],
    tf: (c) => ({ b: [c.kp, c.ki], a: [1, 0] }),
    ss: (c) => ({ A: [[0]], B: [1], C: [c.ki], D: c.kp, n: 1 }),
    tex: 'C(s) = K_p + \\frac{K_i}{s}',
  },
}

export const NONLINEARITIES = {
  none: { name: 'None', hint: 'The loop is linear, and every tool in Control Lab applies to it unchanged.' },
  saturation: {
    name: 'Saturation',
    hint:
      'An actuator that runs out of travel. The slope is 1 up to the limit and flat beyond it. It is made of ' +
      'three straight segments, which is what lets the trajectory be exact rather than integrated.',
  },
  deadzone: {
    name: 'Deadzone',
    hint:
      'An actuator that does nothing until it is asked hard enough. Static friction, a valve that has to ' +
      'crack open, the first step of a quantiser. The same three segments, in the other arrangement.',
  },
}

/** Every default of a registry entry, as one parameter object. */
export const defaultsOf = (defs) => {
  const out = {}
  for (const p of defs.params || []) out[p.key] = p.value
  return out
}

/**
 * The open loop, the closed loop and the error path, exactly as Control Lab
 * composes them. Normalised so the open loop's leading denominator coefficient
 * is one, which is the rule every instrument in the suite expects.
 */
export function buildLoop(plantId, plantP, ctrlId, ctrlP) {
  const norm = (tf) => {
    const g = tf.a[0]
    if (!Number.isFinite(g) || g === 0 || g === 1) return tf
    return { b: tf.b.map((v) => v / g), a: tf.a.map((v) => v / g) }
  }
  const plant = PLANTS[plantId].tf(plantP)
  const ctrl = CONTROLLERS[ctrlId].tf(ctrlP)
  const open = norm({ b: polyMul(ctrl.b, plant.b), a: polyMul(ctrl.a, plant.a) })
  return { plant, ctrl, open }
}
