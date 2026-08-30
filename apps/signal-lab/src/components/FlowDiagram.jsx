import React, { useEffect } from 'react'
import { fmtHz } from '@ee-labs/ui'
import { BLOCK_TYPES } from '../dsp/blocks.js'

/**
 * The whole signal path as a block diagram, on demand.
 *
 * The topbar's flow strip is one row and collapses the sources into a count;
 * this is the picture it abbreviates: every source as its own box, converging
 * on the summing junction, then the chain in series, ending at the output the
 * plots show. It exists because "what is connected to what" should be a thing
 * you can SEE, not reconstruct from a sidebar list — especially the fact that
 * sources ADD while blocks CASCADE, which is the structural difference between
 * the two halves of the tool.
 *
 * Clicking any box scrolls its card into view, same as the strip.
 */
export default function FlowDiagram({ state, stages, onReveal, onClose }) {
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const rmsOf = (s) => {
    if (!s) return '0.000'
    let acc = 0
    for (let i = 0; i < s.buf.length; i++) acc += s.buf[i] * s.buf[i]
    return Math.sqrt(acc / (s.buf.length || 1)).toFixed(3)
  }

  const sources = state.sources
  const blocks = state.blocks
  const stageOf = (id) => stages.find((s) => s.id === id)

  // ---- geometry ---------------------------------------------------------
  const BW = 118 // box width
  const BH = 40 // box height
  const GX = 46 // horizontal gap (arrow length)
  const ROW = 52 // vertical pitch of source rows
  const srcH = Math.max(sources.length, 1) * ROW
  const midY = srcH / 2
  const chainX0 = BW + GX + 34 + GX // sources | gap | Σ circle | gap
  const width = chainX0 + (blocks.length + 1) * (BW + GX) + 8
  const height = Math.max(srcH + 16, BH + 60)

  const box = (x, y, label, sub, opts = {}) => (
    <g
      key={opts.key}
      className={`fd-box${opts.off ? ' is-off' : ''}${opts.out ? ' is-out' : ''}`}
      transform={`translate(${x},${y})`}
      onClick={opts.onClick}
      role={opts.onClick ? 'button' : undefined}
      tabIndex={opts.onClick ? 0 : undefined}
      onKeyDown={
        opts.onClick ? (e) => (e.key === 'Enter' || e.key === ' ') && opts.onClick() : undefined
      }
      aria-label={opts.onClick ? `Show ${label} in the sidebar` : undefined}
    >
      <rect width={BW} height={BH} rx={7} />
      <text className="fd-label" x={BW / 2} y={sub ? 16 : BH / 2 + 4} textAnchor="middle">
        {label}
      </text>
      {sub ? (
        <text className="fd-sub" x={BW / 2} y={30} textAnchor="middle">
          {sub}
        </text>
      ) : null}
    </g>
  )

  const arrow = (x1, y1, x2, y2, key) => (
    <path
      key={key}
      className="fd-wire"
      d={
        y1 === y2
          ? `M ${x1} ${y1} H ${x2}`
          : `M ${x1} ${y1} H ${x1 + (GX * 2) / 3} V ${y2} H ${x2}`
      }
      markerEnd="url(#fd-arrow)"
    />
  )

  const sumX = BW + GX
  const chainY = midY - BH / 2

  return (
    <div className="fd-backdrop" onClick={onClose}>
      <div
        className="fd-panel"
        role="dialog"
        aria-label="Signal path diagram"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="fd-head">
          <b>Signal path</b>
          <span>
            sources <em>add</em> into Σ; blocks run <em>in series</em>; the plots watch the end
          </span>
          <button type="button" className="ghost" onClick={onClose} aria-label="Close diagram">
            ✕
          </button>
        </div>
        <div className="fd-scroll">
          <svg width={width} height={height} className="fd-svg" aria-hidden="false">
            <defs>
              <marker id="fd-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto">
                <path d="M0,0 L8,4 L0,8 z" className="fd-arrowhead" />
              </marker>
            </defs>

            {/* Sources, each its own box, wired into the junction. */}
            {sources.map((s, i) => {
              const y = 8 + i * ROW
              return (
                <React.Fragment key={s.id}>
                  {box(0, y, `${s.type} ${s.type === 'noise' ? '' : fmtHz(s.freq) + 'Hz'}`, `amp ${Number(s.amp.toPrecision(3))}`, {
                    key: `s${s.id}`,
                    off: !s.enabled,
                    onClick: () => onReveal('sources'),
                  })}
                  {arrow(BW, y + BH / 2, sumX - 2, midY, `w${s.id}`)}
                </React.Fragment>
              )
            })}

            {/* The summing junction: where adding happens. */}
            <g className="fd-sum" transform={`translate(${sumX + 17},${midY})`}>
              <circle r={17} />
              <text textAnchor="middle" dy="5">
                Σ
              </text>
            </g>
            <text className="fd-sub" x={sumX + 17} y={midY + 32} textAnchor="middle">
              {fmtHz(state.sampleRate)}Hz
            </text>

            {/* The chain, in series. */}
            {arrow(sumX + 34, midY, chainX0 - 2, midY, 'wsum')}
            {blocks.map((b, i) => {
              const def = BLOCK_TYPES[b.type]
              const x = chainX0 + i * (BW + GX)
              const st = stageOf(b.id)
              return (
                <React.Fragment key={b.id}>
                  {box(
                    x,
                    chainY,
                    def ? def.label : b.type,
                    b.bypass ? 'bypassed' : `rms ${rmsOf(st)}`,
                    { key: `b${b.id}`, off: b.bypass, onClick: () => onReveal(`block-${b.id}`) },
                  )}
                  {arrow(x + BW, midY, x + BW + GX - 2, midY, `wb${b.id}`)}
                </React.Fragment>
              )
            })}

            {/* The end: what both plots are looking at. */}
            {box(chainX0 + blocks.length * (BW + GX), chainY, 'scope + FFT', 'the two plots', {
              key: 'out',
              out: true,
            })}
          </svg>
        </div>
      </div>
    </div>
  )
}
