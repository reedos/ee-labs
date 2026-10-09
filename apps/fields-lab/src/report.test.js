import { describe, it, expect } from 'vitest'
import { byId, defaultsOf } from './experiments.js'
import { analyse } from './math.js'
import { reportSummary } from './report.js'

describe('reportSummary', () => {
  it('does not throw when the engine declines a number (d4 between sheet and block)', () => {
    const exp = byId.d4
    const params = { ...defaultsOf('d4'), t: 1e-3 }
    const x = analyse(exp, params)
    expect(x.fourPoint.regime).toBe('between')
    expect(x.headline ? x.headline.value : exp.headline(x).value).toBeNull()
    const summary = reportSummary({ id: 'd4', params, view: 'numbers', x: { ...x, headline: exp.headline(x) } })
    expect(summary.Headline).toBe('Resistivity: — Ω·m')
  })
})
