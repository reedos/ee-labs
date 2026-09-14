import { describe, it, expect } from 'vitest'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { fmtNum } from '@ee-labs/ui'
import { fmtInt } from './format.js'
import { Closed, Estimate, Against } from './components/panes.jsx'

// Why this file exists.
//
// Every readout of a count asked for zero significant figures, and every axis
// of a sample index did the same. `fmtNum` calls `toPrecision`, which accepts 1
// to 100 and throws a RangeError on 0. The throw happened inside React's commit
// phase, so the app rendered an empty page in a browser while 305 unit tests
// passed. The tests below are the ones that would have caught it.

describe('fmtInt, the formatter counts use', () => {
  it('prints a whole number', () => {
    expect(fmtInt(200)).toBe('200')
    expect(fmtInt(0)).toBe('0')
    expect(fmtInt(15.28)).toBe('15')
  })

  it('prints an em rule rather than "NaN" for a quantity that does not exist', () => {
    expect(fmtInt(NaN)).toBe('—')
    expect(fmtInt(Infinity)).toBe('—')
  })

  it('is needed because the shared formatter cannot take zero digits', () => {
    expect(() => fmtNum(1234, 0)).toThrow(RangeError)
    expect(fmtNum(1234, 2)).toBe('1200')
  })
})

describe('the readouts', () => {
  const html = (el) => renderToStaticMarkup(el)

  it('renders a count at sig 0 rather than throwing', () => {
    expect(html(<Closed label="Runs" value={200} sig={0} />)).toContain('>200<')
    expect(html(<Closed label="Errors" value={0} sig={0} />)).toContain('>0<')
  })

  it('never puts the string NaN on screen', () => {
    const out = html(
      <Closed
        label="One-shot estimate"
        value={NaN}
        note="a random walk has no stationary variance, so there is none to compare"
      />,
    )
    expect(out).not.toMatch(/NaN/)
    expect(out).toContain('—')
    expect(out).toContain('no stationary variance')
  })

  it('still prints an estimate with its interval', () => {
    const est = { value: 0.5, ci: [0.4, 0.6], level: 0.95, n: 100 }
    const out = html(<Estimate label="Counted rate" est={est} />)
    expect(out).toMatch(/±/)
    expect(out).toMatch(/95 % interval/)
  })

  it('never puts an engineering prefix on a decibel or a percentage', () => {
    // 0.9112 dB printed as "911.2 mdB" beside a lesson that says 0.911 dB, and
    // a counted tail's half width printed as "510 m%".
    expect(html(<Closed label="Mismatch loss" value={0.9112255} unit="dB" />)).toContain('0.9112 dB')
    expect(html(<Closed label="Mismatch loss" value={0.9112255} unit="dB" />)).not.toMatch(/mdB/)
    const est = { value: 0.15955, ci: [0.1545, 0.1646], level: 0.95, n: 20000 }
    const out = html(<Estimate label="Tail counted" est={est} unit="%" scale={100} />)
    expect(out).not.toMatch(/m%/)
    expect(out).toMatch(/15\.9\d* %/)
  })

  it('and a comparison names the gap', () => {
    const out = html(<Against label="Measured spread" measured={0.104} predicted={0.1} />)
    expect(out).toMatch(/4\.00 % apart/)
  })
})
