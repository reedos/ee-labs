import { pinDrive } from './pin.js'

export function scopeWindow(p, direction) {
  const resistance = direction === 'rise' && p.drive === 'open-drain' ? p.rpu : p.ron
  return 8 * resistance * p.cload
}

export function scopeRun(p, direction, tEnd) {
  return pinDrive(p, [{ t: 0, value: direction === 'rise' ? 1 : 0 }],
    { tEnd, initial: direction === 'rise' ? 0 : p.vdd })
}

export function scopeReading(run, t, capacitance) {
  const point = run.at(t)
  const voltage = point.x[0]
  const current = capacitance * (point.segment.target - voltage) / point.segment.tau
  return { ...point, voltage, current, energy: 0.5 * capacitance * voltage ** 2 }
}
