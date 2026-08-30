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

      let xPeak = 1e-9
      for (let i = 0; i < x.length; i++) xPeak = Math.max(xPeak, Math.abs(x[i]))
      let hPeak = 1e-9
      for (let i = 0; i < h.length; i++) hPeak = Math.max(hPeak, Math.abs(h[i]))
      let yPeak = xPeak
      for (let i = 0; i < y.length; i++) yPeak = Math.max(yPeak, Math.abs(y[i]))

      const sx = (m) => outer.x + (m / (x.length - 1)) * outer.w
      const mid = (area) => area.y + area.h / 2
      const syTop = (v) => mid(top) - (v / (xPeak * 1.1)) * (top.h / 2)
      const syBot = (v) => mid(bot) - (v / (yPeak * 1.1)) * (bot.h / 2)

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

      // ---- top strip: input, flipped kernel, products
      label(top, 'input x[m], with the kernel flipped and slid to n')
      zero(top, syTop)

      // Product bars first, underneath everything: h[n−m]·x[m] on the input's
      // own scale, since their SUM is the next output sample.
      ctx.fillStyle = COLORS.spectrum
      ctx.globalAlpha = 0.5
      for (let m = Math.max(0, n - h.length + 1); m <= n; m++) {
        const prod = h[n - m] * x[m]
        if (prod === 0) continue
        const px = sx(m)
        ctx.fillRect(px - 1 * k, Math.min(syTop(0), syTop(prod)), 2 * k, Math.abs(syTop(prod) - syTop(0)))
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

      // The kernel, flipped: h[n−m] plotted against m, on its own scale so a
      // 1/N-tall moving average is still visible. Drawn as stems to keep it
      // legibly a different object from the signal.
      ctx.strokeStyle = COLORS.response
      ctx.lineWidth = 1.6 * k
      for (let m = Math.max(0, n - h.length + 1); m <= n; m++) {
        const hv = h[n - m]
        if (hv === 0) continue
        const px = sx(m)
        const py = mid(top) - (hv / (hPeak * 1.15)) * (top.h / 2)
        ctx.beginPath()
        ctx.moveTo(px, syTop(0))
        ctx.lineTo(px, py)
        ctx.stroke()
      }

      // ---- bottom strip: the output so far
      label(bot, exact ? 'output y so far — each sample is one such sum' : 'chain output — NOT this sum: the chain is nonlinear')
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
export function useConvolutionPosition(length) {
  const [pos, setPos] = useState(Math.floor(length / 3))
  const [playing, setPlaying] = useState(false)
  const raf = useRef(0)

  // Clamp when the buffer shrinks under us (sample-rate or span change).
  useEffect(() => {
    setPos((p) => Math.min(p, Math.max(0, length - 1)))
  }, [length])

  useEffect(() => {
    if (!playing) return undefined
    // A constant sweep TIME rather than a constant samples-per-frame, so short
    // and long buffers both take about six seconds to cross.
    const step = Math.max(1, Math.round(length / 360))
    const tick = () => {
      setPos((p) => {
        const next = p + step
        if (next >= length - 1) {
          setPlaying(false)
          return length - 1
        }
        return next
      })
      raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf.current)
  }, [playing, length])

  return { pos, setPos, playing, setPlaying }
}
