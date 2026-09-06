import React from 'react'
import { COLORS, useCanvas } from '@ee-labs/ui'

// The Huffman tree, with the probability at each node and the codeword at each
// leaf. Where an experiment codes with the arithmetic coder as well, the
// interval it narrowed is drawn as a bar under the tree.
//
// The bar is drawn on a logarithmic scale of its own width, because a hundred
// symbols narrow the interval to 2^−47 and a linear bar would be one pixel of
// nothing.

/** The picture as data: a node per join, a leaf per symbol, and the edges between. */
export function sceneOf({ tree, words = [], width = 640, height = 240 }) {
  const pad = { l: 16, r: 16, t: 18, b: 26 }
  const leaves = []
  const collect = (node, depth) => {
    if (node.leaf !== undefined) {
      leaves.push(node)
      return depth
    }
    return Math.max(collect(node.left, depth + 1), collect(node.right, depth + 1))
  }
  const depth = tree ? collect(tree, 0) : 0
  const dx = leaves.length > 1 ? (width - pad.l - pad.r) / (leaves.length - 1) : 0
  const dy = depth > 0 ? (height - pad.t - pad.b) / depth : 0
  const place = new Map()
  let next = 0
  const walk = (node, level) => {
    if (node.leaf !== undefined) {
      const point = { x: pad.l + next * dx, y: pad.t + level * dy, node, leaf: node.leaf, p: node.p, word: words[node.leaf] || '' }
      next++
      place.set(node, point)
      return point
    }
    const a = walk(node.left, level + 1)
    const b = walk(node.right, level + 1)
    const point = { x: (a.x + b.x) / 2, y: pad.t + level * dy, node, leaf: null, p: node.p, left: a, right: b }
    place.set(node, point)
    return point
  }
  if (tree) walk(tree, 0)
  const nodes = [...place.values()]
  return { nodes, leaves: nodes.filter((n) => n.leaf !== null), joins: nodes.filter((n) => n.leaf === null), depth, width, height }
}

export default function TreeCanvas({ code, arith = null, height = 240 }) {
  const ref = useCanvas(
    (ctx, w, h) => {
      ctx.fillStyle = COLORS.bg
      ctx.fillRect(0, 0, w, h)
      if (!code || !code.tree) return
      const barBand = arith ? 42 : 0
      const scene = sceneOf({ tree: code.tree, words: code.words, width: w, height: h - barBand })

      ctx.font = '10px ui-monospace, SFMono-Regular, Menlo, monospace'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'

      for (const node of scene.joins) {
        for (const [child, bit] of [
          [node.left, '0'],
          [node.right, '1'],
        ]) {
          ctx.beginPath()
          ctx.moveTo(node.x, node.y)
          ctx.lineTo(child.x, child.y)
          ctx.strokeStyle = COLORS.axis
          ctx.stroke()
          ctx.fillStyle = COLORS.text
          ctx.fillText(bit, (node.x + child.x) / 2 + (bit === '0' ? -7 : 7), (node.y + child.y) / 2)
        }
      }

      for (const node of scene.nodes) {
        const leaf = node.leaf !== null
        ctx.beginPath()
        ctx.arc(node.x, node.y, leaf ? 11 : 6, 0, 2 * Math.PI)
        ctx.fillStyle = leaf ? COLORS.bg : COLORS.grid
        ctx.fill()
        ctx.strokeStyle = leaf ? COLORS.trace : COLORS.axis
        ctx.stroke()
        if (leaf) {
          ctx.fillStyle = COLORS.textBright
          ctx.fillText(String(node.leaf + 1), node.x, node.y)
          ctx.fillStyle = COLORS.trace
          ctx.fillText(node.word, node.x, node.y + 20)
          ctx.fillStyle = COLORS.text
          ctx.fillText(fmtP(node.p), node.x, node.y + 32)
        } else {
          ctx.fillStyle = COLORS.text
          ctx.fillText(fmtP(node.p), node.x, node.y - 11)
        }
      }

      if (arith) {
        // The interval, as a bar whose width is its own logarithm. The label
        // says what the bar stands for, because a bar of one part in 2^47
        // cannot say it for itself.
        const y = h - barBand + 14
        const bits = Math.max(1, Math.log2(Number(arith.denominator) / Math.max(1, Number(arith.high - arith.low))))
        const frac = Math.min(1, Math.log10(1 + bits) / Math.log10(1 + 64))
        ctx.fillStyle = COLORS.grid
        ctx.fillRect(16, y, w - 32, 10)
        ctx.fillStyle = COLORS.spectrum
        ctx.fillRect(16, y, Math.max(2, (w - 32) * (1 - frac)), 10)
        ctx.fillStyle = COLORS.text
        ctx.textAlign = 'left'
        ctx.fillText(`interval narrowed to 2 to the −${Math.round(bits)}, coded in ${arith.length} bit`, 16, y + 24)
      }
    },
    [code ? code.words.join(',') : '', code ? code.lengths.join(',') : '', arith ? `${arith.length}:${String(arith.denominator).length}` : '', height],
  )

  return <canvas ref={ref} className="tree-canvas" style={{ height }} role="img" aria-label="Huffman tree, with a codeword at each leaf" />
}

const fmtP = (p) => (p === undefined ? '' : p >= 0.01 ? p.toFixed(2) : p.toExponential(1))
