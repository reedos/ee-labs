import { it, expect } from 'vitest'
import { thevenin } from './theorems.js'

it.each([1e-15, 0.1, 1e6])('does not turn balanced-port roundoff into a resistance at source amplitude %s', (volts) => {
  const net = { elements: [
    { type: 'V', id: 'V1', nodes: ['in', 'gnd'], value: volts },
    { type: 'R', id: 'R1', nodes: ['in', 'a'], value: 10 },
    { type: 'R', id: 'R2', nodes: ['a', 'gnd'], value: 100 },
    { type: 'R', id: 'R3', nodes: ['in', 'b'], value: 30 },
    { type: 'R', id: 'R4', nodes: ['b', 'gnd'], value: 300 },
  ] }
  const x = thevenin(net, 'a', 'b')
  expect(x.rth.ratio).toBeNaN()
  expect(x.rth.test).toBeCloseTo(400 / 11, 8)
})

it.each([1e-15, 1e-9, 1, 1e6])('measures the same port resistance at source amplitude %s', (volts) => {
  const net = { elements: [
    { type: 'V', id: 'V1', nodes: ['in', 'gnd'], value: volts },
    { type: 'R', id: 'R1', nodes: ['in', 'out'], value: 1000 },
    { type: 'R', id: 'R2', nodes: ['out', 'gnd'], value: 1000 },
  ] }
  const x = thevenin(net, 'out')
  // Three independent circuit solves: open/short, killed-source test, loaded fit.
  expect(x.rth.ratio).toBeCloseTo(x.rth.test, 7)
  expect(x.rth.fit).toBeCloseTo(x.rth.test, 7)
  expect(x.rth.ratio).toBeCloseTo(500, 7)
})
