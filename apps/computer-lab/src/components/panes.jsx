import React from 'react'
import { CONTROL_SIGNALS, FIELDS, OPS } from '../engine/isa.js'
import { textOf } from '../engine/datapath.js'
import { STAGES, psOf } from '../engine/card.js'
import { quantitiesOf, kindOf } from '../analysis.js'
import { bytes, cycles as cyclesText, gateDelays, hex, hz, num, pct, ps, time } from '../format.js'

// The panes that are tables rather than drawings: the program and its
// registers, the trace, the clock budget, the paths, the control table and the
// numbers pane.
//
// Each reads the one analysis object the app already has, so no pane can
// disagree with another about a number.

/** The numbers this experiment produces, each with the name the lesson uses. */
export function CountsPane({ x }) {
  const rows = quantitiesOf(x)
  if (!rows.length) return <Empty>This experiment produces no numbers of its own.</Empty>
  return (
    <div className="pane-scroll">
      <table className="paths">
        <thead>
          <tr>
            <th>Quantity</th>
            <th>Reading</th>
            <th>Path</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.path}>
              <td>{r.label}</td>
              <td className="num">{printed(r)}</td>
              <td className="path">{r.path}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="pane-note">Every number in the lesson is one of these readings, and each is computed from the model card rather than typed in.</p>
    </div>
  )
}

/** One reading, printed in the unit its kind says. */
export function printed(r) {
  switch (kindOf(r.path)) {
    case 'ps':
      return time(r.value)
    case 'g':
      return gateDelays(r.value)
    case 'freq':
      return hz(r.value)
    case 'share':
      return pct(r.value)
    case 'bytes':
      return bytes(r.value)
    case 'cycles':
      return cyclesText(r.value)
    case 'ns':
      return ps(r.value * 1000)
    case 'text':
      return String(r.value)
    default:
      return num(r.value, 4)
  }
}

/** The program, with each instruction's fields decoded and the counter marked. */
export function ProgramPane({ x }) {
  if (!x.code) return <Empty>This experiment runs no program.</Empty>
  const run = x.run || x.pipe
  const at = run && run.trace && run.trace.length ? run.trace[Math.min(x.cycle ?? 0, run.trace.length - 1)] : null
  const here = at ? at.index ?? (at.stages ? at.stages.fetch : null) : null
  return (
    <div className="pane-scroll">
      <table className="paths">
        <thead>
          <tr>
            <th>Address</th>
            <th>Instruction</th>
            <th>Word</th>
            <th>Fields</th>
          </tr>
        </thead>
        <tbody>
          {x.code.map((instr, k) => (
            <tr key={k} className={k === here ? 'is-critical' : undefined}>
              <td className="num">{k * 4}</td>
              <td>{textOf(instr)}</td>
              <td className="num">{hex(instr.word)}</td>
              <td className="path">{fieldText(instr)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <RegisterTable run={run} />
      <p className="pane-note">
        {x.program.name}. {x.program.note}
      </p>
    </div>
  )
}

const fieldText = (instr) =>
  instr.kind === 'r'
    ? `op ${OPS[instr.op].op}, rs ${instr.rs}, rt ${instr.rt}, rd ${instr.rd}, funct ${instr.funct}`
    : instr.kind === 'i'
      ? `op ${OPS[instr.op].op}, rs ${instr.rs}, rt ${instr.rt}, imm ${instr.imm}`
      : `op ${OPS[instr.op].op}, target ${instr.target}`

/** The register file at the end of the run, with the registers that changed. */
export function RegisterTable({ run }) {
  if (!run) return null
  const regs = [...run.regs]
  const shown = regs.map((v, i) => ({ i, v })).filter((r) => r.v !== 0 || r.i === 0)
  return (
    <table className="paths regfile">
      <thead>
        <tr>
          <th>Register</th>
          {shown.map((r) => (
            <th key={r.i}>r{r.i}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>value</td>
          {shown.map((r) => (
            <td key={r.i} className="num">
              {r.v}
            </td>
          ))}
        </tr>
      </tbody>
    </table>
  )
}

/** The address trace, with hit or miss beside each entry and the running rate. */
export function TracePane({ x }) {
  if (!x.cache) return <Empty>This experiment reads no trace.</Empty>
  let hits = 0
  const rows = x.cache.perAccess.map((a, k) => {
    if (a.hit) hits++
    return { ...a, k, running: hits / (k + 1) }
  })
  return (
    <div className="pane-scroll">
      <table className="events">
        <thead>
          <tr>
            <th>#</th>
            <th>Address</th>
            <th>Block</th>
            <th>Set</th>
            <th>Tag</th>
            <th>Result</th>
            <th>Hit rate so far</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.k} className={r.k === (x.step ?? -1) ? 'is-critical' : undefined}>
              <td className="num">{r.k + 1}</td>
              <td className="num">{r.addr}</td>
              <td className="num">{r.block}</td>
              <td className="num">{r.set}</td>
              <td className="num">{r.tag}</td>
              <td className={r.hit ? 'is-one' : undefined}>{r.hit ? 'hit' : `miss, ${r.cause}`}</td>
              <td className="num">{pct(r.running)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="pane-note">
        {x.cache.refs} references to {x.cache.distinct} distinct blocks. {x.cache.hits} hits and {x.cache.misses} misses, so {pct(x.cache.rate)}. This rate belongs to this trace.
      </p>
    </div>
  )
}

/** The clock period broken into its parts, stage by stage. */
export function BudgetPane({ x }) {
  const t = x.timing
  const rows = STAGES.map((s) => ({ name: s, ...t.stage[s] }))
  const worst = Math.max(...rows.map((r) => r.delay))
  return (
    <div className="pane-scroll">
      <table className="paths">
        <thead>
          <tr>
            <th>Stage</th>
            <th>Logic</th>
            <th>Register</th>
            <th>Period it needs</th>
            <th>Blocks</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.name} className={r.delay === worst ? 'is-critical' : undefined}>
              <td>{r.name}</td>
              <td className="num">{time(r.logic)}</td>
              <td className="num">{time(t.overhead)}</td>
              <td className="num">{time(r.delay)}</td>
              <td className="path">{r.through.join(' → ')}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="pane-note">
        The slowest stage sets the clock at {time(t.pipePeriod)}, which is {hz(t.pipeFreq)}. The register overhead is {time(t.overhead)} of that, or {pct(t.overheadShare, 1)}. Split
        the same logic evenly and the period would be {time(t.evenPeriod)}.
      </p>
      <table className="paths">
        <thead>
          <tr>
            <th>Instruction</th>
            <th>Gate delays</th>
            <th>Path</th>
            <th>Blocks</th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(t.single).map(([cls, s]) => (
            <tr key={cls} className={cls === t.critical ? 'is-critical' : undefined}>
              <td>{cls}</td>
              <td className="num">{s.gates}</td>
              <td className="num">{time(s.delay)}</td>
              <td className="path">{s.through.join(' → ')}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="pane-note">
        On the one-cycle machine every instruction gets the longest instruction's period, which is the {t.critical}'s {time(t.singlePeriod)}. The model card charges the ALU its
        lookahead carry, and the output multiplexer separately.
      </p>
    </div>
  )
}

/** Every endpoint's longest and shortest arrival, and the gates along each. */
export function PathList({ x }) {
  if (!x.paths) return <Empty>This experiment times no netlist.</Empty>
  const ends = [...x.paths.endpoints].sort((a, b) => b.long - a.long).slice(0, 24)
  return (
    <div className="pane-scroll">
      <table className="paths">
        <thead>
          <tr>
            <th>Endpoint</th>
            <th>Longest</th>
            <th>In gate delays</th>
            <th>The path</th>
          </tr>
        </thead>
        <tbody>
          {ends.map((e) => (
            <tr key={e.signal} className={e.long === x.paths.long.delay ? 'is-critical' : undefined}>
              <td>{e.signal}</td>
              <td className="num">{time(e.long)}</td>
              <td className="num">{num(e.long / x.card.gate, 2)}</td>
              <td className="path">{e.path.slice(-6).join(' → ')}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="pane-note">
        The longest path is {time(x.paths.long.delay)}, which is {num(x.paths.long.delay / x.card.gate, 2)} gate delays, from {x.paths.long.from} to {x.paths.long.to}. The netlist has{' '}
        {x.norm.gates.length} gates.
      </p>
    </div>
  )
}

/** The control unit's truth table: nine signals for each of the twelve opcodes. */
export function ControlTable({ x }) {
  if (!x.control) return <Empty>This experiment does not decode an opcode.</Empty>
  return (
    <div className="pane-scroll">
      <table className="truth">
        <thead>
          <tr>
            <th className="in">instruction</th>
            <th className="in">opcode</th>
            {CONTROL_SIGNALS.map((s) => (
              <th key={s}>{s}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {x.control.rows.map((r) => (
            <tr key={r.op}>
              <td className="in">{r.op}</td>
              <td className="in">{r.opcode}</td>
              {CONTROL_SIGNALS.map((s) => (
                <td key={s} className={r.out[s] === 1 ? 'is-one' : undefined}>
                  {String(r.out[s])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="pane-note">
        Nine signals from a six-bit opcode, twelve rows. The fields they come from sit at bits {FIELDS.op[0]} down, and the immediate is the low {FIELDS.imm[1]} bits.
      </p>
    </div>
  )
}

/** What the engine declined, and why. A refusal is content, not a failure. */
export function Refusal({ refusal }) {
  return (
    <div className="refusal">
      <p className="refusal-code">{refusal.code || 'declined'}</p>
      <p>{refusal.message}</p>
    </div>
  )
}

const Empty = ({ children }) => <p className="pane-empty">{children}</p>

export { psOf }
