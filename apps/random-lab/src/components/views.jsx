import React from 'react'
import { useCanvas, COLORS, plotArea, drawFrame, fmtNum, fmtHz, fmt } from '@ee-labs/ui'
import { fmtInt } from '../format.js'
import { frameTicks, tickStep, tickLabel } from '../axis.js'

// The views other than the ensemble, which has its own file because it is a new
// canvas the suite will promote.
//
// One rule governs all of them, and it is this lab's own. Anything computed
// from data is drawn with its interval: a whisker on a histogram bar, a ribbon
// on a density, a bracket on a counted rate. A closed form is drawn as a bare
// curve. A reader can therefore tell the two apart without reading a caption.

const frameOpts = (xTitle, yTitle, extra = {}) => ({ xTitle, yTitle, zeroLine: true, ...extra })

function Empty({ ctx, w, h, text }) {
  ctx.fillStyle = COLORS.text
  ctx.font = '13px ui-monospace, monospace'
  ctx.textAlign = 'center'
  ctx.fillText(text, w / 2, h / 2)
}

/** One realisation in time, so a reader sees what a realisation is. */
export function ScopeCanvas({ data, label = 'Value', units = '', height = 260 }) {
  const ref = useCanvas(
    (ctx, w, h) => {
      ctx.fillStyle = COLORS.bg
      ctx.fillRect(0, 0, w, h)
      if (!data || data.length === 0) return Empty({ ctx, w, h, text: 'No samples' })
      const n = Math.min(data.length, 2048)
      let lo = Infinity
      let hi = -Infinity
      for (let i = 0; i < n; i++) {
        if (data[i] < lo) lo = data[i]
        if (data[i] > hi) hi = data[i]
      }
      const pad = (hi - lo) * 0.1 || 1
      lo -= pad
      hi += pad
      const area = plotArea(w, h)
      const t = frameTicks(area, 0, n - 1, lo, hi)
      drawFrame(ctx, area, 0, n - 1, lo, hi, t.fmtX, t.fmtY,
        frameOpts('Sample', `${label}${units ? ` (${units})` : ''}`, { xStep: t.xStep, yStep: t.yStep }))
      ctx.strokeStyle = COLORS.trace
      ctx.lineWidth = 1
      ctx.beginPath()
      for (let i = 0; i < n; i++) {
        const px = area.x + (i / (n - 1)) * area.w
        const py = area.y + area.h - ((data[i] - lo) / (hi - lo)) * area.h
        if (i === 0) ctx.moveTo(px, py)
        else ctx.lineTo(px, py)
      }
      ctx.stroke()
    },
    [data, label, units],
  )
  return <canvas ref={ref} className="canvas" style={{ width: '100%', height }} role="img" aria-label="One realisation against sample index" />
}

/**
 * The histogram, with the true density over it and a whisker on every bar.
 * The whisker is the point: a bar is an estimate, and its gap to the curve is
 * expected rather than a defect.
 */
export function HistogramCanvas({ hist, height = 300 }) {
  const ref = useCanvas(
    (ctx, w, h) => {
      ctx.fillStyle = COLORS.bg
      ctx.fillRect(0, 0, w, h)
      if (!hist) return Empty({ ctx, w, h, text: 'No histogram' })
      const bins = hist.centres.length
      let hi = 0
      for (let k = 0; k < bins; k++) {
        hi = Math.max(hi, hist.ci[k][1], hist.truth.pdf(hist.centres[k]))
      }
      hi *= 1.12
      const area = plotArea(w, h, { topInset: 18 })
      const sx = (v) => area.x + ((v - hist.lo) / (hist.hi - hist.lo)) * area.w
      const sy = (v) => area.y + area.h - (v / hi) * area.h
      const t = frameTicks(area, hist.lo, hist.hi, 0, hi)
      drawFrame(ctx, area, hist.lo, hist.hi, 0, hi, t.fmtX, t.fmtY,
        frameOpts('Value', 'Density (1/value)', { xStep: t.xStep, yStep: t.yStep }))

      const bw = area.w / bins
      for (let k = 0; k < bins; k++) {
        const x0 = sx(hist.edges[k])
        ctx.fillStyle = 'rgba(56, 224, 176, 0.30)'
        ctx.fillRect(x0 + 1, sy(hist.density[k]), Math.max(1, bw - 2), area.y + area.h - sy(hist.density[k]))
        // The interval on this bar. Drawn narrower than the bar so it reads as
        // a mark on it rather than as a second bar beside it.
        const cx = x0 + bw / 2
        ctx.strokeStyle = COLORS.textBright
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.moveTo(cx, sy(hist.ci[k][0]))
        ctx.lineTo(cx, sy(hist.ci[k][1]))
        ctx.moveTo(cx - 2, sy(hist.ci[k][0]))
        ctx.lineTo(cx + 2, sy(hist.ci[k][0]))
        ctx.moveTo(cx - 2, sy(hist.ci[k][1]))
        ctx.lineTo(cx + 2, sy(hist.ci[k][1]))
        ctx.stroke()
      }

      ctx.strokeStyle = COLORS.spectrum
      ctx.lineWidth = 2
      ctx.beginPath()
      for (let i = 0; i <= 240; i++) {
        const v = hist.lo + ((hist.hi - hist.lo) * i) / 240
        const px = sx(v)
        const py = sy(hist.truth.pdf(v))
        if (i === 0) ctx.moveTo(px, py)
        else ctx.lineTo(px, py)
      }
      ctx.stroke()

      ctx.font = `${Math.round(11 * area.k)}px ui-monospace, monospace`
      ctx.fillStyle = COLORS.text
      ctx.textAlign = 'left'
      ctx.fillText(
        `${hist.n} draws, ${bins} bins of ${fmtNum(hist.width, 3)} · bars are estimates with ${(hist.level * 100).toFixed(0)} % intervals`,
        area.x,
        area.y - 6 * area.k,
      )
      if (hist.outside > 0) {
        ctx.textAlign = 'right'
        ctx.fillText(`${hist.outside} outside the range`, area.x + area.w, area.y - 6 * area.k)
      }
    },
    [hist],
  )
  return <canvas ref={ref} className="canvas" style={{ width: '100%', height }} role="img" aria-label="Histogram against the density it estimates" />
}

/** The autocorrelation against lag, with the 1/e crossing marked. */
export function CorrelationCanvas({ acf, height = 280 }) {
  const ref = useCanvas(
    (ctx, w, h) => {
      ctx.fillStyle = COLORS.bg
      ctx.fillRect(0, 0, w, h)
      if (!acf) return Empty({ ctx, w, h, text: 'No correlation' })
      const available = acf.normalised.length - 1
      const maxLag = Math.min(available, 120)
      const area = plotArea(w, h, { topInset: 18 })
      const sx = (v) => area.x + (v / maxLag) * area.w
      const sy = (v) => area.y + area.h - ((v + 0.3) / 1.4) * area.h
      const t = frameTicks(area, 0, maxLag, -0.3, 1.1)
      drawFrame(ctx, area, 0, maxLag, -0.3, 1.1, t.fmtX, t.fmtY,
        frameOpts('Lag (samples)', 'Correlation, normalised', { xStep: t.xStep, yStep: t.yStep }))

      // The band a white record's lags stay inside, so "no correlation" has a
      // measured meaning rather than an eyeballed one.
      ctx.fillStyle = 'rgba(125, 139, 156, 0.16)'
      ctx.fillRect(area.x, sy(acf.whiteBand), area.w, sy(-acf.whiteBand) - sy(acf.whiteBand))

      ctx.strokeStyle = COLORS.trace
      ctx.lineWidth = 1.5
      ctx.beginPath()
      for (let m = 0; m <= maxLag; m++) {
        const px = sx(m)
        const py = sy(acf.normalised[m])
        if (m === 0) ctx.moveTo(px, py)
        else ctx.lineTo(px, py)
      }
      ctx.stroke()

      const e = Math.exp(-1)
      ctx.strokeStyle = COLORS.marker
      ctx.setLineDash([3, 3])
      ctx.beginPath()
      ctx.moveTo(area.x, sy(e) + 0.5)
      ctx.lineTo(area.x + area.w, sy(e) + 0.5)
      ctx.stroke()
      if (acf.lagAt1e > 0 && acf.lagAt1e <= maxLag) {
        ctx.beginPath()
        ctx.moveTo(sx(acf.lagAt1e) + 0.5, area.y)
        ctx.lineTo(sx(acf.lagAt1e) + 0.5, area.y + area.h)
        ctx.stroke()
      }
      ctx.setLineDash([])

      ctx.font = `${Math.round(11 * area.k)}px ui-monospace, monospace`
      ctx.fillStyle = COLORS.text
      ctx.textAlign = 'left'
      ctx.fillText(
        `1/e after ${acf.lagAt1e} lags · filter time constant ${fmtNum(acf.tauSamples, 3)} samples` +
          (maxLag < available ? ` · ${maxLag} of ${available} lags drawn` : ''),
        area.x,
        area.y - 6 * area.k,
      )
    },
    [acf],
  )
  return <canvas ref={ref} className="canvas" style={{ width: '100%', height }} role="img" aria-label="Autocorrelation against lag" />
}

/**
 * The averaged periodogram, with its interval as a ribbon and the closed form
 * over it. The ribbon is the guard: a floor without one has an unstated
 * precision.
 */
export function DensityCanvas({ psd, height = 320 }) {
  const ref = useCanvas(
    (ctx, w, h) => {
      ctx.fillStyle = COLORS.bg
      ctx.fillRect(0, 0, w, h)
      if (!psd) return Empty({ ctx, w, h, text: 'No density' })
      const n = psd.freqs.length
      const fMax = psd.freqs[n - 1]
      // A decibel axis, referenced to the mean of the interior bins, so the
      // ribbon and the spray are both visible whatever the absolute level is.
      const ref0 = psd.interiorMean || 1
      const db = (v) => 10 * Math.log10(Math.max(v, ref0 * 1e-6) / ref0)
      let lo = 0
      let hi = 0
      for (let k = psd.interior[0]; k <= psd.interior[1]; k++) {
        lo = Math.min(lo, db(psd.ci[k][0]))
        hi = Math.max(hi, db(psd.ci[k][1]))
        lo = Math.min(lo, db(psd.psd[k]))
        hi = Math.max(hi, db(psd.psd[k]))
      }
      lo = Math.max(lo - 2, -40)
      hi += 2
      const area = plotArea(w, h, { topInset: 18 })
      const sx = (f) => area.x + (f / fMax) * area.w
      const sy = (v) => area.y + area.h - ((v - lo) / (hi - lo)) * area.h
      const xStep = tickStep(0, fMax, Math.max(2, Math.floor(area.w / (90 * area.k))))
      const yStep = tickStep(lo, hi, Math.max(2, Math.floor(area.h / (46 * area.k))))
      drawFrame(ctx, area, 0, fMax, lo, hi, (v) => fmtHz(v), tickLabel(yStep),
        frameOpts('Frequency (Hz)', 'Density (dB, relative to the mean)', { xStep, yStep }))

      ctx.fillStyle = 'rgba(95, 168, 255, 0.18)'
      ctx.beginPath()
      for (let k = 0; k < n; k++) ctx.lineTo(sx(psd.freqs[k]), sy(db(psd.ci[k][1])))
      for (let k = n - 1; k >= 0; k--) ctx.lineTo(sx(psd.freqs[k]), sy(db(psd.ci[k][0])))
      ctx.closePath()
      ctx.fill()

      ctx.strokeStyle = COLORS.spectrum
      ctx.lineWidth = 1
      ctx.beginPath()
      for (let k = 0; k < n; k++) {
        const px = sx(psd.freqs[k])
        const py = sy(db(psd.psd[k]))
        if (k === 0) ctx.moveTo(px, py)
        else ctx.lineTo(px, py)
      }
      ctx.stroke()

      if (psd.predicted) {
        ctx.strokeStyle = COLORS.trace
        ctx.lineWidth = 2
        ctx.beginPath()
        for (let k = 0; k < n; k++) {
          const px = sx(psd.freqs[k])
          const py = sy(db(psd.predicted[k]))
          if (k === 0) ctx.moveTo(px, py)
          else ctx.lineTo(px, py)
        }
        ctx.stroke()
      }

      ctx.font = `${Math.round(11 * area.k)}px ui-monospace, monospace`
      ctx.fillStyle = COLORS.text
      ctx.textAlign = 'left'
      ctx.fillText(
        `${psd.segments} averages · ${psd.dof.toFixed(0)} degrees of freedom${psd.dofExact ? '' : ' (effective)'} · ribbon is the ${(psd.level * 100).toFixed(0)} % interval`,
        area.x,
        area.y - 6 * area.k,
      )
      ctx.textAlign = 'right'
      ctx.fillStyle = COLORS.textBright
      ctx.fillText(
        `∫ = ${fmt(psd.rmsFromIntegral, 'V', 4)} rms over 0 to ${fmtHz(fMax)}Hz`,
        area.x + area.w,
        area.y - 6 * area.k,
      )
    },
    [psd],
  )
  return <canvas ref={ref} className="canvas" style={{ width: '100%', height }} role="img" aria-label="Averaged periodogram with its confidence ribbon" />
}

/** Per-run outcomes as a histogram, with a specification band and the yield. */
export function OutcomeCanvas({ stats, band = null, count = null, height = 280 }) {
  const ref = useCanvas(
    (ctx, w, h) => {
      ctx.fillStyle = COLORS.bg
      ctx.fillRect(0, 0, w, h)
      if (!stats || stats.length === 0) return Empty({ ctx, w, h, text: 'No outcomes' })
      let lo = Infinity
      let hi = -Infinity
      for (const v of stats) {
        if (v < lo) lo = v
        if (v > hi) hi = v
      }
      if (band) {
        lo = Math.min(lo, band.lo)
        hi = Math.max(hi, band.hi)
      }
      const pad = (hi - lo) * 0.08 || 1
      lo -= pad
      hi += pad
      const bins = 40
      const width = (hi - lo) / bins
      const counts = new Float64Array(bins)
      for (const v of stats) {
        const k = Math.floor((v - lo) / width)
        if (k >= 0 && k < bins) counts[k] += 1
      }
      let top = 0
      for (const c of counts) top = Math.max(top, c)
      top *= 1.15
      const area = plotArea(w, h, { topInset: 18 })
      const sx = (v) => area.x + ((v - lo) / (hi - lo)) * area.w
      const sy = (v) => area.y + area.h - (v / top) * area.h
      if (band) {
        ctx.fillStyle = 'rgba(95, 168, 255, 0.12)'
        ctx.fillRect(sx(band.lo), area.y, sx(band.hi) - sx(band.lo), area.h)
      }
      const t = frameTicks(area, lo, hi, 0, top)
      drawFrame(ctx, area, lo, hi, 0, top, t.fmtX, t.fmtY,
        frameOpts('Outcome', 'Runs', { xStep: t.xStep, yStep: t.yStep }))
      const bw = area.w / bins
      for (let k = 0; k < bins; k++) {
        ctx.fillStyle = 'rgba(56, 224, 176, 0.35)'
        ctx.fillRect(sx(lo + k * width) + 1, sy(counts[k]), Math.max(1, bw - 2), area.y + area.h - sy(counts[k]))
      }
      ctx.font = `${Math.round(11 * area.k)}px ui-monospace, monospace`
      ctx.fillStyle = COLORS.text
      ctx.textAlign = 'left'
      ctx.fillText(`${stats.length} runs, one outcome each`, area.x, area.y - 6 * area.k)
      if (count) {
        ctx.textAlign = 'right'
        ctx.fillStyle = COLORS.textBright
        ctx.fillText(
          `${count.pass} of ${count.n} in ${band && band.label ? band.label : 'band'}  ` +
            `${((100 * count.pass) / count.n).toFixed(1)} % ± ${(100 * count.stderr).toFixed(1)}`,
          area.x + area.w,
          area.y - 6 * area.k,
        )
      }
    },
    [stats, band, count],
  )
  return <canvas ref={ref} className="canvas" style={{ width: '100%', height }} role="img" aria-label="Per-run outcomes with the specification band" />
}

/** The matched filter's output, with the peak marked. */
export function MatchedCanvas({ snr, height = 260 }) {
  const ref = useCanvas(
    (ctx, w, h) => {
      ctx.fillStyle = COLORS.bg
      ctx.fillRect(0, 0, w, h)
      if (!snr) return Empty({ ctx, w, h, text: 'No filter output' })
      const y = snr.output
      let lo = 0
      let hi = 0
      for (const v of y) {
        lo = Math.min(lo, v)
        hi = Math.max(hi, v)
      }
      const pad = (hi - lo) * 0.12 || 1
      const area = plotArea(w, h, { topInset: 18 })
      const sx = (i) => area.x + (i / (y.length - 1)) * area.w
      const sy = (v) => area.y + area.h - ((v - lo + pad) / (hi - lo + 2 * pad)) * area.h
      const t = frameTicks(area, 0, y.length - 1, lo - pad, hi + pad)
      drawFrame(ctx, area, 0, y.length - 1, lo - pad, hi + pad, t.fmtX, t.fmtY,
        frameOpts('Lag (samples)', 'Correlator output', { xStep: t.xStep, yStep: t.yStep }))
      ctx.strokeStyle = COLORS.trace
      ctx.lineWidth = 1.5
      ctx.beginPath()
      for (let i = 0; i < y.length; i++) {
        const px = sx(i)
        const py = sy(y[i])
        if (i === 0) ctx.moveTo(px, py)
        else ctx.lineTo(px, py)
      }
      ctx.stroke()
      ctx.strokeStyle = COLORS.marker
      ctx.setLineDash([3, 3])
      ctx.beginPath()
      ctx.moveTo(sx(snr.peakAt) + 0.5, area.y)
      ctx.lineTo(sx(snr.peakAt) + 0.5, area.y + area.h)
      ctx.stroke()
      ctx.setLineDash([])
      ctx.font = `${Math.round(11 * area.k)}px ui-monospace, monospace`
      ctx.fillStyle = COLORS.text
      ctx.textAlign = 'left'
      ctx.fillText(
        `peak ${fmtNum(snr.peak, 3)} at sample ${snr.peakAt} · ratio ${fmtNum(snr.snrDb, 2)} dB`,
        area.x,
        area.y - 6 * area.k,
      )
    },
    [snr],
  )
  return <canvas ref={ref} className="canvas" style={{ width: '100%', height }} role="img" aria-label="Matched filter output against lag" />
}

/** The error rate against Eb/N0, with the counted point and its interval. */
export function ErrorRateCanvas({ ber, height = 300 }) {
  const ref = useCanvas(
    (ctx, w, h) => {
      ctx.fillStyle = COLORS.bg
      ctx.fillRect(0, 0, w, h)
      if (!ber) return Empty({ ctx, w, h, text: 'No error rate' })
      const loDb = 0
      const hiDb = 13
      const loLog = -9
      const hiLog = 0
      const area = plotArea(w, h, { topInset: 18 })
      const sx = (db) => area.x + ((db - loDb) / (hiDb - loDb)) * area.w
      const sy = (p) => {
        const l = Math.log10(Math.max(p, 1e-10))
        return area.y + area.h - ((l - loLog) / (hiLog - loLog)) * area.h
      }
      const xStep = tickStep(loDb, hiDb, Math.max(2, Math.floor(area.w / (90 * area.k))))
      drawFrame(ctx, area, loDb, hiDb, loLog, hiLog, tickLabel(xStep), (v) => `1e${fmtInt(v)}`,
        { xTitle: 'Eb/N0 (dB)', yTitle: 'Error rate', yStep: 1, xStep })

      const curve = (key, style, width) => {
        ctx.strokeStyle = style
        ctx.lineWidth = width
        ctx.beginPath()
        let started = false
        for (const pt of ber.curve) {
          if (pt[key] < 1e-10) break
          const px = sx(pt.db)
          const py = sy(pt[key])
          if (!started) {
            ctx.moveTo(px, py)
            started = true
          } else ctx.lineTo(px, py)
        }
        ctx.stroke()
      }
      curve('orthogonal', COLORS.phase, 1.5)
      curve('antipodal', COLORS.trace, 2)

      // The counted point, with its interval as a bracket. At zero errors the
      // point sits at the floor and the bracket still has a top, which is the
      // whole reason this view exists.
      const db = ber.ebN0Db
      ctx.strokeStyle = COLORS.marker
      ctx.lineWidth = 2
      const top = sy(ber.measured.ci[1])
      const bottom = sy(Math.max(ber.measured.ci[0], 1e-10))
      ctx.beginPath()
      ctx.moveTo(sx(db), top)
      ctx.lineTo(sx(db), bottom)
      ctx.moveTo(sx(db) - 5, top)
      ctx.lineTo(sx(db) + 5, top)
      ctx.moveTo(sx(db) - 5, bottom)
      ctx.lineTo(sx(db) + 5, bottom)
      ctx.stroke()
      if (ber.measured.value > 0) {
        ctx.fillStyle = COLORS.marker
        ctx.beginPath()
        ctx.arc(sx(db), sy(ber.measured.value), 3, 0, 2 * Math.PI)
        ctx.fill()
      }

      ctx.font = `${Math.round(11 * area.k)}px ui-monospace, monospace`
      ctx.fillStyle = COLORS.text
      ctx.textAlign = 'left'
      ctx.fillText(
        `${ber.errors} errors in ${ber.symbols} symbols · closed form ${ber.predicted.toExponential(3)}`,
        area.x,
        area.y - 6 * area.k,
      )
    },
    [ber],
  )
  return <canvas ref={ref} className="canvas" style={{ width: '100%', height }} role="img" aria-label="Error rate against Eb over N0" />
}

/** The Kalman run: the truth, the measurements and the estimate. */
export function KalmanCanvas({ kalman, height = 280 }) {
  const ref = useCanvas(
    (ctx, w, h) => {
      ctx.fillStyle = COLORS.bg
      ctx.fillRect(0, 0, w, h)
      if (!kalman) return Empty({ ctx, w, h, text: 'No filter run' })
      const n = kalman.x.length
      let lo = Infinity
      let hi = -Infinity
      for (let i = 0; i < n; i++) {
        for (const v of [kalman.truth[i], kalman.z[i]]) {
          if (v < lo) lo = v
          if (v > hi) hi = v
        }
      }
      const pad = (hi - lo) * 0.1 || 1
      lo -= pad
      hi += pad
      const area = plotArea(w, h, { topInset: 18 })
      const sx = (i) => area.x + (i / (n - 1)) * area.w
      const sy = (v) => area.y + area.h - ((v - lo) / (hi - lo)) * area.h
      const t = frameTicks(area, 0, n - 1, lo, hi)
      drawFrame(ctx, area, 0, n - 1, lo, hi, t.fmtX, t.fmtY,
        frameOpts('Step', 'State', { xStep: t.xStep, yStep: t.yStep }))
      const line = (arr, style, width, dash) => {
        ctx.strokeStyle = style
        ctx.lineWidth = width
        ctx.setLineDash(dash || [])
        ctx.beginPath()
        for (let i = 0; i < n; i++) {
          const px = sx(i)
          const py = sy(arr[i])
          if (i === 0) ctx.moveTo(px, py)
          else ctx.lineTo(px, py)
        }
        ctx.stroke()
        ctx.setLineDash([])
      }
      line(kalman.z, COLORS.traceDim, 1)
      line(kalman.truth, COLORS.spectrum, 1.5, [4, 3])
      line(kalman.x, COLORS.trace, 2)
      ctx.font = `${Math.round(11 * area.k)}px ui-monospace, monospace`
      ctx.fillStyle = COLORS.text
      ctx.textAlign = 'left'
      ctx.fillText(
        `measurements faint · truth dashed · estimate solid · gain settles at step ${kalman.settledAt}`,
        area.x,
        area.y - 6 * area.k,
      )
    },
    [kalman],
  )
  return <canvas ref={ref} className="canvas" style={{ width: '100%', height }} role="img" aria-label="Kalman filter estimate against the truth" />
}
