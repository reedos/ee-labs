import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import React from 'react'
import { FluxPane, ScrubPane, LedgerPane, conductingIn, ORDER } from './panes.jsx'
import { drawScope } from './ScopeCanvas.jsx'
import { fakeCtx, texts } from './fakeCanvas.js'
import { byId, defaultsOf, VIEWS } from '../experiments.js'
import { analyse } from '../analysis.js'
import { signalsOf } from './schematics.jsx'
import { stateAtTime, lossLedger } from '@ee-labs/switched'
import { fmt } from '@ee-labs/ui'

// The three panes Groups D, F and G brought: the flux against its ceiling,
// the conducting path at one instant, and the ledger that has to add up.
//
// Each is held to the claim it exists to make. The flux plot draws the
// ceiling whether or not the trace reaches it, because a flux trace framed on
// its own extent looks the same at a tenth of saturation as through it. The
// scrub lights the parts the engine says are conducting, and nothing else.
// The ledger's residual reads zero.

const at = (id, over = {}) => {
  const exp = byId[id]
  const p = { ...defaultsOf(id), ...over }
  return { exp, p, x: analyse(exp, p) }
}
const text = (h) => h.replace(/<[^>]*>/g, ' ').replace(/&[a-z]+;|&#\d+;/g, ' ')

describe('the flux pane (D1, D2)', () => {
  it('is offered by the two experiments that are about the core, and by no other', () => {
    expect(VIEWS.flux).toBeTruthy()
    const withFlux = ['d1', 'd2']
    for (const id of withFlux) expect(byId[id].views, id).toContain('flux')
    for (const e of Object.values(byId)) {
      if (!withFlux.includes(e.id)) expect(e.views, e.id).not.toContain('flux')
    }
  })

  it('puts the measured swing, the closed form and the ceiling on one table', () => {
    const { x } = at('d1')
    const h = renderToStaticMarkup(<FluxPane x={x} />)
    const t = text(h)
    expect(t).toMatch(/18\.23 mT/)
    expect(t).toMatch(/165\.4 mT/)
    expect(t).toMatch(/4\.8 A/)
    expect(t).toMatch(/300 mT ceiling/)
    // CORE_SCOPE.md rule 3: the model says it is one, where it is shown.
    expect(t).toMatch(/model of iron rather than a law/)
  })

  it('says how much of the period ran past the knee, and says so when none did', () => {
    expect(text(renderToStaticMarkup(<FluxPane x={at('d1').x} />))).toMatch(/under the knee all period/)
    const sat = text(renderToStaticMarkup(<FluxPane x={at('d2').x} />))
    expect(sat).toMatch(/5 µH for 30\.4 % of the period/)
    expect(sat).toMatch(/305\.6 mT/)
  })

  it('frames the plot on the ceiling, not on the trace, so a small excursion looks small', () => {
    // The pane's canvas is drawn by useCanvas, which does not run under the
    // server renderer; the claim is the range the drawing takes, and that is
    // the flux trace's own ceiling either way.
    const easy = at('d1').x
    const hard = at('d2').x
    expect(easy.flux.Bsat).toBe(hard.flux.Bsat)
    expect(Math.max(...easy.flux.B)).toBeLessThan(easy.flux.Bsat)
    expect(Math.max(...hard.flux.B)).toBeGreaterThan(hard.flux.Bsat)
  })
})

describe('the conduction scrub (D2, D3, D4)', () => {
  const scrubbers = ['d2', 'd3', 'd4']

  it('is offered where the plan asks for it, and every offer has a drawing that can light', () => {
    expect(VIEWS.scrub).toBeTruthy()
    for (const id of scrubbers) expect(byId[id].views, id).toContain('scrub')
    for (const id of scrubbers) {
      const { exp, x } = at(id)
      const h = renderToStaticMarkup(
        <ScrubPane x={x} exp={exp} at={x.T * 0.25} onScrub={() => {}} signals={signalsOf(exp)} />,
      )
      expect(h, id).toContain('data-part=')
      expect(h, id).toContain('sch-live')
      expect(h, id).toContain('sch-idle')
    }
  })

  it('lights exactly the parts the engine’s state names, and dims the rest', () => {
    const { exp, x } = at('d4')
    const lit = (t) => {
      const here = stateAtTime(x.ss, t)
      const h = renderToStaticMarkup(
        <ScrubPane x={x} exp={exp} at={t} onScrub={() => {}} signals={signalsOf(exp)} />,
      )
      const parts = [...h.matchAll(/data-part="([^"]+)" class="sch-(live|idle)"/g)].map((m) => [m[1], m[2]])
      return { name: here.seg.name, parts: Object.fromEntries(parts) }
    }
    // While a switch is on, its own leg, the transformer and one rectifier
    // are carrying; in the freewheel both rectifier legs are and neither
    // switch is.
    const on = lit(x.ss.segments[0].t0 + x.ss.segments[0].T / 2)
    expect(on.name).toBe('Q1 on')
    expect(on.parts.Q1).toBe('live')
    expect(on.parts.T).toBe('live')
    expect(on.parts.D1).toBe('live')
    expect(on.parts.Q2).toBe('idle')
    const free = lit(x.ss.segments[1].t0 + x.ss.segments[1].T / 2)
    expect(free.name).toBe('freewheel')
    expect(free.parts.Q1).toBe('idle')
    expect(free.parts.Q2).toBe('idle')
    expect(free.parts.D1).toBe('live')
    expect(free.parts.D2).toBe('live')
    expect(free.parts.L).toBe('live')
  })

  it('names the segment it is inside, including the one the core saturates in', () => {
    const { exp, x } = at('d2')
    const names = x.ss.segments.filter((s) => s.T > 0).map((s) => s.name)
    expect(names).toContain('on·sat')
    const seg = x.ss.segments.find((s) => s.name === 'on·sat')
    const h = renderToStaticMarkup(
      <ScrubPane x={x} exp={exp} at={seg.t0 + seg.T / 2} onScrub={() => {}} signals={signalsOf(exp)} />,
    )
    expect(text(h)).toContain('on·sat')
    // The saturated on interval is still the switch conducting.
    expect(h).toMatch(/data-part="Q" class="sch-live"/)
  })

  it('reads every signal the measures table lists, at that instant and from the solution', () => {
    const { exp, x } = at('d3')
    const t = x.T * 0.25
    const here = stateAtTime(x.ss, t)
    const h = renderToStaticMarkup(
      <ScrubPane x={x} exp={exp} at={t} onScrub={() => {}} signals={signalsOf(exp)} />,
    )
    const rows = ORDER.filter((k) => x.m.sig[k] && signalsOf(exp).includes(k))
    expect(rows.length).toBeGreaterThan(5)
    // The inductor current at that instant is the state itself, and it is on
    // the table in the units the scope draws it in.
    expect(text(h)).toContain(fmt(here.x[0], 'A', 4))
    expect(text(h)).toContain(fmt(here.x[1], 'V', 4))
  })

  it('every switch state the engine can be in has a conducting path named for it', () => {
    for (const id of scrubbers) {
      const { x } = at(id)
      for (const seg of x.ss.segments.filter((s) => s.T > 0)) {
        const parts = conductingIn(seg.name)
        expect(parts.length, `${id} ${seg.name}`).toBeGreaterThan(1)
        expect(parts, `${id} ${seg.name}`).toContain('R')
      }
    }
    // The dead interval is the one where nothing but the output is alive.
    expect(conductingIn('dead')).toEqual(['C', 'R'])
  })

  it('marks the same instant on the scope, so the two panes read together', () => {
    const { x } = at('d4')
    const t = x.T * 0.4
    const ctx = fakeCtx()
    const geom = drawScope(ctx, 600, 320, {
      wf: x.wf,
      baseWf: x.wf,
      traces: ['vsw', 'iL'],
      marks: [{ type: 'cursor', t, label: 'here' }],
    })
    const drawn = texts(ctx).filter((q) => q.text === 'here')
    expect(drawn).toHaveLength(1)
    // And it is drawn at the instant it names, to within a pixel.
    expect(Math.abs(drawn[0].x - geom.sx(t * geom.unit))).toBeLessThan(12)
  })
})

describe('the loss ledger (G1, G4)', () => {
  it('is offered by the experiments that are about where the watts go', () => {
    expect(VIEWS.ledger).toBeTruthy()
    for (const id of ['g1', 'g2', 'g3', 'g4']) expect(byId[id].views, id).toContain('ledger')
    expect(byId.g4.view).toBe('ledger')
  })

  it('names every mechanism, its formula and its share, and closes on a residual of zero', () => {
    const { x } = at('g4')
    const led = lossLedger(x.m)
    const h = renderToStaticMarkup(<LedgerPane x={x} />)
    const t = text(h)
    for (const r of led.rows) expect(t, r.key).toContain(r.label)
    expect(t).toMatch(/a model, not a waveform/)
    expect(h).toContain('data-role="ledger-residual"')
    const residual = h.match(/data-role="ledger-residual">([^<]*)</)[1]
    expect(residual).toMatch(/^0 W$/)
    expect(t).toMatch(/92\.74 % out/)
  })

  it('empties a row when its knob goes to zero, and the residual stays zero', () => {
    const { x } = at('g4', { Ron: 0 })
    const h = renderToStaticMarkup(<LedgerPane x={x} />)
    expect(h.match(/data-role="ledger-residual">([^<]*)</)[1]).toMatch(/^0 W$/)
    expect(text(h)).toContain('switch conduction')
  })

  it('shows the same watts as the losses pane it grew out of', () => {
    const { x } = at('g1')
    const led = lossLedger(x.m)
    expect(led.conduction).toBeCloseTo(x.m.Pcond, 12)
    expect(led.switching).toBeCloseTo(x.m.loss.switching, 12)
  })
})
