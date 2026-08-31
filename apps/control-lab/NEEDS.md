# Needs and findings for the other territories

## Crossed: suite icon links in your index.html head (Reed asked live)

Reed picked a home-screen icon (R with EE subscript over a damped ring,
workshopped on an artifact board). Three lines in your <head>: rel=icon,
apple-touch-icon (both ../icon-*.png — the files live at the deployed site
root, shipped from site/), and theme-color #0d1218. Dev 404s harmlessly.

## Crossed: LabNav suite navigation in your header (Reed asked live)

Reed wanted one-click bounce between the labs and the splash page. Shared
component `LabNav` now lives in `packages/ui` (exported, styled in base.css)
and I placed `<LabNav current="control-lab" />` above your `<h1>` — a one-line
insertion, no other changes. It renders only on the deployed layout
(homeUrl/siblingUrl resolve null on a bare dev port, and the row hides).
Restyle or move it as you see fit; the component itself is ui territory.

## NEW TASK from Reed (via the packages/signal-lab agent): the custom plant

Reed wants every Circuit Lab topology to migrate into this lab exactly. Your
loop machinery already runs on raw {b, a} — the named plants are skins — so
the missing piece is a registry entry:

**Add plant `custom` ("Custom H(s)"):**
- Params: six coefficients, highest power first —
  `b2, b1, b0, a2, a1, a0` — so `tf: (p) => ({ b: [p.b2, p.b1, p.b0],
  a: [p.a2, p.a1, p.a0] })` with leading near-zeros trimmed (a first-order
  circuit arrives with b2 = a2 = 0).
- Link grammar needs nothing new: `plant=custom:b2:b1:b0:a2:a1:a0` is already
  positional numbers. Extend fromLink to accept it (values span decades —
  an RLC's a2 = LC ≈ 1e-10 — so do NOT clamp these to slider ranges; the
  fields are link-fed first, hand-typed second).
- UI: plain numeric fields are fine (log sliders cannot hold signed
  coefficients spanning decades). Hint: this is the raw form every named
  plant reduces to, and how a circuit arrives without approximation.
- Math panel: print H(s) with the numbers, poles via roots(), stability, DC
  gain — with checks measured off the live loop per the house rules. Where a
  custom plant has zeros (twin-T measured across the network), the ζ ≈ PM/100
  rule's preconditions note already covers saying so.
- Tests: a hand-built RLC {b:[1],a:[LC, RC, 1]} through `custom` must produce
  the SAME margins/step as the same circuit through the named secondOrder
  mapping — exactness is the whole point, so assert equality, not closeness.

Circuit Lab's NEEDS carries the emitting half; coordinate the param order
with them (it is specified identically in both files).

**Status: accepted — in progress in control-lab** (this agent), same param
order as specified.

---

## FYI for circuit-lab (and packages): the preset chips are unstyled outside Signal Lab

Nothing in `packages/ui/src/base.css` styles `.presets`/`.preset` beyond 4K
font bumps — only Signal Lab's own stylesheet draws the chip look (bordered,
rounded, accent hover, tinted active). Control Lab's choices rendered as bare
default `<button>`s until Reed flagged it; the block is now copied here
verbatim, and circuit-lab looks to have the same gap. Third shared-look rule
living in one app's stylesheet — a candidate for promotion into base.css.

## Small UX finding from Reed (real confusion, worth one line of UI) — DONE

Arriving from Circuit Lab's hand-over, Reed expected HIS CIRCUIT's step
(settles at DC gain, zero error) and read the closed-loop 50% steady error as
a bug. The pane title says "closed-loop", but at the moment of arrival the
mental model is the circuit, not the loop. Add a one-line notice shown when
the app loads from a link, near the step view or in the from-link banner:

  "This is the CLOSED LOOP's step - your circuit alone settles at its DC
  gain; here it is driven by Kp x the error, so proportional control leaves
  1/(1+L(0)) of the input untracked. Switch to PI to erase it."

(Or words to that effect - it should name the number the person is looking
at.) Claim measured per house rules if any number is printed.

---

All earlier items remain resolved.


## FROM REED: the loop diagram should show the circuit ITSELF as the plant — TIERS 1–2 DONE

Reed, after handing an RC low-pass over and being surprised by the closed
loop's 50% error: "maybe we need block diagrams that represent this to
explicitly show how the actual RC circuit fits into the control lab." The
diagram exists; what it lacks is IDENTITY - the P(s) box says "First order
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
   component is app-local; doing this properly means lifting a small
   schematic renderer into packages/ui (the packages agent's territory - file
   back what you need). Do not block tiers 1-2 on this.


## FROM REED: say why plant comes first, and define both terms at their headers

Reed asked whether plant-above-controller is the right sidebar order. It is —
but for a reason the UI keeps to itself, so state it. Two orders exist:
signal-flow order (r → controller → plant → y, what the diagram draws) and
DECISION order (the plant is given, the controller is chosen in response —
what the sidebar walks). The sidebar rightly follows decision order; one line
under each section header makes the choice legible instead of accidental.

Definitions on contact, at the section headers (not only in lesson terms),
each one or two sentences in the house style. The load-bearing content is the
INPUT/OUTPUT identity, because it is exactly what confused Reed after the
hand-over:

- PLANT: the system you are stuck with — a motor, a tank, a circuit. Its
  input is the DRIVE u (whatever the controller sends); its output is the
  measured y that gets fed back. When a circuit arrives from Circuit Lab,
  the circuit IS the plant: its input port becomes u — driven by the
  controller, not by your reference — and its output node becomes y. (This
  is the other half of the arrival-orientation notice already specced.)
- CONTROLLER: the block you get to design. Its input is the error r − y;
  its output is the drive u. It never sees the reference or the plant
  directly — only how far apart they are.

Add matching entries to the terms registry (plant, controller, drive u,
error e = r−y, reference r) so lessons can reference them, with the usual
tests: referenced ⇒ defined, defined ⇒ surfaced. Claims stay prose here —
these are definitions, not measurements — but the u-not-r fact is the same
one tier 2 of the diagram task annotates on the wire; keep the wording
consistent between the two.

**Status (control-lab):** the arrival notice ships (names the live steady error,
switches to "erased exactly" under an integrator; shown only while the loop is
stable). Tier 1 ships: `from=` provenance flows through stateFromLink, the
banner and the P(s) box carry the circuit's label with the named plant as
subtitle, and the identity sheds when a different plant is chosen. Tier 2
ships: "driven by Kp·(r − y), not by r" under the plant box while P-control is
active. Tier 3 (mini-schematic in the box) awaits the packages agent lifting a
schematic renderer into packages/ui — not started, per the spec.


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
your app. The Bode frequency axis may deserve the same treatment; Reed has
not asked yet.


## Small crossing: lesson titles above their notes (Reed, uniform across apps)

The selected lesson's name now renders as an h3.note-title above its note
paragraph (and, in circuit-lab, the circuit's name above its hint) - Reed
asked for it in every module, so all three landed together. Style is shared
from packages/ui base.css. Amend freely.
