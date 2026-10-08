import { describe, it, expect } from 'vitest'
import { EXPERIMENTS, defaultsOf } from './experiments.js'
import { analyse } from './analysis.js'

// A view tab that a lesson offers has to have something to draw. The fault
// lessons list a Phasors view, and the phasor picture reads `x.sets`; without
// it the tab was a blank canvas.
describe('the Phasors view', () => {
  const withView = EXPERIMENTS.filter((e) => e.views.includes('phasors'))

  it('is offered by the phase-current lessons and the four faults', () => {
    expect(withView.some((e) => e.kind === 'fault')).toBe(true)
    expect(withView.some((e) => e.kind !== 'fault')).toBe(true)
  })

  it.each(withView.map((e) => [e.id, e]))('%s has three phase currents and the sets they resolve into', (id, exp) => {
    const x = analyse(exp, defaultsOf(id))
    expect(x.sets, id).toBeTruthy()
    expect(x.sets.total).toHaveLength(3)
    expect(x.sets.positive).toHaveLength(3)
    expect(x.sets.zero).toHaveLength(3)
    const biggest = Math.max(...x.sets.total.map((z) => Math.hypot(z[0], z[1])))
    expect(biggest, `${id}: a fault current is not zero`).toBeGreaterThan(0)
  })
})
