# Needs and heads-ups for the other territories

## NEW TASK from Reed (via the packages/signal-lab agent): full-fidelity hand-overs

Reed wants EVERY circuit to migrate to the other labs exactly — not only the
ones that fit a named block. The receiving half now exists on the Signal Lab
side; this file is your half.

**Signal Lab side (DONE, on master):** a `biquad` block taking raw
coefficients — `b=biquad:b0:b1:b2:a1:a2` in a link (a-normalized, a0
dropped). It is bilinear-exact for any order-≤2 H(s), including the twin-T
(test: "carries a twin-T notch bilinear-exactly" in
apps/signal-lab/src/dsp/blocks.test.js). Unstable coefficients pass through
with an UNSTABLE flag rather than exploding.

**Your half — `asDigitalFilter` in toSignalLab.js:**
- When `shapeOf` finds no named shape but the order is ≤ 2, DO NOT decline:
  emit the raw link from the `digital` you already compute
  (`b=biquad:${d.b[0]}:${d.b[1]}:${d.b[2]}:${d.a[1]}:${d.a[2]}` — a is
  already normalized).
- Present it honestly: "as exact coefficients" rather than "as a low-pass",
  same sample-rate control and samples-per-cycle warning. Named forms stay
  PREFERRED when exact (their knobs mean something); raw is the fallback that
  never declines for expressibility.
- The twin-T's hand-over panel currently declines — it should be the
  showcase. The op-amp integrator may still decline (unbounded DC gain makes
  every Signal Lab plot lie); keep its reasoned refusal.
- Extend your harness: twin-T → link present → (optionally) drive the
  deployed-triangle pattern.

**Also — `asControlPlant`:** once Control Lab lands its `custom` plant (their
NEEDS has the spec), add the same fallback tier there:
`plant=custom:b2:b1:b0:a2:a1:a0`. Circuit → Control needs no bilinear at all,
so that hand-over is EXACT, not merely faithful.

## Open: PoleZeroCanvas tolerance cloud is too faint to read as a shape

Circuit Lab now has per-part tolerances, and its "Blame the right part"
lesson's whole payload is the SHAPE of the pole scatter — an arc of constant
radius when only R wobbles. The cloud rendering in
`packages/ui/src/PoleZeroCanvas.jsx` (1.8px dots at alpha 0.28, under the
nominal marks) is right for "there is uncertainty" and too faint for "the
uncertainty has this shape": a 240-dot arc reads as a smear inside the X
marker. Circuit Lab worked around it by choosing lesson parameters that
stretch the arc across ~24° of the circle, which helps but is subtler than
it deserves.

Request, low priority: bump the cloud to ~2.5px at ~0.45 alpha, or expose a
`cloudEmphasis` prop an app can set when the cloud IS the lesson. Keep the
nominal marks on top.

## Open: PoleZeroCanvas needs a `span` prop for sticky axes

Reed's tuning rule (the curve moves, not the axis — already law for Circuit
Lab's frequency and now its step axes) can't reach the pole-zero view: the
canvas auto-fits its span from the content on every render, so tuning C
re-labels the axes under poles that appear pinned in place.

Requested contract, and Circuit Lab already passes the prop (harmlessly
ignored today, lights up when you land it):

- `span` (optional number): the half-height of the view in rad/s. When given,
  use `max(span, autoSpan)` — the caller's frame, but never clipping content
  the auto-fit would have shown. When absent, behave exactly as today.
- x stays `span * aspect` with the square scaling kept, so an angle on screen
  remains the angle in the algebra.

The caller owns stickiness (Circuit Lab holds it in `stickySpan`, axis.js),
so the canvas stays stateless. Control Lab's root-locus use is unaffected
unless it opts in.


## ADDITION to the hand-over task: carry provenance (grammar is live)

The link grammar now has `from=<app>:<id>:<label>` (packages/ui/src/deeplink.js,
tests in deeplink.test.js; the label is URI-encoded). Append it to BOTH
hand-over links you emit:

    buildLink({ ..., from: { app: 'circuit', id, label: circuit.name } })

Signal Lab already displays it ("This chain IS your “RC low-pass” from
Circuit Lab..."); Control Lab's use is specified in their NEEDS. Without it,
the receiving lab cannot say whose circuit the box is.
