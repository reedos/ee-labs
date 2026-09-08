import React from 'react'
import { NumField } from '@ee-labs/ui'
import FlowStrip from './FlowStrip.jsx'
import FlowDiagram from './FlowDiagram.jsx'
import { WINDOWS } from '@ee-labs/dsp'

/**
 * CHAIN-GLOBAL settings only: sample rate, frame length, analysis window —
 * things that change what every pane means at once. Controls that govern one
 * pane (the time span, the dB/lin scale, the overlay, the zoom) live in that
 * pane's own header now, next to the thing they change — Reed's point, and
 * the proximity principle: a student tuning the spectrum should not be
 * looking 1400px left of it.
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
          // Engineering mode moves the prefix onto the unit, so the box reads
          // "8 kHz" rather than "8000 Hz" — the way a rate is spoken, and the
          // way every other frequency field in the suite already reads. State
          // stays in hertz; only the display changes.
          eng
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
      </div>
    </div>
  )
}
