import React from 'react'
import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import katex from 'katex'
import { complex as z } from '@ee-labs/network'
import { PHASOR_DEFAULTS as defaults, PHASOR_LESSONS, analysePhasors, phasorSteps } from './phasorCourse.js'
import PhasorCourse from './components/PhasorCourse.jsx'
import { courseRoute } from './CourseApp.jsx'

describe('Phasor circuit analysis course', () => {
  it('agrees with full nodal analysis across every topology and control extremes', () => {
    for (const topology of ['rc', 'series', 'branched']) {
      for (const r of [10, 100, 1000]) for (const f of [10, 1000, 10000]) for (const phase of [-180, -35, 0, 90, 180]) {
        const p = { ...defaults, r, f, phase, l: f === 10 ? 0.001 : 0.1, c: r === 10 ? 1e-7 : 1e-5 }
        const a = analysePhasors(topology, p)
        for (const error of a.errors) {
          expect(error.voltage).toBeLessThan(1e-8 * Math.max(1, p.v))
          expect(error.current).toBeLessThan(1e-9)
        }
        expect(z.cabs(a.balance)).toBeLessThan(1e-9)
        expect(z.cabs(z.csub(a.power, a.sumPower))).toBeLessThan(1e-9)
        for (const step of phasorSteps(topology, p, a)) for (const math of step.math) {
          expect(() => katex.renderToString(math, { throwOnError: true })).not.toThrow()
        }
      }
    }
  })
  it('pins the RC corner and series resonance teaching predictions', () => {
    const p = { ...defaults, f: 1 / (2 * Math.PI * defaults.r * defaults.c) }
    const a = analysePhasors('rc', p)
    expect(z.carg(a.current)).toBeCloseTo(Math.PI / 4, 12)
    expect(z.carg(a.rows.at(-1).voltage)).toBeCloseTo(-Math.PI / 4, 12)
    const b = analysePhasors('series', { ...defaults, f: 1 / (2 * Math.PI * Math.sqrt(defaults.l * defaults.c)) })
    expect(b.current[0]).toBeCloseTo(defaults.v / defaults.r, 12)
    expect(Math.abs(b.current[1])).toBeLessThan(1e-12)
    expect(z.cabs(z.cadd(b.rows[1].voltage, b.rows[2].voltage))).toBeLessThan(1e-12)
  })
  it('checks branched-circuit and power predictions by changing the actual parameters', () => {
    const a = analysePhasors('branched', defaults)
    const b = analysePhasors('branched', { ...defaults, r2: defaults.r2 * 2 })
    expect(z.cabs(b.il)).toBeLessThan(z.cabs(a.il))
    const c = analysePhasors('branched', { ...defaults, v: defaults.v * 2 })
    for (let i = 0; i < a.rows.length; i++) expect(z.cabs(z.csub(c.rows[i].power, z.cscale(a.rows[i].power, 4)))).toBeLessThan(1e-12)
  })
  it('agrees with time-averaged instantaneous power using peak sine phasors', () => {
    const a = analysePhasors('branched', { ...defaults, phase: 33 })
    let average = 0
    for (let k = 0; k < 1000; k++) {
      const t = k / (1000 * defaults.f)
      average += z.instant(a.vs, a.w, t) * z.instant(a.current, a.w, t) / 1000
    }
    expect(average).toBeCloseTo(a.power[0], 12)
  })
  it('renders every lesson with equations and independent checks', () => {
    for (const lesson of PHASOR_LESSONS) {
      const html = renderToStaticMarkup(<PhasorCourse lessonId={lesson.id} />)
      expect(html).toContain('Worked phasor solution')
      expect(html).toContain('Independent circuit check')
      expect(html).not.toContain('katex-error')
      expect(html).not.toMatch(/NaN|Infinity/)
    }
  })
  it('preserves existing circuit links and gives new lessons stable addresses', () => {
    expect(courseRoute('')).toBe('complex')
    expect(courseRoute('', '?course=frequency')).toBe(null)
    expect(courseRoute('#phasors=nodal', '?course=frequency')).toBe('nodal')
    expect(courseRoute('#phasors=nodal')).toBe('nodal')
    expect(courseRoute('#phasors=missing')).toBe('complex')
    expect(courseRoute('#circuit=rlcSeries:100:0.01:1e-7&out=l')).toBe(null)
    expect(courseRoute('#circuit=rcLow&phasors=nodal')).toBe(null)
  })
})
