import { describe, it, expect, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import {
  track,
  handOverEvent,
  arrivalEvent,
  GOATCOUNTER_ENDPOINT,
  _resetForTests,
} from './analytics.js'

// A stand-in for the page: the counter's global (or not), and the script tag
// that will announce the counter's arrival (or not).
function fakeWindow({ counter = null, tag = true } = {}) {
  const listeners = []
  const script = {
    addEventListener: (type, fn) => listeners.push({ type, fn }),
  }
  const win = {
    goatcounter: counter,
    document: { querySelector: (sel) => (tag && sel === 'script[data-goatcounter]' ? script : null) },
  }
  // Simulate count.js landing: the global appears, then the tag's load fires.
  win.load = (c) => {
    win.goatcounter = c
    for (const l of listeners) if (l.type === 'load') l.fn()
  }
  return win
}

describe('track', () => {
  beforeEach(() => _resetForTests())

  it('sends straight away once the counter is on the page, as an event', () => {
    const calls = []
    const win = fakeWindow({ counter: { count: (v) => calls.push(v) } })
    expect(track('handover/open/signal-lab/named/rcLow', undefined, win)).toBe('sent')
    expect(calls).toEqual([
      { path: 'handover/open/signal-lab/named/rcLow', title: 'handover/open/signal-lab/named/rcLow', event: true },
    ])
  })

  it('queues what arrives before the script does, and drains it on load — in order', () => {
    const win = fakeWindow()
    expect(track('arrive/signal-lab/circuit/rcLow', undefined, win)).toBe('queued')
    expect(track('second', undefined, win)).toBe('queued')
    const calls = []
    win.load({ count: (v) => calls.push(v) })
    expect(calls.map((c) => c.path)).toEqual(['arrive/signal-lab/circuit/rcLow', 'second'])
    // ...and is not sent twice.
    win.load({ count: (v) => calls.push(v) })
    expect(calls).toHaveLength(2)
  })

  it('is off — not queued forever — where there is no counter tag or no window', () => {
    expect(track('x', undefined, fakeWindow({ tag: false }))).toBe('off')
    expect(track('x', undefined, null)).toBe('off')
  })

  it('never lets a broken counter into the click handler', () => {
    const win = fakeWindow({
      counter: {
        count: () => {
          throw new Error('blocked')
        },
      },
    })
    expect(() => track('x', undefined, win)).not.toThrow()
    // A page whose document has no querySelector (a bare object) is also fine.
    expect(track('x', undefined, { goatcounter: null, document: {} })).toBe('off')
  })
})

describe('event names', () => {
  it('hand-over: action / app / tier / circuit, with every segment present', () => {
    expect(
      handOverEvent({ action: 'open', app: 'signal-lab', tier: 'lowpass', circuit: 'rcLow' }),
    ).toBe('handover/open/signal-lab/lowpass/rcLow')
    expect(handOverEvent({ action: 'copy', app: 'control-lab', tier: 'custom', circuit: 'twinT' })).toBe(
      'handover/copy/control-lab/custom/twinT',
    )
  })

  it('a missing part becomes "-" so the columns stay aligned; slashes and spaces cannot split a segment', () => {
    expect(handOverEvent({ action: 'open', app: 'signal-lab' })).toBe('handover/open/signal-lab/-/-')
    expect(handOverEvent({ action: 'open', app: 'x', tier: 'a/b c', circuit: '' })).toBe(
      'handover/open/x/a_b_c/-',
    )
  })

  it('arrival: lab / from-app / id, or "link" when the link carried no provenance', () => {
    expect(arrivalEvent('signal-lab', { app: 'circuit', id: 'rlcSeries', label: 'Series RLC' })).toBe(
      'arrive/signal-lab/circuit/rlcSeries',
    )
    expect(arrivalEvent('signal-lab', null)).toBe('arrive/signal-lab/link/-')
    expect(arrivalEvent('signal-lab', undefined)).toBe('arrive/signal-lab/link/-')
  })
})

describe('every released entry page carries the counter', () => {
  // The tag is the whole mechanism; a page without it counts nothing and says
  // nothing about it. Pinned by file so a fresh index.html — or a tidy-up that
  // drops "an unused script" — fails here rather than as a silent gap in the
  // numbers. Dark-launched labs are deliberately not listed: they join when
  // they release.
  const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
  const pages = [
    'site/index.html',
    'apps/signal-lab/index.html',
    'apps/circuit-lab/index.html',
    'apps/control-lab/index.html',
  ]

  it.each(pages)('%s', (rel) => {
    const html = readFileSync(join(root, rel), 'utf8')
    expect(html).toContain(`data-goatcounter="${GOATCOUNTER_ENDPOINT}"`)
    expect(html).toContain('src="https://gc.zgo.at/count.js"')
    // async, so it can never hold the lab up; exactly one, so nothing double-counts.
    expect(html.match(/data-goatcounter=/g)).toHaveLength(1)
    expect(html).toMatch(/<script data-goatcounter="[^"]+" async src=/)
  })
})
