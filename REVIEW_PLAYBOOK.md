# Review playbook: what Reed's review caught

Distilled from several days of Reed using Signal Lab as a student would and filing
what he hit. Every item below is a **class of defect that shipped and was found by a
person**, generalized so you can hunt it in your own app first. Work through these as
an audit checklist rather than as reading.

## 1. Sentences that do not follow their controls

The low-pass hint said "12 dB per octave" while an Order select beside it said 1st or
4th. The Q prediction still said `= Q` after the type select switched to band-pass.
**Every explanatory sentence must follow every control that can change its fact.**
Hints may be functions of params. Predictions must branch on type, order and mode.
Where a control invalidates a claim, the row footnotes the reason instead of showing ✗
against correct physics. Audit: for each sentence near a control, move the control and
re-read the sentence.

## 2. State the base rule before applying it

This hint was still wrong, because it buried the rule under its own arithmetic:

> 12 dB/octave (40 dB/decade) — that is 6 dB/octave, 20 dB/decade, times the
> filter order

The form Reed accepted states the first-order rule first, then applies it to this
instance's number. Always give both unit systems: per-octave and per-decade, and degrees
and radians where relevant.

## 3. Phase wherever magnitude is discussed, and measured before printing

A magnitude-only description of a filter is half a description. Add the phase value at
the corner and the transition slope, in both unit systems. The trap: the obvious
per-order slope figure at the corner is false, because it depends on each section's Q.
One Q = 0.707 biquad gives −191°/decade, not 2 × 66°. Only the Bode straight-line rule
has a clean per-order number, so quote that and label it as the approximation it is.
Never print a number you have not computed from the running code. The exact facts
(45° × order at the corner) were claimed only after a script verified them to nine
decimals.

## 4. Axes: named, united, and sized to their content

Four axis defects shipped. A view had no axis at all (convolution). An axis had numbers
but no units (group delay, in samples). A y-axis had a quantity but no units (linear
amplitude). A fixed range let the content escape it: the dB ceiling sat at +10 while a
Q = 20 peak reached +26, so the one feature the lesson existed to show was off screen.

Audit every plot for its quantity, its units, and a range that adapts when the chain
demands it. A range that adapts must not fidget. The frequency axis stays fixed while
components are tuned, so the curve moves and the labels do not. It re-frames only on a
circuit change, or when the feature nears the edge.

## 5. Whether the lesson's feature can be seen

The Beating note said "the spectrum shows two lines" while the screen showed one blob.
The tones were 1.3 FFT bins apart, genuinely unresolved rather than merely small. Check
the resolution arithmetic behind every visual claim: bins, mainlobe widths, pixels per
feature. When the honest answer is "not at this frame length" or "not at this zoom",
change the preset's parameters and give the reader the control, such as frame length or
axis zoom.

## 6. Rendering that matches the data

- **Data against interpolation.** At 2 samples per cycle the scope drew a sine as a
  triangle. The rendering was correct and the pedagogy was not. Sparse samples now draw
  as bright dots, the dots are the signal and the lines are a guide, and the note says
  so.
- **Mixed scales are stated.** A kernel drawn magnified beside the signal now says
  "kernel drawn ×6.1".
- **Occlusion.** The convolution product bars, which are the point of that view, were
  invisible behind same-position stems. When two things share coordinates, give them
  different widths or weights and check a screenshot.
- **Density.** A 400-tap kernel drawn as stems over noise is spray. Past about 48
  points, a thin curve reads as the envelope it is.

## 7. Structure the student can see and steer

- Long button lists fold to group headers, and the active item's group cannot be folded
  away. This broke the harness, because folded buttons are not clickable, so the
  harness now unfolds them the way a person would.
- Parameters come before math in a card: set fc, order and Q, then unfold what they
  mean.
- If a lesson says "switch the block to X", that must be one click. Use an in-place type
  select that keeps the shared params, not a delete and re-add.
- The signal path is a picture. Sources add into Σ, blocks cascade, and the output sits
  at the end. It is a real block diagram on demand, with boxes that open their cards.
- Transport controls behave like a player. Play at the end restarts, speed is
  adjustable, and loading a lesson resets the scrubber.

## 8. Definitions on contact

Every term a lesson leans on (dB, bin, Q, Nyquist, LTI) is defined in a folded "Terms
used here" panel under the note, which costs nothing to a reader who knows them. The
registry is `apps/signal-lab/src/terms.js`, and tests require every referenced term to
be defined and every definition to be surfaced somewhere. Copy the pattern rather than
reinventing it.

## 9. Foundations defined and measured part by part

LTI got its own early lesson because everything downstream rests on it. The pattern
Reed asked for and approved is to **define each property separately**. Linear means
superposition plus scaling, which are Reed's preferred names, and time-invariance means
no clock. Each gets its own formula, its own sentence on why it matters, and its own
machine-exact check row measured on the live chain. Then combine them into the
consequence, that sines are eigenfunctions. Name measurement floors accurately: the
residual energy off-frequency is the Hann window's sidelobes, and the row says so rather
than implying the floor is zero.

## 10. Exhibits that hide a difference

The convolution view's dot-product kernel was truncated at 0.05 s without saying so. A
long-ringing filter made its two "equal" numbers differ by 31 % with no flag, on the one
view whose whole message is that they are equal. Size buffers by the chain's actual
settle time, and when even the cap truncates, say so in the readout. Generally:
wherever two numbers are shown as equal, ask what could make them differ silently, then
remove the cause or surface it.

## 11. Process

- **Screenshot, then read it as a student would.** Nearly half of these defects were
  invisible to the test suite and obvious in a picture. Shoot every view configuration
  after a change, and look at axes, occlusion and clipping.
- When a check fails, first decide whether the app or the test is wrong. It has been
  the test several times, and the commit should say which.
- Own clone, stage by path, and `git pull --rebase` before push. See your brief.
