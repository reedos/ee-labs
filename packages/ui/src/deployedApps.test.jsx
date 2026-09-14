import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { DEPLOYED_APPS } from './deployedApps.js'
import { homeUrl, siblingUrl } from './deeplink.js'
import { labUrl } from './circuitLink.js'
import LabNav from './LabNav.jsx'

afterEach(() => vi.unstubAllGlobals())

describe('deployed app paths', () => {
  it('contains unique path-safe slugs', () => {
    expect(DEPLOYED_APPS.length).toBeGreaterThan(0)
    expect(new Set(DEPLOYED_APPS).size).toBe(DEPLOYED_APPS.length)
    for (const slug of DEPLOYED_APPS) expect(slug).toMatch(/^[a-z]+(?:-[a-z]+)+$/)
  })

  it.each(DEPLOYED_APPS)('%s resolves every sibling and its home without changing the fragment', (from) => {
    for (const mount of ['/', '/ee-labs/', '/deep/nest/']) {
      for (const suffix of ['/', '/index.html', '']) {
        const loc = { origin: 'https://example.test', pathname: `${mount}${from}${suffix}` }
        expect(homeUrl(loc)).toBe(`${loc.origin}${mount}`)
        for (const to of DEPLOYED_APPS) {
          const expected = from === to ? null : `${loc.origin}${mount}${to}/#x=0.10000000000000002`
          expect(siblingUrl(to, 'x=0.10000000000000002', loc)).toBe(expected)
          expect(labUrl(to, 'x=0.10000000000000002', loc)).toBe(expected)
        }
      }
    }
  })

  it('renders navigation from a dark app without advertising it from a released app', () => {
    vi.stubGlobal('window', { location: { origin: 'https://example.test', pathname: '/ee-labs/logic-lab/' } })
    const dark = renderToStaticMarkup(<LabNav current="logic-lab" currentLabel="Logic" />)
    expect(dark).toContain('class="labnav"')
    expect(dark).toContain('aria-current="page">Logic')
    expect(dark).toContain('href="https://example.test/ee-labs/circuit-lab/"')
    window.location.pathname = '/ee-labs/circuit-lab/'
    const released = renderToStaticMarkup(<LabNav current="circuit-lab" />)
    expect(released).not.toContain('logic-lab')
    expect(released).not.toContain('>Logic<')
  })

  it('still rejects unknown paths and bare development ports', () => {
    for (const pathname of ['/', '/unknown-lab/', '/my-logic-lab-notes/']) {
      const loc = { origin: 'http://localhost:5173', pathname }
      expect(homeUrl(loc)).toBeNull()
      expect(siblingUrl('circuit-lab', '', loc)).toBeNull()
      expect(labUrl('circuit-lab', '', loc)).toBeNull()
    }
  })
})
