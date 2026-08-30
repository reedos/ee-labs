import React from 'react'
import { fmt } from '@ee-labs/ui'

// Schematics, drawn as SVG.
//
// A circuits tool that never shows the circuit is a filter tool with extra
// steps. These are hand-drawn per topology rather than generated from a netlist:
// nine readable diagrams beat a layout engine that produces nine awkward ones,
// and the component values are live so the picture always matches the plots.

const S = { w: 300, h: 130 }

const Wire = ({ x1, y1, x2, y2 }) => (
  <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="var(--line-bright)" strokeWidth="1.5" />
)

/** Resistor: the zigzag, drawn along x or y. */
function Res({ x, y, vertical = false, label }) {
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
      <text
        className="sch-label"
        x={vertical ? x + 16 : x}
        y={vertical ? y + 4 : y - 14}
        textAnchor={vertical ? 'start' : 'middle'}
      >
        {label}
      </text>
    </g>
  )
}

/** Capacitor: two plates with a gap. */
function Cap({ x, y, vertical = false, label, labelLeft = false }) {
  const half = 9
  const gap = 5
  return (
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
      <text
        className="sch-label"
        x={vertical ? (labelLeft ? x - 16 : x + 16) : x}
        y={vertical ? y + 4 : y - 14}
        textAnchor={vertical ? (labelLeft ? 'end' : 'start') : 'middle'}
        stroke="none"
      >
        {label}
      </text>
    </g>
  )
}

/** Inductor: a run of half circles. */
function Ind({ x, y, vertical = false, label }) {
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
      <text
        className="sch-label"
        x={vertical ? x + 16 : x}
        y={vertical ? y + 4 : y - 12}
        textAnchor={vertical ? 'start' : 'middle'}
      >
        {label}
      </text>
    </g>
  )
}

const Gnd = ({ x, y }) => (
  <g stroke="var(--dim)" strokeWidth="1.5">
    <line x1={x} y1={y} x2={x} y2={y + 8} />
    <line x1={x - 9} y1={y + 8} x2={x + 9} y2={y + 8} />
    <line x1={x - 5} y1={y + 12} x2={x + 5} y2={y + 12} />
    <line x1={x - 2} y1={y + 16} x2={x + 2} y2={y + 16} />
  </g>
)

const Port = ({ x, y, label, anchor = 'end' }) => (
  <g>
    <circle cx={x} cy={y} r="3" fill="var(--line-bright)" />
    <text className="sch-port" x={anchor === 'end' ? x - 8 : x + 8} y={y + 4} textAnchor={anchor}>
      {label}
    </text>
  </g>
)

/** Op-amp triangle, with the inverting input on top or bottom. */
const Amp = ({ x, y, invertTop = true }) => (
  <g>
    <polygon
      points={`${x},${y - 22} ${x},${y + 22} ${x + 38},${y}`}
      fill="var(--panel-2)"
      stroke="var(--line-bright)"
      strokeWidth="1.5"
    />
    <text className="sch-sign" x={x + 7} y={y - 8}>
      {invertTop ? '−' : '+'}
    </text>
    <text className="sch-sign" x={x + 7} y={y + 16}>
      {invertTop ? '+' : '−'}
    </text>
  </g>
)

const ohms = (v) => fmt(v, 'Ω', 3)
const farads = (v) => fmt(v, 'F', 3)
const henries = (v) => fmt(v, 'H', 3)

// ------------------------------------------------------------ per circuit

const DRAW = {
  divider: (p) => (
    <>
      <Port x={20} y={40} label="in" />
      <Wire x1={20} y1={40} x2={110} y2={40} />
      <Res x={130} y={40} label={`R1 ${ohms(p.r1)}`} />
      <Wire x1={150} y1={40} x2={215} y2={40} />
      <Port x={280} y={40} label="out" anchor="start" />
      <Wire x1={215} y1={40} x2={280} y2={40} />
      <Wire x1={215} y1={40} x2={215} y2={55} />
      <Res x={215} y={78} vertical label={`R2 ${ohms(p.r2)}`} />
      <Wire x1={215} y1={100} x2={215} y2={106} />
      <Gnd x={215} y={106} />
    </>
  ),
  rcLow: (p) => (
    <>
      <Port x={20} y={40} label="in" />
      <Wire x1={20} y1={40} x2={110} y2={40} />
      <Res x={130} y={40} label={`R ${ohms(p.r)}`} />
      <Wire x1={150} y1={40} x2={215} y2={40} />
      <Port x={280} y={40} label="out" anchor="start" />
      <Wire x1={215} y1={40} x2={280} y2={40} />
      <Wire x1={215} y1={40} x2={215} y2={58} />
      <Cap x={215} y={78} vertical label={`C ${farads(p.c)}`} />
      <Wire x1={215} y1={98} x2={215} y2={106} />
      <Gnd x={215} y={106} />
    </>
  ),
  rcHigh: (p) => (
    <>
      <Port x={20} y={40} label="in" />
      <Wire x1={20} y1={40} x2={110} y2={40} />
      <Cap x={130} y={40} label={`C ${farads(p.c)}`} />
      <Wire x1={150} y1={40} x2={215} y2={40} />
      <Port x={280} y={40} label="out" anchor="start" />
      <Wire x1={215} y1={40} x2={280} y2={40} />
      <Wire x1={215} y1={40} x2={215} y2={55} />
      <Res x={215} y={78} vertical label={`R ${ohms(p.r)}`} />
      <Wire x1={215} y1={100} x2={215} y2={106} />
      <Gnd x={215} y={106} />
    </>
  ),
  rlLow: (p) => (
    <>
      <Port x={20} y={40} label="in" />
      <Wire x1={20} y1={40} x2={108} y2={40} />
      <Ind x={130} y={40} label={`L ${henries(p.l)}`} />
      <Wire x1={152} y1={40} x2={215} y2={40} />
      <Port x={280} y={40} label="out" anchor="start" />
      <Wire x1={215} y1={40} x2={280} y2={40} />
      <Wire x1={215} y1={40} x2={215} y2={55} />
      <Res x={215} y={78} vertical label={`R ${ohms(p.r)}`} />
      <Wire x1={215} y1={100} x2={215} y2={106} />
      <Gnd x={215} y={106} />
    </>
  ),
  rlcSeries: (p, out) => (
    <>
      <Port x={22} y={34} label="in" />
      <Wire x1={22} y1={34} x2={48} y2={34} />
      <Res x={68} y={34} label={`R ${ohms(p.r)}`} />
      <Wire x1={88} y1={34} x2={116} y2={34} />
      <Ind x={138} y={34} label={`L ${henries(p.l)}`} />
      <Wire x1={160} y1={34} x2={188} y2={34} />
      <Cap x={208} y={34} label={`C ${farads(p.c)}`} />
      <Wire x1={228} y1={34} x2={262} y2={34} />
      <Wire x1={262} y1={34} x2={262} y2={100} />
      <Wire x1={22} y1={34} x2={22} y2={100} />
      <Wire x1={22} y1={100} x2={262} y2={100} />
      <Gnd x={139} y={100} />
      <text className="sch-note" x={150} y={124} textAnchor="middle">
        output taken {out === 'r' ? 'across R' : out === 'l' ? 'across L' : 'across C'}
      </text>
      {out === 'r' && <rect className="sch-probe" x={44} y={24} width={48} height={26} rx="4" />}
      {out === 'l' && <rect className="sch-probe" x={114} y={24} width={48} height={26} rx="4" />}
      {out === 'c' && <rect className="sch-probe" x={184} y={24} width={48} height={26} rx="4" />}
    </>
  ),
  rlcParallel: (p) => (
    <>
      <Port x={20} y={30} label="i(t)" />
      <Wire x1={20} y1={30} x2={250} y2={30} />
      <Wire x1={70} y1={30} x2={70} y2={48} />
      <Res x={70} y={70} vertical label={`R ${ohms(p.r)}`} />
      <Wire x1={70} y1={92} x2={70} y2={100} />
      <Wire x1={150} y1={30} x2={150} y2={46} />
      <Ind x={150} y={70} vertical label={`L ${henries(p.l)}`} />
      <Wire x1={150} y1={94} x2={150} y2={100} />
      <Wire x1={230} y1={30} x2={230} y2={48} />
      <Cap x={230} y={70} vertical label={`C ${farads(p.c)}`} />
      <Wire x1={230} y1={92} x2={230} y2={100} />
      <Wire x1={70} y1={100} x2={230} y2={100} />
      <Gnd x={150} y={100} />
      <Port x={272} y={30} label="v" anchor="start" />
    </>
  ),
  // Unity-gain buffer: the inverting input is tied to the OUTPUT, not to
  // ground. Grounding it would make this a comparator, which is a different
  // circuit with a different answer.
  sallenKey: (p) => (
    <>
      <Port x={22} y={47} label="in" />
      <Wire x1={22} y1={47} x2={30} y2={47} />
      <Res x={50} y={47} label={`R1 ${ohms(p.r1)}`} />
      <Wire x1={70} y1={47} x2={102} y2={47} />
      <Res x={122} y={47} label={`R2 ${ohms(p.r2)}`} />
      <Wire x1={142} y1={47} x2={170} y2={47} />

      {/* C2 from the non-inverting input to ground */}
      <Wire x1={155} y1={47} x2={155} y2={62} />
      <Cap x={155} y={80} vertical labelLeft label={`C2 ${farads(p.c2)}`} />
      <Wire x1={155} y1={100} x2={155} y2={104} />
      <Gnd x={155} y={104} />

      <Amp x={170} y={58} invertTop={false} />
      <Wire x1={208} y1={58} x2={268} y2={58} />
      <Port x={272} y={58} label="out" anchor="start" />

      {/* Unity-gain feedback: output straight back to the inverting input */}
      <Wire x1={170} y1={69} x2={170} y2={92} />
      <Wire x1={170} y1={92} x2={232} y2={92} />
      <Wire x1={232} y1={92} x2={232} y2={58} />

      {/* C1 from the output back to the junction of R1 and R2 */}
      <Wire x1={102} y1={47} x2={102} y2={26} />
      <Wire x1={102} y1={26} x2={130} y2={26} />
      <Cap x={150} y={26} label={`C1 ${farads(p.c1)}`} />
      <Wire x1={170} y1={26} x2={215} y2={26} />
      <Wire x1={215} y1={26} x2={215} y2={58} />
    </>
  ),
  // Inverting: the summing node is the INVERTING input, and the non-inverting
  // one is grounded. Input and feedback both land on the same pin.
  inverting: (p) => (
    <>
      <Port x={22} y={50} label="in" />
      <Wire x1={22} y1={50} x2={32} y2={50} />
      <Res x={52} y={50} label={`Rin ${ohms(p.rin)}`} />
      <Wire x1={72} y1={50} x2={160} y2={50} />

      {/* Feedback resistor from output back to the summing node */}
      <Wire x1={108} y1={50} x2={108} y2={26} />
      <Wire x1={108} y1={26} x2={130} y2={26} />
      <Res x={150} y={26} label={`Rf ${ohms(p.rf)}`} />
      <Wire x1={170} y1={26} x2={236} y2={26} />
      <Wire x1={236} y1={26} x2={236} y2={61} />

      <Amp x={160} y={61} invertTop />
      <Wire x1={198} y1={61} x2={268} y2={61} />
      <Port x={272} y={61} label="out" anchor="start" />

      {/* Non-inverting input to ground */}
      <Wire x1={160} y1={77} x2={140} y2={77} />
      <Wire x1={140} y1={77} x2={140} y2={90} />
      <Gnd x={140} y={90} />

      <text className="sch-note" x={150} y={122} textAnchor="middle">
        Cf {farads(p.cf)} in parallel with Rf
      </text>
    </>
  ),
  integrator: (p) => (
    <>
      <Port x={22} y={50} label="in" />
      <Wire x1={22} y1={50} x2={32} y2={50} />
      <Res x={52} y={50} label={`R ${ohms(p.r)}`} />
      <Wire x1={72} y1={50} x2={160} y2={50} />

      {/* The feedback element is a capacitor, which is what integrates */}
      <Wire x1={108} y1={50} x2={108} y2={26} />
      <Wire x1={108} y1={26} x2={138} y2={26} />
      <Cap x={158} y={26} label={`C ${farads(p.c)}`} />
      <Wire x1={178} y1={26} x2={236} y2={26} />
      <Wire x1={236} y1={26} x2={236} y2={61} />

      <Amp x={160} y={61} invertTop />
      <Wire x1={198} y1={61} x2={268} y2={61} />
      <Port x={272} y={61} label="out" anchor="start" />

      <Wire x1={160} y1={77} x2={140} y2={77} />
      <Wire x1={140} y1={77} x2={140} y2={90} />
      <Gnd x={140} y={90} />
    </>
  ),
}

export default function Schematic({ id, params, output }) {
  const draw = DRAW[id]
  if (!draw) return null
  return (
    <svg
      className="schematic"
      viewBox={`0 0 ${S.w} ${S.h}`}
      role="img"
      aria-label={`Schematic for ${id}`}
    >
      {draw(params, output)}
    </svg>
  )
}
