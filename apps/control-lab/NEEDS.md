# Needs and findings for the other territories

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
--bg well > --panel-2 widgets). Your sidebar adopted it without edits. A screenshot verified the result. Shout if any custom layout fights it.
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
- Params: six coefficients in descending power order, `b2, b1, b0, a2, a1, a0`. Use `tf: (p) => ({ b: [p.b2, p.b1, p.b0],
  a: [p.a2, p.a1, p.a0] })` with leading near-zeros trimmed. A first-order circuit arrives with b2 = a2 = 0.
- Link grammar needs nothing new: `plant=custom:b2:b1:b0:a2:a1:a0` is already
  positional numbers. Extend fromLink to accept it. Values span decades, with an RLC's a2 = LC ≈ 1e-10. Do not clamp them to slider ranges. The fields primarily receive links and also accept typed values.
- UI: plain numeric fields are fine (log sliders cannot hold signed
  coefficients spanning decades). Hint: this is the raw form every named
  plant reduces to, and how a circuit arrives without approximation.
- Math panel: print H(s) with its numbers, poles via roots(), stability, and DC gain. Measure checks from the live loop under the house rules. Where a
  custom plant has zeros (twin-T measured across the network), the ζ ≈ PM/100
  rule's preconditions note already covers saying so.
- Tests: send a hand-built RLC {b:[1],a:[LC, RC, 1]} through `custom` and the named secondOrder mapping. Assert equal margins and step responses. Exactness requires equality, not closeness.

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
mental model is the circuit, not the loop. On arrival from a link, add a notice near the step view or in the from-link banner:

  "This is the CLOSED LOOP's step - your circuit alone settles at its DC
  gain. Here it is driven by Kp x the error, so proportional control leaves
  1/(1+L(0)) of the input untracked. Switch to PI to erase it."

Equivalent wording should name the number on screen. Measure any printed number under the house rules.

---

All earlier items remain resolved.

## FROM REED: the loop diagram should show the circuit ITSELF as the plant: TIERS 1–2 DONE

The closed loop's 50% error surprised Reed after handing over an RC low-pass. He requested a block diagram showing how the RC circuit fits into Control Lab. The
diagram exists. What it lacks is IDENTITY - the P(s) box says "First order
lag", which is true and anonymous. Three tiers, in order:

1. NOW - name the box. The link grammar carries `from=<app>:<id>:<label>`
   (live in packages/ui, tested; Circuit Lab's NEEDS tells them to emit it).
   When a link supplies provenance, use the circuit label ("your RC low-pass") as the P(s) box title. Put the named plant in its subtitle. Name the circuit in the from-link banner too. Together with the arrival notice specified below, this explains whose step is shown and where the circuit fits.

2. NEXT - the drive is the point. Annotate the wire INTO the plant box:
   "driven by Kp·(r−y), not by r" when P-control is active - that one label
   is the whole explanation of the steady-state error.

3. LATER (cross-territory, coordinate before starting) - a mini-schematic
   inside the P(s) box: the actual R-and-C drawing. Circuit Lab's Schematic
   component is app-local. Doing this properly means lifting a small
   schematic renderer into packages/ui (the packages agent's territory - file
   back what you need). Do not block tiers 1-2 on this.

## Section order: controller above plant, subject to Reed's review

This entry previously argued for placing the plant above the controller in the sidebar. That follows decision order. The plant is given, and the controller is chosen in response. The diagram's signal-flow order (r → controller → plant → y) runs the other way. That
argument still holds and is recorded here rather than deleted.

The lab now ships the reverse: the controller card sits above the plant
card. The reason is reach, not a finding that decision order was wrong. A
lesson saying "raise Kp" was landing the student on the plant's own Gain K,
because the controller card sat below the fold. This was a student-review finding, not a design preference. Controller-first puts the named knob on
screen first, at the cost of the sidebar no longer reading as "the plant is
given, the controller responds."

Both arguments are real, and this agent is not the one who should settle
between them. The call stays open, decided for now in favor of the knob a
student can reach: **Reed's call whether it stands.**

Definitions now appear under both section headers, independently of the order decision. Each uses one or two sentences in the house style. They explain the input/output identities that confused Reed after the hand-over:

- Plant: the system you are stuck with, a motor, a tank, a circuit. Its
  input is the drive u, whatever the controller sends, and its output is
  the measured y fed back to it.
- Controller: the block you design. Its input is the error, the reference r
  minus the measured y, and its output is the drive u sent to the plant.

The terms registry gained plant, controller, error, and reference. Drive u already had an entry. The picker exposes these through its glossary fold. In chrome.js, the new `SECTION_TERMS` is seeded alongside `TOPBAR_TERMS`. Individual lesson term lists remain unchanged. The glossary scan passes in verify.mjs item 33 with no lesson loaded.

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
frame, not the curve. The fix uses band quantization in `apps/control-lab/src/stepAxis.js`, with tests. Frames snap to a 1-2-5 ladder and remain bit-identical within each band. They reframe at band edges or immediately to prevent clipping. Plant, controller, and step-input changes reset the frame. Duration in App,
y-range held inside StepCanvas via resetKey.

Note for the archives: the
first fix (hold-until-containment) FAILED its own pixel probe - growth-on-
contain tracks the peak and the trace hugs the top at a constant pixel.
The probe and the ladder are both in the commit. Amend freely - your file,
your app. The Bode frequency axis may deserve the same treatment. Reed has
not asked yet.

## RESOLVED: packages/ui NumField `snap()` now rounds to 4 s.f.

Reed typed 11.25 into the Kp field, but it displayed 11.3. The value is the three-lag plant's exact boundary gain. The "Kp -> 11.25 (on the axis)" chip already sets it through lessons.js's four-figure `round4`. In packages/ui, `snap()` rounded typed and engineering-formatted values to three significant figures. The chip labels required four to survive a round trip.

The coordinator has since changed `snap()` to 4 s.f. in packages/ui (commit
400606c), so the field now reads 11.25 back exactly. The chip-label
rounding fix on this side (round4, 4 s.f., in lessons.js, the
"12.38 -> 12.37 after a click" defect) was already done and tested. Nothing
here assumed 3 s.f., so nothing broke going to 4.

## Small crossing: lesson titles above their notes (Reed, uniform across apps)

The selected lesson's name now renders as h3.note-title above its note paragraph. Circuit Lab also shows the circuit's name above its hint. Reed requested this in every module, so all three changes landed together. Style is shared
from packages/ui base.css. Amend freely.
