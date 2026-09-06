export const TERMS = {
  switch: { name: 'Switch model', def: 'An on transistor is a resistor. An off transistor has no channel current. The gate threshold separates these states.' },
  fanout: { name: 'Fanout', def: 'Fanout counts the identical unit inverter inputs connected to an output. Each input contributes its gate capacitance.' },
  delay: { name: 'Propagation delay', def: 'Propagation delay is the time between the input transition and the output crossing half the supply. Here the input is an ideal rail step.' },
  margin: { name: 'Noise margin', def: 'A noise margin is the voltage gap between a guaranteed output level and the next gate input limit. The limits occur at unity slope magnitude.' },
  square: { name: 'Square law', def: 'The square law describes a MOS channel with cutoff, triode and saturation regions. This view solves static operating points.' },
  transport: { name: 'Transport delay', def: 'A transport model schedules each output transition after a stated delay. It has logic levels and no continuous output voltage.' },
  self: { name: 'Self-capacitance', def: 'Self-capacitance is the output capacitance of the driving inverter itself. In this model it grows with the sum of transistor widths.' },
}
