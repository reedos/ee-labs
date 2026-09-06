import { createChain } from '@ee-labs/dsp'
import { BLOCK_TYPES } from './blocks.js'

// This application's chain: the shared machinery from @ee-labs/dsp, bound once
// to the block registry defined in blocks.js.
//
// The registry is injected rather than imported by the package, which is what
// lets this lab define seven blocks Signal Lab has never heard of and reuse
// every line of the chain unchanged.

export const {
  chainSettle,
  applyChain,
  renderChain,
  runChain,
  chainResponse,
  chainPhase,
  chainGroupDelay,
} = createChain(BLOCK_TYPES)

const active = (blocks) => blocks.filter((b) => !b.bypass && BLOCK_TYPES[b.type])

/**
 * Every pole and zero in the chain, on one z-plane.
 *
 * `exact` is false when a block has no transfer function at all, which in this
 * lab means a rate changer or an adaptive filter is in the chain. The picture is
 * then part of the story, and the view says so rather than presenting it as
 * complete.
 */
export function chainPolesZeros(blocks, sampleRate) {
  const poles = []
  const zeros = []
  const exactPoles = []
  let exact = true
  let any = false

  for (const b of active(blocks)) {
    const def = BLOCK_TYPES[b.type]
    if (!def.pz) {
      exact = false
      continue
    }
    const r = def.pz(b.params, sampleRate)
    if (r.tooMany) {
      exact = false
      continue
    }
    any = true
    poles.push(...r.poles)
    zeros.push(...r.zeros)
    if (r.exactPoles) exactPoles.push(...r.exactPoles)
  }

  return { poles, zeros, exactPoles, exact, any }
}

/**
 * Why the chain's response curve is not the whole story, as a list of sentences.
 *
 * Every block that declines a response carries a `reason`, and a block that is
 * linear only for some settings carries one that applies when `lti` is false.
 * The overlay prints these rather than drawing nothing and letting a reader
 * guess, which is what `REVIEW_PLAYBOOK.md` §1 asks of a claim near a control.
 */
export function chainRefusals(blocks, sampleRate) {
  const out = []
  for (const b of active(blocks)) {
    const def = BLOCK_TYPES[b.type]
    if (!def.reason) continue
    const declines = def.response == null || def.response(b.params, 0, sampleRate) == null
    const partial = def.lti && !def.lti(b.params)
    if (declines || partial) out.push({ id: b.id, label: def.label, reason: def.reason })
  }
  return out
}

/**
 * The chain's impulse response, measured by running it.
 *
 * `exact` consults the per-params `lti` predicate where a block has one, so a
 * fixed-point section with a float64 state reports an exact kernel and the same
 * section with a quantised state does not.
 */
export function chainImpulse(blocks, n, sampleRate) {
  const list = active(blocks)
  const exact = list.every((b) => {
    const def = BLOCK_TYPES[b.type]
    return def.lti ? def.lti(b.params) : !def.nonlinear
  })
  const x = new Float64Array(n)
  x[0] = 1
  const h = applyChain(blocks, x, sampleRate, 0)
  return { h, exact, any: list.length > 0 }
}

/**
 * The specification the chain states, and the margin against it.
 *
 * Exactly one block in a chain may carry a specification, because two masks on
 * one axis are two claims about the same curve and the reader cannot tell which
 * margin belongs to which. The first is used and the rest are reported, so the
 * case is visible rather than silently resolved.
 */
export function chainSpec(blocks, sampleRate) {
  const carriers = active(blocks).filter((b) => BLOCK_TYPES[b.type].spec)
  if (carriers.length === 0) return null
  const b = carriers[0]
  const def = BLOCK_TYPES[b.type]
  return {
    id: b.id,
    label: def.label,
    margin: def.spec(b.params, sampleRate),
    design: def.design ? def.design(b.params, sampleRate) : null,
    extra: carriers.length - 1,
  }
}

/** The adaptive block's whole run, for the weight view, or null. */
export function chainAdaptiveRun(blocks, buf, sampleRate) {
  const b = active(blocks).find((x) => BLOCK_TYPES[x.type].run)
  if (!b) return null
  return { id: b.id, ...BLOCK_TYPES[b.type].run(b.params, buf, sampleRate) }
}
