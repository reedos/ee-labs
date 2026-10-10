import { it, expect } from 'vitest'
import { thevenin } from './theorems.js'

it.each([1e-15, 1e-9, 1])('ignores unrelated source scale when measuring a port driven by %s V', (volts) => {
  const elements = [
    { type: 'V', id: 'V1', nodes: ['in', 'gnd'], value: volts },
    { type: 'R', id: 'R1', nodes: ['in', 'out'], value: 1000 },
    { type: 'R', id: 'R2', nodes: ['out', 'gnd'], value: 1000 },
  ]
  const alone = thevenin({ elements }, 'out')
  const together = thevenin({ elements: [...elements,
    { type: 'V', id: 'auxV', nodes: ['aux', 'gnd'], value: 1e9 },
    { type: 'R', id: 'auxR', nodes: ['aux', 'gnd'], value: 1 },
  ] }, 'out')
  expect(together.rth.ratio).toBeCloseTo(alone.rth.ratio, 8)
  expect(together.rth.ratio).toBeCloseTo(together.rth.test, 8)
  expect(together.rth.ratio).toBeCloseTo(together.rth.fit, 8)
  // Even a shared resistive path through an ideal voltage-clamped node must
  // not let the auxiliary branch's scale replace the port's error estimate.
  const connected = thevenin({ elements: [...elements,
    { type: 'V', id: 'auxV', nodes: ['aux', 'gnd'], value: 1e9 },
    { type: 'R', id: 'auxR', nodes: ['aux', 'gnd'], value: 1 },
    { type: 'R', id: 'coupling', nodes: ['aux', 'in'], value: 1e30 },
  ] }, 'out')
  expect(connected.rth.ratio).toBeCloseTo(alone.rth.ratio, 8)
})

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
