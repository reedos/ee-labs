import { DEFAULTS } from './model.js'

// Physical ranges are independent of the knobs. Fit is an explicit action.
export const DEFAULT_AXES = Object.freeze({ scope: 400, timing: 400000, fanout: 220 })

export function fitAxis(view, current, reference) {
  if (view === 'scope') return Math.ceil(Math.max(current.response.tEnd, reference.response.tEnd) * 1e12 / 20) * 20
  if (view === 'timing') return Math.ceil(Math.max(current.chain.res.tEnd, reference.chain.res.tEnd,
    current.analog ? current.chain.start + current.analog.elapsed / current.chain.tick * 1.2 : 0) / 10000) * 10000
  return Math.ceil(Math.max(...current.fanouts.flatMap((f) => [f.tpHL, f.tpLH]),
    ...reference.fanouts.flatMap((f) => [f.tpHL, f.tpLH])) * 1e12 * 1.1 / 20) * 20
}

export function scopePoints(response, endPs) {
  // The final LTI segment extends exactly: this accepted isolated rail step has
  // no later input events or transistor region changes, even beyond six tau.
  return Array.from({ length: 401 }, (_, i) => {
    // Concentrate samples near the step without changing the physical axes.
    const t = endPs * (i / 400) ** 2
    return [t, response.walk.at(t * 1e-12).sol.v.out]
  })
}

export function logicReadings(chain, tick) {
  return chain.res.signals.map((signal) => {
    const wave = chain.res.waves[signal]
    let value = wave.v[0]
    for (let i = 0; i < wave.t.length; i++) if (wave.t[i] <= tick) value = wave.v[i]
    return { signal, value }
  })
}

export function timingComparison(current, reference, compare) {
  if (!compare) return current.res
  const signal = `q${DEFAULTS.stages}`
  const name = `default ${signal}`
  return { ...current.res, signals: [...current.res.signals, name],
    waves: { ...current.res.waves, [name]: reference.res.waves[signal] } }
}
