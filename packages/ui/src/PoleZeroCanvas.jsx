import React from 'react'
import { useCanvas } from './useCanvas.js'
import { COLORS, drawFrame, plotArea } from './plot.js'
import { fmtNum } from './format.js'

/**
 * Poles and zeros on the s-plane.
 *
 * The most compact statement of what a circuit does. Distance from the origin
 * sets the frequency scale, angle sets the damping, and which half of the plane
 * a pole sits in decides whether the thing is stable at all — so the right half
 * is shaded, because a pole crossing that line is the whole subject of stability.
 */
export default function PoleZeroCanvas({
  poles = [],
  zeros = [],
  branches = null,
  highlight = null,
  cloud = null,
  // Opt-in, not a new default: Control Lab's root locus draws its own cloud
  // (locusFrame.js) at today's 1.8px/0.28 dots and stays untouched unless it
  // asks for this. Circuit Lab passes it only on the two lessons whose whole
  // claim IS the scatter ("Real parts wobble", "Blame the right part") —
  // NEEDS.md's own request. At the default size the 120-build cloud reads as
  // two clean crosses at a laptop pane height; this makes the dots big and
  // opaque enough to read as a cloud without hiding the nominal cross under
  // them.
  cloudEmphasis = false,
  xTitle = 'Real  σ  (1/s)',
  yTitle = 'Imaginary  jω  (rad/s)',
  ariaLabel = 'Poles and zeros on the s-plane; the right half is the unstable region',
}) {
  const ref = useCanvas(
    (ctx, w, h) => {
      const area = plotArea(w, h)
      const k = area.k || 1

      let span = 1
      const every = [...poles, ...zeros, ...(highlight || []), ...(cloud || [])]
      for (const b of branches || []) for (const p of b) every.push(p)
      for (const [re, im] of every) {
        span = Math.max(span, Math.abs(re) * 1.4, Math.abs(im) * 1.4)
      }
      // Keep the origin visible and the axes square, so an angle on screen is
      // the angle in the algebra.
      // See ZPlaneCanvas: equal pixels-per-unit both ways, grown to fit
      // whichever dimension the pane is short of.
      const aspect = area.w / area.h
      const yMax = span * Math.max(1, 1 / aspect)
      const xMax = span * Math.max(1, aspect)

      const { sx, sy } = drawFrame(
        ctx,
        area,
        -xMax,
        xMax,
        -yMax,
        yMax,
        (v) => fmtNum(v),
        (v) => fmtNum(v),
        { zeroLine: true, xTitle, yTitle },
      )

      ctx.save()
      ctx.beginPath()
      ctx.rect(area.x, area.y, area.w, area.h)
      ctx.clip()

      // The unstable half.
      ctx.fillStyle = COLORS.marker
      ctx.globalAlpha = 0.07
      const x0 = sx(0)
      ctx.fillRect(x0, area.y, area.x + area.w - x0, area.h)
      ctx.globalAlpha = 1
      ctx.strokeStyle = COLORS.marker
      ctx.globalAlpha = 0.5
      ctx.lineWidth = 1 * k
      ctx.beginPath()
      ctx.moveTo(x0, area.y)
      ctx.lineTo(x0, area.y + area.h)
      ctx.stroke()
      ctx.globalAlpha = 1
      // A region label, not a status: a first-year reads a lone red
      // "unstable" as the verdict on the circuit in front of them. Say what
      // the half means, in the axis colour, and let the verdict live in the
      // chrome that measures it.
      ctx.fillStyle = COLORS.text
      ctx.globalAlpha = 0.8
      ctx.font = `${Math.round(10.5 * k)}px ui-sans-serif, system-ui, sans-serif`
      ctx.textAlign = 'left'
      ctx.textBaseline = 'top'
      const room = area.x + area.w - x0 - 12 * k
      const label = ['right half-plane: a pole here runs away', 'right half-plane: runs away', 'runs away'].find(
        (t) => ctx.measureText(t).width <= room,
      )
      if (label) ctx.fillText(label, x0 + 6 * k, area.y + 6 * k)
      ctx.globalAlpha = 1

      // Where the closed-loop poles travel as a gain is swept. Drawn first, so
      // the open-loop marks stay legible on top of them.
      if (branches) {
        ctx.lineWidth = 1.4 * k
        for (const branch of branches) {
          ctx.beginPath()
          for (let i = 0; i < branch.length; i++) {
            const [re, im] = branch[i]
            const x = sx(re)
            const y = sy(im)
            // Colour by which half of the plane the branch is in, so the moment
            // it crosses is visible without reading the axis.
            if (i === 0) ctx.moveTo(x, y)
            else ctx.lineTo(x, y)
          }
          ctx.strokeStyle = COLORS.traceGhost
          ctx.stroke()
        }
      }

      // Where the marks scatter when the parts are real. Small dim dots,
      // under the nominal marks, so the nominal position stays the anchor and
      // the cloud reads as its uncertainty.
      if (cloud) {
        ctx.fillStyle = COLORS.trace
        // NEEDS.md's own request, on the two lessons where the cloud is the
        // whole lesson: bigger, less transparent dots so 120 builds' worth of
        // scatter reads as a cloud rather than vanishing under a 1.8px/0.28
        // wash. Every other caller (Control Lab's root locus) keeps the old
        // numbers untouched.
        const dotR = (cloudEmphasis ? 2.5 : 1.8) * k
        ctx.globalAlpha = cloudEmphasis ? 0.45 : 0.28
        for (const [re, im] of cloud) {
          ctx.beginPath()
          ctx.arc(sx(re), sy(im), dotR, 0, Math.PI * 2)
          ctx.fill()
        }
        ctx.globalAlpha = 1
      }

      const r = 7 * k
      ctx.lineWidth = 2 * k

      // Poles: crosses. Zeros: circles. The convention is universal, so it is
      // worth matching exactly.
      ctx.strokeStyle = COLORS.trace
      for (const [re, im] of poles) {
        const x = sx(re)
        const y = sy(im)
        ctx.beginPath()
        ctx.moveTo(x - r, y - r)
        ctx.lineTo(x + r, y + r)
        ctx.moveTo(x + r, y - r)
        ctx.lineTo(x - r, y + r)
        ctx.stroke()
      }
      ctx.strokeStyle = COLORS.response
      for (const [re, im] of zeros) {
        ctx.beginPath()
        ctx.arc(sx(re), sy(im), r, 0, Math.PI * 2)
        ctx.stroke()
      }
      // The closed-loop poles at the gain currently selected.
      if (highlight) {
        ctx.strokeStyle = COLORS.marker
        ctx.lineWidth = 2.4 * k
        for (const [re, im] of highlight) {
          const x = sx(re)
          const y = sy(im)
          ctx.beginPath()
          ctx.moveTo(x - r, y - r)
          ctx.lineTo(x + r, y + r)
          ctx.moveTo(x + r, y - r)
          ctx.lineTo(x - r, y + r)
          ctx.stroke()
        }
      }
      ctx.restore()
    },
    [poles, zeros, branches, highlight, cloud, cloudEmphasis, xTitle, yTitle],
  )

  return <canvas ref={ref} className="plot" role="img" aria-label={ariaLabel} />
}
