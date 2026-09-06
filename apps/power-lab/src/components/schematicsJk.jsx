import React from 'react'

// The drawings for Groups J and K, in the kit `schematics.jsx` hands over.
//
// Five circuits, laid out by hand like the nine before them. The forward
// family shares one shape — a primary the switches drive, a transformer, a
// rectified secondary, and the buck's filter — so the three differ only on
// the primary, which is where the lesson is. The two tanks share another: a
// half bridge, L_r and C_r in series, and the rectifier the tank feeds.
//
// Every part the conduction scrub can light is wrapped and named with the id
// the engine's own state names it by, and `JK_CONDUCTING` maps the states
// this group's engines produce onto those ids.

export const JK_FRAMES = {
  forward: { w: 400, h: 215 },
  pushpull: { w: 400, h: 215 },
  fullbridge: { w: 400, h: 215 },
  src: { w: 400, h: 200 },
  llc: { w: 400, h: 200 },
}

export const JK_SIGNALS = {
  forward: ['vsw', 'vout', 'vL', 'iL', 'iD', 'iC', 'iQ', 'iin'],
  pushpull: ['vsw', 'vout', 'vL', 'iL', 'iD', 'iC', 'iQ', 'iin'],
  fullbridge: ['vsw', 'vout', 'vL', 'iL', 'iD', 'iC', 'iQ', 'iin'],
  src: ['vsw', 'vout', 'iL', 'iD', 'iC', 'iQ'],
  llc: ['vsw', 'vout', 'iL', 'iD', 'iC', 'iQ'],
}

export const JK_NAMES = {
  forward: 'Forward converter, with a reset winding',
  pushpull: 'Push-pull converter, centre-tapped primary',
  fullbridge: 'Full-bridge converter, isolated',
  src: 'Series resonant converter',
  llc: 'LLC resonant converter',
}

/**
 * Which drawn parts carry current in each state these engines name. The
 * default rule in `panes.jsx` reads a name's prefix, which is right for the
 * two switches of a push-pull and wrong for a resonant converter, where Q1
 * and Q2 each meet all three rectifier states.
 */
export const JK_CONDUCTING = {
  forward: {
    on: ['Q1', 'T', 'D1', 'L', 'C', 'R'],
    reset: ['Dr', 'T', 'D2', 'L', 'C', 'R'],
    'reset dry': ['Dr', 'T', 'C', 'R'],
    freewheel: ['D2', 'L', 'C', 'R'],
    dead: ['C', 'R'],
  },
}
for (const kind of ['src', 'llc']) {
  JK_CONDUCTING[kind] = {}
  for (const q of ['Q1', 'Q2']) {
    JK_CONDUCTING[kind][`${q} D+`] = [q, 'L', 'Cr', 'T', 'D1', 'C', 'R']
    JK_CONDUCTING[kind][`${q} D−`] = [q, 'L', 'Cr', 'T', 'D2', 'C', 'R']
    JK_CONDUCTING[kind][`${q} idle`] = [q, 'L', 'Cr', 'T', 'C', 'R']
  }
}

/**
 * The drawings themselves, built from the kit rather than importing it, so
 * the two modules do not have to be loaded in a particular order.
 */
export function jkDrawings(K) {
  const { Wire, Dot, Tag, Res, Cap, Ind, Diode, Switch, SrcDC, Gnd, Part, Xfmr, VAt, VAcross, IAt, ohms, farads, henries, volts, fmt } = K

  /** The output side every converter in Group J shares: rectifier, L, C, R. */
  const filter = (p, live, { node = 262, top = 40, mid = 104, bot = 190 }) => (
    <>
      <Wire x1={node} y1={mid} x2={node} y2={top} />
      <Part id="L" live={live}>
        <Ind x={node + 32} y={top} label={`L ${henries(p.L)}`} />
      </Part>
      <Wire x1={node + 64} y1={top} x2={node + 70} y2={top} />
      <Dot x={node + 70} y={top} />
      <Wire x1={node + 70} y1={top} x2={node + 70} y2={mid - 20} />
      <Part id="C" live={live}>
        <Cap x={node + 70} y={mid} label={`C ${farads(p.C)}`} side="below" />
      </Part>
      <Wire x1={node + 70} y1={mid + 20} x2={node + 70} y2={bot} />
      <Wire x1={node + 70} y1={top} x2={node + 108} y2={top} />
      <Wire x1={node + 108} y1={top} x2={node + 108} y2={mid - 20} />
      <Part id="R" live={live}>
        <Res x={node + 108} y={mid} vertical label={`R ${ohms(p.R)}`} side="below" />
      </Part>
      <Wire x1={node + 108} y1={mid + 20} x2={node + 108} y2={bot} />
      <VAt sig="vsw" x={node} y={top} dx={-4} dy={-8} anchor="end" />
      <VAcross sig="vL" x1={node + 4} y1={top} x2={node + 60} y2={top} dy={-8} />
      <IAt sig="iL" x={node + 58} y={top} dy={-8} />
      <IAt sig="iC" x={node + 70} y={mid - 30} dir="down" dx={-6} dy={4} anchor="end" />
      <VAt sig="vout" x={node + 88} y={top} dx={4} dy={-8} anchor="start" />
    </>
  )

  /**
   * The centre-tapped secondary the push-pull and the bridge rectify with:
   * one leg conducts each half cycle, and both carry the inductor's current
   * while neither is driven.
   */
  const secondary = (live, { x = 160, top = 72, bot = 136, node = 220 }) => (
    <>
      <Wire x1={x} y1={top} x2={x + 6} y2={top} />
      <Tag x={x + 26} y={top - 12}>D₁</Tag>
      <Part id="D1" live={live}>
        <Diode x1={x + 6} y1={top} x2={x + 46} y2={top} />
      </Part>
      <Wire x1={x} y1={bot} x2={x + 6} y2={bot} />
      <Tag x={x + 26} y={bot + 18}>D₂</Tag>
      <Part id="D2" live={live}>
        <Diode x1={x + 6} y1={bot} x2={x + 46} y2={bot} />
      </Part>
      <Wire x1={x + 46} y1={top} x2={node} y2={top} />
      <Wire x1={x + 46} y1={bot} x2={node} y2={bot} />
      <Wire x1={node} y1={top} x2={node} y2={bot} />
      <Dot x={node} y={(top + bot) / 2} />
      <IAt sig="iD" x={x + 40} y={top} dy={-8} />
    </>
  )

  /** The forward converter: one switch, a reset winding, and a buck's filter. */
  const forward = (p, live) => (
    <>
      <SrcDC x={26} y={104} label={`V_in ${volts(p.Vin)}`} />
      <Wire x1={26} y1={40} x2={26} y2={74} />
      <Wire x1={26} y1={134} x2={26} y2={190} />
      <Wire x1={26} y1={40} x2={58} y2={40} />
      <Tag x={80} y={30}>D_r</Tag>
      <Part id="Dr" live={live}>
        <Diode x1={102} y1={40} x2={58} y2={40} />
      </Part>
      <Wire x1={102} y1={40} x2={120} y2={40} />
      <Wire x1={120} y1={40} x2={120} y2={72} />
      <Wire x1={26} y1={104} x2={64} y2={104} />
      <Dot x={26} y={104} />
      <Wire x1={64} y1={104} x2={64} y2={136} />
      <Wire x1={64} y1={136} x2={120} y2={136} />
      <Part id="T" live={live}>
        <Xfmr x={140} y={104} label={`${fmt(1 / (p.n || 0.25), '', 3)}:1`} />
      </Part>
      <Wire x1={120} y1={136} x2={96} y2={136} />
      <Part id="Q1" live={live}>
        <Switch x1={96} y1={136} x2={96} y2={190} />
      </Part>
      <Tag x={84} y={166} anchor="end">Q₁</Tag>
      <Wire x1={26} y1={190} x2={96} y2={190} />
      <Wire x1={160} y1={72} x2={170} y2={72} />
      <Tag x={192} y={60}>D₁</Tag>
      <Part id="D1" live={live}>
        <Diode x1={170} y1={72} x2={210} y2={72} />
      </Part>
      <Wire x1={210} y1={72} x2={220} y2={72} />
      <Dot x={220} y={72} />
      <Wire x1={220} y1={72} x2={220} y2={40} />
      <Tag x={236} y={132}>D₂</Tag>
      <Part id="D2" live={live}>
        <Diode x1={220} y1={190} x2={220} y2={100} />
      </Part>
      <Wire x1={220} y1={72} x2={220} y2={100} />
      <Wire x1={160} y1={136} x2={160} y2={190} />
      {filter(p, live, { node: 220, top: 40, mid: 104, bot: 190 })}
      <Wire x1={96} y1={190} x2={398} y2={190} />
      <Gnd x={300} y={190} />
      <IAt sig="iin" x={48} y={104} dy={-6} />
      <IAt sig="iQ" x={96} y={166} dir="down" dx={6} dy={0} anchor="start" />
      <IAt sig="iD" x={202} y={72} dy={-8} />
    </>
  )

  /** The push-pull: a centre-tapped primary, driven from both ends in turn. */
  const pushpull = (p, live) => (
    <>
      <SrcDC x={26} y={104} label={`V_in ${volts(p.Vin)}`} />
      <Wire x1={26} y1={40} x2={26} y2={74} />
      <Wire x1={26} y1={134} x2={26} y2={190} />
      <Wire x1={26} y1={40} x2={44} y2={40} />
      <Wire x1={44} y1={40} x2={44} y2={104} />
      <Wire x1={44} y1={104} x2={120} y2={104} />
      <Dot x={120} y={104} />
      <Part id="T" live={live}>
        <Xfmr x={140} y={104} label={`${fmt(1 / (p.n || 0.125), '', 3)}:1`} />
      </Part>
      <Wire x1={120} y1={72} x2={76} y2={72} />
      <Part id="Q1" live={live}>
        <Switch x1={76} y1={72} x2={76} y2={190} />
      </Part>
      <Tag x={66} y={98} anchor="end">Q₁</Tag>
      <Wire x1={120} y1={136} x2={100} y2={136} />
      <Part id="Q2" live={live}>
        <Switch x1={100} y1={136} x2={100} y2={190} />
      </Part>
      <Tag x={112} y={172} anchor="start">Q₂</Tag>
      <Wire x1={160} y1={104} x2={160} y2={190} />
      {secondary(live, { x: 160, top: 72, bot: 136, node: 220 })}
      {filter(p, live, { node: 220, top: 40, mid: 104, bot: 190 })}
      <Wire x1={26} y1={190} x2={398} y2={190} />
      <Gnd x={300} y={190} />
      <IAt sig="iin" x={70} y={104} dy={-6} />
      <IAt sig="iQ" x={76} y={98} dir="down" dx={6} dy={0} anchor="start" />
    </>
  )

  /** The full bridge: four switches, two diagonals, the rail and no more. */
  const fullbridge = (p, live) => (
    <>
      <SrcDC x={28} y={104} label={`V_in ${volts(p.Vin)}`} />
      <Wire x1={28} y1={40} x2={28} y2={74} />
      <Wire x1={28} y1={134} x2={28} y2={190} />
      <Wire x1={28} y1={40} x2={104} y2={40} />
      <Part id="Q1" live={live}>
        <Switch x1={56} y1={40} x2={56} y2={88} />
        <Switch x1={104} y1={120} x2={104} y2={190} />
      </Part>
      <Tag x={46} y={62} anchor="end">Q₁</Tag>
      <Tag x={116} y={162} anchor="start">Q₄</Tag>
      <Part id="Q2" live={live}>
        <Switch x1={104} y1={40} x2={104} y2={88} />
        <Switch x1={56} y1={120} x2={56} y2={190} />
      </Part>
      <Tag x={116} y={62} anchor="start">Q₂</Tag>
      <Tag x={46} y={162} anchor="end">Q₃</Tag>
      <Wire x1={56} y1={88} x2={56} y2={120} />
      <Wire x1={104} y1={88} x2={104} y2={120} />
      <Dot x={56} y={104} />
      <Dot x={104} y={104} />
      <Wire x1={56} y1={104} x2={68} y2={104} />
      <Wire x1={68} y1={104} x2={68} y2={72} />
      <Wire x1={68} y1={72} x2={120} y2={72} />
      <Wire x1={104} y1={104} x2={112} y2={104} />
      <Wire x1={112} y1={104} x2={112} y2={136} />
      <Wire x1={112} y1={136} x2={120} y2={136} />
      <Part id="T" live={live}>
        <Xfmr x={140} y={104} label={`${fmt(1 / (p.n || 0.125), '', 3)}:1`} />
      </Part>
      <Wire x1={160} y1={104} x2={160} y2={190} />
      {secondary(live, { x: 160, top: 72, bot: 136, node: 220 })}
      {filter(p, live, { node: 220, top: 40, mid: 104, bot: 190 })}
      <Wire x1={28} y1={190} x2={398} y2={190} />
      <Gnd x={300} y={190} />
      <IAt sig="iin" x={42} y={40} dy={-6} />
      <IAt sig="iQ" x={56} y={74} dir="down" dx={6} dy={0} anchor="start" />
    </>
  )

  const resonant = (p, live, llc) => (
    <>
      <SrcDC x={24} y={100} label={`V_in ${volts(p.Vin)}`} />
      <Wire x1={24} y1={36} x2={24} y2={70} />
      <Wire x1={24} y1={130} x2={24} y2={178} />
      <Wire x1={24} y1={36} x2={68} y2={36} />
      <Part id="Q1" live={live}>
        <Switch x1={68} y1={36} x2={68} y2={86} />
      </Part>
      <Tag x={56} y={58} anchor="end">Q₁</Tag>
      <Wire x1={68} y1={86} x2={68} y2={114} />
      <Dot x={68} y={100} />
      <Part id="Q2" live={live}>
        <Switch x1={68} y1={114} x2={68} y2={178} />
      </Part>
      <Tag x={56} y={150} anchor="end">Q₂</Tag>
      <Wire x1={24} y1={178} x2={68} y2={178} />
      <Wire x1={68} y1={100} x2={80} y2={100} />
      <Wire x1={80} y1={100} x2={80} y2={54} />
      <Part id="L" live={live}>
        <Ind x={112} y={54} label={`L_r ${henries(p.Lr)}`} />
      </Part>
      <Wire x1={144} y1={54} x2={152} y2={54} />
      <Part id="Cr" live={live}>
        <Cap x={172} y={54} vertical={false} label={`C_r ${farads(p.Cr)}`} />
      </Part>
      <Wire x1={192} y1={54} x2={204} y2={54} />
      <Wire x1={204} y1={54} x2={204} y2={68} />
      <Part id="T" live={live}>
        <Xfmr x={224} y={100} label={`${fmt(1 / (p.n || 0.5), '', 3)}:1`} span={30} />
      </Part>
      {llc ? <Tag x={196} y={104}>{`L_m ${henries(p.Lm)}`}</Tag> : null}
      <Wire x1={204} y1={132} x2={204} y2={178} />
      <Wire x1={68} y1={178} x2={204} y2={178} />
      <Wire x1={244} y1={68} x2={252} y2={68} />
      <Tag x={276} y={56}>D₁</Tag>
      <Part id="D1" live={live}>
        <Diode x1={252} y1={68} x2={292} y2={68} />
      </Part>
      <Wire x1={244} y1={132} x2={252} y2={132} />
      <Tag x={276} y={150}>D₂</Tag>
      <Part id="D2" live={live}>
        <Diode x1={252} y1={132} x2={292} y2={132} />
      </Part>
      <Wire x1={292} y1={68} x2={306} y2={68} />
      <Wire x1={292} y1={132} x2={306} y2={132} />
      <Wire x1={306} y1={68} x2={306} y2={132} />
      <Dot x={306} y={100} />
      <Wire x1={306} y1={100} x2={306} y2={36} />
      <Wire x1={306} y1={36} x2={330} y2={36} />
      <Dot x={330} y={36} />
      <Wire x1={330} y1={36} x2={330} y2={80} />
      <Part id="C" live={live}>
        <Cap x={330} y={100} label={`C ${farads(p.C)}`} side="below" />
      </Part>
      <Wire x1={330} y1={120} x2={330} y2={178} />
      <Wire x1={330} y1={36} x2={368} y2={36} />
      <Wire x1={368} y1={36} x2={368} y2={80} />
      <Part id="R" live={live}>
        <Res x={368} y={100} vertical label={`R ${ohms(p.R)}`} side="below" />
      </Part>
      <Wire x1={368} y1={120} x2={368} y2={178} />
      <Wire x1={224} y1={100} x2={224} y2={178} />
      <Wire x1={204} y1={178} x2={368} y2={178} />
      <Gnd x={284} y={178} />
      <VAt sig="vsw" x={80} y={100} dx={6} dy={14} anchor="start" />
      <IAt sig="iQ" x={68} y={74} dir="down" dx={6} dy={0} anchor="start" />
      <IAt sig="iL" x={92} y={54} dy={-8} />
      <IAt sig="iD" x={280} y={68} dy={-8} />
      <IAt sig="iC" x={330} y={56} dir="down" dx={-6} dy={4} anchor="end" />
      <VAt sig="vout" x={348} y={36} dx={4} dy={-8} anchor="start" />
    </>
  )

  return {
    forward,
    pushpull,
    fullbridge,
    src: (p, live) => resonant(p, live, false),
    llc: (p, live) => resonant(p, live, true),
  }
}
