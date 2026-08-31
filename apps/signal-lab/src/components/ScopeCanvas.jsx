import React from 'react'
import { useCanvas } from '@ee-labs/ui'
import { COLORS, drawFrame, plotArea } from '@ee-labs/ui'
import { fmtHz } from '@ee-labs/ui'
import { sincInterp } from '@ee-labs/dsp'

/**
 * Time-domain view.
 *
 * The horizontal axis counts the signal's OWN cycles rather than absolute
 * milliseconds. That is what keeps the view stable while you explore: move a
 * source from 250 Hz to 2 kHz and a span measured in milliseconds turns the
 * trace into a solid block, so you have to go and fix a second control that has
 * nothing to do with what you were investigating. Measured in cycles, "show me
 * four periods" stays four periods at every frequency.
 *
 * Falls back to milliseconds when there is no periodic source to count — noise
 * on its own has no cycles to measure against.
 *
 * Draws a list of traces rather than one buffer, so the signal before the chain
 * can be laid underneath the signal after it. Seeing both at once is what makes
 * "what did this block actually do to the shape" a question you can answer by
 * looking.
 *
 * When samples outnumber pixels the trace becomes a min/max envelope rather
 * than a decimation: decimation makes an aliased or ringing signal look clean,
 * which is exactly the lie this tool exists to expose.
 */
export default function ScopeCanvas({
  traces,
  sampleRate,
  spanSeconds,
  divisionRate = null,
  yMax,
}) {
  const ref = useCanvas(
    (ctx, w, h) => {
      const area = plotArea(w, h)
      const k = area.k || 1

      // One x unit is either one cycle of the fundamental or one millisecond.
      const perSecond = divisionRate || 1000
      const xMax = Math.max(1e-9, spanSeconds * perSecond)

      const { sx, sy } = drawFrame(
        ctx,
        area,
        0,
        xMax,
        -yMax,
        yMax,
        (v) => (xMax >= 10 ? v.toFixed(0) : v.toFixed(1)),
        (v) => v.toFixed(Math.abs(yMax) >= 10 ? 0 : 2),
        {
          zeroLine: true,
          xTitle: divisionRate
            ? `Time (cycles of ${fmtHz(divisionRate)}Hz)`
            : 'Time (milliseconds)',
          yTitle: 'Amplitude',
        },
      )

      const n = Math.min(traces[0]?.buf.length || 0, Math.ceil(spanSeconds * sampleRate))
      if (n < 2) return

      ctx.save()
      ctx.beginPath()
      ctx.rect(area.x, area.y, area.w, area.h)
      ctx.clip()

      const xOf = (i) => sx((i / sampleRate) * perSecond)
      // Samples per pixel OF THE AXIS — one mapping for every branch below.
      // Deriving it from the buffer length instead (n / area.w) quietly
      // disagrees with xOf whenever the buffer is shorter than the requested
      // span, which is the same disease the sparse branch's comment records.
      const samplesPerPx = ((xMax / area.w) / perSecond) * sampleRate
      let reconstructed = false

      // Back to front, so the processed signal is never hidden by its ghost.
      for (const tr of traces) {
        const buf = tr.buf
        if (!buf || buf.length < 2) continue

        ctx.strokeStyle = tr.color || COLORS.trace
        ctx.lineWidth = (tr.dim ? 1 : 1.6) * k
        ctx.lineJoin = 'round'
        ctx.beginPath()

        if (samplesPerPx > 2) {
          for (let px = 0; px < area.w; px++) {
            const i0 = Math.floor(px * samplesPerPx)
            if (i0 >= n) break
            const i1 = Math.min(n, Math.floor((px + 1) * samplesPerPx))
            let lo = Infinity
            let hi = -Infinity
            for (let i = i0; i < i1; i++) {
              if (buf[i] < lo) lo = buf[i]
              if (buf[i] > hi) hi = buf[i]
            }
            if (lo === Infinity) continue
            const x = area.x + px + 0.5
            // A flat stretch has hi ≈ lo, and a zero-length butt-capped stroke
            // paints NOTHING — a filtered square arriving from Circuit Lab lost
            // its flat tops entirely and read as a clipped signal. Pad each
            // column to at least one pixel about its own centre, so a flat
            // region draws as the same-weight line the non-envelope branch
            // would have drawn.
            let y0 = sy(hi)
            let y1 = sy(lo)
            if (y1 - y0 < 1) {
              const mid = (y0 + y1) / 2
              y0 = mid - 0.5
              y1 = mid + 0.5
            }
            ctx.moveTo(x, y0)
            ctx.lineTo(x, y1)
          }
          ctx.stroke()
          continue
        }

        // Individual samples become meaningful once they are sparse enough —
        // and seeing them is the point when the question is about sampling.
        // At that zoom, a straight line between dots is a LIE: at two samples
        // per cycle it renders a sine as a triangle. So the sparse view draws
        // what the samples actually describe — the ideal (sin x)/x
        // reconstruction, the same mathematics a bench DSO's sin(x)/x mode
        // uses between its own samples — with the dots as THE data on top.
        // The ghost gets the same treatment: a linearly-joined ghost beside a
        // reconstructed main trace would show two different interpolations of
        // the same kind of data under one caption.
        const sparse = samplesPerPx < 0.06

        if (sparse) {
          reconstructed = true
          // Pixel -> time through the AXIS mapping, the same sx the dots use.
          const tPerPx = samplesPerPx
          ctx.beginPath()
          let started = false
          for (let px = 0; px <= area.w; px++) {
            const t = px * tPerPx
            if (t > buf.length - 1) break
            const y = sy(sincInterp(buf, t, 64))
            if (!started) ctx.moveTo(area.x + px, y)
            else ctx.lineTo(area.x + px, y)
            started = true
          }
          ctx.stroke()
        } else {
          for (let i = 0; i < n; i++) {
            const x = xOf(i)
            const y = sy(buf[i])
            if (i === 0) ctx.moveTo(x, y)
            else ctx.lineTo(x, y)
          }
          ctx.stroke()
        }

        if (sparse && !tr.dim) {
          const dots = samplesPerPx < 0.02
          ctx.beginPath()
          ctx.fillStyle = dots ? COLORS.textBright : tr.color || COLORS.trace
          const r = (dots ? 3.5 : 2) * k
          for (let i = 0; i < n; i++) {
            const x = xOf(i)
            const y = sy(buf[i])
            // Start on the rim, or arc() draws a spoke in from the centre.
            ctx.moveTo(x + r, y)
            ctx.arc(x, y, r, 0, Math.PI * 2)
          }
          ctx.fill()
        }
      }

      // Name what is being drawn, where it is drawn — the whole point is
      // that the display is sampled and honest about it.
      if (reconstructed) {
        ctx.fillStyle = COLORS.text
        ctx.font = `${Math.round(10 * k)}px ui-sans-serif, system-ui, sans-serif`
        ctx.textAlign = 'left'
        ctx.textBaseline = 'top'
        ctx.fillText(
          'dots are the samples; the curve is their ideal (sin x)/x reconstruction — how a digital oscilloscope draws',
          area.x + 6 * k,
          area.y + 5 * k,
        )
      }

      ctx.restore()
    },
    [traces, sampleRate, spanSeconds, divisionRate, yMax],
  )

  return <canvas ref={ref} className="plot" role="img" aria-label="Oscilloscope: the signal against time" />
}
