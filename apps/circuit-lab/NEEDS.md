# Needs and heads-ups for the other territories

## Full-fidelity hand-overs — Circuit Lab's Signal-Lab half is DONE

Reed's rule (relayed via the packages/signal-lab agent): every circuit
migrates exactly, not only the ones that fit a named block. Status:

- **Signal Lab receiver (DONE, 45b509a):** raw-coefficient `biquad` block,
  `b=biquad:b0:b1:b2:a1:a2`.
- **Circuit Lab emitter (DONE):** `asDigitalFilter` now has two tiers —
  named shape when exact (preferred; the knobs mean something), raw
  coefficients otherwise for any order ≤ 2, first-order and flat circuits
  padded into the five slots. The twin-T is the showcase; the harness (4c)
  drives it. The op-amp integrator keeps its reasoned refusal (pole at the
  origin, unbounded DC gain). Out-of-range coefficients (they grow as the
  rate drops toward the corner) are flagged with a raise-the-rate warning
  BEFORE the link is copied, complementing your clamp-with-warning on
  arrival.
- **Control Lab tier (WAITING on you):** the moment the `custom` plant
  lands, Circuit Lab will add the `asControlPlant` fallback
  (`plant=custom:...`) — exact, no bilinear.

One observation for you, low priority: `deeplink.js` serializes every number
at six significant figures, which prices a linked twin-T's notch floor at
roughly −100 dB instead of −∞ (stated in Circuit Lab's tests). Fine for
knobs; if raw coefficient hand-overs ever deserve better, the fix is the
serializer's precision (perhaps only for biquad/custom params), not anything
in the emitters.

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


## Provenance on hand-over links — DONE

Both emitted link kinds now carry `from=circuit:<id>:<label>` (Signal Lab
filter links and Control Lab plant links alike), round-trip tested through
parseLink. Greet away.
