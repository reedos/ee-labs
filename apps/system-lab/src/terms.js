// Definitions, delivered where the term first does work (`REVIEW_PLAYBOOK.md`
// §8). Each experiment lists the terms its notes lean on, and the sidebar
// offers them in a fold under the note.
//
// House rules: three or four sentences, the first saying what the thing IS and
// the rest why it matters here, concrete numbers over abstraction, and no term
// defined using an undefined term. `terms.test.js` checks the last of those by
// walking the experiments in reading order, so a word may not appear in a note
// before the note that offers its definition.
//
// Every number quoted in a definition is pinned in a test, the same as a number
// quoted in a lesson. `experiments.test.js` holds the two constants below.

export const TERMS = {
  dbm: {
    name: 'dBm',
    def:
      'A power referred to one milliwatt, so 0 dBm is 1 mW. Ten decibels more is ten times the power. Every ' +
      'level in this lab is quoted in dBm, because a chain of blocks multiplies powers and decibels turn that ' +
      'product into a sum.',
  },
  noisefigure: {
    name: 'Noise figure',
    def:
      'How much a block worsens the ratio of signal to noise, in decibels. A block with a 1.5 dB noise figure ' +
      'leaves that ratio 1.5 dB lower than it found it. An ideal block has 0 dB, and no real block is below it.',
  },
  ip3: {
    name: 'Input IP3',
    def:
      'The input level at which a block’s third-order product would rise to meet the wanted signal, in dBm. ' +
      'Neither reaches it, because the block compresses first. It is the crossing of two extrapolated straight ' +
      'lines, and it is the one number that says how much signal a block takes.',
  },
  worstcase: {
    name: 'Worst case',
    def:
      'The value a budget quotes when the way the terms combine is not known. Third-order products from several ' +
      'stages can add as voltages, as powers, or with random phase. Adding them as voltages gives the largest ' +
      'total, and the input IP3 column shows that one.',
  },
  cascade: {
    name: 'Cascade',
    def:
      'A list of blocks in order, each driving the next. A cascade’s gain is the sum of the gains in decibels. ' +
      'Its noise figure and its input IP3 depend on the order, because each block’s term is divided by the gain ' +
      'in front of it.',
  },
  availablegain: {
    name: 'Available gain',
    def:
      'The power a block can deliver into a matched load, over the power available from its source. Friis wrote ' +
      'the cascade formula in available gains, so every interface in this lab is taken as matched. A reflecting ' +
      'interface adds a mismatch loss, and the block record carries no reflection coefficient.',
  },
  referencetemperature: {
    name: 'Reference temperature',
    def:
      'The 290 K a noise figure is quoted against, written T_0. It is near room temperature and it is a ' +
      'convention, fixed so that two datasheets can be compared. A passive block at T_0 has a noise figure equal ' +
      'to its loss, and at any other temperature it does not.',
  },
  thermalnoise: {
    name: 'Thermal noise',
    def:
      'The noise a resistance makes through the motion of its own charge, with an available power density of ' +
      'kT watts per hertz. At 290 K that is −173.975 dBm/Hz. It depends on the temperature and the bandwidth, ' +
      'and not at all on the resistance.',
  },
  noisefloor: {
    name: 'Noise floor',
    def:
      'The noise power in a stated bandwidth at a stated point of the chain, in dBm. It is kT_0B plus the noise ' +
      'figure up to that point. Over 200 kHz with no noise figure it is −120.965 dBm. A floor quoted without its ' +
      'bandwidth means nothing.',
  },
  signaltonoise: {
    name: 'Signal-to-noise ratio',
    def:
      'The signal power over the noise power at one point, in decibels. It is the gap between the two lines in ' +
      'the levels view. Gain moves both lines together and leaves the gap alone, so only a noise figure narrows ' +
      'it.',
  },
  noisebandwidth: {
    name: 'Noise bandwidth',
    def:
      'The width of the ideal rectangular filter that would pass the same noise power as the real one. Every ' +
      'floor in this lab is counted over one, and the app prints it beside every floor. It is wider than the ' +
      'passband, because a real skirt passes noise too.',
  },
}

/**
 * How a term is recognised in prose.
 *
 * A pattern per term rather than the term's own headword, because a note says
 * "cascaded" where the term is "cascade". A rule that matched only the headword
 * would pass a note that never says it.
 */
export const MATCH = {
  dbm: /\bdBm\b/,
  noisefigure: /\bnoise figure\b/i,
  ip3: /\bIP3\b/,
  worstcase: /\bworst case\b/i,
  cascade: /\bcascad/i,
  availablegain: /\bavailable gain/i,
  referencetemperature: /\breference temperature\b/i,
  thermalnoise: /\bthermal\b/i,
  noisefloor: /\bnoise floor\b/i,
  signaltonoise: /\bsignal-to-noise\b/i,
  noisebandwidth: /\bnoise bandwidth\b/i,
}

/** The definitions an experiment's `terms` list names, in that order, for the sidebar's fold. */
export const termsFor = (ids = []) => ids.map((id) => ({ id, ...TERMS[id] })).filter((t) => t.name)
