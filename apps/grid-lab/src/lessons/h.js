// Group H: protection.

export const LESSONS_H = {
  h1: {
    see:
      'The IEC very inverse curve at a 400 A pickup and a time dial of 0.1 takes 1.35 s at 800 A. At ' +
      '1600 A it takes 0.45 s, and at 4000 A it takes 0.15 s. A bigger fault clears sooner, which is what ' +
      'the word inverse names. Below the pickup the relay never operates at all.',
    seeReads: [
      ['relay.at.800', 1.35],
      ['relay.at.1600', 0.45],
      ['relay.at.4000', 0.15],
      ['relay.current.800', 800],
      ['relay.current.4000', 4000],
    ],
    try: [
      {
        say: 'Double the time dial to 0.2. Every time on the curve doubles with it, so 1600 A now takes 0.9 s.',
        set: { tds: 0.2 },
        reads: [['relay.time', 0.9]],
      },
      {
        say: 'Set the pickup to 800 A. The same 1600 A fault is now only twice the pickup, and the relay takes 1.35 s.',
        set: { pickup: 800 },
        reads: [['relay.time', 1.35]],
      },
      {
        say: 'Set the curve to extremely inverse. The 1600 A fault now clears in 0.533333 s, and the curve falls faster with current.',
        set: { curve: 'extremelyInverse' },
        reads: [['relay.time', 0.533333]],
      },
    ],
    why:
      'The characteristic is a time dial times a constant over the multiple of pickup raised to a power, ' +
      'less one. The constant and the power are what name the curve, and for the very inverse curve they ' +
      'are 13.5 and 1. So the operating time multiplied by the multiple of pickup less one is the same ' +
      'number at every current, and the curve falls towards a straight line on logarithmic axes. The time ' +
      'dial multiplies the whole curve, which is what makes coordination possible, because two relays on ' +
      'the same characteristic keep a fixed ratio of times at every current. H2 turns that ratio into a ' +
      'margin in seconds.',
    whyReads: [[(x) => x.times.reduce((m, r) => Math.max(m, Math.abs(r.t * (r.I / x.setting.pickup - 1) - 1.35)), 0), 0, 1e-9]],
  },

  h2: {
    see:
      'The downstream relay clears a 1600 A fault in 0.45 s. The upstream relay has to wait 0.3 s longer, ' +
      'so it needs a time dial of 0.166667 and operates in 0.75 s. Raise the downstream setting and the ' +
      'upstream one has to follow.',
    seeReads: [
      ['relay.time', 0.45],
      ['relay.upstream', 0.75],
      ['relay.tds', 0.166667],
      ['relay.margin', 0.3],
    ],
    try: [
      {
        say: 'Double the downstream time dial to 0.2. The downstream relay takes 0.9 s and the upstream one has to take 1.2 s.',
        set: { tds: 0.2 },
        reads: [
          ['relay.time', 0.9],
          ['relay.upstream', 1.2],
        ],
      },
      {
        say: 'Widen the margin to 0.5 s. The upstream dial rises to 0.211111 and the upstream time to 0.95 s.',
        set: { margin: 0.5 },
        reads: [
          ['relay.tds', 0.211111],
          ['relay.upstream', 0.95],
        ],
      },
      {
        say: 'Set the fault current to 4000 A. Both relays are faster there, at 0.15 s and 0.45 s, and the margin is still 0.3 s.',
        set: { Ifault: 4000 },
        reads: [
          ['relay.time', 0.15],
          ['relay.upstream', 0.45],
          ['relay.margin', 0.3],
        ],
      },
    ],
    why:
      'Two relays in series both see the same fault, and only the one nearest it should trip. The margin ' +
      'is the time the upstream relay waits to let the downstream one act first. It has to cover the ' +
      'downstream breaker’s own opening time, the overtravel of the upstream relay and an allowance for ' +
      'error. Three tenths of a second is a common value. The time dial multiplies the whole curve, so ' +
      'setting it from one current sets it at every current. The margin elsewhere then follows the shape ' +
      'of the characteristic. Raising a downstream setting pushes every upstream relay up with it, so a ' +
      'coordination study runs from the far end inwards.',
    whyReads: [[(x) => x.up.time / x.down, 1.66667, 1e-4]],
  },

  h3: {
    see:
      'A distance relay divides its voltage by its current, which gives the impedance to the fault. On a ' +
      '40 Ω line, zone 1 reaches 32 Ω and trips at once, and zone 2 reaches 48 Ω and waits. A fault 60 km ' +
      'along that line looks like 24 Ω, which is inside zone 1.',
    seeReads: [
      ['relay.reach1', 32],
      ['relay.reach2', 48],
      ['relay.Z', 24],
      ['relay.zone', 1],
    ],
    try: [
      {
        say: 'Move the fault to 90 km. It now looks like 36 Ω, which is past zone 1, so the relay waits 0.4 s in zone 2.',
        set: { faultKm: 90 },
        reads: [
          ['relay.Z', 36],
          ['relay.zone', 2],
          ['relay.wait', 0.4],
        ],
      },
      {
        say: 'Move the fault to 130 km. At 52 Ω it is outside both zones, so this relay does not trip on it at all.',
        set: { faultKm: 130 },
        reads: [['relay.Z', 52]],
      },
      {
        say: 'Set the line impedance to 60 Ω. Both reaches grow with it, to 48 Ω and 72 Ω.',
        set: { Zline: 60 },
        reads: [
          ['relay.reach1', 48],
          ['relay.reach2', 72],
        ],
      },
    ],
    why:
      'A line has a nearly constant impedance per kilometre, so the impedance a relay measures is ' +
      'proportional to the distance to the fault. That makes a relay that acts on impedance a relay that ' +
      'acts on distance, and it needs no communication with the far end to do it. Zone 1 is set to eight ' +
      'tenths of the line rather than all of it. The measurement carries error from the current ' +
      'transformer, the voltage transformer and the line data. A zone 1 set to the whole line would ' +
      'sometimes reach past it and trip for a fault on the next line. Zone 2 covers the rest and waits, ' +
      'so it backs up the next relay without racing it.',
    whyReads: [[(x) => x.zones.zone1 / x.zones.Zline, 0.8, 1e-12]],
  },

  h4: {
    see:
      'A second source joins the line at a tapped bus 30 km out. It feeds the fault without passing ' +
      'through the relay, so the section past the tap looks longer than it is. With an infeed equal to ' +
      'the relay’s own current the 60 km fault reads 36 Ω instead of 24 Ω, which is outside zone 1.',
    seeReads: [
      ['relay.Z', 36],
      ['relay.Zno', 24],
      ['relay.zone', 2],
      ['relay.zoneNo', 1],
    ],
    try: [
      {
        say: 'Halve the infeed. The fault now reads 30 Ω, which is back inside zone 1 and clears at once.',
        set: { infeed: 0.5 },
        reads: [
          ['relay.Z', 30],
          ['relay.zone', 1],
        ],
      },
      {
        say: 'Read the infeed at which zone 1 stops reaching this fault. It is two thirds of the relay’s own current.',
        set: {},
        reads: [['relay.threshold', 0.666667]],
      },
      {
        say: 'Move the tapped bus to 50 km. Less of the line is past the tap, so the same infeed gives 28 Ω and zone 1 reaches again.',
        set: { tapKm: 50 },
        reads: [
          ['relay.Z', 28],
          ['relay.zone', 1],
        ],
      },
    ],
    why:
      'The relay measures its own current and the voltage at its own bus. Between the relay and the tap ' +
      'the current it measures is the whole current, so that section reads correctly. Past the tap the ' +
      'current is larger than what the relay measures, so the voltage drop there is larger than the relay ' +
      'expects and it reads the section as longer. The apparent impedance is the near section plus the ' +
      'far section multiplied by one plus the infeed ratio. A relay set without allowing for this ' +
      'underreaches, and a fault it was meant to clear at once waits for zone 2 instead.',
    whyReads: [[(x) => x.z.Z - (x.z.near + (1 + x.p.infeed) * x.z.far), 0, 1e-12]],
  },
}
