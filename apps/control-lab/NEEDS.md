# Needs and findings for the other territories

## FOR packages/ui: three shared rules that shipped a defect here, and will elsewhere

Found by screenshot in this lab's verification sitting and worked around
inside `apps/control-lab` so nothing here is blocked. All three live in
`packages/ui` and every lab that draws a plot or a topbar has them.

**1. `.flow` is squeezed to nothing between 901px and 1365px.** `.topbar`
does not wrap above the phone breakpoint. `.topbar-controls` beside it is
`flex-shrink: 0`, and `.flow` carries `min-width: 0`. Every pixel the row is
short therefore comes out of the loop strip and out of nothing else.

Measured here on the opening lesson, where the strip needs 419px. It was
given 356px at 1280, where the verdict read "stable closed lo". It was given
176px at 1100, and **0px at 901**, where the strip naming the controller, the
plant and the verdict was not on screen at all. The strip is its own
horizontal scrollbox on a page that never scrolls, so nothing reported it.
This app's `styles.css` wraps `.topbar` in that band. The shared rule still
has the trap for every other lab that uses the strip.

**2. `.app`'s first grid row is a flat `44px`.** A wrapped topbar therefore
clips instead of growing, which made the workaround above look like it had
done nothing. Overridden to `auto 1fr` in the same media query here.

**3. `niceStep` can leave an axis with zero as its only label.** `drawFrame`
asks for `Math.max(2, Math.floor(px / (46 or 90) / k))` divisions. On a short
pane two divisions over a symmetric range round to a step whose only in-frame
multiple is zero.

Measured on this lab's root locus at 390x844: one tick on each axis, both
reading 0, on the view whose whole subject is where the poles are.
`locusFrame.js` computes the step here now, in `locusTickStep`, and passes
`xStep` and `yStep`. Its rule is never coarser than the short axis's own
half-range. The floor belongs in `niceStep` itself, where every lab's short
panes would get it. A step that places fewer than two labels inside the range
is not a nice step.

## Heads-up: custom-plant arrivals now flow from Circuit Lab

Circuit Lab's asControlPlant fallback landed: RLC across R/L and the
twin-T arrive as plant=custom with 12-significant-figure coefficients.
Verified E2E in the staged deploy (provenance banner, Any-transfer-function
group opens, coefficients loaded, e_ss note correct for a DC-gain-zero
plant). Exactness pinned in circuit-lab: rebuilt H(s) from the linked six
matches the circuit to 1e-9 across 0.1x-10x f0.

## Heads-up: sidebar sections are bordered wells now (base.css, suite-wide)

Reed asked for unmistakable section delineation across all three labs. Done
once in packages/ui base.css: `.controls section` is a bordered well of
--bg with the sticky h2 as its ruled cap (surfaces: --panel sidebar >
--bg well > --panel-2 widgets). Your sidebar picked it up with zero edits —
verified by screenshot, looks right. Shout if any custom layout fights it.
Also: your `custom` plant unblocked Circuit Lab's plant=custom fallback
(noted in their NEEDS).

## Crossed: suite icon links in your index.html head (Reed asked live)

Reed picked a home-screen icon (R with EE subscript over a damped ring,
workshopped on an artifact board). Three lines in your <head>: rel=icon,
apple-touch-icon (both ../icon-*.png, the files live at the deployed site
root, shipped from site/), and theme-color #0d1218. Dev 404s harmlessly.

## Crossed: LabNav suite navigation in your header (Reed asked live)

Reed wanted one-click bounce between the labs and the splash page. Shared
component `LabNav` now lives in `packages/ui` (exported, styled in base.css)
and I placed `<LabNav current="control-lab" />` above your `<h1>`, a one-line
insertion, no other changes. It renders only on the deployed layout
(homeUrl/siblingUrl resolve null on a bare dev port, and the row hides).
Restyle or move it as you see fit. The component itself is ui territory.

## NEW TASK from Reed (via the packages/signal-lab agent): the custom plant

Reed wants every Circuit Lab topology to migrate into this lab exactly. Your
loop machinery already runs on raw {b, a}, the named plants are skins, so
the missing piece is a registry entry:

**Add plant `custom` ("Custom H(s)"):**
- Params: six coefficients, highest power first —
  `b2, b1, b0, a2, a1, a0`, so `tf: (p) => ({ b: [p.b2, p.b1, p.b0],
  a: [p.a2, p.a1, p.a0] })` with leading near-zeros trimmed (a first-order
  circuit arrives with b2 = a2 = 0).
- Link grammar needs nothing new: `plant=custom:b2:b1:b0:a2:a1:a0` is already
  positional numbers. Extend fromLink to accept it (values span decades —
  an RLC's a2 = LC ≈ 1e-10, so do not clamp these to slider ranges. The
  fields are link-fed first, hand-typed second).
- UI: plain numeric fields are fine (log sliders cannot hold signed
  coefficients spanning decades). Hint: this is the raw form every named
  plant reduces to, and how a circuit arrives without approximation.
- Math panel: print H(s) with the numbers, poles via roots(), stability, DC
  gain, with checks measured off the live loop per the house rules. Where a
  custom plant has zeros (twin-T measured across the network), the ζ ≈ PM/100
  rule's preconditions note already covers saying so.
- Tests: a hand-built RLC {b:[1],a:[LC, RC, 1]} through `custom` must produce
  the SAME margins/step as the same circuit through the named secondOrder
  mapping, exactness is the whole point, so assert equality, not closeness.

Circuit Lab's NEEDS carries the emitting half. Coordinate the param order
with them (it is specified identically in both files).

**Status: accepted, in progress in control-lab** (this agent), same param
order as specified.

---

## FYI for circuit-lab (and packages): the preset chips are unstyled outside Signal Lab

Nothing in `packages/ui/src/base.css` styles `.presets`/`.preset` beyond 4K
font bumps, only Signal Lab's own stylesheet draws the chip look (bordered,
rounded, accent hover, tinted active). Control Lab's choices rendered as bare
default `<button>`s until Reed flagged it. The block is now copied here
verbatim, and circuit-lab looks to have the same gap. Third shared-look rule
living in one app's stylesheet, a candidate for promotion into base.css.

## Small UX finding from Reed (real confusion, worth one line of UI): DONE

Arriving from Circuit Lab's hand-over, Reed expected HIS CIRCUIT's step
(settles at DC gain, zero error) and read the closed-loop 50% steady error as
a bug. The pane title says "closed-loop", but at the moment of arrival the
mental model is the circuit, not the loop. Add a one-line notice shown when
the app loads from a link, near the step view or in the from-link banner:

  "This is the CLOSED LOOP's step - your circuit alone settles at its DC
  gain. Here it is driven by Kp x the error, so proportional control leaves
  1/(1+L(0)) of the input untracked. Switch to PI to erase it."

(Or words to that effect - it should name the number the person is looking
at.) Claim measured per house rules if any number is printed.

---

All earlier items remain resolved.


## FROM REED: the loop diagram should show the circuit ITSELF as the plant: TIERS 1–2 DONE

Reed, after handing an RC low-pass over and being surprised by the closed
loop's 50% error: "maybe we need block diagrams that represent this to
explicitly show how the actual RC circuit fits into the control lab." The
diagram exists. What it lacks is IDENTITY - the P(s) box says "First order
lag", which is true and anonymous. Three tiers, in order:

1. NOW - name the box. The link grammar carries `from=<app>:<id>:<label>`
   (live in packages/ui, tested; Circuit Lab's NEEDS tells them to emit it).
   When the app loaded from a link with provenance: the P(s) box's title
   becomes the circuit's label ("your RC low-pass") with the named plant as
   the subtitle, the from-link banner names it too, and this pairs with the
   arrival-orientation notice already specced below - the two together answer
   the exact confusion Reed hit ("whose step is this, and where is my
   circuit in it?").

2. NEXT - the drive is the point. Annotate the wire INTO the plant box:
   "driven by Kp·(r−y), not by r" when P-control is active - that one label
   is the whole explanation of the steady-state error.

3. LATER (cross-territory, coordinate before starting) - a mini-schematic
   inside the P(s) box: the actual R-and-C drawing. Circuit Lab's Schematic
   component is app-local. Doing this properly means lifting a small
   schematic renderer into packages/ui (the packages agent's territory - file
   back what you need). Do not block tiers 1-2 on this.


## Section order: controller above plant now, not plant first — a traded call, Reed's to revisit

This entry used to argue that plant-above-controller is the right sidebar
order, on the grounds that the sidebar follows DECISION order: the plant is
given, the controller is chosen in response, while the diagram's own
signal-flow order (r → controller → plant → y) reads the other way. That
argument still holds and is recorded here rather than deleted.

The lab now ships the reverse: the controller card sits above the plant
card. The reason is reach, not a finding that decision order was wrong. A
lesson saying "raise Kp" was landing the student on the plant's own Gain K,
because the controller card sat below the fold behind it — a student-review
finding, not a design preference. Controller-first puts the named knob on
screen first, at the cost of the sidebar no longer reading as "the plant is
given, the controller responds."

Both arguments are real, and this agent is not the one who should settle
between them. The call stays open, decided for now in favor of the knob a
student can reach: **Reed's call whether it stands.**

Definitions on contact, at the section headers (not only in lesson terms),
now ship regardless of the order question — one or two sentences apiece in
the house style, under both headers, naming the load-bearing INPUT/OUTPUT
identity that confused Reed after the hand-over:

- Plant: the system you are stuck with, a motor, a tank, a circuit. Its
  input is the drive u, whatever the controller sends, and its output is
  the measured y fed back to it.
- Controller: the block you design. Its input is the error, the reference r
  minus the measured y, and its output is the drive u sent to the plant.

Matching entries joined the terms registry (plant, controller, error,
reference — drive u already had one). They surface through the picker's own
glossary fold (chrome.js's new `SECTION_TERMS`, seeded alongside
`TOPBAR_TERMS` rather than folded into it, so no lesson's own "terms used
here" list grew four entries it never asked for) rather than through every
lesson's terms list, and the glossary scan (verify.mjs item 33, no lesson
loaded) stays green under it.

**Status (control-lab), the loop-diagram tiers (unchanged by the above):**
the arrival notice ships (names the live steady error, switches to "erased
exactly" under an integrator. Shown only while the loop is stable). Tier 1
ships: `from=` provenance flows through stateFromLink, the banner and the
P(s) box carry the circuit's label with the named plant as subtitle, and the
identity sheds when a different plant is chosen. Tier 2 ships: "driven by
Kp·(r − y), not by r" under the plant box while P-control is active. Tier 3
(mini-schematic in the box) awaits the packages agent lifting a schematic
renderer into packages/ui, not started, per the spec.


## Landed by the packages/signal-lab agent (Reed testing live): sticky step axes

Reed hit the axis-chasing disease on the step plot - gain and tau moved the
frame, not the curve. Fixed with BAND QUANTIZATION (apps/control-lab/src/
stepAxis.js + tests): frames snap to a 1-2-5 ladder, hold bit-identical
inside a band, reframe once at a band edge, always contain (a clip reframes
immediately), snap on plant/controller/step-input change. Duration in App,
y-range held inside StepCanvas via resetKey. Note for the archives: the
first fix (hold-until-containment) FAILED its own pixel probe - growth-on-
contain tracks the peak and the trace hugs the top at a constant pixel.
The probe and the ladder are both in the commit. Amend freely - your file,
your app. The Bode frequency axis may deserve the same treatment. Reed has
not asked yet.


## RESOLVED: packages/ui NumField `snap()` now rounds to 4 s.f.

Reed typed 11.25 into the Kp field (the three-lag plant's exact boundary
gain, and the value the "Kp -> 11.25 (on the axis)" chip already sets to
four significant figures via lessons.js's new `round4`) and the field read
back 11.3, `snap()` in packages/ui rounded every typed/eng-formatted value
to three significant figures, one fewer than this lab needed for its own
chip labels to round-trip through the field without drifting. The
coordinator has since changed `snap()` to 4 s.f. in packages/ui (commit
400606c), so the field now reads 11.25 back exactly. The chip-label
rounding fix on this side (round4, 4 s.f., in lessons.js, the
"12.38 -> 12.37 after a click" defect) was already done and tested. Nothing
here assumed 3 s.f., so nothing broke going to 4.


## Small crossing: lesson titles above their notes (Reed, uniform across apps)

The selected lesson's name now renders as an h3.note-title above its note
paragraph (and, in circuit-lab, the circuit's name above its hint) - Reed
asked for it in every module, so all three landed together. Style is shared
from packages/ui base.css. Amend freely.
