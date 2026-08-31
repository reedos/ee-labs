import React from 'react'
import { useCanvas } from '@ee-labs/ui'
import { COLORS, drawFrame, plotArea } from '@ee-labs/ui'
import { fmtHz } from '@ee-labs/ui'
import { sincInterp } from '@ee-labs/dsp'

export const CAPTION_RECONSTRUCTION =
  'dots are the samples; the curve is their ideal (sin x)/x reconstruction — how a digital oscilloscope draws'

export const CAPTION_ALIASED =
  'the ripple riding on this shape is aliasing — content folded back from above Nyquist; raise the rate to clear it'

export const CAPTION_AT_NYQUIST =
  'this sits exactly at Nyquist — two samples a cycle: they pin the frequency but not the height, so drag the phase and watch the same tone read anything from full scale to nothing'

/**
 * Which captions the scope owes the reader, given what it drew and what the
 * signal is doing.
 *
 * Two different kinds of claim share one box, and they are decided separately
 * because they are true under different conditions.
 *
 * The reconstruction line describes what is ON SCREEN — dots, and a curve
 * drawn through them — so it is only offered when the screen actually shows
 * that. The other two describe the SIGNAL and the RATE, and neither of those
 * cares how far the reader has zoomed out.
 *
 * Hanging all three off the dots gate was a real defect, and it silenced
 * precisely the case the alias line was written for: "High-pass a square"
 * carries the heaviest fold in the library, and once its rate went up to
 * 16 kHz it drew no warning at all — not because the aliasing had stopped but
 * because the samples got too dense to draw one at a time.
 *
 * A pure function so the decision can be checked without a canvas, which is
 * where the regression above would have been caught.
 */
export function captionLines({ reconstructed, sampling }) {
  const out = []
  if (reconstructed) out.push(CAPTION_RECONSTRUCTION)
  if (sampling?.aliased) out.push(CAPTION_ALIASED)
  // A different failure from a fold, and it earns different words. Nothing has
  // come down from anywhere: the tone sits ON Nyquist, two samples to a cycle,
  // and those two fix its frequency while leaving its height to whatever phase
  // they landed on. Telling the reader to "raise the rate to clear" a fold
  // would describe the wrong problem.
  if (sampling?.atNyquist) out.push(CAPTION_AT_NYQUIST)
  return out
}

/**
 * Greedy word wrap of each caption to `maxWidth`, using the context's current
 * font.
 *
 * The caption now sits in a band whose height is reserved before the plot is
 * sized, so the wrap has to happen BEFORE drawing rather than being left to
 * overflow: an unwrapped line ran off the side of a narrow pane, and a band
 * measured in unwrapped lines would reserve the wrong height.
 *
 * A single word longer than the pane is emitted on its own line and allowed to
 * overflow. Breaking mid-word would be worse, and no caption here contains one.
 */
export function wrapLines(ctx, lines, maxWidth) {
  const out = []
  for (const line of lines) {
    let cur = ''
    for (const word of line.split(' ')) {
      const next = cur ? `${cur} ${word}` : word
      if (cur && ctx.measureText(next).width > maxWidth) {
        out.push(cur)
        cur = word
      } else {
        cur = next
      }
    }
    if (cur) out.push(cur)
  }
  return out
}

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
      // Laid out in two passes. The first sizes the plot without a caption,
      // which is all that is needed to know how the trace will be DRAWN — the
      // caption only ever takes height, and every decision below turns on
      // area.w, which it does not touch. The second gives the caption its own
      // band above the frame and hands the rest to the plot.
      const probe = plotArea(w, h)
      const k = probe.k || 1

      // One x unit is either one cycle of the fundamental or one millisecond.
      const perSecond = divisionRate || 1000
      const xMax = Math.max(1e-9, spanSeconds * perSecond)

      const n = Math.min(
        (traces[0]?.buf.length || 0) - 2 * guard,
        Math.ceil(spanSeconds * sampleRate),
      )
      if (n < 2) return

      const samplesPerPx = ((xMax / probe.w) / perSecond) * sampleRate
      const sparse = samplesPerPx < 0.5
      const marked = samplesPerPx < 1 / 9
      const drawable = traces.some((tr) => tr.buf && tr.buf.length >= 2)

      // Wrapped to the plot's own width, so a narrow pane folds the caption
      // instead of running it off the canvas — and so the band reserved for it
      // is the height it will really occupy.
      ctx.font = `${Math.round(10 * k)}px ui-sans-serif, system-ui, sans-serif`
      const lh = 14 * k
      const wrapped = wrapLines(
        ctx,
        captionLines({ reconstructed: sparse && marked && drawable, sampling }),
        probe.w,
      )
      const band = wrapped.length ? wrapped.length * lh + 6 * k : 0

      const area = plotArea(w, h, { topInset: band })

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

      ctx.restore()

      // The caption, in the band reserved for it above the frame.
      //
      // It used to be placed INSIDE the plot, moved to whichever half of the
      // trace had more clearance and backed with a dark plate for the case
      // where a busy signal crossed both. That was the wrong problem to solve:
      // a plate over the trace is still covering signal, and on a square or a
      // step there is no clear half to move to. Sitting above the frame it
      // covers nothing, needs no plate, and stops moving around as the reader
      // turns a knob.
      if (wrapped.length) {
        ctx.font = `${Math.round(10 * k)}px ui-sans-serif, system-ui, sans-serif`
        ctx.textAlign = 'left'
        ctx.textBaseline = 'top'
        ctx.fillStyle = COLORS.text
        const top = area.y - band + 2 * k
        wrapped.forEach((t, i) => ctx.fillText(t, area.x, top + i * lh))
      }
    },
    [traces, sampleRate, spanSeconds, divisionRate, yMax],
  )

  return <canvas ref={ref} className="plot" role="img" aria-label="Oscilloscope: the signal against time" />
}
