// The convolutional encoder, its trellis, and Viterbi's decoder.
//
// An encoder is a shift register of `K` bits and one modulo-two sum per output.
// The register's earlier `K − 1` bits are the state, so an encoder of
// constraint length `K` has `2^(K−1)` states and two branches out of each.
//
// Viterbi keeps every step. `viterbi` returns the survivor into every state at
// every step, its path metric, and the branch metric of both branches into it,
// so the trellis walker draws the decode rather than a summary of it
// (INFORMATION_LAB_PLAN.md §2.6).

import { CodesError } from './gf2.js'

/**
 * An encoder from a constraint length and generator polynomials in octal.
 *
 * The register holds the incoming bit first and the state after it, so
 * generator 5 (octal 101) taps the incoming bit and the oldest state bit. The
 * reference code is `K = 3` with generators 5 and 7, whose whole trellis is the
 * table in the plan's §3.
 *
 * @param {{ K: number, gens: number[] }} spec
 * @returns {{ K, gens, taps, states, rate, n, memory, next, output, table, acs }}
 */
export function encoder({ K, gens }) {
  if (!Number.isInteger(K) || K < 2 || K > 10) throw new CodesError('conv-length', `a constraint length of 2 to 10 is built here, not ${K}`)
  if (!gens.length) throw new CodesError('conv-generators', 'an encoder needs at least one generator')
  const taps = gens.map((g) => {
    const bits = parseInt(String(g), 8)
    if (!Number.isFinite(bits) || bits <= 0) throw new CodesError('conv-generators', `${g} is not an octal generator`)
    if (bits >= 1 << K) throw new CodesError('conv-generators', `generator ${g} needs more than ${K} taps`)
    // Bit i of the octal number taps register position i, counting from the
    // incoming bit. Written the way a textbook draws the register.
    return Array.from({ length: K }, (_, i) => (bits >> (K - 1 - i)) & 1)
  })
  const memory = K - 1
  const states = 1 << memory
  const enc = {
    K,
    gens,
    taps,
    memory,
    states,
    n: gens.length,
    k: 1,
    rate: 1 / gens.length,
    acs: 2 * states,
  }
  enc.next = (state, bit) => ((bit << (memory - 1)) | (state >> 1)) & (states - 1)
  enc.output = (state, bit) => {
    const reg = [bit, ...Array.from({ length: memory }, (_, i) => (state >> (memory - 1 - i)) & 1)]
    return taps.map((t) => t.reduce((acc, tap, i) => acc ^ (tap & reg[i]), 0))
  }
  enc.table = []
  for (let s = 0; s < states; s++)
    for (const bit of [0, 1]) enc.table.push({ state: s, bit, next: enc.next(s, bit), out: enc.output(s, bit) })
  return enc
}

/** A state as its bits, oldest bit last, the way the trellis labels its rows. */
export const stateText = (enc, s) => s.toString(2).padStart(enc.memory, '0')

/** One message through the encoder, with `memory` zeros appended to return it to state 0. */
export function encode(enc, bits, { terminate = true } = {}) {
  const input = terminate ? [...bits, ...new Array(enc.memory).fill(0)] : [...bits]
  let state = 0
  const out = []
  const path = [0]
  for (const b of input) {
    out.push(...enc.output(state, b))
    state = enc.next(state, b)
    path.push(state)
  }
  return { bits: out, path, input, state, steps: input.length }
}

/**
 * The trellis of `steps` steps: every branch, with the state it leaves, the
 * state it enters, the input that takes it and the output it puts out.
 */
export function trellis(enc, steps) {
  return Array.from({ length: steps }, () => enc.table.map((b) => ({ ...b })))
}

/**
 * Viterbi's decoder, with every step retained.
 *
 * @param {object} enc
 * @param {number[]} received   hard bits, or soft values when `soft` is set
 * @param {object} [opts]
 *   `soft`        the received values are real numbers, and the branch metric
 *                 is the squared distance to ±1 rather than a Hamming distance
 *   `terminated`  the encoder was run back to state 0, so only that state may
 *                 finish the path
 *   `depth`       traceback depth in steps. The decision at step `i` is read
 *                 from the survivor of the best state at step `i + depth`,
 *                 which is what a decoder with finite memory does
 * @returns {{
 *   bits, path, metric, steps, acs, comparisons
 * }} `steps[i].states[s]` carries `{ metric, from, bit, branches }`, and
 *   `branches` holds both branches into that state with their own metrics.
 */
export function viterbi(enc, received, { soft = false, terminated = true, depth = null } = {}) {
  const n = enc.n
  if (received.length % n) throw new CodesError('conv-length', `${received.length} received values is not a whole number of ${n}-bit branches`)
  const steps = received.length / n
  const INF = Infinity
  let metrics = new Array(enc.states).fill(INF)
  metrics[0] = 0
  const kept = []
  for (let i = 0; i < steps; i++) {
    const chunk = received.slice(i * n, i * n + n)
    const next = new Array(enc.states).fill(INF)
    const survivors = Array.from({ length: enc.states }, () => ({ metric: INF, from: null, bit: null, branches: [] }))
    for (const b of enc.table) {
      if (metrics[b.state] === INF) continue
      const branch = branchMetric(b.out, chunk, soft)
      const total = metrics[b.state] + branch
      const cell = survivors[b.next]
      cell.branches.push({ from: b.state, bit: b.bit, out: b.out, branch, total })
      if (total < cell.metric) {
        cell.metric = total
        cell.from = b.state
        cell.bit = b.bit
      }
      next[b.next] = Math.min(next[b.next], total)
    }
    for (const cell of survivors) {
      for (const br of cell.branches) br.survivor = br.from === cell.from && br.bit === cell.bit
    }
    metrics = next
    kept.push({ step: i, received: chunk, states: survivors, best: bestOf(next) })
  }
  const bits = depth ? tracebackWithDepth(kept, enc, depth, terminated) : traceback(kept, enc, terminated)
  const endState = terminated ? 0 : bestOf(metrics)
  return {
    bits,
    steps: kept,
    metric: metrics[endState],
    endState,
    path: pathOf(kept, endState),
    acs: enc.acs * steps,
    comparisons: enc.states * steps,
    soft,
    depth,
  }
}

const bestOf = (metrics) => metrics.reduce((best, m, s) => (m < metrics[best] ? s : best), 0)

/** The metric of one branch: Hamming distance on hard bits, squared distance on soft values. */
export function branchMetric(out, received, soft) {
  if (!soft) return out.reduce((acc, b, i) => acc + (b === received[i] ? 0 : 1), 0)
  // The transmitted bit 0 is +1 and 1 is −1, so the metric is the squared
  // distance from the received value to the level the branch would have sent.
  return out.reduce((acc, b, i) => {
    const level = b ? -1 : 1
    const d = received[i] - level
    return acc + d * d
  }, 0)
}

/** The decoded bits, by walking the survivors backwards from the end. */
function traceback(kept, enc, terminated) {
  if (!kept.length) return []
  const last = kept[kept.length - 1]
  let state = terminated ? 0 : last.best
  const bits = []
  for (let i = kept.length - 1; i >= 0; i--) {
    const cell = kept[i].states[state]
    if (cell.from === null) throw new CodesError('conv-traceback', `no survivor reaches state ${state} at step ${i}`)
    bits.unshift(cell.bit)
    state = cell.from
  }
  return terminated ? bits.slice(0, bits.length - enc.memory) : bits
}

/**
 * The same walk, but each decision is made `depth` steps after the bit it
 * decides, from the best state at that later step. That is the decoder a real
 * receiver runs, and D5 measures what a short depth costs.
 */
function tracebackWithDepth(kept, enc, depth, terminated) {
  const bits = []
  for (let i = 0; i < kept.length; i++) {
    const end = Math.min(kept.length - 1, i + depth)
    let state = end === kept.length - 1 && terminated ? 0 : kept[end].best
    for (let j = end; j > i; j--) {
      const cell = kept[j].states[state]
      if (cell.from === null) throw new CodesError('conv-traceback', `no survivor reaches state ${state} at step ${j}`)
      state = cell.from
    }
    bits.push(kept[i].states[state].bit)
  }
  return terminated ? bits.slice(0, bits.length - enc.memory) : bits
}

/** The states the survivor passes through, ending at `endState`. */
function pathOf(kept, endState) {
  const path = new Array(kept.length + 1).fill(0)
  let state = endState
  path[kept.length] = state
  for (let i = kept.length - 1; i >= 0; i--) {
    state = kept[i].states[state].from ?? 0
    path[i] = state
  }
  return path
}

/**
 * The free distance: the lowest output weight of any path that leaves state 0
 * and returns to it.
 *
 * Found by a shortest-path search over the states, with the weight of a branch
 * as its cost, rather than quoted from a table. The search is exact, because
 * the state graph is finite and every cost is a non-negative whole number.
 */
export function freeDistance(enc) {
  const best = new Array(enc.states).fill(Infinity)
  // The first step must leave state 0 on a 1, because the all-zero input is the
  // all-zero path and is the path every other one is measured against.
  const queue = []
  for (const b of enc.table) {
    if (b.state !== 0 || b.bit !== 1) continue
    const w = weightOf(b.out)
    if (w < best[b.next]) {
      best[b.next] = w
      queue.push(b.next)
    }
  }
  let done = 0
  let answer = Infinity
  // Dijkstra without a heap: the state count is at most 512 and every relax is
  // a comparison, so a simple queue settles it in milliseconds.
  while (done < queue.length) {
    const s = queue[done++]
    for (const b of enc.table) {
      if (b.state !== s) continue
      const total = best[s] + weightOf(b.out)
      if (b.next === 0) {
        answer = Math.min(answer, total)
        continue
      }
      if (total < best[b.next]) {
        best[b.next] = total
        queue.push(b.next)
      }
    }
  }
  return answer
}

const weightOf = (out) => out.reduce((a, b) => a + b, 0)

/**
 * The weight spectrum of the error events, to output weight `maxWeight`.
 *
 * `a[d]` counts the paths that leave state 0 and return to it with output
 * weight `d`. `b[d]` adds up the input weight of those paths, which is the
 * coefficient the union bound on the bit error rate uses. For the reference
 * code `b[5 + i] = (i + 1)2^i`, which the test checks rather than assumes.
 *
 * The count is a forward recursion over the states, one output weight at a
 * time, so it is exact for every weight below the cap.
 */
export function weightSpectrum(enc, maxWeight) {
  // paths[state][w] = { count, inputWeight } for paths from state 0 that have
  // not yet returned to it.
  const empty = () => Array.from({ length: enc.states }, () => new Array(maxWeight + 1).fill(null).map(() => ({ count: 0, input: 0 })))
  let live = empty()
  const a = new Array(maxWeight + 1).fill(0)
  const b = new Array(maxWeight + 1).fill(0)
  for (const br of enc.table) {
    if (br.state !== 0 || br.bit !== 1) continue
    const w = weightOf(br.out)
    if (w > maxWeight) continue
    if (br.next === 0) {
      a[w] += 1
      b[w] += 1
      continue
    }
    live[br.next][w].count += 1
    live[br.next][w].input += 1
  }
  // A path of output weight at most maxWeight has at most maxWeight steps that
  // add weight, and the zero-weight branch out of a nonzero state does not
  // exist in a code with no catastrophic loop, so this many rounds settles it.
  for (let round = 0; round < maxWeight * enc.states; round++) {
    const next = empty()
    let any = false
    for (let s = 1; s < enc.states; s++)
      for (let w = 0; w <= maxWeight; w++) {
        const cell = live[s][w]
        if (!cell.count) continue
        any = true
        for (const br of enc.table) {
          if (br.state !== s) continue
          const nw = w + weightOf(br.out)
          if (nw > maxWeight) continue
          if (br.next === 0) {
            a[nw] += cell.count
            b[nw] += cell.input + br.bit * cell.count
            continue
          }
          next[br.next][nw].count += cell.count
          next[br.next][nw].input += cell.input + br.bit * cell.count
        }
      }
    live = next
    if (!any) break
  }
  return { a, b }
}

/** The asymptotic coding gain of soft-decision decoding: `10 log₁₀(R d_free)`. */
export const softAsymptoticGain = (rate, dFree) => 10 * Math.log10(rate * dFree)

/** The traceback depth the rule of thumb gives: five constraint lengths. */
export const tracebackRule = (enc) => 5 * enc.K

/** The codes this lab names (INFORMATION_LAB_PLAN.md §3). */
export const CONV_CODES = {
  K3: { K: 3, gens: [5, 7] },
  K5: { K: 5, gens: [23, 35] },
  K7: { K: 7, gens: [133, 171] },
  K9: { K: 9, gens: [561, 753] },
}
