import { spectrum, firResponse, multirateCost } from '@ee-labs/dsp'
import { BLOCK_TYPES, firDesign, iirDesign, cascadeResponse } from './blocks.js'
import { chainSpec, renderChain } from './chain.js'

// The quantity paths, resolved once.
//
// An experiment's `claims` name a path and the test resolves it here, so the
// number the readout prints and the number the test pins come from the same
// line of code. A path the resolver does not know throws rather than returning
// undefined, because a claim about a quantity nobody measures is the defect this
// arrangement exists to catch.
//
// The paths are the brief's §4 list:
//
//   line.<hz>                        the amplitude of the spectral line there
//   db.<hz>                          the same in decibels
//   rate.<nyquist|grid|alias>        the new Nyquist, the coarse rate, the fold
//   cost.<direct|polyphase|ratio>    multiplies a second, and the saving
//   design.<taps|order|coefficients|estimate|grew|delta|met>
//   spec.<band>.<marginDb|maxDb|minDb|atHz|met>
//   spec.worst
//   guard.<hz>                       the anti-alias filter's response there

/** Render an experiment's state exactly as the app does. */
export function runState(state) {
  const { buf } = renderChain(state.sources, state.blocks, state.fftSize, state.sampleRate)
  return { buf, ...spectrum(buf, state.sampleRate, state.window || 'hann') }
}

/**
 * The amplitude of the line nearest `hz`, read as the app's marker reads it.
 *
 * A Hann window spreads a line over about three bins, so the peak within two
 * bins is the line's amplitude. Every lesson frequency is a multiple of 375 Hz,
 * which is a bin centre of the 4096-point frame, so the spread is symmetric and
 * the peak is the true amplitude rather than a scalloped fraction of it.
 */
export function lineAt(s, hz) {
  let bi = 0
  for (let i = 1; i < s.freqs.length; i++) {
    if (Math.abs(s.freqs[i] - hz) < Math.abs(s.freqs[bi] - hz)) bi = i
  }
  let m = 0
  for (let i = Math.max(0, bi - 2); i <= Math.min(s.amps.length - 1, bi + 2); i++) {
    m = Math.max(m, s.amps[i])
  }
  return m
}

const firstBlock = (state, pred) =>
  state.blocks.find((b) => !b.bypass && BLOCK_TYPES[b.type] && pred(b, BLOCK_TYPES[b.type]))

/** The rate-changing block in the chain, or null. */
export function rateBlock(state) {
  return firstBlock(state, (b) => b.type === 'decimate' || b.type === 'interpolate') ?? null
}

/** The design block in the chain, or null. */
export function designBlock(state) {
  return firstBlock(state, (b) => b.type === 'firspec' || b.type === 'iirspec') ?? null
}

/** The design a design block produced. */
export function designOf(state) {
  const b = designBlock(state)
  if (!b) return null
  return b.type === 'firspec' ? firDesign(b.params, state.sampleRate) : iirDesign(b.params, state.sampleRate)
}

/**
 * The zero-order hold's droop at `hz`, for a decimator holding M samples.
 *
 * A held sample is a rectangle M samples wide, whose transform is a sinc. The
 * amplitude a decimate-and-hold block returns is the alias times this factor,
 * which is why A1's measurement is 0.9061 and not 1.
 */
export function holdDroop(hz, M, sampleRate) {
  const x = (Math.PI * hz * M) / sampleRate
  return x === 0 ? 1 : Math.sin(x) / x
}

/** Resolve one quantity path against a state and its rendered spectrum. */
export function resolvePath(path, state, rendered = null) {
  const parts = String(path).split('.')
  const s = rendered ?? runState(state)

  if (parts[0] === 'line') return lineAt(s, Number(parts[1]))
  if (parts[0] === 'db') return 20 * Math.log10(Math.max(1e-300, lineAt(s, Number(parts[1]))))

  if (parts[0] === 'rate') {
    const b = rateBlock(state)
    if (!b) throw new Error(`rate path with no rate block: ${path}`)
    const M = b.type === 'decimate' ? b.params.M : b.params.L
    if (parts[1] === 'nyquist') return state.sampleRate / (2 * M)
    if (parts[1] === 'grid') return state.sampleRate / M
    if (parts[1] === 'alias') {
      const src = state.sources.find((x) => x.enabled)
      return Math.abs(state.sampleRate / M - src.freq)
    }
    throw new Error(`unknown rate path: ${path}`)
  }

  if (parts[0] === 'cost') {
    const b = rateBlock(state)
    if (!b) throw new Error(`cost path with no rate block: ${path}`)
    const c = multirateCost({
      taps: b.params.taps,
      factor: b.type === 'decimate' ? b.params.M : b.params.L,
      sampleRate: state.sampleRate,
    })
    if (parts[1] in c) return c[parts[1]]
    throw new Error(`unknown cost path: ${path}`)
  }

  if (parts[0] === 'guard') {
    const b = rateBlock(state)
    const def = BLOCK_TYPES[b?.type]
    const h = def?.guard ? def.guard(b.params, state.sampleRate) : null
    if (!h) throw new Error(`guard path with no filter: ${path}`)
    return firResponse(h, Number(parts[1]), state.sampleRate)
  }

  if (parts[0] === 'design') {
    const d = designOf(state)
    if (!d) throw new Error(`design path with no design block: ${path}`)
    if (parts[1] === 'taps') return d.taps ?? null
    if (parts[1] === 'order') return d.order ?? null
    if (parts[1] === 'coefficients') return d.coefficients ?? d.taps
    if (parts[1] === 'estimate') return d.estimateTaps ?? d.estimateOrder
    if (parts[1] === 'grew') return d.grew
    if (parts[1] === 'delta') return d.delta
    if (parts[1] === 'met') return d.met
    if (parts[1] === 'groupDelay') return d.taps != null ? (d.taps - 1) / 2 : null
    throw new Error(`unknown design path: ${path}`)
  }

  if (parts[0] === 'spec') {
    const sp = chainSpec(state.blocks, state.sampleRate)
    if (!sp) throw new Error(`spec path with no specification: ${path}`)
    if (parts[1] === 'worst') return sp.margin.worstDb
    if (parts[1] === 'met') return sp.margin.met
    const band = sp.margin.bands.find((x) => x.id === parts[1])
    if (!band) throw new Error(`unknown band: ${path}`)
    if (parts[2] in band) return band[parts[2]]
    throw new Error(`unknown spec path: ${path}`)
  }

  throw new Error(`unknown quantity path: ${path}`)
}

/** The rows the readout prints for an experiment, from its own claims. */
export function readoutRows(experiment, state) {
  const rendered = runState(state)
  return (experiment.claims ?? []).map((c) => ({
    path: c.path,
    label: c.label,
    unit: c.unit ?? '',
    value: resolvePath(c.path, state, rendered),
  }))
}

export { cascadeResponse }
