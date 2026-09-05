/**
 * What the student reads, per experiment, in three registers:
 *
 *   see — what the picture shows at the defaults, in a few lines;
 *   try — knob moves with the reading each one produces;
 *   why — the reasoning, for after the picture has made its point.
 *
 * Every number a step quotes is a measurement. A step's `set` is applied on top
 * of the defaults, and each `reads` pair is a quantity path (or a function of
 * the analysis) with the value the sentence quotes. experiments.test.js
 * evaluates each step and checks both the pair and every number-with-unit in
 * the sentence against it.
 *
 * The paths, grouped by the structure that produces them:
 *
 *   carrier.<n|p|ni|net|efi|majority|minority|type|extrinsic|vt|T>
 *   carrier.<niComputed|niRatio|gapImplied|intrinsicT|ec|ev|ef|barrier>
 *   j.<v0|vj|w|xp|xn|emax|cj|cj0|cjTotal|byArea|byLaw|byCharge|byQuadrature>
 *   j.<is|dp|dn|lp|ln|vAt1mA|decade|vbr|vbrApplied|mechanism|ecrit|debye|modelError|v|area>
 *   mos.<cox|phiF|wmax|cdmin|cmin|ratio|debye|vfb|phims|qdep|depTerm|implantTerm|vt>
 *   mos.<c|cHigh|cLow|regime|psi|w|gamma|swing|inversionFactor|gateCharge|implantTo|dopingRead>
 *   fet.<id|region|vov|gm|ro|kn|kprime|charge|integral|gmMeasured|saturation|boundary>
 *   fet.<vt|shift|gamma|swing|decades|dv|vsat|length|vgs|vds|vsb>
 *   bjt.<is|beta|alpha|gummelBase|gummelEmitter|tauB|ftLimit|vbe|ic>
 *   bjt.<rate|va|intoBase|intoCollector|neutralBase|taken|w|vj|emitterWidth>
 *   pv.<voc|isc|vmp|imp|pmax|ff|ffEmpirical|ffError|efficiency|seriesLoss|vt>
 *   led.<wavelength|vf|photonEnergy|eg>
 *   fab.<doping|dose|depth|v0|step>
 */
import { LESSONS_A } from './lessons/a.js'
import { LESSONS_B } from './lessons/b.js'
import { LESSONS_C } from './lessons/c.js'
import { LESSONS_D } from './lessons/d.js'
import { LESSONS_E } from './lessons/e.js'
import { LESSONS_F } from './lessons/f.js'
import { LESSONS_G } from './lessons/g.js'

/** The heads a path may start with, and the branch of the analysis each reads. */
const HEADS = { carrier: 'carrier', j: 'j', mos: 'mos', fet: 'fet', bjt: 'bjt', pv: 'pv', led: 'led', fab: 'fab' }

/** Read one quantity of an analysis by path (see the module comment). */
export function readQuantity(x, p, path) {
  const [head, ...rest] = path.split('.')
  const branch = HEADS[head]
  if (!branch) throw new Error(`unknown quantity path ${path}`)
  const source = x[branch]
  if (!source) throw new Error(`unknown quantity path ${path}`)
  let value = source
  for (const key of rest) {
    if (value == null || !(key in value)) throw new Error(`unknown quantity path ${path}`)
    value = value[key]
  }
  if (typeof value === 'function') throw new Error(`unknown quantity path ${path}`)
  return value
}

export const LESSONS = { ...LESSONS_A, ...LESSONS_B, ...LESSONS_C, ...LESSONS_D, ...LESSONS_E, ...LESSONS_F, ...LESSONS_G }
