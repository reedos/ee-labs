// Group E: the DC power flow, and the guard that governs it.

export const LESSONS_E = {
  e1: {
    see:
      'Drop every resistance, pin every magnitude at 1.00 pu, and replace the sine of each angle by the ' +
      'angle. What is left is one linear solve. It gives −1.41677° and −4.75034° against the true ' +
      '−1.49154° and −4.75867°, so the largest angle error is 0.0747711°.',
    seeReads: [
      ['dc.theta.bus2', -1.41677],
      ['dc.theta.bus3', -4.75034],
      ['bus.bus2.deg', -1.491539],
      ['bus.bus3.deg', -4.75867],
      ['dc.angleError', 0.0747711],
    ],
    try: [
      {
        say: 'Halve the loading. Both solves halve with it, and the largest angle error falls to 0.0249740°.',
        set: { load: 0.5 },
        reads: [['dc.angleError', 0.024974]],
      },
      {
        say: 'Set the loading to 2. The angles roughly double and the error grows faster, to 0.558219°.',
        set: { load: 2 },
        reads: [['dc.angleError', 0.558219]],
      },
      {
        say: 'Read the branch flows at the defaults. The linear solve is wrong by 3.67468 % on the first branch and 1.16856 % on the third.',
        set: {},
        reads: [
          ['dc.flowError.br12', -3.67468],
          ['dc.flowError.br23', -1.168559],
        ],
      },
    ],
    why:
      'With no resistance and every magnitude at one, the real power on a branch is the sine of the angle ' +
      'across it divided by the reactance. Replace the sine by the angle and every branch flow is linear ' +
      'in the angles. Collecting them at each bus gives one matrix built from the reciprocals of the ' +
      'reactances, and one solve gives every angle at once. There is no iteration, no starting guess and ' +
      'no possibility of divergence. That is why this model runs inside market software that solves a ' +
      'network thousands of times an hour. What it cannot give is a voltage, a reactive flow or a loss, ' +
      'because it has assumed all three away.',
    whyReads: [[(x, p) => x.dc.slackP - (1.6 - 0.6) * p.load, 0, 1e-12]],
  },

  e2: {
    see:
      'The largest branch angle here is 4.75867°. At that angle the sine and the angle differ by ' +
      '0.115060 %, while the branch flow is wrong by 3.67468 %. The small-angle step is not what the ' +
      'error is made of. Turning the resistances off leaves 0.965899 % of it.',
    seeReads: [
      ['dc.maxAngle', 4.75867],
      ['dc.smallAngle', 0.11506],
      ['dc.maxFlowError', 3.67468],
      ['dc.losslessError', 0.965899],
    ],
    try: [
      {
        say: 'Set the loading to 2. The largest angle reaches 10.0589°, the small-angle error reaches 0.515547 %, and the flow error reaches 8.66616 %.',
        set: { load: 2 },
        reads: [
          ['dc.maxAngle', 10.0589],
          ['dc.smallAngle', 0.515547],
          ['dc.maxFlowError', 8.66616],
        ],
      },
      {
        say: 'Set the loading to 0.5. Every error falls, and the flow error is 1.55427 % against a small-angle error of 0.0280477 %.',
        set: { load: 0.5 },
        reads: [
          ['dc.maxFlowError', 1.55427],
          ['dc.smallAngle', 0.0280477],
        ],
      },
      {
        say: 'Read the lowest bus magnitude at the defaults. It is 0.961727 pu, and the model has been told to call it one.',
        set: {},
        reads: [['dc.minV', 0.961727]],
      },
    ],
    why:
      'Three assumptions go into the linear model and they do not cost the same. The small-angle step is ' +
      'the one the method is named for and it is nearly free, because a sine and its argument agree to ' +
      'better than a part in eight hundred at five degrees. The expensive two are the ones about the ' +
      'network. Ignoring resistance loses the loss and shifts every flow, and pinning the magnitudes ' +
      'ignores a bus sitting four percent low. Measuring each separately is the only way to know which ' +
      'to worry about, and on this network at this loading the answer is the resistance.',
    whyReads: [[(x) => x.cost.smallAngleError / x.compare.maxError, 0.0313, 0.004]],
  },

  e3: {
    see:
      'At 2.5 times the base loading the largest branch angle is 13.0705° and the lowest magnitude is ' +
      '0.869624 pu. The largest branch-flow error is 11.6734 %. Two of the guard’s three thresholds have ' +
      'been passed, and the pane names which.',
    seeReads: [
      ['dc.maxAngle', 13.0705],
      ['dc.minV', 0.869624],
      ['dc.maxFlowError', 11.6734],
      [(x) => (x.guard.warn ? 1 : 0), 1],
    ],
    try: [
      {
        say: 'Set the loading to 1. Every branch angle, magnitude and resistance ratio is back inside the guard, and the warning goes away.',
        set: { load: 1 },
        reads: [
          [(x) => (x.guard.warn ? 1 : 0), 0],
          ['dc.maxAngle', 4.75867],
        ],
      },
      {
        say: 'Set the loading to 4. The largest angle reaches 26.2380° and the flow error 26.2196 %, and the arrows are still drawn.',
        set: { load: 4 },
        reads: [
          ['dc.maxAngle', 26.238],
          [(x) => (x.guard.refuse ? 1 : 0), 0],
        ],
      },
      {
        say: 'Set the loading to 4.25. The largest angle passes 30° and the pane declines the flow arrows rather than drawing ones it cannot vouch for.',
        set: { load: 4.25 },
        reads: [
          ['dc.maxAngle', 31.8437],
          ['dc.refuseDeg', 30],
          [(x) => (x.guard.refuse ? 1 : 0), 1],
        ],
      },
    ],
    why:
      'The guard is written on the three things the model assumed away. Each threshold came from ' +
      'measuring the error rather than from a rule of thumb. The warning fires when any branch angle ' +
      'passes 10°, when any magnitude leaves the band from 0.95 to 1.05 pu, or when any branch has more ' +
      'than a quarter as much resistance as reactance. The refusal is stronger and it is about direction. ' +
      'Past 30° the linear solve and the exact one can disagree on which way a branch carries power. An ' +
      'arrow pointing the wrong way is worse than no arrow. So past that angle the pane draws no arrows ' +
      'and prints the reason.',
    whyReads: [
      [(x) => x.guard.reasons.length, 2],
      ['dc.warnDeg', 10],
      ['dc.refuseDeg', 30],
      ['dc.bandLow', 0.95],
      ['dc.bandHigh', 1.05],
      ['dc.rxLimit', 0.25],
    ],
  },
}
