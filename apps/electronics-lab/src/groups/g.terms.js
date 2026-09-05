// Group G's terms, merged into the one registry by terms.js.

export const TERMS_G = {
  port: {
    name: 'A port',
    def:
      'A pair of terminals a circuit is measured at, with the current going in at one equal to the current ' +
      'coming out at the other. What the circuit behind a port does to the world is fixed by the ratio of the ' +
      'port’s voltage to its current. Everything behind it can be replaced by that one number.',
  },
  testsource: {
    name: 'The test source',
    def:
      'A source of known value applied at a port so that the resistance there can be read as a ratio. Push ' +
      '1.00 mA in, read 90.9 mV, and the port is 90.9 Ω. It gives the right answer where killing the ' +
      'independent sources and adding up resistors does not.',
  },
  negativeresistance: {
    name: 'Negative resistance',
    def:
      'A port whose voltage falls as the current pushed into it rises, so the ratio of the two is below zero. ' +
      'No resistor behaves this way. A dependent source that draws current out of a port in step with that ' +
      'port’s own voltage does, and at g = −10.0 mA/V the reading here is −111.1 Ω.',
  },
  twoport: {
    name: 'The two-port model',
    def:
      'An amplifier described by three numbers: the resistance seen looking into its input, the voltage it ' +
      'produces with nothing on its output, and the resistance in series with that voltage. Circuit Elements ' +
      'Lab drew the op-amp this way. Every stage in this lab is measured back to these three.',
  },
  loadingrule: {
    name: 'The loading rule',
    def:
      'Whatever a source drives forms a divider with the source’s own resistance. An amplifier of gain 10.0 ' +
      'delivers ten times its input only into an open circuit. Into a load equal to its output resistance it ' +
      'delivers half of that, and the missing half is across the output resistance.',
  },
}

export const MATCH_G = {
  port: /\bport\b/i,
  testsource: /\btest source\b/i,
  negativeresistance: /\bnegative resistance\b/i,
  twoport: /\btwo-port\b/i,
  loadingrule: /\bloading rule\b/i,
}
