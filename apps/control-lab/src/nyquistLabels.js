// Where the Nyquist pane's two margin readouts are anchored.
//
// Both were centred on the −1 marker, which put half of each one in the
// wedge between −1 and the origin. That wedge is exactly where the pane's
// own annotations live, and "PM 39.1°" was drawn with the dashed
// phase-margin ray through its degree sign on the three-lag loop at Kp = 4
// (lessons 9 and 10, the two lessons that open on this plot).
//
// The rule, stated so it can be checked rather than eyeballed: the phase
// ray runs from the ORIGIN out to radius 1, so every point on it has
// x ≥ −1 in data units, which is x ≥ the −1 marker's own pixel column.
// A label whose RIGHT edge is left of that column therefore cannot cross
// it, at any gain, on any plant. The gain-margin bracket is drawn along
// the real axis, and the labels sit 8px and more below it, so its own
// extent never comes into it.

/** The clearance between a label's right edge and the −1 marker, at k = 1. */
export const LABEL_GAP = 8

/**
 * The x to pass fillText for a right-aligned margin label.
 *
 * `markerX` is the −1 marker's pixel column, `textW` the measured width of
 * the label, `areaLeft` the plot box's left edge, `k` the canvas's chrome
 * scale. The label ends LABEL_GAP·k left of the marker, unless that would
 * push its left end outside the plot, in which case it is slid back inside
 * — a label that has left the picture is worse than one a curve crosses.
 */
export function nyquistLabelX(markerX, textW, areaLeft, k = 1) {
  const wanted = markerX - LABEL_GAP * k
  const leastRight = areaLeft + textW + 2 * k
  return Math.max(wanted, leastRight)
}
