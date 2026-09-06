// Every sentence the loop diagram puts on screen, in one place so the prose
// test can measure it.
//
// The diagram's own strings were the last on-screen prose in this lab that
// nothing checked: prose.test.js covers a lesson's note, its try line, every
// term definition and the two section headers, and STYLE.md asks for "every
// chrome string" as well. The dialog's subtitle had been carrying two
// semicolons since it was written (S5: use two sentences), and the cascade
// caption an em dash it did not need (S3). Neither could be caught by a
// reader who had already stopped seeing them.
//
// The subtitle keeps its emphasis, so it is stored as segments: `em` is the
// symbol set in italics, `t` is the prose between. HEAD_TEXT is what the
// reader sees, and what the test measures.

/** The dialog's subtitle, as the segments it renders as. */
export const HEAD_PARTS = [
  { t: 'the error ' },
  { em: 'r − y' },
  { t: ' drives C. A disturbance ' },
  { em: 'd' },
  { t: " adds at the plant's input. Click " },
  { em: 'r' },
  { t: ' or ' },
  { em: 'd' },
  { t: ' to choose which step the plot answers.' },
]

/** The same subtitle as one string, which is how it reads on screen. */
export const HEAD_TEXT = HEAD_PARTS.map((p) => p.t ?? p.em).join('')

/**
 * The wire and box captions.
 *
 * CASCADE lost an em dash for a colon, which is what STYLE.md's S4 says a
 * colon is for: the value that follows the claim. The rule stated first,
 * then this instance's form of it.
 */
export const CASCADE = 'in cascade, transfer functions multiply: L = C·P'
export const DRIVE = 'driven by Kp·(r − y), not by r'
export const FED_BACK = 'the output, measured and fed back'
export const STEP_ENTERS = 'the step enters here'

/** Every caption above, for the prose test to walk. */
export const CAPTIONS = [CASCADE, DRIVE, FED_BACK, STEP_ENTERS]
