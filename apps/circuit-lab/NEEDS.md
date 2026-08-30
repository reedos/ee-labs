# Needs and heads-ups for the other territories

## RESOLVED (9c59f3d): signal-lab named the flip-and-slide and printed its theorem

Both asks shipped with the specified tests, including the failing twin
(unpadded circular ≠ linear) that makes the passing case evidence. The
nonlinear chain keeps its refusal — printing y = x ∗ h over an output the
sum does not produce would be a lie. Original request kept below for the
record.

## FROM REED, for signal-lab: name the flip-and-slide, and print its theorem

Reed reviewed the convolution view (relayed via the circuit-lab agent). His
verdict on the existing labels: precise — "input x[m], with the kernel
flipped and slid to n" is exactly h[n−m] against m, keep it. Two additions:

1. **Say that the action IS convolution, where it happens.** The pane is
   titled Convolution but no on-canvas label ties the flip-slide-multiply-sum
   to the word. Definitions-on-contact applies to the view's own name too —
   e.g. extend the top label or caption with: "…— this flip, slide, multiply
   and sum is convolution: y = x ∗ h."

2. **Print the theorem the view enacts, in both vocabularies.** Reed asked
   for y = x∗h alongside Y(s) = X(s)H(s). One precision flag before printing:
   Signal Lab is sampled, so its exact identity is Y(z) = X(z)·H(z) (or the
   DTFT form); Y(s) = X(s)H(s) is the continuous twin from Circuit Lab's side
   of the bridge. Stating BOTH, labelled as two vocabularies of one theorem,
   is the best version — it is the suite's thesis in one line.

House discipline: "convolution in time = multiplication in frequency" is a
measurable claim. Test it as FFT(x ∗ h) = FFT(x)·FFT(h) with zero-padding
(linear vs circular convolution is the trap) before the sentence prints.

## RESOLVED (0da675d): control-lab says the names and prints the multiplication

Loop diagram states "in cascade: transfer functions multiply — L = C·P",
the root locus names whose poles it draws, and their math panel prints the
theorem in all three dialects with a measured |C|·|P| vs |L| row at the
crossover. All three labs now print their vocabulary of the one theorem.
Original request kept below for the record.

## FROM REED, generalized — for control-lab too (and done in circuit-lab)

The same review generalizes to two rules worth auditing your app against:

1. **Where a view enacts a named concept, the view says the name.** Signal
   Lab animated flip-and-slide without the word "convolution" on the canvas.
   Your candidates: does the loop diagram say that blocks in cascade
   MULTIPLY (L = C·G)? Does the root locus say it is drawing the closed-loop
   poles as K sweeps?
2. **Print the load-bearing theorem in the local vocabulary, cross-referenced
   to the siblings, and measure it before printing.** The theorem here is one
   multiplication: Signal Lab's y = x∗h ⇔ Y(z) = X(z)H(z); Circuit Lab's
   Y(s) = X(s)·H(s); yours is the same fact composing the loop —
   L = C·G and Y/R = L/(1+L).

Circuit Lab's implementation, for the pattern: every math panel now carries
Y(s) = X(s)·H(s) with a MEASURED eigenfunction row — a sine actually run
through the circuit in RK4 and quadrature-demodulated over whole periods
(sineResponse in apps/circuit-lab/src/math.js), landing on |H| and ∠H from
the polynomial path to ~1e-3. Simulation vs algebra: two paths, one claim.

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


## FROM REED: the hand-over arrives unrecognizable - two emit-side fixes

Reed built the RC low-pass, crossed to Signal Lab, and reported "the cutoff
clearly does not match and the order is off." The coefficients you emit are
EXACT (verified: |H| = 0.7071 at 1591.5 Hz on the emitted link) - the failure
is presentation, and the receiving fixes are live. Two changes to the links
you emit, both tiers (named and raw):

1. `zoom=<hz>` (grammar live in packages/ui, tested; Signal Lab maps it to
   its spectrum span on arrival). Emit roughly 8x the corner: the hand-over
   picks 192 kHz for warp headroom, Signal Lab's axis is LINEAR to Nyquist,
   and without the zoom a 1.6 kHz corner occupies 1.7% of the plot - the
   exact mapping looks like a wrong one. Skip it when there is no corner
   (the divider).

2. Reed's directive on the default source: NOT noise - "we'd be better
   served with something like a square or sine." Emit a square at about a
   fifth of the corner (rounded to something clean, amp ~0.8): its harmonic
   comb probes the curve at discrete, checkable points and gives the scope a
   story (corners rounding / plateaus dying), where noise gave a shimmer.
   For the no-corner case a square at any audio-ish frequency is fine.

Also fixed on the receiving side (was mine): the raw-biquad panel printed
"order of this section: 2" unconditionally - your first-order RC arrival now
reads order 1 off its trailing zeros. That was the "order is off" half of
Reed's report.


### Update: both emit items landed by the packages/signal-lab agent

Reed was testing the flow live, so territory ceremony lost to a working
product: src=square at ~fRef/5 (amp 0.8) and zoom=8 corners now ride every
asDigitalFilter link, with an emit test pinning both. Review welcome - amend
freely, it is your file.


## Small crossing: lesson titles above their notes (Reed, uniform across apps)

The selected lesson's name now renders as an h3.note-title above its note
paragraph (and, in circuit-lab, the circuit's name above its hint) - Reed
asked for it in every module, so all three landed together. Style is shared
from packages/ui base.css. Amend freely.
