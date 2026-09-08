export const TERMS = {
  pin: { name: 'Pin', def: 'An external electrical connection on a chip. A signal pin carries a voltage that another circuit interprets as information. Its capacitance and current limits affect that signal.' },
  cmosInput: { name: 'CMOS input', def: 'A voltage-sensing receiver made with complementary transistors. It draws little steady input current but adds capacitance. It needs a defined voltage. Leaving it floating can cause uncertain logic.' },
  inverter: { name: 'Inverter', def: 'A logic negation gate: a low input gives a high output, and a high input gives a low output. Its transfer curve maps input voltage to output voltage.' },
  pushPull: { name: 'Push-pull output', def: 'One switched resistance connects the pin to the supply. The other switch closes a path to ground. Only one is closed at a time.' },
  openDrain: { name: 'Open-drain output', def: 'The output switch connects the pin to ground or opens. A separate resistor connects it to the supply.' },
  timeConstant: { name: 'Time constant', def: 'The time constant of this circuit is resistance times capacitance. After this interval, the remaining voltage difference is divided by the exponential constant e.' },
  thresholds: { name: 'Input limits', def: 'VIL is the highest guaranteed low input voltage. VIH is the lowest guaranteed high input voltage. The interval between them has no guaranteed logic level.' },
  riseTime: { name: 'Rise time', def: 'Rise time here is the interval from 10% to 90% of the supply. A different pair of voltage levels gives a different interval.' },
  noiseMargin: { name: 'Noise margin', def: 'The low margin is VIL minus the low output voltage. The high margin is the high output voltage minus VIH.' },
  groundBounce: { name: 'Ground bounce', def: 'A changing current through return inductance creates a voltage between the local and remote grounds. This budget uses a specified linear current ramp.' },
}
