// Group E's terms, merged into the one registry by terms.js.

export const TERMS_E = {
  coupling: {
    name: 'The coupling capacitor',
    def:
      'A capacitor in series with a signal path, put there to pass the signal and block the bias. At DC it ' +
      'carries no current at all, so the stage’s divider sets the base voltage on its own. Above the corner ' +
      'the two resistances and the capacitor make together, its impedance is small enough to ignore.',
  },
  fixedbias: {
    name: 'Fixed bias',
    def:
      'The simplest bias: one resistor from the supply to the base, which fixes the base current. The ' +
      'collector current is then β times a number no resistor in the circuit sets, so a device with twice the ' +
      'β draws twice the current. It is in every textbook as the arrangement not to use.',
  },
  degeneration: {
    name: 'Emitter degeneration',
    def:
      'A resistor between the emitter and ground, which turns the bias into a negative-feedback loop. More ' +
      'collector current raises the emitter voltage, which lowers v_BE, which lowers the current back. The ' +
      'rule for it is R_B ≤ 0.1(β + 1)R_E, and the same resistor sets the stage’s gain once a signal is applied.',
  },
  thresholdspread: {
    name: 'Threshold spread',
    def:
      'The part-to-part variation in a MOSFET’s V_t, typically ±0.1 V, which is what the MOSFET has instead of ' +
      'the BJT’s β spread. The square law squares it, so a shift that halves the overdrive quarters the ' +
      'current. A source resistor is what keeps that from happening.',
  },
  currentsourcebias: {
    name: 'Current-source bias',
    def:
      'Setting the emitter current with a source rather than with resistors, so that the collector current is ' +
      'α times a number no property of the device enters. β and temperature then move the answer by parts in a ' +
      'hundred rather than by factors. It is what a current mirror is built to deliver.',
  },
}

export const MATCH_E = {
  coupling: /\bcoupling capacitor\b/i,
  fixedbias: /\bfixed bias\b/i,
  degeneration: /\bdegeneration\b/i,
  thresholdspread: /\bthreshold spread\b/i,
  currentsourcebias: /\bcurrent-source bias\b/i,
}
