// Two geometry rules the Bode pane needs, kept out of the draw call so they
// can be measured without a canvas.
//
// Both come from reading screenshots rather than from the tests: the drawing
// code was correct about the data and wrong about where it put the ink.

/**
 * Pixels of clearance the phase trace keeps from the plot frame, at k = 1.
 *
 * The phase axis snaps its limits to 90° multiples, so a phase that IS a
 * multiple of 90 landed on the frame's own rule with 3px between them. Three
 * loops in the course do exactly that: a lone integrator's flat −90° (lesson
 * 3, a dashed line lying along the bottom border for the whole decade span),
 * the motor's −180° asymptote (lesson 10), and the lead network's −270°
 * (lesson 13). At 3px the trace and the border are one line, and lesson 10
 * reads its "phase never reaches −180°" under a picture of the phase sitting
 * on −180. Eleven pixels is about a tick label's height, which is the
 * distance at which two lines read as two lines.
 */
export const PHASE_CLEAR = 11

/**
 * The phase overlay's scale: its degree limits, and the mapping into the
 * plot box that keeps PHASE_CLEAR between the extreme phase and the frame.
 *
 * The limits still snap outward to 90° so the right-hand tick labels stay on
 * the round numbers a reader looks for. The clearance is bought in pixels
 * instead, which costs the same few pixels whatever the span is, and never
 * adds an empty 90° band to a plot that did not need one.
 */
export function phaseFrame(minDeg, maxDeg, areaY, areaH, k = 1) {
  const plo = Math.min(-90, Math.floor(minDeg / 90) * 90)
  const phi = Math.max(90, Math.ceil(maxDeg / 90) * 90)
  // A short canvas (a phone's Bode pane is about 120px of plot) cannot
  // afford 11px at each end, so the clearance is capped at an eighth of the
  // box and the trace stays inside it either way.
  const padPx = Math.min(PHASE_CLEAR * k, areaH / 8)
  const py = (d) => areaY + padPx + ((phi - d) / (phi - plo)) * (areaH - 2 * padPx)
  return { plo, phi, py, padPx }
}

/**
 * Where a marker's label goes: the candidate box that no trace runs through.
 *
 * The rule used to be "whichever side has the bigger gap", asked at one x —
 * the marker's own frequency — while the label is drawn beside that line and
 * runs a good fraction of a decade across the plot. On the three-lag loop
 * that is the difference between a correct answer and a wrong one: at the
 * phase crossover the magnitude sits high and the phase at −180°, so the
 * room looks to be below, and by the right-hand end of the words
 * "phase = −180°" the phase trace has descended through them.
 *
 * Comparing gaps is not enough either. Two labels stack, so the second one
 * sits a row in from the edge, and a gap that was big enough at the edge is
 * not the gap the box it actually occupies gets. On a phone's short Bode
 * pane that row is exactly where the phase trace runs.
 *
 * So a caller offers the real boxes — above and below, and left of the
 * marker as well as right where there is room for it — each with the trace
 * samples inside its own x range. The box no trace enters wins; among boxes
 * that all fail, the one whose nearest trace is furthest away. `hits` and
 * `clear` come back so a caller can say which it got.
 */
export function placeLabel(candidates) {
  let best = null
  for (const c of candidates) {
    let hits = 0
    let clear = Infinity
    for (const y of c.ys) {
      if (!Number.isFinite(y)) continue
      if (y >= c.top && y <= c.bottom) hits++
      else clear = Math.min(clear, y < c.top ? c.top - y : y - c.bottom)
    }
    const scored = { ...c, hits, clear }
    if (!best || scored.hits < best.hits || (scored.hits === best.hits && scored.clear > best.clear)) {
      best = scored
    }
  }
  return best
}
