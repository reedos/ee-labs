import React, { useEffect, useRef, useState } from 'react'
import { COLORS, niceStep, plotArea, plotScale, useCanvas, fmt, fmtNum } from '@ee-labs/ui'
import { paneRange, openingCursor } from '../watch.js'

/**
 * The loop watched working, one moment at a time.
 *
 * Signal Lab's convolution scrubber, translated: there you watch the kernel
 * build each output sample; here you scrub (or play) through the step and
 * watch the MECHANISM. The top strip is what was asked and what came out,
 * with the error between them made visible at the cursor. Then ONE STRIP PER
 * TERM — a first cut overlaid every part on a single effort pane, and Reed's
 * review called it what it was: messy, and hiding the very thing it existed
 * to show. Each strip draws the raw signal the gain acts on (e, ∫e, or ė) in
 * dim grey UNDER the term's answer in its own colour, on one shared scale —
 * so the gain is literally the vertical stretch between the two curves: the
 * multiplication, visible. The last strip is the sum u that actually drives
 * the plant, with the parts stacked into it at the cursor.
 *
 * The ideal derivative fed a reference step produces an impulse; it has no
 * height to plot, so the smooth part of ė is drawn and the kick is MARKED on
 * the D strip rather than faked as a spike.
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
      const sx = (i) => outer.x + (i / (t.length - 1)) * outer.w
      const ex = sx(n)
      const split = parts.length > 1

      // ---- the strip stack --------------------------------------------------
      // Every term earns its own strip (plus the sum); a solo controller is
      // its own answer, so it gets a single combined strip. The i/o strip is
      // a little taller — it is the story the rest explain.
      const kinds = [{ kind: 'io', weight: 1.35 }]
      if (split) {
        for (const p of parts) kinds.push({ kind: 'part', part: p, weight: 1 })
        kinds.push({ kind: 'sum', weight: 1 })
      } else {
        kinds.push({ kind: 'solo', part: parts[0], weight: 1.1 })
      }
      const gap = 24 * k
      const wSum = kinds.reduce((s, s2) => s + s2.weight, 0)
      const usable = outer.h - gap * (kinds.length - 1)
      let yCursor = outer.y
      const opts = { upTo: n, diverges }
      const strips = kinds.map((s) => {
        const h = (usable * s.weight) / wSum
        const area = { x: outer.x, y: yCursor, w: outer.w, h }
        yCursor += h + gap
        const r =
          s.kind === 'io'
            ? paneRange([y, input], { floor: 1, ...opts })
            : s.kind === 'part'
              ? paneRange([s.part.raw, s.part.y], { floor: 1e-9, ...opts })
              : s.kind === 'sum'
                ? paneRange([u], { floor: 1e-9, ...opts })
                : paneRange([parts[0].raw, u], { floor: 1e-9, ...opts })
        const sy = (v) => area.y + area.h - ((v - r.lo) / (r.hi - r.lo)) * area.h
        return { ...s, area, r, sy }
      })
      const last = strips[strips.length - 1].area

      // ---- shared chrome ----------------------------------------------------
      const label = (area, text, color = COLORS.text) => {
        ctx.fillStyle = color
        ctx.font = `${Math.round(10 * k)}px ui-sans-serif, system-ui, sans-serif`
        ctx.textAlign = 'left'
        ctx.textBaseline = 'bottom'
        ctx.fillText(text, area.x + 2 * k, area.y - 4 * k)
      }
      const liveValue = (area, text, color) => {
        ctx.fillStyle = color
        ctx.font = `${Math.round(10.5 * k)}px ui-monospace, SFMono-Regular, Menlo, monospace`
        ctx.textAlign = 'right'
        ctx.textBaseline = 'bottom'
        ctx.fillText(text, area.x + area.w - 2 * k, area.y - 4 * k)
      }
      const tickValues = (r, target) => {
        const step = niceStep(r.hi - r.lo, target)
        const out = []
        for (let v = Math.ceil(r.lo / step) * step; v <= r.hi + 1e-12; v += step) {
          out.push(Math.abs(v) < step / 1e6 ? 0 : v)
        }
        return out
      }
      const yGrid = (s) => {
        ctx.strokeStyle = COLORS.grid
        ctx.globalAlpha = 0.6
        ctx.lineWidth = 1
        for (const v of tickValues(s.r, s.kind === 'io' ? 4 : 2)) {
          ctx.beginPath()
          ctx.moveTo(s.area.x, s.sy(v))
          ctx.lineTo(s.area.x + s.area.w, s.sy(v))
          ctx.stroke()
        }
        ctx.globalAlpha = 1
      }
      const yLabels = (s) => {
        ctx.fillStyle = COLORS.text
        ctx.font = `${Math.round(9.5 * k)}px ui-monospace, SFMono-Regular, Menlo, monospace`
        ctx.textAlign = 'right'
        ctx.textBaseline = 'middle'
        for (const v of tickValues(s.r, s.kind === 'io' ? 4 : 2)) {
          // Signal values are dimensionless — 0.5, never "500 m".
          ctx.fillText(fmtNum(v, 2), s.area.x - 7 * k, s.sy(v))
        }
      }
      // Everything painted in a strip stays IN the strip: a diverging ghost
      // once ran out of its pane, through the gap, and into the next pane's
      // header. The clip hugs the strip with a hairline of slack.
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
      const trace = (area, arr, sy, color, width = 1.5, alphaScale = 1) =>
        inPane(area, () => {
          ctx.lineJoin = 'round'
          ctx.strokeStyle = color
          for (const [from, to, alpha] of [
            [0, n, 1 * alphaScale],
            [n, arr.length - 1, 0.22 * alphaScale],
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
      const dot = (s, v, color, radius = 3) => {
        inPane(s.area, () => {
          ctx.fillStyle = color
          ctx.beginPath()
          ctx.arc(ex, s.sy(v), radius * k, 0, Math.PI * 2)
          ctx.fill()
        })
      }
      const zero = (s) => {
        ctx.strokeStyle = COLORS.gridMajor
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.moveTo(s.area.x, s.sy(0))
        ctx.lineTo(s.area.x + s.area.w, s.sy(0))
        ctx.stroke()
      }

      const hasI = parts.some((p) => p.key === 'i')

      // ---- draw each strip --------------------------------------------------
      for (const s of strips) {
        zero(s)
        yGrid(s)

        if (s.kind === 'io') {
          label(
            s.area,
            (dist
              ? 'the shove d (dashed) and the output y — everything y shows IS error, to be driven back to 0'
              : 'asked r (dashed) and delivered y — the gap between them is the error e') +
              (diverges ? '   (axis zooming out with the runaway)' : ''),
          )
          // The error HISTORY, shaded: the area between what was asked and
          // what was delivered, up to the cursor. With an integrator in the
          // loop this picture is literal — that area, times Ki, IS the ∫e
          // strip below — so it wears the integral's colour and says so.
          const baseAt = (i) => (dist ? 0 : input[i])
          inPane(s.area, () => {
            ctx.fillStyle = hasI ? COLORS.spectrum : COLORS.marker
            ctx.globalAlpha = 0.12
            ctx.beginPath()
            ctx.moveTo(sx(0), s.sy(baseAt(0)))
            for (let i = 1; i <= n; i++) ctx.lineTo(sx(i), s.sy(baseAt(i)))
            for (let i = n; i >= 0; i--) ctx.lineTo(sx(i), s.sy(y[i]))
            ctx.closePath()
            ctx.fill()
            ctx.globalAlpha = 1
          })
          if (hasI) {
            ctx.fillStyle = COLORS.spectrum
            ctx.font = `italic ${Math.round(10 * k)}px ui-sans-serif, system-ui, sans-serif`
            ctx.textAlign = 'right'
            ctx.textBaseline = 'top'
            ctx.fillText('shaded area = the ∫e strip below', s.area.x + s.area.w - 4 * k, s.area.y + 4 * k)
          }
          ctx.setLineDash([5 * k, 4 * k])
          trace(s.area, input, s.sy, COLORS.textBright, 1.1)
          ctx.setLineDash([])
          trace(s.area, y, s.sy, COLORS.trace, 1.7)

          // The error at the cursor, drawn as the vertical gap it is —
          // measured from what the loop HOLDS the output to (zero, under a
          // shove; the reference otherwise).
          const yAsk = s.sy(dist ? 0 : input[n])
          const yGot = s.sy(y[n])
          if (Math.abs(yAsk - yGot) > 2 * k) {
            inPane(s.area, () => {
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
                ` e = ${fmtNum(e[n], 3)} `,
                ex + (n / (t.length - 1) > 0.85 ? -6 : 6) * k,
                (yAsk + yGot) / 2,
              )
            })
          }
        }

        if (s.kind === 'part' || s.kind === 'solo') {
          const p = s.part
          const color = PART_COLORS[s.kind === 'solo' ? 'u' : p.key] || COLORS.response
          // The kick's words live on the label line, out of the thin strip —
          // in the strip they struck through the very trace being read.
          const kickNote = kick && p.key === 'd' ? '   (+ a Kd·δ impulse at the step edge, off any axis)' : ''
          label(
            s.area,
            (s.kind === 'solo'
              ? `${p.rawLabel} (dashed), through the controller = u, what drives the plant`
              : `${p.rawLabel} (dashed) — its gain stretches it into ${p.label}`) + kickNote,
          )
          liveValue(
            s.area,
            `${s.kind === 'solo' ? 'u' : p.label} = ${fmtNum((s.kind === 'solo' ? u : p.y)[n], 2)}`,
            color,
          )
          // The raw signal and the term's answer share one scale, so the
          // gain IS the visible stretch between the curves. The raw one is
          // DASHED: at a gain of exactly 1 the two coincide, and dashes over
          // the colour read as "same curve" instead of hiding it.
          ctx.setLineDash([4 * k, 3 * k])
          trace(s.area, p.raw, s.sy, COLORS.text, 1.1, 0.8)
          ctx.setLineDash([])
          trace(s.area, s.kind === 'solo' ? u : p.y, s.sy, color, 1.7)
          dot(s, (s.kind === 'solo' ? u : p.y)[n], color)

          if (kick && p.key === 'd') {
            inPane(s.area, () => {
              const kx = sx(0) + 1 * k
              ctx.strokeStyle = COLORS.phase
              ctx.setLineDash([2 * k, 3 * k])
              ctx.lineWidth = 1.6 * k
              ctx.beginPath()
              ctx.moveTo(kx, s.sy(0))
              ctx.lineTo(kx, s.area.y + 2 * k)
              ctx.stroke()
              ctx.setLineDash([])
            })
          }
        }

        if (s.kind === 'sum') {
          label(s.area, 'their sum u — what actually drives the plant')
          liveValue(s.area, `u = ${fmtNum(u[n], 2)}`, PART_COLORS.u)
          trace(s.area, u, s.sy, PART_COLORS.u, 1.9)
          // The composition at the cursor: each part a segment laid end to
          // end from zero to u — the convolution view's product bars,
          // translated. The strips above say what each part is; the stack
          // says they ADD, and shows each one's share right now.
          inPane(s.area, () => {
            const barW = 9 * k
            let acc = 0
            for (const p of parts) {
              const v = p.y[n]
              const y0 = s.sy(acc)
              const y1 = s.sy(acc + v)
              ctx.fillStyle = PART_COLORS[p.key]
              ctx.globalAlpha = 0.85
              ctx.fillRect(ex + 6 * k, Math.min(y0, y1), barW, Math.max(1, Math.abs(y1 - y0)))
              acc += v
            }
            ctx.globalAlpha = 1
          })
          dot(s, u[n], PART_COLORS.u, 3.6)
        }
      }

      // Tick labels in the left gutter, and the one rotated title the gutter
      // has room for — each strip's own quantity is named on its label line.
      for (const s of strips) yLabels(s)
      ctx.save()
      ctx.fillStyle = COLORS.text
      ctx.font = `${Math.round(11 * k)}px ui-sans-serif, system-ui, sans-serif`
      ctx.translate(outer.x - 56 * k, strips[0].area.y + strips[0].area.h / 2)
      ctx.rotate(-Math.PI / 2)
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(dist ? 'Output (d = 1)' : 'Output (r = 1)', 0, 0)
      ctx.restore()

      // A shared cursor through every strip.
      ctx.strokeStyle = COLORS.textBright
      ctx.globalAlpha = 0.35
      ctx.lineWidth = 1 * k
      ctx.beginPath()
      ctx.moveTo(ex, strips[0].area.y)
      ctx.lineTo(ex, last.y + last.h)
      ctx.stroke()
      ctx.globalAlpha = 1

      // The time axis, named and united.
      ctx.fillStyle = COLORS.text
      ctx.font = `${Math.round(10 * k)}px ui-monospace, SFMono-Regular, Menlo, monospace`
      ctx.textBaseline = 'top'
      const axisY = last.y + last.h + 6 * k
      ctx.textAlign = 'left'
      ctx.fillText('0', outer.x, axisY)
      ctx.textAlign = 'center'
      ctx.fillText(`${fmt(t[Math.floor((t.length - 1) / 2)], 's', 3)}`, sx((t.length - 1) / 2), axisY)
      ctx.textAlign = 'right'
      ctx.fillText(`${fmt(t[t.length - 1], 's', 3)}  (time)`, outer.x + outer.w, axisY)
      ctx.fillStyle = COLORS.textBright
      ctx.textAlign = n / (t.length - 1) > 0.85 ? 'right' : 'center'
      ctx.fillText(`t = ${fmt(t[n], 's', 3)}`, ex, axisY + 13 * k)
    },
    [t, input, y, e, u, parts, kick, n, dist, diverges],
  )

  return (
    <canvas
      ref={ref}
      className="plot"
      role="img"
      aria-label="The loop watched in time: reference and output with the error between them, then each controller term's input and answer on its own strip, and their sum"
    />
  )
}

/**
 * The scrub/play state. Signal Lab's convolution transport, same rules:
 * a constant sweep time at 1×, play at the end restarts, a new lesson (or a
 * reset to one) rewinds the story — to the OPENING cursor a little way in,
 * where both controller terms are still visibly at work (see openingCursor
 * in watch.js), not to the end where the handoff has already happened.
 */
export function useWatchPosition(length, resetKey) {
  const [pos, setPos] = useState(() => openingCursor(length))
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState(1)
  const raf = useRef(0)
  const acc = useRef(0)

  const started = useRef(resetKey)
  useEffect(() => {
    if (started.current === resetKey) return
    started.current = resetKey
    setPos(openingCursor(length))
    setPlaying(false)
  }, [resetKey, length])

  useEffect(() => {
    if (!playing) return undefined
    // A ~12-second sweep at 1× — half the convolution view's pace. Reed's
    // review: the handoff between the terms is the thing being watched, and
    // at six seconds it was over before it could be followed.
    const step = (length / 720) * speed
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
