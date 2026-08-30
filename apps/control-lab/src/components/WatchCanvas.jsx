import React, { useEffect, useRef, useState } from 'react'
import { COLORS, plotArea, plotScale, useCanvas, fmt } from '@ee-labs/ui'

/**
 * The loop watched working, one moment at a time.
 *
 * Signal Lab's convolution scrubber, translated: there you watch the kernel
 * build each output sample; here you scrub (or play) through the step and
 * watch the MECHANISM — the top strip is what was asked and what came out,
 * with the error between them made visible at the cursor; the bottom strip is
 * the controller's effort answering that error, split into the parts the
 * gains name. The proportional part is the gap, scaled; the integral part is
 * the accumulated memory that keeps climbing until the error is gone; the
 * derivative part answers the slope — and on a reference step its ideal form
 * is an impulse, which is MARKED at t = 0 rather than drawn, because an
 * impulse has no height and a fake spike would be a lie.
 */

const PART_COLORS = {
  p: COLORS.response,
  i: COLORS.spectrum,
  d: COLORS.phase,
  u: COLORS.textBright,
}

export default function WatchCanvas({ t, input, y, e, u, parts, kick, pos, dist, diverges }) {
  const n = Math.max(0, Math.min(t.length - 1, pos))

  const ref = useCanvas(
    (ctx, w, hpx) => {
      const k = plotScale(w)
      const outer = plotArea(w, hpx)
      const gap = 30 * k
      const half = (outer.h - gap) / 2
      const top = { ...outer, h: half }
      const bot = { ...outer, y: outer.y + half + gap, h: half }

      const sx = (i) => outer.x + (i / (t.length - 1)) * outer.w

      // Vertical ranges from the data, clamped when the loop diverges — the
      // same honesty as the step view: the trace leaves the frame, which is
      // what "unstable" looks like, instead of flattening everything else.
      const range = (arrs, floor) => {
        let lo = 0
        let hi = floor
        for (const a of arrs) {
          for (let i = 0; i < a.length; i++) {
            if (a[i] < lo) lo = a[i]
            if (a[i] > hi) hi = a[i]
          }
        }
        if (diverges) {
          const cap = 4 * Math.max(floor, 1)
          lo = Math.max(lo, -cap)
          hi = Math.min(hi, cap)
        }
        const pad = (hi - lo) * 0.14 || 0.2
        return { lo: lo - pad, hi: hi + pad }
      }
      const rTop = range([y, input], 1)
      const rBot = range([u, ...parts.map((p) => p.y)], 1)
      const syTop = (v) => top.y + top.h - ((v - rTop.lo) / (rTop.hi - rTop.lo)) * top.h
      const syBot = (v) => bot.y + bot.h - ((v - rBot.lo) / (rBot.hi - rBot.lo)) * bot.h

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
      // A vertical scale for each strip — top of range, zero, bottom — or the
      // panes are pictures without units, the axis defect the review playbook
      // opens its fourth item with.
      const yTicks = (area, sy, r) => {
        ctx.fillStyle = COLORS.text
        ctx.font = `${Math.round(9.5 * k)}px ui-monospace, SFMono-Regular, Menlo, monospace`
        ctx.textAlign = 'right'
        const seen = []
        for (const v of [r.hi, 0, r.lo]) {
          const py = sy(v)
          // Skip a tick that would sit on top of one already drawn.
          if (seen.some((s) => Math.abs(s - py) < 12 * k)) continue
          seen.push(py)
          ctx.textBaseline = py < area.y + 8 * k ? 'top' : py > area.y + area.h - 8 * k ? 'bottom' : 'middle'
          ctx.fillText(fmt(v, '', 2), area.x - 7 * k, py)
        }
      }
      // A trace split at the cursor: solid history, ghosted future — the
      // future is still there to aim at, the history is what has happened.
      const trace = (arr, sy, color, width = 1.5) => {
        ctx.lineJoin = 'round'
        ctx.strokeStyle = color
        for (const [from, to, alpha] of [
          [0, n, 1],
          [n, arr.length - 1, 0.22],
        ]) {
          if (to <= from) continue
          ctx.globalAlpha = alpha
          ctx.lineWidth = width * k
          ctx.beginPath()
          for (let i = from; i <= to; i++) {
            const px = sx(i)
            const py = sy(arr[i])
            if (i === from) ctx.moveTo(px, py)
            else ctx.lineTo(px, py)
          }
          ctx.stroke()
        }
        ctx.globalAlpha = 1
      }

      ctx.save()
      ctx.beginPath()
      ctx.rect(outer.x, outer.y - 14 * k, outer.w, outer.h + 28 * k)
      ctx.clip()

      // ---- top strip: asked vs delivered, the error between them ----------
      label(
        top,
        dist
          ? 'the shove d (dashed) and the output y — everything y shows IS error, to be driven back to 0'
          : 'asked r (dashed) and delivered y — the gap between them is the error e',
      )
      zero(top, syTop)
      ctx.setLineDash([5 * k, 4 * k])
      trace(input, syTop, COLORS.textBright, 1.1)
      ctx.setLineDash([])
      trace(y, syTop, COLORS.trace, 1.7)

      // The error at the cursor, drawn as the vertical gap it is — measured
      // from what the loop is HOLDING the output to. Under a shove the
      // reference is zero and the dashed line is the shove itself, so the
      // gap runs from 0 to y, not from d to y: a bar of length 0.9 labelled
      // −0.098 would be an exhibit lying about its own size.
      const ex = sx(n)
      const yAsk = syTop(dist ? 0 : input[n])
      const yGot = syTop(y[n])
      if (Math.abs(yAsk - yGot) > 2 * k) {
        ctx.strokeStyle = COLORS.marker
        ctx.lineWidth = 2 * k
        ctx.beginPath()
        ctx.moveTo(ex, yAsk)
        ctx.lineTo(ex, yGot)
        ctx.stroke()
        for (const yy of [yAsk, yGot]) {
          ctx.beginPath()
          ctx.moveTo(ex - 3.5 * k, yy)
          ctx.lineTo(ex + 3.5 * k, yy)
          ctx.stroke()
        }
        ctx.fillStyle = COLORS.marker
        ctx.font = `${Math.round(11 * k)}px ui-monospace, SFMono-Regular, Menlo, monospace`
        ctx.textAlign = n / (t.length - 1) > 0.85 ? 'right' : 'left'
        ctx.textBaseline = 'middle'
        ctx.fillText(
          ` e = ${fmt(e[n], '', 3)} `,
          ex + (n / (t.length - 1) > 0.85 ? -6 : 6) * k,
          (yAsk + yGot) / 2,
        )
      }

      // ---- bottom strip: the effort answering it --------------------------
      label(bot, 'the controller’s answer u — what actually drives the plant')
      zero(bot, syBot)
      for (const p of parts) {
        if (p.key === 'u') continue
        trace(p.y, syBot, PART_COLORS[p.key] || COLORS.response, 1.3)
      }
      trace(u, syBot, PART_COLORS.u, 1.9)

      // The legend, in the traces' own colours.
      {
        ctx.font = `${Math.round(10.5 * k)}px ui-monospace, SFMono-Regular, Menlo, monospace`
        ctx.textBaseline = 'top'
        ctx.textAlign = 'left'
        let lx = bot.x + 6 * k
        const ly = bot.y + 4 * k
        const token = (text, color) => {
          ctx.fillStyle = color
          ctx.fillText(text, lx, ly)
          lx += ctx.measureText(text).width + 12 * k
        }
        for (const p of parts) if (p.key !== 'u') token(p.label, PART_COLORS[p.key])
        token(parts.length > 1 ? '= u (their sum)' : parts[0].label, PART_COLORS.u)
      }

      // The derivative kick: an impulse belongs at the step edge, and an
      // impulse has no height — so it is marked, not drawn.
      if (kick) {
        // Kept clear of the legend row above it.
        const kx = sx(0) + 1 * k
        const tip = bot.y + 30 * k
        ctx.strokeStyle = COLORS.phase
        ctx.setLineDash([2 * k, 3 * k])
        ctx.lineWidth = 1.6 * k
        ctx.beginPath()
        ctx.moveTo(kx, syBot(0))
        ctx.lineTo(kx, tip)
        ctx.stroke()
        ctx.setLineDash([])
        ctx.beginPath()
        ctx.moveTo(kx - 4 * k, tip + 8 * k)
        ctx.lineTo(kx, tip)
        ctx.lineTo(kx + 4 * k, tip + 8 * k)
        ctx.stroke()
        ctx.fillStyle = COLORS.phase
        ctx.font = `italic ${Math.round(10 * k)}px ui-sans-serif, system-ui, sans-serif`
        ctx.textAlign = 'left'
        ctx.textBaseline = 'top'
        ctx.fillText('Kd·δ — the derivative kick: an impulse, off any axis', kx + 8 * k, tip)
      }

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

      // The vertical scales, drawn OUTSIDE the clip: the tick labels live in
      // the left gutter, and the first cut drew them inside the clipped plot
      // region — axes present in the code, absent from the picture.
      yTicks(top, syTop, rTop)
      yTicks(bot, syBot, rBot)

      // The time axis, named and united.
      ctx.fillStyle = COLORS.text
      ctx.font = `${Math.round(10 * k)}px ui-monospace, SFMono-Regular, Menlo, monospace`
      ctx.textBaseline = 'top'
      const axisY = bot.y + bot.h + 6 * k
      ctx.textAlign = 'left'
      ctx.fillText('0', outer.x, axisY)
      ctx.textAlign = 'center'
      ctx.fillText(`${fmt(t[Math.floor((t.length - 1) / 2)], 's', 3)}`, sx((t.length - 1) / 2), axisY)
      ctx.textAlign = 'right'
      ctx.fillText(`${fmt(t[t.length - 1], 's', 3)}  (time)`, outer.x + outer.w, axisY)
      ctx.fillStyle = COLORS.textBright
      ctx.textAlign = n / (t.length - 1) > 0.85 ? 'right' : 'center'
      ctx.fillText(`t = ${fmt(t[n], 's', 3)}`, sx(n), axisY + 13 * k)
    },
    [t, input, y, e, u, parts, kick, n, dist, diverges],
  )

  return (
    <canvas
      ref={ref}
      className="plot"
      role="img"
      aria-label="The loop watched in time: reference and output above with the error between them, the controller's effort and its parts below"
    />
  )
}

/**
 * The scrub/play state. Signal Lab's convolution transport, same rules:
 * a constant sweep time at 1×, play at the end restarts, a new lesson resets
 * the story — paused at the END here, so arriving at the view shows the
 * finished response like the step view does, and play means "run it again".
 */
export function useWatchPosition(length, resetKey) {
  const [pos, setPos] = useState(length - 1)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState(1)
  const raf = useRef(0)
  const acc = useRef(0)

  const started = useRef(resetKey)
  useEffect(() => {
    if (started.current === resetKey) return
    started.current = resetKey
    setPos(length - 1)
    setPlaying(false)
  }, [resetKey, length])

  useEffect(() => {
    if (!playing) return undefined
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

  const play = () => {
    setPos((p) => (p >= length - 1 ? 0 : p))
    setPlaying((was) => !was)
  }

  return { pos, setPos, playing, setPlaying, play, speed, setSpeed }
}

export const WATCH_SPEEDS = [0.25, 0.5, 1, 2, 4]
