import React, { useEffect, useRef, useState } from 'react'
import { COLORS, niceStep, plotArea, plotScale, useCanvas, fmt } from '@ee-labs/ui'
import { paneRange } from '../watch.js'

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

      // Vertical ranges: a stable story is framed whole, once; a runaway is
      // framed up to the cursor on paneRange's doubling ladder, so the early
      // mechanism is legible and the axis zooms out in steps as it blows up.
      // (The first cut clamped a diverging pane to ±4 and both traces simply
      // left the picture.)
      const opts = { floor: 1, upTo: n, diverges }
      const rTop = paneRange([y, input], opts)
      const rBot = paneRange([u, ...parts.map((p) => p.y)], opts)
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
      // A real vertical scale for each strip: round-valued ticks with faint
      // gridlines, and the quantity named on a rotated axis title — so what
      // is fully happening can be READ, not inferred from two endpoints.
      // Gridlines go down BEFORE the traces (inside the clip); labels and the
      // title live in the left gutter, drawn after it.
      const tickValues = (r) => {
        const step = niceStep(r.hi - r.lo, 4)
        const out = []
        for (let v = Math.ceil(r.lo / step) * step; v <= r.hi + 1e-12; v += step) {
          out.push(Math.abs(v) < step / 1e6 ? 0 : v)
        }
        return out
      }
      const yGrid = (area, sy, r) => {
        ctx.strokeStyle = COLORS.grid
        ctx.globalAlpha = 0.6
        ctx.lineWidth = 1
        for (const v of tickValues(r)) {
          ctx.beginPath()
          ctx.moveTo(area.x, sy(v))
          ctx.lineTo(area.x + area.w, sy(v))
          ctx.stroke()
        }
        ctx.globalAlpha = 1
      }
      const yLabels = (area, sy, r, title) => {
        ctx.fillStyle = COLORS.text
        ctx.font = `${Math.round(9.5 * k)}px ui-monospace, SFMono-Regular, Menlo, monospace`
        ctx.textAlign = 'right'
        ctx.textBaseline = 'middle'
        for (const v of tickValues(r)) ctx.fillText(fmt(v, '', 2), area.x - 7 * k, sy(v))
        ctx.save()
        ctx.fillStyle = COLORS.text
        ctx.font = `${Math.round(11 * k)}px ui-sans-serif, system-ui, sans-serif`
        ctx.translate(area.x - 56 * k, area.y + area.h / 2)
        ctx.rotate(-Math.PI / 2)
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(title, 0, 0)
        ctx.restore()
      }
      // Everything painted in a strip stays IN the strip: a diverging ghost
      // once ran out of its pane, through the gap, and into the other pane's
      // header. The clip hugs the pane with a hairline of slack.
      const inPane = (area, draw) => {
        ctx.save()
        ctx.beginPath()
        ctx.rect(area.x, area.y - 2 * k, area.w, area.h + 4 * k)
        ctx.clip()
        draw()
        ctx.restore()
      }
      // A trace split at the cursor: solid history, ghosted future — the
      // future is still there to aim at, the history is what has happened.
      const trace = (area, arr, sy, color, width = 1.5) =>
        inPane(area, () => {
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
        })

      ctx.save()
      ctx.beginPath()
      ctx.rect(outer.x, outer.y - 14 * k, outer.w, outer.h + 28 * k)
      ctx.clip()

      // ---- top strip: asked vs delivered, the error between them ----------
      label(
        top,
        (dist
          ? 'the shove d (dashed) and the output y — everything y shows IS error, to be driven back to 0'
          : 'asked r (dashed) and delivered y — the gap between them is the error e') +
          (diverges ? '   (axis zooming out with the runaway)' : ''),
      )
      zero(top, syTop)
      yGrid(top, syTop, rTop)

      // The error HISTORY, shaded: the area between what was asked and what
      // was delivered, up to the cursor. When the controller carries an
      // integrator this picture is literal — that area, times Ki, IS the
      // orange trace below — so it wears the integral's colour and says so.
      const hasI = parts.some((p) => p.key === 'i')
      {
        const baseAt = (i) => (dist ? 0 : input[i])
        inPane(top, () => {
          ctx.fillStyle = hasI ? COLORS.spectrum : COLORS.marker
          ctx.globalAlpha = 0.12
          ctx.beginPath()
          ctx.moveTo(sx(0), syTop(baseAt(0)))
          for (let i = 1; i <= n; i++) ctx.lineTo(sx(i), syTop(baseAt(i)))
          for (let i = n; i >= 0; i--) ctx.lineTo(sx(i), syTop(y[i]))
          ctx.closePath()
          ctx.fill()
          ctx.globalAlpha = 1
        })
        if (hasI) {
          ctx.fillStyle = COLORS.spectrum
          ctx.font = `italic ${Math.round(10 * k)}px ui-sans-serif, system-ui, sans-serif`
          ctx.textAlign = 'right'
          ctx.textBaseline = 'top'
          ctx.fillText('shaded area × Ki = the integral part below', outer.x + outer.w - 4 * k, top.y + 4 * k)
        }
      }
      ctx.setLineDash([5 * k, 4 * k])
      trace(top, input, syTop, COLORS.textBright, 1.1)
      ctx.setLineDash([])
      trace(top, y, syTop, COLORS.trace, 1.7)

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
      yGrid(bot, syBot, rBot)
      // A single-part controller's only part IS u; drawing both would be the
      // same curve twice.
      if (parts.length > 1) {
        for (const p of parts) {
          if (p.key === 'u') continue
          trace(bot, p.y, syBot, PART_COLORS[p.key] || COLORS.response, 1.3)
        }
      }
      trace(bot, u, syBot, PART_COLORS.u, 1.9)

      // The composition at the cursor, as a stacked bar: each part a segment
      // in its own colour, laid end to end from zero to u — the convolution
      // view's product bars, translated. Where a trace only says "these
      // coexist", the stack says "these ADD, and this is each one's share
      // right now". Signed parts stack naturally: a negative segment walks
      // the running total back down.
      inPane(bot, () => {
        if (parts.length > 1) {
          const barW = 9 * k
          const bx = ex + 6 * k
          let acc = 0
          for (const p of parts) {
            const v = p.y[n]
            const y0 = syBot(acc)
            const y1 = syBot(acc + v)
            ctx.fillStyle = PART_COLORS[p.key]
            ctx.globalAlpha = 0.85
            ctx.fillRect(bx, Math.min(y0, y1), barW, Math.max(1, Math.abs(y1 - y0)))
            acc += v
          }
          ctx.globalAlpha = 1
          // The cursor's values, dotted onto each part's trace.
          for (const p of parts) {
            if (p.key === 'u') continue
            ctx.fillStyle = PART_COLORS[p.key]
            ctx.beginPath()
            ctx.arc(ex, syBot(p.y[n]), 2.6 * k, 0, Math.PI * 2)
            ctx.fill()
          }
        }
        ctx.fillStyle = PART_COLORS.u
        ctx.beginPath()
        ctx.arc(ex, syBot(u[n]), 3.6 * k, 0, Math.PI * 2)
        ctx.fill()
      })

      // The legend, in the traces' own colours — with the value each part
      // holds at the cursor, live, so the stack can be read as numbers too.
      {
        ctx.font = `${Math.round(10.5 * k)}px ui-monospace, SFMono-Regular, Menlo, monospace`
        ctx.textBaseline = 'top'
        ctx.textAlign = 'left'
        let lx = bot.x + 6 * k
        const ly = bot.y + 4 * k
        const token = (text, color) => {
          ctx.fillStyle = color
          ctx.fillText(text, lx, ly)
          lx += ctx.measureText(text).width + 14 * k
        }
        if (parts.length > 1) {
          for (const p of parts) token(`${p.label} ${fmt(p.y[n], '', 2)}`, PART_COLORS[p.key])
          token(`= u ${fmt(u[n], '', 2)}`, PART_COLORS.u)
        } else {
          token(`${parts[0].label} = ${fmt(u[n], '', 2)}`, PART_COLORS.u)
        }
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

      // The scales' labels and titles, drawn OUTSIDE the clip: they live in
      // the left gutter, and the first cut drew them inside the clipped plot
      // region — axes present in the code, absent from the picture.
      yLabels(top, syTop, rTop, dist ? 'Output (d = 1)' : 'Output (r = 1)')
      yLabels(bot, syBot, rBot, 'Effort u')

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
