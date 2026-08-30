import { PLANTS, CONTROLLERS, defaultsOf } from './systems.js'

// The curriculum.
//
// Control Lab opened with six plants and four controllers and no reason to pick
// any of them. These are the questions worth asking in that order, each loading
// a setup where the answer is visible rather than described.
//
// Every note makes a claim and lessons.test.js measures it — the same discipline
// that caught a rule of thumb I had wrongly presented as an identity three
// commits ago.

const pp = (id, over = {}) => ({ ...defaultsOf(PLANTS[id]), ...over })
const cp = (id, over = {}) => ({ ...defaultsOf(CONTROLLERS[id]), ...over })

export const LESSON_GROUPS = ['What feedback buys', 'Losing stability', 'Reading the loop', 'Harder plants']

export const LESSONS = [
  // ------------------------------------------------- What feedback buys
  {
    group: 'What feedback buys',
    name: 'Proportional cannot get there',
    note:
      'A plain lag under proportional control, with the gain already at 9. The output settles ' +
      'at 90% of where it was asked to go and stays there — because the controller drives the ' +
      'plant with the error, so zero error would mean zero drive, and nothing would hold it. ' +
      'Raise Kp and the gap shrinks but never closes.',
    terms: ['steadystate'],
    patch: { plant: 'firstOrder', plantP: pp('firstOrder'), ctrl: 'p', ctrlP: cp('p', { kp: 9 }), view: 'step' },
  },
  {
    group: 'What feedback buys',
    name: 'The integrator closes the gap',
    note:
      'The same plant, now with an integral term. The error goes to exactly zero, because the ' +
      'integral keeps accumulating for as long as any error remains — it stops growing only ' +
      'when there is nothing left to grow on. That is what an integrator buys, and it is not ' +
      'an approximation.',
    terms: ['integrator', 'steadystate'],
    patch: { plant: 'firstOrder', plantP: pp('firstOrder'), ctrl: 'pi', ctrlP: cp('pi'), view: 'step' },
  },
  {
    group: 'What feedback buys',
    name: 'A shove at the plant input',
    note:
      'The reference step asks "can it follow orders". This asks the better question: a ' +
      'disturbance lands on the PLANT — a gust, a load, a warm-up drift — and the loop has to ' +
      'fight it off. Under proportional control the shove leaves a permanent offset of ' +
      'P(0)/(1+L(0)): shrunk, not removed. Switch to PI and the offset is erased exactly — the ' +
      'integral winds up until nothing of the shove remains. THAT is why feedback exists; ' +
      'following a setpoint is the easy half.',
    terms: ['disturbance', 'integrator'],
    patch: {
      plant: 'firstOrder',
      plantP: pp('firstOrder'),
      ctrl: 'p',
      ctrlP: cp('p', { kp: 9 }),
      view: 'step',
      stepInput: 'dist',
    },
  },
  {
    group: 'What feedback buys',
    name: '...and what it costs',
    note:
      'Nothing is free. An integrator contributes −90° of phase at every frequency, so the loop ' +
      'now reaches −180° sooner and has less margin before it oscillates. Switch between ' +
      'Proportional and PI and watch the phase margin in the top bar fall.',
    // ki 2, not 4: at ki 4 this exact loop has poles AT ±2j — a 0.0° margin,
    // an UNSTABLE badge, and a step that rings forever under a note calmly
    // discussing margins. ki 2 leaves 19° — thin enough to feel, still a loop.
    terms: ['integrator', 'phasemargin', 'crossover'],
    patch: { plant: 'motor', plantP: pp('motor'), ctrl: 'pi', ctrlP: cp('pi', { kp: 2, ki: 2 }), view: 'step' },
  },

  // --------------------------------------------------- Losing stability
  {
    group: 'Losing stability',
    name: 'Turn it up until it sings',
    note:
      'Three lags, each costing up to 90° of phase — 45° already spent at its corner. Together ' +
      'they can reach −180° while the gain is still above one — and at that point the feedback ' +
      'that was subtracting starts adding. Drag Kp upward and watch the step response go from ' +
      'sluggish, to lively, to ringing, to divergent.',
    terms: ['pole', 'phasemargin'],
    patch: { plant: 'threePole', plantP: pp('threePole'), ctrl: 'p', ctrlP: cp('p', { kp: 4 }), view: 'step' },
  },
  {
    group: 'Losing stability',
    name: 'The margin says exactly how far',
    note:
      'The gain margin in the top bar is not a guideline. It is the factor by which Kp can rise ' +
      'before the loop is on the edge of oscillating: multiply Kp by it and the loop sits ' +
      'exactly on the boundary. Try 0.9 of it, then 1.1 of it, and watch the verdict flip.',
    terms: ['gainmargin', 'db'],
    patch: { plant: 'threePole', plantP: pp('threePole'), ctrl: 'p', ctrlP: cp('p', { kp: 1 }), view: 'step' },
  },
  {
    group: 'Losing stability',
    name: 'Watch the poles cross',
    note:
      'The same loss of stability, seen as pole positions. Each branch traces where a ' +
      'closed-loop pole travels as the gain sweeps, and the moment a branch enters the shaded ' +
      'half is the moment the loop starts oscillating. Nothing sudden happens to the plant — ' +
      'the poles simply walk across a line.',
    terms: ['pole', 'rootlocus'],
    patch: { plant: 'threePole', plantP: pp('threePole'), ctrl: 'p', ctrlP: cp('p', { kp: 4 }), view: 'locus' },
  },

  // -------------------------------------------------- Reading the loop
  {
    group: 'Reading the loop',
    name: 'Everything is about one point',
    note:
      'The Nyquist view plots the open loop on the complex plane against −1. That single point ' +
      'is the whole of stability: 1 + L = 0 means L = −1, so a loop passing through it returns ' +
      'a signal inverted and the same size it went out. The margins become distances you can ' +
      'see — how far the curve misses −1, and how far round the circle it is when it crosses.',
    terms: ['nyquistplot', 'phasemargin', 'gainmargin'],
    patch: { plant: 'threePole', plantP: pp('threePole'), ctrl: 'p', ctrlP: cp('p', { kp: 4 }), view: 'nyquist' },
  },
  {
    group: 'Reading the loop',
    name: 'A margin thin enough to feel',
    note:
      'Phase margin is 25° here. The rule of thumb — phase margin in degrees is about a hundred ' +
      'times the damping ratio — predicts ζ ≈ 0.25, and the actual ζ is 0.22, which overshoots ' +
      '49% rather than the 44% a true 0.25 would give. That gap IS the rule of thumb: close ' +
      'enough to design with, not an identity. The math panel says when it applies at all.',
    terms: ['phasemargin', 'zeta', 'overshoot'],
    patch: { plant: 'motor', plantP: pp('motor'), ctrl: 'p', ctrlP: cp('p', { kp: 10 }), view: 'step' },
  },

  // ------------------------------------------------------ Harder plants
  {
    group: 'Harder plants',
    name: 'The plant that needs feedback',
    note:
      'A pole in the right half plane: an inverted pendulum, a fighter airframe, a magnetic ' +
      'bearing. Left alone it runs away exponentially. Here feedback is not an improvement, it ' +
      'is the only reason the thing works at all — and the failure mode is inverted. Turn the ' +
      'gain DOWN and it falls over.',
    terms: ['rhp', 'pole'],
    patch: { plant: 'unstable', plantP: pp('unstable'), ctrl: 'p', ctrlP: cp('p', { kp: 5 }), view: 'step' },
  },
  {
    group: 'Harder plants',
    name: 'Derivative buys the phase back',
    note:
      'A resonant plant that proportional control alone makes worse. Derivative action responds ' +
      'to where the error is heading rather than where it is, which adds phase exactly where ' +
      'the loop is short of it. Set Kd to zero and back, and watch the margin and the overshoot ' +
      'move together. Real derivative terms are always filtered, because this also amplifies noise.',
    terms: ['zero', 'phasemargin', 'overshoot'],
    patch: {
      plant: 'secondOrder',
      plantP: pp('secondOrder', { zeta: 0.15 }),
      ctrl: 'pid',
      ctrlP: cp('pid', { kp: 2, ki: 1, kd: 0.2 }),
      view: 'step',
    },
  },
  {
    group: 'Harder plants',
    name: 'Lead does it without the noise',
    note:
      'A lead network adds phase between its zero and its pole, peaking at their geometric mean ' +
      '— but unlike a derivative its gain stops rising above the pole, so it does not amplify ' +
      'high-frequency noise without limit. That bounded high end is the entire reason to prefer ' +
      'it, and it is visible on the open-loop plot.',
    terms: ['zero', 'pole', 'radpersec'],
    patch: {
      plant: 'threePole',
      plantP: pp('threePole'),
      ctrl: 'lead',
      ctrlP: cp('lead', { k: 3, z: 1, p: 20 }),
      view: 'step',
    },
  },
]

/** Apply a lesson to the app's state shape. */
export function applyLesson(l) {
  return {
    plantId: l.patch.plant,
    plantP: l.patch.plantP,
    ctrlId: l.patch.ctrl,
    ctrlP: l.patch.ctrlP,
    view: l.patch.view || 'step',
    stepInput: l.patch.stepInput || 'ref',
  }
}
