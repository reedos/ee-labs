import React from 'react'
import { useCanvas } from '@ee-labs/ui'
import { niceStep } from '@ee-labs/ui'

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
  if (!(hi > lo)) return [lo]
  const step = niceStep(hi - lo, target)
  const start = Math.ceil(lo / step) * step
  const ticks = []
  for (let v = start; v <= hi + step * 1e-6; v += step) ticks.push(Number(v.toPrecision(10)))
  return ticks
}

/** The shared x-axis domain for a profile: the regions' span if given, else 0 to the cut's own reach. */
export function axisDomainOf(profile) {
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
      const toPx = (x, y) => [((x - x0) / width) * w, h - ((y - y0) / height) * h]

      if (grid) {
        const steps = grid.rows.length
        const cw = w / steps
        const ch = h / steps
        for (let j = 0; j < steps; j++) {
          for (let i = 0; i < steps; i++) {
            const v = grid.rows[j][i]
            ctx.fillStyle = colourFor(v, grid.scale, hasSign)
            ctx.fillRect(i * cw, h - (j + 1) * ch, cw + 1, ch + 1)
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
            const len = Math.min(w, h) / arrows / 2.4
            const ux = v[0] / mag
            const uy = v[1] / mag
            const [px, py] = toPx(x, y)
            ctx.strokeStyle = 'rgba(201,214,228,0.55)'
            ctx.lineWidth = 1
            ctx.beginPath()
            ctx.moveTo(px - (ux * len) / 2, py + (uy * len) / 2)
            ctx.lineTo(px + (ux * len) / 2, py - (uy * len) / 2)
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
    },
    [domain, scalar, vector, JSON.stringify(equipotentials), JSON.stringify(conductors), JSON.stringify(charges), probe],
  )

  return (
    <div className="fieldmap" data-mode="2d">
      <canvas ref={ref} className="fieldmap-canvas" />
      <div className="fieldmap-legend" data-role="fieldmap-legend">
        {conductors.map((c, i) => (
          <span key={i} className="fieldmap-chip">
            {Number.isFinite(c.potential) ? `${c.potential.toPrecision(3)} ${units.scalar || 'V'}` : ''}
          </span>
        ))}
        {units.scalar ? <span className="fieldmap-chip fieldmap-unit">{units.scalar}</span> : null}
      </div>
    </div>
  )
}

/** One profile panel's curve, drawn with its own canvas; the ticks are HTML so a stack can share them. */
function ProfileCurve({ axis, cut, scalar, secondary, lo, hi, height = 160 }) {
  const ref = useCanvas(
    (ctx, w, h) => {
      ctx.fillStyle = '#0b0f14'
      ctx.fillRect(0, 0, w, h)
      const N = 160
      const values = []
      for (let i = 0; i <= N; i++) {
        const t = lo + ((hi - lo) * i) / N
        let v
        try {
          v = scalar.read(t)
        } catch {
          v = NaN
        }
        values.push(v)
      }
      const finite = values.filter(Number.isFinite)
      if (!finite.length) return
      const vMax = Math.max(...finite)
      const vMin = Math.min(0, ...finite)
      const span = Math.max(1e-300, vMax - vMin)
      const toPx = (i, v) => [(w * i) / N, h - ((v - vMin) / span) * (h - 8) - 4]
      ctx.strokeStyle = '#38e0b0'
      ctx.lineWidth = 1.5
      ctx.beginPath()
      values.forEach((v, i) => {
        if (!Number.isFinite(v)) return
        const [px, py] = toPx(i, v)
        if (i === 0 || !Number.isFinite(values[i - 1])) ctx.moveTo(px, py)
        else ctx.lineTo(px, py)
      })
      ctx.stroke()

      if (secondary) {
        const values2 = []
        for (let i = 0; i <= N; i++) {
          const t = lo + ((hi - lo) * i) / N
          let v
          try {
            v = secondary.read(t)
          } catch {
            v = NaN
          }
          values2.push(v)
        }
        const finite2 = values2.filter(Number.isFinite)
        if (finite2.length) {
          const v2Max = Math.max(...finite2)
          const v2Min = Math.min(0, ...finite2)
          const span2 = Math.max(1e-300, v2Max - v2Min)
          const toPx2 = (i, v) => [(w * i) / N, h - ((v - v2Min) / span2) * (h - 8) - 4]
          ctx.strokeStyle = '#f0a23c'
          ctx.beginPath()
          values2.forEach((v, i) => {
            if (!Number.isFinite(v)) return
            const [px, py] = toPx2(i, v)
            if (i === 0 || !Number.isFinite(values2[i - 1])) ctx.moveTo(px, py)
            else ctx.lineTo(px, py)
          })
          ctx.stroke()
        }
      }
    },
    [axis, cut, lo, hi, scalar, secondary],
  )
  return <canvas ref={ref} className="fieldmap-profile-canvas" style={{ height }} />
}

function RegionMarks({ regions, lo, hi }) {
  if (!regions || !regions.length) return null
  return (
    <div className="fieldmap-regions" aria-hidden="true">
      {regions.map((r, i) => (
        <span
          key={i}
          className={`fieldmap-region${r.edge ? ' is-edge' : ''}`}
          style={{ left: `${(100 * (r.from - lo)) / (hi - lo)}%`, width: `${(100 * (r.to - r.from)) / (hi - lo)}%` }}
          title={r.label}
        />
      ))}
    </div>
  )
}

function AxisTicks({ ticks, lo, hi, labelled = false }) {
  return (
    <div className="fieldmap-ticks" data-role="axis-ticks" data-labelled={labelled}>
      {ticks.map((t, i) => (
        <span
          key={i}
          className="fieldmap-tick"
          data-testid="axis-tick"
          data-value={t}
          style={{ left: `${(100 * (t - lo)) / (hi - lo)}%` }}
        >
          {labelled ? fmtLen(t) : ''}
        </span>
      ))}
    </div>
  )
}

function ProfilePane({ profile, units }) {
  const panels = profile.stack && profile.stack.length ? profile.stack : [profile]
  const { lo, hi } = axisDomainOf(profile)
  const ticks = React.useMemo(() => domainTicks(lo, hi), [lo, hi])
  return (
    <div className="fieldmap" data-mode="profile" data-panels={panels.length}>
      {panels.map((panel, i) => (
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
          <div className="fieldmap-panel-body">
            <ProfileCurve axis={profile.axis} cut={profile.cut} scalar={panel.scalar} secondary={panel.secondary} lo={lo} hi={hi} />
            <RegionMarks regions={panel.regions} lo={lo} hi={hi} />
            {/* Every panel carries the same tick positions, so a vertical line
                through the stack lands on the same value in each one. Only the
                bottom panel labels them, which is what keeps a stack of three
                from repeating its axis three times. */}
            <AxisTicks ticks={ticks} lo={lo} hi={hi} labelled={false} />
          </div>
          {i === panels.length - 1 ? <AxisTicks ticks={ticks} lo={lo} hi={hi} labelled /> : null}
        </div>
      ))}
    </div>
  )
}
