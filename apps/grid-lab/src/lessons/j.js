// Group J: dispatch, and the grid as one system.

export const LESSONS_J = {
  j1: {
    see:
      'Three units and 800 MW of demand. The cheapest split puts every unit at the same incremental cost ' +
      'of 8.5 dollars a megawatt hour, which gives 400 MW, 250 MW and 150 MW. That costs 6682.50 dollars ' +
      'an hour against 6877.78 dollars for three equal shares, a saving of 195.278 dollars.',
    seeReads: [
      ['dispatch.lambda', 8.5],
      ['dispatch.unit.unit1.P', 400],
      ['dispatch.unit.unit2.P', 250],
      ['dispatch.unit.unit3.P', 150],
      ['dispatch.cost', 6682.5],
      ['dispatch.equalCost', 6877.78],
      ['dispatch.saving', 195.278],
    ],
    try: [
      {
        say: 'Raise the demand to 1000 MW. The incremental cost rises to 9.25793 dollars and the split becomes 494.741 MW, 312.827 MW and 192.107 MW.',
        set: { demand: 1000 },
        reads: [
          ['dispatch.lambda', 9.25793],
          ['dispatch.unit.unit1.P', 494.741],
          ['dispatch.unit.unit2.P', 312.827],
          ['dispatch.unit.unit3.P', 192.107],
        ],
      },
      {
        say: 'Lower the demand to 500 MW. The incremental cost falls to 7.36316 dollars and the cheapest unit still takes the largest share, 257.895 MW.',
        set: { demand: 500 },
        reads: [
          ['dispatch.lambda', 7.36316],
          ['dispatch.unit.unit1.P', 257.895],
        ],
      },
      {
        say: 'Read the three incremental costs at the defaults. All three are 8.5 dollars, and equalising them is what makes this split the cheapest.',
        set: {},
        reads: [
          ['dispatch.unit.unit1.incremental', 8.5],
          ['dispatch.lambda', 8.5],
        ],
      },
    ],
    why:
      'Each unit’s cost is a quadratic in its output, so its incremental cost is a straight line. ' +
      'Minimising the total cost subject to the outputs summing to the demand is a Lagrangian with one ' +
      'multiplier, and its first-order condition sets every free unit’s incremental cost equal to that ' +
      'multiplier. So the cheapest split is not the one that loads the cheapest unit first. It is the one ' +
      'that equalises the slopes. The condition is exact and needs no search, and the only numerical step ' +
      'is finding the multiplier that closes the balance. A unit at a limit drops out of the balance, and ' +
      'J2 shows what that does.',
    whyReads: [[(x) => x.d.units.reduce((m, u) => Math.max(m, Math.abs(u.incremental - x.d.lambda)), 0), 0, 1e-8]],
  },

  j2: {
    see:
      'Cap the first unit at 300 MW and it can no longer take its share. The incremental cost rises to ' +
      '9.22 dollars, and the two free units make up the difference at 310 MW and 190 MW. The capped ' +
      'unit’s own incremental cost sits below the others, at 7.7 dollars.',
    seeReads: [
      ['dispatch.lambda', 9.22],
      ['dispatch.unit.unit1.P', 300],
      ['dispatch.unit.unit2.P', 310],
      ['dispatch.unit.unit3.P', 190],
      ['dispatch.unit.unit1.incremental', 7.7],
    ],
    try: [
      {
        say: 'Raise the cap to 600 MW. The unit is free again, the incremental cost falls to 8.5 dollars, and the split returns to 400 MW.',
        set: { cap1: 600 },
        reads: [
          ['dispatch.lambda', 8.5],
          ['dispatch.unit.unit1.P', 400],
        ],
      },
      {
        say: 'Read the marginal cost of the next megawatt with the unit free. It is 8.50189 dollars against a multiplier of 8.5 dollars.',
        set: { cap1: 600 },
        reads: [
          ['dispatch.marginal', 8.50189],
          ['dispatch.lambda', 8.5],
        ],
      },
      {
        say: 'Read it again with the cap at 300 MW. Both numbers have moved up together, to 9.2236 dollars and 9.22 dollars.',
        set: {},
        reads: [
          ['dispatch.marginal', 9.2236],
          ['dispatch.lambda', 9.22],
        ],
      },
    ],
    why:
      'The multiplier is the incremental cost of serving one more megawatt, so it should predict what the ' +
      'next megawatt actually costs. Solving the whole dispatch again at one megawatt more and taking the ' +
      'difference gives that cost exactly. The two agree to a fifth of a cent. They differ at all only ' +
      'because the cost is quadratic and the multiplier is its slope at one end of the step. A unit at a ' +
      'limit takes no part in the balance, so the multiplier follows the units that are still free. It ' +
      'then rises above the capped unit’s own slope, and that gap is where a market price comes from.',
    whyReads: [[(x) => Math.abs(x.marginal - x.d.lambda), 0.0036, 0.002]],
  },
}
