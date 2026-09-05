import React from 'react'
import { deg, gridNum, num, pct } from '../format.js'
import { guardOf } from '../math.js'

/**
 * The four lower-pane views this sitting builds: Numbers, Mesh, Flux and
 * Circuit. Each reads the one analysis every other view reads, and none call
 * the engine directly (`REVIEW_PLAYBOOK.md`'s rule that a number on screen
 * and a number in a test come from the same call).
 */

const Row = ({ label, children, formula }) => (
  <div className="fields-row">
    <span className="fields-row-label">{label}</span>
    <span className="fields-row-value">{children}</span>
    {formula ? <span className="fields-row-formula">{formula}</span> : null}
  </div>
)

const Guard = ({ g }) => {
  if (!g) return null
  return (
    <p className={`hint fields-guard${g.ok ? '' : ' is-loose'}`} data-role="guard">
      {g.says}
    </p>
  )
}

/** Every closed form this experiment's geometry carries, with its formula. */
export function NumbersPane({ exp, x, p }) {
  const guard = guardOf(x)
  return (
    <div className="fields-numbers" data-role="numbers-pane">
      {x.C ? <Row label="Capacitance" formula={x.C.formula}>{num(x.C.value, 'F')}{x.C.perMetre != null ? <em> · {num(x.C.perMetre, 'F/m')} per metre</em> : null}</Row> : null}
      {x.L ? <Row label="Inductance" formula={undefined}>{num(x.L.value, 'H')}{x.L.perMetre != null ? <em> · {num(x.L.perMetre, 'H/m')} per metre</em> : null}</Row> : null}
      {x.R ? <Row label="Resistance">{num(x.R.value, 'Ω')}{x.R.perMetre != null ? <em> · {num(x.R.perMetre, 'Ω/m')} per metre</em> : null}</Row> : null}
      {x.energy ? <Row label="Stored energy">{num(x.energy.W, 'J')} <em>density {num(x.energy.density, 'J/m³')} at {x.energy.at}</em></Row> : null}
      {x.peakField ? <Row label="Peak field">{num(x.peakField, 'V/m')}</Row> : null}
      {x.rc != null ? <Row label="R C product">{num(x.rc, 's')}</Row> : null}
      {x.bar ? (
        <>
          <Row label="Resistance">{num(x.bar.R, 'Ω')}</Row>
          <Row label="Current">{num(x.bar.I, 'A')}</Row>
          <Row label="Current density">{num(x.bar.J, 'A/m²')}</Row>
          <Row label="Field">{num(x.bar.E, 'V/m')}</Row>
        </>
      ) : null}
      {x.fourPoint ? (
        <>
          <Row label="Bulk resistivity" formula={x.fourPoint.bulkFormula}>{num(x.fourPoint.bulkResistivity, 'Ω·m')}</Row>
          <Row label="Sheet resistance" formula={x.fourPoint.sheetFormula}>{num(x.fourPoint.sheetResistance, 'Ω/□')}</Row>
          {x.fourPoint.regime !== 'unknown' ? <Row label="This sample reads as">{x.fourPoint.regime}</Row> : null}
        </>
      ) : null}
      {x.magProbe != null ? <Row label="Flux density at the probe">{num(x.magProbe, 'T')}</Row> : null}
      {x.closed != null ? <Row label="Closed form at the same point">{num(x.closed, 'T')}</Row> : null}
      {x.solenoid ? <Row label="On the axis">{num(x.solenoid.B, 'T')} <em>{num(x.solenoid.fraction, '')} of the infinite solenoid</em></Row> : null}
      {x.emf ? <Row label="Induced emf, rms">{num(x.emf.rms, 'V')} <em>peak {num(x.emf.peak, 'V')}, coefficient {x.emf.coefficient.toFixed(5)}</em></Row> : null}
      {x.moving ? <Row label="Induced emf">{num(x.moving.emf, 'V')}</Row> : null}
      {x.eddy ? <Row label="Eddy-current loss">{num(x.eddy.P, 'W/m³')}</Row> : null}
      {x.skin ? <Row label="Skin depth">{num(x.skin.delta, 'm')}</Row> : null}
      {x.wire ? <Row label="Resistance over its direct-current value">{x.wire.ratio.toFixed(4)}</Row> : null}
      {x.tube ? <Row label="The tube formula gives">{x.tube.R.toExponential(4)} Ω/m</Row> : null}
      {x.gauss ? <Row label="Charge the flux implies">{num(x.gauss.impliedCharge, 'C')}</Row> : null}
      {x.force != null ? <Row label="Force between the charges">{num(x.force, 'N')}</Row> : null}
      {x.atProbe ? <Row label="Field at the probe">{num(Math.hypot(...x.atProbe), 'V/m')}</Row> : null}
      {x.vAtProbe != null && Number.isFinite(x.vAtProbe) ? <Row label="Potential at the probe">{num(x.vAtProbe, 'V')}</Row> : null}
      {x.lineField != null ? <Row label="A line of charge gives">{num(x.lineField, 'V/m')}</Row> : null}
      {x.sheetField != null ? <Row label="A sheet of charge gives">{num(x.sheetField, 'V/m')}</Row> : null}
      {x.ring ? <Row label="On the ring's axis" formula="closed form, then a sum over 720 charges">{num(x.ring.closed, 'V/m')} <em>{num(x.ring.byParts, 'V/m')}</em></Row> : null}
      {x.curve ? <Row label="The traced equipotential">{num(x.curve.level, 'V')} <em>held to {pct(x.curve.worstRelative)} over {x.curve.points.length} points</em></Row> : null}
      {x.displacement ? (
        <>
          <Row label="Current through the wire" formula="I = C dV/dt">{num(x.displacement.conduction, 'A')}</Row>
          <Row label="Displacement current in the gap" formula="J = ε dE/dt, times the area">{num(x.displacement.through, 'A')}</Row>
          <Row label="Difference between them">{num(x.displacement.difference, 'A')}</Row>
          <Row label="Displacement current density">{num(x.displacement.density, 'A/m²')}</Row>
        </>
      ) : null}
      {x.wave ? (
        <>
          <Row label="Intrinsic impedance" formula="η = √(µ/ε)">{num(x.wave.etaMag, 'Ω')}{x.wave.lossless ? null : <em> ∠ {deg(x.wave.etaDeg)}</em>}</Row>
          <Row label="Wavelength">{num(x.wave.lambda, 'm')}</Row>
          <Row label="Phase velocity">{num(x.wave.vp, 'm/s')}</Row>
          <Row label="Attenuation constant">{x.wave.lossless ? 'exactly 0' : num(x.wave.alpha, 'Np/m')}</Row>
          <Row label="Loss tangent">{x.wave.lossTangent === 0 ? 'exactly 0' : x.wave.lossTangent.toPrecision(4)}</Row>
          <Row label="Penetration depth">{x.wave.penetration === Infinity ? '∞' : num(x.wave.penetration, 'm')}</Row>
        </>
      ) : null}
      {x.pol ? (
        <>
          <Row label="Polarisation">{x.pol.kind}, {x.pol.sense}</Row>
          <Row label="Axial ratio">{x.pol.axialRatio === Infinity ? '∞' : x.pol.axialRatio.toPrecision(4)} <em>{x.pol.axialRatioDb === Infinity ? '∞' : `${x.pol.axialRatioDb.toPrecision(4)} dB`}</em></Row>
          <Row label="Tilt of the long axis">{deg(x.pol.tiltDeg)}</Row>
        </>
      ) : null}
      {x.refl ? (
        <>
          <Row label="Reflected field" formula="Γ = (η₂ − η₁) / (η₂ + η₁)">{x.refl.mag.toPrecision(4)} <em>∠ {deg(x.refl.deg)}</em></Row>
          <Row label="Transmitted field" formula="τ = 1 + Γ">{x.refl.tauMag.toPrecision(4)}</Row>
          <Row label="Power reflected and transmitted">{pct(x.refl.powerReflected)} <em>{pct(x.refl.powerTransmitted)}</em></Row>
        </>
      ) : null}
      {x.standing ? <Row label="Standing-wave ratio">{x.standing.swr === Infinity ? '∞' : x.standing.swr.toPrecision(4)} <em>first minimum at {num(x.standing.firstMinAt, 'm')}</em></Row> : null}
      {x.oblique ? (
        <>
          <Row label="Angle of incidence">{deg(x.oblique.thetaDeg)}</Row>
          <Row label="Transmitted angle">{x.oblique.total ? 'none, the wave is evanescent' : deg(x.oblique.transmittedDeg)}</Row>
          <Row label="Reflected field, parallel">{x.oblique.parallel.mag.toPrecision(4)}</Row>
          <Row label="Reflected field, perpendicular">{x.oblique.perpendicular.mag.toPrecision(4)}</Row>
          <Row label="Brewster angle">{deg(x.oblique.brewsterDeg)}</Row>
          <Row label="Critical angle">{x.oblique.criticalDeg == null ? 'none going this way' : deg(x.oblique.criticalDeg)}</Row>
        </>
      ) : null}
      {x.grid ? <Row label="The grid's answer">{gridNum(x.grid, x.grid.value, x.headline?.unit)}</Row> : null}
      <Guard g={guard} />
    </div>
  )
}

/** The three refinements, and the guard's verdict — Group C's own view. */
export function MeshPane({ x }) {
  const g = x.grid
  if (!g) return <p className="hint">This experiment has no grid to show.</p>
  return (
    <div className="fields-mesh" data-role="mesh-pane">
      <table className="fields-table">
        <thead>
          <tr>
            <th>Cells across</th>
            <th>Value</th>
          </tr>
        </thead>
        <tbody>
          {g.levels.map((l) => (
            <tr key={l.n}>
              <td>{l.n}</td>
              <td>{num(l.value, x.headline?.unit)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="hint" data-role="mesh-says">{g.says}</p>
      {x.compare ? (
        <p className="hint">
          {x.compare.name} gives {num(x.compare.value, x.headline?.unit)}, {' '}
          {(100 * x.compare.error).toPrecision(3)} % from the grid.
        </p>
      ) : null}
    </div>
  )
}

/** The contour, the flux through it, and the charge it encloses. */
export function FluxPane({ x }) {
  if (x.flux) {
    return (
      <div className="fields-flux" data-role="flux-pane">
        <Row label="Flux through the contour">{num(x.flux.value, 'C/m')}</Row>
        <Row label="Charge inside, from the operator">{num(x.flux.inside, 'C/m')}</Row>
        {x.compare ? <Row label={x.compare.name}>{num(x.compare.value, 'F/m')}</Row> : null}
      </div>
    )
  }
  if (x.gauss) {
    return (
      <div className="fields-flux" data-role="flux-pane">
        <Row label="Flux implies a charge of">{num(x.gauss.impliedCharge, 'C')}</Row>
        <Row label="Charge actually enclosed">{num(x.gauss.enclosed, 'C')}</Row>
      </div>
    )
  }
  return <p className="hint">This experiment has no flux contour to show.</p>
}

/** The magnetic circuit, drawn as a circuit: reluctances in series. */
export function CircuitPane({ x }) {
  // A transformer's own circuit is nested under it (E6); E5 has one directly.
  const c = x.circuit || (x.xfmr && x.xfmr.circuit)
  if (!c) return <p className="hint">This experiment has no magnetic circuit to show.</p>
  return (
    <div className="fields-circuit" data-role="circuit-pane">
      <Row label="Core reluctance">{num(c.reluctance.core, 'A/Wb')}</Row>
      <Row label="Gap reluctance">{num(c.reluctance.gap, 'A/Wb')}</Row>
      <Row label="Magnetomotive force">{num(c.mmf, 'A')}</Row>
      <Row label="Flux">{num(c.flux, 'Wb')}</Row>
      <Row label="B in the core">{num(c.Bcore, 'T')}</Row>
      <Row label="B in the gap">{num(c.Bgap, 'T')}</Row>
      <Row label="Inductance">{num(c.inductance, 'H')}</Row>
      <Row label="The gap's share of the mmf">{(100 * c.gapShare).toPrecision(3)} %</Row>
      {x.xfmr ? (
        <>
          <Row label="L1, L2">{num(x.xfmr.L1, 'H')} · {num(x.xfmr.L2, 'H')}</Row>
          <Row label="Mutual inductance">{num(x.xfmr.M, 'H')}</Row>
          <Row label="Coupling coefficient">{x.xfmr.k.toFixed(4)}</Row>
          <Row label="Turns ratio">{x.xfmr.turnsRatio.toFixed(4)}</Row>
        </>
      ) : null}
      <Guard g={c.guard} />
    </div>
  )
}
