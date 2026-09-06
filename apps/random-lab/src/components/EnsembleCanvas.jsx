import React from 'react'
import { useCanvas, COLORS, plotArea, drawFrame, fmtNum } from '@ee-labs/ui'

// The ensemble view: many realisations and their spread.
//
// The one interaction model the suite lacks, and a new canvas under PROGRAM.md
// section 4. Its second lab is the Applied Analog Lab, whose Monte Carlo is this
// same object with a part tolerance as the source of randomness and a measured
// circuit specification as the outcome. Two props exist for that lab and are
// here from the first commit rather than added later.
//
//   band   { lo, hi, label }     a pass/fail region, drawn BEHIND the runs
//   count  { pass, n, stderr }   how many runs met it, out of how many
//
// They are two halves of one statement and are drawn together. A yield printed
// without its standard error invites a reader to act on a digit that is not
// there, and this is the view where that is most tempting.
//
// `show.spread` draws the statistical spread of the process. It is named apart
// from `band` deliberately. One is a specification a designer chose and the
// other is a property of the process, and a pane that called both a band would
// imply the first is the second.

/** How many runs read as runs rather than as a smear (REVIEW_PLAYBOOK section 6). */
export const MAX_DRAWN = 48

export default function EnsembleCanvas({
  ensemble,
  x = null,
  y = { label: 'Value', units: '' },
  show = { paths: 24, mean: true, spread: 'gaussian' },
  level = 0.6827,
  highlight = null,
  band = null,
  count = null,
  target = null,
  onPickRun = null,
  height = 320,
}) {
  const drawn = Math.min(show.paths ?? 24, ensemble ? ensemble.runs : 0, MAX_DRAWN)

  const ref = useCanvas(
    (ctx, w, h) => {
      ctx.fillStyle = COLORS.bg
      ctx.fillRect(0, 0, w, h)
      if (!ensemble || ensemble.length === 0) {
        ctx.fillStyle = COLORS.text
        ctx.font = '13px ui-monospace, monospace'
        ctx.textAlign = 'center'
        ctx.fillText('Load an experiment with an ensemble', w / 2, h / 2)
        return
      }

      const n = ensemble.length
      const xs = x && x.values ? x.values : null
      const xMin = xs ? xs[0] : 0
      const xMax = xs ? xs[n - 1] : n - 1

      // The vertical range frames the runs that are drawn plus any band, so a
      // specification outside the spread is still visible.
      let lo = Infinity
      let hi = -Infinity
      for (let k = 0; k < drawn; k++) {
        const path = ensemble.paths[k]
        for (let i = 0; i < n; i++) {
          if (path[i] < lo) lo = path[i]
          if (path[i] > hi) hi = path[i]
        }
      }
      if (band) {
        lo = Math.min(lo, band.lo)
        hi = Math.max(hi, band.hi)
      }
      if (target !== null) {
        lo = Math.min(lo, target)
        hi = Math.max(hi, target)
      }
      if (!Number.isFinite(lo) || lo === hi) {
        lo = -1
        hi = 1
      }
      const pad = (hi - lo) * 0.08
      lo -= pad
      hi += pad

      const area = plotArea(w, h, { topInset: 18 })
      const sx = (v) => area.x + ((v - xMin) / (xMax - xMin || 1)) * area.w
      const sy = (v) => area.y + area.h - ((v - lo) / (hi - lo)) * area.h

      // The specification region goes behind everything, so the runs stay
      // readable over it.
      if (band) {
        const top = sy(Math.min(band.hi, hi))
        const bottom = sy(Math.max(band.lo, lo))
        ctx.fillStyle = 'rgba(95, 168, 255, 0.10)'
        ctx.fillRect(area.x, top, area.w, Math.max(1, bottom - top))
        ctx.strokeStyle = 'rgba(95, 168, 255, 0.55)'
        ctx.setLineDash([4, 3])
        ctx.lineWidth = 1
        for (const v of [band.lo, band.hi]) {
          ctx.beginPath()
          ctx.moveTo(area.x, sy(v) + 0.5)
          ctx.lineTo(area.x + area.w, sy(v) + 0.5)
          ctx.stroke()
        }
        ctx.setLineDash([])
      }

      drawFrame(ctx, area, xMin, xMax, lo, hi, (v) => fmtNum(v, 2), (v) => fmtNum(v, 3), {
        zeroLine: true,
        xTitle: x ? `${x.label}${x.units ? ` (${x.units})` : ''}` : 'Sample',
        yTitle: `${y.label}${y.units ? ` (${y.units})` : ''}`,
      })

      const trace = (path, style, width) => {
        ctx.strokeStyle = style
        ctx.lineWidth = width
        ctx.beginPath()
        for (let i = 0; i < n; i++) {
          const px = sx(xs ? xs[i] : i)
          const py = sy(path[i])
          if (i === 0) ctx.moveTo(px, py)
          else ctx.lineTo(px, py)
        }
        ctx.stroke()
      }

      for (let k = 0; k < drawn; k++) {
        if (k === highlight) continue
        trace(ensemble.paths[k], COLORS.traceDim, 1)
      }

      // The statistical spread. Only drawn when it exists: with one run the
      // standard deviation is NaN, and a band at zero width would claim a
      // certainty a single run does not have.
      const spread = show.spread || 'none'
      if (spread !== 'none' && ensemble.runs > 1) {
        const draws = spread === 'both' ? ['gaussian', 'quantile'] : [spread]
        for (const kind of draws) {
          const b =
            kind === 'quantile'
              ? ensemble.quantileBand((1 - level) / 2)
              : ensemble.band(level)
          ctx.strokeStyle = kind === 'quantile' ? COLORS.spectrum : COLORS.response
          ctx.lineWidth = kind === 'quantile' ? 1 : 1.5
          ctx.setLineDash(kind === 'quantile' ? [3, 3] : [])
          for (const edge of [b.lo, b.hi]) {
            ctx.beginPath()
            for (let i = 0; i < n; i++) {
              const px = sx(xs ? xs[i] : i)
              const py = sy(edge[i])
              if (i === 0) ctx.moveTo(px, py)
              else ctx.lineTo(px, py)
            }
            ctx.stroke()
          }
          ctx.setLineDash([])
        }
      }

      if (show.mean !== false) trace(ensemble.mean, COLORS.trace, 2)
      if (highlight !== null && highlight < ensemble.runs) {
        trace(ensemble.paths[highlight], COLORS.textBright, 1.75)
      }

      if (target !== null) {
        ctx.strokeStyle = COLORS.marker
        ctx.lineWidth = 1
        ctx.setLineDash([2, 4])
        ctx.beginPath()
        ctx.moveTo(area.x, sy(target) + 0.5)
        ctx.lineTo(area.x + area.w, sy(target) + 0.5)
        ctx.stroke()
        ctx.setLineDash([])
      }

      // The caption states the drawn count against the total, so a reader is
      // never left guessing whether 200 runs are on screen.
      ctx.font = `${Math.round(11 * area.k)}px ui-monospace, monospace`
      ctx.fillStyle = COLORS.text
      ctx.textAlign = 'left'
      const legend = []
      legend.push(`${drawn} of ${ensemble.runs} runs drawn`)
      if (show.mean !== false) legend.push('mean')
      if (spread === 'gaussian') legend.push(`±${(level * 100).toFixed(0)}% Gaussian band`)
      else if (spread === 'quantile') legend.push(`${(level * 100).toFixed(0)}% quantile band`)
      else if (spread === 'both') legend.push('Gaussian and quantile bands')
      if (highlight !== null) legend.push(`run ${highlight} in white`)
      ctx.fillText(legend.join(' · '), area.x, area.y - 6 * area.k)

      // The yield, with the standard error of the fraction it reports. The
      // Applied Analog Lab reads this corner.
      if (count) {
        const pct = (100 * count.pass) / count.n
        const err = 100 * count.stderr
        const text = `${count.pass} of ${count.n} in ${band && band.label ? band.label : 'band'}` +
          `  ${pct.toFixed(1)} % ± ${err.toFixed(1)}`
        ctx.textAlign = 'right'
        ctx.fillStyle = COLORS.textBright
        ctx.fillText(text, area.x + area.w, area.y - 6 * area.k)
      }
    },
    [ensemble, x, y, show, level, highlight, band, count, target, drawn],
  )

  const pick = (ev) => {
    if (!onPickRun || !ensemble) return
    const rect = ev.currentTarget.getBoundingClientRect()
    const frac = (ev.clientX - rect.left) / rect.width
    onPickRun(Math.min(drawn - 1, Math.max(0, Math.floor(frac * drawn))))
  }

  return (
    <canvas
      ref={ref}
      className="canvas ensemble"
      style={{ width: '100%', height }}
      onClick={onPickRun ? pick : undefined}
      role="img"
      aria-label={`Ensemble: ${drawn} of ${ensemble ? ensemble.runs : 0} runs`}
    />
  )
}
