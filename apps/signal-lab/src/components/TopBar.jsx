import React from 'react'
import { NumField } from '@ee-labs/ui'
import FlowStrip from './FlowStrip.jsx'
import FlowDiagram from './FlowDiagram.jsx'
import { WINDOWS } from '@ee-labs/dsp'

/**
 * Global settings live above the plots they govern, not in the per-signal sidebar.
 * Sharing one row with the flow strip keeps the chrome to 44px, which is what lets
 * both plots stay on screen at 16:9.
 */
export default function TopBar({ state, patch, stages, onReveal }) {
  const [diagram, setDiagram] = React.useState(false)
  return (
    <div className="topbar">
      <FlowStrip
        stages={stages}
        sourceCount={state.sources.filter((s) => s.enabled).length}
        sampleRate={state.sampleRate}
        onReveal={onReveal}
      />
      <button
        type="button"
        className="ghost fd-open"
        aria-expanded={diagram}
        title="The full signal path as a block diagram — every source, the summing junction, the chain, the output"
        onClick={() => setDiagram(true)}
      >
        ⧉ diagram
      </button>
      {diagram ? (
        <FlowDiagram
          state={state}
          stages={stages}
          onReveal={(id) => {
            setDiagram(false)
            onReveal(id)
          }}
          onClose={() => setDiagram(false)}
        />
      ) : null}

      <div className="topbar-controls">
        <NumField
          compact
          label="Rate"
          unit="Hz"
          spoken="hertz"
          value={state.sampleRate}
          onChange={(v) => patch('sampleRate', v)}
          min={1000}
          max={96000}
          scale="log"
          step={1}
          suffixes={{ k: 1e3, khz: 1e3, hz: 1 }}
        />
        <NumField
          compact
          label="FFT"
          value={state.fftSize}
          onChange={(v) => patch('fftSize', v)}
          min={512}
          max={16384}
          scale="pow2"
          decimals={0}
          hint={`${(state.sampleRate / state.fftSize).toFixed(2)} Hz/bin`}
        />
        <label className="topbar-field">
          <span>Window</span>
          <select value={state.window} onChange={(e) => patch('window', e.target.value)}>
            {WINDOWS.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </label>
        {/* Counted in cycles of the fundamental, not milliseconds, so it stays
            correct when you move a source's frequency. Falls back to a time
            span when nothing periodic is playing. */}
        {state.divisionRate ? (
          <NumField
            compact
            label="Span"
            unit="cycles"
            value={state.spanCycles}
            onChange={(v) => patch('spanCycles', v)}
            min={0.5}
            max={200}
            scale="log"
            step={0.5}
          />
        ) : (
          <NumField
            compact
            label="Span"
            unit="ms"
            value={state.timeSpanMs}
            onChange={(v) => patch('timeSpanMs', v)}
            min={0.1}
            max={1000}
            scale="log"
            step={0.1}
          />
        )}
        <div className="segmented sm">
          <button
            type="button"
            className={state.scale === 'db' ? 'on' : ''}
            onClick={() => patch('scale', 'db')}
          >
            dB
          </button>
          <button
            type="button"
            className={state.scale === 'linear' ? 'on' : ''}
            onClick={() => patch('scale', 'linear')}
          >
            lin
          </button>
        </div>
      </div>
    </div>
  )
}
