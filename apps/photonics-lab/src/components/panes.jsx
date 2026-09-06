import React from 'react'
import { Schematic } from '@ee-labs/ui'
import CurveCanvas from './CurveCanvas.jsx'
import { numbersFor, schematicFor } from '../view.js'
import { db, dbm, nm, num, pct, plain, span } from '../format.js'

/** Every closed form the experiment used, with the formula it came from. */
export function NumbersPane({ exp, x, p }) {
  const rows = numbersFor(exp, x, p)
  if (!rows.length) return <p className="hint">Nothing to print at this setting.</p>
  return (
    <table className="numbers" data-role="numbers">
      <thead>
        <tr>
          <th>Quantity</th>
          <th>Value</th>
          <th>Where it comes from</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.label}>
            <th scope="row">{r.label}</th>
            <td className="v">{r.value}</td>
            <td className="f">{r.formula}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

/** The circuit an experiment loads, with the solved voltages and currents on it. */
export function SchematicPane({ x }) {
  const s = schematicFor(x)
  if (!s) return <p className="hint">This experiment has no circuit.</p>
  return (
    <div className="sch-wrap">
      <Schematic elements={s.elements} layout={s.layout} meters={s.meters} show="i" />
      {x.j ? (
        <p className="caption">
          One junction, and the solver does not know which device it is. As an LED it makes{' '}
          {num(x.led.power, 'W')} and as a laser it makes {num(x.laser.power, 'W')}, at the same{' '}
          {num(x.j.current, 'A')}.
        </p>
      ) : (
        <p className="caption">
          The junction and the photocurrent source inside the outline are one device. The current is read across{' '}
          {num(x.p.load, 'Ω')}.
        </p>
      )}
    </div>
  )
}

/**
 * The experiment's quantity against the knob it depends on.
 *
 * The caption under the canvas names both axes with their units and reads each
 * series at the marked setting. That is `REVIEW_PLAYBOOK.md` §4 applied twice
 * over: an axis is never a bare number, and the value a note quotes is on the
 * pane beside the curve it came from.
 */
export function CurvePane({ exp, x, p }) {
  if (!exp.curve) return <p className="hint">This experiment has no curve.</p>
  const curve = exp.curve(x, p)
  const here = (curve.marks || []).find((m) => m.label === 'here')
  return (
    <div className="pane-fill">
      <CurveCanvas curve={curve} />
      <p className="caption" data-role="curve-axes">
        {curve.yLabel}
        {curve.yUnit ? ` (${curve.yUnit})` : ''} against {curve.x.label.toLowerCase()}
        {curve.x.unit ? ` (${curve.x.unit})` : ''}
        {curve.rightLabel ? `, with ${curve.rightLabel.toLowerCase()} on the right axis` : ''}.
      </p>
      {here ? (
        <dl className="readouts" data-role="curve-readouts">
          <div>
            <dt>{curve.x.label}</dt>
            <dd>{num(here.at, curve.x.unit)}</dd>
          </div>
          {curve.series.map((s) => (
            <div key={s.label}>
              <dt>{s.label}</dt>
              <dd>{num(s.read(here.at), s.unit)}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </div>
  )
}

/**
 * One pulse in and the same pulse out.
 *
 * Both are drawn on one time axis at one scale, so the widening is the picture
 * rather than a caption. The input width is the source's own, taken as one
 * tenth of a bit period at the rate the spread allows, and both widths are
 * printed under the drawing.
 */
export function PulsePane({ x, p }) {
  const spread = x.disp.spread
  const inWidth = spread / 8
  const outWidth = Math.hypot(inWidth, spread)
  const full = Math.max(outWidth * 3, 1e-15)
  const gauss = (t, w) => Math.exp(-0.5 * (t / (w / 2.3548)) ** 2)
  const pts = (w) => {
    const out = []
    for (let k = 0; k <= 120; k++) {
      const t = -full / 2 + (full * k) / 120
      out.push(`${(100 * (t + full / 2)) / full},${60 - 52 * gauss(t, w)}`)
    }
    return out.join(' ')
  }
  return (
    <div className="pulse">
      <svg viewBox="0 0 100 70" preserveAspectRatio="none" role="img" aria-label="A pulse entering the fibre and the same pulse leaving it">
        <polyline className="pulse-in" points={pts(inWidth)} />
        <polyline className="pulse-out" points={pts(outWidth)} />
        <line className="pulse-axis" x1="0" y1="60" x2="100" y2="60" />
      </svg>
      <dl className="readouts" data-role="pulse-readouts">
        <div>
          <dt>Into the fibre</dt>
          <dd>{num(inWidth, 's')}</dd>
        </div>
        <div>
          <dt>Spread the fibre adds</dt>
          <dd>{num(spread, 's')}</dd>
        </div>
        <div>
          <dt>Out of the fibre</dt>
          <dd>{num(outWidth, 's')}</dd>
        </div>
        <div>
          <dt>Over</dt>
          <dd>{span(p.length)}</dd>
        </div>
      </dl>
      <p className="caption">
        The two widths add in quadrature, so a pulse already wider than the spread grows less than the spread
        suggests. The input width here is drawn as an eighth of the spread.
      </p>
    </div>
  )
}

/**
 * The link: a transmitter, a length of fibre and a receiver, with the power
 * falling along the fibre and the budget drawn as a waterfall under it.
 *
 * The waterfall is this lab's own drawing for now. `NEEDS.md` asks the director
 * to promote it once the System Lab needs the same picture, and it carries that
 * lab's line-item shape from the first commit: every item is `{ name, db }` and
 * a zero draws as a zero-height bar with its name, rather than being left out.
 */
export function LinkPane({ x, p }) {
  const items = x.budget.items
  const worst = Math.max(...items.map((i) => i.db), 1)
  const closes = x.budget.margin >= 0
  return (
    <div className="link">
      <div className="link-strip" data-role="link-strip">
        <div className="link-block">
          <span className="link-name">Transmitter</span>
          <span className="link-value">{dbm(p.txDbm)}</span>
        </div>
        <div className="link-fibre">
          <svg viewBox="0 0 100 40" preserveAspectRatio="none" role="img" aria-label="Optical power falling along the fibre">
            <polyline
              className="link-fall"
              points={Array.from({ length: 41 }, (_, k) => `${(100 * k) / 40},${4 + (32 * (x.fibre.db * (k / 40))) / Math.max(x.fibre.db, 1)}`).join(' ')}
            />
          </svg>
          <span className="link-name">{span(p.length)} of fibre</span>
          <span className="link-value">{db(x.fibre.db)}</span>
        </div>
        <div className="link-block">
          <span className="link-name">Receiver</span>
          <span className="link-value">{dbm(p.sensitivityDbm)}</span>
        </div>
      </div>

      <table className="waterfall" data-role="waterfall">
        <tbody>
          {items.map((it) => (
            <tr key={it.name} className={it.db === 0 ? 'is-zero' : ''}>
              <th scope="row">{it.name}</th>
              <td className="bar">
                <span style={{ width: `${(100 * it.db) / worst}%` }} />
              </td>
              <td className="v">{db(it.db)}</td>
            </tr>
          ))}
          <tr className="is-total">
            <th scope="row">Total loss</th>
            <td className="bar" />
            <td className="v">{db(x.budget.total)}</td>
          </tr>
        </tbody>
      </table>

      <dl className="readouts" data-role="link-readouts">
        <div>
          <dt>Power at the receiver</dt>
          <dd>{dbm(x.budget.received)}</dd>
        </div>
        <div className={closes ? '' : 'is-off'}>
          <dt>Margin</dt>
          <dd data-role="margin">{db(x.budget.margin)}</dd>
        </div>
        <div>
          <dt>Loss-limited reach</dt>
          <dd>{span(x.reach.length)}</dd>
        </div>
        <div>
          <dt>Dispersion-limited reach</dt>
          <dd>{span(x.reach.dispersion)}</dd>
        </div>
        <div>
          <dt>Which limit binds</dt>
          <dd data-role="binds">{x.reach.binds}</dd>
        </div>
      </dl>
      <p className="caption">
        A zero-height bar is a loss this model does not include, named so the omission is a decision.
      </p>
    </div>
  )
}

/** The Airy transmission against frequency, with the three numbers marked. */
export function CavityPane({ x }) {
  const s = x.sweep
  const f0 = s.f[0]
  const f1 = s.f[s.f.length - 1]
  const px = (f) => (100 * (f - f0)) / (f1 - f0)
  const pts = s.f.map((f, k) => `${px(f)},${62 - 58 * s.t[k]}`).join(' ')
  return (
    <div className="cavity">
      <svg viewBox="0 0 100 70" preserveAspectRatio="none" role="img" aria-label="Cavity transmission against optical frequency">
        {s.peaks.map((f) => (
          <line key={f} className="cav-peak" x1={px(f)} y1="0" x2={px(f)} y2="62" />
        ))}
        <polyline className="cav-trace" points={pts} />
        <line className="cav-axis" x1="0" y1="62" x2="100" y2="62" />
      </svg>
      <p className="caption">
        Transmission, one at each resonance, against optical frequency over three free spectral ranges.
      </p>
      <dl className="readouts" data-role="cavity-readouts">
        <div>
          <dt>Free spectral range</dt>
          <dd>{num(x.fsr, 'Hz')}</dd>
        </div>
        <div>
          <dt>The same in wavelength</dt>
          <dd>{nm(x.fsrWavelength)}</dd>
        </div>
        <div>
          <dt>Finesse</dt>
          <dd>{plain(x.finesse)}</dd>
        </div>
        <div>
          <dt>Linewidth</dt>
          <dd>{num(x.linewidth, 'Hz')}</dd>
        </div>
        <div>
          <dt>Contrast</dt>
          <dd>{db(x.contrast.db)}</dd>
        </div>
      </dl>
      <p className="flag warn" data-role="cavity-refusal">
        {x.refusal}
      </p>
    </div>
  )
}

/** The channel grid across the band, with the source's own width beside one channel. */
export function SpectrumPane({ x, p }) {
  const shown = Math.min(x.band.channels, 24)
  const from = p.from
  const to = p.to
  const px = (l) => (100 * (l - from)) / (to - from)
  const wide = 100 * (x.grid.width / (to - from))
  return (
    <div className="spectrum">
      <svg viewBox="0 0 100 60" preserveAspectRatio="none" role="img" aria-label="The channel grid across the band">
        {x.centres.slice(0, shown).map((l, k) => (
          <rect key={k} className="chan" x={Math.max(0, px(l) - wide / 2)} y="14" width={Math.max(0.25, wide * 0.8)} height="30" />
        ))}
        <rect className="source" x={Math.max(0, px(x.centres[Math.floor(shown / 2)] || (from + to) / 2) - (wide * x.widthRatio) / 2)} y="8" width={Math.max(0.2, wide * x.widthRatio)} height="42" />
        <line className="spec-axis" x1="0" y1="50" x2="100" y2="50" />
      </svg>
      <p className="caption">
        {shown} of {x.band.channels} channels, from {nm(from)} to {nm(to)}. The taller bar is the source’s own width.
      </p>
      <dl className="readouts" data-role="spectrum-readouts">
        <div>
          <dt>Channel width</dt>
          <dd>{nm(x.grid.width)}</dd>
        </div>
        <div>
          <dt>Band width</dt>
          <dd>{num(x.band.width, 'Hz')}</dd>
        </div>
        <div>
          <dt>Channels</dt>
          <dd>{x.band.channels}</dd>
        </div>
        <div className={x.fits ? '' : 'is-off'}>
          <dt>Source over channel</dt>
          <dd>{plain(x.widthRatio)}</dd>
        </div>
      </dl>
    </div>
  )
}

/**
 * D1 and D2. The two rate equations with the reader's own numbers under them.
 *
 * Each term is a rate of density, per cubic metre a second, and the bar beside
 * it is that term against the largest term in its own equation. A term that
 * takes carriers away is drawn to the left of the line and one that adds them
 * to the right, so the sum being zero is a picture and not only a row.
 */
export function EquationsPane({ x }) {
  const block = (title, formula, terms, sum, floor) => {
    const scale = Math.max(...terms.map((t) => Math.abs(t.value)), Number.MIN_VALUE)
    return (
      <div className="eqn-block" key={title}>
        <h4>{title}</h4>
        <p className="eqn-line">{formula}</p>
        <table className="eqn-terms">
          <tbody>
            {terms.map((t) => (
              <tr key={t.name}>
                <th scope="row">{t.name}</th>
                <td className="f">{t.formula}</td>
                <td className="bar">
                  <span
                    className={t.value < 0 ? 'is-out' : 'is-in'}
                    style={{
                      width: `${(50 * Math.abs(t.value)) / scale}%`,
                      marginLeft: t.value < 0 ? `${50 - (50 * Math.abs(t.value)) / scale}%` : '50%',
                    }}
                  />
                </td>
                <td className="v">{plain(t.value)}</td>
              </tr>
            ))}
            <tr className="is-total">
              <th scope="row">The sum</th>
              <td className="f">zero at the steady state</td>
              <td className="bar" />
              <td className="v">{Math.abs(sum) <= floor ? '0' : plain(sum)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    )
  }
  return (
    <div className="equations" data-role="equations">
      {block('Carriers', 'dN/dt = I/(qV) − N/τ_c − G(N) S', x.carriers, x.carrierSum, x.carrierFloor)}
      {block('Photons', 'dS/dt = Γ G(N) S − S/τ_p + Γ β N/τ_c', x.photons, x.photonSum, x.photonFloor)}
      <dl className="readouts" data-role="equations-readouts">
        <div>
          <dt>Carrier density</dt>
          <dd>{num(x.n, 'm⁻³')}</dd>
        </div>
        <div>
          <dt>Photon density</dt>
          <dd>{num(x.s, 'm⁻³')}</dd>
        </div>
        <div>
          <dt>Threshold current</dt>
          <dd>{num(x.ith, 'A')}</dd>
        </div>
        <div className={x.above ? '' : 'is-off'}>
          <dt>Drive current</dt>
          <dd>{num(x.current, 'A')}</dd>
        </div>
      </dl>
      <p className="caption">
        Every term is a rate of density, per cubic metre a second. A bar to the left takes carriers or photons away
        and a bar to the right adds them, so each equation balances about the line.
      </p>
    </div>
  )
}

/**
 * D3. The magnitude of the linearised response, with the relaxation peak marked.
 *
 * The curve is drawn from the same `H(s)` the numbers pane prints, so the peak
 * on the picture and the peak in the readout are one number. The frequency axis
 * is three hundred below the 3 dB point to three above it, so the peak sits in
 * the same place on screen at every bias and the curve keeps its shape as the
 * drive current moves it. The caption prints the two ends, because an axis that
 * re-frames has to say what it re-framed to.
 */
export function ModulationPane({ x }) {
  const sm = x.sm
  const from = Math.log10(sm.f3db / 300)
  const to = Math.log10(sm.f3db * 3)
  const top = Math.max(6, sm.peakDb + 4)
  const bottom = -24
  const px = (f) => (100 * (Math.log10(f) - from)) / (to - from)
  const py = (dbv) => 62 - (58 * (dbv - bottom)) / (top - bottom)
  const pts = []
  for (let k = 0; k <= 240; k++) {
    const f = Math.pow(10, from + ((to - from) * k) / 240)
    pts.push(`${px(f)},${py(20 * Math.log10(x.response(f)))}`)
  }
  return (
    <div className="modulation">
      <svg viewBox="0 0 100 70" preserveAspectRatio="none" role="img" aria-label="The laser's modulation response against frequency">
        <line className="mod-zero" x1="0" y1={py(0)} x2="100" y2={py(0)} />
        <line className="mod-peak" x1={px(sm.peakHz)} y1="0" x2={px(sm.peakHz)} y2="62" />
        <line className="mod-corner" x1={px(sm.f3db)} y1="0" x2={px(sm.f3db)} y2="62" />
        <polyline className="mod-trace" points={pts.join(' ')} />
        <line className="mod-axis" x1="0" y1="62" x2="100" y2="62" />
      </svg>
      <p className="caption">
        Response in decibels against modulation frequency, over {plain(to - from)} decades from{' '}
        {num(Math.pow(10, from), 'Hz')} to {num(Math.pow(10, to), 'Hz')}. The first dashed line is the peak and the
        second is where the response is 3 dB down.
      </p>
      <dl className="readouts" data-role="modulation-readouts">
        <div>
          <dt>Relaxation frequency</dt>
          <dd>{num(sm.fr, 'Hz')}</dd>
        </div>
        <div>
          <dt>The textbook form</dt>
          <dd>{num(sm.frText, 'Hz')}</dd>
        </div>
        <div>
          <dt>Damping ratio</dt>
          <dd>{plain(sm.zeta)}</dd>
        </div>
        <div>
          <dt>Peak height</dt>
          <dd>{db(sm.peakDb)}</dd>
        </div>
        <div>
          <dt>Modulation bandwidth</dt>
          <dd>{num(sm.f3db, 'Hz')}</dd>
        </div>
      </dl>
      <p className="caption">
        The textbook form drops the transparency density, so it reads low by {plain(x.textFactor)} here. Both are
        printed because the difference is the lesson.
      </p>
    </div>
  )
}

/**
 * D4. The integrated step and the linear prediction on one axis.
 *
 * This is the one picture in the lab that draws a solution in time, and what
 * makes it legitimate is that it draws two of them. The measured curve is the
 * pair integrated and the dashed one is what the linearisation predicted, and
 * the number under them is the difference. Past the decline threshold the
 * dashed curve is not drawn at all, which is the guard on screen.
 *
 * The resolution arithmetic REVIEW_PLAYBOOK.md §5 asks for. The two peaks
 * differ by the error over one plus the overshoot, so at the default depth of
 * five per cent that is 2.78 per cent of the drawn range, or about 4 px of the
 * 190 px the pane is tall. At thirty per cent it is 14 per cent of the range.
 * Four pixels is thin, which is why the difference is also a printed number in
 * the readouts below and not only a gap between two curves.
 */
export function StepPane({ x }) {
  const g = x.guard
  const step = x.step
  const t1 = step.t[step.t.length - 1]
  const lo = Math.min(step.start, ...step.trace)
  const hi = Math.max(step.measured, g.predicted)
  const span = Math.max(hi - lo, Number.MIN_VALUE)
  const px = (t) => (100 * t) / t1
  const py = (v) => 62 - (54 * (v - lo)) / span
  const measured = step.t.map((t, k) => `${px(t)},${py(step.trace[k])}`).join(' ')
  const predicted = step.t.map((t) => `${px(t)},${py(step.predict(t))}`).join(' ')
  return (
    <div className="step">
      <svg viewBox="0 0 100 70" preserveAspectRatio="none" role="img" aria-label="The photon density after a step in current, integrated and predicted">
        <line className="step-final" x1="0" y1={py(step.final)} x2="100" y2={py(step.final)} />
        <polyline className="step-measured" points={measured} />
        {g.declined ? null : <polyline className={`step-predicted${g.ok ? '' : ' is-estimate'}`} points={predicted} />}
        <line className="step-axis" x1="0" y1="62" x2="100" y2="62" />
      </svg>
      <p className="caption">
        Photon density against time, over {num(t1, 's')}, after the drive current steps up by {pct(g.depth)}. The
        solid curve is the pair integrated and the dashed one is what the linearisation predicted.
      </p>
      <dl className="readouts" data-role="step-readouts">
        <div>
          <dt>Overshoot predicted</dt>
          <dd>{num(g.predicted, 'm⁻³')}</dd>
        </div>
        <div>
          <dt>Overshoot measured</dt>
          <dd>{num(g.measured, 'm⁻³')}</dd>
        </div>
        <div className={g.ok ? '' : 'is-off'}>
          <dt>Error</dt>
          <dd data-role="step-error">{pct(g.error)}</dd>
        </div>
        <div>
          <dt>Settles at</dt>
          <dd>{num(step.final, 'm⁻³')}</dd>
        </div>
      </dl>
      <p className={`flag${g.ok ? '' : ' warn'}`} data-role="guard-says">
        {g.says}
      </p>
      <p className="flag warn" data-role="large-signal-refusal">
        {x.declineText}
      </p>
    </div>
  )
}
