import React from 'react'

/**
 * The loop, drawn as blocks, with the sampler and the hold shown when there
 * are any and the nonlinearity shown when there is one.
 *
 * Adapted from `apps/control-lab/src/components/LoopDiagram.jsx`. Two copies
 * exist now and `NEEDS.md` records this as a promotion candidate. What is new
 * here is that the diagram has more than one shape: Group B puts a sampler and
 * a hold in the path, and Groups C and D put a saturation between the
 * controller and the plant. A reader who cannot see the extra block in the
 * picture has no way to know it is in the loop.
 *
 * Drawn as SVG rather than canvas, so the block labels are real text a screen
 * reader and a search can both find.
 */
export default function LoopDiagram({ ctrlLabel, plantLabel, sampled = null, nonlinear = null, feedback = 'unity' }) {
  const blocks = []
  let x = 96
  const push = (label, sub, tone) => {
    blocks.push({ x, label, sub, tone })
    x += 118
  }
  if (sampled) push('Sampler', `every ${sampled.Ts}`, 'sample')
  push(ctrlLabel, sampled ? 'in z' : 'in s', 'ctrl')
  if (sampled) push('Hold', 'zero order', 'sample')
  if (nonlinear) push(nonlinear.label, nonlinear.sub, 'nl')
  push(plantLabel, 'in s', 'plant')
  const width = x + 96
  const mid = 46

  return (
    <svg className="loop-diagram" viewBox={`0 0 ${width} 118`} role="img" aria-label="The loop, block by block">
      <defs>
        <marker id="cl2-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto">
          <path d="M0 0 L8 4 L0 8 z" fill="currentColor" />
        </marker>
      </defs>
      <g className="loop-wire">
        <line x1="8" y1={mid} x2="52" y2={mid} markerEnd="url(#cl2-arrow)" />
        <circle cx="66" cy={mid} r="13" className="loop-sum" />
        <text x="66" y={mid + 4} className="loop-sum-text">−</text>
        <line x1="79" y1={mid} x2={blocks[0].x} y2={mid} markerEnd="url(#cl2-arrow)" />
        {blocks.map((b, i) => (
          <React.Fragment key={i}>
            <rect x={b.x} y={mid - 24} width="100" height="48" rx="5" className={`loop-block is-${b.tone}`} />
            <text x={b.x + 50} y={mid - 2} className="loop-label">{b.label}</text>
            <text x={b.x + 50} y={mid + 14} className="loop-sub">{b.sub}</text>
            <line
              x1={b.x + 100}
              y1={mid}
              x2={i === blocks.length - 1 ? b.x + 152 : b.x + 118}
              y2={mid}
              markerEnd="url(#cl2-arrow)"
            />
          </React.Fragment>
        ))}
        <line x1={width - 40} y1={mid} x2={width - 40} y2="100" />
        <line x1={width - 40} y1="100" x2="66" y2="100" />
        <line x1="66" y1="100" x2="66" y2={mid + 13} markerEnd="url(#cl2-arrow)" />
        <text x={(width - 40 + 66) / 2} y="114" className="loop-sub">
          {feedback === 'state' ? 'every state, fed back' : 'the output, measured'}
        </text>
      </g>
    </svg>
  )
}
