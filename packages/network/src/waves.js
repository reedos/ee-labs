// Source waveforms, as piecewise-affine segments.
//
// An independent source may carry a `wave` describing how its value moves in
// time. Every waveform here is made of straight pieces — constant or ramping —
// so the state equation can be solved in closed form on each piece
// (transient.js). That is not a limitation dressed up as a design: step,
// square and triangle are the test signals a first course uses, and each is
// exact under the propagator. A sinusoid joins them in the phasor phase.
//
//   { kind: 'dc', value }                       (or no wave at all: the element's value)
//   { kind: 'step', from, to }                  from for t < 0, to for t ≥ 0
//   { kind: 'ramp', from, slope }               from + slope·t for t ≥ 0
//   { kind: 'square', amp, offset, period, duty } offset + amp for the first
//                                               `duty` of each period, offset − amp after
//   { kind: 'triangle', amp, offset, period }   starts at offset, rising: +amp at T/4,
//                                               −amp at 3T/4, back to offset at T

const EPS = 1e-12

function wave(e) {
  return e.wave || { kind: 'dc', value: e.value }
}

/** The source's value for t < 0 — what the DC solve before the switch sees. */
export function sourceBefore(e) {
  const w = wave(e)
  switch (w.kind) {
    case 'dc':
      return w.value
    case 'step':
    case 'ramp':
      return w.from
    case 'square':
    case 'triangle':
      return w.offset || 0
    default:
      throw new Error(`unknown wave kind ${w.kind}`)
  }
}

/** The value at time t ≥ 0 (at a breakpoint, the value just after it). */
export function sourceValue(e, t) {
  return sourceAffine(e, t).u0
}

/**
 * The affine piece in force just after t0: value u0 at t0⁺ and its slope, so
 * that u(t) = u0 + slope·(t − t0) until the next breakpoint.
 */
export function sourceAffine(e, t0) {
  const w = wave(e)
  switch (w.kind) {
    case 'dc':
      return { u0: w.value, slope: 0 }
    case 'step':
      return { u0: t0 < 0 ? w.from : w.to, slope: 0 }
    case 'ramp':
      return t0 < 0 ? { u0: w.from, slope: 0 } : { u0: w.from + w.slope * t0, slope: w.slope }
    case 'square': {
      const T = w.period
      const duty = w.duty ?? 0.5
      const off = w.offset || 0
      if (t0 < 0) return { u0: off, slope: 0 }
      const ph = phase(t0, T)
      return { u0: ph < duty * T - EPS * T ? off + w.amp : off - w.amp, slope: 0 }
    }
    case 'triangle': {
      const T = w.period
      const off = w.offset || 0
      if (t0 < 0) return { u0: off, slope: 0 }
      const ph = phase(t0, T)
      const slope = (4 * w.amp) / T
      if (ph < T / 4 - EPS * T) return { u0: off + slope * ph, slope }
      if (ph < (3 * T) / 4 - EPS * T) return { u0: off + w.amp - slope * (ph - T / 4), slope: -slope }
      return { u0: off - w.amp + slope * (ph - (3 * T) / 4), slope }
    }
    default:
      throw new Error(`unknown wave kind ${w.kind}`)
  }
}

/** Position within a period, with a value a hair below a breakpoint counted as the breakpoint. */
function phase(t, T) {
  let ph = t - Math.floor(t / T) * T
  if (T - ph < EPS * T) ph = 0
  return ph
}

/** Every time in (0, tEnd) at which the source's piece changes. */
export function sourceBreaks(e, tEnd) {
  const w = wave(e)
  const out = []
  if (w.kind === 'square') {
    const T = w.period
    const duty = w.duty ?? 0.5
    for (let k = 0; k * T < tEnd; k++) {
      if (k > 0) out.push(k * T)
      if (k * T + duty * T < tEnd) out.push(k * T + duty * T)
    }
  } else if (w.kind === 'triangle') {
    const T = w.period
    for (let k = 0; k * T < tEnd; k++) {
      for (const f of [0.25, 0.75, 1]) {
        const t = (k + f) * T
        if (t > 0 && t < tEnd) out.push(t)
      }
    }
  }
  return out.filter((t) => t > EPS * tEnd && t < tEnd * (1 - EPS))
}

/** The union of every source's breakpoints, sorted, with 0 and tEnd as the ends. */
export function allBreaks(sources, tEnd) {
  const set = new Set([0, tEnd])
  for (const e of sources) for (const t of sourceBreaks(e, tEnd)) set.add(t)
  return [...set].sort((a, b) => a - b)
}
