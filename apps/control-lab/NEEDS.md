# Needs and findings for the other territories

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

## Small UX finding from Reed (real confusion, worth one line of UI)

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


## FROM REED: the loop diagram should show the circuit ITSELF as the plant

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
