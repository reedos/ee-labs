import React from 'react'
import { NumField, homeUrl, siblingUrl } from '@ee-labs/ui'
import FlowStrip from './FlowStrip.jsx'
import FlowDiagram from './FlowDiagram.jsx'
import { WINDOWS } from '@ee-labs/dsp'

const SUITE_SIBLINGS = [
  { id: 'circuit-lab', label: 'Circuit Lab' },
  { id: 'control-lab', label: 'Control Lab' },
]

/**
 * Phone's way out of this lab: the suite home, and both sibling labs.
 *
 * The sidebar's own LabNav row carries this on a laptop, but at phone widths
 * styles.css hides that whole row to buy the featured knob back its vertical
 * budget — and hiding it left no route to the suite at all, a student sealed
 * inside Signal Lab with no way out (Reed's review; a regression from the fix
 * that bought the space back). This is the same three links, folded behind
 * one compact icon in the TOP bar instead of the sidebar, so restoring them
 * costs the sidebar nothing. Null wherever LabNav itself would be null: a
 * bare dev port with no siblings deployed beside this page.
 */
function SuiteNavCompact() {
  const [open, setOpen] = React.useState(false)
  React.useEffect(() => {
    if (!open) return
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])
  const home = homeUrl()
  if (!home) return null
  return (
    <div className="suite-nav">
      <button
        type="button"
        className="ghost suite-nav-open"
        aria-expanded={open}
        aria-haspopup="true"
        aria-label="Suite navigation: home and the other labs"
        onClick={() => setOpen((o) => !o)}
      >
        ⌂ Labs
      </button>
      {open ? (
        <>
          {/* A SIBLING of the panel, not its parent: the panel is
              position:absolute and needs `.suite-nav` (position:relative,
              a small box right around the trigger) as its containing block.
              Wrapping the panel inside a position:fixed backdrop made the
              backdrop itself the containing block instead — full-viewport,
              so "top: 100%" measured from the SCREEN's own height and the
              panel rendered entirely below the 390x844 fold. */}
          <div className="suite-nav-backdrop" onClick={() => setOpen(false)} />
          <nav
            className="suite-nav-panel"
            aria-label="REED's Engineering Labs suite"
          >
            <a href={home}>Suite home</a>
            {SUITE_SIBLINGS.map((lab) => (
              <a key={lab.id} href={siblingUrl(lab.id, '')}>
                {lab.label}
              </a>
            ))}
          </nav>
        </>
      ) : null}
    </div>
  )
}

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
        <SuiteNavCompact />
      </div>
    </div>
  )
}
