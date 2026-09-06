import React from 'react'
import { COLORS, drawFrame, plotArea, useCanvas, fmt } from '@ee-labs/ui'
import { noiseOf } from '../groups/o.js'
import { num } from '../format.js'

/**
 * The noise pane, in the two shapes Group O needs.
 *
 * A measured density (O1) is drawn as the estimate, the interval the estimator
 * carries with it, and the flat level the generator was given, so that a
 * reader can see the spray of one frame narrow as frames are averaged. A
 * computed density (O2 to O5) is drawn as the total against frequency with one
 * thin line per source, because the point of the pane is which source is
 * making the noise and where.
 *
 * Both axes are logarithmic and both are named with their units. A density is
 * volts per root hertz, which is not volts, and the axis says so.
 */

/** One colour per source, in the order `noiseSources` returns them. */
const PART_COLOURS = [COLORS.response, COLORS.spectrum, COLORS.phase, COLORS.marker]

export default function NoiseCanvas({ x }) {
  const n = x.sol && x.exp.noise ? noiseOf(x) : null
  const ref = useCanvas(
    (ctx, w, h) => {
      if (!n) return
      const area = plotArea(w, h)
      const c = n.curve
      const fs = Array.from(c.f)
      // A density's first bin can sit at zero hertz, which a log axis has no
      // place for. The axis starts at the first bin that has one.
      const from = fs.find((v) => v > 0) || 1
      const to = fs[fs.length - 1] || from * 10
      const lines = n.kind === 'signal' ? [Array.from(c.asd)] : [Array.from(c.asd), ...Object.values(c.parts).map((p) => Array.from(p))]
      let hi = -Infinity
      let lo = Infinity
      for (const line of lines) {
        for (let k = 0; k < fs.length; k++) {
          const v = line[k]
          if (fs[k] > 0 && v > 0) {
            hi = Math.max(hi, v)
            lo = Math.min(lo, v)
          }
        }
      }
      if (!Number.isFinite(hi) || !(hi > 0)) return
      // Four decades of density is as much as a reader can take off one axis,
      // and every source that matters to the total is inside them.
      lo = Math.max(lo, hi / 1e4)
      const y0 = Math.log10(lo) - 0.2
      const y1 = Math.log10(hi) + 0.2
      drawFrame(ctx, area, Math.log10(from), Math.log10(to), y0, y1, (v) => fmt(10 ** v, 'Hz', 2), (v) => fmt(10 ** v, '', 2), {
        xTitle: 'frequency (Hz, log)',
        yTitle: 'density (V per √Hz, log)',
        xStep: 1,
      })
      const sx = (f) => area.x + ((Math.log10(f) - Math.log10(from)) / (Math.log10(to) - Math.log10(from))) * area.w
      const sy = (v) => area.y + area.h - ((Math.log10(Math.max(v, 10 ** y0)) - y0) / (y1 - y0)) * area.h
      const stroke = (line, colour, width) => {
        ctx.strokeStyle = colour
        ctx.lineWidth = width
        ctx.beginPath()
        let started = false
        for (let k = 0; k < fs.length; k++) {
          if (!(fs[k] > 0) || !(line[k] > 0)) continue
          const px = sx(fs[k])
          const py = sy(line[k])
          if (!started) {
            ctx.moveTo(px, py)
            started = true
          } else ctx.lineTo(px, py)
        }
        ctx.stroke()
      }
      if (n.kind === 'signal') {
        // The interval the chi-square carries, drawn as a band so the estimate
        // is never read as a number without it.
        ctx.fillStyle = 'rgba(95, 168, 255, 0.16)'
        ctx.beginPath()
        let first = true
        for (let k = 0; k < fs.length; k++) {
          if (!(fs[k] > 0) || !(c.ci[k][1] > 0)) continue
          const px = sx(fs[k])
          const py = sy(Math.sqrt(c.ci[k][1]))
          if (first) {
            ctx.moveTo(px, py)
            first = false
          } else ctx.lineTo(px, py)
        }
        for (let k = fs.length - 1; k >= 0; k--) {
          if (!(fs[k] > 0) || !(c.ci[k][0] > 0)) continue
          ctx.lineTo(sx(fs[k]), sy(Math.sqrt(c.ci[k][0])))
        }
        ctx.closePath()
        ctx.fill()
        stroke(Array.from(c.asd), COLORS.trace, 1.2)
        ctx.strokeStyle = COLORS.marker
        ctx.setLineDash([5, 4])
        ctx.lineWidth = 1.4
        ctx.beginPath()
        ctx.moveTo(sx(from), sy(c.flat))
        ctx.lineTo(sx(to), sy(c.flat))
        ctx.stroke()
        ctx.setLineDash([])
      } else {
        // One line per source, each in its own colour and named in the same
        // colour, because the pane exists to say which source is making the
        // noise. Drawn in one weight and one colour they are three lines a
        // reader cannot tell apart.
        // The loudest first, so the ones a reader is looking for are the ones
        // that get a colour. A pane this size holds four names and no more.
        const ids = Object.keys(c.parts).sort((a, b) => (n.stack[b] || 0) - (n.stack[a] || 0))
        const named = ids.slice(0, PART_COLOURS.length)
        for (const id of ids.slice(PART_COLOURS.length)) stroke(Array.from(c.parts[id]), COLORS.traceGhost, 1.1)
        named.forEach((id, k) => stroke(Array.from(c.parts[id]), PART_COLOURS[k], 1.1))
        stroke(Array.from(c.asd), COLORS.trace, 1.8)
        ctx.font = `${Math.round(11 * area.k)}px ui-monospace, SFMono-Regular, Menlo, monospace`
        ctx.textAlign = 'left'
        const line = (text, colour, k) => {
          ctx.fillStyle = colour
          ctx.fillText(text, area.x + 8, area.y + 14 + k * 14)
        }
        line('total', COLORS.trace, 0)
        named.forEach((id, k) => line(id, PART_COLOURS[k], k + 1))
        if (ids.length > named.length) line(`${ids.length - named.length} more, in the list`, COLORS.text, named.length + 1)
      }
    },
    [x, n],
  )
  if (!n) {
    return (
      <p className="pane-empty" data-role="empty">
        This experiment carries no noise sources to sum.
      </p>
    )
  }
  return (
    <div className="pane-split">
      <canvas className="pane-canvas" ref={ref} aria-label="Noise density against frequency" />
      <ul className="pane-list">
        {n.kind === 'signal' ? (
          <>
            <li>measured {num(n.measured, 'V')} per √Hz</li>
            <li>the generator’s own {num(n.density, 'V')} per √Hz</li>
            <li>
              {n.segments} frames, {n.dof.toFixed(0)} degrees of freedom
            </li>
            <li>spread across bins {(100 * n.flatness).toFixed(1)} %, the estimator’s {(100 * n.relativeSe).toFixed(1)} %</li>
            <li>
              the integral over 0 to {fmt(n.band[1], 'Hz', 3)} is {num(n.integral, 'V')} rms
            </li>
          </>
        ) : (
          <>
            <li>
              total {num(n.density, 'V')} per √Hz at {fmt(n.at, 'Hz', 3)}
            </li>
            {Object.entries(n.stack).map(([id, v]) => (
              <li key={id}>
                {id} {num(v, 'V')} per √Hz
              </li>
            ))}
            <li>
              rms over {fmt(n.band[0], 'Hz', 2)} to {fmt(n.band[1], 'Hz', 3)} is {num(n.rms, 'V')}
            </li>
            {Number.isFinite(n.nf) ? <li>noise figure {n.nf.toFixed(3)} dB</li> : null}
            {n.snrdb ? Object.entries(n.snrdb).map(([nd, v]) => <li key={nd}>SNR at {nd} {v.toFixed(2)} dB</li>) : null}
          </>
        )}
      </ul>
    </div>
  )
}
