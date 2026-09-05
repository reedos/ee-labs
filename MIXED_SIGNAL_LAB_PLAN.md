# Mixed-Signal Lab: the plan

Tier 4 of `ANALOG_ROADMAP.md`. Circuits with a clock, where the answer is a sequence
rather than a waveform. The interaction model changes: a schematic whose switches
move with the phase, a scrub through one clock period, and an output that is a
sequence of samples. Splash glyph `⧖`, directory `apps/mixed-signal-lab`, engine as
`packages/switched` and `packages/dsp` together, plus one event that `packages/network`
today declines.

The path, in order. Sampling as a circuit. Switched-capacitor circuits and their exact
H(z). Converters and their static errors. Converters and their dynamic errors. Noise
shaping. Clocks. Then the chopper and the auto-zero amplifier, solved as the switched
circuits they are.

This is a draft (2026-09-05) for Reed to settle. §0 lists what needs a decision. §1 is
the progression map, and it names every idea this lab leans on with the experiment
that teaches it. Most of those experiments are not built yet. Each such row is a
**dependency** with a named blocker, mirrored in `BACKLOG.md`, and no lesson here
references an experiment that does not exist.

The two rules that govern the other labs govern this one with no exemption. **Every
explanatory sentence is a claim about physics, and a test must measure it.** And
`CORE_SCOPE.md` decides what the engine may state exactly, what it may approximate
behind a guard, and what it declines with a reason. This lab is where one of the
suite's existing refusals becomes a feature, and §2.2 is written so that the refusal's
message and the new event agree on where the boundary lies.

---

## 0. Open decisions

### Decision 1: the name (recommended: Mixed-Signal Lab)

`ANALOG_ROADMAP.md` §1 and `EE_LABS_MAP.md` both use it. LabNav short form
**"Mixed-Signal"**. The splash card names the path in one line: "the sample-and-hold,
the switched-capacitor filter, the converter, the modulator, the clock".

Alternatives considered. *Converters Lab* names four of the seven groups. *Sampled
Circuits Lab* is accurate and is not what a catalogue calls the course.

### Decision 2: where the charge-conservation event lives

`ANALOG_ROADMAP.md` §4 puts it in `packages/switched`. `PROGRAM.md` §5 records that
package's owner as the Power Lab owner, who is not in this program. The event needs
`packages/network`'s netlist, its MNA stamps and its `dynamics` refusal tests, none of
which `packages/switched` imports today.

Recommended: **`packages/switched` gains a dependency on `packages/network`, and the
event goes there**, in a new `charge.js`. The alternative, putting it in
`packages/network` beside `dynamics.js`, would put a clock in the package that has no
clock. The director resolves the ownership, because it crosses two packages neither of
which this lab owns.

### Decision 3: how many clock phases the model carries

Two-phase non-overlapping clocking covers every circuit in Groups A, B, G and most of
C. Four phases appear in bottom-plate sampling and in some pipeline stages.
Recommended: **an arbitrary number of named phases with a non-overlap interval**, and
two as the default. The extra generality costs one array and removes a whole class of
special cases.

### Decision 4: whether the eye diagram ships here

`PROGRAM.md` §4 names the Communications Lab as the first lab for the constellation
and eye diagram, and this lab as the second. The Communications Lab is waiting on the
Random Signals Lab and has no plan file. This lab's D5 wants an eye of the sampled
output against the clock.

Recommended: **defer the eye view and ship D5 with the sampled-output view alone**.
A `BACKLOG.md` line reopens it when the Communications Lab lands. Nothing else in the
lab needs it. Building a canvas whose first lab has no plan would fix its props to the
wrong needs.

### Decision 5: whether the delta-sigma modulator's linear model is a separate object

The quantiser is nonlinear, so its additive-noise replacement is a different object,
not a view of the same one. Recommended: **a separate labelled object beside the exact
switched run, never substituted for it**, as `CORE_SCOPE.md` Rule 1 requires of every
approximation. The pane shows both traces at once, and E1 is the experiment where they
part company.

---

## 1. The progression map

This section lists every idea the lab leans on, the experiment that teaches it, and
whether that experiment is built. The lab sits four tiers above the built suite, so
most rows are dependencies. A dependency row names the lab, the experiment and the
branch it is being built on. `BACKLOG.md` carries the same rows.

| Idea the lab leans on | Needed by | Taught at | Status |
| --- | --- | --- | --- |
| The capacitor as a state, charge and energy | A1, B1 | Elements F1 to F5 | built |
| The switch, and the spark when its current has nowhere to go | A1, §2.2 | Elements F6, Power Lab A2 | built |
| The op-amp as a black box, the virtual ground | B2 to B6 | Elements E1 to E3 | built |
| The Schmitt trigger and hysteresis | F2 | Elements E9 | built |
| H(s), poles and zeros, Q | B6, F4 | Circuit Lab, 15 experiments | built |
| Sampling, aliasing, Nyquist, resolution, leakage | A1, A5, E6 | Signal Lab Sampling group, 7 | built |
| The z-plane, the FIR kernel, zeros on the circle | B4, E6 | Signal Lab FIR group, 7 | built |
| The biquad from (mode, `f_0`, Q), and its exact H(z) | B5, B6 | Signal Lab Filters group | built |
| A 4-bit quantiser as a preset | E1 | Signal Lab Nonlinearity group | built |
| Loop gain, margins, the root locus | F3, F4 | Control Lab, 13 experiments | built |
| Switching events located on an exact solution | A1, B1, G1 | Power Lab A, B, E | built |
| The switched converter's periodic steady state | B2, E4 | Power Lab B, `packages/switched` | built |
| Thermal noise, `kT/C`, the noise bandwidth | A4, B6, G4 | Electronics O2 | **dependency, `lab/electronics-lab`** |
| The MOSFET as a switch with `R_on` | A1, A2 | Electronics D5 | **dependency, `lab/electronics-lab`** |
| Channel charge, `C_ox`, `W L` | A2, A3 | Electronics D4, Analog IC A1 | **dependency, tiers 1 and 3** |
| The op-amp from the inside, its gain and its slew | B6, D1, D2 | Electronics M1 to M4 | **dependency, `lab/electronics-lab`** |
| The comparator, the latch, metastability | C4, D3 | Analog IC F1 to F4 | **dependency, tier 3** |
| Pelgrom's law as a matching sigma | C3, C6 | Analog IC A4, A5 | **dependency, tier 3** |
| The two-stage amplifier's settling and its `f_t` | D1, D2 | Analog IC C3, E1 | **dependency, tier 3** |
| The chopper as a labelled averaged model | G1 | Applied Analog C4 | **dependency, tier 2** |
| The anti-aliasing filter designed to a spec | A5, E5 | Applied Analog E5 | **dependency, tier 2** |
| Monte Carlo over any parameter, and yield | C3, C6 | Applied Analog §2.4 | **dependency, tier 2** |
| Charge conservation at a switch event | A2, B1 to B6, G | nowhere, declined today | **new here, §2.2** |
| The exact H(z) of a switched-capacitor network | B2 to B6 | nowhere | **new here, §2.3** |
| A quantiser as a block, and the delta-sigma loop | E1 to E6 | nowhere | **new here, §2.5** |
| The phase-domain PLL model | F1 to F5 | nowhere | **new here, §2.6** |

Three things the map shows that this plan does not fix, so that they are decisions
rather than omissions. **This lab depends on three tiers**, and the phasing in §9
starts after all three gates. **The eye diagram** is Decision 4, deferred with its
backlog line. **The constellation** is not needed here at all, and its absence is
recorded so that the Communications Lab does not wait on this lab for it.

The order of the groups follows the map. Nothing in a group leans on an experiment
that comes later in this lab.

---

## 2. The engine: an event, an exact H(z), and a loop with a quantiser in it

### 2.1 What exists, and what is missing

`packages/switched` already walks a period, locates events on the exact solution by
bisection, and propagates a linear circuit between them. `packages/dsp` already has
the FFT, the biquad, the FIR filter and a chain. `packages/network` already has the
MNA stamps and `dynamics`. Four things are missing.

| Need | Today | This plan |
| --- | --- | --- |
| A state jump at a switch event | states carry over unchanged | `chargeEvent(net, x)` (§2.2) |
| The exact H(z) of a switched-capacitor network | nothing | `hzOf(scNet, ports)` (§2.3) |
| Named clock phases on a netlist | switch states per segment | `scNetwork(net, clock)` (§2.4) |
| A quantiser as a block, and a modulator loop | a 4-bit preset in Signal Lab | `quantiser`, `modulator` (§2.5) |
| The PLL in the phase domain | nothing | `pllPhase(params)` (§2.6) |

### 2.2 Charge conservation at a switch event

#### What the suite says today

`packages/network/src/dynamics.js` rewraps a resistive refusal as a dynamic one. When
a capacitor sits in a loop of voltage sources or of other capacitors with no
resistance, it raises `NetworkError('state-loop')` with this message, quoted here
exactly as the source holds it:

```
C1 sits in a loop of voltage sources (or other capacitors) with no resistance in it,
so its voltage is dictated rather than free: it cannot be a state. Its current would
be C·dv/dt of the source itself — infinite at any step. Every real source has some
series resistance; put it in.
```

`pwlTransient`'s own contract says the complementary thing. At an event "the states
carry straight over", because a capacitor's voltage and an inductor's current are
continuous through any switching. Two ideal capacitors shorted together at an instant
break that sentence, and the two statements together fix the boundary this lab has to
respect.

#### Where the boundary is

The refusal's operative clause is **"with no resistance in it"**. Three cases follow,
and the engine handles each differently.

1. **A switch with `ron > 0` closes.** There is resistance in the loop. No refusal is
   raised, `dynamics` builds the ordinary state space, and the redistribution is an
   exponential with `τ = R_on·C₁C₂/(C₁ + C₂)`. Nothing new is needed.
2. **An ideal switch closes, and the loop contains only capacitors.** The refusal's own
   conclusion is what the engine now acts on. The looped capacitors "cannot be states",
   so the engine stops treating them as independent states and finds the one state they
   share. The current is unbounded, exactly as the message says. The **charge** is not,
   and the charge is what `chargeEvent` computes.
3. **A loop contains an independent voltage source.** The refusal stands, with its
   message unchanged. There is nothing to conserve, because the source supplies charge
   for as long as the loop exists. `chargeEvent` re-raises `state-loop` in this case,
   and a test pins that the message is byte-for-byte the one `dynamics.js` already
   gives.

The message and the event therefore agree on the boundary in both directions. Where
the message says a capacitor cannot be a state, the event removes it as a state. Where
the message says the current is unbounded, the event supplies a charge and not a
current. And the one word that carries the boundary, "resistance", separates case 1
from case 2 with no threshold and no tolerance.

#### The event

```js
/**
 * The state jump at an instant where ideal switches create zero-resistance
 * loops of capacitors.
 *
 * Let x be the capacitor voltages in `dynamics`'s order, C = diag(C_k), and B
 * the loop matrix of the zero-resistance capacitor loops in the post-event
 * netlist (one row per independent loop, entries +1, -1 and 0). An impulsive
 * current can flow only around those loops, so the charge delivered lies in the
 * row space of B. That single fact fixes the answer:
 *
 *     x+ = x- − C⁻¹ Bᵀ (B C⁻¹ Bᵀ)⁻¹ B x−
 *     dq = −Bᵀ (B C⁻¹ Bᵀ)⁻¹ B x−
 *
 * B x+ = 0, so every loop constraint holds. dq lies in the loops, so the charge
 * on every node outside them is untouched. Both are exact.
 *
 * @param net  the post-event netlist, switches in their new positions
 * @param x    the pre-event state vector
 * @returns {{
 *   loops:  number[][],   // B
 *   x:      number[],     // x+
 *   dq:     number[],     // coulombs into each capacitor, impulsive
 *   basis:  number[][],   // an orthonormal basis of ker B, the reduced state
 *   merged: Array<{ ids: string[], c: number, v: number }>,
 *   energy: number        // joules into the switches, never negative
 * }}
 * @throws NetworkError('state-loop') when a loop contains an independent
 *         voltage source, with dynamics.js's own message.
 */
export function chargeEvent(net, x)
```

`basis` matters as much as `x`. After the event the loop is still closed, so the
looped capacitors stay dependent for the whole of the next segment. The engine hands
`dynamics` the reduced netlist, in which each loop's capacitors are one merged state
with `merged[k].c` the series or parallel combination. `dynamics` then finds no
capacitor loop and raises nothing, which is the second way the message and the event
agree. The message says the circuit has fewer states than it has capacitors, and after
the event it does.

#### The numbers

Two 1.00 pF capacitors, one at 1.000 V and one at 0 V, shorted by an ideal switch.
The shared voltage is 0.500 V. The charge before and after is 1.00 pC. The energy
before is 0.500 pJ and after is 0.250 pJ, so 0.250 pJ goes into the switch, which is
50.0 % of the total and does not depend on `R_on`. With 1.00 pF at 1.000 V into
4.00 pF at 0 V the shared voltage is 0.200 V and 0.400 pJ is lost, which is 80.0 %.

CORE_SCOPE: the event is **exact**, and it is admitted with no hedge. It is not an
approximation of the finite-`R_on` circuit. It is the answer for the ideal switch, and
the finite-`R_on` circuit converges to it. Invariant 3 of §2.8 is that convergence.

### 2.3 The exact H(z) of a switched-capacitor network

#### The integrator, derived

Take the parasitic-insensitive integrator: a sampling capacitor `C₁`, an integrating
capacitor `C₂` across an op-amp whose inverting input is a virtual ground, and a
two-phase non-overlapping clock. Write `v_o(n)` for the output at the end of φ1 in
period `n`.

During φ1 the left plate of `C₁` connects to `v_in` and its right plate to ground, so
its charge is `q₁ = C₁ v_in(n)`. `C₂` is isolated from it, so `v_o` holds. During φ2
both plates of `C₁` connect to ground and to the virtual ground, so both sit at zero
and `C₁` must end with no charge. The event of §2.2 moves that charge, and the only
loop available carries it into `C₂`. Charge conservation on the summing node gives

```
q₂(n + 1) = q₂(n) + C₁ v_in(n)
v_o(n + 1) = v_o(n) + (C₁/C₂) v_in(n)          (plates crossed on φ2)
v_o(n)     = v_o(n − 1) + (C₁/C₂) v_in(n − 1)
```

so that

```
H(z) = (C₁/C₂) · z⁻¹/(1 − z⁻¹) = (C₁/C₂) / (z − 1)          the delaying integrator
H(z) = −(C₁/C₂) / (1 − z⁻¹)   = −(C₁/C₂) · z/(z − 1)        the delay-free integrator
```

The delay-free form transfers the charge in the phase that samples it, so its
difference equation reads `v_o(n) = v_o(n − 1) − (C₁/C₂) v_in(n)`. Both are exactly
rational in z with real coefficients, so both are admitted to `@ee-labs/systems` in
full, with no hedge.

The frequency response follows without approximation:

```
H(e^{jωT}) = (C₁/C₂) · e^{−jωT/2} / (2j sin(ωT/2))
|H| = (C₁/C₂) / (2 sin(ωT/2)),      arg H = −90° − (ωT/2)
```

The continuous integrator built from the switched-capacitor resistor
`R_eq = 1/(C₁ f_s)` has `|H_c| = (C₁/C₂)/(ωT)` and `arg H_c = −90°`. The ratio is
`(ωT/2)/sin(ωT/2)`, which is the whole of the approximation. At 20 samples per cycle
it is 0.412 % in magnitude and 9.00° in phase, at 10 samples per cycle 1.664 % and
18.0°, and at 5 samples per cycle 6.896 % and 36.0°.

The extra phase is exactly half a sample period. That is the same half-sample the
Control Lab II lab meets in the zero-order hold.

#### The biquad, derived

The two-integrator loop with capacitor ratios `K₁` to `K₆` gives, by the same charge
equations written once per phase per node,

```
H(z) = − [(K₂ + K₃)z² + (K₁K₅ − K₂ − 2K₃)z + K₃]
        / [(1 + K₆)z² + (K₄K₅ − K₆ − 2)z + 1]
```

with `K₂ = K₃ = 0` for the low-pass, so that

```
H_LP(z) = − K₁K₅ z / [(1 + K₆)z² + (K₄K₅ − K₆ − 2)z + 1]
```

Design it in z rather than in s. For `f₀ = 50.0 kHz`, `Q = 2` and `f_s = 1.00 MHz`
the continuous poles sit at `σ = −78 540 s⁻¹` and `ω_d = 304 183 rad/s`, so
`z = e^{sT}` has radius 0.924465 and angle 0.304183 rad. The denominator is therefore
`z² − 1.76405 z + 0.854636`, and matching coefficients gives

```
K₆   = 1/a₀ − 1        = 0.170089
K₄K₅ = a₁/a₀ + K₆ + 2  = 0.105994
```

With `K₄ = K₅ = 0.325568` and a 10.0 pF integrating capacitor, `C₄ = C₅ = 3.2557 pF`
and `C₆ = 1.7009 pF`. The textbook design equations `K₄K₅ = (ω₀T)²` and
`K₆ = ω₀T/Q` give 0.098696 and 0.157080, which are 7.39 % and 8.28 % away. Read those
ratios back through the exact H(z) and the realised filter has `f₀ = 48.374 kHz`,
3.253 % low, with `Q = 2.0832`, 4.161 % high.

That gap is the lab's argument in one number. The design equations are the
approximation, the H(z) is exact, and the reader can see the difference on the
z-plane.

#### The function

```js
/**
 * The exact H(z) of a switched-capacitor network, from its charge equations.
 * @param scNet  the two-phase description of §2.4
 * @param ports  { input: elementId, output: nodeName, at: phaseName }
 * @returns {{
 *   b: number[], a: number[],     // highest power first, a[0] = 1
 *   states: string[],             // one per capacitor that holds charge across a phase
 *   check: number                 // largest relative disagreement with the
 *                                 // time-domain charge simulation over 4096 samples
 * }}
 * Throws NetworkError('sc-not-lti') when the network's phase pattern is not
 * periodic, with the reason.
 */
export function hzOf(scNet, ports)
```

`b` and `a` are the currency `@ee-labs/systems` trades in. The result crosses to
Signal Lab as the biquad it is, with no adapter and no hedge.

### 2.4 The clocked netlist

```js
/**
 * A netlist with named clock phases.
 * @param net    a netlist whose switches carry `phase: 'p1' | 'p2' | ...`
 * @param clock  { phases: ['p1', 'p2'], period, nonOverlap, duty }
 * @returns {{
 *   phases: Array<{ name, t0, t1, net }>,   // the netlist in each phase
 *   events: Array<{ t, opens: string[], closes: string[], charge: boolean }>,
 *   run(nPeriods, input): { t, v, samples, phaseAt(t) },
 *   settleOf(phase, node, target): number   // time to within target, exact
 * }}
 */
export function scNetwork(net, clock)
```

`events[k].charge` is true when that transition creates a zero-resistance capacitor
loop, so the scrub can mark the instants where §2.2's event fires. Non-overlap is a
real interval, not a formality, and A3 is the experiment that shows what happens when
it goes to zero.

### 2.5 The quantiser and the modulator

```js
/** A quantiser as a dsp block. Exact, and exactly nonlinear. */
export function quantiser({ levels, step, mode: 'mid-tread' | 'mid-riser' })

/**
 * A delta-sigma modulator, run two ways.
 * @param spec { order, osr, quantiser, coefficients, input }
 * @returns {{
 *   exact: { bits: Int8Array, states: Float64Array[], overload: boolean },
 *   linear: { ntf: {b,a}, stf: {b,a}, snrPredicted: number, label: string },
 *   guard: { amplitude: number, limit: number, held: boolean }
 * }}
 */
export function modulator(spec)
```

`exact` is a switched simulation with the quantiser's decision at each clock, and it
is exact. `linear` is a **different object**, labelled, in which the quantiser is
replaced by an additive white source. CORE_SCOPE Rule 1 forbids substituting one for
the other, so the pane draws both and E1 is where they part. The guard is the input
amplitude against the modulator's stable input range, 0.7 of full scale for a
second-order loop with a one-bit quantiser. Above it the pane says the loop has
overloaded and the linear model no longer describes it.

### 2.6 The PLL in the phase domain

```js
/**
 * The linearised phase-domain model of a charge-pump PLL.
 * @param p { icp, kvco, n, c1, r, c2 }
 * @returns {{
 *   open: {b,a},          // T(s), rational, admitted to systems
 *   closed: {b,a},
 *   wn, zeta, fn, pm,
 *   guard: { maxStep, reason }   // the reference frequency step that keeps
 *                                // the phase-detector error inside 2 pi
 * }}
 */
export function pllPhase(p)
```

The phase detector is nonlinear. Its linear model holds while the phase error stays
inside the detector's own range, which for a phase-frequency detector is `±2π`. For a
frequency step at the reference and `ζ = 1`, the peak phase error is `0.368 Δω/ω_n`,
so the guard is `Δω < 2π ω_n/0.368 = 17.1 ω_n`. At the §4.5 defaults that is a
136.8 kHz step at the reference, or a 13.68 MHz step at the divided output. Past it
the pane says the loop is slewing rather than tracking, and the phase-domain model is
not shown.

CORE_SCOPE: `open` and `closed` are exactly rational and are admitted. The
linearisation itself is guarded by the lock range above, as `ANALOG_ROADMAP.md` §4
requires. The transistor inside the comparator and inside the phase detector is
declined in time, as everywhere else, and its region model is used instead.

### 2.7 Measures

Everything Power Lab and Signal Lab measure, plus the sampled quantities. The
acquisition time constant, the settling error in bits, and `kT/C` as a voltage and as
a resolution. The injected charge and the voltage step it makes. The transfer `H(z)`
with its poles and zeros, and the realised `f₀` and Q against the design values. INL
and DNL in LSB with their sigmas. The signal-to-noise-and-distortion ratio and the
effective number of bits. The noise transfer function's in-band power and the
modulator's overload flag. The loop's `ω_n`, `ζ` and phase margin. The rms jitter and
the signal-to-noise ratio it sets. The residual offset of a chopper with its ripple.

### 2.8 Invariants, the fuzzer's checklist

Across random capacitor values, clock rates and switch models:

1. **Charge is conserved.** For every event, `Σ C_k x⁺_k = Σ C_k x⁻_k` over each
   isolated node set, to floating point.
2. **Energy is never created.** `chargeEvent`'s `energy` is non-negative, and it
   equals `½(x⁻)ᵀC x⁻ − ½(x⁺)ᵀC x⁺`, to floating point.
3. **The event is the `R_on → 0` limit.** Take `R_on` in a geometric sequence from
   1 kΩ down to 1 µΩ. The end-of-phase state of the ordinary segment solve approaches
   `chargeEvent`'s answer with residual `e^{−t/τ}`, matched to 10⁻⁹ relative. The
   switch energy is the same at every `R_on`, to floating point.
4. **The refusal is unchanged.** A capacitor loop containing an independent voltage
   source raises `state-loop` with `dynamics.js`'s message, byte for byte, from both
   `dynamics` and `chargeEvent`.
5. **The state count drops.** After an event, `dynamics` on the reduced netlist raises
   nothing, and its state count equals `basis.length`.
6. **H(z) is the time domain.** `hzOf`'s response equals the sampled output of a 4096
   sample charge simulation, to 10⁻⁹ relative, at every one of 241 frequencies.
7. **The integrator is its formula.** For the parasitic-insensitive integrator,
   `hzOf` returns `{ b: [C₁/C₂, 0], a: [1, −1] }` to floating point, whatever the
   parasitic capacitances are set to.
8. **Parasitics do not move it.** Adding a capacitance from either plate to ground
   changes `hzOf`'s coefficients by less than 10⁻¹² relative. That bound is the
   testable form of the phrase "parasitic-insensitive".
9. **The approximation's error is the formula.** The ratio of `hzOf`'s magnitude to
   the `R_eq` model's equals `(ωT/2)/sin(ωT/2)` at every frequency, to 10⁻¹².
10. **The modulator's two models are separate.** `exact` and `linear` are never
    equal by construction, and the guard flag is true above 0.7 of full scale for the
    second-order one-bit loop.
11. **Noise shaping is the loop.** The measured in-band noise power of the exact run
    equals the linear model's prediction within 1 dB below the overload limit, and
    diverges above it, which is what the guard reports.
12. **The PLL's model is rational.** `open` evaluated at jω equals a direct
    phase-domain simulation at 241 points, to 10⁻⁹ relative, inside the guard.
13. **Cross-lab.** An SC biquad's `{b, a}` sent to Signal Lab gives the same `f₀` and Q
    there. The PLL's loop gain sent to Control Lab gives the same margins. The
    decimator's response matches Signal Lab's FIR of the same taps.

---

## 3. Models: the element library

Everything in the Electronics Lab's and the Analog IC Lab's tables stays. These are
added or changed.

| Element | Ideal law | Toggles, each labelled |
| --- | --- | --- |
| Switch (`SW`) | open, or `R_on` | `phase` names the clock phase. `ron: 0` selects the ideal switch and the event of §2.2 |
| Sampling switch | the above, plus its channel | `W`, `L`, `V_ov`, so `Q_ch = W L C_ox V_ov` is a number. `C_ov` for clock feedthrough |
| Capacitor | C | a matched-ratio tolerance, 0.1 %, and an absolute one, 20 % |
| Unit capacitor array | `m` units of `C_u` | `m` as an integer, and Pelgrom's sigma on the ratio |
| Comparator | the Analog IC Lab's preamplifier and latch | offset, hysteresis, and `τ = C/g_m` for regeneration |
| Quantiser | `dsp` block, §2.5 | levels, step, mid-tread or mid-riser |
| Clock | named phases with a non-overlap interval | `jitter` as a seeded rms, off by default |

Two notes on model choice. The sampling switch is the one place where a device's size
appears in this lab, because charge injection is `W L C_ox V_ov` and nothing else. And
the clock's jitter is a seeded random sequence rather than a spectral density, so A6's
signal-to-noise ratio is measured from a run and compared with the closed form.

### Schematic description

As every other lab: each library circuit is a netlist with grid positions, drawn by
`packages/ui/Schematic.jsx`. The renderer gains one prop, `phase`, which draws each
switch open or closed according to the phase the scrub sits in. Switch symbols carry
their phase name. That prop is the whole of this lab's change to the shared renderer.

---

## 4. The app

### 4.1 Layout

The Power Lab's shape crossed with the Electronics Lab's. Sidebar: LabNav, report
link, experiment groups, circuit picker, component NumFields with chips, the clock
controls, and the math panel. Main: topbar meters, the schematic with its phase
overlay, the **clock-phase scrub** under it, and one pane below with a pane selector.
Phone-width first, no horizontal scroll at 390 px, harness-checked.

The topbar shows the phase name and the position in the period first. Then come the
experiment's headline numbers. Where an experiment carries two models, the topbar names
which one is on screen.

### 4.2 Views

- **Schematic with a phase overlay.** Switches drawn open or closed for the scrub's
  phase, with the charge-event instants marked.
- **Clock-phase scrub.** §4.3. New, and this lab's own.
- **Sampled output.** §4.3. New, and this lab's own.
- **Charge.** Each capacitor's charge as a bar, with the impulsive `dq` of an event
  drawn as a step, and the running total that invariant 1 checks.
- **Bode and z-plane.** From `hzOf`, reused from Signal Lab's `ZPlaneCanvas`, with the
  `R_eq` model's continuous curve drawn beside the exact one and their ratio printed.
- **Transfer curve.** The converter's output code against its input, with INL and DNL
  as two traces under it.
- **Spectrum.** The output's FFT with the signal, the harmonics and the shaped noise
  floor separated, and SNDR and the effective number of bits in the corner.
- **Loop.** T(jω) for the PLL and for the modulator's noise transfer function, with the
  Control Lab link beside it.
- **Scope.** The exact piecewise-linear waveform inside one phase, for settling and
  for the acquisition transient.
- **Equations.** The charge equations per phase, printed as the MNA rows are printed.

### 4.3 The two new canvases, and their contracts

Both live in the app for v1, because `PROGRAM.md` §4 asks for a second lab before a
canvas is promoted to `packages/ui`. The Interfaces Lab is the candidate second lab
for both. Its protocol group needs the same phase axis, so the props below are written
for it.

```jsx
/**
 * ClockScrub — one clock period, with the phases and the events on it.
 * Second lab: Interfaces Lab, whose bus timing needs `marks` for setup and hold
 * windows on the same axis.
 */
<ClockScrub
  clock={{ phases: [{ name: 'p1', t0, t1 }, ...], period, nonOverlap }}
  t={cursor}
  events={[{ t, label: 'charge', kind: 'charge' | 'open' | 'close' }]}
  marks={[{ t0, t1, label: 'acquisition' }]}
  onScrub={(t) => {}}
  loop                                  // play the period on a cycle
/>
```

```jsx
/**
 * SampledOutput — a sequence, and the continuous signal it came from.
 * Second lab: Interfaces Lab, whose software-sampling group needs `held` to
 * draw a zero-order hold beside the stems.
 */
<SampledOutput
  samples={{ n: Int32Array, y: Float64Array }}
  continuous={{ t: Float64Array, y: Float64Array }}   // drawn behind, optional
  held={false}                                        // needed by the second lab
  codes={{ bits, lsb }}                               // draws a code axis on the right
  cursor={n}
  axes={{ x: {...}, y: {...} }}
/>
```

The eye view is deferred by Decision 4. When the Communications Lab lands, D5 gains
its eye diagram through that lab's canvas, and the backlog line reopens.

### 4.4 Quantity paths

Everything Power Lab and Signal Lab list, plus:

```
phase.<name>.<t0|t1|open|closed>            the clock
event.<k>.<t|kind|dq|energy>                a charge event and what it moved
q.<id>                                      a capacitor's charge, coulombs
acq.<tau|settle|bits>                       acquisition, and the bits it reaches
Hz.<mag|db|deg>  zpole.<k>.<r|theta|hz>     from hzOf
sc.<f0|q|f0err|qerr>                        the realised biquad against its design
sc.ratio                                    the R_eq model's error, (wT/2)/sin(wT/2)
adc.<inl|dnl|sndr|enob|sfdr>                the converter's static and dynamic errors
adc.<sigmaInl|sigmaDnl>                     from the unit capacitor's matching
mod.<snr|nbw|overload|order|osr>            the modulator
pll.<wn|zeta|fn|pm|maxStep>                 the loop
jitter.<rms|snr>                            the clock, and what it costs
chop.<residual|ripple>                      the chopper, exactly
```

### 4.5 Numbers

- Clock: `f_s = 1.00 MHz`, two phases, non-overlap 10.0 ns.
- Sampler: `R_on = 1.00 kΩ`, `C_S = 1.00 pF`, so `τ = 1.00 ns` and the bandwidth is
  159.2 MHz. Settling to half an LSB takes 6.238 ns at 8 bits, 7.625 ns at 10 bits,
  9.011 ns at 12 bits and 10.40 ns at 14 bits.
- `kT/C`: 203.5 µV rms at 0.1 pF, 64.36 µV rms at 1.00 pF, 20.35 µV rms at 10.0 pF. On
  1.00 pF a 1 V rms signal has 83.83 dB of headroom, which is 13.63 bits.
- Sampling switch: `W = 1.00 µm`, `L = 0.18 µm`, `V_ov = 1.35 V`, so
  `Q_ch = 2.097 fC`. Half of it on 1.00 pF is 1.049 mV, which is 4.29 LSB of a 12-bit
  1 V converter. `C_ov = 0.20 fF` gives 0.360 mV of clock feedthrough from a 1.8 V
  clock.
- Switched-capacitor integrator: `C₁ = 1.00 pF`, `C₂ = 10.0 pF`, so the unity-gain
  frequency is 15.92 kHz and `R_eq = 1.00 MΩ`.
- Switched-capacitor biquad: `f₀ = 50.0 kHz`, `Q = 2`, `f_s = 1.00 MHz`,
  `K₆ = 0.170089`, `K₄ = K₅ = 0.325568`, `C₄ = C₅ = 3.2557 pF`, `C₆ = 1.7009 pF` on a
  10.0 pF integrating capacitor.
- Converter: 12 bits, unit capacitor 20.0 fF, so a binary-weighted array is 81.92 pF
  and a split array is 2.56 pF. Unit matching sigma 0.316 %.
- Pipeline and settling: 20.0 MHz clock, so 25.0 ns per phase. Twelve bits need 9.011
  time constants, so `τ = 2.774 ns` and a closed-loop bandwidth of 57.37 MHz.
- Modulator: one-bit quantiser at levels ±1, `OSR = 64`.
- PLL: `I_cp = 100 µA`, `K_vco = 100 MHz/V`, `N = 100`, `C₁ = 1.00 nF`, so
  `ω_n = 3.162 × 10⁵ rad/s` and `f_n = 50.33 kHz`. `R = 6.325 kΩ` gives `ζ = 1`, and
  `C₂ = C₁/10`.
- Chopper: offset 1.00 mV, gain 1000, chop at 100 kHz, output low-pass at 1.00 kHz.

---

## 5. Curriculum: 40 experiments in 7 groups

Format, as the other plans: **the claim** the note makes, what the reader turns, and
what is **measured** against what **formula**. Every quoted number becomes a pinned
test. Each experiment ships `see`, `try` and `why` in the three registers, within the
`STYLE.md` budgets.

### Group A: Sampling as a circuit (6)

- **A1 · A sample is an RC that ran out of time.** The switch's `R_on = 1.00 kΩ` into
  `C_S = 1.00 pF` gives `τ = 1.00 ns` and a 159.2 MHz bandwidth. Half an LSB needs
  `ln(2^(B+1))` time constants, so 7.625 ns at 10 bits and 9.011 ns at 12 bits. Cut the
  acquisition short by one time constant and the error is 36.8 % of what remained.
  Measured: the time constant, the settling time at four resolutions, and the error
  against `e^{−t/τ}`.
- **A2 · Two capacitors and a switch, with no resistance between them.** Ideal
  switches make a capacitor loop, which `packages/network` declines today with a
  message about a capacitor that cannot be a state. Charge conservation resolves it.
  Two 1.00 pF capacitors, one at 1.000 V, settle at 0.500 V, and 0.250 pJ of the
  0.500 pJ goes into the switch whatever `R_on` is. Measured: the shared voltage, the
  conserved charge, the lost energy, and the same answer from a 1 Ω switch after twenty
  time constants.
- **A3 · Charge injection is a device size.** `Q_ch = W L C_ox V_ov = 2.097 fC` for a
  1.00 × 0.18 µm switch at 1.35 V of overdrive. Half of it lands on `C_S` and makes
  1.049 mV, which is 4.29 LSB of a 12-bit 1 V converter. A dummy switch halves it, and
  its own mismatch leaves about a tenth. Clock feedthrough through `C_ov = 0.20 fF`
  adds 0.360 mV. Measured: the charge, the step, the LSB count, and the residual after
  a dummy switch.
- **A4 · `kT/C` sets the floor, and R is not in it.** The sampled noise is
  `√(kT/C)`, 64.36 µV rms on 1.00 pF and 203.5 µV rms on 0.1 pF, whatever `R_on` is.
  On 1.00 pF a 1 V rms signal has 83.83 dB of headroom, which is 13.63 bits, so a
  14-bit converter needs at least 1.66 pF. Measured: the density at three capacitances,
  the integral within 0.1 %, and the capacitance a target resolution needs.
- **A5 · Bottom-plate sampling removes the signal-dependent part.** Opening the
  ground-side switch first fixes the charge before the signal-side switch opens, so the
  injected charge no longer depends on the input. The remaining offset is a constant
  and calibrates out. Measured: the injected charge against the input level, with and
  without the technique, and the residual slope.
- **A6 · Jitter is noise on time.** An rms aperture jitter `σ_t` limits the
  signal-to-noise ratio to `−20 log₁₀(2π f_in σ_t)`. Twelve bits at a 1 MHz input needs
  31.76 ps and at 10 MHz needs 3.176 ps. One picosecond at 10 MHz caps the converter at
  84.04 dB. Measured: the required jitter at three inputs, and the ratio from a seeded
  run against the closed form.

### Group B: Switched-capacitor circuits (6)

- **B1 · The switched-capacitor resistor.** A 1.00 pF capacitor switched at 1.00 MHz
  carries `C V f_s` of average current, so `R_eq = 1/(C_S f_s) = 1.00 MΩ`. Its value
  comes from a capacitor and a clock, so it is good to 0.1 % where a diffused resistor
  is good to 20 %. It occupies half the area. Measured: the average current, the
  equivalent resistance, and its tolerance from a Monte Carlo run.
- **B2 · The integrator, and its exact H(z).** Charge conservation on the summing node
  gives `v_o(n) = v_o(n − 1) + (C₁/C₂) v_in(n − 1)`, so
  `H(z) = (C₁/C₂)/(z − 1)`. With `C₁/C₂ = 0.1` and `f_s = 1.00 MHz` the unity-gain
  frequency is 15.92 kHz, which is also `1/(2π R_eq C₂)`. Measured: the difference
  equation from the run, the two coefficients, and the unity-gain frequency both ways.
- **B3 · Where the continuous model stops.** The ratio of the exact `|H(z)|` to the
  `R_eq` model is `(ωT/2)/sin(ωT/2)`. At 20 samples per cycle it is 0.412 % and the
  phase is 9.00° behind, at 10 samples 1.664 % and 18.0°, at 5 samples 6.896 % and
  36.0°. The suite already refuses a sampled-filter link below 20 samples per cycle,
  and this pane uses the same threshold. Measured: the ratio at five rates against the
  formula, and the guard firing at both sides of 20.
- **B4 · Parasitic-insensitive, as a testable claim.** Add a capacitance from either
  plate of `C₁` to ground and the coefficients of `H(z)` move by less than 10⁻¹²,
  because both plates are driven to a known potential in each phase. The
  parasitic-sensitive arrangement moves the gain by the parasitic ratio. Measured: the
  coefficients with 0.1 pF of parasitic on each node, for both arrangements.
- **B5 · The biquad, designed in z.** Matching `z² − 1.76405 z + 0.854636` gives
  `K₆ = 0.170089` and `K₄K₅ = 0.105994`, so `f₀ = 50.0 kHz` and `Q = 2` exactly. The
  textbook equations give 0.157080 and 0.098696, which realise 48.374 kHz and 2.0832,
  3.253 % and 4.161 % away. Measured: both designs read back through `hzOf`, and the
  two errors.
- **B6 · Finite op-amp gain leaks the integrator.** A gain of `A₀` moves the pole from
  `z = 1` to `1 − (1 + C₁/C₂)/A₀`. At `A₀ = 100` the DC gain is 9.091 and the gain
  error at the unity-gain frequency is 1.10 %, at `A₀ = 1000` it is 90.91 and 0.110 %,
  at `A₀ = 10 000` it is 909.1 and 0.0110 %. Measured: the pole, the DC gain and the
  error at three gains, each against the formula.

### Group C: Converters, the static errors (6)

- **C1 · The charge-redistribution DAC.** A binary-weighted array of 20.0 fF units
  totals 81.92 pF for 12 bits, which is why a split array with an attenuation capacitor
  is used instead and totals 2.56 pF. Each conversion is one charge event of §2.2.
  Measured: both totals, the output for three codes, and the charge conserved at each
  step.
- **C2 · The SAR, one decision per clock.** Twelve bits plus acquisition is fourteen
  clocks, so a 20.0 MHz clock gives 1.429 MSPS. Each decision halves the remaining
  range, and the comparator sees an input that falls by a factor of two per step.
  Measured: the code sequence for a given input, the number of clocks, and the residue
  after each decision.
- **C3 · Mismatch becomes INL and DNL.** With a 0.316 % unit sigma the DNL sigma at the
  mid-scale transition is `σ_u√(2^N − 1) = 0.202 LSB` and the worst-code INL sigma is
  0.101 LSB. Three sigma of DNL is 0.607 LSB, which misses a half-LSB target, so the
  unit needs `σ_u < 0.260 %` and 1.47 times the area. Measured: both sigmas, the
  three-sigma DNL, and the area a half-LSB target needs.
- **C4 · The flash converter.** Six bits needs 63 comparators and a 64-tap ladder,
  eight bits needs 255. Each comparator's offset appears directly as an INL
  contribution, so the offset budget is one LSB. Measured: the comparator count, the
  INL from a seeded offset draw, and the code errors it produces.
- **C5 · The pipeline stage and its residue.** A 1.5-bit stage decides against
  `±V_ref/4`, subtracts and multiplies by two, so a comparator offset up to
  `V_ref/4` is corrected by the redundancy downstream. Twelve bits needs eleven stages.
  Measured: the residue against the input over a full range, the correction of a
  deliberate comparator offset, and the code the pipeline produces.
- **C6 · Calibration moves the error into memory.** Measuring each capacitor's weight
  once and correcting in the digital domain removes the mismatch INL and leaves the
  measurement's own noise. Measured: INL before and after calibration, and the residual
  set by the measurement resolution.

### Group D: Converters, the dynamic errors (5)

- **D1 · Settling is a dynamic error in bits.** Half a clock at 20.0 MHz is 25.0 ns.
  Twelve bits needs 9.011 time constants, so `τ = 2.774 ns` and a closed-loop
  bandwidth of 57.37 MHz, which is an amplifier unity-gain frequency of 114.7 MHz at a
  feedback factor of one half. Ten bits needs 97.08 MHz and fourteen needs 132.4 MHz.
  Measured: the time constants, the required bandwidth at three resolutions, and the
  error left by one time constant short.
- **D2 · Slewing comes first, and it is not settling.** A 1 V step at 100 V/µs takes
  10.0 ns before the exponential begins, which is 40 % of the available 25.0 ns. The
  small-signal settling model applies only after it. Measured: the slew interval, the
  exponential after it, and the total against the small-signal prediction alone.
- **D3 · The comparator's decision has a distribution.** With `τ = 20.0 ps`, 100 ps of
  decision time resolves 3.37 mV and fails once every 29.7 ns at 5 GS/s. At 200 ps it
  resolves 22.7 µV and fails every 4.41 µs, at 400 ps every 97.0 ms. Measured: the
  resolution and the failure rate at three times, and the exponential from the region
  model.
- **D4 · SNDR and the effective number of bits.** The output spectrum separates into
  the signal, its harmonics and the noise floor, and `ENOB = (SNDR − 1.76)/6.02`. A
  12-bit converter's 74.0 dB ceiling falls with any of jitter, settling error or
  distortion. Measured: SNDR from the FFT, the three contributions separated, and the
  effective bits.
- **D5 · The code-density test.** Feeding a ramp or a sine and counting the codes gives
  DNL from the histogram. A 3 % DNL resolution needs 1111 samples per code, so 4.55
  million samples for 12 bits. Measured: the DNL from a histogram against the DNL from
  the model, and the count needed for a stated resolution.

### Group E: Noise shaping (6)

- **E1 · The quantiser is nonlinear, and the linear model is a different object.** With
  a slow ramp the quantisation error is a sawtooth, not white noise, and its spectrum
  is a comb. With a busy input it looks white. The pane draws the exact run and the
  linear model together, and E1 is where they part. Measured: the error's spectrum for
  both inputs, and the two models' predicted noise power.
- **E2 · Oversampling buys bits, slowly.** Spreading the same quantisation power over a
  wider band leaves less in the signal band. Every doubling of the oversampling ratio
  buys 3.01 dB, which is half a bit. Measured: the in-band noise at four ratios against
  `Δ²/(12·OSR)`.
- **E3 · A loop shapes it.** A first-order modulator's noise transfer function is
  `1 − z⁻¹`, which is zero at DC. At `OSR = 64` with a one-bit quantiser at levels ±1
  and a full-scale input, the ratio is 50.77 dB, which is 8.14 effective bits. Every
  doubling of the ratio now buys 9.03 dB. Measured: the noise transfer function from
  the loop, the in-band power at three ratios, and the 9.03 dB slope.
- **E4 · Second order, and the price of it.** `(1 − z⁻¹)²` at `OSR = 64` with a half
  full-scale input gives 73.15 dB, which is 11.86 bits, and every doubling buys
  15.05 dB. The loop is stable only below about 0.7 of full scale with a one-bit
  quantiser, and that is the guard. Measured: the ratio at three oversampling ratios,
  the 15.05 dB slope, and the guard firing above the stable input range.
- **E5 · Overload is a different circuit.** Above the stable input the integrator
  states grow without bound and the output becomes a long run of one symbol. The linear
  model predicts nothing about it, and the pane says so rather than drawing it.
  Measured: the state trajectory at 0.6, 0.7 and 0.8 of full scale, and the flag the
  guard sets.
- **E6 · Decimation, and its droop.** A `sinc³` filter with `N = 64` follows a
  second-order modulator, because an `L`th-order loop needs an `L + 1` order comb. At
  the band edge `f_s/128` its droop is 11.76 dB, which one corrector stage removes.
  Measured: the response at the band edge and at half of it, the first null at
  15.63 kHz, and the corrected passband.

### Group F: Clocks (6)

- **F1 · The phase detector is nonlinear, and the model is not.** A phase-frequency
  detector is linear only while the phase error stays inside `±2π`. The phase-domain
  model is admitted as a rational function, and its guard is that range. Measured: the
  detector's characteristic over three cycles of error, and the range the linear model
  covers.
- **F2 · The charge pump and the loop filter.** With `I_cp = 100 µA`,
  `K_vco = 100 MHz/V`, `N = 100` and `C₁ = 1.00 nF`, `ω_n = 3.162 × 10⁵ rad/s`, so
  `f_n = 50.33 kHz`. `R = 6.325 kΩ` gives `ζ = 1`, and `R = 3.162 kΩ` gives `ζ = 0.5`.
  Measured: `ω_n` and `ζ` from `pllPhase`, and the step response's overshoot at three
  dampings.
- **F3 · The loop is a Control Lab loop.** T(s) crosses as `plant=custom` with
  `ctrl=p:1`, and its margins are read there. `C₂ = C₁/10` adds a pole at 252 kHz that
  the margin has to pay for. Measured: the phase margin here and in Control Lab, and
  the margin lost to `C₂`.
- **F4 · The lock range is the guard.** For a reference frequency step and `ζ = 1` the
  peak phase error is `0.368 Δω/ω_n`. The error stays inside `2π` up to a 136.8 kHz
  step at the reference, which is 13.68 MHz at the output. Past it the loop slews and
  the phase-domain model is withdrawn. Measured: the peak error against the step, the
  step at which the guard fires, and the slewing behaviour past it.
- **F5 · Jitter from phase noise.** A VCO at −120 dBc/Hz at 1 MHz offset with a
  `1/f²` skirt integrates to 1.9998 × 10⁻⁴ rad² over 10 kHz to 10 MHz, which is
  0.01414 rad rms, or 0.810°. At a 100 MHz carrier that is 22.50 ps rms. Measured: the
  integral, the rms phase, and the jitter.
- **F6 · What the clock costs the converter.** That 22.50 ps caps a converter at
  76.99 dB with a 1 MHz input and 56.99 dB with a 10 MHz input, which is 9.18 effective
  bits. The loop shapes VCO noise above `f_n` and reference noise below it, so the
  bandwidth is a choice about which noise to keep. Measured: both ratios, the effective
  bits, and the in-band jitter against the loop bandwidth.

### Group G: The chopper and the auto-zero amplifier, exactly (5)

- **G1 · The chopper, as the switched circuit it is.** The Applied Analog Lab's C4
  ships an averaged model with a bandwidth guard. Here the same circuit is solved with
  its switches. A 1.00 mV offset at a gain of 1000 becomes a 1.00 V square wave at
  100 kHz, and a first-order 1.00 kHz low-pass leaves 12.73 mV of fundamental ripple.
  Measured: the square wave, the ripple against `(4/π)V_OS A (f_c/f_chop)`, and the
  residual offset at zero.
- **G2 · What is left after chopping.** Switch charge injection that does not match
  between the two choppers leaves a residual. One femtocoulomb of mismatch on 1.00 pF
  is 1.00 mV at the chopper's output, which at a gain of 1000 is 1.00 µV referred to
  the input. Measured: the residual against the injected mismatch, and the input-
  referred offset.
- **G3 · The auto-zero amplifier samples its own offset.** Storing the offset on a
  capacitor and subtracting it removes it at DC and leaves `kT/C` from the storage
  capacitor. Measured: the residual offset, and the added noise against `√(kT/C)`.
- **G4 · Auto-zeroing folds the noise, and chopping does not.** Sampling a 1 MHz-wide
  white noise at 100 kHz folds `2B/f_s = 20` times the power into the band, which is a
  factor of 4.47 in voltage, or 13.01 dB. Chopping modulates rather than samples, so it
  costs nothing. Measured: the output noise density for both techniques over the same
  band, and the folding factor.
- **G5 · Correlated double sampling is a high-pass.** Subtracting two samples gives
  `1 − z⁻¹`, whose magnitude is 0.0628 at `f_s/100` and 2 at `f_s/2`. It removes
  flicker noise and offset, and multiplies white noise by `√2`. Measured: the transfer
  at four frequencies against `2|sin(πf/f_s)|`, and the white-noise penalty.

---

## 6. Hand-overs

- **→ Signal Lab** (B2, B5, E6). An SC filter's exact H(z) crosses as the biquad it
  is, in `@ee-labs/systems`'s own currency, with no adapter and no hedge
  (`CORE_SCOPE.md` counter-rule). Sections above second order cross as a cascade with
  the order stated, and anything else is declined with the reason. The decimator's taps
  cross to Signal Lab's FIR view, and the two labs' responses are pinned equal.
- **→ Control Lab** (E3, E4, F2, F3, F4). The modulator's noise transfer function and
  the PLL's loop gain both cross as `plant=custom` with `ctrl=p:1`. The PLL link
  carries its lock-range guard, and the link is withdrawn rather than hedged when the
  guard fires.
- **← Applied Analog Lab.** Its C4 chopper is G1 with its switches. Its E5
  anti-aliasing filter is the front of this lab's sampler, and the same `f_s` and order
  are pinned in both. Its `monteCarlo` runs C3's mismatch.
- **← Analog IC Lab.** Its F1 to F4 comparator is C4's and D3's. Its C3 two-stage
  amplifier is B6's finite gain and D1's settling. Its A4 Pelgrom sigma is C3's unit
  capacitor. Its J4 trim is C6's calibration.
- **← Power Lab.** `packages/switched`'s event machinery, unchanged. This lab adds
  `charge.js` beside it and changes nothing that Power Lab uses, which is Decision 2's
  reason for putting it there.
- **↔ Electronics Lab.** Its O2 `kT/C` is A4's floor, read as a resolution rather than
  as a voltage. Its D5 switch is A1's sampler.
- **→ Interfaces Lab.** The converters here are that lab's ADC and DAC. Both new
  canvases carry that lab's props from the start (§4.3). The cross-reference is by name
  until that lab has a plan.
- **→ Communications Lab.** The eye view is deferred (Decision 4). When that lab lands,
  D5 gains its eye through that lab's canvas.

---

## 7. Testing discipline

- **Unit** (`packages/switched`, `packages/dsp`): `chargeEvent` against hand
  redistributions for two, three and four capacitors, and against a loop containing a
  voltage source. `hzOf` against the derived integrator and biquad coefficients.
  `scNetwork` against hand phase tables. `quantiser` against its own transfer curve.
  `modulator` against the closed-form noise power. `pllPhase` against hand `ω_n` and
  `ζ`.
- **Invariants** (§2.8), fuzzed across capacitor values, clock rates and switch models.
  The hostile cases are included. A loop of three capacitors, a capacitor at exactly
  zero volts, a non-overlap interval of zero, a modulator driven past overload, and a
  PLL stepped past its lock range.
- **Experiments**: every number in §5 pinned. Among them are 1.00 ns, 9.011 ns,
  64.36 µV, 2.097 fC and 1.049 mV. Also 1.00 MΩ, 15.92 kHz, 0.412 %, 9.00° and
  0.170089. Also 48.374 kHz, 3.253 %, 4.161 %, 0.202 LSB and 0.607 LSB. Also 114.7 MHz,
  50.77 dB, 73.15 dB, 11.76 dB and 50.33 kHz. Also 136.8 kHz, 22.50 ps, 56.99 dB,
  12.73 mV and 13.01 dB.
- **The refusal's own test, extended.** `dynamics.js`'s `state-loop` test stays exactly
  as it is. Two tests are added beside it. One asserts that `chargeEvent` raises the
  same error with the same message when a loop holds a voltage source. One asserts that
  a capacitor loop of capacitors alone no longer reaches that path, and that the state
  count afterwards is what the message says it should be.
- **The map's promises**: a test walks every `why` and every cross-reference in it. It
  requires the referenced experiment to exist in the named lab. A reference to an
  experiment in tiers 1, 2 or 3 that is not built fails the suite.
- **Guards**: the 20-samples-per-cycle threshold on the continuous model, the
  modulator's stable input range, the PLL's lock range, and the `sc-not-lti` refusal.
  Each is tested at both sides of its threshold.
- **Cross-lab pins**: B5's biquad in Signal Lab, and F3's margins in Control Lab. Then
  G1's ripple against Applied Analog C4's guard, and C3's sigma against Analog IC A4.
- **Playwright harness**: the scrub moves the switches on the schematic. The charge
  bars step at the event and hold between events. The sampled output's stems land on
  the phase the topbar names. No horizontal scroll at 390 px.
- **REVIEW_PLAYBOOK audit** before release, all eleven classes, a screenshot pass, and
  a sittings script with three seats. One seat sits A2, because the charge event is the
  idea this lab is built on.

---

## 8. Integration and the dark launch

The mechanism is the one Power Lab and the Elements lab share, unchanged.

- Deployed **dark** at `/mixed-signal-lab/` from the first vertical slice. Unlisted,
  not secret.
- `apps/mixed-signal-lab/RELEASE_STATUS` reads `dark`. A test asserts that while it
  does, the splash, the root README and the other labs' LabNav contain no reference to
  this lab. Flip the word to `released` and the same test demands the splash card, the
  README row and the nav entries, with counts pinned.
- `deploy.yml` gains one `cp` line, from this lab's `NEEDS.md`, added by the director
  at integration (`PROGRAM.md` §5).
- `progression.test.js` gains this lab's ids and counts, by the same route.
- `packages/switched` gains a dependency on `packages/network`. That is a
  shared-surface change, and it lands in an integration commit of its own, with
  Decision 2 settled first.
- The flip is **Reed's action**, after the release gate in §9.

---

## 9. Phasing

Each phase ships green and deployable dark. Phase 0 is a gate rather than work.

0. **The three gates.** Electronics Lab Groups D, M and O built and merged. Applied
   Analog Lab Phase 1 and its C4 and E5 merged. Analog IC Lab Groups A, C, E and F
   merged. Exit: `kT/C`, the two-stage amplifier's settling, the comparator's
   regeneration and Pelgrom's sigma all available.
1. **The event.** `charge.js` in `packages/switched`, with Decision 2 settled.
   Invariants 1 to 5 fuzzed green before any UI exists, and `dynamics.js`'s own tests
   untouched and passing. Exit: the `R_on → 0` convergence pinned, and the refusal's
   message asserted byte for byte from both entry points.
2. **The clocked netlist and the exact H(z).** `scNetwork`, `hzOf`. Invariants 6 to 9
   fuzzed green. Exit: the integrator's coefficients exact, and the parasitic
   insensitivity below 10⁻¹².
3. **The shell and the two canvases.** App skeleton, dark deploy, `RELEASE_STATUS`
   test, `ClockScrub`, `SampledOutput`, the `phase` prop on `Schematic.jsx`. **Group A**
   (6). Exit: the scrub moves the switches at 390 px, and A1 to A6 are pinned.
4. **Switched-capacitor circuits.** The z-plane view with the continuous curve beside
   it. **Group B** (6). Exit: B5's two designs read back through `hzOf`, and B3's guard
   fires at both sides of 20.
5. **Converters.** The transfer-curve view with INL and DNL. **Groups C, D** (11).
   Exit: C3's sigmas pinned from Pelgrom, and D1's bandwidth requirement derived rather
   than quoted.
6. **Noise shaping.** `quantiser`, `modulator`, the spectrum view with the shaped
   floor. **Group E** (6). Exit: E4's 73.15 dB and 15.05 dB slope pinned, and the
   overload guard tested at both sides.
7. **Clocks and the chopper.** `pllPhase`, the loop view's second trace. **Groups F, G**
   (11). Exit: F3's margins agree with Control Lab's, F4's guard fires at 136.8 kHz,
   and G1's ripple matches Applied Analog C4's guarded prediction.
8. **The release gate**, in order, each blocking the next. The full audit. The
   sittings. Reed's own pass against the dark deployment. Then the flip.

---

## 10. Non-goals (v1, stated so they are decisions rather than omissions)

- **The transistor inside the comparator, in time.** Declined with the reason
  `diode.js` already gives, as everywhere in the suite. The region model carries the
  regeneration, and it is exact inside its region.
- **Continuous-time delta-sigma modulators.** The loop filter is continuous and the
  quantiser is clocked, so the equivalence with a discrete loop is an approximation
  with its own guard. A second lab's worth of content, and no experiment here needs it.
- **Time-interleaved converters.** Their errors are mismatch between channels, which is
  C3's mechanism applied four times. One experiment's worth of new physics and a
  group's worth of machinery.
- **The eye diagram.** Decision 4, deferred with its backlog line.
- **Digital calibration algorithms.** C6 measures a weight and corrects. The adaptive
  estimation of that weight is the DSP Lab's.
- **Sigma-delta DACs and digital modulators.** The same loop with the quantiser in the
  digital domain, and no new lesson.
- **Jitter as a spectral density in the solver.** The clock's jitter is a seeded
  sequence. F5's phase-noise integral is a closed form beside it, not a source the
  engine samples from.
- **Switched-capacitor common-mode feedback beyond one circuit.** Named in the Analog
  IC Lab's D4 and built here as one circuit, not as a group.
- **Charge pumps as power converters.** Power Lab's, and their event is the same one,
  which is worth a cross-reference and not a group.
- **Layout-dependent charge injection.** `W L C_ox V_ov` is the model. Where the charge
  goes in an asymmetric layout is not.

---

## 11. Risks, named

- **The event crosses two packages neither of which this lab owns.** Decision 2 names
  it. Mitigation: the plan states the placement, the invariants and the tests that must
  keep passing, and the director settles ownership before Phase 1 starts.
- **The refusal's message could drift.** If someone rewords `dynamics.js`'s
  `state-loop` message, the boundary this lab is built on moves silently. Mitigation:
  invariant 4 asserts the message byte for byte from both entry points, so a reword
  fails the suite rather than passing quietly.
- **`chargeEvent`'s projection is ill-conditioned when capacitances differ wildly.**
  `B C⁻¹ Bᵀ` with a 1 fF capacitor and a 1 µF capacitor in one loop spans nine decades.
  Mitigation: the loop matrix is built from an integer cycle basis, the solve is
  scaled by the capacitances before it is factorised, and invariant 1 checks charge
  conservation at every event to floating point.
- **The three gates are three labs.** Nothing here starts until tiers 1, 2 and 3 have
  each landed part of their work. Mitigation: §1 lists the exact groups, `BACKLOG.md`
  mirrors them, and Phases 1 and 2 are engine work that needs only tier 1's Group D.
- **Two models on one screen.** The exact modulator run and its linear model are
  different objects, and a reader may take the pair for one thing seen twice.
  Mitigation: Decision 5, two colours with two labels, and E1 built as the experiment
  where they disagree rather than as a note.
- **The scrub is the lab's only navigation.** A reader who does not find the scrub sees
  a static schematic. Mitigation: the scrub is above the pane selector and plays on a
  loop by default, and the sittings seat one reader on A2 with the scrub untouched.
- **`hzOf` on a large network.** Twelve capacitors over four phases is a large
  charge-transfer matrix, and extracting polynomials from it can lose digits.
  Mitigation: invariant 6 compares against a 4096-sample time-domain run at every
  build, and the function reports its own `check` value the way `transferOf` does.
- **Cost.** One event, one polynomial extraction, one loop with a nonlinear block, one
  phase-domain model, two canvases, seven groups and 40 experiments, behind three
  gates. Mitigation: Phase 1's event is small, self-contained and the one piece of this
  plan that turns an existing refusal into content, so it is worth building even if the
  lab waits.
