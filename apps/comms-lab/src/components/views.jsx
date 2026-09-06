import React from 'react'
import { useCanvas, COLORS, plotArea, drawFrame, fmtNum, fmtHz } from '@ee-labs/ui'

// The views this lab reuses rather than invents. Each is an ordinary XY plot on
// the shared chrome in `packages/ui`, and each states its quantity, its units
// and a range that adapts to what is drawn (REVIEW_PLAYBOOK §4).

/** A simple line plot, used for a real waveform and for a learning curve. */
export function TraceCanvas({ data, label = 'Amplitude', unit = '', xLabel = 'Sample', xScale = 1, height = 260, logY = false }) {
  const ref = useCanvas(
    (ctx, w, h) => {
      ctx.fillStyle = COLORS.bg
      ctx.fillRect(0, 0, w, h)
      const area = plotArea(w, h)
      if (!data || data.length < 2) return
      let lo = Infinity
      let hi = -Infinity
      for (let i = 0; i < data.length; i++) {
        const v = logY ? Math.log10(Math.max(1e-12, data[i])) : data[i]
        if (v < lo) lo = v
        if (v > hi) hi = v
      }
      if (lo === hi) {
        lo -= 1
        hi += 1
      }
      const pad = (hi - lo) * 0.08
      lo -= pad
      hi += pad
      const xMax = (data.length - 1) * xScale
      const sx = (i) => area.x + ((i * xScale) / (xMax || 1)) * area.w
      const sy = (v) => area.y + area.h - ((v - lo) / (hi - lo)) * area.h
      drawFrame(ctx, area, 0, xMax, lo, hi, (v) => fmtNum(v, 3), (v) => (logY ? `1e${v.toFixed(0)}` : fmtNum(v, 3)), {
        zeroLine: !logY,
        xTitle: xLabel,
        yTitle: unit ? `${label} (${unit})` : label,
      })
      ctx.strokeStyle = COLORS.trace
      ctx.lineWidth = 1.5
      ctx.beginPath()
      for (let i = 0; i < data.length; i++) {
        const v = logY ? Math.log10(Math.max(1e-12, data[i])) : data[i]
        const px = sx(i)
        const py = sy(v)
        if (i === 0) ctx.moveTo(px, py)
        else ctx.lineTo(px, py)
      }
      ctx.stroke()
    },
    [data, label, unit, xLabel, xScale, logY],
  )
  return <canvas ref={ref} className="canvas" style={{ width: '100%', height }} role="img" aria-label={label} />
}

/** The in-phase and quadrature arms as two traces, which is one prop on a scope. */
export function IqCanvas({ buffer, sampleRate = 8000, count = 512, height = 260 }) {
  const ref = useCanvas(
    (ctx, w, h) => {
      ctx.fillStyle = COLORS.bg
      ctx.fillRect(0, 0, w, h)
      const area = plotArea(w, h, { topInset: 16 })
      if (!buffer || buffer.length < 4) return
      const n = Math.min(count, buffer.length / 2)
      let lo = Infinity
      let hi = -Infinity
      for (let i = 0; i < 2 * n; i++) {
        if (buffer[i] < lo) lo = buffer[i]
        if (buffer[i] > hi) hi = buffer[i]
      }
      const pad = (hi - lo) * 0.1 || 1
      lo -= pad
      hi += pad
      const ms = (n / sampleRate) * 1000
      const sx = (i) => area.x + (i / (n - 1 || 1)) * area.w
      const sy = (v) => area.y + area.h - ((v - lo) / (hi - lo)) * area.h
      drawFrame(ctx, area, 0, ms, lo, hi, (v) => fmtNum(v, 3), (v) => fmtNum(v, 2), {
        zeroLine: true,
        xTitle: 'Time (ms)',
        yTitle: 'Amplitude',
      })
      const arm = (offset, colour) => {
        ctx.strokeStyle = colour
        ctx.lineWidth = 1.5
        ctx.beginPath()
        for (let i = 0; i < n; i++) {
          const px = sx(i)
          const py = sy(buffer[2 * i + offset])
          if (i === 0) ctx.moveTo(px, py)
          else ctx.lineTo(px, py)
        }
        ctx.stroke()
      }
      arm(0, COLORS.trace)
      arm(1, COLORS.spectrum)
      ctx.font = `${Math.round(11 * area.k)}px ui-monospace, monospace`
      ctx.textAlign = 'left'
      ctx.fillStyle = COLORS.trace
      ctx.fillText('in phase', area.x, area.y - 5 * area.k)
      ctx.fillStyle = COLORS.spectrum
      ctx.fillText('quadrature', area.x + 70 * area.k, area.y - 5 * area.k)
    },
    [buffer, sampleRate, count],
  )
  return <canvas ref={ref} className="canvas" style={{ width: '100%', height }} role="img" aria-label="In phase and quadrature" />
}

/** A spectrum in decibels, with markers where a lesson names a frequency. */
export function SpectrumCanvas({ freqs, amps, markers = [], floorDb = -90, height = 260, xMax = null }) {
  const ref = useCanvas(
    (ctx, w, h) => {
      ctx.fillStyle = COLORS.bg
      ctx.fillRect(0, 0, w, h)
      const area = plotArea(w, h, { topInset: 16 })
      if (!freqs || !amps || !freqs.length) return
      let peak = 0
      for (let i = 0; i < amps.length; i++) peak = Math.max(peak, amps[i])
      const db = (v) => Math.max(floorDb, 20 * Math.log10(Math.max(1e-12, v / (peak || 1))))
      const hiF = xMax === null ? freqs[freqs.length - 1] : xMax
      const loF = freqs[0] < 0 ? -hiF : 0
      const sx = (f) => area.x + ((f - loF) / (hiF - loF || 1)) * area.w
      const sy = (v) => area.y + area.h - ((v - floorDb) / (0 - floorDb)) * area.h
      drawFrame(ctx, area, loF, hiF, floorDb, 0, (v) => fmtHz(v), (v) => `${v.toFixed(0)}`, {
        xTitle: 'Frequency (Hz)',
        yTitle: 'Level (dB below the peak)',
      })
      ctx.strokeStyle = COLORS.spectrum
      ctx.lineWidth = 1.25
      ctx.beginPath()
      let started = false
      for (let i = 0; i < freqs.length; i++) {
        if (freqs[i] < loF || freqs[i] > hiF) continue
        const px = sx(freqs[i])
        const py = sy(db(amps[i]))
        if (!started) {
          ctx.moveTo(px, py)
          started = true
        } else ctx.lineTo(px, py)
      }
      ctx.stroke()
      ctx.font = `${Math.round(10 * area.k)}px ui-monospace, monospace`
      for (const m of markers) {
        if (m.hz < loF || m.hz > hiF) continue
        ctx.strokeStyle = COLORS.marker
        ctx.lineWidth = 1
        ctx.setLineDash([3, 3])
        ctx.beginPath()
        ctx.moveTo(sx(m.hz) + 0.5, area.y)
        ctx.lineTo(sx(m.hz) + 0.5, area.y + area.h)
        ctx.stroke()
        ctx.setLineDash([])
        ctx.fillStyle = COLORS.marker
        ctx.textAlign = 'left'
        ctx.fillText(m.label, sx(m.hz) + 3, area.y + 11 * area.k)
      }
    },
    [freqs, amps, markers, floorDb, xMax],
  )
  return <canvas ref={ref} className="canvas" style={{ width: '100%', height }} role="img" aria-label="Spectrum" />
}

/** The channel's magnitude response, with its notches marked. */
export function ChannelCanvas({ chan, occupied = null, height = 260 }) {
  const ref = useCanvas(
    (ctx, w, h) => {
      ctx.fillStyle = COLORS.bg
      ctx.fillRect(0, 0, w, h)
      const area = plotArea(w, h, { topInset: 16 })
      if (!chan) return
      const hiF = chan.freqs[chan.freqs.length - 1]
      const lo = Math.min(-25, chan.notchDb - 3)
      const hi = Math.max(6, chan.peakDb + 3)
      const sx = (f) => area.x + (f / hiF) * area.w
      const sy = (v) => area.y + area.h - ((v - lo) / (hi - lo)) * area.h
      drawFrame(ctx, area, 0, hiF, lo, hi, (v) => fmtHz(v), (v) => `${v.toFixed(0)}`, {
        xTitle: 'Frequency (Hz)',
        yTitle: 'Channel response (dB)',
      })
      if (occupied) {
        ctx.fillStyle = 'rgba(95, 168, 255, 0.10)'
        ctx.fillRect(area.x, area.y, sx(Math.min(occupied, hiF)) - area.x, area.h)
      }
      ctx.strokeStyle = COLORS.response
      ctx.lineWidth = 2
      ctx.beginPath()
      for (let i = 0; i < chan.freqs.length; i++) {
        const v = 20 * Math.log10(Math.max(1e-6, chan.mag[i]))
        const px = sx(chan.freqs[i])
        const py = sy(Math.max(lo, v))
        if (i === 0) ctx.moveTo(px, py)
        else ctx.lineTo(px, py)
      }
      ctx.stroke()
      ctx.font = `${Math.round(11 * area.k)}px ui-monospace, monospace`
      ctx.fillStyle = COLORS.text
      ctx.textAlign = 'left'
      const parts = [`peak ${chan.peakDb.toFixed(2)} dB`, `notch ${chan.notchDb.toFixed(2)} dB`]
      if (occupied) parts.push(`signal occupies ${fmtHz(occupied)}`)
      ctx.fillText(parts.join(' · '), area.x, area.y - 5 * area.k)
    },
    [chan, occupied],
  )
  return <canvas ref={ref} className="canvas" style={{ width: '100%', height }} role="img" aria-label="Channel response" />
}

/** Each subcarrier's magnitude, as bars, with the pilots marked. */
export function SubcarrierCanvas({ channel, n, used = 52, pilots = 4, height = 260 }) {
  const ref = useCanvas(
    (ctx, w, h) => {
      ctx.fillStyle = COLORS.bg
      ctx.fillRect(0, 0, w, h)
      const area = plotArea(w, h, { topInset: 16 })
      if (!channel) return
      let hi = 0
      for (let k = 0; k < n; k++) hi = Math.max(hi, Math.hypot(channel[2 * k], channel[2 * k + 1]))
      hi *= 1.15
      const sx = (k) => area.x + (k / (n - 1)) * area.w
      const sy = (v) => area.y + area.h - (v / hi) * area.h
      drawFrame(ctx, area, 0, n - 1, 0, hi, (v) => v.toFixed(0), (v) => fmtNum(v, 2), {
        xTitle: 'Subcarrier',
        yTitle: 'Channel magnitude',
      })
      const step = Math.max(1, Math.floor(used / pilots))
      const width = Math.max(1, area.w / n - 1)
      for (let k = 0; k < n; k++) {
        const mag = Math.hypot(channel[2 * k], channel[2 * k + 1])
        const isPilot = k % step === 0 && k < used
        ctx.fillStyle = isPilot ? COLORS.marker : COLORS.response
        ctx.fillRect(sx(k) - width / 2, sy(mag), width, area.y + area.h - sy(mag))
      }
      ctx.font = `${Math.round(11 * area.k)}px ui-monospace, monospace`
      ctx.fillStyle = COLORS.marker
      ctx.textAlign = 'left'
      ctx.fillText('pilots in red', area.x, area.y - 5 * area.k)
    },
    [channel, n, used, pilots],
  )
  return <canvas ref={ref} className="canvas" style={{ width: '100%', height }} role="img" aria-label="Subcarrier magnitudes" />
}

/** The loop's phase error against time, or the gate's S-curve. */
export function LoopCanvas({ phase = null, curve = null, offsets = null, symbolRate = 1000, height = 260 }) {
  const ref = useCanvas(
    (ctx, w, h) => {
      ctx.fillStyle = COLORS.bg
      ctx.fillRect(0, 0, w, h)
      const area = plotArea(w, h, { topInset: 16 })
      const data = phase || curve
      if (!data || data.length < 2) return
      let lo = Infinity
      let hi = -Infinity
      for (let i = 0; i < data.length; i++) {
        if (data[i] < lo) lo = data[i]
        if (data[i] > hi) hi = data[i]
      }
      const pad = (hi - lo) * 0.1 || 1
      lo -= pad
      hi += pad
      const xMax = phase ? (data.length / symbolRate) * 1000 : offsets[offsets.length - 1]
      const xMin = phase ? 0 : offsets[0]
      const sx = (i) => area.x + ((phase ? (i / symbolRate) * 1000 : offsets[i]) - xMin) / (xMax - xMin) * area.w
      const sy = (v) => area.y + area.h - ((v - lo) / (hi - lo)) * area.h
      drawFrame(ctx, area, xMin, xMax, lo, hi, (v) => fmtNum(v, 3), (v) => fmtNum(v, 3), {
        zeroLine: true,
        xTitle: phase ? 'Time (ms)' : 'Timing offset (symbol periods)',
        yTitle: phase ? 'Phase error (degrees)' : 'Error signal',
      })
      ctx.strokeStyle = COLORS.trace
      ctx.lineWidth = 1.5
      ctx.beginPath()
      for (let i = 0; i < data.length; i++) {
        const px = sx(i)
        const py = sy(data[i])
        if (i === 0) ctx.moveTo(px, py)
        else ctx.lineTo(px, py)
      }
      ctx.stroke()
    },
    [phase, curve, offsets, symbolRate],
  )
  return <canvas ref={ref} className="canvas" style={{ width: '100%', height }} role="img" aria-label={phase ? 'Loop phase error' : 'Timing error signal'} />
}

/** The link budget, as the table it is. Every row is a decibel. */
export function BudgetTable({ budget }) {
  const rows = [
    { name: 'Transmitted power', value: `${budget.txDbm ?? 20} dBm` },
    { name: 'Antenna gain, both ends', value: `${(budget.antennaDbi ?? 2) * 2} dBi` },
    { name: 'Free-space path loss', value: `${budget.pathLoss.toFixed(3)} dB` },
    { name: 'Received power', value: `${budget.received.toFixed(3)} dBm` },
    { name: 'Noise floor', value: `${budget.noiseFloor.toFixed(3)} dBm` },
    { name: 'Signal to noise', value: `${budget.snr.toFixed(3)} dB` },
    { name: 'Eb over N0', value: `${budget.ebN0.toFixed(3)} dB` },
    { name: 'Required', value: `${budget.requiredEbN0Db.toFixed(3)} dB` },
    { name: 'Margin', value: `${budget.margin.toFixed(3)} dB` },
    { name: 'Range at zero margin', value: `${budget.range.toFixed(0)} m` },
  ]
  return (
    <table className="budget">
      <caption>Every row is arithmetic on the row above it</caption>
      <tbody>
        {rows.map((r) => (
          <tr key={r.name}>
            <th scope="row">{r.name}</th>
            <td>{r.value}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
