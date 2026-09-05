import React from 'react'
import { COLORS, useCanvas } from '@ee-labs/ui'

// The cache map: sets down the page, ways across, each line showing its tag and
// its valid bit.
//
// The state drawn is the state after the reference the reader is on, replayed
// from the run's own per-access list rather than kept as a second copy. The
// line the current reference landed in is lit, and a miss shows what it
// evicted.

const ROW = 26
const LABEL = 58
const TOP = 22
const BOTTOM = 10
const GAP = 4

/** The cache's state after `step` references, replayed from what the run did. */
export function stateAfter(cache, step) {
  const geo = cache.geometry
  const sets = Array.from({ length: geo.sets }, () => [])
  let current = null
  for (let k = 0; k <= Math.min(step, cache.perAccess.length - 1); k++) {
    const a = cache.perAccess[k]
    const set = sets[a.set]
    const had = set.find((l) => l.tag === a.tag)
    if (had) had.used = k
    else {
      if (a.evicted) {
        const i = set.findIndex((l) => l.tag === a.evicted.tag)
        if (i >= 0) set.splice(i, 1)
      }
      set.push({ tag: a.tag, block: a.block, used: k })
    }
    current = a
  }
  return { sets, current }
}

/** Where every line sits, before anything is drawn. */
export function geometryOf({ cache, step = 0, width = 900 }) {
  const geo = cache.geometry
  const { sets, current } = stateAfter(cache, step)
  const wayW = Math.max(48, (width - LABEL - 12 - (geo.ways - 1) * GAP) / geo.ways)
  const lines = []
  for (let s = 0; s < geo.sets; s++) {
    for (let w = 0; w < geo.ways; w++) {
      const line = sets[s][w] || null
      lines.push({
        set: s,
        way: w,
        line,
        x: LABEL + w * (wayW + GAP),
        y: TOP + s * ROW,
        w: wayW,
        h: ROW - GAP,
        lit: !!(current && current.set === s && line && line.tag === current.tag),
        evicted: !!(current && current.evicted && current.set === s && !line),
      })
    }
  }
  return { width, height: TOP + geo.sets * ROW + BOTTOM, lines, sets: geo.sets, ways: geo.ways, current, geometry: geo }
}

export default function CacheCanvas({ cache, step = 0, height }) {
  const geo = geometryOf({ cache, step, width: 900 })
  const ref = useCanvas(
    (ctx, w) => {
      const g = geometryOf({ cache, step, width: w })
      ctx.fillStyle = COLORS.bg
      ctx.fillRect(0, 0, w, g.height)
      ctx.textBaseline = 'middle'
      ctx.font = '10px ui-monospace, monospace'
      ctx.textAlign = 'center'
      ctx.fillStyle = COLORS.text
      for (let k = 0; k < g.ways; k++) {
        const one = g.lines.find((l) => l.way === k)
        ctx.fillText(`way ${k}`, one.x + one.w / 2, 10)
      }
      for (const l of g.lines) {
        ctx.textAlign = 'right'
        if (l.way === 0) {
          ctx.fillStyle = COLORS.text
          ctx.fillText(`set ${l.set}`, LABEL - 10, l.y + l.h / 2)
        }
        ctx.fillStyle = l.lit ? 'rgba(56, 224, 176, 0.18)' : l.line ? 'rgba(125, 139, 156, 0.10)' : 'transparent'
        ctx.fillRect(l.x, l.y, l.w, l.h)
        ctx.strokeStyle = l.lit ? COLORS.trace : COLORS.axis
        ctx.lineWidth = l.lit ? 1.6 : 1
        ctx.strokeRect(l.x + 0.5, l.y + 0.5, l.w - 1, l.h - 1)
        ctx.textAlign = 'center'
        ctx.fillStyle = l.line ? (l.lit ? COLORS.trace : COLORS.textBright) : COLORS.text
        ctx.font = '10px ui-monospace, monospace'
        ctx.fillText(l.line ? `tag ${l.line.tag} · block ${l.line.block}` : 'empty', l.x + l.w / 2, l.y + l.h / 2)
      }
      const c = g.current
      ctx.textAlign = 'left'
      ctx.fillStyle = c ? (c.hit ? COLORS.trace : COLORS.spectrum) : COLORS.text
      ctx.font = '11px ui-monospace, monospace'
      const line = c ? `address ${c.addr}: set ${c.set}, tag ${c.tag}, ${c.hit ? 'hit' : `miss (${c.cause})`}${c.evicted ? `, evicted tag ${c.evicted.tag}` : ''}` : 'no reference yet'
      ctx.fillText(line, 8, g.height - 6)
    },
    [cache, step, height],
  )

  return <canvas ref={ref} className="cache-canvas" style={{ height: height || geo.height }} role="img" aria-label="The cache, set by set and way by way" />
}
