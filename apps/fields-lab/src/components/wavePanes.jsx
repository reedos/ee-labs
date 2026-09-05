import React from 'react'
import { useCanvas } from '@ee-labs/ui'
import FieldMapCanvas from './FieldMapCanvas.jsx'
import { profilePropsFor } from '../view.js'
import { deg, num, pct } from '../format.js'

/**
 * The lower panes groups G and H draw.
 *
 * Neither draws a picture of its own where the field map already draws one. The
 * wave in space and the standing wave in front of a boundary are both one
 * scalar against one axis with a region marked, which is exactly what the
 * profile mode takes, so these panes hand it the same props the Profile view
 * gets and put the numbers beside it. The one picture the map cannot draw is
 * the polarisation ellipse, because it is a path in the transverse plane rather
 * than a curve against position, so that one has its own small canvas.
 */

const Row = ({ label, children }) => (
  <div className="fields-row">
    <span className="fields-row-label">{label}</span>
    <span className="fields-row-value">{children}</span>
  </div>
)

/** The plane wave: E and H against distance, with what the medium did to them. */
export function WavePane({ exp, x, p }) {
  if (x.pol) return <PolarisationPane x={x} />
  if (!x.wave) return <p className="hint">This experiment has no wave to show.</p>
  const w = x.wave
  return (
    <div className="fields-split" data-role="wave-pane">
      <div className="fields-plot">
        <FieldMapCanvas mode="profile" profile={profilePropsFor(exp, p, x)} units={{ length: 'm' }} />
      </div>
      <div className="fields-numbers">
        <Row label="Intrinsic impedance">
          {num(w.etaMag, 'Ω')}
          {w.lossless ? <em> real, so E and H are in step</em> : <em> ∠ {deg(w.etaDeg)}, so H lags E</em>}
        </Row>
        <Row label="Phase constant">{num(w.beta, 'rad/m')}</Row>
        <Row label="Attenuation constant">{w.lossless ? 'exactly 0' : num(w.alpha, 'Np/m')}</Row>
        <Row label="Wavelength">{num(w.lambda, 'm')} <em>in free space {num(w.lambda0, 'm')}</em></Row>
        <Row label="Phase velocity">{num(w.vp, 'm/s')} <em>refractive index {w.n.toPrecision(4)}</em></Row>
        <Row label="Loss tangent">{w.lossTangent === 0 ? 'exactly 0' : w.lossTangent.toPrecision(4)}</Row>
        <Row label="Penetration depth">{w.penetration === Infinity ? '∞' : num(w.penetration, 'm')}</Row>
        <p className="hint">
          {w.lossless
            ? 'A lossless medium takes the lossless branch, so the attenuation is exactly zero and the impedance is exactly real.'
            : w.lossTangent > 10
              ? 'The conduction current is far larger than the displacement current here, so the medium is acting as a conductor.'
              : w.lossTangent < 0.1
                ? 'The displacement current is far larger than the conduction current here, so the medium is acting as a dielectric.'
                : 'Neither current dominates at this frequency, so the medium is neither a conductor nor a dielectric.'}
        </p>
      </div>
    </div>
  )
}

/** The polarisation ellipse: the path the tip of E traces over one cycle. */
function PolarisationPane({ x }) {
  const pol = x.pol
  const ref = useCanvas(
    (ctx, w, h) => {
      const cx = w / 2
      const cy = h / 2
      const scale = (Math.min(w, h) / 2 - 18) / Math.max(1e-12, Math.max(pol.ax, pol.ay))

      ctx.strokeStyle = 'rgba(255,255,255,0.16)'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(12, cy)
      ctx.lineTo(w - 12, cy)
      ctx.moveTo(cx, 12)
      ctx.lineTo(cx, h - 12)
      ctx.stroke()

      // The path itself, one full cycle of the two components.
      ctx.strokeStyle = '#38e0b0'
      ctx.lineWidth = 2
      ctx.beginPath()
      const STEPS = 240
      for (let i = 0; i <= STEPS; i++) {
        const [ex, ey] = pol.at((2 * Math.PI * i) / STEPS)
        const px = cx + ex * scale
        const py = cy - ey * scale
        if (i === 0) ctx.moveTo(px, py)
        else ctx.lineTo(px, py)
      }
      ctx.stroke()

      // Where the tip is at the start of the cycle, and where it goes next.
      const [x0, y0] = pol.at(0)
      const [x1, y1] = pol.at(0.35)
      ctx.fillStyle = '#f0a23c'
      ctx.beginPath()
      ctx.arc(cx + x0 * scale, cy - y0 * scale, 4, 0, 2 * Math.PI)
      ctx.fill()
      ctx.strokeStyle = '#f0a23c'
      ctx.beginPath()
      ctx.moveTo(cx + x0 * scale, cy - y0 * scale)
      ctx.lineTo(cx + x1 * scale, cy - y1 * scale)
      ctx.stroke()
    },
    [pol.ax, pol.ay, pol.phaseDeg],
  )

  return (
    <div className="fields-split" data-role="polarisation-pane">
      <div className="fields-plot">
        <canvas ref={ref} style={{ height: 260 }} />
        <div className="fields-legend">
          <span className="fields-chip">the tip of E over one cycle</span>
          <span className="fields-chip">the mark is where it starts</span>
        </div>
      </div>
      <div className="fields-numbers">
        <Row label="Polarisation">{pol.kind}</Row>
        <Row label="Axial ratio">{pol.axialRatio === Infinity ? '∞' : pol.axialRatio.toPrecision(4)} <em>{pol.axialRatioDb === Infinity ? '∞' : `${pol.axialRatioDb.toPrecision(4)} dB`}</em></Row>
        <Row label="Tilt of the long axis">{deg(pol.tiltDeg)}</Row>
        <Row label="Sense">{pol.sense}</Row>
        <Row label="The two amplitudes">{pol.ax.toPrecision(4)} across, {pol.ay.toPrecision(4)} up</Row>
        <Row label="Phase between them">{deg(pol.phaseDeg)}</Row>
      </div>
    </div>
  )
}

/** The boundary: what came back, what went through, and at an angle what each polarisation did. */
export function InterfacePane({ exp, x, p }) {
  if (x.oblique) return <ObliquePane exp={exp} x={x} p={p} />
  if (!x.refl) return <p className="hint">This experiment has no boundary to show.</p>
  const r = x.refl
  return (
    <div className="fields-split" data-role="interface-pane">
      <div className="fields-plot">
        <FieldMapCanvas mode="profile" profile={profilePropsFor(exp, p, x)} units={{ length: 'm' }} />
      </div>
      <div className="fields-numbers">
        <Row label="Reflected field">{r.mag.toPrecision(4)} <em>∠ {deg(r.deg)}</em></Row>
        <Row label="Transmitted field">{r.tauMag.toPrecision(4)} <em>∠ {deg(r.tauDeg)}</em></Row>
        <Row label="Reflected power">{pct(r.powerReflected)}</Row>
        <Row label="Transmitted power">{pct(r.powerTransmitted)}</Row>
        <Row label="The two impedances">{num(r.wave1.etaMag, 'Ω')} then {num(r.wave2.etaMag, 'Ω')}</Row>
        {x.standing ? (
          <>
            <Row label="Standing-wave ratio">{x.standing.swr === Infinity ? '∞' : x.standing.swr.toPrecision(4)}</Row>
            <Row label="Largest and smallest field">{x.standing.max.toPrecision(4)} and {x.standing.min.toPrecision(4)}</Row>
            <Row label="First minimum">{num(x.standing.firstMinAt, 'm')} <em>pattern repeats every {num(x.standing.period, 'm')}</em></Row>
          </>
        ) : null}
        <p className="hint">
          {`The two power fractions add to ${(r.powerReflected + r.powerTransmitted).toPrecision(12)}, because a boundary of no thickness stores nothing.`}
        </p>
      </div>
    </div>
  )
}

/** Oblique incidence: the two polarisations against the angle, and the angles worth a name. */
function ObliquePane({ exp, x, p }) {
  const o = x.oblique
  return (
    <div className="fields-split" data-role="oblique-pane">
      <div className="fields-plot">
        <FieldMapCanvas mode="profile" profile={profilePropsFor(exp, p, x)} units={{ length: '°' }} />
      </div>
      <div className="fields-numbers">
        <Row label="Angle of incidence">{deg(o.thetaDeg)}</Row>
        <Row label="Transmitted angle">{o.total ? 'none, the wave is evanescent' : deg(o.transmittedDeg)}</Row>
        <Row label="Parallel, reflected field">{o.parallel.mag.toPrecision(4)}</Row>
        <Row label="Perpendicular, reflected field">{o.perpendicular.mag.toPrecision(4)}</Row>
        <Row label="Brewster angle">{deg(o.brewsterDeg)}</Row>
        <Row label="Critical angle">{o.criticalDeg == null ? 'none, going into the denser medium' : deg(o.criticalDeg)}</Row>
        <p className="hint">
          {o.total
            ? 'Past the critical angle the transmitted wave clings to the surface and carries no power away, so the reflection has magnitude one exactly.'
            : 'The two polarisations are two different laws here. Only the parallel one has an angle where it reflects nothing.'}
        </p>
      </div>
    </div>
  )
}
