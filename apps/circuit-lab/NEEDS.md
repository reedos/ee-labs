# Needs and heads-ups for the other territories

## Crossed (Reed direct, in the shared tree): usage counting: GoatCounter on every released entry page

Reed asked to see whether the labs and the hand-overs get used. GitHub Pages
keeps no logs, so the pages now report: one script tag per entry page
(`data-goatcounter`, async, `https://gc.zgo.at/count.js`), to
reedos.goatcounter.com. No cookies, no personal data, skips localhost by
itself, and every page behaves identically when an ad blocker stops it.
What changed, by territory, amend freely:

- **packages/ui** new `src/analytics.js`, exported from `index.js`:
  `track(path)` counts an event (queued until count.js lands, `off` where no
  tag is on the page, never throws). `handOverEvent({action, app, tier,
  circuit})` and `arrivalEvent(lab, from)` are the two event names. They share one definition so senders and receivers agree. Tests in
  `analytics.test.js` pin the behaviour AND that the four released entry
  pages carry the tag (dark-launched labs are not listed). At release, add your lab to the list and put the tag in its `index.html`.
- **apps/signal-lab** adds the `index.html` tag. `App.jsx` counts
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

- **packages/dsp** raises `Q_MAX` from 40 to 100. The design clamp now matches the knob. Previously, settings past the clamp silently built a different filter.
- **packages/ui deeplink** `trimExact` now serializes raw carriers
  bit-exactly (shortest round-trip decimal, `String(x)`). Twelve figures
  broke a component-extreme tank: at Q ≈ 3×10⁴ the pole pair's distance
  from instability lives past digit twelve. Also affects `plant=custom`
  (your links get MORE exact. The round-trip test pins it).
- **signal-lab blocks** Q knob 20 → 100 (tracks Q_MAX, agreement pinned by
  test). Gain block ±126 dB (was −60/+24) so it can carry a hand-over's
  in-band gain up to the component box's ×10⁶. fromLink clamps source frequency to [1 Hz, Nyquist]. A sub-hertz source made the scope allocate hours of buffer and crash the tab. The emitter no longer sends one.
- **circuit-lab emitter** (`toSignalLab.js`): named tiers carry non-unity gain as `b=gain:<dB>` beside the filter. The band-pass tank arrives with Q 31.6 and +80 dB. Previously, Q was clamped and the peak normalized to 1. Named tier gates every knob against
  the receiving ranges (mirrored in RECEIVER, cross-checked by the
  component-box sweep test). Anything outside crosses raw, with the reason
  named on the panel. Raw coefficients that would clip are factored
  (largest tap → 1, scale → gain block) instead of flagged.

  Pre-warp is skipped at/above Nyquist (negative warp constant made an UNSTABLE copy of
  a stable circuit). Two Rule-3 guards: `gainOver` (scale past ±126 dB,
  synthetic-only) and `uncertifiable` (corner so many decades below the
  rate that float64 can no longer certify the carried poles stable). Lower the rate to remedy this (clipped coefficients instead require a higher rate).
- The emitter-contract sweep (`toSignalLab.test.js`) runs every circuit's full component box at three rates. Every link parses without receiver warnings, and every carried knob stays in range. Each filter is certifiably stable or flagged in advance. Its response is exact at the anchor.

Follow-up welcome: the Playwright harnesses were not extended for the new
panel branches (they are covered by a renderToString smoke test,
`HandOver.smoke.test.jsx`). Add browser coverage when next in there.

## Crossed (Reed direct, follow-up): the Control-Lab hand-over got the same treatment: heads-up, control-lab

No control-lab files changed. Your receiver was the spec. What the
circuit-lab emitter (`asControlPlant`) now does differently, and why:

- **Two sign bugs fixed.** The op-amp integrator crossed as +K/s via `Math.abs`. Negative feedback around the actual inverting integrator becomes positive feedback. The displayed loop therefore showed stable margins where the real loop had none. And the inverting amplifier
  crossed as `firstOrder` with k = −10, which your k knob (floor 0.001)
  clamped into a completely different plant. Both now cross as `custom`
  with the sign in the coefficients. The old integrator test pinned the
  bug and was rewritten saying so.
- **Named plants are gated against your knob ranges as serialized**
  (k 0.001…1e6, τ 1e-7…100 s, ωₙ 0.01…1e8, ζ 0.01…5, mirrored as
  CTRL_RECEIVER, cross-checked by a component-box sweep). Circuits your
  knobs cannot hold (ζ from 1.6e-4 to 1.6e7 is reachable!) fall to
  `custom` instead of arriving clamped. The panel names the reason.
- **`custom` coefficients are scaled into your ±1e12 fields when needed.** A power of two makes this exact in binary floating point. A twin-T at τ = 1 ns otherwise arrives with 1/τ² = 1e24. The sweep asserts
  nothing lands within reach of your 1e-30 trimLeading epsilon either.
- An order-2 denominator with a pole at the origin (motor-shaped, infinite
  DC gain) used to hit an early `return null`. It now falls through to
  `custom` exactly. No catalog circuit produces it today.
- The end-to-end check used `stateFromLink` and `buildLoop` in a temporary cross-app test, since removed. All 270 component-box combinations produced zero warnings. Plant magnitude was exact on a 1e-4…1e6 Hz grid. DC-gain sign and provenance were preserved.

## Done for you: the asControlPlant custom fallback (your queued task)

Reed asked live, so I landed your queued tier: circuits with numerator
zeros (RLC across R/L, twin-T) now cross as `plant=custom:b2:b1:b0:a2:a1:a0`
- exact polynomials, no transform. The serializer uses 12 significant figures for raw-coefficient carriers (b=biquad and plant=custom). Named knobs stay at 6. This deepened the linked twin-T notch floor from about -100 dB to below -140 dB. The change matches the serializer request in the test comment. That comment and the decline pins were rewritten.
AsPlant's refusal now only fires for order > 2. Amend freely.

## Crossed (deep, Reed live): first-order named tier + explicit hand-over sections

Reed's asks, implemented in your territory, amend freely:
- `toSignalLab.js`: unity-gain first-order LP/HP now cross BY NAME
  (`b=lowpass:<fc>:<q>:1`, trailing positional = Signal Lab's order select,
  new in fromLink.js). Exactness pinned: bilinear of the circuit ==
  designFirstOrder to 1e-12 (it IS the pre-warped bilinear of the unity-gain
  prototype). Your two raw-tier pins flipped as designed and were rewritten.
- `HandOver.jsx` adds destination headers using `.handover-dest` in styles.css. They read "→ Signal Lab · as a digital filter" and "→ Control Lab · as a plant". When asControlPlant is null, AsPlant now states the refusal reason: numerator zeros or order > 2. This follows CORE_SCOPE rule 2.
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
   to the word. Definitions-on-contact applies to the view's name too. For example, extend its label or caption with "This flip, slide, multiply and sum is convolution, y = x ∗ h."

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

The loop diagram states "in cascade: transfer functions multiply, L = C·P". The root locus names whose poles it draws. Their math panel prints the theorem in all three dialects. A row compares measured |C|·|P| with |L| at the crossover. All three labs now print their vocabulary of the one theorem.
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
   Y(s) = X(s)·H(s). For the loop, L = C·G and Y/R = L/(1+L).

Every Circuit Lab math panel carries Y(s) = X(s)·H(s) with a measured eigenfunction row. `sineResponse` in `apps/circuit-lab/src/math.js` runs a sine through the circuit using RK4. It demodulates the result over whole periods. The measured |H| and ∠H agree with the polynomial path to about 1e-3. This compares simulation with algebra.

## Full-fidelity hand-overs: Circuit Lab's Signal-Lab half is DONE

Reed's rule (relayed via the packages/signal-lab agent): every circuit
migrates exactly, not only the ones that fit a named block. Status:

- **Signal Lab receiver (DONE, 45b509a):** raw-coefficient `biquad` block,
  `b=biquad:b0:b1:b2:a1:a2`.
- **Circuit Lab emitter (DONE):** `asDigitalFilter` now has two tiers. It prefers a named shape when exact, so the knobs retain their meaning. Otherwise, any order ≤ 2 uses raw coefficients. First-order and flat circuits are padded into the five slots. The twin-T is the showcase. The harness (4c)
  drives it. The op-amp integrator keeps its reasoned refusal (pole at the
  origin, unbounded DC gain). Out-of-range coefficients (they grow as the
  rate drops toward the corner) are flagged with a raise-the-rate warning
  BEFORE the link is copied, complementing your clamp-with-warning on
  arrival.
- **Control Lab tier (WAITING on you):** When the `custom` plant lands, Circuit Lab will add the `asControlPlant` fallback (`plant=custom:...`). It will be exact, without a bilinear transform.

One observation for you, low priority: `deeplink.js` serializes every number
at six significant figures, which prices a linked twin-T's notch floor at
roughly −100 dB instead of −∞ (stated in Circuit Lab's tests). Fine for
knobs. If raw coefficient hand-overs ever deserve better, the fix is the
serializer's precision (perhaps only for biquad/custom params), not anything
in the emitters.

## RESOLVED (round-five grading): the tolerance cloud's own faintness

R = 560 Ω alone was not enough. Round-five grading looked at "Real parts
wobble" and "Blame the right part" at 1366×768 and 390×844. Both still showed
two clean, sharp crosses. The plot cannot show its own claim unless the
rendering carries it, not only the component value.

The upstream ask landed as requested. `packages/ui/src/PoleZeroCanvas.jsx`
takes an opt-in `cloudEmphasis` prop: 2.5px dots at 0.45 alpha, against the
old 1.8px at 0.28. Nominal marks still draw on top. Circuit Lab sets the prop
on the two lessons where the cloud IS the lesson (`lessons.js`,
`cloudEmphasis: true`). Every other caller, including Control Lab's root
locus, keeps the old default.

Measured before and after in a live browser, at 1366×768, by trace-colour ink
box (`verify.mjs` section 8, now covering both lessons). "Real parts wobble"
went from a 16×23 px box to 16×25 px. Its ink count rose 24%, from 215 to
266 px. "Blame the right part" (previously unmeasured here) now shows
16×24 px against a 16×17 px bare cross.

`course.test.js`'s pixel-spread tests were rewritten to match. The old
assertion compared raw pole-sample positions against "three marker radii", a
threshold with no rendering behind it. It now adds each cloud dot's own
rendered radius to the position spread, the same "ink" verify.mjs
photographs, computed instead of measured. That total is compared against
the marker's own rendered footprint. A future regression in the dot size or
alpha now fails the test, not only a change in component tolerance.

## Open, confirmed still unaddressed: PoleZeroCanvas needs a `span` prop for sticky axes

Reed's tuning rule keeps the axes fixed while the curve moves. Circuit Lab's frequency and step axes follow it, but the pole-zero view does not. `PoleZeroCanvas.jsx` recomputes `span` from `poles`, `zeros`, and `cloud` on every render, without reading a prop. Tuning C therefore relabels the axes while the poles appear stationary.

Requested contract, and Circuit Lab still passes the prop (harmlessly
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

Reed reported a cutoff and order mismatch after sending an RC low-pass to Signal Lab. The emitted coefficients are exact: |H| = 0.7071 at 1591.5 Hz on the link. The failure is in presentation. The receiver fixes are live. Two changes to the links
you emit, both tiers (named and raw):

1. `zoom=<hz>` (grammar live in packages/ui, tested; Signal Lab maps it to
   its spectrum span on arrival). Emit roughly 8x the corner. The hand-over picks 192 kHz for warp headroom, and Signal Lab uses a linear axis to Nyquist. Without zoom, a 1.6 kHz corner occupies 1.7% of the plot. That makes an exact mapping appear wrong. Skip it when there is no corner
   (the divider).

2. Reed requested a square or sine as the default source instead of noise. Emit a square at about a fifth of the corner, rounded to a simple frequency, with amplitude about 0.8. Its harmonics probe discrete points on the curve. The scope shows rounded corners or decaying plateaus more clearly than with noise.
   For the no-corner case a square at any audio-ish frequency is fine.

Also fixed on the receiving side (was mine): the raw-biquad panel printed
"order of this section: 2" unconditionally - your first-order RC arrival now
reads order 1 off its trailing zeros. That was the "order is off" half of
Reed's report.

### Update: both emit items landed by the packages/signal-lab agent

Reed was testing the flow live, so the territory rules were waived for these changes. Every asDigitalFilter link now carries src=square at about fRef/5, amplitude 0.8, and zoom=8 corners. An emitter test checks both. Review welcome - amend
freely, it is your file.

## Small crossing: lesson titles above their notes (Reed, uniform across apps)

The selected lesson's name now renders as h3.note-title above its note paragraph. Circuit Lab also shows the circuit's name above its hint. Reed requested this in every module, so all three changes landed together. Style is shared
from packages/ui base.css. Amend freely.

## PACKAGES BUG (found in the shared tree, not mine to fix): parseEngField + NumField's onBlur silently drop a typed prefix on the SECOND field you touch

The Explanation/Transfer review ran `npx vite preview` and verify.mjs against uncommitted `packages/ui/src/units.js` and `packages/ui/src/NumField.jsx`. Their new parseEngField rule reads bare numbers in canonical units. Every RC, RLC, Sallen-Key, and twin-T section then failed. Each mismatch was a power of ten matching the field's displayed prefix. The defect is outside Circuit Lab and remains unchanged here because packages/* is read-only for this lane. It affects this app's harness and other apps' harnesses.

**Repro**: type "2.2k" in an eng-mode NumField and press Enter. `aria-valuenow` confirms that this commits 2200. Then focus a second field by Tab or click, or fill another field as the harness's `setField()` does.

The first field's `onBlur` then calls `commit(e.target.value)` again. The input now shows "2.2" after reformatting. Its "k" prefix is in the separate `.num-unit` label.

Under the old parseEng rule, the displayed prefix made bare "2.2" mean 2200. The redundant commit changed nothing. Under the new rule, it means 2.2. The confirmed value silently becomes 1000x smaller.

**Confirmed via direct DOM read** of `aria-valuenow` before and after focusing a second field. The reproduction used a plain RC low-pass circuit, R then C, without my lesson, note, or app code. Every app's `setField()` helper types a
value then moves to the next field, which follows the harness's and a user's ordinary path.

**The likely fix is in NumField.jsx.** `onBlur` should not commit again when `draft` is null. Nothing has been typed since the last commit. The box displays its correctly formatted text, which must not be parsed as fresh input. Something
like `onBlur={(e) => { if (draft != null) commit(e.target.value) }}`.
The new parseEngField rule matches its unit tests. The redundant onBlur commit corrupts the value immediately afterward.

Circuit Lab's verify.mjs cannot work around this defect. Sections 2, 4b, 4c, and 4d check physics against typed values. Those sections will fail until the shared-field fix lands. Flagged rather than silently worked around.
