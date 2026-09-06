// What the "Something wrong or unclear?" link carries with it.
//
// CONTRIBUTING.md says the attached setup is usually what decides whether a
// report can be chased down. For this lab that is the experiment, every knob,
// and the two or three numbers on screen, so a reader only has to write what
// they noticed.

import { fmtBits, fmtRate } from './format.js'

export function reportSummary(exp, p, x, view) {
  const knobs = exp.params.map((k) => `${k.label}: ${format(k, p[k.key])}`)
  const lines = [`Information Lab — ${exp.id.toUpperCase()} ${exp.name}`, `View: ${view}`, '', 'Settings:', ...knobs.map((s) => `  ${s}`)]
  if (x && x.refusal) lines.push('', `The engine declined this setting: ${x.refusal.code}`, `  ${x.refusal.message}`)
  if (x) {
    lines.push('', 'Readings:')
    if (x.source) {
      lines.push(`  entropy: ${fmtBits(x.source.H)}`)
      lines.push(`  average length: ${fmtBits(x.source.meanLength)}`)
      if (x.source.arith) lines.push(`  arithmetic word: ${x.source.arith.length} bit for ${x.source.arith.n} symbols`)
    }
    if (x.capacity) {
      if (x.capacity.awgn !== undefined) lines.push(`  Gaussian capacity: ${fmtBits(x.capacity.awgn, 'bit/s/Hz')}`)
      if (x.capacity.bsc !== undefined) lines.push(`  symmetric capacity: ${fmtBits(x.capacity.bsc, 'bit per use')}`)
      if (x.capacity.limitDb !== undefined) lines.push(`  Shannon limit: ${x.capacity.limitDb.toFixed(4)} dB`)
    }
    if (x.block) {
      lines.push(`  code: (${x.block.n},${x.block.k}) d = ${x.block.d}, rate ${fmtRate(x.block.rate)}`)
      lines.push(`  syndrome: ${x.block.syndrome.join('')}`)
      if (x.block.decoded) lines.push(`  decoded: ${x.block.right ? 'the word that was sent' : 'another codeword'}`)
    }
    if (x.field) lines.push(`  ${x.field.rs.name}: ${x.field.positions.length} erasures, ${x.field.refusal ? x.field.refusal.code : x.field.right ? 'filled' : 'wrong'}`)
    if (x.conv) {
      lines.push(`  encoder: K = ${x.conv.enc.K}, generators ${x.conv.enc.gens.join(' and ')}, free distance ${x.conv.dfree}`)
      lines.push(`  decode: metric ${round(x.conv.viterbi.metric)}, ${x.conv.errors} message bits wrong of ${x.conv.bits.length}`)
    }
    if (x.ldpc) {
      lines.push(`  graph: ${x.ldpc.graph.n} bits, ${x.ldpc.graph.m} checks, rank ${x.ldpc.rank}, rate ${fmtRate(x.ldpc.rate)}`)
      if (x.ldpc.bp) lines.push(`  belief propagation: ${x.ldpc.bp.converged ? `converged at iteration ${x.ldpc.bp.iteration}` : 'did not converge'}`)
      if (x.ldpc.bp) lines.push(`  syndrome weights: ${x.ldpc.bp.syndromeWeights.join(', ')}`)
    }
    if (x.curve) lines.push(`  curve: ${x.curve.yLabel} against ${x.curve.xLabel}, ${x.curve.points.length} points`)
  }
  return lines.join('\n')
}

const format = (k, v) => {
  if (k.kind === 'choice') return (k.options.find((o) => o.value === v) || {}).label ?? String(v)
  return k.unit ? `${v} ${k.unit}` : String(v)
}

const round = (v) => (Number.isFinite(v) ? Math.round(v * 1000) / 1000 : '—')
