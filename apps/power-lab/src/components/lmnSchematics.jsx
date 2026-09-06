import React from 'react'
import { fmt } from '@ee-labs/ui'
import { Wire, Dot, Tag, Res, Cap, Ind, Switch, Diode, SrcDC, Gnd, Part, VAt, VAcross, IAt } from './schematics.jsx'

// The six drawings Groups L, M and N add, in the kit and the idiom
// `schematics.jsx` already uses: resistors green, capacitors amber, inductors
// blue, wires grey, and every signal the measures table lists marked on the
// node or the wire it is read at, in the colour the scope draws it.
//
// Two of them draw a part the lab had not needed. A machine is a circle with
// its letter in it, which is how a drives text draws one, and the winding it
// turns is the resistance and inductance beside it. A thermal network is
// drawn as the network it is, with kelvins on the nodes rather than volts,
// because that is the whole of Group N's claim.

const ohms = (v) => fmt(v, 'Ω', 3)
const farads = (v) => fmt(v, 'F', 3)
const henries = (v) => fmt(v, 'H', 3)
const volts = (v) => fmt(v, 'V', 3)

/** A machine: a circle with its letter, and leads along the axis it sits on. */
const Machine = ({ x, y, letter = 'M', label, vertical = false, r = 15, lead = 24 }) => (
  <g>
    {vertical ? (
      <>
        <Wire x1={x} y1={y - r - lead} x2={x} y2={y - r} />
        <Wire x1={x} y1={y + r} x2={x} y2={y + r + lead} />
      </>
    ) : (
      <>
        <Wire x1={x - r - lead} y1={y} x2={x - r} y2={y} />
        <Wire x1={x + r} y1={y} x2={x + r + lead} y2={y} />
      </>
    )}
    <circle cx={x} cy={y} r={r} fill="none" stroke="var(--line-bright)" strokeWidth="1.5" />
    <text className="sch-sign" x={x} y={y + 4} textAnchor="middle">
      {letter}
    </text>
    {label ? <Tag x={x} y={y + r + 20}>{label}</Tag> : null}
  </g>
)

// The standard rails these drawings sit on.
const TOP = 42
const SRC = 34

export const LMN_FRAMES = {
  dcdrive: { w: 340, h: 180 },
  hbridge: { w: 370, h: 200 },
  bldc: { w: 370, h: 200 },
  emi: { w: 390, h: 190 },
  ringing: { w: 390, h: 200 },
  thermal: { w: 390, h: 220 },
}

export const LMN_TOPOLOGY_NAMES = {
  dcdrive: 'Chopper drive, one quadrant',
  hbridge: 'Full-bridge drive, four quadrants',
  bldc: 'Six-step brushless drive, the conducting pair',
  emi: 'Buck with its input capacitor and line filter',
  ringing: 'Switch node with its parasitics and snubber',
  thermal: 'Synchronous buck, and the thermal network under it',
}

/** What each drawing's measures table lists, and therefore what it marks. */
export const LMN_TOPOLOGY_SIGNALS = {
  dcdrive: ['vout', 'vemf', 'vL', 'iL', 'iQ', 'iD', 'iin'],
  hbridge: ['vout', 'vemf', 'vL', 'iL', 'iQ', 'iin'],
  bldc: ['vout', 'vemf', 'vL', 'iL', 'iQ', 'iD', 'iin'],
  emi: ['vcin', 'vsw', 'vout', 'iL', 'icin', 'iin', 'iline'],
  ringing: ['vsw', 'vout', 'vL', 'iL', 'iin'],
  thermal: ['vsw', 'vout', 'vL', 'iL', 'iD', 'iC', 'iQ', 'iin'],
}

export const LMN_DRAW = {
  // One switch and one freewheel diode into an armature: the buck's front end
  // with a motor where the capacitor was.
  dcdrive: (p, live) => {
    const BOT = 132
    return (
      <>
        <SrcDC x={SRC} y={87} label={`V_dc ${volts(p.Vdc)}`} />
        <Wire x1={SRC} y1={TOP} x2={SRC} y2={57} />
        <Wire x1={SRC} y1={117} x2={SRC} y2={BOT} />
        <Wire x1={SRC} y1={TOP} x2={72} y2={TOP} />
        <Tag x={92} y={22}>Q</Tag>
        <Part id="Q" live={live}><Switch x1={72} y1={TOP} x2={112} y2={TOP} /></Part>
        <Wire x1={112} y1={TOP} x2={140} y2={TOP} />
        <Dot x={134} y={TOP} />
        <Part id="D" live={live}><Diode x1={134} y1={BOT} x2={134} y2={TOP} /></Part>
        <Tag x={126} y={90} anchor="end">D</Tag>
        <Part id="L" live={live}>
          <Res x={172} y={TOP} label={`R_a ${ohms(p.Ra)}`} />
          <Wire x1={192} y1={TOP} x2={200} y2={TOP} />
          <Ind x={232} y={TOP} label={`L_a ${henries(p.La)}`} />
        </Part>
        <Wire x1={264} y1={TOP} x2={286} y2={TOP} />
        <Wire x1={286} y1={TOP} x2={286} y2={57} />
        <Part id="R" live={live}><Machine x={286} y={87} vertical label={`k ${fmt(p.k, 'V·s/rad', 3)}`} /></Part>
        <Wire x1={286} y1={117} x2={286} y2={BOT} />
        <Wire x1={SRC} y1={BOT} x2={286} y2={BOT} />
        <Gnd x={200} y={BOT} />
        <IAt sig="iin" x={58} y={TOP} dy={-6} />
        <IAt sig="iQ" x={122} y={TOP} dy={-6} />
        <VAt sig="vout" x={148} y={TOP} dx={4} dy={-6} anchor="start" />
        <IAt sig="iD" x={134} y={112} dir="up" dx={-6} dy={0} anchor="end" />
        <VAcross sig="vL" x1={200} y1={TOP} x2={264} y2={TOP} dy={16} />
        <IAt sig="iL" x={272} y={TOP} dy={-6} />
        <VAt sig="vemf" x={286} y={64} dx={8} dy={4} anchor="start" />
      </>
    )
  },

  // Two legs across the rail with the machine between them: both directions,
  // and both signs of current back into the supply.
  hbridge: (p, live) => {
    const T2 = 40
    const B2 = 156
    const MID2 = 98
    return (
      <>
        <SrcDC x={SRC} y={98} label={`V_dc ${volts(p.Vdc)}`} />
        <Wire x1={SRC} y1={T2} x2={SRC} y2={68} />
        <Wire x1={SRC} y1={128} x2={SRC} y2={B2} />
        <Wire x1={SRC} y1={T2} x2={228} y2={T2} />
        <Wire x1={SRC} y1={B2} x2={228} y2={B2} />
        <Part id="Q" live={live}><Switch x1={96} y1={T2} x2={96} y2={MID2} /></Part>
        <Switch x1={96} y1={MID2} x2={96} y2={B2} />
        <Switch x1={228} y1={T2} x2={228} y2={MID2} />
        <Switch x1={228} y1={MID2} x2={228} y2={B2} />
        <Tag x={88} y={68} anchor="end">Q₁</Tag>
        <Tag x={88} y={132} anchor="end">Q₂</Tag>
        <Tag x={236} y={68} anchor="start">Q₃</Tag>
        <Tag x={236} y={132} anchor="start">Q₄</Tag>
        <Dot x={96} y={MID2} />
        <Dot x={228} y={MID2} />
        <Part id="L" live={live}>
          <Res x={128} y={MID2} label={`R_a ${ohms(p.Ra)}`} />
          <Ind x={180} y={MID2} label={`L_a ${henries(p.La)}`} />
        </Part>
        <Wire x1={148} y1={MID2} x2={156} y2={MID2} />
        <Wire x1={204} y1={MID2} x2={212} y2={MID2} />
        <Part id="R" live={live}><Machine x={286} y={MID2} label={`k ${fmt(p.k, 'V·s/rad', 3)}`} /></Part>
        <Wire x1={228} y1={MID2} x2={247} y2={MID2} />
        <Wire x1={301} y1={MID2} x2={320} y2={MID2} />
        <Wire x1={320} y1={MID2} x2={320} y2={B2} />
        <Wire x1={228} y1={B2} x2={320} y2={B2} />
        <Gnd x={160} y={B2} />
        <IAt sig="iin" x={62} y={T2} dy={-6} />
        <IAt sig="iQ" x={96} y={62} dir="down" dx={6} dy={0} anchor="start" />
        <VAt sig="vout" x={110} y={MID2} dy={-8} />
        <VAcross sig="vL" x1={156} y1={MID2} x2={204} y2={MID2} dy={18} />
        <IAt sig="iL" x={218} y={MID2} dy={-6} />
        <VAt sig="vemf" x={264} y={MID2} dy={-22} />
      </>
    )
  },

  // What the six-step bridge is at any one instant: one upper device, one
  // lower path, and two of the three phases in series between them.
  bldc: (p, live) => {
    const BOT = 148
    return (
      <>
        <SrcDC x={SRC} y={95} label={`V_dc ${volts(p.Vdc)}`} />
        <Wire x1={SRC} y1={TOP} x2={SRC} y2={65} />
        <Wire x1={SRC} y1={125} x2={SRC} y2={BOT} />
        <Wire x1={SRC} y1={TOP} x2={68} y2={TOP} />
        <Tag x={88} y={22}>Q</Tag>
        <Part id="Q" live={live}><Switch x1={68} y1={TOP} x2={108} y2={TOP} /></Part>
        <Wire x1={108} y1={TOP} x2={136} y2={TOP} />
        <Dot x={130} y={TOP} />
        <Part id="D" live={live}><Diode x1={130} y1={BOT} x2={130} y2={TOP} /></Part>
        <Tag x={122} y={100} anchor="end">D</Tag>
        <Part id="L" live={live}>
          <Res x={168} y={TOP} label={`R_s ${ohms(p.Rs)}`} />
          <Wire x1={188} y1={TOP} x2={196} y2={TOP} />
          <Ind x={228} y={TOP} label={`L_s ${henries(p.Ls)}`} />
        </Part>
        <Wire x1={260} y1={TOP} x2={272} y2={TOP} />
        <Part id="R" live={live}><Machine x={311} y={TOP} letter="3" r={14} lead={10} label={`λ ${fmt(p.lambda, 'Wb', 3)}`} /></Part>
        <Wire x1={335} y1={TOP} x2={348} y2={TOP} />
        <Wire x1={348} y1={TOP} x2={348} y2={BOT} />
        <Res x={252} y={BOT} label={`R_s ${ohms(p.Rs)}`} />
        <Wire x1={272} y1={BOT} x2={348} y2={BOT} />
        <Ind x={180} y={BOT} label={`L_s ${henries(p.Ls)}`} />
        <Wire x1={212} y1={BOT} x2={232} y2={BOT} />
        <Wire x1={SRC} y1={BOT} x2={148} y2={BOT} />
        <Gnd x={90} y={BOT} />
        <IAt sig="iin" x={56} y={TOP} dy={-6} />
        <IAt sig="iQ" x={118} y={TOP} dy={-6} />
        <VAt sig="vout" x={144} y={TOP} dx={4} dy={-6} anchor="start" />
        <IAt sig="iD" x={130} y={124} dir="up" dx={-6} dy={0} anchor="end" />
        <VAcross sig="vL" x1={196} y1={TOP} x2={260} y2={TOP} dy={16} />
        <IAt sig="iL" x={266} y={TOP} dy={-6} />
        <VAt sig="vemf" x={311} y={64} dy={12} />
      </>
    )
  },

  // The buck with what sits in front of it: the line inductance, the resistor
  // that damps it, and the capacitor the switch actually draws its pulses from.
  emi: (p, live) => {
    const BOT = 128
    return (
      <>
        <SrcDC x={30} y={85} label={`V_in ${volts(p.Vin)}`} />
        <Wire x1={30} y1={TOP} x2={30} y2={55} />
        <Wire x1={30} y1={115} x2={30} y2={BOT} />
        <Wire x1={30} y1={TOP} x2={48} y2={TOP} />
        <Dot x={48} y={TOP} />
        <Ind x={82} y={TOP} label={`L_f ${henries(p.Lf)}`} />
        <Res x={130} y={TOP} label={`R_f ${ohms(p.Rf)}`} />
        <Wire x1={114} y1={TOP} x2={110} y2={TOP} />
        <Wire x1={150} y1={TOP} x2={166} y2={TOP} />
        <Wire x1={48} y1={TOP} x2={48} y2={16} />
        <Wire x1={48} y1={16} x2={78} y2={16} />
        <Res x={98} y={16} label={`R_d ${ohms(p.Rd)}`} />
        <Wire x1={118} y1={16} x2={166} y2={16} />
        <Wire x1={166} y1={16} x2={166} y2={TOP} />
        <Dot x={166} y={TOP} />
        <Cap x={166} y={82} label={`C_in ${farads(p.Cin)}`} side="left" />
        <Wire x1={166} y1={TOP} x2={166} y2={62} />
        <Wire x1={166} y1={102} x2={166} y2={BOT} />
        <Tag x={200} y={26}>Q</Tag>
        <Part id="Q" live={live}><Switch x1={182} y1={TOP} x2={218} y2={TOP} /></Part>
        <Wire x1={166} y1={TOP} x2={182} y2={TOP} />
        <Wire x1={218} y1={TOP} x2={238} y2={TOP} />
        <Dot x={234} y={TOP} />
        <Part id="D" live={live}><Switch x1={234} y1={BOT} x2={234} y2={TOP} /></Part>
        <Tag x={226} y={90} anchor="end">Q₂</Tag>
        <Part id="L" live={live}><Ind x={272} y={TOP} label={`L ${henries(p.L)}`} /></Part>
        <Wire x1={304} y1={TOP} x2={312} y2={TOP} />
        <Dot x={312} y={TOP} />
        <Part id="C" live={live}><Cap x={312} y={82} label={`C ${farads(p.C)}`} side="left" /></Part>
        <Wire x1={312} y1={TOP} x2={312} y2={62} />
        <Wire x1={312} y1={102} x2={312} y2={BOT} />
        <Wire x1={312} y1={TOP} x2={356} y2={TOP} />
        <Wire x1={356} y1={TOP} x2={356} y2={62} />
        <Part id="R" live={live}><Res x={356} y={82} vertical label={`R ${ohms(p.R)}`} side="left" /></Part>
        <Wire x1={356} y1={102} x2={356} y2={BOT} />
        <Wire x1={30} y1={BOT} x2={356} y2={BOT} />
        <Gnd x={200} y={BOT} />
        <IAt sig="iline" x={62} y={TOP} dy={-6} />
        <VAt sig="vcin" x={166} y={TOP} dx={-6} dy={-8} anchor="end" />
        <IAt sig="icin" x={166} y={56} dir="down" dx={6} dy={2} anchor="start" />
        <IAt sig="iin" x={176} y={TOP} dy={-6} />
        <VAt sig="vsw" x={234} y={TOP} dx={6} dy={16} anchor="start" />
        <IAt sig="iL" x={300} y={TOP} dy={-6} />
        <VAt sig="vout" x={332} y={TOP} dy={-6} />
      </>
    )
  },

  // The same node, drawn with what a layout adds to it: the loop's own
  // inductance, the capacitance across the diode, and the snubber.
  ringing: (p, live) => {
    const BOT = 140
    return (
      <>
        <SrcDC x={30} y={91} label={`V_in ${volts(p.Vin)}`} />
        <Wire x1={30} y1={TOP} x2={30} y2={61} />
        <Wire x1={30} y1={121} x2={30} y2={BOT} />
        <Wire x1={30} y1={TOP} x2={56} y2={TOP} />
        <Tag x={78} y={26}>Q</Tag>
        <Part id="Q" live={live}><Switch x1={56} y1={TOP} x2={92} y2={TOP} /></Part>
        <Wire x1={92} y1={TOP} x2={100} y2={TOP} />
        <Dot x={100} y={TOP} />
        <Ind x={132} y={TOP} label={`L_p ${henries(p.Lp)}`} />
        <Wire x1={164} y1={TOP} x2={176} y2={TOP} />
        <Wire x1={100} y1={TOP} x2={100} y2={18} />
        <Wire x1={100} y1={18} x2={126} y2={18} />
        <Res x={146} y={18} label={`R_p ${ohms(p.Rp)}`} />
        <Wire x1={166} y1={18} x2={176} y2={18} />
        <Wire x1={176} y1={18} x2={176} y2={TOP} />
        <Dot x={176} y={TOP} />
        <Part id="C" live={live}><Cap x={176} y={88} label={`C_p ${farads(p.Cp)}`} side="left" /></Part>
        <Wire x1={176} y1={TOP} x2={176} y2={68} />
        <Wire x1={176} y1={108} x2={176} y2={BOT} />
        <Part id="D" live={live}><Switch x1={214} y1={BOT} x2={214} y2={TOP} /></Part>
        <Wire x1={176} y1={TOP} x2={214} y2={TOP} />
        <Tag x={206} y={96} anchor="end">Q₂</Tag>
        {p.snubber ? (
          <g>
            <Wire x1={214} y1={TOP} x2={250} y2={TOP} />
            <Wire x1={250} y1={TOP} x2={250} y2={54} />
            <Res x={250} y={74} vertical label={`R_sn ${ohms(p.Rsn)}`} side="right" />
            <Wire x1={250} y1={94} x2={250} y2={100} />
            <Cap x={250} y={120} label={`C_sn ${farads(p.Csn)}`} side="right" />
            <Wire x1={250} y1={140} x2={250} y2={BOT} />
          </g>
        ) : null}
        <Wire x1={214} y1={TOP} x2={286} y2={TOP} />
        <Part id="L" live={live}><Ind x={286} y={TOP} label={`L ${henries(p.L)}`} /></Part>
        <Wire x1={318} y1={TOP} x2={326} y2={TOP} />
        <Dot x={326} y={TOP} />
        <Cap x={326} y={88} label={`C ${farads(p.C)}`} side="left" />
        <Wire x1={326} y1={TOP} x2={326} y2={68} />
        <Wire x1={326} y1={108} x2={326} y2={BOT} />
        <Wire x1={326} y1={TOP} x2={366} y2={TOP} />
        <Wire x1={366} y1={TOP} x2={366} y2={68} />
        <Part id="R" live={live}><Res x={366} y={88} vertical label={`R ${ohms(p.R)}`} side="left" /></Part>
        <Wire x1={366} y1={108} x2={366} y2={BOT} />
        <Wire x1={30} y1={BOT} x2={366} y2={BOT} />
        <Gnd x={120} y={BOT} />
        <IAt sig="iin" x={46} y={TOP} dy={-6} />
        <VAt sig="vsw" x={190} y={TOP} dy={-8} />
        <VAcross sig="vL" x1={254} y1={TOP} x2={318} y2={TOP} dy={18} />
        <IAt sig="iL" x={314} y={TOP} dy={-6} />
        <VAt sig="vout" x={346} y={TOP} dy={-6} />
      </>
    )
  },

  // A synchronous buck, and under it the network its loss leaves through:
  // the same two laws with kelvins on the nodes instead of volts.
  thermal: (p, live) => {
    const BOT = 118
    const TH = 166
    const AMB = 200
    return (
      <>
        <SrcDC x={SRC} y={80} label={`V_in ${volts(p.Vin)}`} />
        <Wire x1={SRC} y1={TOP} x2={SRC} y2={50} />
        <Wire x1={SRC} y1={110} x2={SRC} y2={BOT} />
        <Wire x1={SRC} y1={TOP} x2={72} y2={TOP} />
        <Tag x={92} y={24}>Q</Tag>
        <Part id="Q" live={live}><Switch x1={72} y1={TOP} x2={112} y2={TOP} /></Part>
        <Wire x1={112} y1={TOP} x2={136} y2={TOP} />
        <Dot x={132} y={TOP} />
        <Part id="D" live={live}><Switch x1={132} y1={BOT} x2={132} y2={TOP} /></Part>
        <Tag x={124} y={84} anchor="end">Q₂</Tag>
        <Part id="L" live={live}><Ind x={172} y={TOP} label={`L ${henries(p.L)}`} /></Part>
        <Wire x1={204} y1={TOP} x2={212} y2={TOP} />
        <Dot x={212} y={TOP} />
        <Part id="C" live={live}><Cap x={212} y={80} label={`C ${farads(p.C)}`} side="left" /></Part>
        <Wire x1={212} y1={TOP} x2={212} y2={60} />
        <Wire x1={212} y1={100} x2={212} y2={BOT} />
        <Wire x1={212} y1={TOP} x2={266} y2={TOP} />
        <Wire x1={266} y1={TOP} x2={266} y2={60} />
        <Part id="R" live={live}><Res x={266} y={80} vertical label={`R ${ohms(p.R)}`} side="right" /></Part>
        <Wire x1={266} y1={100} x2={266} y2={BOT} />
        <Wire x1={SRC} y1={BOT} x2={266} y2={BOT} />
        <Gnd x={172} y={BOT} />
        <IAt sig="iin" x={58} y={TOP} dy={-6} />
        <IAt sig="iQ" x={122} y={TOP} dy={-6} />
        <VAt sig="vsw" x={132} y={TOP} dx={-6} dy={16} anchor="end" />
        <IAt sig="iD" x={132} y={104} dir="up" dx={6} dy={0} anchor="start" />
        <VAcross sig="vL" x1={140} y1={TOP} x2={204} y2={TOP} dy={16} />
        <IAt sig="iL" x={198} y={TOP} dy={-6} />
        <IAt sig="iC" x={212} y={54} dir="down" dx={-6} dy={4} anchor="end" />
        <VAt sig="vout" x={238} y={TOP} dy={-6} />
        {/* The thermal path, in the same two laws with kelvins on the nodes. */}
        <Tag x={52} y={TH - 16}>T_j</Tag>
        <Tag x={148} y={TH - 16}>T_c</Tag>
        <Tag x={244} y={TH - 16}>T_s</Tag>
        <Tag x={330} y={TH - 16}>T_a</Tag>
        <Dot x={52} y={TH} />
        <Res x={100} y={TH} label="R₁" />
        <Wire x1={52} y1={TH} x2={80} y2={TH} />
        <Wire x1={120} y1={TH} x2={148} y2={TH} />
        <Dot x={148} y={TH} />
        <Res x={196} y={TH} label="R₂" />
        <Wire x1={148} y1={TH} x2={176} y2={TH} />
        <Wire x1={216} y1={TH} x2={244} y2={TH} />
        <Dot x={244} y={TH} />
        <Res x={292} y={TH} label="R₃" />
        <Wire x1={244} y1={TH} x2={272} y2={TH} />
        <Wire x1={312} y1={TH} x2={330} y2={TH} />
        <Wire x1={52} y1={TH} x2={52} y2={TH + 4} />
        <Cap x={52} y={TH + 20} label="τ₁" side="right" />
        <Wire x1={52} y1={TH + 40} x2={52} y2={AMB} />
        <Wire x1={148} y1={TH} x2={148} y2={TH + 4} />
        <Cap x={148} y={TH + 20} label="τ₂" side="right" />
        <Wire x1={148} y1={TH + 40} x2={148} y2={AMB} />
        <Wire x1={244} y1={TH} x2={244} y2={TH + 4} />
        <Cap x={244} y={TH + 20} label="τ₃" side="right" />
        <Wire x1={244} y1={TH + 40} x2={244} y2={AMB} />
        <Wire x1={330} y1={TH} x2={330} y2={AMB} />
        <Wire x1={52} y1={AMB} x2={330} y2={AMB} />
        <Gnd x={330} y={AMB} />
      </>
    )
  },
}
