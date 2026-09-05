import React from 'react'

/**
 * The lower panes groups G and H draw: the plane wave in space with its
 * polarisation ellipse, and the three waves at an interface.
 *
 * Written by the wave lane. Until it lands these render nothing, which no
 * reader sees: a pane is only reachable from an experiment that lists its view,
 * and the groups that list them are empty.
 */

export function WavePane() {
  return <p className="hint">The wave view is not built yet.</p>
}

export function InterfacePane() {
  return <p className="hint">The interface view is not built yet.</p>
}
