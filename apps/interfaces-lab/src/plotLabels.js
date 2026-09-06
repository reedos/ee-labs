import { COLORS, plotArea } from '@ee-labs/ui'

export const INPUT_LIMITS = 'VIL is the maximum input voltage guaranteed to count as low. VIH is the minimum input voltage guaranteed to count as high. Between them, neither logic level is guaranteed.'
export const pinPlotArea = (w, h) => {
  const area = plotArea(w, h, { topInset: 20 })
  return { ...area, w: Math.max(1, area.w - 34) }
}
export function waveformKey(analog) {
  return [
    ...(analog ? [{ label: 'Pin voltage', color: COLORS.trace }, { label: 'Default reference', color: COLORS.spectrum, kind: 'dashed' }] : []),
    { label: 'VIL: maximum guaranteed low input', color: COLORS.spectrum, kind: 'dashed' },
    { label: 'VIH: minimum guaranteed high input', color: COLORS.response, kind: 'dashed' },
    { label: 'Shaded band: undefined input logic', color: COLORS.spectrumDim, kind: 'region' },
    { label: analog ? 'Time cursor and voltage sample' : 'Time cursor', color: COLORS.textBright },
  ]
}
export const LOAD_KEY = [
  { label: '10-90% rise time', color: COLORS.trace },
  { label: 'Maximum allowed rise time', color: COLORS.response, kind: 'dashed' },
  { label: 'Selected load and its rise time', color: COLORS.spectrum, kind: 'dot' },
  { label: 'Sweep probe and sampled rise time', color: COLORS.textBright },
]
export const BUDGET_KEY = [
  { label: 'Estimated ground bounce', color: COLORS.trace },
  { label: 'Available margin: smaller of low and high margins', color: COLORS.response, kind: 'dashed' },
  { label: 'Selected switching pin count', color: COLORS.spectrum, kind: 'dot' },
  { label: 'Sweep probe pin count', color: COLORS.textBright, kind: 'dot' },
]
