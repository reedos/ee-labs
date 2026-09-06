// Group F's three registers. Two of the four carry guards, and F4's guard is
// measured against an exact solve of the same wire.

export const LESSONS_F = {
  f1: {
    see:
      'Two hundred turns round 400 mm² of core, in a peak flux density of 1.2 T at 50 Hz. The induced emf is ' +
      '21.33 V root mean square. The coefficient in front of f, N and the peak flux is 4.443, which is 2π over the ' +
      'square root of two.',
    seeReads: [['emf.rms', 21.326], ['emf.coefficient', 4.442883]],
    try: [
      {
        say: 'Set the frequency to 60 Hz. The emf rises to 25.59 V, in proportion.',
        set: { f: 60 },
        reads: [['emf.rms', 25.591]],
      },
      {
        say: 'Double the turns to 400. The emf doubles to 42.65 V, and the coefficient has not moved.',
        set: { N: 400 },
        reads: [['emf.rms', 42.652], ['emf.coefficient', 4.442883]],
      },
    ],
    why:
      'Faraday’s law says the emf round a loop is minus the rate of change of the flux through it. For a ' +
      'sinusoidal flux the rate of change brings down a factor of ω, so the peak emf is 2πfNΦ and the root mean ' +
      'square value is that over the square root of two. The coefficient is therefore 4.442883, and the 4.44 in ' +
      'every transformer textbook is that number rounded. Nothing about a transformer is in this formula. It ' +
      'applies to any coil in any changing flux, and it is why a transformer’s voltage rating is really a ' +
      'flux-density rating at a stated frequency.',
  },

  f2: {
    see:
      'A 250 mm bar moving at 3 m/s across a 0.4 T field. The emf along it is 0.3000 V. Only the part of the ' +
      'motion across the field counts, so the angle knob decides how much of the speed is used.',
    seeReads: [['moving.emf', 0.3]],
    try: [
      {
        say: 'Set the angle to zero, moving along the field. The emf falls to 0 V.',
        set: { angle: 0 },
        reads: [['moving.emf', 0]],
      },
      {
        say: 'Set the angle to 30 degrees. The emf is 0.1500 V, which is the sine of that angle times the full value.',
        set: { angle: 30 },
        reads: [['moving.emf', 0.15]],
      },
    ],
    why:
      'A charge moving with velocity v through a field B feels a force qv × B. In a bar moving across the field ' +
      'that force pushes charge along the bar until the electric field it builds up balances it, and the voltage ' +
      'between the ends is Blv. The cross product is where the sine comes from, so a bar sliding along the field ' +
      'lines generates nothing. This is the same law Faraday’s flux rule states, seen from the moving conductor ' +
      'rather than from the loop. A generator is this experiment on a rotor, and F1’s coil is it on a fixed core.',
  },

  f3: {
    see:
      'A 0.35 mm lamination of silicon steel at 1.2 T and 50 Hz loses 1543 W/m³ to eddy currents. The loss follows ' +
      'the square of the thickness. That is why a core is built from thin sheets and not from one solid block.',
    seeReads: [['eddy.P', 1543.4]],
    try: [
      {
        say: 'Halve the lamination to 0.175 mm. The loss falls to 385.9 W/m³, a quarter of what it was.',
        set: { t: 0.175e-3 },
        reads: [['eddy.P', 385.86]],
      },
      {
        say: 'Set the frequency to 100 Hz. The loss rises to 6174 W/m³, four times, since it follows f squared too.',
        set: { f: 100 },
        reads: [['eddy.P', 6173.8]],
      },
    ],
    why:
      'A changing flux drives a current round any conducting loop it threads, and a solid core is nothing but ' +
      'loops. The emf round a loop of half-width x grows with x and so does the path, so the power grows as x ' +
      'squared. Over a sheet of thickness d that totals π²B²f²d² over 6ρ. Slicing the core into ' +
      'insulated sheets shortens every loop. This formula assumes the induced currents do not push the field out ' +
      'of the sheet, which holds while the thickness is a fraction of the skin depth. The panel reports that ratio ' +
      'against a threshold of one half.',
  },

  f4: {
    see:
      'A 1 mm copper wire at 1 MHz. The skin depth there is 66.09 µm, so the current has crowded into a thin shell ' +
      'and the resistance is 7.822 times its direct-current value. The profile shows the current density falling ' +
      'from the surface inward.',
    seeReads: [['skin.delta', 6.6085e-5], ['wire.ratio', 7.8221]],
    try: [
      {
        say: 'Set the frequency to 10 kHz. The ratio falls to 1.101, and the tube formula is now 31.3 per cent out.',
        set: { f: 1e4 },
        reads: [['wire.ratio', 1.10052], ['tube.error', 0.31250]],
      },
      {
        say: 'Set the frequency to 100 MHz. The ratio rises to 75.91 and the tube formula is within 0.33 per cent.',
        set: { f: 1e8 },
        reads: [['wire.ratio', 75.9102], ['tube.error', 0.003301]],
      },
      {
        say: 'Set the frequency to 50 Hz. The skin depth is 9.346 mm, far wider than the wire, and the ratio is 1.000.',
        set: { f: 50 },
        reads: [['skin.delta', 0.0093459], ['wire.ratio', 1.0]],
      },
    ],
    why:
      'A changing field inside a conductor drives eddy currents that oppose it, so both the field and the current ' +
      'are pushed towards the surface. In a flat conductor the fall is exponential with a length called the skin ' +
      'depth, one over the square root of πfµσ. A round wire is not flat, and this lab solves it exactly by ' +
      'integrating the Bessel equation the current density obeys. The familiar shortcut treats the wire as a tube ' +
      'one skin depth thick, and the panel measures that shortcut against the exact solve rather than against a ' +
      'rule of thumb. Below three skin depths of radius the shortcut is refused.',
  },
}
