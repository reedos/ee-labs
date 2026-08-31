import React, { useEffect, useRef, useState } from 'react'
import { COLORS, plotArea, plotScale, useCanvas } from '@ee-labs/ui'

/**
 * Convolution, watched happening.
 *
 * The kernel view shows what the chain convolves with; this shows the
 * convolving. One output sample at a time:
 *
 *   y[n] = Σ_k h[k] · x[n−k]
 *
 * The top strip is the input with the kernel drawn FLIPPED and slid to the
 * current position — h[n−m] against m — because that flip is the single detail
 * everyone trips on, and no amount of prose fixes it the way seeing the kernel
 * ride backwards does. The shaded bars are the products being summed; the
 * bottom strip is the output built up so far, ending at the sample those bars
 * just produced.
 *
 * The first N samples are the honest transient: the kernel still hangs off the
 * left edge of the signal, so the sum runs over a partial overlap. That IS what
 * filter warm-up is, shown rather than named.
 */
export default function ConvolutionCanvas({ x, h, y, pos, exact }) {
  const n = Math.max(0, Math.min(x.length - 1, pos))

  const ref = useCanvas(
    (ctx, w, hpx) => {
      const k = plotScale(w)
      const outer = plotArea(w, hpx)
      const gap = 26 * k
      const half = (outer.h - gap) / 2
      const top = { ...outer, h: half }
      const bot = { ...outer, y: outer.y + half + gap, h: half }

      let hPeak = 1e-9
      for (let i = 0; i < h.length; i++) hPeak = Math.max(hPeak, Math.abs(h[i]))
      // The kernel's SUPPORT — its last sample that is actually nonzero —
      // rather than its buffer length, which convKernel pads to 64+. The
      // stems-versus-envelope choice below keys on this: an 8-tap moving
      // average in a 64-long buffer is 8 taps, not 64.
      let hSupport = 0
      for (let i = h.length - 1; i >= 0; i--) {
        if (Math.abs(h[i]) > hPeak * 1e-9) {
          hSupport = i + 1
          break
        }
      }
      // ONE amplitude scale for both strips — the max over input AND output —
      // exactly as the scope superimposes them. The first cut normalized each
      // strip to its own peak, so a high-pass square's 2x edge spikes drew the
      // same height as the square itself (Reed's report): each strip honest
      // alone, the comparison between them a quiet lie.
      let peak = 1e-9
      for (let i = 0; i < x.length; i++) peak = Math.max(peak, Math.abs(x[i]))
      for (let i = 0; i < y.length; i++) peak = Math.max(peak, Math.abs(y[i]))

      const sx = (m) => outer.x + (m / (x.length - 1)) * outer.w
      const mid = (area) => area.y + area.h / 2
      const syTop = (v) => mid(top) - (v / (peak * 1.1)) * (top.h / 2)
      const syBot = (v) => mid(bot) - (v / (peak * 1.1)) * (bot.h / 2)

      const label = (area, text) => {
        ctx.fillStyle = COLORS.text
        ctx.font = `${Math.round(10 * k)}px ui-sans-serif, system-ui, sans-serif`
        ctx.textAlign = 'left'
        ctx.textBaseline = 'bottom'
        ctx.fillText(text, area.x + 2 * k, area.y - 4 * k)
      }
      const zero = (area, sy) => {
        ctx.strokeStyle = COLORS.grid
        ctx.lineWidth = 1 * k
        ctx.beginPath()
        ctx.moveTo(area.x, sy(0))
        ctx.lineTo(area.x + area.w, sy(0))
        ctx.stroke()
      }

      // Labels above the plot frame go down first — the clip that keeps data
      // marks inside the frame would swallow them.
      label(top, 'input x[m], with the kernel flipped and slid to n')

      // Name the magnification, or the kernel's height is a quiet lie.
      const mag = (peak * 1.1) / (hPeak * 1.15)
      if (mag > 1.25 || mag < 0.8) {
        ctx.fillStyle = COLORS.response
        ctx.font = `${Math.round(10 * k)}px ui-sans-serif, system-ui, sans-serif`
        ctx.textAlign = 'right'
        ctx.textBaseline = 'bottom'
        const shown = mag >= 10 ? Math.round(mag) : Number(mag.toPrecision(2))
        ctx.fillText(`kernel drawn ×${shown}`, outer.x + outer.w - 4 * k, top.y - 4 * k)
      }

      // Everything that marks data stays inside the frame — the output dot at
      // n = 0 used to bleed past the left edge, the one canvas with no clip.
      ctx.save()
      ctx.beginPath()
      ctx.rect(outer.x - 0.5, outer.y - 0.5, outer.w + 1, outer.h + 1)
      ctx.clip()

      // ---- top strip: input, flipped kernel, products
      zero(top, syTop)

      // Product bars: h[n−m]·x[m] on the input's own scale, since their SUM is
      // the next output sample. Drawn WIDE — most of a sample pitch — because
      // in the first cut they were 2px bars at the exact positions of the
      // kernel stems, same sign, and therefore invisible behind them. The one
      // thing this view exists to show was the one thing you could not see.
      const pitch = outer.w / Math.max(1, x.length - 1)
      const barW = Math.max(2 * k, pitch * 0.62)
      ctx.fillStyle = COLORS.spectrum
      ctx.globalAlpha = 0.55
      for (let m = Math.max(0, n - h.length + 1); m <= n; m++) {
        const prod = h[n - m] * x[m]
        if (prod === 0) continue
        const px = sx(m)
        ctx.fillRect(
          px - barW / 2,
          Math.min(syTop(0), syTop(prod)),
          barW,
          Math.abs(syTop(prod) - syTop(0)),
        )
      }
      ctx.globalAlpha = 1

      // The input.
      ctx.strokeStyle = COLORS.trace
      ctx.lineWidth = 1.4 * k
      ctx.beginPath()
      for (let m = 0; m < x.length; m++) {
        const px = sx(m)
        const py = syTop(x[m])
        if (m === 0) ctx.moveTo(px, py)
        else ctx.lineTo(px, py)
      }
      ctx.stroke()

      // Dots ON the samples, wherever they are far enough apart to see.
      //
      // Everything in this view is a sample: one product bar per sample, one
      // kernel tap per sample, one output value per sample. Drawing the
      // traces as bare polylines let the eye read a continuous curve being
      // filtered, which is the one thing convolution is NOT — so the data
      // says it is data, the same way the scope's sample dots do. The line
      // between them is drawn to make the shape legible and is not a claim
      // about what happens between samples; the scope answers that, with the
      // (sin x)/x curve these same numbers describe.
      const dots = (buf, sy, colour, upTo = buf.length - 1) => {
        if (pitch < 6 * k) return
        ctx.fillStyle = colour
        ctx.beginPath()
        const r = 2.1 * k
        for (let m = 0; m <= upTo; m++) {
          const px = sx(m)
          const py = sy(buf[m])
          ctx.moveTo(px + r, py)
          ctx.arc(px, py, r, 0, Math.PI * 2)
        }
        ctx.fill()
      }
      dots(x, syTop, COLORS.trace)

      // The kernel, flipped: h[n−m] plotted against m, on its own scale so a
      // 1/N-tall moving average is still visible — and SAYING SO. The first
      // cut drew 0.125-tall taps as tall as a ±0.8 input with no scale cue,
      // which reads as a wrong plot even though the arithmetic was right.
      const mStart = Math.max(0, n - h.length + 1)
      const hy = (hv) => mid(top) - (hv / (hPeak * 1.15)) * (top.h / 2)
      ctx.strokeStyle = COLORS.response
      // Keyed on the kernel's SUPPORT, not the drawn window: the padded buffer
      // made an 8-tap moving average flip to the IIR-envelope branch the
      // moment the cursor passed 48 — a joined line riding the baseline
      // through dozens of exact zeros, mid-animation.
      if (Math.min(n - mStart + 1, hSupport) <= 48) {
        // Few taps: stems, thin, so the wide product bars stay visible.
        ctx.lineWidth = 1.1 * k
        for (let m = mStart; m <= n; m++) {
          const hv = h[n - m]
          if (hv === 0) continue
          const px = sx(m)
          ctx.beginPath()
          ctx.moveTo(px, syTop(0))
          ctx.lineTo(px, hy(hv))
          ctx.stroke()
        }
      } else {
        // A long (IIR) kernel as stems is spray over the signal; a thin
        // continuous curve reads as the envelope it is. Only the support is
        // drawn — the padding beyond it is zeros, not envelope.
        ctx.lineWidth = 1.2 * k
        ctx.beginPath()
        const mEnvStart = Math.max(mStart, n - hSupport + 1)
        for (let m = mEnvStart; m <= n; m++) {
          const px = sx(m)
          const py = hy(h[n - m])
          if (m === mEnvStart) ctx.moveTo(px, py)
          else ctx.lineTo(px, py)
        }
        ctx.stroke()
      }

      // ---- bottom strip: the output so far. This is where the action gets
      // its name: the flip-slide-multiply-sum above IS convolution, and the
      // view should say so where it happens, not leave the pane title to
      // carry it. The nonlinear label keeps its refusal instead — printing
      // y = x ∗ h over an output the sum does not produce would be a lie.
      label(bot, exact ? 'output y = x ∗ h so far — this flip, slide, multiply and sum is convolution' : 'chain output — NOT this sum: the chain is nonlinear')
      zero(bot, syBot)

      ctx.strokeStyle = exact ? COLORS.spectrum : COLORS.marker
      ctx.lineWidth = 1.4 * k
      ctx.beginPath()
      for (let m = 0; m <= n; m++) {
        const px = sx(m)
        const py = syBot(y[m])
        if (m === 0) ctx.moveTo(px, py)
        else ctx.lineTo(px, py)
      }
      ctx.stroke()
      // Each output dot is one completed sum — the bars above, added up.
      dots(y, syBot, exact ? COLORS.spectrum : COLORS.marker, n)

      // The sample the bars above just made.
      ctx.fillStyle = exact ? COLORS.spectrum : COLORS.marker
      ctx.beginPath()
      ctx.arc(sx(n), syBot(y[n]), 4 * k, 0, Math.PI * 2)
      ctx.fill()

      // A shared cursor through both strips.
      ctx.strokeStyle = COLORS.textBright
      ctx.globalAlpha = 0.35
      ctx.lineWidth = 1 * k
      ctx.beginPath()
      ctx.moveTo(sx(n), top.y)
      ctx.lineTo(sx(n), bot.y + bot.h)
      ctx.stroke()
      ctx.globalAlpha = 1
      ctx.restore()

      // The horizontal dimension, named. This view shipped with no axis at
      // all, and "which way is time and in what units" is not a thing a
      // student should have to infer: it is sample index m, 0 at the left.
      ctx.fillStyle = COLORS.text
      ctx.font = `${Math.round(10 * k)}px ui-monospace, SFMono-Regular, Menlo, monospace`
      ctx.textBaseline = 'top'
      const axisY = bot.y + bot.h + 6 * k
      ctx.textAlign = 'left'
      ctx.fillText('m = 0', outer.x, axisY)
      ctx.textAlign = 'center'
      // Text and position agree on the same rounded sample, or the label sits
      // half a pitch off its own tick whenever the buffer length is even.
      const mMid = Math.round((x.length - 1) / 2)
      ctx.fillText(String(mMid), sx(mMid), axisY)
      ctx.textAlign = 'right'
      ctx.fillText(`${x.length - 1}  (sample index)`, outer.x + outer.w, axisY)
      // And the cursor's own position, in the cursor's colour.
      ctx.fillStyle = COLORS.textBright
      ctx.textAlign = n / (x.length - 1) > 0.85 ? 'right' : 'center'
      ctx.fillText(`n = ${n}`, sx(n), axisY + 13 * k)
    },
    [x, h, y, n, exact],
  )

  return <canvas ref={ref} className="plot" role="img" aria-label="Convolution: the flipped kernel sliding over the input above, and the output built so far below" />
}

/**
 * The position control under the canvas: a scrubber and a play button.
 *
 * Kept out of app state on purpose — where the animation happens to be paused
 * is a per-view convenience, not part of the setup a preset or a link should
 * carry.
 */
export function useConvolutionPosition(length, resetKey) {
  const [pos, setPos] = useState(Math.floor(length / 3))
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState(1)
  const raf = useRef(0)
  // Fractional position accumulator, so quarter speed is genuinely a quarter
  // rather than rounding back up to one sample per frame.
  const acc = useRef(0)

  // Clamp when the buffer shrinks under us (sample-rate or span change).
  useEffect(() => {
    setPos((p) => Math.min(p, Math.max(0, length - 1)))
  }, [length])

  // A new preset is a new story: start it from the beginning, paused, instead
  // of wherever the scrubber happened to be left on the previous one. Adjusted
  // DURING render (the documented setState-in-render pattern), not in an
  // effect: the effect ran after commit, so the first frame of every preset
  // was painted at the previous preset's scrub position.
  const started = useRef(resetKey)
  if (started.current !== resetKey) {
    started.current = resetKey
    setPos(0)
    setPlaying(false)
  }

  useEffect(() => {
    if (!playing) return undefined
    // A constant sweep TIME rather than a constant samples-per-frame, so short
    // and long buffers both take about six seconds to cross at 1x. The speed
    // control multiplies that.
    const step = (length / 360) * speed
    const tick = () => {
      acc.current += step
      const whole = Math.floor(acc.current)
      if (whole >= 1) {
        acc.current -= whole
        setPos((p) => {
          const next = p + whole
          if (next >= length - 1) {
            setPlaying(false)
            return length - 1
          }
          return next
        })
      }
      raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf.current)
  }, [playing, length, speed])

  // Play resumes from a pause — but pressed AT THE END it restarts, because
  // "press play, nothing happens, the button flicks back" reads as broken.
  const play = () => {
    setPos((p) => (p >= length - 1 ? 0 : p))
    setPlaying((was) => !was)
  }

  return { pos, setPos, playing, setPlaying, play, speed, setSpeed }
}

export const CONV_SPEEDS = [0.25, 0.5, 1, 2, 4]
