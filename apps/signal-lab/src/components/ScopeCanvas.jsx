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
  // How this rate is coping with this signal, measured in App: `aliased` when
  // real content sits above Nyquist and has folded down into the samples, and
  // `atNyquist` when it sits exactly on the boundary instead. The two get
  // different captions because they are different problems — one is fixed by
  // a higher rate, the other is not a fold at all.
  sampling = { aliased: false, atNyquist: false },
  // Samples rendered BEFORE the visible span (and after it), so the
  // reconstruction has neighbours on both sides at the edges of the picture.
  // Without them sincInterp's window goes one-sided exactly where the trace
  // meets the frame and draws a spurious overshoot — at Nyquist the interior
  // curve peaks at 1.02 and the edge threw 1.26, a quarter of full scale of
  // pure artifact, right where a reader looks first.
  guard = 0,
}) {
  const ref = useCanvas(
    (ctx, w, h) => {
      const area = plotArea(w, h)
      const k = area.k || 1

      // One x unit is either one cycle of the fundamental or one millisecond.
      const perSecond = divisionRate || 1000
      const xMax = Math.max(1e-9, spanSeconds * perSecond)

      const n = Math.min(
        (traces[0]?.buf.length || 0) - 2 * guard,
        Math.ceil(spanSeconds * sampleRate),
      )
      if (n < 2) return

      const samplesPerPx = ((xMax / area.w) / perSecond) * sampleRate
      const sparse = samplesPerPx < 0.5
      const marked = samplesPerPx < 1 / 9

      // The frame has to hold what is DRAWN, not just the samples. A square's
      // reconstruction overshoots its own samples by 28% — real Gibbs, not an
      // artifact — and an axis built from the sample peak alone clipped it
      // flat against the top of the plot. Measured here once, at the same
      // pixel positions the curve will be drawn at, so nothing can exceed it.
      let yLimit = yMax
      if (sparse) {
        let curve = 0
        for (const tr of traces) {
          const buf = tr.buf
          if (!buf || buf.length < 2) continue
          for (let px = 0; px <= area.w; px++) {
            const t = px * samplesPerPx
            if (t > n - 1) break
            const v = Math.abs(sincInterp(buf, guard + t, 64))
            if (v > curve) curve = v
          }
        }
        yLimit = Math.max(yMax, Math.ceil(curve * 1.05 * 10) / 10 || yMax)
      }

      const { sx, sy } = drawFrame(
        ctx,
        area,
        0,
        xMax,
        -yLimit,
        yLimit,
        (v) => (xMax >= 10 ? v.toFixed(0) : v.toFixed(1)),
        (v) => v.toFixed(Math.abs(yLimit) >= 10 ? 0 : 2),
        {
          zeroLine: true,
          xTitle: divisionRate
            ? `Time (cycles of ${fmtHz(divisionRate)}Hz)`
            : 'Time (milliseconds)',
          yTitle: 'Amplitude',
        },
      )

      ctx.save()
      ctx.beginPath()
      ctx.rect(area.x, area.y, area.w, area.h)
      ctx.clip()

      // Sample i of the VISIBLE span; the buffer holds `guard` more before it.
      const xOf = (i) => sx((i / sampleRate) * perSecond)
      const at = (buf, i) => buf[guard + i]
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
              const v = at(buf, i)
              if (v < lo) lo = v
              if (v > hi) hi = v
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

        // A straight line between samples is a LIE wherever the samples are
        // far enough apart to see: at two samples per cycle it renders a sine
        // as a triangle. So the scope draws what the samples actually
        // describe — the ideal (sin x)/x reconstruction, the same mathematics
        // a bench DSO's sin(x)/x mode uses between its own samples.
        //
        // Two separate questions, decoupled — they were one threshold once,
        // and conflating them is what let straight lines through:
        //
        //   is the reconstruction WORTH DRAWING?  whenever samples are more
        //     than about two pixels apart, since below that nothing fits
        //     between them anyway.
        //   are the samples worth MARKING?  only once they are far enough
        //     apart to read as individual dots.
        //
        // The curve is now honest at every density it can be. Measured across
        // the presets, the old single cutoff (seventeen pixels per sample)
        // permitted straight lines that departed from the true curve by 5 to
        // 100 pixels on twenty of thirty-three setups — squares, noise and
        // combs, exactly the broadband signals this tool ships naive on
        // purpose. And raising the sample rate does not rescue a line: a
        // square's edge is a discontinuity no rate resolves, so the gap
        // measures 20% of peak at 8 kHz and is still 15% at 48 kHz. Only
        // drawing what the samples describe fixes it.
        //
        // The ghost gets the same treatment: a linearly-joined ghost beside a
        // reconstructed main trace would show two different interpolations of
        // the same kind of data under one caption.
        if (sparse) {
          if (marked) reconstructed = true
          // Pixel -> time through the AXIS mapping, the same sx the dots use.
          const tPerPx = samplesPerPx
          ctx.beginPath()
          let started = false
          for (let px = 0; px <= area.w; px++) {
            const t = px * tPerPx
            if (t > n - 1) break
            const y = sy(sincInterp(buf, guard + t, 64))
            if (!started) ctx.moveTo(area.x + px, y)
            else ctx.lineTo(area.x + px, y)
            started = true
          }
          ctx.stroke()
        } else {
          for (let i = 0; i < n; i++) {
            const x = xOf(i)
            const y = sy(at(buf, i))
            if (i === 0) ctx.moveTo(x, y)
            else ctx.lineTo(x, y)
          }
          ctx.stroke()
        }

        if (marked && !tr.dim) {
          const dots = samplesPerPx < 0.02
          ctx.beginPath()
          ctx.fillStyle = dots ? COLORS.textBright : tr.color || COLORS.trace
          // Radius yields to the spacing: at six pixels per sample a 2.6-pixel
          // dot would close the gaps into a solid band, which reads as a
          // thick line rather than as data.
          const pxPerSample = 1 / Math.max(samplesPerPx, 1e-9)
          const r = Math.max(1, Math.min((dots ? 3.5 : 2) * k, pxPerSample / 4))
          for (let i = 0; i < n; i++) {
            const x = xOf(i)
            const y = sy(at(buf, i))
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
        const lines = [
          'dots are the samples; the curve is their ideal (sin x)/x reconstruction — how a digital oscilloscope draws',
        ]
        // ...and, where it is true, what to do about a rough-looking shape.
        // The ripple riding on a high-passed square at 8 kHz is not drawing
        // error: it is content from above Nyquist folded back into the samples
        // themselves, and it falls as the rate rises (measured: 22% of the sag
        // at 8 kHz, 10% at 16, 3% at 32).
        if (sampling.aliased) {
          lines.push(
            'the ripple riding on this shape is aliasing — content folded back from above Nyquist; raise the rate to clear it',
          )
        }
        // A different failure, and it earns different words. Nothing has
        // folded here: the tone sits ON Nyquist, two samples to a cycle, and
        // those two samples fix its frequency while leaving its height to
        // whatever phase they happened to land on. Telling the reader to
        // "raise the rate to clear" a fold would be describing the wrong
        // problem, so this line names the real one and the knob that shows it.
        if (sampling.atNyquist) {
          lines.push(
            'this sits exactly at Nyquist — two samples a cycle: they pin the frequency but not the height, so drag the phase and watch the same tone read anything from full scale to nothing',
          )
        }
        ctx.font = `${Math.round(10 * k)}px ui-sans-serif, system-ui, sans-serif`
        ctx.textAlign = 'left'
        ctx.textBaseline = 'top'
        const lh = 14 * k
        const wText = Math.max(...lines.map((t) => ctx.measureText(t).width))
        const boxH = lines.length * lh + 4 * k
        const x0 = area.x + 6 * k

        // Put the caption where the trace is NOT. It sat at the top left
        // whatever was drawn there, and on a signal that spends its time high
        // — a step, a rectified wave, a resonance ringing up — the words lay
        // across the very trace they describe. So the span the text will
        // cover is measured first, and the caption goes to whichever side has
        // more clearance; the backing plate then covers the remaining case,
        // where a busy trace crosses both.
        let hi = -Infinity
        let lo = Infinity
        const iFrom = Math.max(0, Math.floor(((x0 - area.x) / area.w) * (n - 1)))
        const iTo = Math.min(n - 1, Math.ceil(((x0 + wText - area.x) / area.w) * (n - 1)))
        for (const tr of traces) {
          if (!tr.buf || tr.buf.length < 2) continue
          for (let i = iFrom; i <= iTo; i++) {
            const v = at(tr.buf, i)
            if (v > hi) hi = v
            if (v < lo) lo = v
          }
        }
        const roomAbove = Number.isFinite(hi) ? yLimit - hi : yLimit
        const roomBelow = Number.isFinite(lo) ? lo + yLimit : yLimit
        const yTop =
          roomAbove >= roomBelow ? area.y + 5 * k : area.y + area.h - boxH - 4 * k

        ctx.fillStyle = 'rgba(11, 15, 20, 0.82)'
        ctx.fillRect(x0 - 4 * k, yTop - 3 * k, wText + 8 * k, boxH)
        ctx.fillStyle = COLORS.text
        lines.forEach((t, i) => ctx.fillText(t, x0, yTop + i * lh))
      }

      ctx.restore()
    },
    [traces, sampleRate, spanSeconds, divisionRate, yMax],
  )

  return <canvas ref={ref} className="plot" role="img" aria-label="Oscilloscope: the signal against time" />
}
