import React from 'react'
import { useCanvas, COLORS, drawFrame, plotArea, fmtNum } from '@ee-labs/ui'

/**
 * The root locus on the s-plane — this lab's own canvas, not the shared
 * PoleZeroCanvas, for two things that canvas cannot do:
 *
 *   - FRAME THE EXHIBIT. The shared canvas fits every point it is handed,
 *     and locus branches run to infinity: an unstable-plant loop with poles
 *     inside ±4 drew as a dot on a ±300 axis. Here the caller names the
 *     half-extent (locusFrame.js: fitted to the open-loop poles and zeros
 *     and the closed-loop poles at this gain, quantized and held), and the
 *     branches leave the picture the way branches do.
 *   - SAY WHAT THE MARKS ARE. Green crosses, pink crosses and circles were
 *     unexplained on a lesson whose whole content is which cross is which.
 *     A legend on the canvas names them.
 *
 * Scale stays 1:1 both ways, so an angle on screen is the angle in the
 * algebra.
 */
export default function LocusCanvas({
  poles = [],
  zeros = [],
  branches = [],
  highlight = [],
  extent = 1,
  gainLabel = 'Kp',
  verdict = 'stable',
}) {
  const ref = useCanvas(
    (ctx, w, h) => {
      const area = plotArea(w, h)
      const k = area.k || 1
      const aspect = area.w / area.h
      const yMax = extent * Math.max(1, 1 / aspect)
      const xMax = extent * Math.max(1, aspect)

      const { sx, sy } = drawFrame(
        ctx,
        area,
        -xMax,
        xMax,
        -yMax,
        yMax,
        (v) => fmtNum(v),
        (v) => fmtNum(v),
        { zeroLine: true, xTitle: 'Real  σ  (1/s)', yTitle: 'Imaginary  jω  (rad/s)' },
      )

      ctx.save()
      ctx.beginPath()
      ctx.rect(area.x, area.y, area.w, area.h)
      ctx.clip()

      // The unstable half, and the axis a branch must not cross.
      const x0 = sx(0)
      ctx.fillStyle = COLORS.marker
      ctx.globalAlpha = 0.07
      ctx.fillRect(x0, area.y, area.x + area.w - x0, area.h)
      ctx.globalAlpha = 0.5
      ctx.strokeStyle = COLORS.marker
      ctx.lineWidth = 1 * k
      ctx.beginPath()
      ctx.moveTo(x0, area.y)
      ctx.lineTo(x0, area.y + area.h)
      ctx.stroke()
      ctx.globalAlpha = 0.75
      ctx.fillStyle = COLORS.marker
      ctx.font = `${Math.round(11 * k)}px ui-sans-serif, system-ui, sans-serif`
      ctx.textAlign = 'left'
      ctx.textBaseline = 'top'
      // The longest wording that fits the unstable half's own width, the
      // same fallback ladder packages/ui's pole-zero plot uses — a phone at
      // 390px can leave only a sliver to the right of the imaginary axis
      // (Three lags x PID clipped "grows" off the right edge), and the
      // fix is to shorten the label to the room, not to hope it wraps.
      const room = area.x + area.w - x0 - 12 * k
      const label = ['unstable half — a pole here grows', 'a pole here grows', 'unstable half'].find(
        (t) => ctx.measureText(t).width <= room,
      )
      if (label) ctx.fillText(label, x0 + 6 * k, area.y + 6 * k)
      ctx.globalAlpha = 1

      // Branches first, so the marks stay legible on top of them.
      ctx.lineWidth = 1.4 * k
      ctx.strokeStyle = COLORS.traceGhost
      for (const branch of branches) {
        ctx.beginPath()
        let started = false
        for (const [re, im] of branch) {
          if (!Number.isFinite(re) || !Number.isFinite(im)) {
            started = false
            continue
          }
          const x = sx(re)
          const y = sy(im)
          if (!started) {
            ctx.moveTo(x, y)
            started = true
          } else ctx.lineTo(x, y)
        }
        ctx.stroke()
      }

      const r = 7 * k
      const cross = (re, im, color, width) => {
        const x = sx(re)
        const y = sy(im)
        ctx.strokeStyle = color
        ctx.lineWidth = width
        ctx.beginPath()
        ctx.moveTo(x - r, y - r)
        ctx.lineTo(x + r, y + r)
        ctx.moveTo(x + r, y - r)
        ctx.lineTo(x - r, y + r)
        ctx.stroke()
      }
      const circle = (re, im, color, width) => {
        ctx.strokeStyle = color
        ctx.lineWidth = width
        ctx.beginPath()
        ctx.arc(sx(re), sy(im), r, 0, Math.PI * 2)
        ctx.stroke()
      }

      // Exact pole/zero cancellation (First order x Lead, Custom x Lead): a
      // controller zero placed exactly on the plant's own pole draws both
      // markers on the same point, which reads as one mark, not two — the
      // cancellation the lesson is about becomes invisible. Detected by
      // distance relative to the frame (a coincidence is exact algebra, not
      // near-miss geometry, so the tolerance is generous) and drawn apart:
      // the pole nudged one way, the zero the other, joined by a hairline
      // so the two are still legibly the same point, with the fact said in
      // words rather than left for the reader to infer from the overlap.
      const cancelEps = extent * 0.02
      const usedZero = new Set()
      const cancelling = []
      poles.forEach((p) => {
        const zi = zeros.findIndex(
          (z, j) => !usedZero.has(j) && Math.hypot(p[0] - z[0], p[1] - z[1]) <= cancelEps,
        )
        if (zi >= 0) {
          usedZero.add(zi)
          cancelling.push(p)
        }
      })

      for (const [re, im] of poles) {
        if (cancelling.some(([pr, pi]) => pr === re && pi === im)) continue
        cross(re, im, COLORS.trace, 2 * k)
      }
      for (let i = 0; i < zeros.length; i++) {
        if (usedZero.has(i)) continue
        const [re, im] = zeros[i]
        // A zero the frame excludes (locusFrame.js never sizes to one) still
        // gets a mark: an arrow at the edge, in the zero's own direction,
        // naming the value the picture cannot reach.
        if (Math.abs(re) > xMax * 1.001 || Math.abs(im) > yMax * 1.001) {
          const ang = Math.atan2(im, re)
          const ex = Math.cos(ang) || 0
          const ey = Math.sin(ang) || 0
          const reach =
            Math.min(ex ? xMax / Math.abs(ex) : Infinity, ey ? yMax / Math.abs(ey) : Infinity) * 0.93
          const x1 = sx(reach * 0.7 * ex)
          const y1 = sy(reach * 0.7 * ey)
          const x2 = sx(reach * ex)
          const y2 = sy(reach * ey)
          ctx.strokeStyle = COLORS.response
          ctx.lineWidth = 1.6 * k
          ctx.beginPath()
          ctx.moveTo(x1, y1)
          ctx.lineTo(x2, y2)
          ctx.stroke()
          const headAng = Math.atan2(y2 - y1, x2 - x1)
          const headLen = 6 * k
          ctx.beginPath()
          ctx.moveTo(x2, y2)
          ctx.lineTo(x2 - headLen * Math.cos(headAng - 0.4), y2 - headLen * Math.sin(headAng - 0.4))
          ctx.moveTo(x2, y2)
          ctx.lineTo(x2 - headLen * Math.cos(headAng + 0.4), y2 - headLen * Math.sin(headAng + 0.4))
          ctx.stroke()
          ctx.fillStyle = COLORS.response
          ctx.font = `${Math.round(10 * k)}px ui-sans-serif, system-ui, sans-serif`
          ctx.textAlign = ex < 0 ? 'right' : 'left'
          ctx.textBaseline = ey < 0 ? 'bottom' : 'top'
          ctx.fillText(`zero at ${fmtNum(re, 3)}${im ? ` ${im > 0 ? '+' : '−'}${fmtNum(Math.abs(im), 3)}j` : ''}`, x2 + (ex < 0 ? -4 * k : 4 * k), y2 + (ey < 0 ? -4 * k : 4 * k))
        } else {
          circle(re, im, COLORS.response, 2 * k)
        }
      }
      for (const [re, im] of cancelling) {
        const x = sx(re)
        const y = sy(im)
        const d = 5 * k
        ctx.strokeStyle = COLORS.grid
        ctx.lineWidth = 1 * k
        ctx.beginPath()
        ctx.moveTo(x - d, y - d)
        ctx.lineTo(x + d, y + d)
        ctx.stroke()
        ctx.save()
        ctx.translate(-d, -d)
        cross(re, im, COLORS.trace, 2 * k)
        ctx.restore()
        ctx.save()
        ctx.translate(d, d)
        circle(re, im, COLORS.response, 2 * k)
        ctx.restore()
        ctx.fillStyle = COLORS.textBright
        ctx.font = `${Math.round(10 * k)}px ui-sans-serif, system-ui, sans-serif`
        ctx.textAlign = 'left'
        ctx.textBaseline = 'top'
        ctx.fillText('pole and zero cancel exactly', x + d + 8 * k, y + d + 2 * k)
      }
      for (const [re, im] of highlight) cross(re, im, COLORS.marker, 2.4 * k)

      // The legend: which cross is which. Bottom-left, inside the frame,
      // where the left half-plane is usually empty below the real axis.
      const rows = [
        [COLORS.trace, '✕', 'open-loop poles — where the branches start'],
        [COLORS.response, '○', 'open-loop zeros — where branches end'],
        [
          COLORS.marker,
          '✕',
          verdict === 'marginal'
            ? `closed-loop poles at this ${gainLabel} — on the axis`
            : `closed-loop poles at this ${gainLabel}`,
        ],
      ]
      const shown = zeros.length ? rows : [rows[0], rows[2]]
      ctx.font = `${Math.round(10.5 * k)}px ui-sans-serif, system-ui, sans-serif`
      ctx.textBaseline = 'bottom'
      let y = area.y + area.h - 6 * k
      for (let i = shown.length - 1; i >= 0; i--) {
        const [color, glyph, text] = shown[i]
        ctx.textAlign = 'left'
        ctx.fillStyle = color
        ctx.fillText(glyph, area.x + 8 * k, y)
        ctx.fillStyle = COLORS.textBright
        ctx.fillText(text, area.x + 22 * k, y)
        y -= 14 * k
      }
      ctx.restore()
    },
    [poles, zeros, branches, highlight, extent, gainLabel, verdict],
  )

  return (
    <canvas
      ref={ref}
      className="plot"
      role="img"
      aria-label="Root locus on the s-plane: open-loop poles and zeros, the paths the closed-loop poles take as the gain sweeps, and the poles at this gain; the right half is the unstable region"
    />
  )
}
