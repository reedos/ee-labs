import React from 'react'

/**
 * The lower panes groups I and J draw: the bounce diagram with the load's
 * trace, voltage and current along the line at one instant, the Smith chart,
 * and one quantity swept against frequency or against length.
 *
 * Written by the line lane. The chart itself lives in `SmithCanvas.jsx`, and
 * its arithmetic is already in `packages/fields/src/line.js`.
 */

export function BouncePane() {
  return <p className="hint">The bounce view is not built yet.</p>
}

export function LinePane() {
  return <p className="hint">The line view is not built yet.</p>
}

export function SmithPane() {
  return <p className="hint">The Smith view is not built yet.</p>
}

export function SweepPane() {
  return <p className="hint">The sweep view is not built yet.</p>
}
