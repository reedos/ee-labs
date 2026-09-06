import React from 'react'
import { fmt } from '@ee-labs/ui'
import { TRACES } from '../experiments.js'
import { TRACE_COLORS } from './ScopeCanvas.jsx'
import { jkDrawings, JK_FRAMES, JK_SIGNALS, JK_NAMES } from './schematicsJk.jsx'

// Schematics, drawn as SVG — the same kit and the same sidebar slot as Circuit
// Lab's, so a reader moving between the labs meets one drawing style.
//
// A converter is defined by where its switch and its diode sit; a scope trace
// of v_sw means nothing until you know which node that is. So every experiment
// gets its circuit, hand-drawn per topology rather than generated from the
// state matrices: nine readable diagrams beat a layout engine that produces
// nine awkward ones. The component values are live, so the picture always
// matches the plots, and the freewheel path follows the sync toggle — the two
// cannot drift apart while schematics.test.js holds.
//
// Colours follow Circuit Lab: resistors green, capacitors amber, inductors
// blue, wires grey. Switches and diodes are new here and take the plain text
// colour, so the passive parts keep the palette they have in the other lab.

const FRAME = { w: 300, h: 150 }
// Taller and wider frames for the bridges, which do not fit the standard box.
const FRAMES = {
  ...JK_FRAMES,
  bridge: { w: 300, h: 185 },
  six: { w: 310, h: 190 },
  flyback: { w: 300, h: 205 },
  halfbridge: { w: 390, h: 200 },
  square: { w: 350, h: 226 },
  spwm: { w: 350, h: 226 },
}

// The standard frame's rails and mid-line.
const TOP = 42
const BOT = 110
const MID = 76
const SRC = 34

const ohms = (v) => fmt(v, 'Ω', 3)
const farads = (v) => fmt(v, 'F', 3)
const henries = (v) => fmt(v, 'H', 3)
const volts = (v) => fmt(v, 'V', 3)

const Wire = ({ x1, y1, x2, y2 }) => (
  <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="var(--line-bright)" strokeWidth="1.5" />
)

const Dot = ({ x, y }) => <circle cx={x} cy={y} r="2.5" fill="var(--line-bright)" />

/** Free text in the schematic's own type. */
const Tag = ({ x, y, children, anchor = 'middle', cls = 'sch-label' }) => (
  <text className={cls} x={x} y={y} textAnchor={anchor}>
    {children}
  </text>
)

/**
 * A label for a vertical element, placed clear of it: `left` and `right` sit at
 * mid-height, `below` under the element. Each drawing picks the side that is
 * empty, which is why this is a choice and not a default.
 */
const SideLabel = ({ x, y, side, children }) =>
  side === 'below' ? (
    <Tag x={x} y={y + 56}>{children}</Tag>
  ) : side === 'above' ? (
    <Tag x={x} y={y - 40}>{children}</Tag>
  ) : (
    <Tag x={side === 'left' ? x - 16 : x + 16} y={y + 4} anchor={side === 'left' ? 'end' : 'start'}>
      {children}
    </Tag>
  )

/** Resistor: the zigzag, drawn along x or y. */
function Res({ x, y, vertical = false, label, side = 'right' }) {
  const n = 6
  const len = 40
  const amp = 7
  const pts = []
  for (let i = 0; i <= n * 2; i++) {
    const t = (i / (n * 2)) * len - len / 2
    const off = i === 0 || i === n * 2 ? 0 : (i % 2 ? 1 : -1) * amp
    pts.push(vertical ? `${x + off},${y + t}` : `${x + t},${y + off}`)
  }
  return (
    <g>
      <polyline points={pts.join(' ')} fill="none" stroke="var(--accent)" strokeWidth="1.6" />
      {label ? vertical ? <SideLabel x={x} y={y} side={side}>{label}</SideLabel> : <Tag x={x} y={y - 14}>{label}</Tag> : null}
    </g>
  )
}

/** Capacitor: two plates with a gap, leads included. */
function Cap({ x, y, vertical = true, label, side = 'left' }) {
  const half = 9
  const gap = 5
  return (
    <g>
      <g stroke="var(--amber)" strokeWidth="1.8" fill="none">
        {vertical ? (
          <>
            <line x1={x - half} y1={y - gap} x2={x + half} y2={y - gap} />
            <line x1={x - half} y1={y + gap} x2={x + half} y2={y + gap} />
            <line x1={x} y1={y - 20} x2={x} y2={y - gap} />
            <line x1={x} y1={y + gap} x2={x} y2={y + 20} />
          </>
        ) : (
          <>
            <line x1={x - gap} y1={y - half} x2={x - gap} y2={y + half} />
            <line x1={x + gap} y1={y - half} x2={x + gap} y2={y + half} />
            <line x1={x - 20} y1={y} x2={x - gap} y2={y} />
            <line x1={x + gap} y1={y} x2={x + 20} y2={y} />
          </>
        )}
      </g>
      {label ? vertical ? <SideLabel x={x} y={y} side={side}>{label}</SideLabel> : <Tag x={x} y={y - 14}>{label}</Tag> : null}
    </g>
  )
}

/** Inductor: a run of half circles, leads included. */
function Ind({ x, y, vertical = false, label, side = 'left' }) {
  const n = 4
  const r = 5
  const len = n * 2 * r
  let d = ''
  for (let i = 0; i < n; i++) {
    if (vertical) {
      const y0 = y - len / 2 + i * 2 * r
      d += `M ${x} ${y0} A ${r} ${r} 0 0 1 ${x} ${y0 + 2 * r} `
    } else {
      const x0 = x - len / 2 + i * 2 * r
      d += `M ${x0} ${y} A ${r} ${r} 0 0 1 ${x0 + 2 * r} ${y} `
    }
  }
  return (
    <g>
      <path d={d} fill="none" stroke="var(--blue)" strokeWidth="1.8" />
      {vertical ? (
        <>
          <Wire x1={x} y1={y - len / 2 - 12} x2={x} y2={y - len / 2} />
          <Wire x1={x} y1={y + len / 2} x2={x} y2={y + len / 2 + 12} />
        </>
      ) : (
        <>
          <Wire x1={x - len / 2 - 12} y1={y} x2={x - len / 2} y2={y} />
          <Wire x1={x + len / 2} y1={y} x2={x + len / 2 + 12} y2={y} />
        </>
      )}
      {label ? vertical ? <SideLabel x={x} y={y} side={side}>{label}</SideLabel> : <Tag x={x} y={y - 13}>{label}</Tag> : null}
    </g>
  )
}

/**
 * A two-terminal part drawn along the line p1 → p2, at whatever angle: the
 * bridge's diodes sit on the diamond's sides, so the symbols have to rotate.
 * The wire is drawn full length and the symbol laid over its middle.
 */
function Along({ x1, y1, x2, y2, children }) {
  const deg = (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI
  return (
    <g>
      <Wire x1={x1} y1={y1} x2={x2} y2={y2} />
      <g transform={`translate(${(x1 + x2) / 2} ${(y1 + y2) / 2}) rotate(${deg})`}>{children}</g>
    </g>
  )
}

/** Diode: the triangle points from anode (p1) to cathode (p2), where the bar is. */
const Diode = ({ x1, y1, x2, y2 }) => (
  <Along x1={x1} y1={y1} x2={x2} y2={y2}>
    <polygon points="-5,-7 -5,7 5,0" fill="var(--text)" />
    <line x1="5" y1="-7" x2="5" y2="7" stroke="var(--text)" strokeWidth="1.8" />
  </Along>
)

/** A switch, drawn open: the blade lifted off its contact. */
const Switch = ({ x1, y1, x2, y2 }) => (
  <Along x1={x1} y1={y1} x2={x2} y2={y2}>
    <rect x="-11" y="-9" width="22" height="18" fill="var(--panel-2)" stroke="none" />
    <circle cx="-9" cy="0" r="2.5" fill="var(--text)" />
    <circle cx="9" cy="0" r="2.5" fill="var(--text)" />
    <line x1="-9" y1="0" x2="9" y2="-10" stroke="var(--text)" strokeWidth="1.8" />
  </Along>
)

/** Triac: back-to-back triangles with a gate lead. */
const Triac = ({ x1, y1, x2, y2 }) => (
  <Along x1={x1} y1={y1} x2={x2} y2={y2}>
    <rect x="-13" y="-11" width="26" height="22" fill="var(--panel-2)" stroke="none" />
    <polygon points="-11,-8 -11,8 0,0" fill="var(--text)" />
    <polygon points="11,-8 11,8 0,0" fill="var(--text)" />
    <line x1="0" y1="-9" x2="0" y2="9" stroke="var(--text)" strokeWidth="1.8" />
    <line x1="0" y1="9" x2="0" y2="19" stroke="var(--text)" strokeWidth="1.4" />
  </Along>
)

/** DC source: a circle with its polarity, wired between the two rails. */
const SrcDC = ({ x, y, label }) => (
  <g>
    <Wire x1={x} y1={y - 30} x2={x} y2={y - 13} />
    <Wire x1={x} y1={y + 13} x2={x} y2={y + 30} />
    <circle cx={x} cy={y} r="13" fill="none" stroke="var(--line-bright)" strokeWidth="1.5" />
    <text className="sch-sign" x={x} y={y - 2} textAnchor="middle">
      +
    </text>
    <text className="sch-sign" x={x} y={y + 12} textAnchor="middle">
      −
    </text>
    {label ? <Tag x={x} y={y + 48}>{label}</Tag> : null}
  </g>
)

/** AC source: a circle with a sine in it. */
const SrcAC = ({ x, y, label, lead = 30 }) => (
  <g>
    <Wire x1={x} y1={y - lead} x2={x} y2={y - 13} />
    <Wire x1={x} y1={y + 13} x2={x} y2={y + lead} />
    <circle cx={x} cy={y} r="13" fill="none" stroke="var(--line-bright)" strokeWidth="1.5" />
    <path
      d={`M ${x - 7} ${y} A 3.5 3.5 0 0 1 ${x} ${y} A 3.5 3.5 0 0 0 ${x + 7} ${y}`}
      fill="none"
      stroke="var(--line-bright)"
      strokeWidth="1.5"
    />
    {label ? <Tag x={x} y={y + 48}>{label}</Tag> : null}
  </g>
)

const Gnd = ({ x, y }) => (
  <g stroke="var(--dim)" strokeWidth="1.5">
    <line x1={x} y1={y} x2={x} y2={y + 8} />
    <line x1={x - 9} y1={y + 8} x2={x + 9} y2={y + 8} />
    <line x1={x - 5} y1={y + 12} x2={x + 5} y2={y + 12} />
    <line x1={x - 2} y1={y + 16} x2={x + 2} y2={y + 16} />
  </g>
)

/**
 * A part the conduction scrub can light.
 *
 * The scrub asks the engine which devices carry current in the switch state
 * it is showing, and everything else in the drawing goes dim. So each part
 * that can conduct is wrapped and named with the id the engine's state names
 * it by, and `schematics.test.jsx` holds the two lists together.
 */
const Part = ({ id, live, children }) => (
  <g data-part={id} className={live ? (live.conducting.includes(id) ? 'sch-live' : 'sch-idle') : undefined}>
    {children}
  </g>
)

/**
 * A transformer: two windings facing a core, with the polarity dots that
 * decide which way the secondary swings. The flyback's dots are opposite,
 * which is what makes the secondary conduct when the switch opens.
 */
const Xfmr = ({ x, y, label, span = 32, flip = false }) => (
  <g>
    <Ind x={x - 20} y={y} vertical />
    <Ind x={x + 20} y={y} vertical />
    <line x1={x - 3} y1={y - span} x2={x - 3} y2={y + span} stroke="var(--line-bright)" strokeWidth="1.4" />
    <line x1={x + 3} y1={y - span} x2={x + 3} y2={y + span} stroke="var(--line-bright)" strokeWidth="1.4" />
    <circle cx={x - 28} cy={y - 22} r="2.4" fill="var(--text)" />
    <circle cx={x + 28} cy={flip ? y + 22 : y - 22} r="2.4" fill="var(--text)" />
    {label ? <Tag x={x} y={y + span + 22}>{label}</Tag> : null}
  </g>
)

const Port = ({ x, y, label }) => (
  <g>
    <circle cx={x} cy={y} r="3" fill="var(--line-bright)" />
    <text className="sch-port" x={x - 8} y={y + 4} textAnchor="end">
      {label}
    </text>
  </g>
)

/**
 * Where a signal is measured, in the colour the scope draws it.
 *
 * The measures table lists eight or so signals per circuit and the scope draws
 * them in colour, but neither says where in the circuit they are — and a trace
 * called v_sw means nothing until you can point at the node. So every signal
 * the table lists gets a mark here, in its own trace colour: a dot on the node
 * for a voltage, an arrow along the wire for a current, pointing the way the
 * measurement counts as positive.
 */
const Probe = ({ sig, x, y, dx = 0, dy = -5, anchor = 'middle' }) => (
  <text className="sch-sig" x={x + dx} y={y + dy} textAnchor={anchor} fill={TRACE_COLORS[sig]}>
    {TRACES[sig].label}
  </text>
)

/** A voltage: the node it is measured at. */
const VAt = ({ sig, x, y, ...rest }) => (
  <g>
    <circle cx={x} cy={y} r="2.6" fill={TRACE_COLORS[sig]} />
    <Probe sig={sig} x={x} y={y} {...rest} />
  </g>
)

/** A voltage across a part, marked by its two ends rather than one node. */
const VAcross = ({ sig, x1, y1, x2, y2, ...rest }) => (
  <g>
    <circle cx={x1} cy={y1} r="2.2" fill={TRACE_COLORS[sig]} />
    <circle cx={x2} cy={y2} r="2.2" fill={TRACE_COLORS[sig]} />
    <Probe sig={sig} x={(x1 + x2) / 2} y={(y1 + y2) / 2} {...rest} />
  </g>
)

/** A current: an arrow on the wire, pointing the way it is counted. */
const IAt = ({ sig, x, y, dir = 'right', ...rest }) => {
  const deg = { right: 0, down: 90, left: 180, up: 270 }[dir]
  return (
    <g>
      <g transform={`translate(${x} ${y}) rotate(${deg})`}>
        <polygon points="-4,-4 -4,4 4,0" fill={TRACE_COLORS[sig]} />
      </g>
      <Probe sig={sig} x={x} y={y} {...rest} />
    </g>
  )
}

/**
 * The kit, handed out so a group built in its own file draws in the same
 * hand. It is passed to `jkDrawings` rather than imported by it, because a
 * drawing that imports this module while this module is importing it would
 * read the kit before it exists.
 */
export const KIT = {
  Wire, Dot, Tag, SideLabel, Res, Cap, Ind, Along, Diode, Switch, Triac,
  SrcDC, SrcAC, Gnd, Part, Xfmr, Port, Probe, VAt, VAcross, IAt,
  ohms, farads, henries, volts, fmt,
  TOP, BOT, MID, SRC,
}

// ------------------------------------------------------------ per topology
//
// Each takes the effective parameters (analysis.js's `p`, so a knob an
// experiment leaves out still shows the value the engine used).

const DRAW = {
  linreg: (p) => (
    <>
      <SrcDC x={SRC} y={MID} label={`V_in ${volts(p.Vin)}`} />
      <Wire x1={SRC} y1={TOP} x2={114} y2={TOP} />
      {/* The pass element drawn as the resistor it behaves like. At any
          operating point it is (V_in − V_out)/I of resistance, and the whole
          lesson is that this resistance turns the drop into heat; a box
          labelled "pass" said only that something unexplained sits here. Turn
          V_out and the value moves — it is a resistor that adjusts itself to
          hold the output, which is what a regulator is. */}
      <Res x={134} y={TOP} label={`R_pass ${ohms((p.R * (p.Vin - p.Vo)) / p.Vo)}`} />
      <Tag x={134} y={62}>{`drops ${volts(p.Vin - p.Vo)}`}</Tag>
      <Wire x1={154} y1={TOP} x2={260} y2={TOP} />
      <Wire x1={260} y1={TOP} x2={260} y2={MID - 20} />
      <Res x={260} y={MID} vertical label={`R ${ohms(p.R)}`} side="below" />
      <Wire x1={260} y1={MID + 20} x2={260} y2={BOT} />
      <Wire x1={SRC} y1={BOT} x2={260} y2={BOT} />
      <Gnd x={143} y={BOT} />
      <VAt sig="vsw" x={100} y={TOP} dy={-6} />
      <IAt sig="iin" x={60} y={TOP} dy={-6} />
      <IAt sig="iQ" x={180} y={TOP} dy={-6} />
      <VAt sig="vout" x={230} y={TOP} dy={-6} />
      <IAt sig="iL" x={260} y={51} dir="down" dx={-6} dy={4} anchor="end" />
    </>
  ),

  chopper: (p) => (
    <>
      <SrcDC x={SRC} y={MID} label={`V_in ${volts(p.Vin)}`} />
      <Wire x1={SRC} y1={TOP} x2={100} y2={TOP} />
      <Tag x={120} y={22}>{`Q  D = ${p.D.toFixed(3)}`}</Tag>
      <Switch x1={100} y1={TOP} x2={140} y2={TOP} />
      <Wire x1={140} y1={TOP} x2={260} y2={TOP} />
      <Wire x1={260} y1={TOP} x2={260} y2={MID - 20} />
      <Res x={260} y={MID} vertical label={`R ${ohms(p.R)}`} side="below" />
      <Wire x1={260} y1={MID + 20} x2={260} y2={BOT} />
      <Wire x1={SRC} y1={BOT} x2={260} y2={BOT} />
      <Gnd x={143} y={BOT} />
      {/* No filter: the switch node is the output and the source, switch and
          load currents are one current. One probe per distinct signal. */}
      <VAt sig="vout" x={200} y={TOP} dy={-6} />
      <IAt sig="iR" x={260} y={51} dir="down" dx={-6} dy={4} anchor="end" />
    </>
  ),

  // The switch feeds the inductor; the diode carries its current while the
  // switch is off. With the sync toggle on, that diode is a second switch.
  buck: (p, live) => (
    <>
      <SrcDC x={SRC} y={MID} label={`V_in ${volts(p.Vin)}`} />
      <Wire x1={SRC} y1={TOP} x2={76} y2={TOP} />
      <Tag x={96} y={22}>Q</Tag>
      <Part id="Q" live={live}><Switch x1={76} y1={TOP} x2={116} y2={TOP} /></Part>
      <Wire x1={116} y1={TOP} x2={138} y2={TOP} />
      <Dot x={134} y={TOP} />
      <Part id="D" live={live}>
        {p.sync ? <Switch x1={134} y1={BOT} x2={134} y2={TOP} /> : <Diode x1={134} y1={BOT} x2={134} y2={TOP} />}
      </Part>
      <Tag x={126} y={MID + 4} anchor="end">{p.sync ? 'Q₂' : 'D'}</Tag>
      <Part id="L" live={live}><Ind x={170} y={TOP} label={`L ${henries(p.L)}`} /></Part>
      <Wire x1={202} y1={TOP} x2={206} y2={TOP} />
      <Dot x={206} y={TOP} />
      <Wire x1={206} y1={TOP} x2={206} y2={MID - 20} />
      <Part id="C" live={live}><Cap x={206} y={MID} label={`C ${farads(p.C)}`} side="below" /></Part>
      <Wire x1={206} y1={MID + 20} x2={206} y2={BOT} />
      <Wire x1={206} y1={TOP} x2={260} y2={TOP} />
      <Wire x1={260} y1={TOP} x2={260} y2={MID - 20} />
      <Part id="R" live={live}><Res x={260} y={MID} vertical label={`R ${ohms(p.R)}`} side="below" /></Part>
      <Wire x1={260} y1={MID + 20} x2={260} y2={BOT} />
      <Wire x1={SRC} y1={BOT} x2={260} y2={BOT} />
      <Gnd x={170} y={BOT} />
      <IAt sig="iin" x={62} y={TOP} dy={-6} />
      <IAt sig="iQ" x={124} y={TOP} dy={-6} />
      <VAt sig="vsw" x={134} y={TOP} dx={-6} dy={12} anchor="end" />
      <IAt sig="iD" x={134} y={96} dir="up" dx={-6} dy={0} anchor="end" />
      <VAcross sig="vL" x1={140} y1={TOP} x2={202} y2={TOP} dy={16} />
      <IAt sig="iL" x={196} y={TOP} dy={-6} />
      <IAt sig="iC" x={206} y={51} dir="down" dx={-6} dy={4} anchor="end" />
      <VAt sig="vout" x={232} y={TOP} dx={4} dy={-6} anchor="start" />
    </>
  ),

  // The inductor charges from the source through the switch to ground, then
  // discharges through the diode in series with the source.
  boost: (p) => (
    <>
      <SrcDC x={SRC} y={MID} label={`V_in ${volts(p.Vin)}`} />
      <Wire x1={SRC} y1={TOP} x2={56} y2={TOP} />
      <Ind x={88} y={TOP} label={`L ${henries(p.L)}`} />
      <Wire x1={120} y1={TOP} x2={140} y2={TOP} />
      <Dot x={140} y={TOP} />
      <Switch x1={140} y1={TOP} x2={140} y2={BOT} />
      <Tag x={132} y={MID + 4} anchor="end">Q</Tag>
      <Tag x={172} y={22}>D</Tag>
      <Diode x1={140} y1={TOP} x2={200} y2={TOP} />
      <Wire x1={200} y1={TOP} x2={206} y2={TOP} />
      <Dot x={206} y={TOP} />
      <Wire x1={206} y1={TOP} x2={206} y2={MID - 20} />
      <Cap x={206} y={MID} label={`C ${farads(p.C)}`} side="below" />
      <Wire x1={206} y1={MID + 20} x2={206} y2={BOT} />
      <Wire x1={206} y1={TOP} x2={260} y2={TOP} />
      <Wire x1={260} y1={TOP} x2={260} y2={MID - 20} />
      <Res x={260} y={MID} vertical label={`R ${ohms(p.R)}`} side="below" />
      <Wire x1={260} y1={MID + 20} x2={260} y2={BOT} />
      <Wire x1={SRC} y1={BOT} x2={260} y2={BOT} />
      <Gnd x={175} y={BOT} />
      <IAt sig="iin" x={48} y={TOP} dy={-6} />
      <IAt sig="iL" x={128} y={TOP} dy={-6} />
      <VAt sig="vsw" x={140} y={TOP} dx={-6} dy={14} anchor="end" />
      <IAt sig="iQ" x={140} y={96} dir="down" dx={6} dy={0} anchor="start" />
      <IAt sig="iD" x={186} y={TOP} dy={-6} />
      <VAcross sig="vL" x1={58} y1={TOP} x2={120} y2={TOP} dy={16} />
      <IAt sig="iC" x={206} y={51} dir="down" dx={-6} dy={4} anchor="end" />
      <VAt sig="vout" x={232} y={TOP} dx={4} dy={-6} anchor="start" />
    </>
  ),

  // The inductor is charged to ground and then discharges into the output
  // through the diode — which points back towards the switch node, so the
  // output ends up below ground.
  buckboost: (p) => (
    <>
      <SrcDC x={SRC} y={MID} label={`V_in ${volts(p.Vin)}`} />
      <Wire x1={SRC} y1={TOP} x2={72} y2={TOP} />
      <Tag x={94} y={22}>Q</Tag>
      <Switch x1={72} y1={TOP} x2={116} y2={TOP} />
      <Wire x1={116} y1={TOP} x2={140} y2={TOP} />
      <Dot x={140} y={TOP} />
      <Ind x={140} y={MID} vertical label={`L ${henries(p.L)}`} side="left" />
      <Tag x={173} y={22}>D</Tag>
      <Diode x1={206} y1={TOP} x2={140} y2={TOP} />
      <Dot x={206} y={TOP} />
      <Wire x1={206} y1={TOP} x2={206} y2={MID - 20} />
      <Cap x={206} y={MID} label={`C ${farads(p.C)}`} side="below" />
      <Wire x1={206} y1={MID + 20} x2={206} y2={BOT} />
      <Wire x1={206} y1={TOP} x2={260} y2={TOP} />
      <Wire x1={260} y1={TOP} x2={260} y2={MID - 20} />
      <Res x={260} y={MID} vertical label={`R ${ohms(p.R)}`} side="below" />
      <Wire x1={260} y1={MID + 20} x2={260} y2={BOT} />
      <Wire x1={SRC} y1={BOT} x2={260} y2={BOT} />
      <Gnd x={175} y={BOT} />
      <IAt sig="iin" x={60} y={TOP} dy={-6} />
      <IAt sig="iQ" x={126} y={TOP} dy={-6} />
      <VAt sig="vsw" x={140} y={TOP} dx={-30} dy={14} anchor="end" />
      <IAt sig="iL" x={140} y={100} dir="down" dx={6} dy={0} anchor="start" />
      <VAcross sig="vL" x1={140} y1={56} x2={140} y2={96} dx={-8} dy={-14} anchor="end" />
      <IAt sig="iD" x={176} y={TOP} dir="left" dy={-6} />
      <IAt sig="iC" x={206} y={51} dir="down" dx={-6} dy={4} anchor="end" />
      <VAt sig="vout" x={232} y={TOP} dx={4} dy={-6} anchor="start" />
      {/* The load's own polarity says the inversion better than a label can:
          its top end is the negative one. */}
      <Tag x={272} y={62} cls="sch-sign" anchor="start">−</Tag>
      <Tag x={272} y={104} cls="sch-sign" anchor="start">+</Tag>
      <Tag x={150} y={143} cls="sch-note">
        the load sits below ground: V_out is negative
      </Tag>
    </>
  ),

  // A buck-boost whose inductor grew a second winding. The dots are opposite,
  // which is what makes the secondary conduct only when the switch opens, and
  // the two bottom rails never meet: that gap is the isolation.
  flyback: (p, live) => (
    <>
      <SrcDC x={30} y={100} label={`V_in ${volts(p.Vin)}`} />
      <Wire x1={30} y1={44} x2={30} y2={70} />
      <Wire x1={30} y1={130} x2={30} y2={156} />
      <Wire x1={30} y1={44} x2={112} y2={44} />
      <Wire x1={112} y1={44} x2={112} y2={68} />
      <Part id="T" live={live}>
        <Xfmr x={132} y={100} label={`${fmt(1 / (p.n || 0.5), '', 3)}:1`} />
      </Part>
      <Wire x1={112} y1={132} x2={112} y2={156} />
      <Part id="Q" live={live}>
        <Switch x1={112} y1={156} x2={68} y2={156} />
      </Part>
      <Tag x={90} y={176}>Q</Tag>
      <Wire x1={68} y1={156} x2={30} y2={156} />
      <Wire x1={152} y1={68} x2={152} y2={44} />
      <Tag x={186} y={30}>D</Tag>
      <Part id="D" live={live}>
        <Diode x1={152} y1={44} x2={210} y2={44} />
      </Part>
      <Wire x1={210} y1={44} x2={216} y2={44} />
      <Dot x={216} y={44} />
      <Wire x1={216} y1={44} x2={216} y2={80} />
      <Part id="C" live={live}>
        <Cap x={216} y={100} label={`C ${farads(p.C)}`} side="below" />
      </Part>
      <Wire x1={216} y1={120} x2={216} y2={156} />
      <Wire x1={216} y1={44} x2={268} y2={44} />
      <Wire x1={268} y1={44} x2={268} y2={80} />
      <Part id="R" live={live}>
        <Res x={268} y={100} vertical label={`R ${ohms(p.R)}`} side="below" />
      </Part>
      <Wire x1={268} y1={120} x2={268} y2={156} />
      <Wire x1={152} y1={132} x2={152} y2={156} />
      <Wire x1={152} y1={156} x2={268} y2={156} />
      <Gnd x={196} y={156} />
      <IAt sig="iin" x={62} y={44} dy={-6} />
      <IAt sig="iQ" x={112} y={144} dir="down" dx={6} dy={0} anchor="start" />
      <VAt sig="vsw" x={112} y={132} dx={-8} dy={0} anchor="end" />
      <IAt sig="iL" x={112} y={82} dir="down" dx={-6} dy={0} anchor="end" />
      <VAcross sig="vL" x1={112} y1={68} x2={112} y2={90} dx={-8} dy={-14} anchor="end" />
      <IAt sig="iD" x={190} y={44} dy={-6} />
      <IAt sig="iC" x={216} y={54} dir="down" dx={-6} dy={4} anchor="end" />
      <VAt sig="vout" x={240} y={44} dx={4} dy={-6} anchor="start" />
      <Tag x={168} y={196} cls="sch-note">
        no path from input to output but the core
      </Tag>
    </>
  ),

  // Two switches across the rail drive the primary through a blocking
  // capacitor, so the winding sees ±V_in/2. The rectified secondary feeds the
  // filter twice a period, and both rectifier legs share the inductor current
  // while neither switch is on.
  halfbridge: (p, live) => (
    <>
      <SrcDC x={28} y={104} label={`V_in ${volts(p.Vin)}`} />
      <Wire x1={28} y1={40} x2={28} y2={74} />
      <Wire x1={28} y1={134} x2={28} y2={168} />
      <Wire x1={28} y1={40} x2={76} y2={40} />
      <Part id="Q1" live={live}>
        <Switch x1={76} y1={40} x2={76} y2={90} />
      </Part>
      <Tag x={60} y={62} anchor="end">Q₁</Tag>
      <Wire x1={76} y1={90} x2={76} y2={118} />
      <Dot x={76} y={104} />
      <Part id="Q2" live={live}>
        <Switch x1={76} y1={118} x2={76} y2={168} />
      </Part>
      <Tag x={60} y={148} anchor="end">Q₂</Tag>
      <Wire x1={28} y1={168} x2={76} y2={168} />
      <Wire x1={76} y1={104} x2={104} y2={104} />
      <Wire x1={104} y1={104} x2={104} y2={52} />
      <Cap x={124} y={52} vertical={false} label="C_b" />
      <Wire x1={144} y1={52} x2={160} y2={52} />
      <Part id="T" live={live}>
        <Xfmr x={180} y={104} label={`${fmt(1 / (p.n || 0.25), '', 3)}:1`} flip />
      </Part>
      <Wire x1={160} y1={52} x2={160} y2={72} />
      <Wire x1={160} y1={136} x2={160} y2={168} />
      <Wire x1={160} y1={168} x2={76} y2={168} />
      <Wire x1={200} y1={72} x2={212} y2={72} />
      <Tag x={236} y={60}>D₁</Tag>
      <Part id="D1" live={live}>
        <Diode x1={212} y1={72} x2={252} y2={72} />
      </Part>
      <Wire x1={200} y1={136} x2={212} y2={136} />
      <Tag x={236} y={156}>D₂</Tag>
      <Part id="D2" live={live}>
        <Diode x1={212} y1={136} x2={252} y2={136} />
      </Part>
      <Wire x1={252} y1={72} x2={256} y2={72} />
      <Wire x1={252} y1={136} x2={256} y2={136} />
      <Wire x1={256} y1={72} x2={256} y2={136} />
      <Dot x={256} y={104} />
      <Wire x1={256} y1={104} x2={256} y2={40} />
      <Part id="L" live={live}>
        <Ind x={288} y={40} label={`L ${henries(p.L)}`} />
      </Part>
      <Wire x1={320} y1={40} x2={326} y2={40} />
      <Dot x={326} y={40} />
      <Wire x1={326} y1={40} x2={326} y2={84} />
      <Part id="C" live={live}>
        <Cap x={326} y={104} label={`C ${farads(p.C)}`} side="below" />
      </Part>
      <Wire x1={326} y1={124} x2={326} y2={182} />
      <Wire x1={326} y1={40} x2={366} y2={40} />
      <Wire x1={366} y1={40} x2={366} y2={84} />
      <Part id="R" live={live}>
        <Res x={366} y={104} vertical label={`R ${ohms(p.R)}`} side="below" />
      </Part>
      <Wire x1={366} y1={124} x2={366} y2={182} />
      <Wire x1={180} y1={104} x2={180} y2={182} />
      <Wire x1={180} y1={182} x2={366} y2={182} />
      <Gnd x={276} y={182} />
      <IAt sig="iin" x={54} y={40} dy={-6} />
      <IAt sig="iQ" x={76} y={78} dir="down" dx={6} dy={0} anchor="start" />
      <VAt sig="vsw" x={256} y={72} dx={-6} dy={-8} anchor="end" />
      <IAt sig="iD" x={240} y={72} dy={-8} />
      <VAcross sig="vL" x1={260} y1={40} x2={318} y2={40} dy={-8} />
      <IAt sig="iL" x={314} y={40} dy={-8} />
      <IAt sig="iC" x={326} y={58} dir="down" dx={-6} dy={4} anchor="end" />
      <VAt sig="vout" x={344} y={40} dx={4} dy={-8} anchor="start" />
    </>
  ),

  half: (p) => (
    <>
      <SrcAC x={SRC} y={MID} label={`V_s ${volts(p.Vs)}`} />
      <Wire x1={SRC} y1={TOP} x2={56} y2={TOP} />
      <Res x={76} y={TOP} label={`R_s ${ohms(p.Rs)}`} />
      <Wire x1={96} y1={TOP} x2={110} y2={TOP} />
      <Tag x={137} y={22}>{`V_f ${volts(p.Vf)}`}</Tag>
      <Diode x1={110} y1={TOP} x2={164} y2={TOP} />
      <Wire x1={164} y1={TOP} x2={206} y2={TOP} />
      <Dot x={206} y={TOP} />
      <Wire x1={206} y1={TOP} x2={206} y2={MID - 20} />
      <Cap x={206} y={MID} label={`C ${farads(p.C)}`} side="below" />
      <Wire x1={206} y1={MID + 20} x2={206} y2={BOT} />
      <Wire x1={206} y1={TOP} x2={260} y2={TOP} />
      <Wire x1={260} y1={TOP} x2={260} y2={MID - 20} />
      <Res x={260} y={MID} vertical label={`R ${ohms(p.R)}`} side="below" />
      <Wire x1={260} y1={MID + 20} x2={260} y2={BOT} />
      <Wire x1={SRC} y1={BOT} x2={260} y2={BOT} />
      <Gnd x={160} y={BOT} />
      <VAt sig="vin" x={SRC} y={TOP} dx={8} dy={-6} anchor="start" />
      <IAt sig="iin" x={104} y={TOP} dy={-6} />
      <VAt sig="vrect" x={110} y={TOP} dx={-4} dy={14} anchor="end" />
      <VAcross sig="vD" x1={110} y1={TOP} x2={164} y2={TOP} dy={26} />
      <IAt sig="iD" x={186} y={TOP} dy={-6} />
      <IAt sig="iC" x={206} y={51} dir="down" dx={-6} dy={4} anchor="end" />
      <VAt sig="vout" x={230} y={TOP} dx={4} dy={-6} anchor="start" />
      <IAt sig="iR" x={260} y={51} dir="down" dx={-6} dy={4} anchor="end" />
    </>
  ),

  // The diamond: the source sits on the chord between the two AC corners,
  // which is the one arrangement of a bridge with no wire crossing another.
  bridge: (p) => {
    const P = { x: 150, y: 48 }
    const N = { x: 150, y: 140 }
    const a = { x: 104, y: 94 }
    const b = { x: 196, y: 94 }
    return (
      <>
        <Tag x={150} y={24}>{`V_s ${volts(p.Vs)} · R_s ${ohms(p.Rs)} · V_f ${volts(p.Vf)} each`}</Tag>
        <Diode x1={a.x} y1={a.y} x2={P.x} y2={P.y} />
        <Diode x1={b.x} y1={b.y} x2={P.x} y2={P.y} />
        <Diode x1={N.x} y1={N.y} x2={a.x} y2={a.y} />
        <Diode x1={N.x} y1={N.y} x2={b.x} y2={b.y} />
        <Dot x={a.x} y={a.y} />
        <Dot x={b.x} y={b.y} />
        <Dot x={P.x} y={P.y} />
        <Dot x={N.x} y={N.y} />
        {/* The secondary and its resistance, across the two AC corners. */}
        <Wire x1={a.x} y1={a.y} x2={115} y2={a.y} />
        <SrcAC x={128} y={a.y} lead={0} />
        <Wire x1={141} y1={a.y} x2={145} y2={a.y} />
        <Res x={165} y={a.y} label={null} />
        <Wire x1={185} y1={a.y} x2={b.x} y2={b.y} />
        {/* Output: up from the top corner, down from the bottom one. */}
        <Wire x1={P.x} y1={P.y} x2={214} y2={P.y} />
        <Dot x={214} y={P.y} />
        <Wire x1={214} y1={P.y} x2={214} y2={74} />
        <Cap x={214} y={94} />
        <Tag x={214} y={160}>{`C ${farads(p.C)}`}</Tag>
        <Wire x1={214} y1={114} x2={214} y2={N.y} />
        <Wire x1={214} y1={P.y} x2={256} y2={P.y} />
        <Wire x1={256} y1={P.y} x2={256} y2={74} />
        <Res x={256} y={94} vertical />
        <Tag x={256} y={160}>{`R ${ohms(p.R)}`}</Tag>
        <Wire x1={256} y1={114} x2={256} y2={N.y} />
        <Wire x1={N.x} y1={N.y} x2={256} y2={N.y} />
        <Gnd x={170} y={N.y} />
        <VAt sig="vin" x={a.x} y={a.y} dx={-6} dy={-8} anchor="end" />
        <IAt sig="iin" x={115} y={a.y} dy={-8} />
        <VAt sig="vrect" x={P.x} y={P.y} dx={-8} dy={12} anchor="end" />
        <VAcross sig="vD" x1={a.x} y1={a.y} x2={P.x} y2={P.y} dx={-14} dy={-4} anchor="end" />
        <IAt sig="iD" x={186} y={P.y} dy={-8} />
        <IAt sig="iC" x={214} y={122} dir="down" dx={-6} dy={4} anchor="end" />
        <VAt sig="vout" x={236} y={P.y} dx={4} dy={-8} anchor="start" />
        <IAt sig="iR" x={256} y={122} dir="down" dx={-6} dy={4} anchor="end" />
      </>
    )
  },

  // Three legs of two diodes between the rails; the pair with the highest
  // line voltage conducts. The secondaries are named rather than drawn: three
  // wires to three points on one line cannot reach them without crossing.
  six: (p) => {
    const legs = [110, 150, 190]
    const PLUS = 46
    const MINUS = 150
    const NODE = 98
    return (
      <>
        <Tag x={155} y={24}>{`three secondaries, ${volts(p.Vs)} each, 120° apart`}</Tag>
        {legs.map((x, i) => (
          <g key={x}>
            <Diode x1={x} y1={NODE} x2={x} y2={PLUS} />
            <Diode x1={x} y1={MINUS} x2={x} y2={NODE} />
            <Dot x={x} y={NODE} />
            <Wire x1={x} y1={NODE} x2={x - 22} y2={NODE} />
            <circle cx={x - 22} cy={NODE} r="3" fill="var(--line-bright)" />
            <Tag x={x - 22} y={NODE - 8} cls="sch-port">{'abc'[i]}</Tag>
          </g>
        ))}
        <Wire x1={legs[0]} y1={PLUS} x2={272} y2={PLUS} />
        <Wire x1={legs[0]} y1={MINUS} x2={272} y2={MINUS} />
        <Dot x={230} y={PLUS} />
        <Wire x1={230} y1={PLUS} x2={230} y2={78} />
        <Cap x={230} y={98} />
        <Tag x={230} y={170}>{`C ${farads(p.C)}`}</Tag>
        <Wire x1={230} y1={118} x2={230} y2={MINUS} />
        <Wire x1={272} y1={PLUS} x2={272} y2={78} />
        <Res x={272} y={98} vertical />
        <Tag x={272} y={170}>{`R ${ohms(p.R)}`}</Tag>
        <Wire x1={272} y1={118} x2={272} y2={MINUS} />
        <Gnd x={170} y={MINUS} />
        <VAt sig="vin" x={legs[0] - 22} y={NODE} dx={0} dy={16} />
        <IAt sig="iin" x={legs[0] - 12} y={NODE} dy={-6} />
        <VAt sig="vrect" x={legs[0]} y={PLUS} dx={-4} dy={14} anchor="end" />
        <VAcross sig="vD" x1={legs[0]} y1={NODE} x2={legs[0]} y2={PLUS} dx={-6} dy={0} anchor="end" />
        <IAt sig="iD" x={205} y={PLUS} dy={-6} />
        <IAt sig="iC" x={230} y={132} dir="down" dx={-6} dy={4} anchor="end" />
        <VAt sig="vout" x={252} y={PLUS} dx={4} dy={-6} anchor="start" />
        <IAt sig="iR" x={272} y={132} dir="down" dx={-6} dy={4} anchor="end" />
      </>
    )
  },

  // The full bridge: two legs across the rail, the LC and the load between
  // their midpoints. Which pair is closed is the modulator's business, and the
  // caption says which modulator this is.
  bridgeInv: (p, live, opts = {}) => (
    <>
      <SrcDC x={28} y={100} label={`V_dc ${volts(p.Vdc)}`} />
      <Wire x1={28} y1={40} x2={28} y2={70} />
      <Wire x1={28} y1={130} x2={28} y2={160} />
      <Wire x1={28} y1={40} x2={92} y2={40} />
      <Wire x1={28} y1={160} x2={92} y2={160} />
      <Part id="QA" live={live}>
        <Switch x1={92} y1={40} x2={92} y2={86} />
      </Part>
      <Tag x={78} y={62} anchor="end">Q₁</Tag>
      <Wire x1={92} y1={86} x2={92} y2={114} />
      <Dot x={92} y={100} />
      <Part id="QB" live={live}>
        <Switch x1={92} y1={114} x2={92} y2={160} />
      </Part>
      <Tag x={78} y={146} anchor="end">Q₄</Tag>
      <Wire x1={92} y1={40} x2={168} y2={40} />
      <Wire x1={92} y1={160} x2={168} y2={160} />
      <Part id="QB" live={live}>
        <Switch x1={168} y1={40} x2={168} y2={86} />
      </Part>
      <Tag x={182} y={62} anchor="start">Q₃</Tag>
      <Wire x1={168} y1={86} x2={168} y2={114} />
      <Dot x={168} y={100} />
      <Part id="QA" live={live}>
        <Switch x1={168} y1={114} x2={168} y2={160} />
      </Part>
      <Tag x={182} y={146} anchor="start">Q₂</Tag>
      <Wire x1={92} y1={100} x2={92} y2={196} />
      <Wire x1={92} y1={196} x2={196} y2={196} />
      <Wire x1={168} y1={100} x2={196} y2={100} />
      <Part id="L" live={live}>
        <Ind x={228} y={100} label={`L ${henries(p.L)}`} />
      </Part>
      <Wire x1={260} y1={100} x2={266} y2={100} />
      <Dot x={266} y={100} />
      <Wire x1={266} y1={100} x2={266} y2={140} />
      <Part id="C" live={live}>
        <Cap x={266} y={160} label={`C ${farads(p.C)}`} side="below" />
      </Part>
      <Wire x1={266} y1={180} x2={266} y2={196} />
      <Wire x1={266} y1={100} x2={316} y2={100} />
      <Wire x1={316} y1={100} x2={316} y2={140} />
      <Part id="R" live={live}>
        <Res x={316} y={160} vertical label={`R ${ohms(p.R)}`} side="below" />
      </Part>
      <Wire x1={316} y1={180} x2={316} y2={196} />
      <Wire x1={196} y1={196} x2={316} y2={196} />
      <Gnd x={230} y={196} />
      <IAt sig="iin" x={60} y={40} dy={-6} />
      <VAcross sig="vsw" x1={92} y1={100} x2={168} y2={100} dy={-8} />
      <VAcross sig="vL" x1={200} y1={100} x2={258} y2={100} dy={-8} />
      <IAt sig="iL" x={254} y={100} dy={-8} />
      <IAt sig="iC" x={266} y={124} dir="down" dx={-6} dy={4} anchor="end" />
      <VAt sig="vout" x={290} y={100} dx={0} dy={-8} />
      <IAt sig="iR" x={316} y={124} dir="down" dx={-6} dy={4} anchor="end" />
      <Tag x={180} y={22}>{opts.caption || 'the modulator closes one diagonal at a time'}</Tag>
    </>
  ),

  dimmer: (p) => (
    <>
      <SrcAC x={SRC} y={MID} label={`V_s ${volts(p.Vs)}`} />
      <Wire x1={SRC} y1={TOP} x2={116} y2={TOP} />
      <Tag x={140} y={22}>{`α = ${((p.alpha * 180) / Math.PI).toFixed(0)}°`}</Tag>
      <Triac x1={116} y1={TOP} x2={164} y2={TOP} />
      <Wire x1={164} y1={TOP} x2={260} y2={TOP} />
      <Wire x1={260} y1={TOP} x2={260} y2={MID - 20} />
      <Res x={260} y={MID} vertical label={`R ${ohms(p.R)}`} side="below" />
      <Wire x1={260} y1={MID + 20} x2={260} y2={BOT} />
      <Wire x1={SRC} y1={BOT} x2={260} y2={BOT} />
      <Gnd x={160} y={BOT} />
      <VAt sig="vin" x={SRC} y={TOP} dx={8} dy={-6} anchor="start" />
      <IAt sig="iin" x={96} y={TOP} dy={-6} />
      <VAcross sig="vD" x1={116} y1={TOP} x2={164} y2={TOP} dy={26} />
      <VAt sig="vout" x={200} y={TOP} dx={4} dy={-6} anchor="start" />
      <IAt sig="iR" x={260} y={51} dir="down" dx={-6} dy={4} anchor="end" />
      <Tag x={150} y={143} cls="sch-note">
        blocks until α into each half-cycle, then conducts
      </Tag>
    </>
  ),
}

/**
 * The signals each circuit actually carries, and therefore the ones its drawing
 * marks and its measures table lists.
 *
 * The analysis hands every experiment the same set of signal names, filling the
 * ones a topology has no part for with zeros — a linear regulator reports an
 * inductor voltage of 0 V and a dimmer reports a rectified voltage identical to
 * its output. Listing those is worse than useless: they are rows a reader
 * cannot find on the circuit, because they are not in the circuit. The same
 * goes for one node under several names: the chopper's switch node is its
 * output, and its source, switch and load currents are one current, so it
 * lists v_out and i_R and nothing twice.
 */
export const TOPOLOGY_SIGNALS = {
  linreg: ['vsw', 'vout', 'iL', 'iQ', 'iin'],
  flyback: ['vsw', 'vout', 'vL', 'iL', 'iD', 'iC', 'iQ', 'iin'],
  halfbridge: ['vsw', 'vout', 'vL', 'iL', 'iD', 'iC', 'iQ', 'iin'],
  square: ['vsw', 'vout', 'vL', 'iL', 'iC', 'iR', 'iin'],
  spwm: ['vsw', 'vout', 'vL', 'iL', 'iC', 'iR', 'iin'],
  chopper: ['vout', 'iR'],
  buck: ['vsw', 'vout', 'vL', 'iL', 'iD', 'iC', 'iQ', 'iin'],
  boost: ['vsw', 'vout', 'vL', 'iL', 'iD', 'iC', 'iQ', 'iin'],
  buckboost: ['vsw', 'vout', 'vL', 'iL', 'iD', 'iC', 'iQ', 'iin'],
  half: ['vin', 'vrect', 'vout', 'vD', 'iD', 'iC', 'iR', 'iin'],
  bridge: ['vin', 'vrect', 'vout', 'vD', 'iD', 'iC', 'iR', 'iin'],
  six: ['vin', 'vrect', 'vout', 'vD', 'iD', 'iC', 'iR', 'iin'],
  dimmer: ['vin', 'vout', 'vD', 'iR', 'iin'],
  ...JK_SIGNALS,
}

/** The signals an experiment's circuit carries. */
export function signalsOf(exp) {
  return TOPOLOGY_SIGNALS[topologyOf(exp)] || []
}

/** What the drawing is called, in the words a textbook would use. */
export const TOPOLOGY_NAMES = {
  linreg: 'Linear regulator',
  flyback: 'Flyback converter, isolated',
  halfbridge: 'Half-bridge converter, isolated',
  square: 'Full-bridge inverter, square wave',
  spwm: 'Full-bridge inverter, sine PWM',
  chopper: 'Chopper — a switch and a load, no filter',
  buck: 'Buck converter',
  boost: 'Boost converter',
  buckboost: 'Inverting buck-boost converter',
  half: 'Half-wave rectifier with a reservoir capacitor',
  bridge: 'Single-phase full-wave bridge rectifier',
  six: 'Three-phase six-pulse bridge rectifier',
  dimmer: 'Phase-cut dimmer, triac into a resistive load',
  ...JK_NAMES,
}

/** Which drawing an experiment gets: its converter, or which bridge it is. */
export function topologyOf(exp) {
  return exp.kind === 'rectifier' ? exp.rect : exp.kind
}

// The two inverter modulators are the same circuit; only the caption differs,
// and each kind is its own key so `topologyOf` finds it.
const bridgeInv = DRAW.bridgeInv
delete DRAW.bridgeInv
DRAW.square = (p, live) => bridgeInv(p, live, { caption: 'one diagonal for half a cycle, then the other' })
DRAW.spwm = (p, live) => bridgeInv(p, live, { caption: 'a sine against a triangle picks the diagonal' })

Object.assign(DRAW, jkDrawings(KIT))

export const TOPOLOGIES = Object.keys(DRAW)

export default function Schematic({ exp, x, live = null }) {
  const topology = topologyOf(exp)
  const draw = DRAW[topology]
  if (!draw || !x?.p) return null
  const size = FRAMES[topology] || FRAME
  return (
    <svg
      className="schematic"
      viewBox={`0 0 ${size.w} ${size.h}`}
      /* The frame's own size and shape, published so the stylesheet can size
         every drawing at ONE scale rather than squeezing each into a fixed
         box. A viewBox letterboxed into a short slot shrinks the whole
         picture, text and all: that is how labels drawn at 9 units came to
         render at 6 px, and why the schematics read as far too small. */
      style={{ '--frame-w': size.w, '--frame-h': size.h, aspectRatio: `${size.w} / ${size.h}` }}
      role="img"
      aria-label={`Schematic: ${topology}`}
      data-topology={topology}
    >
      {draw(x.p, live)}
    </svg>
  )
}
