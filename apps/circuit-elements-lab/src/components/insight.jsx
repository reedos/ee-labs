import React from 'react'
import { Schematic } from '@ee-labs/ui'
import { Formula } from '@ee-labs/explain'
import { headlineValue, bridgeText, tagLatex } from '../headlines.js'
import { kvlLoop, meshRows, partsFigures, equivalentOf, powerCycle } from '../theorems.js'
import { layoutExtent } from '../layoutCheck.js'
import { num, scaleOf } from '../format.js'

// The top of the Analysis pane: the one number the experiment is about, a
// sentence tying the view to the lesson, then the theorem drawn if this
// experiment has one. Every number here is read from the analysis `x`, never
// computed; experiments.test.js holds each against its closed form.

const T = ({ children }) => <Formula display={false}>{children}</Formula>

/** The headline: the lesson's own quantity, first and large. */
export function Headline({ exp, x, params }) {
  const h = exp.headline
  const value = headlineValue(h, x, params)
  return (
    <div className={`headline${value === null ? ' is-refused' : ''}`} data-role="headline">
      <span className="headline-label">{h.label}</span>
      <span className="headline-value">
        <b className="headline-tag">
          <T>{tagLatex(h.tag)}</T>
        </b>
        {value === null ? (
          <>
            <span className="headline-eq">—</span>
            <strong>no value</strong>
          </>
        ) : (
          <>
            <span className="headline-eq">=</span>
            <strong>{value}</strong>
          </>
        )}
      </span>
      {value === null && h.refused ? <span className="headline-why">{h.refused}</span> : null}
    </div>
  )
}

/** One sentence from the lesson, so the pane does not open cold. */
export function Bridge({ exp, view }) {
  return (
    <p className="bridge" data-role="bridge">
      {bridgeText(exp, view)}
    </p>
  )
}

/**
 * Every meter at once, the way the schematic cannot show them: each element's
 * voltage and current (and power once the lesson has reached it), then the
 * node voltages.
 */
export function Readings({ x, elements, power }) {
  const sol = x.sol
  const nodes = Object.keys(sol.v).filter((n) => n !== 'gnd')
  // Each column's noise is judged against the largest reading in it, as the schematic's meters are.
  const scale = { volt: scaleOf(sol.volt), i: scaleOf(sol.i), p: scaleOf(sol.p), v: scaleOf(sol.v) }
  const cell = (q, key, unit) => (Number.isFinite(sol[q][key]) ? num(sol[q][key], unit, 3, scale[q]) : '—')
  return (
    <div className="readings" data-role="readings">
      <table className="table">
        <thead>
          <tr>
            <th>element</th>
            <th className="num">v (+ to −)</th>
            <th className="num">i (in at +)</th>
            {power ? <th className="num">p = v × i</th> : null}
          </tr>
        </thead>
        <tbody>
          {elements.map((e) => (
            <tr key={e.id}>
              <td>
                <b>{e.id}</b>
              </td>
              <td className="num">{cell('volt', e.id, 'V')}</td>
              <td className="num">{cell('i', e.id, 'A')}</td>
              {power ? <td className="num">{cell('p', e.id, 'W')}</td> : null}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="hint">
        Node voltages, against ground:{' '}
        {nodes.map((n, k) => (
          <React.Fragment key={n}>
            {k ? ', ' : ''}v_{n} <b>{cell('v', n, 'V')}</b>
          </React.Fragment>
        ))}
        . The schematic shows one of these columns at a time. This is all of them.
      </p>
    </div>
  )
}

/** The theorem this experiment is about, drawn from the solution. */
export function TheoremBlock({ exp, x, params, elements, layout }) {
  const t = exp.theorem
  if (!t) return null
  switch (t.kind) {
    case 'kvl':
      return x.sol ? <KvlRow theorem={t} sol={x.sol} /> : null
    case 'mesh':
      return x.sol ? <MeshRows p={params} sol={x.sol} /> : null
    case 'parts':
      return x.superposition ? <PartsFigures exp={exp} x={x} elements={elements} layout={layout} /> : null
    case 'contradiction':
      return x.sol ? null : <Contradiction rows={t.rows} />
    case 'triangle':
      return x.ac ? <PowerTriangle x={x} /> : null
    default:
      return null
  }
}

/** B2: the voltages around the loop, with signs, adding to zero. */
function KvlRow({ theorem, sol }) {
  const { terms, sum } = kvlLoop(theorem, sol)
  const scale = Math.max(...terms.map((t) => Math.abs(t.v)), 1e-30)
  return (
    <div className="theorem kvl" data-role="kvl">
      <div className="eq-at">
        <span>KVL around</span>
        <b>the loop</b>
        <small>rises and drops, clockwise from ground</small>
      </div>
      <div className="eq-terms">
        {terms.map((t, k) => (
          <span className="eq-term" key={t.id}>
            <T>{`${t.sign < 0 ? '-\\,' : k ? '+\\,' : ''}v_{${t.id}}`}</T>
            <span className="eq-val">{num(t.value, 'V', 3, scale)}</span>
          </span>
        ))}
        <span className="eq-sum">
          = 0 · adds to <b>{num(sum, 'V', 2, scale)}</b>
        </span>
      </div>
    </div>
  )
}

/** D3: the two mesh equations with both sides read live. */
function MeshRows({ p, sol }) {
  const m = meshRows(p, sol)
  return (
    <div className="theorem mesh" data-role="mesh">
      <p className="eq-step">
        <b>One KVL row per mesh</b>, each written clockwise. i₁ is R₁’s current, <b>{num(m.i1, 'A', 3)}</b>, and i₂ is R₃’s,{' '}
        <b>{num(m.i2, 'A', 3)}</b>. The shared R₂ carries their difference.
      </p>
      {m.rows.map((r, k) => (
        <div className="eq-row" key={k}>
          <div className="eq-at">
            <span>mesh</span>
            <b>{k + 1}</b>
          </div>
          <div className="eq-terms">
            <span className="eq-term">
              <Formula display={false}>{'\\displaystyle ' + r.latex}</Formula>
              <span className="eq-val">
                {num(r.lhs, 'V', 3)} = {num(r.rhs, 'V', 3)}
              </span>
            </span>
          </div>
        </div>
      ))}
    </div>
  )
}

/** D4: the circuit once per source, then whole. */
function PartsFigures({ exp, x, elements, layout }) {
  const figures = partsFigures(exp, x, elements)
  return (
    <div className="theorem parts" data-role="parts">
      {figures.map((f) => (
        <figure key={f.caption}>
          <Schematic elements={f.elements} layout={layout} meters={f.meters} show="v" />
          <figcaption>
            {f.caption} — v_A <b>{num(f.meters.v.A, 'V', 3)}</b>
          </figcaption>
        </figure>
      ))}
    </div>
  )
}

/** E3: the two rows that cannot both hold. */
function Contradiction({ rows }) {
  return (
    <p className="theorem contradiction" data-role="contradiction">
      <b>Two rows fix the same node.</b> {rows[0]} holds the + input at its own voltage. The ideal {rows[1]} demands v₊ = v₋, and v₋
      is grounded. Both rows are highlighted in the equations — no set of values satisfies both, so the solver has nothing
      to return. A real op-amp saturates instead.
    </p>
  )
}

/**
 * H5: the power triangle — P along, Q up, |S| the hypotenuse — beside p(t) over
 * one cycle with its average drawn in; the average is P.
 */
function PowerTriangle({ x }) {
  const c = powerCycle(x)
  const W = 200
  const H = 130
  const pad = 14
  const s = (W - 2 * pad) / Math.max(c.S, 1e-30)
  const ox = pad
  const oy = H - pad
  const px = ox + c.P * s
  const qy = oy - c.Q * s
  // p(t) plot.
  const PW = 260
  const PH = 130
  const yOf = (p) => PH / 2 - (p / Math.max(c.peak, 1e-30)) * (PH / 2 - 18)
  const path = c.samples.map((q, k) => `${k ? 'L' : 'M'}${(pad + (q.t / c.T) * (PW - 2 * pad)).toFixed(1)},${yOf(q.p).toFixed(1)}`).join(' ')
  return (
    <div className="theorem triangle" data-role="triangle">
      <figure>
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`power triangle: P ${num(c.P, 'W', 3)}, Q ${num(c.Q, 'var', 3)}, S ${num(c.S, 'VA', 3)}`}>
          <polygon points={`${ox},${oy} ${px},${oy} ${px},${qy}`} className="tri-fill" />
          <line x1={ox} y1={oy} x2={px} y2={oy} className="tri-p" />
          <line x1={px} y1={oy} x2={px} y2={qy} className="tri-q" />
          <line x1={ox} y1={oy} x2={px} y2={qy} className="tri-s" />
          <text x={(ox + px) / 2} y={oy + 11} textAnchor="middle" className="sch-note">
            P = {num(c.P, 'W', 3)}
          </text>
          <text x={px + 4} y={(oy + qy) / 2 + 3} textAnchor="start" className="sch-note">
            Q = {num(c.Q, 'var', 3)}
          </text>
          <text x={(ox + px) / 2 - 6} y={(oy + qy) / 2 - 4} textAnchor="end" className="sch-note">
            |S| = {num(c.S, 'VA', 3)}
          </text>
        </svg>
        <figcaption>
          the power triangle — cos φ = <b>{c.pf.toPrecision(3)}</b>, φ = <b>{((c.phi * 180) / Math.PI).toFixed(1)}°</b>
        </figcaption>
      </figure>
      <figure>
        <svg viewBox={`0 0 ${PW} ${PH}`} role="img" aria-label="instantaneous power over one cycle with its average">
          <line x1={pad} y1={yOf(0)} x2={PW - pad} y2={yOf(0)} className="tri-axis" />
          <line x1={pad} y1={yOf(c.mean)} x2={PW - pad} y2={yOf(c.mean)} className="tri-mean" />
          <path d={path} className="tri-trace" />
          <text x={pad} y={10} textAnchor="start" className="sch-note tri-mean-label">
            average (dashed) = {num(c.mean, 'W', 3)}
          </text>
        </svg>
        <figcaption>p(t) = v(t)·i(t) the source delivers over one cycle — it dips below zero while the inductor gives its energy back</figcaption>
      </figure>
    </div>
  )
}

/** D5: the equivalent circuit beside the load line it shares with the original. */
export function EquivalentPane({ x, exp }) {
  const eqv = equivalentOf(x, exp.port)
  const layout = { ...eqv.layout, crop: layoutExtent(eqv.layout, eqv.elements) }
  const line = eqv.line
  const W = 260
  const H = 160
  const pad = 28
  const sx = line ? (W - 2 * pad) / Math.max(line.isc, 1e-30) : 1
  const sy = line ? (H - 2 * pad) / Math.max(line.voc, 1e-30) : 1
  const X = (i) => pad + i * sx
  const Y = (v) => H - pad - v * sy
  return (
    <div className="pane-grid two equivalent" data-role="equivalent">
      <figure>
        <Schematic className="big" elements={eqv.elements} layout={layout} meters={eqv.meters} show="v" />
        <figcaption>
          seen from {exp.port[0]}: V_th <b>{num(x.thevenin.voc, 'V', 4)}</b> behind R_th <b>{num(x.thevenin.rth.test, 'Ω', 4)}</b>
        </figcaption>
      </figure>
      {line ? (
        <figure>
          <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="load line">
            <line x1={pad} y1={H - pad} x2={W - pad + 6} y2={H - pad} className="tri-axis" />
            <line x1={pad} y1={H - pad} x2={pad} y2={pad - 6} className="tri-axis" />
            <line x1={X(0)} y1={Y(line.voc)} x2={X(line.isc)} y2={Y(0)} className="tri-s" />
            {line.points.map((q) => (
              <circle key={q.R} cx={X(q.i)} cy={Y(q.v)} r="3" className="tri-dot" />
            ))}
            <text x={pad + 4} y={Y(line.voc) - 4} className="sch-note" textAnchor="start">
              V_oc = {num(line.voc, 'V', 3)}
            </text>
            <text x={X(line.isc)} y={H - pad + 12} className="sch-note" textAnchor="end">
              I_sc = {num(line.isc, 'A', 3)}
            </text>
            <text x={W / 2} y={H - 4} className="sch-note" textAnchor="middle">
              i drawn from the port →
            </text>
          </svg>
          <figcaption>
            the load line v = V_oc − R_th·i, with five loads on the <em>original</em> circuit as dots, and they lie on the equivalent’s line
          </figcaption>
        </figure>
      ) : null}
    </div>
  )
}
