import React from 'react'
import { PLAYBACK_SPEEDS } from './usePlayback.js'

export default function PlaybackControls({ playback, label = 'Time cursor' }) {
  const { position, setPosition, playing, speed, setSpeed, toggle, reset } = playback
  return <div className="playback-controls" role="group" aria-label="Playback">
    <button type="button" className="ghost transport-icon" aria-label={playing ? 'Pause' : 'Play'}
      title={playing ? 'Pause' : 'Play'} aria-pressed={playing} onClick={toggle}>
      <span aria-hidden="true">{playing ? '\u23f8' : '\u25b6'}</span>
    </button>
    <button type="button" className="ghost transport-icon" aria-label="Rewind" title="Rewind" onClick={reset}>
      <span aria-hidden="true">{'\u21ba'}</span>
    </button>
    <input type="range" aria-label={label} min="0" max="1000" value={Math.round(position * 1000)}
      onChange={(event) => setPosition(Number(event.target.value) / 1000)} />
    <select aria-label="Playback speed" title="Playback speed" value={speed}
      onChange={(event) => setSpeed(Number(event.target.value))}>
      {PLAYBACK_SPEEDS.map((s) => <option key={s} value={s}>{s}x</option>)}
    </select>
  </div>
}
