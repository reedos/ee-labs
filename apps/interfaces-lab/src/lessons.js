export const number = (v, unit, factor = 1) => Number.isFinite(v) ? `${Number((v / factor).toPrecision(12)).toPrecision(4)} ${unit}`.trim() : 'unavailable'
const ns = (v) => number(v, 'ns', 1e-9)
const volts = (v) => number(v, 'V')

export const LESSONS = {
  a1: {
    see: (x) => `The pin rises from an initially discharged capacitor. Its time constant is ${ns(x.rise.segments[0].tau)}. The 10% to 90% rise takes ${ns(x.rise.tr)}.`,
    try: [{ say: 'Set load capacitance to 200 pF. The slower edge falls behind the default reference.', set: { cload: 200e-12 } },
      { say: 'Set on resistance to 50 ohm. Read the rise time.', set: { ron: 50 } }],
    why: 'A push-pull output connects one resistor to a rail at a time. The capacitor voltage stays continuous when the switch changes. The remaining voltage difference decays exponentially with time constant RC. The exact 10% to 90% rise time is ln(9) RC. The common factor 2.2 is a rounded value of ln(9).',
  },
  a2: {
    see: (x) => `The maximum guaranteed low input (VIL) is ${volts(x.thresholds.vil)}. The minimum guaranteed high input (VIH) is ${volts(x.thresholds.vih)}. The rising pin reaches VIH after ${ns(x.rise.tpLH)}.`,
    try: [{ say: 'Set supply VDD to 5 V. Read both input limits.', set: { vdd: 5 } }],
    why: 'Matched square-law CMOS devices define VIL and VIH where the inverter transfer slope is negative one. Between these limits, the input has no guaranteed logic level. VIL equals (3 VDD + 2 Vt)/8. VIH equals (5 VDD - 2 Vt)/8. These forms require VDD greater than twice Vt. The pin waveform crosses each voltage at a logarithmic delay.',
  },
  a3: {
    see: (x, p) => `The pull-up reaches the minimum guaranteed high input (VIH) in ${ns(x.rise.tpLH)} from zero volts. This delay is ${(p.rpu / p.ron).toPrecision(4)} times the push-pull delay. The falling pin approaches ${volts(x.fall.segments[0].target)}.`,
    try: [{ say: 'Set pull-up resistance to 1 kohm. Read the crossing delay.', set: { rpu: 1000 } }],
    why: 'An open-drain output either connects its on resistance to ground or opens that path. The pull-up remains connected in both states. During release, its resistance sets the charging time constant. During pull-down, both resistances conduct. Their divider sets the low voltage. Their parallel resistance sets the falling time constant. A release from that low voltage crosses VIH earlier than a release from zero.',
  },
  a4: {
    see: (x, p) => `The rise time is ${ns(x.rise.tr)} against a ${ns(p.riseBudget)} budget. The remaining time is ${ns(x.budget.slack)}. The capacitance limit is ${number(x.budget.maxCap, 'pF', 1e-12)}.`,
    try: [{ say: 'Set load capacitance to 500 pF. Read the remaining rise budget.', set: { cload: 500e-12 } }],
    why: 'At fixed resistance, the rise time grows linearly with capacitance. The slope is ln(9) times the on resistance. Dividing the rise budget by that slope gives the largest allowed capacitance. A negative remaining time means the rise exceeds the budget.',
  },
  a5: {
    see: (x) => `The low noise margin is ${volts(x.margins.nml)}. The high noise margin is ${volts(x.margins.nmh)}. The lumped current-ramp budget gives ${volts(x.margins.bounce)} of ground bounce. Its remaining margin is ${volts(x.margins.slack)}.`,
    try: [{ say: 'Set current ramp time to 20 ns. Read the ground bounce.', set: { edgeTime: 20e-9 } },
      { say: 'Set switching pins to 3. Read the remaining margin.', set: { pins: 3 } }],
    why: 'Static load current drops I R_on across the active switch. Each noise margin is the gap between an output level and its input limit. The separate bounce budget assumes a linear current ramp of VDD/R_on per pin through one shared inductance. Its voltage is L times the current slope. A longer ramp gives a smaller inductive voltage. This lumped budget does not predict package ringing or board behavior.',
  },
}

export function readQuantity(x, path) {
  return path.split('.').reduce((value, key) => value?.[key], x)
}
