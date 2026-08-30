import React from 'react'
import { useCanvas } from './useCanvas.js'
import { COLORS, drawFrame, plotArea } from './plot.js'
import { fmt } from './units.js'

/**
 * Poles and zeros on the z-plane.
 *
 * The s-plane's sibling, and different in the one way that matters: for sampled
 * systems the frequency axis is not a line, it is the UNIT CIRCLE. Walking
 * anticlockwise from z = 1 to z = -1 sweeps DC to Nyquist, and that is the whole
 * of the spectrum — which is also why there is nothing beyond Nyquist to see,
 * and why going further just comes back around. Aliasing, as a picture.
 *
 * Reading it: the magnitude response at a frequency is the product of the
 * distances from that point on the circle to every zero, divided by the product
 * of the distances to every pole. So a pole near the circle makes a peak, a zero
 * near it makes a dip, and a zero exactly ON it makes an exact null. A resonant
 * biquad's Q is visible here as how close its poles crowd the rim.
 *
 * Stability inverts from the s-plane: inside is stable, outside is not, so the
 * OUTSIDE is what gets shaded.
 */
export default function ZPlaneCanvas({
  poles = [],
  zeros = [],
  markerFreq = null,
  sampleRate = 0,
  xTitle = 'Real',
  yTitle = 'Imaginary',
}) {
  const ref = useCanvas(
    (ctx, w, h) => {
      const area = plotArea(w, h)
      const k = area.k || 1

      // The circle is the subject, so it always has room — but a pole outside it
      // (an unstable one) must not be silently cropped out of the picture.
      let span = 1.35
      for (const [re, im] of [...poles, ...zeros]) {
        span = Math.max(span, Math.abs(re) * 1.15, Math.abs(im) * 1.15)
      }
      const aspect = area.w / area.h
      const yMax = span
      const xMax = span * aspect

      const { sx, sy } = drawFrame(
        ctx,
        area,
        -xMax,
        xMax,
        -yMax,
        yMax,
        (v) => fmt(v, '', 2),
        (v) => fmt(v, '', 2),
        { zeroLine: true, xTitle, yTitle },
      )

      ctx.save()
      ctx.beginPath()
      ctx.rect(area.x, area.y, area.w, area.h)
      ctx.clip()

      const cx = sx(0)
      const cy = sy(0)
      const rx = sx(1) - sx(0) // pixels per unit, x
      const ry = sy(0) - sy(1) // pixels per unit, y

      // Everything outside the circle is unstable. Painted as the whole plot
      // area minus a circular hole, so the shading reads as a region rather
      // than as a ring.
      ctx.save()
      ctx.beginPath()
      ctx.rect(area.x, area.y, area.w, area.h)
      ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2, true)
      ctx.fillStyle = COLORS.marker
      ctx.globalAlpha = 0.07
      ctx.fill()
      ctx.restore()

      // The unit circle itself: the frequency axis.
      ctx.strokeStyle = COLORS.axis
      ctx.lineWidth = 1.5 * k
      ctx.beginPath()
      ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2)
      ctx.stroke()

      // Where the frequencies actually are. Without these two labels the circle
      // is just a circle; with them it is an axis someone can read a filter off.
      ctx.font = `${Math.round(10 * k)}px ui-sans-serif, system-ui, sans-serif`
      ctx.fillStyle = COLORS.text
      ctx.textBaseline = 'middle'
      const tick = (re, im, label, align) => {
        const x = sx(re)
        const y = sy(im)
        ctx.beginPath()
        ctx.arc(x, y, 2.5 * k, 0, Math.PI * 2)
        ctx.fillStyle = COLORS.axis
        ctx.fill()
        ctx.fillStyle = COLORS.text
        ctx.textAlign = align
        ctx.fillText(label, x + (align === 'left' ? 7 * k : -7 * k), y)
      }
      tick(1, 0, 'DC', 'left')
      tick(-1, 0, 'Nyquist', 'right')
      if (sampleRate > 0) {
        ctx.textAlign = 'center'
        ctx.textBaseline = 'bottom'
        ctx.fillText(`${fmt(sampleRate / 4, 'Hz', 3)}`, sx(0), sy(1) - 5 * k)
      }

      // A cursor on the circle at one frequency, so the link between this view
      // and the spectrum is a thing you can watch move rather than infer.
      if (markerFreq != null && sampleRate > 0) {
        const wRad = (2 * Math.PI * markerFreq) / sampleRate
        const mx = sx(Math.cos(wRad))
        const my = sy(Math.sin(wRad))
        ctx.strokeStyle = COLORS.spectrum
        ctx.lineWidth = 1 * k
        ctx.globalAlpha = 0.5
        ctx.beginPath()
        ctx.moveTo(cx, cy)
        ctx.lineTo(mx, my)
        ctx.stroke()
        ctx.globalAlpha = 1
        ctx.fillStyle = COLORS.spectrum
        ctx.beginPath()
        ctx.arc(mx, my, 4 * k, 0, Math.PI * 2)
        ctx.fill()
      }

      const r = 7 * k
      ctx.lineWidth = 2 * k

      // Same convention as the s-plane view: poles are crosses, zeros circles.
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

      ctx.restore()
    },
    [poles, zeros, markerFreq, sampleRate, xTitle, yTitle],
  )

  return <canvas ref={ref} className="plot" />
}
