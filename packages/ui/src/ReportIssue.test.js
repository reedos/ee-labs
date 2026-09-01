import { describe, it, expect } from 'vitest'
import { issueBody, reportUrl } from './ReportIssue.jsx'

// The whole value of this button is that the report arrives with the setup
// that produced it. A body that quietly loses the state, or a URL too long for
// GitHub to accept, fails silently and looks fine — so both are pinned.

const STATE = {
  sources: [
    { id: 1, type: 'square', freq: 281.25, amp: 1, phase: 0, enabled: true, topHarmonic: 9 },
    { id: 2, type: 'sine', freq: 1000, amp: 0.25, phase: 1.2, enabled: false },
  ],
  blocks: [{ id: 1, type: 'lowpass', bypass: false, params: { cutoff: 1200, q: 0.707 } }],
  sampleRate: 8000,
  fftSize: 2048,
  window: 'hann',
  presetName: 'A square that fits',
}

const body = (over = {}) =>
  issueBody({ lab: 'Signal Lab', version: '1.0.0', state: STATE, summary: { Preset: 'x' }, ...over })

describe('the report body', () => {
  it('asks the reader for one thing, and says so first', () => {
    const b = body()
    expect(b.startsWith('### What looked wrong, confusing, or unexplained?')).toBe(true)
    // The reader's blank line comes before any of the machinery.
    expect(b.indexOf('What looked wrong')).toBeLessThan(b.indexOf('Exact state'))
  })

  it('invites the two reports that are not bugs', () => {
    const b = body()
    expect(b).toMatch(/confusing/i)
    expect(b).toMatch(/needed explaining|unexplained/i)
    // And says plainly that a missing explanation is not a lesser report,
    // because a button that looks like a bug tracker gets only bugs.
    expect(b).toMatch(/not a lesser report/i)
  })

  it('carries the state exactly, not a lossy summary of it', () => {
    // The share-link format would drop phase, enabled and topHarmonic. A
    // reproducer that does not reproduce is worse than none.
    const b = body()
    const json = b.slice(b.indexOf('```json') + 7, b.lastIndexOf('```'))
    const round = JSON.parse(json)
    expect(round).toEqual(STATE)
    expect(round.sources[0].topHarmonic).toBe(9)
    expect(round.sources[1].enabled).toBe(false)
    expect(round.sources[1].phase).toBeCloseTo(1.2, 12)
  })

  it('renders the summary rows it was handed', () => {
    const b = body({ summary: { Preset: 'Aliasing', 'Sample rate': '8 kHz' } })
    expect(b).toContain('| Preset | Aliasing |')
    expect(b).toContain('| Sample rate | 8 kHz |')
  })

  it('drops empty summary rows rather than printing blanks', () => {
    const b = body({ summary: { Preset: 'x', Chain: '', Notes: null } })
    expect(b).toContain('| Preset | x |')
    expect(b).not.toContain('| Chain |')
    expect(b).not.toContain('| Notes |')
  })

  it('names the lab and the version, so a report can be placed', () => {
    const b = body({ lab: 'Control Lab', version: '1.2.3' })
    expect(b).toContain('| Lab | Control Lab |')
    expect(b).toContain('| Version | 1.2.3 |')
  })

  it('survives a state that cannot be serialised', () => {
    const cyclic = { a: 1 }
    cyclic.self = cyclic
    expect(() => body({ state: cyclic })).not.toThrow()
    expect(body({ state: cyclic })).toMatch(/could not be serialised/)
  })

  it('truncates a huge state instead of overflowing the URL silently', () => {
    const huge = { blocks: Array.from({ length: 4000 }, (_, i) => ({ i, type: 'lowpass' })) }
    const b = body({ state: huge })
    expect(b).toMatch(/truncated at 6000 characters/)
    expect(b.length).toBeLessThan(9000)
  })
})

describe('the report URL', () => {
  it('points at a new issue on the repo, with the body prefilled', () => {
    const u = new URL(reportUrl({ lab: 'Signal Lab', version: '1.0.0', state: STATE, summary: {} }))
    expect(u.origin + u.pathname).toBe('https://github.com/reedos/ee-labs/issues/new')
    expect(u.searchParams.get('title')).toBe('[Signal Lab] ')
    expect(u.searchParams.get('body')).toContain('What looked wrong')
  })

  it('sets no labels, which a visitor without triage rights cannot apply', () => {
    // GitHub drops the whole labels parameter for such a visitor — which is
    // every reader this button exists for — so asking for one is at best
    // nothing and at worst a broken prefill.
    const u = new URL(reportUrl({ lab: 'Signal Lab', version: '1.0.0', state: STATE, summary: {} }))
    expect(u.searchParams.get('labels')).toBeNull()
  })

  it('stays inside the length GitHub will accept, even for a busy setup', () => {
    // Measured against GitHub's ~8 KB limit on a prefilled issue URL.
    const busy = {
      sources: Array.from({ length: 12 }, (_, i) => ({
        id: i, type: 'square', freq: 100 * i + 50, amp: 1 / (i + 1), phase: 0.1 * i,
        enabled: true, topHarmonic: 2 * i + 1,
      })),
      blocks: Array.from({ length: 12 }, (_, i) => ({
        id: i, type: 'biquad', bypass: false,
        params: { b0: 0.123456, b1: -1.98, b2: 0.9, a1: -1.9, a2: 0.91 },
      })),
      sampleRate: 48000, fftSize: 8192, window: 'hann',
    }
    const url = reportUrl({ lab: 'Signal Lab', version: '1.0.0', state: busy, summary: {} })
    expect(url.length).toBeLessThan(7100)
    // ...and it still carries a usable chunk of the setup rather than giving up.
    expect(new URL(url).searchParams.get('body')).toMatch(/truncated at \d+ characters|"sampleRate"/)
  })

  it('degrades to a short report rather than a broken one when nothing fits', () => {
    // A pathological setup. The ladder keeps as much of the state as will
    // fit rather than dropping it: at 60,000 blocks it still lands on a
    // 400-character excerpt, which names the shape of what the reader had.
    // What must survive unconditionally is their own prompt.
    const enormous = { blocks: Array.from({ length: 60000 }, (_, i) => ({ i, type: 'lowpass' })) }
    const url = reportUrl({ lab: 'Signal Lab', version: '1.0.0', state: enormous, summary: {} })
    expect(url.length).toBeLessThan(7100)
    const b = new URL(url).searchParams.get('body')
    expect(b).toMatch(/truncated at \d+ characters/)
    expect(b).toMatch(/What looked wrong/)
    expect(b).toMatch(/lowpass/)
  })

  it('has a last resort that drops the state entirely, and says so', () => {
    // The floor of the ladder. Unreachable from any real setup, which is why
    // it is exercised directly rather than by trying to construct one.
    const b = issueBody({ lab: 'Signal Lab', version: '1.0.0', state: { a: 1 }, summary: {}, cap: 0 })
    expect(b).toMatch(/too large to carry in a link/)
    expect(b).toMatch(/What looked wrong/)
  })

  it('keeps the ordinary setup well inside the limit', () => {
    const url = reportUrl({ lab: 'Signal Lab', version: '1.0.0', state: STATE, summary: { Preset: 'A square that fits' } })
    expect(url.length).toBeLessThan(3000)
    expect(new URL(url).searchParams.get('body')).toContain('"topHarmonic": 9')
  })
})
