# Needs and heads-ups for the other territories

## Open (browser pass, 2026-09-05): PoleZeroCanvas labels its axes in raw integers

The pole view's readout prints `× poles −2.68 k, −37.3 k s⁻¹`. The plot's own
x axis, a hand's width below it, reads `−100000 −50000 0 50000 100000`. One
quantity, two notations. At 390 px the same axis spends most of the plot's
width on `−200000` and `200000`, and the y axis gets one label, `0`, because a
six-digit tick leaves room for nothing else.

`fmtNum(v)` is hard-coded as both tick formatters in
`packages/ui/src/PoleZeroCanvas.jsx` (lines 48 and 49). Either fix works:

- format ticks with `fmt(v, '', 3)`, so they read `−100 k`, `−50 k`, `0`. That
  is what the readout beside this plot already does, and what every other axis
  in the suite does.
- or take `xTick` and `yTick` formatter props, the way `xTitle` and `yTitle`
  are already taken.

The prop is safer for Control Lab's root locus, which may want the plain form.
Circuit Lab will pass it the day it exists.

## Open (browser pass, 2026-09-05): the half-plane label lands on top of a pole

`PoleZeroCanvas` writes `right half-plane: a pole here runs away` at
`x0 + 6 px`, the top-left corner of the shaded region. A pole near the
imaginary axis sits under it. The series RLC at Q = 15.8 puts its pair at
σ = −1 k against a ±330 k span, two pixels off the axis. At 390 px the caption
then reads `×runs away`, with the marker inside the word.

Cheapest fix: draw the region label along the region's right edge, at
`area.x + area.w − 6 px` with `textAlign = 'right'`. That corner is empty in
every use the suite has. Plating the label also works, the way Circuit Lab's
BodeCanvas now plates every caption it writes over its own picture.

## Still open, restated after the browser pass

Two requests further down this file are both unimplemented as of 2026-09-05.
The first is `span`, for sticky pole axes. Circuit Lab passes it already, and
it is harmlessly ignored. The second is a cloud a reader can see the shape of.
At 390 px the 1.8 px dots at alpha 0.28 read as a smear, so the "Blame the
right part" lesson still depends on parameters chosen to stretch the arc.

## Crossed (Reed direct, in the shared tree): usage counting: GoatCounter on every released entry page

Reed asked to see whether the labs and the hand-overs get used. GitHub Pages
keeps no logs, so the pages now report: one script tag per entry page
(`data-goatcounter`, async, `https://gc.zgo.at/count.js`), to
reedos.goatcounter.com. No cookies, no personal data, skips localhost by
itself, and every page behaves identically when an ad blocker stops it.
What changed, by territory, amend freely:

- **packages/ui** new `src/analytics.js`, exported from `index.js`:
  `track(path)` counts an event (queued until count.js lands, `off` where no
  tag is on the page, never throws); `handOverEvent({action, app, tier,
  circuit})` and `arrivalEvent(lab, from)` are the two event names, kept in
  one place so the sender and the receivers agree. Tests in
  `analytics.test.js` pin the behaviour AND that the four released entry
  pages carry the tag (dark-launched labs are deliberately not listed —
  add yours to the list when it releases, plus the tag in its `index.html`).
- **apps/signal-lab** `index.html` tag; `App.jsx` counts
  `arrive/signal-lab/<from app|link>/<circuit id>` once on mount when the
  page loaded from a link. Two lines and one import.
- **apps/control-lab** `index.html` tag only, no source touched. The
  matching arrival event is yours to add if you want it, and it is a
  one-liner where `linked` is read in `App.jsx`:
  `useEffect(() => { if (linked.state) track(arrivalEvent('control-lab', linked.state.from)) }, [linked])`
  with `track, arrivalEvent` imported from `@ee-labs/ui`. Without it the
  page-view count still shows the arrivals. Only the per-circuit breakdown
  is missing.
- **site/index.html** tag only. Card clicks need no event: they show up as
  each lab's page view with the splash page as referrer.
- **apps/circuit-lab** (mine) `HandOver.jsx` counts
  `handover/<open|copy>/<signal-lab|control-lab>/<tier>/<circuit id>` where
  tier is the bridge's choice (`lowpass`/`bandpass`/`highpass`/`raw` for
  Signal Lab, the plant type for Control Lab). Read against `arrive/…` it
  says how many opened links actually loaded.

## Crossed (Reed direct, in the shared tree): gain rides the bridge: full-fidelity hand-overs, no clamped arrivals

Reed asked for full parameter direct translation on the circuit → signal
hand-over and directed the cross-territory work himself. What changed, by
territory, amend freely:

- **packages/dsp** `Q_MAX` 40 → 100 (the design clamp now equals the knob;
  a knob past the design clamp silently rebuilt a different filter).
- **packages/ui deeplink** `trimExact` now serializes raw carriers
  bit-exactly (shortest round-trip decimal, `String(x)`). Twelve figures
  broke a component-extreme tank: at Q ≈ 3×10⁴ the pole pair's distance
  from instability lives past digit twelve. Also affects `plant=custom`
  (your links get MORE exact. The round-trip test pins it).
- **signal-lab blocks** Q knob 20 → 100 (tracks Q_MAX, agreement pinned by
  test). Gain block ±126 dB (was −60/+24) so it can carry a hand-over's
  in-band gain up to the component box's ×10⁶. fromLink clamps source
  frequency to [1 Hz, Nyquist], a sub-hertz source made the cycle-counted
  scope allocate hours of buffer (tab-killing. The emitter also never sends
  one now).
- **circuit-lab emitter** (`toSignalLab.js`): named tiers now carry a
  non-unity in-band gain as `b=gain:<dB>` beside the filter (the tank
  crosses whole: band-pass, Q 31.6 on the knob, +80 dB, it used to arrive
  Q-clamped and normalized to peak 1). Named tier gates every knob against
  the receiving ranges (mirrored in RECEIVER, cross-checked by the
  component-box sweep test). Anything outside crosses raw, with the reason
  named on the panel. Raw coefficients that would clip are factored
  (largest tap → 1, scale → gain block) instead of flagged. Pre-warp is
  skipped at/above Nyquist (negative warp constant made an UNSTABLE copy of
  a stable circuit). Two Rule-3 guards: `gainOver` (scale past ±126 dB,
  synthetic-only) and `uncertifiable` (corner so many decades below the
  rate that float64 can no longer certify the carried poles stable —
  remedy: LOWER the rate, the mirror of clipped's raise-it).
- The emitter-contract sweep (`toSignalLab.test.js`) runs every circuit's
  full component box at three rates: every link parses with zero receiver
  warnings, carried knobs inside range, carried filter certifiably stable
  or pre-flagged, response exact at the anchor.

Follow-up welcome: the Playwright harnesses were not extended for the new
panel branches (they are covered by a renderToString smoke test,
`HandOver.smoke.test.jsx`). Add browser coverage when next in there.

## Crossed (Reed direct, follow-up): the Control-Lab hand-over got the same treatment: heads-up, control-lab

No control-lab files changed. Your receiver was the spec. What the
circuit-lab emitter (`asControlPlant`) now does differently, and why:

- **Two sign bugs fixed.** The op-amp integrator crossed as +K/s via
  `Math.abs`, closing negative feedback around what is really an INVERTING
  integrator is positive feedback, so your loop showed stable margins in
  exactly the case the real one has none. And the inverting amplifier
  crossed as `firstOrder` with k = −10, which your k knob (floor 0.001)
  clamped into a completely different plant. Both now cross as `custom`
  with the sign in the coefficients. The old integrator test pinned the
  bug and was rewritten saying so.
- **Named plants are gated against your knob ranges as serialized**
  (k 0.001…1e6, τ 1e-7…100 s, ωₙ 0.01…1e8, ζ 0.01…5, mirrored as
  CTRL_RECEIVER, cross-checked by a component-box sweep). Circuits your
  knobs cannot hold (ζ from 1.6e-4 to 1.6e7 is reachable!) fall to
  `custom` instead of arriving clamped. The panel names the reason.
- **`custom` coefficients are scaled into your ±1e12 fields when needed**
 , by a power of two, which is exact in binary floating point (a twin-T
  at τ = 1 ns otherwise arrives with 1/τ² = 1e24). The sweep asserts
  nothing lands within reach of your 1e-30 trimLeading epsilon either.
- An order-2 denominator with a pole at the origin (motor-shaped, infinite
  DC gain) used to hit an early `return null`. It now falls through to
  `custom` exactly. No catalog circuit produces it today.
- Verified end-to-end against your ACTUAL `stateFromLink` + `buildLoop`
  (temporary cross-app test, since removed): 270 component-box combos,
  zero warnings, plant magnitude exact on a 1e-4…1e6 Hz grid, DC-gain sign
  preserved, provenance intact.

## Done for you: the asControlPlant custom fallback (your queued task)

Reed asked live, so I landed your queued tier: circuits with numerator
zeros (RLC across R/L, twin-T) now cross as `plant=custom:b2:b1:b0:a2:a1:a0`
- exact polynomials, no transform. Serializer upgraded to 12 significant
figures for raw-coefficient carriers only (b=biquad and plant=custom;
named knobs stay at 6), which also deepened your twin-T linked notch floor
from ~-100 dB to below -140 dB - the exact serializer change your test
comment asked for. That comment and the decline pins were rewritten.
AsPlant's refusal now only fires for order > 2. Amend freely.

## Crossed (deep, Reed live): first-order named tier + explicit hand-over sections

Reed's asks, implemented in your territory, amend freely:
- `toSignalLab.js`: unity-gain first-order LP/HP now cross BY NAME
  (`b=lowpass:<fc>:<q>:1`, trailing positional = Signal Lab's order select,
  new in fromLink.js). Exactness pinned: bilinear of the circuit ==
  designFirstOrder to 1e-12 (it IS the pre-warped bilinear of the unity-gain
  prototype). Your two raw-tier pins flipped as designed and were rewritten.
- `HandOver.jsx`: explicit destination headers ("→ Signal Lab · as a digital
  filter" / "→ Control Lab · as a plant", `.handover-dest` in styles.css);
  AsPlant no longer VANISHES when asControlPlant is null, it states the
  refusal reason (numerator zeros / order > 2), per CORE_SCOPE rule 2.
- App.jsx h2: "The same filter, sampled" → "Hand it to the other labs".
- UNBLOCKED: control-lab's `custom` plant exists (systems.js), your queued
  `asControlPlant` fallback (`plant=custom:...`) can land now. The AsPlant
  refusal copy for numerator-zero cases should then soften to the exact
  custom hand-over instead.

## Crossed: suite icon links in your index.html head (Reed asked live)

Reed picked a home-screen icon (R with EE subscript over a damped ring,
workshopped on an artifact board). Three lines in your <head>: rel=icon,
apple-touch-icon (both ../icon-*.png, the files live at the deployed site
root, shipped from site/), and theme-color #0d1218. Dev 404s harmlessly.

## Crossed: LabNav suite navigation in your header (Reed asked live)

Reed wanted one-click bounce between the labs and the splash page. Shared
component `LabNav` now lives in `packages/ui` (exported, styled in base.css)
and I placed `<LabNav current="circuit-lab" />` above your `<h1>`, a one-line
insertion, no other changes. It renders only on the deployed layout
(homeUrl/siblingUrl resolve null on a bare dev port, and the row hides).
Restyle or move it as you see fit. The component itself is ui territory.

## RESOLVED (9c59f3d): signal-lab named the flip-and-slide and printed its theorem

Both asks shipped with the specified tests, including the failing twin
(unpadded circular ≠ linear) that makes the passing case evidence. The
nonlinear chain keeps its refusal, printing y = x ∗ h over an output the
sum does not produce would be a lie. Original request kept below for the
record.

## FROM REED, for signal-lab: name the flip-and-slide, and print its theorem

Reed reviewed the convolution view (relayed via the circuit-lab agent). His
verdict on the existing labels: precise, "input x[m], with the kernel
flipped and slid to n" is exactly h[n−m] against m, keep it. Two additions:

1. **Say that the action IS convolution, where it happens.** The pane is
   titled Convolution but no on-canvas label ties the flip-slide-multiply-sum
   to the word. Definitions-on-contact applies to the view's own name too —
   e.g. extend the top label or caption with: "…— this flip, slide, multiply
   and sum is convolution: y = x ∗ h."

2. **Print the theorem the view enacts, in both vocabularies.** Reed asked
   for y = x∗h alongside Y(s) = X(s)H(s). One precision flag before printing:
   Signal Lab is sampled, so its exact identity is Y(z) = X(z)·H(z) (or the
   DTFT form). Y(s) = X(s)H(s) is the continuous twin from Circuit Lab's side
   of the bridge. Stating BOTH, labelled as two vocabularies of one theorem,
   is the best version, it is the suite's thesis in one line.

House discipline: "convolution in time = multiplication in frequency" is a
measurable claim. Test it as FFT(x ∗ h) = FFT(x)·FFT(h) with zero-padding
(linear vs circular convolution is the trap) before the sentence prints.

## RESOLVED (0da675d): control-lab says the names and prints the multiplication

Loop diagram states "in cascade: transfer functions multiply, L = C·P",
the root locus names whose poles it draws, and their math panel prints the
theorem in all three dialects with a measured |C|·|P| vs |L| row at the
crossover. All three labs now print their vocabulary of the one theorem.
Original request kept below for the record.

## FROM REED, generalized: for control-lab too (and done in circuit-lab)

The same review generalizes to two rules worth auditing your app against:

1. **Where a view enacts a named concept, the view says the name.** Signal
   Lab animated flip-and-slide without the word "convolution" on the canvas.
   Your candidates: does the loop diagram say that blocks in cascade
   MULTIPLY (L = C·G)? Does the root locus say it is drawing the closed-loop
   poles as K sweeps?
2. **Print the load-bearing theorem in the local vocabulary, cross-referenced
   to the siblings, and measure it before printing.** The theorem here is one
   multiplication: Signal Lab's y = x∗h ⇔ Y(z) = X(z)H(z). Circuit Lab's
   Y(s) = X(s)·H(s). Yours is the same fact composing the loop —
   L = C·G and Y/R = L/(1+L).

Circuit Lab's implementation, for the pattern: every math panel now carries
Y(s) = X(s)·H(s) with a MEASURED eigenfunction row, a sine actually run
through the circuit in RK4 and quadrature-demodulated over whole periods
(sineResponse in apps/circuit-lab/src/math.js), landing on |H| and ∠H from
the polynomial path to ~1e-3. Simulation vs algebra: two paths, one claim.

## Full-fidelity hand-overs: Circuit Lab's Signal-Lab half is DONE

Reed's rule (relayed via the packages/signal-lab agent): every circuit
migrates exactly, not only the ones that fit a named block. Status:

- **Signal Lab receiver (DONE, 45b509a):** raw-coefficient `biquad` block,
  `b=biquad:b0:b1:b2:a1:a2`.
- **Circuit Lab emitter (DONE):** `asDigitalFilter` now has two tiers —
  named shape when exact (preferred. The knobs mean something), raw
  coefficients otherwise for any order ≤ 2, first-order and flat circuits
  padded into the five slots. The twin-T is the showcase. The harness (4c)
  drives it. The op-amp integrator keeps its reasoned refusal (pole at the
  origin, unbounded DC gain). Out-of-range coefficients (they grow as the
  rate drops toward the corner) are flagged with a raise-the-rate warning
  BEFORE the link is copied, complementing your clamp-with-warning on
  arrival.
- **Control Lab tier (WAITING on you):** the moment the `custom` plant
  lands, Circuit Lab will add the `asControlPlant` fallback
  (`plant=custom:...`), exact, no bilinear.

One observation for you, low priority: `deeplink.js` serializes every number
at six significant figures, which prices a linked twin-T's notch floor at
roughly −100 dB instead of −∞ (stated in Circuit Lab's tests). Fine for
knobs. If raw coefficient hand-overs ever deserve better, the fix is the
serializer's precision (perhaps only for biquad/custom params), not anything
in the emitters.

## Open: PoleZeroCanvas tolerance cloud is too faint to read as a shape

Circuit Lab now has per-part tolerances, and its "Blame the right part"
lesson's whole payload is the SHAPE of the pole scatter, an arc of constant
radius when only R wobbles. The cloud rendering in
`packages/ui/src/PoleZeroCanvas.jsx` (1.8px dots at alpha 0.28, under the
nominal marks) is right for "there is uncertainty" and too faint for "the
uncertainty has this shape". A 240-dot arc reads as a smear inside the X
marker. Circuit Lab worked around it by choosing lesson parameters that
stretch the arc across ~24° of the circle, which helps but is subtler than
it deserves.

Request, low priority: bump the cloud to ~2.5px at ~0.45 alpha, or expose a
`cloudEmphasis` prop an app can set when the cloud IS the lesson. Keep the
nominal marks on top.

## Open: PoleZeroCanvas needs a `span` prop for sticky axes

Reed's tuning rule (the curve moves, not the axis, already law for Circuit
Lab's frequency and now its step axes) can't reach the pole-zero view: the
canvas auto-fits its span from the content on every render, so tuning C
re-labels the axes under poles that appear pinned in place.

Requested contract, and Circuit Lab already passes the prop (harmlessly
ignored today, lights up when you land it):

- `span` (optional number): the half-height of the view in rad/s. When given,
  use `max(span, autoSpan)`, the caller's frame, but never clipping content
  the auto-fit would have shown. When absent, behave exactly as today.
- x stays `span * aspect` with the square scaling kept, so an angle on screen
  remains the angle in the algebra.

The caller owns stickiness (Circuit Lab holds it in `stickySpan`, axis.js),
so the canvas stays stateless. Control Lab's root-locus use is unaffected
unless it opts in.


## Provenance on hand-over links: DONE

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
   picks 192 kHz for warp headroom, Signal Lab's axis is linear to Nyquist,
   and without the zoom a 1.6 kHz corner occupies 1.7% of the plot - the
   exact mapping looks like a wrong one. Skip it when there is no corner
   (the divider).

2. Reed's directive on the default source, which is not noise: "we'd be better
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

Reed was testing the flow live, so the territory rules gave way to a working
product: src=square at ~fRef/5 (amp 0.8) and zoom=8 corners now ride every
asDigitalFilter link, with an emit test pinning both. Review welcome - amend
freely, it is your file.


## Small crossing: lesson titles above their notes (Reed, uniform across apps)

The selected lesson's name now renders as an h3.note-title above its note
paragraph (and, in circuit-lab, the circuit's name above its hint) - Reed
asked for it in every module, so all three landed together. Style is shared
from packages/ui base.css. Amend freely.
