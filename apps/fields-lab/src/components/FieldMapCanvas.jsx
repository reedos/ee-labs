import React from 'react'
import { useCanvas } from '@ee-labs/ui'
import { eng, niceStep } from '@ee-labs/ui'

/**
 * The field map. The one new canvas this lab builds, named in `PROGRAM.md` §4
 * and specified in `/FIELDS_LAB_PLAN.md` §4.2. It draws a scalar or a vector
 * field over a two-dimensional geometry (`mode: '2d'`), or one cut through it
 * against a spatial axis (`mode: 'profile'`).
 *
 * The profile mode is not this lab's convenience. It is the Devices Lab's
 * requirement, stated in `AGENT_BRIEF.md` §3.9 and carried in these props from
 * the first commit: a scalar against one axis, with region boundaries marked,
 * an optional second scalar on a right axis, and a `stack` of such panels that
 * share one position axis so a bias knob moves all of them together.
 *
 * Every helper a test can call without a browser (`domainTicks`, `sampleGrid`,
 * `colourFor`) is exported, so the contract can be checked without asking a
 * canvas to paint.
 */

// ---------------------------------------------------------------- colour

/** A diverging ramp, blue through the panel colour to amber, for a field with a sign. */
export function divergingColour(t) {
  // t in [-1, 1]. 0 is the neutral panel shade.
  const clamped = Math.max(-1, Math.min(1, t))
  if (clamped >= 0) return mix([22, 30, 42], [240, 162, 60], clamped)
  return mix([22, 30, 42], [95, 168, 255], -clamped)
}

/** A sequential ramp, panel through to the accent, for a field with no sign (a magnitude). */
export function sequentialColour(t) {
  const clamped = Math.max(0, Math.min(1, t))
  return mix([17, 23, 33], [56, 224, 176], clamped)
}

function mix(a, b, t) {
  const r = Math.round(a[0] + (b[0] - a[0]) * t)
  const g = Math.round(a[1] + (b[1] - a[1]) * t)
  const bl = Math.round(a[2] + (b[2] - a[2]) * t)
  return `rgb(${r},${g},${bl})`
}

/** The colour for one sample, given the largest magnitude on screen. `hasSign` picks the ramp. */
export function colourFor(value, scale, hasSign) {
  if (!Number.isFinite(value) || scale <= 0) return 'rgb(17,23,33)'
  return hasSign ? divergingColour(value / scale) : sequentialColour(Math.abs(value) / scale)
}

// ---------------------------------------------------------------- sampling

/** A `steps` by `steps` grid of `fn(x, y)` over the domain, and the largest finite magnitude found. */
export function sampleGrid(fn, domain, steps = 48) {
  const { width, height, centre } = domain
  const x0 = centre ? -width / 2 : 0
  const y0 = centre ? -height / 2 : 0
  const rows = []
  let scale = 0
  for (let j = 0; j < steps; j++) {
    const y = y0 + (height * (j + 0.5)) / steps
    const row = []
    for (let i = 0; i < steps; i++) {
      const x = x0 + (width * (i + 0.5)) / steps
      let v
      try {
        v = fn(x, y)
      } catch {
        v = NaN
      }
      if (Number.isFinite(v)) scale = Math.max(scale, Math.abs(v))
      row.push(v)
    }
    rows.push(row)
  }
  return { rows, scale, x0, y0 }
}

// ---------------------------------------------------------------- axis ticks

/** Round ticks across [lo, hi], for the shared position axis a profile stack draws once. */
export function domainTicks(lo, hi, target = 5) {
  return ticksBetween(lo, hi, target, 10)
}

/**
 * Round ticks from `lo` to `hi`, and the guard that keeps the loop finite.
 *
 * A step small enough against the offset that `v + step === v` never advances,
 * and the loop pushes until the array will not hold another element. That is
 * how a one-ulp span between two numbers a lesson calls equal took the whole
 * page down. The cap is the second line of defence behind the callers, which
 * do not hand a degenerate span in the first place.
 */
function ticksBetween(lo, hi, target, figures) {
  if (!Number.isFinite(lo) || !Number.isFinite(hi) || !(hi > lo)) return [lo]
  const step = niceStep(hi - lo, target)
  if (!(step > 0)) return [lo, hi]
  const start = Math.ceil(lo / step) * step
  if (start + step === start) return [lo, hi]
  const ticks = []
  for (let v = start; v <= hi + step * 1e-6 && ticks.length < 64; v += step) ticks.push(Number(v.toPrecision(figures)))
  return ticks
}

/**
 * The range one curve covers over the axis, and the range its panel draws.
 *
 * Both the curve and the ticks read this, so a number under a tick is the
 * number the curve is at. Zero is included whenever the data straddles it or
 * sits near it, because a field that falls to nothing reads wrong against a
 * floating baseline.
 */
export function rangeOf(read, lo, hi, { log = false, samples = 160 } = {}) {
  const values = []
  for (let i = 0; i <= samples; i++) {
    const t = positionAt(i / samples, lo, hi, log)
    let v
    try {
      v = read(t)
    } catch {
      v = NaN
    }
    if (Number.isFinite(v)) values.push(v)
  }
  if (!values.length) return { min: 0, max: 1, empty: true }
  let min = Math.min(...values)
  let max = Math.max(...values)
  if (min > 0 && min < max * 0.6) min = 0
  if (max < 0 && max > min * 0.6) max = 0
  // G1's two currents are equal to the last digit, and "equal to the last
  // digit" is not exactly equal: they differ by one unit in the last place.
  // A span that small is the arithmetic and not the physics, so the panel is
  // drawn as the flat line it is rather than magnifying a rounding error into
  // a full-height feature.
  if (max - min <= 1e-9 * Math.max(Math.abs(min), Math.abs(max))) {
    const mid = (min + max) / 2
    const pad = Math.abs(mid) || 1
    min = mid - pad / 2
    max = mid + pad / 2
  }
  return { min, max, empty: false }
}

/** Where a fraction of the way along the axis falls, linear or by decade. */
export function positionAt(f, lo, hi, log) {
  if (!log || !(lo > 0) || !(hi > 0)) return lo + (hi - lo) * f
  return lo * Math.pow(hi / lo, f)
}

/** The fraction of the way along the axis a value sits at, linear or by decade. */
export function fractionAt(t, lo, hi, log) {
  if (!log || !(lo > 0) || !(hi > 0)) return (t - lo) / (hi - lo)
  return Math.log(t / lo) / Math.log(hi / lo)
}

/** Round ticks up the value axis, and the range they belong to. */
export function valueTicks(min, max, target = 4) {
  return ticksBetween(min, max, target, 12)
}

/** One decade tick per power of ten inside a logarithmic span. */
export function decadeTicks(lo, hi) {
  if (!(lo > 0) || !(hi > lo)) return [lo, hi]
  const ticks = []
  for (let e = Math.ceil(Math.log10(lo)); Math.pow(10, e) <= hi * (1 + 1e-9); e++) ticks.push(Math.pow(10, e))
  if (ticks.length < 2) return [lo, hi]
  return ticks
}

/**
 * The shared x-axis domain for a profile: the span the profile states, and the
 * regions' span only where it states none.
 *
 * The precedence used to run the other way, and it cut two lessons off at the
 * knees. E3's solenoid names a span of two winding lengths so the field outside
 * the coil is on screen, which is the whole lesson, and its one region is the
 * winding: reading the region first drew only the inside. F3's lamination is
 * the same shape. A region marks a boundary inside the view. It does not decide
 * where the view stops.
 */
export function axisDomainOf(profile) {
  if (Number.isFinite(profile.from) && Number.isFinite(profile.to) && profile.to > profile.from) {
    return { lo: profile.from, hi: profile.to }
  }
  const regions = profile.regions || (profile.stack && profile.stack[0] && profile.stack[0].regions) || []
  if (regions.length) {
    return { lo: Math.min(...regions.map((r) => r.from)), hi: Math.max(...regions.map((r) => r.to)) }
  }
  return { lo: profile.from ?? 0, hi: profile.to ?? 1 }
}

// ---------------------------------------------------------------- component

const fmtLen = (v) => {
  const av = Math.abs(v)
  if (av === 0) return '0'
  if (av < 1e-3) return `${(v * 1e6).toPrecision(3)} µm`
  if (av < 1) return `${(v * 1e3).toPrecision(3)} mm`
  return `${v.toPrecision(3)} m`
}

/** A bare axis number with its engineering prefix. The unit is on the axis, not on every tick. */
export const fmtValue = (v) => {
  if (!Number.isFinite(v)) return ''
  if (v === 0) return '0'
  const e = eng(v, 3)
  return `${e.num}${e.prefix}`
}

/** An axis number in a unit that is not metres: 1 kHz, 45°, 2.5 mm². The prefix belongs to the unit. */
export const fmtQuantity = (v, unit) => {
  if (!Number.isFinite(v)) return ''
  if (v === 0) return '0'
  const e = eng(v, 3)
  return `${e.num} ${e.prefix}${unit}`.trim()
}

/**
 * The rectangle a domain draws in, inside a canvas of `w` by `h`.
 *
 * The map used to stretch the domain to the canvas, which drew a coaxial cable
 * as an ellipse and a square trough as a wide rectangle. A field map is a
 * picture of a geometry, so the geometry keeps its shape and the spare width
 * becomes margin, which is also where the position axes go.
 */
export function fitBox(w, h, domain, margin = { left: 44, right: 8, top: 8, bottom: 22 }) {
  const availW = Math.max(1, w - margin.left - margin.right)
  const availH = Math.max(1, h - margin.top - margin.bottom)
  const aspect = domain.width / domain.height
  let bw = availW
  let bh = bw / aspect
  if (bh > availH) {
    bh = availH
    bw = bh * aspect
  }
  return { x: margin.left + (availW - bw) / 2, y: margin.top + (availH - bh) / 2, w: bw, h: bh }
}

export default function FieldMapCanvas({ mode = '2d', domain, scalar, vector, equipotentials = [], conductors = [], charges = [], probe = null, units = {}, profile = null }) {
  if (mode === 'profile' && profile) return <ProfilePane profile={profile} units={units} />
  return (
    <MapPane domain={domain || { width: 1, height: 1 }} scalar={scalar} vector={vector} equipotentials={equipotentials} conductors={conductors} charges={charges} probe={probe} units={units} />
  )
}

function MapPane({ domain, scalar, vector, equipotentials, conductors, charges, probe, units }) {
  const grid = React.useMemo(() => (scalar ? sampleGrid(scalar, domain, 56) : null), [scalar, domain])
  const hasSign = grid ? grid.rows.some((row) => row.some((v) => Number.isFinite(v) && v < 0)) : false
  const ref = useCanvas(
    (ctx, w, h) => {
      ctx.fillStyle = '#0b0f14'
      ctx.fillRect(0, 0, w, h)
      const { width, height, centre } = domain
      const x0 = centre ? -width / 2 : 0
      const y0 = centre ? -height / 2 : 0
      const box = fitBox(w, h, domain)
      const toPx = (x, y) => [box.x + ((x - x0) / width) * box.w, box.y + box.h - ((y - y0) / height) * box.h]

      ctx.save()
      ctx.beginPath()
      ctx.rect(box.x, box.y, box.w, box.h)
      ctx.clip()

      if (grid) {
        const steps = grid.rows.length
        const cw = box.w / steps
        const ch = box.h / steps
        for (let j = 0; j < steps; j++) {
          for (let i = 0; i < steps; i++) {
            const v = grid.rows[j][i]
            ctx.fillStyle = colourFor(v, grid.scale, hasSign)
            ctx.fillRect(box.x + i * cw, box.y + box.h - (j + 1) * ch, cw + 1, ch + 1)
          }
        }
      }

      if (vector) {
        const arrows = 12
        for (let j = 0; j < arrows; j++) {
          for (let i = 0; i < arrows; i++) {
            const x = x0 + (domain.width * (i + 0.5)) / arrows
            const y = y0 + (domain.height * (j + 0.5)) / arrows
            let v
            try {
              v = vector(x, y)
            } catch {
              v = null
            }
            if (!v || !Number.isFinite(v[0]) || !Number.isFinite(v[1])) continue
            const mag = Math.hypot(v[0], v[1])
            if (mag <= 0) continue
            const len = Math.min(box.w, box.h) / arrows / 2.4
            const ux = v[0] / mag
            const uy = v[1] / mag
            const [px, py] = toPx(x, y)
            // The tail, then the head: a bare segment says which line the field
            // runs along and not which way along it the field points.
            const tx = px - (ux * len) / 2
            const ty = py + (uy * len) / 2
            const hx = px + (ux * len) / 2
            const hy = py - (uy * len) / 2
            ctx.strokeStyle = 'rgba(201,214,228,0.55)'
            ctx.lineWidth = 1
            ctx.beginPath()
            ctx.moveTo(tx, ty)
            ctx.lineTo(hx, hy)
            ctx.stroke()
            const barb = Math.max(2.5, len / 3)
            ctx.beginPath()
            ctx.moveTo(hx, hy)
            ctx.lineTo(hx - barb * (ux * 0.87 - -uy * 0.5), hy + barb * (uy * 0.87 - ux * 0.5))
            ctx.moveTo(hx, hy)
            ctx.lineTo(hx - barb * (ux * 0.87 + -uy * 0.5), hy + barb * (uy * 0.87 + ux * 0.5))
            ctx.stroke()
          }
        }
      }

      for (const eq of equipotentials || []) {
        if (!eq.points || eq.points.length < 2) continue
        ctx.strokeStyle = 'rgba(240,162,60,0.85)'
        ctx.lineWidth = 1.25
        ctx.beginPath()
        eq.points.forEach(([x, y], k) => {
          const [px, py] = toPx(x, y)
          if (k === 0) ctx.moveTo(px, py)
          else ctx.lineTo(px, py)
        })
        ctx.stroke()
      }

      for (const c of conductors || []) {
        if (!c.path || c.path.length < 2) continue
        ctx.fillStyle = 'rgba(122,140,158,0.35)'
        ctx.strokeStyle = '#c9d6e4'
        ctx.lineWidth = 1.5
        ctx.beginPath()
        c.path.forEach(([x, y], k) => {
          const [px, py] = toPx(x, y)
          if (k === 0) ctx.moveTo(px, py)
          else ctx.lineTo(px, py)
        })
        ctx.closePath()
        ctx.fill()
        ctx.stroke()
      }

      for (const q of charges || []) {
        const [px, py] = toPx(q.at[0], q.at[1])
        ctx.fillStyle = q.q >= 0 ? '#f0a23c' : '#5fa8ff'
        ctx.beginPath()
        ctx.arc(px, py, 4, 0, 2 * Math.PI)
        ctx.fill()
      }

      if (probe) {
        const [px, py] = toPx(probe.x, probe.y)
        ctx.strokeStyle = '#ff5c7a'
        ctx.lineWidth = 1.5
        ctx.beginPath()
        ctx.moveTo(px - 6, py)
        ctx.lineTo(px + 6, py)
        ctx.moveTo(px, py - 6)
        ctx.lineTo(px, py + 6)
        ctx.stroke()
      }
      ctx.restore()

      // The two position axes. Without them a reader cannot say how far apart
      // two charges are, or how wide the trough is, which is half of what a
      // field map is for.
      ctx.strokeStyle = 'rgba(122,140,158,0.5)'
      ctx.lineWidth = 1
      ctx.strokeRect(box.x, box.y, box.w, box.h)
      ctx.fillStyle = 'rgba(154,170,188,0.95)'
      ctx.font = '10px ui-monospace, SFMono-Regular, Menlo, monospace'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'top'
      for (const t of domainTicks(x0, x0 + width, 4)) {
        const px = box.x + ((t - x0) / width) * box.w
        ctx.beginPath()
        ctx.moveTo(px, box.y + box.h)
        ctx.lineTo(px, box.y + box.h + 3)
        ctx.stroke()
        ctx.fillText(fmtLen(t), Math.min(Math.max(px, box.x + 16), box.x + box.w - 16), box.y + box.h + 5)
      }
      ctx.textAlign = 'right'
      ctx.textBaseline = 'middle'
      for (const t of domainTicks(y0, y0 + height, 4)) {
        const py = box.y + box.h - ((t - y0) / height) * box.h
        ctx.beginPath()
        ctx.moveTo(box.x - 3, py)
        ctx.lineTo(box.x, py)
        ctx.stroke()
        ctx.fillText(fmtLen(t), box.x - 5, Math.min(Math.max(py, box.y + 6), box.y + box.h - 6))
      }
    },
    [domain, scalar, vector, JSON.stringify(equipotentials), JSON.stringify(conductors), JSON.stringify(charges), probe],
  )

  const scaleUnit = units.scalar || 'V'
  return (
    <div className="fieldmap" data-mode="2d">
      <canvas ref={ref} className="fieldmap-canvas" />
      <div className="fieldmap-legend" data-role="fieldmap-legend">
        {conductors.map((c, i) => (
          <span key={i} className="fieldmap-chip">
            {Number.isFinite(c.potential) ? `${c.potential.toPrecision(3)} ${scaleUnit}` : ''}
          </span>
        ))}
        {grid && grid.scale > 0 ? (
          <span className="fieldmap-chip fieldmap-scale" data-role="colour-scale">
            {hasSign ? `−${fmtValue(grid.scale)}` : '0'} to {fmtValue(grid.scale)} {scaleUnit}
          </span>
        ) : null}
        {vector ? <span className="fieldmap-chip fieldmap-unit">arrows: direction only</span> : null}
      </div>
      <p className="fieldmap-axes" data-role="map-axes">
        Across and up in metres. Colour is {scaleUnit === 'V' ? 'potential' : 'the field'} in {scaleUnit}.
      </p>
    </div>
  )
}

/**
 * One profile panel's curve.
 *
 * The panel's own value range is computed outside the canvas and handed in, so
 * the numbers up the left edge belong to the curve beside them. A second scalar
 * is drawn to its OWN range against the right edge, which is the only way two
 * quantities in different units share one panel: the head names both, each edge
 * carries its own numbers, and the sentence under the panel says out loud that
 * the two are not on one scale.
 */
function ProfileCurve({ axis, cut, scalar, secondary, lo, hi, log, range, range2 }) {
  const ref = useCanvas(
    (ctx, w, h) => {
      ctx.fillStyle = '#0b0f14'
      ctx.fillRect(0, 0, w, h)
      const PAD = 4
      const plot = (v, r) => h - PAD - ((v - r.min) / Math.max(1e-300, r.max - r.min)) * (h - 2 * PAD)

      // The zero line, where the range crosses it: a curve that falls to
      // nothing should be seen to reach a line and not the floor of the box.
      if (range.min < 0 && range.max > 0) {
        ctx.strokeStyle = 'rgba(201,214,228,0.22)'
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.moveTo(0, plot(0, range))
        ctx.lineTo(w, plot(0, range))
        ctx.stroke()
      }

      const N = 240
      const draw = (read, r, colour, width, dash) => {
        ctx.strokeStyle = colour
        ctx.lineWidth = width
        ctx.setLineDash(dash)
        ctx.beginPath()
        let last = false
        for (let i = 0; i <= N; i++) {
          const t = positionAt(i / N, lo, hi, log)
          let v
          try {
            v = read(t)
          } catch {
            v = NaN
          }
          if (!Number.isFinite(v)) {
            last = false
            continue
          }
          const px = (w * i) / N
          const py = plot(v, r)
          if (!last) ctx.moveTo(px, py)
          else ctx.lineTo(px, py)
          last = true
        }
        ctx.stroke()
        ctx.setLineDash([])
      }

      // The second curve is drawn first and heavier, the first over it and
      // dashed: in a lossless medium E and H are in step to the last digit, and
      // one drawn straight over the other showed a reader one curve where the
      // lesson claims two.
      if (secondary && range2) draw(secondary.read, range2, '#f0a23c', 2.5, [])
      draw(scalar.read, range, '#38e0b0', 1.5, secondary ? [5, 4] : [])
    },
    [axis, cut, lo, hi, log, scalar, secondary, range.min, range.max, range2 && range2.min, range2 && range2.max],
  )
  return <canvas ref={ref} className="fieldmap-profile-canvas" />
}

function RegionMarks({ regions, lo, hi, log }) {
  if (!regions || !regions.length) return null
  return (
    <div className="fieldmap-regions" aria-hidden="true">
      {regions.map((r, i) => {
        const from = fractionAt(Math.max(r.from, lo), lo, hi, log)
        const to = fractionAt(Math.min(r.to, hi), lo, hi, log)
        // A zero-width region is a line, not a band: it is how a depletion
        // edge, or the one lamination a sweep is about, marks its own place.
        if (!(to >= from)) return null
        return (
          <span
            key={i}
            className={`fieldmap-region${r.edge ? ' is-edge' : ''}`}
            style={{ left: `${100 * from}%`, width: `${100 * (to - from)}%` }}
            title={r.label}
          />
        )
      })}
    </div>
  )
}

/** The numbers up one edge of a panel, and the curve they belong to. */
function ValueAxis({ range, unit, side, colour }) {
  const ticks = valueTicks(range.min, range.max)
  const span = Math.max(1e-300, range.max - range.min)
  return (
    <div className={`fieldmap-vaxis is-${side}`} data-role={`value-axis-${side}`} data-unit={unit || ''}>
      {ticks.map((v, i) => {
        const f = (v - range.min) / span
        const edge = f > 0.92 ? ' is-top' : f < 0.08 ? ' is-bottom' : ''
        return (
          <span key={i} className={`fieldmap-vtick${edge}`} data-value={v} style={{ bottom: `${100 * f}%`, color: colour }}>
            {fmtValue(v)}
          </span>
        )
      })}
    </div>
  )
}

function AxisTicks({ ticks, lo, hi, log, labelled = false, format = fmtLen }) {
  const last = ticks.length - 1
  return (
    <div className="fieldmap-ticks" data-role="axis-ticks" data-labelled={labelled}>
      {ticks.map((t, i) => {
        const f = fractionAt(t, lo, hi, log)
        // A label centred on the last tick hangs off the right edge and the
        // pane clips it, so the two end labels hang inward instead.
        const align = i === 0 ? ' is-first' : i === last ? ' is-last' : ''
        return (
          <span key={i} className={`fieldmap-tick${align}`} data-testid="axis-tick" data-value={t} style={{ left: `${100 * f}%` }}>
            {labelled ? format(t) : ''}
          </span>
        )
      })}
    </div>
  )
}

function ProfilePane({ profile, units }) {
  const panels = profile.stack && profile.stack.length ? profile.stack : [profile]
  const { lo, hi } = axisDomainOf(profile)
  const log = Boolean(profile.log) && lo > 0 && hi > 0
  const xUnit = profile.xUnit ?? 'm'
  const format = xUnit === 'm' ? fmtLen : (v) => fmtQuantity(v, xUnit)
  const ticks = React.useMemo(() => (log ? decadeTicks(lo, hi) : domainTicks(lo, hi)), [lo, hi, log])
  const axisName = profile.xLabel || (profile.axis === 'y' ? 'Position, up' : 'Position, across')
  return (
    <div className="fieldmap" data-mode="profile" data-panels={panels.length}>
      {panels.map((panel, i) => {
        const range = rangeOf(panel.scalar.read, lo, hi, { log })
        const range2 = panel.secondary ? rangeOf(panel.secondary.read, lo, hi, { log }) : null
        return (
          <div className="fieldmap-panel" data-role="profile-panel" key={i}>
            <div className="fieldmap-panel-head">
              <span className="fieldmap-panel-label">{panel.scalar.label}</span>
              <span className="fieldmap-panel-unit">{panel.scalar.unit}</span>
              {panel.secondary ? (
                <span className="fieldmap-panel-label is-secondary">
                  {panel.secondary.label} <em>{panel.secondary.unit}</em>
                </span>
              ) : null}
            </div>
            <div className="fieldmap-panel-row">
              <ValueAxis range={range} unit={panel.scalar.unit} side="left" colour="var(--accent)" />
              <div className="fieldmap-panel-body">
                <ProfileCurve
                  axis={profile.axis}
                  cut={profile.cut}
                  scalar={panel.scalar}
                  secondary={panel.secondary}
                  lo={lo}
                  hi={hi}
                  log={log}
                  range={range}
                  range2={range2}
                />
                <RegionMarks regions={panel.regions} lo={lo} hi={hi} log={log} />
                {/* Every panel carries the same tick positions, so a vertical line
                    through the stack lands on the same value in each one. Only the
                    bottom panel labels them, which is what keeps a stack of three
                    from repeating its axis three times. */}
                <AxisTicks ticks={ticks} lo={lo} hi={hi} log={log} labelled={false} format={format} />
              </div>
              {range2 ? <ValueAxis range={range2} unit={panel.secondary.unit} side="right" colour="var(--amber)" /> : null}
            </div>
            {range2 ? (
              <p className="fieldmap-panel-scales" data-role="panel-scales">
                Each curve has its own scale. Read {panel.scalar.label.toLowerCase()} on the left in {panel.scalar.unit || 'its own unit'}, and{' '}
                {panel.secondary.label.toLowerCase()} on the right in {panel.secondary.unit || 'its own unit'}.
              </p>
            ) : null}
            {i === panels.length - 1 ? (
              <>
                <AxisTicks ticks={ticks} lo={lo} hi={hi} log={log} labelled format={format} />
                <p className="fieldmap-axis-name" data-role="axis-name">
                  {axisName}
                  {xUnit ? ` (${xUnit})` : ''}
                  {log ? ', by decade' : ''}
                </p>
              </>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}
