import React from 'react'
import { RS_DECODER_STATUS, polyText, stateText } from '@ee-labs/codes'
import { bitsText, fmtBits, fmtDb, fmtPercent, fmtRate, symbolText } from '../format.js'

// The panes that are tables rather than pictures.
//
// Each reads the one analysis the shell computed, so nothing here recomputes
// anything. A cell that changed with the reader's last move is marked, which is
// what makes the syndrome's dependence on the error visible rather than
// asserted (INFORMATION_LAB_PLAN.md §4.2).

/** The generator matrix, the parity checks, and the syndrome table beside them. */
export function CodeTable({ x }) {
  const b = x.block
  if (!b) return <Empty>Pick a code to see its matrices.</Empty>
  const rows = b.table ? [...b.table.table.entries()].sort((a, c) => a[0] - c[0]) : []
  return (
    <div className="pane-scroll">
      <table className="matrix">
        <caption>Generator matrix, {b.k} rows of {b.n} bits</caption>
        <tbody>
          {b.code.G.map((row, i) => (
            <tr key={i}>
              {row.map((bit, j) => (
                <td key={j} className={bit ? 'is-one' : ''}>
                  {bit}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <table className="matrix">
        <caption>Parity-check matrix, {b.n - b.k} rows of {b.n} bits</caption>
        <tbody>
          {b.code.H.map((row, i) => (
            <tr key={i}>
              {row.map((bit, j) => (
                <td key={j} className={`${bit ? 'is-one' : ''}${b.error[j] ? ' is-hit' : ''}`}>
                  {bit}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length ? (
        <table className="truth">
          <caption>Syndrome table, {rows.length} of them</caption>
          <thead>
            <tr>
              <th>syndrome</th>
              <th>error it names</th>
              <th>weight</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([syndrome, leader]) => {
              const here = syndrome === b.syndrome.reduce((acc, bit) => acc * 2 + bit, 0)
              return (
                <tr key={syndrome} className={here ? 'is-here' : ''}>
                  <td>{bitsText(b.syndrome.map(() => 0).map((_, i) => (syndrome >> (b.n - b.k - 1 - i)) & 1))}</td>
                  <td>{bitsText(leader)}</td>
                  <td className="num">{leader.reduce((a, c) => a + c, 0)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      ) : null}
    </div>
  )
}

/** What was sent, what arrived, and what the decoder made of it. */
export function DecodePane({ x }) {
  const b = x.block
  const v = x.conv
  const g = x.ldpc
  if (b)
    return (
      <div className="readouts">
        <Row label="Message" value={bitsText(b.message)} />
        <Row label="Codeword" value={bitsText(b.codeword)} />
        <Row label="Error pattern" value={bitsText(b.error)} tone={b.flips ? 'warn' : null} />
        <Row label="Received" value={bitsText(b.received)} />
        <Row label="Syndrome" value={bitsText(b.syndrome)} tone={b.syndrome.some((s) => s) ? 'warn' : null} />
        {b.remainder ? <Row label="Remainder" value={bitsText(b.remainder)} /> : null}
        {b.decoded ? <Row label="Error it names" value={bitsText(b.decoded.error)} /> : null}
        {b.decoded ? <Row label="Decoded word" value={bitsText(b.decoded.word)} tone={b.right ? null : 'warn'} /> : null}
        {b.decoded ? <Row label="Right" value={b.right ? 'the word that was sent' : 'another codeword'} tone={b.right ? null : 'warn'} /> : null}
      </div>
    )
  if (v)
    return (
      <div className="readouts">
        <Row label="Message" value={short(v.bits)} />
        <Row label="Sent" value={short(v.sent.bits)} />
        <Row label="Received" value={v.soft ? short(v.received.map((y) => y.toFixed(1)), ' ') : short(v.received)} />
        <Row label="Decoded" value={short(v.viterbi.bits)} />
        <Row label="Path metric" value={String(round(v.viterbi.metric))} />
        <Row label="Bits wrong" value={String(v.errors)} tone={v.errors ? 'warn' : null} />
        <Row label="Channel bits wrong" value={String(v.flips)} />
        <Row label="Add-compare-select" value={`${v.viterbi.acs} over the block`} />
      </div>
    )
  if (g && g.code)
    return (
      <div className="readouts">
        <Row label="Codeword" value={bitsText(g.codeword)} />
        <Row label="Received" value={bitsText(g.received)} />
        <Row label="Checks failed" value={`${g.weight} of ${g.graph.m}`} tone={g.weight ? 'warn' : null} />
        {g.bp ? <Row label="Decoded" value={bitsText(g.bp.bits)} tone={g.right ? null : 'warn'} /> : null}
        {g.bp ? <Row label="Converged" value={g.bp.converged ? `at iteration ${g.bp.iteration}` : 'not in the iterations run'} tone={g.bp.converged ? null : 'warn'} /> : null}
      </div>
    )
  return <Empty>This experiment decodes nothing.</Empty>
}

/** Each symbol with its probability, its ideal length and its codeword. */
export function SourcePane({ x }) {
  const s = x.source
  if (!s) return <Empty>This experiment has no source.</Empty>
  return (
    <div className="pane-scroll">
      <table className="truth">
        <thead>
          <tr>
            <th>symbol</th>
            <th>p</th>
            <th>−log₂ p</th>
            <th>codeword</th>
            <th>length</th>
          </tr>
        </thead>
        <tbody>
          {s.probs.map((p, i) => (
            <tr key={i}>
              <td>{i + 1}</td>
              <td className="num">{p.toFixed(4)}</td>
              <td className="num">{p > 0 ? (-Math.log2(p)).toFixed(4) : '—'}</td>
              <td>{s.words[i]}</td>
              <td className="num">{s.lengths[i]}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="readouts">
        <Row label="Entropy" value={fmtBits(s.H, 'bit per symbol')} />
        <Row label="Average length" value={fmtBits(s.meanLength, 'bit per symbol')} />
        <Row label="Redundancy" value={fmtBits(s.redundancy)} />
        <Row label="Efficiency" value={fmtPercent(s.efficiency)} />
        <Row label="Kraft sum" value={s.kraft.toFixed(6)} />
        {s.blocked ? <Row label="Blocked" value={s.blocked.map((r) => `${r.n}: ${r.meanLength.toFixed(6)}`).join(', ')} /> : null}
        {s.arith ? <Row label="Arithmetic bound" value={fmtBits(s.arith.bound)} /> : null}
        {s.arith ? <Row label="Arithmetic word" value={`${s.arith.length} bit for ${s.arith.n} symbols`} /> : null}
      </div>
    </div>
  )
}

/** The channel's own numbers, and the capacity that follows from them. */
export function ChannelPane({ x }) {
  const c = x.capacity
  if (!c) return <Empty>This experiment has no channel.</Empty>
  return (
    <div className="readouts">
      {c.snrDb !== undefined && c.awgn !== undefined ? <Row label="Gaussian capacity" value={fmtBits(c.awgn, 'bit/s/Hz')} /> : null}
      {c.crossover !== undefined ? <Row label="Crossover" value={c.crossover.toFixed(4)} /> : null}
      {c.bsc !== undefined ? <Row label="Symmetric capacity" value={fmtBits(c.bsc, 'bit per use')} /> : null}
      {c.erasure !== undefined ? <Row label="Erasure probability" value={c.erasure.toFixed(4)} /> : null}
      {c.bec !== undefined ? <Row label="Erasure capacity" value={fmtBits(c.bec, 'bit per use')} /> : null}
      {c.efficiency !== undefined ? <Row label="Spectral efficiency" value={`${c.efficiency} bit/s/Hz`} /> : null}
      {c.limitDb !== undefined ? <Row label="Shannon limit" value={fmtDb(c.limitDb)} /> : null}
      {c.floorDb !== undefined ? <Row label="Floor, ln 2" value={fmtDb(c.floorDb)} /> : null}
      <Row label="Crossover at half capacity" value={c.half.toFixed(6)} />
      {c.bi ? (
        <>
          <Row label="Binary-input capacity" value={fmtBits(c.bi.capacity, 'bit per use')} />
          <Row label="Grids differ by" value={c.bi.delta.toExponential(2)} tone={c.bi.converged ? null : 'warn'} />
        </>
      ) : null}
      {c.bi ? (
        <p className="pane-note">
          The binary-input capacity has no closed form. It is integrated on a grid and again on one twice as fine, and the difference between the two is printed
          above. Every other number on this pane is a closed form.
        </p>
      ) : null}
    </div>
  )
}

/** The powers of the primitive element, and the Reed-Solomon code over them. */
export function FieldPane({ x }) {
  const f = x.field
  if (!f) return <Empty>This experiment has no field.</Empty>
  return (
    <div className="pane-scroll">
      <table className="truth">
        <caption>GF(2⁴) from x⁴ + x + 1, {f.f.order} nonzero elements</caption>
        <thead>
          <tr>
            <th>power</th>
            <th>bits</th>
            <th>as a polynomial</th>
          </tr>
        </thead>
        <tbody>
          {f.powers.map((row) => (
            <tr key={row.i}>
              <td>α^{row.i}</td>
              <td>{symbolText(row.value, f.f.m)}</td>
              <td>{polyText(f.f, row.value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="readouts">
        <Row label="Code" value={`${f.rs.name} over GF(2^${f.rs.m})`} />
        <Row label="Distance" value={`${f.rs.d}, which is n − k + 1`} />
        <Row label="Corrects" value={`${f.rs.t} symbol errors, or ${f.rs.erasures} erasures`} />
        <Row label="Rate" value={fmtRate(f.rs.rate)} />
        <Row label="Codeword" value={f.codeword.join(' ')} />
        <Row label="Erased at" value={f.positions.length ? f.positions.map((p) => p + 1).join(', ') : 'nowhere'} />
        <Row label="Filled" value={f.refusal ? 'declined' : f.right ? 'back to the codeword' : 'wrongly'} tone={f.refusal || !f.right ? 'warn' : null} />
      </div>
      {f.refusal ? <Refusal refusal={f.refusal} /> : null}
      <p className="pane-note">
        This version builds {RS_DECODER_STATUS.built.join(', ')}. It does not build {RS_DECODER_STATUS.missing}.
      </p>
    </div>
  )
}

/** The encoder's whole branch table, which for the reference code is eight rows. */
export function EncoderTable({ x }) {
  const v = x.conv
  if (!v) return <Empty>This experiment has no encoder.</Empty>
  return (
    <div className="pane-scroll">
      <table className="truth">
        <caption>
          {v.enc.states} states, {v.enc.table.length} branches, generators {v.enc.gens.join(' and ')} in octal
        </caption>
        <thead>
          <tr>
            <th>state</th>
            <th>input</th>
            <th>next state</th>
            <th>output</th>
          </tr>
        </thead>
        <tbody>
          {v.enc.table.map((row, i) => (
            <tr key={i}>
              <td>{stateText(v.enc, row.state)}</td>
              <td>{row.bit}</td>
              <td>{stateText(v.enc, row.next)}</td>
              <td className="is-one">{row.out.join('')}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="readouts">
        <Row label="Free distance" value={String(v.dfree)} />
        <Row label="Add-compare-select" value={`${v.enc.acs} a step`} />
        <Row label="Traceback rule" value={`${v.traceback} steps`} />
      </div>
    </div>
  )
}

/** The graph's counts, and the rate its rank gives. */
export function GraphPane({ x }) {
  const g = x.ldpc
  if (!g) return <Empty>This experiment has no graph.</Empty>
  return (
    <div className="readouts">
      <Row label="Bits" value={String(g.graph.n)} />
      <Row label="Checks" value={String(g.graph.m)} />
      <Row label="Edges" value={String(g.graph.edges.length)} />
      <Row label="Checks per bit" value={String(g.graph.degreeV)} />
      <Row label="Bits per check" value={String(g.graph.degreeC)} />
      <Row label="Design rate" value={fmtRate(g.designRate)} />
      <Row label="Rank" value={`${g.rank}, so ${g.dependent} row is dependent`} />
      <Row label="True rate" value={fmtRate(g.rate)} />
      {g.d ? <Row label="Distance" value={String(g.d)} /> : null}
      <p className="pane-note">
        Every bit sits in {g.graph.degreeV} checks, so every column has even weight and the rows sum to zero. The design rate is what the degrees promise. The
        true rate is what the rank gives.
      </p>
    </div>
  )
}

/** A refusal is content, not a failure. */
export function Refusal({ refusal }) {
  if (!refusal) return null
  return (
    <div className="refusal">
      <p className="refusal-code">{refusal.code}</p>
      <p>{refusal.message}</p>
    </div>
  )
}

function Row({ label, value, tone = null }) {
  return (
    <div className={`readout${tone ? ` is-${tone}` : ''}`}>
      <span className="readout-label">{label}</span>
      <b>{value}</b>
    </div>
  )
}

function Empty({ children }) {
  return <p className="pane-empty">{children}</p>
}

const short = (v, join = '') => (v.length > 48 ? `${v.slice(0, 48).join(join)}…` : v.join(join))
const round = (v) => (Number.isFinite(v) ? Math.round(v * 100) / 100 : '—')
