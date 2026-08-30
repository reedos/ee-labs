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
