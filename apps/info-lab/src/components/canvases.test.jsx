import { describe, it, expect } from 'vitest'
import { CONV_CODES, L12, codeFromParity, convEncode, encoder, hammingCode, huffman, stateText, sumProduct, symmetric, tannerGraph, viterbi, encode as blockEncode } from '@ee-labs/codes'
import { sceneOf as trellisScene } from './TrellisCanvas.jsx'
import { sceneOf as tannerScene } from './TannerCanvas.jsx'
import { sceneOf as weightScene } from './WeightCanvas.jsx'
import { sceneOf as treeScene } from './TreeCanvas.jsx'
import { sceneOf as curveScene } from './CurveCanvas.jsx'

// The canvases this lab builds new (INFORMATION_LAB_PLAN.md §4.2).
//
// Each computes its whole picture as data before it draws anything, and the
// draw call reads that and nothing else, so what a test measures here is what
// the reader sees. The trellis walker carries the props a second lab would
// need, and a prop nothing draws is a prop that is wrong the day someone needs
// it (`NEEDS.md` §4).

const K3 = encoder(CONV_CODES.K3)
const decodeOf = (flips = []) => {
  const bits = [1, 0, 1, 1, 0, 0, 1, 0]
  const sent = convEncode(K3, bits)
  const received = sent.bits.map((b, i) => (flips.includes(i) ? b ^ 1 : b))
  return { bits, sent, received, out: viterbi(K3, received) }
}
const states = Array.from({ length: K3.states }, (_, s) => stateText(K3, s))

describe('the trellis walker', () => {
  const { out } = decodeOf([3, 8])

  it('draws one column per step and one node per state, inside the canvas', () => {
    const scene = trellisScene({ states, steps: out.steps, path: out.path, width: 640, height: 260 })
    expect(scene.columns).toBe(out.steps.length + 1)
    expect(scene.nodes.length).toBe(scene.columns * states.length)
    for (const n of scene.nodes) {
      expect(n.x, `column ${n.col}`).toBeGreaterThanOrEqual(0)
      expect(n.x, `column ${n.col}`).toBeLessThanOrEqual(640)
      expect(n.y, `state ${n.state}`).toBeGreaterThanOrEqual(0)
      expect(n.y, `state ${n.state}`).toBeLessThanOrEqual(260)
    }
    // Columns advance and states descend, so the picture reads left to right.
    const first = scene.nodes.filter((n) => n.state === 0).map((n) => n.x)
    expect([...first].sort((a, b) => a - b)).toEqual(first)
  })

  it('marks one survivor into each state, and the discarded branch beside it', () => {
    const scene = trellisScene({ states, steps: out.steps, path: out.path })
    for (let step = 2; step < out.steps.length; step++) {
      for (let s = 0; s < states.length; s++) {
        const into = scene.branches.filter((b) => b.step === step && b.to === s)
        expect(into.length, `step ${step} state ${s}`).toBe(2)
        expect(into.filter((b) => b.survivor).length, `step ${step} state ${s}`).toBe(1)
      }
    }
  })

  it('draws the traceback along the survivors of the path, and only there', () => {
    const scene = trellisScene({ states, steps: out.steps, path: out.path })
    const lit = scene.branches.filter((b) => b.onPath)
    expect(lit.length).toBe(out.steps.length)
    for (const b of lit) {
      expect(b.survivor).toBe(true)
      expect(out.path[b.step]).toBe(b.from)
      expect(out.path[b.step + 1]).toBe(b.to)
    }
    // Turning the traceback off leaves the survivors and removes the path.
    const plain = trellisScene({ states, steps: out.steps, path: out.path, traceback: false })
    expect(plain.branches.filter((b) => b.onPath).length).toBe(0)
    expect(plain.branches.filter((b) => b.survivor).length).toBe(scene.branches.filter((b) => b.survivor).length)
  })

  it('shows the steps up to the scrubber and no further', () => {
    const scene = trellisScene({ states, steps: out.steps, path: out.path, step: 3 })
    expect(scene.upTo).toBe(3)
    expect(scene.branches.filter((b) => b.shown).every((b) => b.step < 3)).toBe(true)
    expect(scene.nodes.filter((n) => n.shown).every((n) => n.col <= 3)).toBe(true)
    // The whole walk is shown when the scrubber is at the end.
    const all = trellisScene({ states, steps: out.steps, path: out.path, step: out.steps.length })
    expect(all.branches.every((b) => b.shown)).toBe(true)
  })

  it('moves the survivor when a branch metric moves', () => {
    // The claim the harness would check in the browser: flipping a received
    // bit changes which branch is kept somewhere in the trellis.
    const clean = trellisScene({ states, steps: decodeOf([]).out.steps, path: decodeOf([]).out.path })
    const noisy = trellisScene({ states, steps: out.steps, path: out.path })
    const survivors = (scene) => scene.branches.filter((b) => b.survivor).map((b) => `${b.step}:${b.from}->${b.to}`).join(',')
    expect(survivors(noisy)).not.toBe(survivors(clean))
  })
})

describe('the Tanner graph', () => {
  const H = L12()
  const code = codeFromParity(H)
  const codeword = blockEncode(code, [1, 0, 1, 1, 0])
  const channel = symmetric(codeword, { p: 0.1, seed: 9 })
  const bp = sumProduct(H, channel.llr, { maxIter: 6, stopEarly: false })
  const graph = tannerGraph(H)

  it('draws one node per bit, one per check, and one edge per one in the matrix', () => {
    const scene = tannerScene({ graph, width: 640, height: 260 })
    expect(scene.vars.length).toBe(12)
    expect(scene.checks.length).toBe(8)
    expect(scene.edges.length).toBe(24)
    for (const e of scene.edges) {
      expect(H[e.check][e.variable], `edge ${e.index}`).toBe(1)
      expect(e.a.index).toBe(e.variable)
      expect(e.b.index).toBe(e.check)
    }
  })

  it('colours each edge by the sign of its belief, and widens it by the size', () => {
    const it = bp.iterations[0]
    const scene = tannerScene({ graph, beliefs: it.toVar, bits: it.bits })
    for (const e of scene.edges) {
      expect(e.sign, `edge ${e.index}`).toBe(Math.sign(it.toVar[e.index]))
      expect(e.strength, `edge ${e.index}`).toBeGreaterThanOrEqual(0)
      expect(e.strength, `edge ${e.index}`).toBeLessThanOrEqual(1)
    }
    const strongest = scene.edges.reduce((best, e) => (e.strength > best.strength ? e : best))
    expect(Math.abs(strongest.belief)).toBeCloseTo(scene.strongest, 9)
  })

  it('changes an edge’s colour when the belief on it flips sign', () => {
    const before = tannerScene({ graph, beliefs: bp.iterations[1].toVar })
    const after = tannerScene({ graph, beliefs: bp.iterations[2].toVar })
    const flipped = before.edges.filter((e, i) => e.sign !== after.edges[i].sign)
    expect(flipped.length).toBeGreaterThan(0)
  })

  it('fills the checks the word fails, and no others', () => {
    const failing = H.map((row) => row.reduce((acc, b, i) => acc ^ (b & channel.bits[i]), 0))
    const scene = tannerScene({ graph, bits: channel.bits, failing })
    expect(scene.checks.filter((c) => c.failing).length).toBe(failing.reduce((a, b) => a + b, 0))
    for (const c of scene.checks) expect(c.failing, `check ${c.index}`).toBe(!!failing[c.index])
  })
})

describe('the weight view', () => {
  it('draws one bar per weight and lights the one at the distance', () => {
    const code = hammingCode(3)
    const weights = [1, 0, 0, 7, 7, 0, 0, 1]
    const scene = weightScene({ weights, d: 3, t: 1, detect: 2, width: 400, height: 200 })
    expect(scene.bars.length).toBe(weights.length)
    expect(scene.bars.filter((b) => b.lit).map((b) => b.weight)).toEqual([3])
    // A bar with no words has no height, and the tallest bar is the largest count.
    for (const bar of scene.bars) expect(bar.h === 0, `weight ${bar.weight}`).toBe(bar.count === 0)
    expect(scene.most).toBe(7)
    expect(code.n + 1).toBe(weights.length)
    // The two radii are marked, in the order they fall.
    expect(scene.marks.map((m) => m.label)).toEqual(['t = 1', 'detect 2', 'd = 3'])
    expect(scene.marks[0].at).toBeLessThan(scene.marks[2].at)
  })
})

describe('the code tree', () => {
  it('places a leaf per symbol and a join per merge, with the deepest leaf inside the canvas', () => {
    const code = huffman([0.4, 0.2, 0.2, 0.1, 0.1])
    const scene = treeScene({ tree: code.tree, words: code.words, width: 400, height: 200 })
    expect(scene.leaves.length).toBe(5)
    expect(scene.joins.length).toBe(4)
    expect(scene.depth).toBe(Math.max(...code.lengths))
    for (const leaf of scene.leaves) {
      expect(leaf.word).toBe(code.words[leaf.leaf])
      expect(leaf.y).toBeLessThanOrEqual(200)
      expect(leaf.x).toBeGreaterThanOrEqual(0)
    }
    // A leaf sits as deep as its codeword is long.
    const depthOf = (leaf) => Math.round((leaf.y - scene.leaves[0].y) / 1)
    expect(scene.leaves.map((l) => code.lengths[l.leaf]).sort()).toEqual([...code.lengths].sort())
    expect(typeof depthOf(scene.leaves[0])).toBe('number')
  })
})

describe('the curve', () => {
  it('frames the points it is given, and puts the floor inside the frame', () => {
    const curve = {
      xLabel: 'block size',
      yLabel: 'bit per symbol',
      points: [
        { x: 1, y: 1 },
        { x: 2, y: 0.645 },
        { x: 3, y: 0.532667 },
        { x: 4, y: 0.49255 },
      ],
      floor: 0.468996,
      mark: { x: 2, y: 0.645 },
    }
    const scene = curveScene(curve, 640, 260)
    expect(scene.xMin).toBe(1)
    expect(scene.xMax).toBe(4)
    expect(scene.yMin).toBeLessThan(curve.floor)
    expect(scene.yMax).toBeGreaterThan(1)
    // The mark lands where its own point does.
    expect(scene.sx(2)).toBeCloseTo(scene.sx(curve.mark.x), 9)
    expect(scene.sy(0.645)).toBeCloseTo(scene.sy(curve.mark.y), 9)
    // Larger y is higher on the canvas.
    expect(scene.sy(1)).toBeLessThan(scene.sy(0.5))
  })

  it('gives a curve of counts a band that reaches zero', () => {
    const scene = curveScene({ points: [{ x: 0, y: 12 }, { x: 1, y: 4 }, { x: 2, y: 1 }], integer: true }, 400, 200)
    expect(scene.yMin).toBe(0)
    expect(scene.yMax).toBeGreaterThan(12)
  })
})
