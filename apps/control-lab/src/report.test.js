import { describe, it, expect } from 'vitest'
import { reportSummary } from './report.js'
import { PLANTS, CONTROLLERS, defaultsOf } from './systems.js'

// Same defect as Circuit Lab's, one degree worse: this builder interpolated
// the missing field into a template, so instead of dropping the row it wrote
// the word "undefined" into the report.

const base = (over = {}) => ({
  plantId: 'motor',
  plantP: defaultsOf(PLANTS.motor),
  ctrlId: 'p',
  ctrlP: defaultsOf(CONTROLLERS.p),
  stepInput: 'ref',
  lower: 'step',
  lesson: null,
  ...over,
})

describe('the report summary', () => {
  it('names a real plant and controller for every combination', () => {
    for (const plantId of Object.keys(PLANTS)) {
      for (const ctrlId of Object.keys(CONTROLLERS)) {
        const s = reportSummary(
          base({
            plantId,
            plantP: defaultsOf(PLANTS[plantId]),
            ctrlId,
            ctrlP: defaultsOf(CONTROLLERS[ctrlId]),
          }),
        )
        expect(s.Plant, `${plantId}/${ctrlId}`).toContain(PLANTS[plantId].name)
        expect(s.Controller, `${plantId}/${ctrlId}`).toContain(CONTROLLERS[ctrlId].name)
      }
    }
  })

  it('never yields undefined, NaN or [object Object] in any row', () => {
    for (const plantId of Object.keys(PLANTS)) {
      for (const ctrlId of Object.keys(CONTROLLERS)) {
        for (const stepInput of ['ref', 'dist']) {
          const s = reportSummary(
            base({
              plantId,
              plantP: defaultsOf(PLANTS[plantId]),
              ctrlId,
              ctrlP: defaultsOf(CONTROLLERS[ctrlId]),
              stepInput,
            }),
          )
          for (const [k, v] of Object.entries(s)) {
            expect(String(v), `${plantId}/${ctrlId} → ${k}`).not.toMatch(
              /undefined|NaN|\[object Object\]/,
            )
            expect(String(v).trim(), `${plantId}/${ctrlId} → ${k}`).not.toBe('')
          }
        }
      }
    }
  })

  it('carries the gains, which are the whole question in this lab', () => {
    const s = reportSummary(base({ ctrlId: 'pid', ctrlP: defaultsOf(CONTROLLERS.pid) }))
    for (const k of Object.keys(defaultsOf(CONTROLLERS.pid))) {
      expect(s.Controller).toContain(k)
    }
  })

  it('says which input the step was applied to, in words', () => {
    expect(reportSummary(base({ stepInput: 'ref' }))['Step applied to']).toBe('the reference')
    expect(reportSummary(base({ stepInput: 'dist' }))['Step applied to']).toBe('the plant input')
  })

  it('survives an unknown plant rather than throwing', () => {
    const s = reportSummary(base({ plantId: 'nope', plantP: {} }))
    expect(s.Plant).toBe('nope')
  })
})
