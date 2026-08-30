# Review playbook — what Reed's review actually caught

Distilled from several days of Reed using Signal Lab as a student would and
filing what he hit. Every item below is a **class of defect that shipped and
was found by a person**, generalized so you can hunt it in your own app before
he does. Work through these as an audit checklist, not as reading.

## 1. Sentences frozen while controls move

The low-pass hint said "12 dB per octave" while an Order select beside it said
1st or 4th. The Q prediction stayed `= Q` after the type select switched to
band-pass. **Every explanatory sentence must follow every control that can
change its fact** — hints may be functions of params; predictions must branch
on type/order/mode; where a control invalidates a claim, the row footnotes the
reason instead of showing ✗ against correct physics. Audit: for each sentence
near a control, wiggle the control and re-read the sentence.

## 2. Lead with the base rule, then multiply

"12 dB/octave (40 dB/decade) — that is 6 dB/octave, 20 dB/decade, times the
filter order" was still wrong the first time: it buried the rule under its own
arithmetic. The final form Reed accepted: **state the 1st-order rule first,
then apply it to this instance's number.** And always give BOTH unit systems
(per-octave and per-decade; degrees and radians where relevant).

## 3. Phase everywhere magnitude is discussed — but measure before printing

Magnitude-only descriptions of filters are half-descriptions. Add the phase
value at the corner AND the transition slope, both unit systems. But the trap:
the "obvious" per-order slope figure at the corner is FALSE — it depends on
each section's Q (−191°/dec for one Q=0.707 biquad, not 2×66°). Only the Bode
straight-line rule has a clean per-order number, so quote that, **labelled as
the approximation it is**. Rule: never print a number you have not first
computed from the running code. The exact facts (45°×order at the corner) were
only claimed after a script verified them to nine decimals.

## 4. Axes: named, united, and able to hold their content

Four axis defects shipped: a view with NO axis at all (convolution), an axis
with numbers but no units (group delay — samples), a y-axis with a quantity
but no units (linear amplitude), and a **fixed range the content escaped**
(the dB ceiling at +10 while a Q=20 peak sat at +26 — the one feature the
lesson existed to show was off-screen). Audit every plot: quantity? units?
range that adapts when the chain demands it? And ranges that adapt must not
fidget: the frequency axis is *sticky* while components are tuned (the curve
moves, not the labels) and re-frames only on circuit change or when the
feature nears the edge.

## 5. Can the lesson's feature actually be SEEN?

The Beating note said "the spectrum shows two lines" while the screen showed
one blob — the tones were 1.3 FFT bins apart, genuinely unresolved, not just
small. Check the *resolution arithmetic* behind every visual claim (bins,
mainlobe widths, pixels per feature), and when the honest answer is "not at
this frame length / not at this zoom", change the preset's parameters and give
the user the control (frame length, axis zoom).

## 6. Rendering honesty

- **Data vs interpolation:** at 2 samples/cycle the scope drew a sine as a
  triangle. Correct rendering, catastrophic pedagogy. Sparse samples now draw
  as bright dots — the dots are the signal, the lines a guide — and the note
  says so.
- **Mixed scales must confess:** a kernel drawn magnified next to the signal
  now says "kernel drawn ×6.1".
- **Occlusion:** the convolution product bars — the entire point of that view —
  were invisible behind same-position stems. If two things share coordinates,
  give them different widths/weights and check a screenshot.
- **Density:** a 400-tap kernel as stems over noise is spray; past ~48 points
  a thin curve reads as the envelope it is.

## 7. Structure the student can see and steer

- Long button lists fold to group headers; the ACTIVE item's group cannot be
  folded away. (This broke the harness — folded buttons aren't clickable — so
  the harness must unfold like a person would.)
- Parameters BEFORE math in a card: set fc/order/Q, then unfold what it means.
- If a lesson says "switch the block to X", that must be one click (in-place
  type select, shared params surviving), not delete-and-re-add.
- The signal path is a picture: sources ADD into Σ, blocks CASCADE, output at
  the end — a real block diagram on demand, boxes clickable to their cards.
- Transport controls behave like players: play at the end restarts; speed is
  adjustable; loading a lesson resets the scrubber.

## 8. Definitions on contact

Every term a lesson leans on (dB, bin, Q, Nyquist, LTI…) is defined in a
folded "Terms used here" panel under the note — costs nothing to those who
know them. Registry in `apps/signal-lab/src/terms.js`; tests enforce that
every referenced term is defined and every definition is surfaced somewhere.
Copy the pattern rather than reinventing it.

## 9. Foundations explicit, and measured part by part

LTI got its own early lesson because everything downstream rests on it. The
pattern Reed asked for and approved: **define each property separately**
(linear = superposition + scaling — Reed's preferred names; time-invariance = no clock), give each its
own formula, its own "why it matters" sentence, and its own machine-exact
check row measured on the live chain — then combine them into the consequence
(sines are eigenfunctions). Name measurement floors honestly: the residual
energy off-frequency is the Hann window's sidelobes, and the row says so
instead of pretending the floor is zero.

## 10. Exhibits must not lie quietly

The convolution view's dot-product kernel was silently truncated at 0.05 s; a
long-ringing filter made its two "equal" numbers differ by 31% with no flag —
on the one view whose entire message is that they are equal. Size buffers by
the chain's actual settle time, and when even the cap truncates, SAY SO in the
readout. Generalized: any place two numbers are shown as equal, ask what could
make them differ silently, and either remove the cause or surface it.

## 11. Process

- **Screenshot, then read it like a student.** Nearly half of these defects
  were invisible to the test suite and obvious in a picture. Shoot every view
  configuration after a change; look at axes, occlusion, clipping.
- When a check fails, first decide whether the app or the test is wrong — it
  has been the test several times, and the commit should say so.
- Own clone, stage by path, `git pull --rebase` before push (see your brief).
- Every fix lands with the test that would have caught it.
