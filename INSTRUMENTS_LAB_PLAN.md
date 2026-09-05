# Instruments Lab: the plan

A lab for track G of `EE_LABS_MAP.md`: **measurement**, taught as circuits. Every
instrument in a first laboratory course is a circuit the suite can already solve, and
this lab solves it. The oscilloscope's input is an RC. The 10× probe is a divider that
is flat only when two time constants match. The multimeter is a divider, a shunt and a
buffer. The spectrum analyser is a tuned filter. The lock-in is a multiplier and an RC.

The one rule Reed set for this lab is that **no measurement is ever loaded from a real
instrument** (`EE_LABS_MAP.md` §5, 2026-09-05). Every number a reader sees comes from a
netlist solved by `packages/network`, or from a closed form the test recomputes from the
knobs. The lab teaches how a bench works. It does not connect to one.

Splash glyph `⌇⊙`, directory `apps/instruments-lab`, engine `packages/network` with no
new element. Twenty-five experiments in six groups.

The two rules that govern the other labs govern this one with no exemption. **Every
explanatory sentence is a claim about physics, and a test must measure it.** And
`CORE_SCOPE.md` decides what is stated exactly, what is approximated behind a guard,
and what is declined with a reason. This lab is unusual in one way. Almost everything
in it is exact, because an instrument's input stage is a handful of resistors and
capacitors. The two places it is not are named in §2 and each carries its guard.

Every number quoted below was computed by a script against `packages/network` before it
was written. The scripts are `scratch` files and are not committed. §7 says how each
becomes a test.

---

## 0. Open decisions

### Decision 1: the name and the glyph

Recommended: **Instruments Lab**, the name `EE_LABS_MAP.md` §1 already uses. LabNav
short form **"Instruments"**. The splash card names the path in one line, "the scope's
input, the probe, the meter, the analyser, the lock-in, the error bar".

Alternatives considered. *Measurement Lab* names the subject rather than the objects,
and a reader looking for the probe would not find it. *Bench Lab* promises a bench,
which §5 of the map rules out.

### Decision 2: the network analyser group

The map gives this lab a network analyser, built on the RF Lab's S-parameters and the
Smith chart. The RF Lab is not built and is blocked behind the Analog IC Lab and the
Fields Lab's transmission line. Recommended: **record the group in `BACKLOG.md` and do
not build it**. Four experiments are named there so that the group is a deferral and
not an omission. Nothing in this lab's prose refers to them.

### Decision 3: where the lock-in lives

The map gives the lock-in amplifier to the Applied Analog Lab, which is not built and
waits on Electronics L and M. A lock-in is a measurement instrument before it is a
board-level design, and its circuit needs only a multiplier and an RC. Recommended:
**build a simplified lock-in here, as Group E**, with the multiplier written as the two
sinusoids the product identity gives (§2.4). When the Applied Analog Lab is built it
takes the noise and the real multiplier, and this group hands over to it.

### Decision 4: how a sampler enters a lab with no sampler

A digital oscilloscope samples, and `packages/network` has no sampler and no clocked
switch. Recommended: **the sampler is a readout, not an element** (§2.2). The circuit is
the scope's analog front end, solved exactly, and the samples are that exact waveform
read at t = k/f_s. Nothing about the circuit changes when the sample rate changes, which
is the point Group B makes. The alternative, a clocked switch and a hold capacitor,
needs scheduled switch events that `transient` does not have. That contract is written
into `NEEDS.md` and is not built here.

---

## 1. The progression map

Every idea this lab leans on, the experiment that teaches it, and whether that
experiment exists. The lab sits late in the map's build order and leans almost entirely
on labs that are built.

| Idea the lab leans on | Needed by | Taught at | Status |
| --- | --- | --- | --- |
| Ohm's law, series and parallel, the divider | A, C, F | Elements A, C | built |
| The loaded divider, and why a load changes a reading | A2, C1 | Elements C4 | built |
| Thévenin's equivalent, and the resistance a port shows | C1, F3 | Elements D5 | built |
| The op-amp as a buffer, with its inputs held equal | C2 | Elements E4, E5 | built |
| The capacitor as a state, and the RC time constant | A1, A4, B2, E2 | Elements F1, F3 | built |
| Every RC circuit is one RC circuit, by Thévenin | A2, A4 | Elements F4 | built |
| Phasors, impedance, one sine at a time | A1, A3, B2, D | Elements H1 to H3 | built |
| Resonance, and Q as the sharpness of a peak | D1, D2 | Elements H4 | built |
| The Bode view, magnitude and phase against log frequency | A3, A5, D, E2 | Elements H6, Circuit Lab | built |
| Aliasing, the fold, and one sample rate against another | B1 | Signal Lab, Sampling group | built |
| Resolution against frame length, and the window's width | D3 | Signal Lab, Sampling group | built |
| Noise as a spectral density, and `kT/C` | F4 | nowhere (Electronics O is planned) | **stated, not measured** |
| S-parameters, the Smith chart, the reflected wave | the network analyser | nowhere (RF Lab) | **deferred, Decision 2** |

Two rows need saying plainly. **Noise** has no built home, so F4 states the noise floor
as a closed form of the knobs and labels it a model. No noise is generated, and no
spectrum is estimated. **S-parameters** have no home either, and Decision 2 defers the
whole group rather than approximating it.

The order of the groups follows the map. Nothing in a group leans on an experiment
later in this lab, and every cross-reference names an experiment that exists in a lab
that is built.

---

## 2. The engine: what `packages/network` already gives

### 2.1 What exists

This lab owns no package, and it needs no new element. Every circuit in §3 is built
from `R`, `C`, `L`, `V`, `I`, `SW`, `OPAMP` and `VCCS`, all of which
`packages/network` stamps today. The four solvers it uses are these.

- `solveDC` for the meter circuits of Group C and the divider of Group F. The KCL
  residual comes back with every solve and every experiment checks it.
- `transient` for the probe's square wave, the sampled trace and the lock-in's output.
  It is exact on each piece of the input, with no timestep, so a compensation
  overshoot is a number rather than an estimate.
- `solveAC` and `sweepAC` for input impedance, probe flatness, the analyser's shape and
  the lock-in's filter. The same stamps at s = jω.
- `meanRms` and `extrema` for the readings an instrument actually shows. A lock-in's
  output is a mean, and an analyser's detector reads an rms.

`thevenin` is used once, in C1, to give the source resistance a voltmeter loads.

### 2.2 The sampler is a readout, not an element

A digital scope's front end is analog and its display is not. The circuit this lab
solves stops at the sampler. The samples are the exact solution read at t = k/f_s,
which `transient`'s `at(t)` returns for any t. The sample dots are drawn over the exact
trace, the way Signal Lab draws sparse samples as dots (`REVIEW_PLAYBOOK.md` §6).

This is exact, and it is the whole of Group B. The claim B1 makes is an identity. For a
sinusoid at f_sig sampled at f_s, with m the nearest integer to f_sig/f_s,

```
A·sin(2π f_sig · k/f_s + θ)  =  A·sin(2π (f_sig − m·f_s) · k/f_s + θ)     for every integer k
```

because 2π m k is a whole number of turns. When f_sig − m·f_s is negative the sine
reverses, so the alias arrives with its phase turned over. The test evaluates both
sides at forty sample instants and requires agreement to 1e-14. Nothing is estimated.

What is **not** modelled, and is declined rather than approximated. There is no
sample-and-hold, so there is no aperture time and no hold droop. There is no
quantiser in Group B, so a sampled trace has no vertical steps. Group F's meter
quantises a reading, which is the same arithmetic where it belongs.

### 2.3 The swept filter, and which thing sweeps

A swept spectrum analyser tunes a narrow filter across a span and plots what comes out.
Group D models the filter as a series RLC with the output across R, which is exactly
rational and has a closed-form bandwidth. The lab sweeps the **source** past a fixed
filter rather than the filter past a fixed source. The two are not the same function,
and the difference is stated in D2's `why` rather than hidden.

- Sweeping the source is what `sweepAC` does, and it is exact at every frequency.
- Sweeping the filter needs a new solve per point with C retuned, and retuning C alone
  changes Q, so the resolution bandwidth would change across the span. A real analyser
  avoids that with a fixed intermediate frequency, which is an RF Lab subject.
- The two traces have the same peak and the same −3 dB width, and they differ in the
  skirts by first order in Δf/f₀. D2 says so and does not draw the second curve.

The claim Group D is built to make survives either way. A single tone appears on the
screen with the analyser's width, not its own.

### 2.4 The multiplier, written as the two sinusoids it produces

A lock-in multiplies its input by a reference. A product of two signals is not a linear
element and `packages/network` has no multiplier stamp. For two sinusoids the product
is not an approximation of anything, it is two sinusoids:

```
A·sin(ω_s t + φ) · V_r·sin(ω_r t) / V_u
    = (A·V_r / 2V_u) · [ cos((ω_s − ω_r) t + φ) − cos((ω_s + ω_r) t + φ) ]
```

So Group E's netlist carries the mixer's output as two independent sources in series.
One sits at the difference frequency and one at the sum, each of amplitude
`A·V_r/2V_u`. When the reference is on the signal the difference term is a step to
`M·cos φ`. A VCCS of transconductance g_m turns that voltage into the current that
drives the output RC. The RC is solved exactly by `transient`.

The identity itself is a claim, so it is measured. `experiments.test.js` evaluates the
left and right sides at four hundred instants across four periods and requires
agreement below 1e-15. The place the algebra was done by hand is named on screen, in
E1's `why` and in the math panel's first block.

**Declined.** A lock-in fed anything but a sinusoid, and a lock-in with a square-wave
reference, are both outside this construction. A square reference multiplies by an odd
harmonic series, so the output picks up every odd harmonic of the signal. That is a
real instrument's behaviour and it needs either a Fourier sum or the scheduled switch
of `NEEDS.md`. It is deferred with the reason, not approximated.

### 2.5 Uncertainty is arithmetic over the solve

Group F adds no solver. A reading is a number the circuit produced, and the group does
three things to it, each exact.

- **Quantise.** A meter of N counts on a full scale F shows `round(v/step)·step` with
  `step = F/(N+1)`. The error is at most half a count.
- **Specify.** An accuracy of `±(a % of reading + b counts)` is `a·v/100 + b·step`.
  Both terms are printed separately, because which one dominates is the lesson.
- **Propagate.** For `y = f(x₁ … xₙ)` the lab prints the logarithmic sensitivity
  `∂ln y/∂ln xᵢ` of each input, computed in closed form for the divider and checked
  against a re-solve at a perturbed value. The quadrature sum and the worst case are
  both shown, and F3's `why` says which assumption each rests on.

The linearisation is an approximation and carries its guard. The panel prints the exact
re-solve beside the linear prediction and the difference between them. At 1 % the
divider's second-order term is 0.0025 % of the reading, and the panel says so. Past
10 % on a knob the row turns amber, which is the threshold `CORE_SCOPE.md` Rule 3 asks
for.

### 2.6 The noise floor as a labelled number

No noise is generated anywhere in this lab. F4 states two closed forms and the test
recomputes both from the knobs.

- The thermal density of a resistance R at temperature T is `√(4kTR)`, which is
  128.7 nV/√Hz for 1 MΩ at 300 K.
- A resistance loaded by a capacitance has an equivalent noise bandwidth of `1/(4RC)`,
  so the rms across the capacitor is `√(kT/C)`, independent of R. At 15 pF that is
  16.62 µV rms.

Both are labelled models. The second is the sharper statement, and it is why a scope's
own floor does not improve when its input resistance changes. When Electronics O1 and
the Random Signals Lab are built, this experiment hands its two numbers to them and
they measure what this one states.

### 2.7 Invariants, the checklist

Eight properties every experiment in this lab satisfies. They are the fuzzer's list in
`experiments.test.js`, checked at the defaults and at twenty-five random settings
inside every knob's range.

1. **KCL holds.** `sol.maxResidual` is below 1e-9 for every solve, DC or in time.
2. **Tellegen holds.** The sum of `v·i` over every element is zero to 1e-9 of the
   largest single element power.
3. **A compensated probe is flat.** With `R1·C1 = R2·C2` the divider's magnitude at
   nine frequencies from 1 Hz to 100 MHz equals `R2/(R1+R2)` to 1e-12, and the phase is
   zero to 1e-12. This is exact and is never hedged.
4. **A mis-compensated probe's step is the two ratios.** The value just after the edge
   is `C1/(C1+C2)` of the input and the settled value is `R2/(R1+R2)`, whatever the
   other knobs.
5. **The alias identity holds.** §2.2's two sampled sequences agree to 1e-14.
6. **The analyser's −3 dB points are geometric about f₀.** `√(f₁·f₂) = f₀` to 1e-9,
   and `f₂ − f₁ = f₀/Q` to 1e-9.
7. **The two rms paths agree.** For two tones through the analyser's filter, the rms
   of the exact transient over a whole number of beat periods equals `√((a₁²+a₂²)/2)`
   from the two phasor solves, to 1e-9.
8. **The mixer identity holds.** §2.4's product equals its two-term sum to 1e-15.

---

## 3. Models: the instrument library

Every instrument in the lab, as the netlist that is it. Node names are fixed and are the
brief's contract. Values are §4.3's defaults.

| Instrument | The circuit | Exact? |
| --- | --- | --- |
| Scope input | `R2` 1 MΩ and `C2` 15 pF from `in` to ground | exact |
| 1× probe | a wire, so the source drives `in` directly | exact |
| 10× probe | `R1` 9 MΩ with `C1` across it, feeding the scope input | exact |
| Square-wave calibrator | `V1` behind `Rcal` 50 Ω | exact |
| Bandwidth limit | `Rb` and `Cb` between the source and the scope input | exact |
| Sampler | the exact waveform read at t = k/f_s | exact, §2.2 |
| Voltmeter | `Rm` 10 MΩ across the port | exact |
| DMM front end | `Rtop` and `Rbot` summing to 10 MΩ, an `OPAMP` buffer, `Radc` | exact |
| Ammeter | `Rsh` in the loop, and the voltage across it | exact |
| Two-wire ohmmeter | `I1` forcing, `Rl1` and `Rl2` in the same path as `Rx` | exact |
| Four-wire ohmmeter | force through `Rf1`, `Rf2`, sense through `Rs1`, `Rs2` into `Rm` | exact |
| Resolution-bandwidth filter | series `L1`, `C1` with the output across `R1` | exact |
| Analyser detector | `meanRms` of the filter output over the window | exact |
| Lock-in mixer | `Vd` and `Vs` in series, §2.4 | exact identity, hand-derived |
| Lock-in filter | `G1` a VCCS into `Rf` and `Cf` | exact |
| Meter counts | arithmetic on the reading, §2.5 | exact |
| Noise floor | `√(4kTR)` and `√(kT/C)`, printed | labelled model |

Nothing in this table is a new element, and nothing in it is a new package. The lab's
whole engine claim is that an instrument is a circuit, and the table is that claim in
one page.

---

## 4. The app

### 4.1 Layout

Circuit Elements Lab's shape, unchanged. Sidebar with `LabNav`, the report link, the
experiment groups folded by group, the knobs as `NumField`s with preset chips, and the
lesson in three registers. Main pane with a topbar of meters, the schematic always
visible, and one view below with a view switch. Phone width first, no horizontal
scrolling at 390 px, checked by the harness.

The topbar carries the reading the experiment is about, then the two or three numbers
that decide it. For Group A that is the −3 dB frequency and the input capacitance. For
Group C it is the reading and the error against the true value. For Group D it is the
resolution bandwidth and Q. For Group F it is the reading, the displayed value and the
error bar.

### 4.2 Views

Seven views, in the order the view switch lists them. Five are Elements' own, reused
without change. Two are new to this lab and are named in §8 as candidates for
`packages/ui` when a second lab claims them.

- **Reading.** Every meter on the circuit at once, and the one number the experiment is
  about. Elements' view, unchanged.
- **Equations.** The MNA rows the solver built, with live values. Elements' view.
- **Scope.** Voltages against time with a draggable cursor, the exact trace, and the
  sample dots where Group B asks for them. Elements' view plus one prop, `samples`,
  which draws dots at t = k/f_s over the trace. The dots are the reading and the line
  is the circuit, and B1's caption says so.
- **Bode.** `|H|` in dB and `∠H` against log frequency, with the drive marked.
  Elements' view. Group A's flatness, Group D's shape and Group E's filter all read
  here.
- **Impedance.** `|Z|` and `∠Z` the probe or the meter shows, against frequency.
  Elements' view.
- **Error bar** (new). The true value, the reading, the displayed value after
  quantising, and the specified accuracy drawn as a band around it. One horizontal
  axis in the reading's own units, four marks on it, each labelled with its number.
  Group F's view, and the Applied Analog Lab's specification pane is its second home.
- **Contributions** (new). One bar per input to a propagated uncertainty, each the
  sensitivity times the tolerance, with the quadrature sum and the worst case drawn as
  two lines across them. F3's view.

### 4.3 Numbers

The defaults are chosen so that every quoted number is round enough to remember and
every picture fits a phone.

- **Scope input.** `R2 = 1 MΩ`, `C2 = 15 pF`. So `τ = 15 µs` and the input's own corner
  is `10.61 kHz`. At 1 MHz the input shows `10.61 kΩ`, not a megohm.
- **10× probe.** `R1 = 9 MΩ`. Flat at `C1 = R2·C2/R1 = 1.667 pF`. The probe then shows
  `10 MΩ` and `1.5 pF`, and divides by exactly ten at every frequency.
- **Calibrator.** 1 V square at 1 kHz behind `Rcal = 50 Ω`. Compensation settles with
  `τ = (R1∥R2)(C1+C2) = 15 µs`, so five time constants fit in a half period with room.
- **Source under test.** `Rs = 100 kΩ`. Direct, the scope reads `0.9091` with a corner
  at `116.7 kHz`. Through the probe, `0.09901` with a corner at `1.072 MHz`.
- **Bandwidth limit.** `Rb = 1 kΩ`, `Cb = 7.958 nF`, so `f₀ = 20.00 kHz`.
- **Sampler.** `f_s = 10 kSa/s`, signal 9 kHz, alias 1 kHz with the phase reversed.
- **Multimeter.** Input `10 MΩ`. Ranges 2 V, 20 V and 200 V from a `9/1`, `99/1` and
  `999/1` tap on the same chain, ADC full scale 200 mV. Shunts `1 Ω`, `0.1 Ω`,
  `0.01 Ω`, full scale 100 mV. Test current `1 mA`, `Rx = 1 Ω`, leads `0.1 Ω`.
- **Divider under test.** `10 V` behind `1 MΩ` and `1 MΩ`, so the true value is `5 V`
  behind `500 kΩ`. A 10 MΩ meter reads `4.7619 V`, low by `4.762 %`.
- **Analyser.** `L = 10 mH`, `C = 25.3303 nF`, so `f₀ = 10.000 kHz`. `R = 6.283 Ω`
  gives `Q = 100` and a resolution bandwidth of `100 Hz`. Ten times R gives `1 kHz`.
- **Two tones.** 9.900 kHz and 10.100 kHz, 1 V each, 200 Hz apart.
- **Lock-in.** Signal `10 mV` at `1 kHz`, reference `1 V` at `1 kHz`, unit `1 V`, so
  `M = 5 mV`. `g_m = 1 mA/V` into `Rf = 1 kΩ`, so `g_m·Rf = 1`. `Cf = 1 µF` gives
  `τ = 1 ms`, `f₃ = 159.2 Hz` and an equivalent noise bandwidth of `250 Hz`.
- **Uncertainty.** A 3½-digit meter is 1999 counts, so the 20 V range counts in
  `10 mV`. Accuracy `±(0.5 % of reading + 2 counts)`. Resistors `1 %`.
- **Noise.** `k = 1.380649 × 10⁻²³ J/K`, `T = 300 K`. `√(4kTR)` at 1 MΩ is
  `128.7 nV/√Hz`, and `√(kT/C)` at 15 pF is `16.62 µV` rms.

---

## 5. Curriculum: 25 experiments in 6 groups

Format, as the other plans. **The claim** the note makes, what the reader turns, and
what is **measured** against what **formula**. Every quoted number becomes a pinned
test. Each experiment ships with `see`, `try` and `why` in Elements' three registers,
within the `STYLE.md` budgets.

### Group A: The oscilloscope's input (6)

Every scope reading is a divider between the circuit and the scope, and this group is
that divider. It opens on the input's own RC and closes on the rule that ties rise time
to bandwidth.

- **A1 · The input is a resistor and a capacitor.** 1 MΩ in parallel with 15 pF. At DC
  the input shows a megohm. At 10.61 kHz it shows 707 kΩ, and at 1 MHz it shows
  10.61 kΩ, which is the capacitor alone. Measured: `|Z_in|` at four frequencies against
  `1/√(1/R² + (ωC)²)`, and the corner against `1/(2πRC)`.
- **A2 · A probe loads what it measures.** A 100 kΩ source driving the input directly
  reads 0.9091 of the true voltage at DC, and the response falls 3 dB by 116.7 kHz.
  Neither number is the scope's own corner, because the time constant is `(R_s∥R)·C`.
  This is Elements F4 read as a measurement error. Measured: the DC ratio, the corner,
  and the corner's agreement with the Thévenin time constant.
- **A3 · The 10× probe is a divider that can be flat.** 9 MΩ with a capacitor across it
  in front of the scope input. At DC the ratio is `R2/(R1+R2)`, at high frequency it is
  `C1/(C1+C2)`, and the two are equal only when `R1·C1 = R2·C2`. At `C1 = 1.667 pF` the
  magnitude is 0.1 at every frequency from 1 Hz to 100 MHz. Measured: both ratios, and
  the flatness at nine frequencies to 1e-12.
- **A4 · Compensation, on a square wave.** The calibrator's 1 V square through the
  probe. At 1.0 pF the edge lands at 6.25 % and climbs to 10 % with `τ = 14.4 µs`,
  which draws as a rounded corner. At 3.0 pF it lands at 16.67 % and falls to 10 % with
  `τ = 16.2 µs`, which draws as an overshoot of 66.6 %. At 1.667 pF the transient is
  gone. Measured: the edge value, the settled value and τ at all three settings.
- **A5 · What the probe buys, and what it costs.** The same 100 kΩ source through the
  compensated probe reads 0.09901 with a corner at 1.072 MHz. The signal is ten times
  smaller and the bandwidth is 9.18 times larger, because the probe's input
  capacitance is 1.5 pF rather than 15 pF. Measured: both corners, both DC ratios, and
  the ratio between the corners.
- **A6 · Rise time and bandwidth are one number.** The step response of a single pole
  goes from 10 % to 90 % in `2.197·τ`, so `t_r · f₃ = ln 9 / 2π = 0.3497`. The bench
  rule of thumb is 0.35, and it is this number rounded. Measured: `t_r` from the exact
  step by bisection, and the product against `ln 9/2π` to nine decimals.

### Group B: The sampling scope (2)

The front end is analog and the display is not. Two experiments on what the sampler
adds, and both hand to Signal Lab, which teaches sampling properly.

- **B1 · A tone above half the sample rate arrives as a different tone.** 9 kHz sampled
  at 10 kSa/s gives the same forty numbers as 1 kHz with its phase turned over. The
  exact trace runs behind the dots, and the dots are the reading. 4 kHz sampled at the
  same rate is its own representative. Signal Lab's Aliasing preset is the full
  treatment. Measured: the alias frequency against `|f_sig − m·f_s|`, and the two
  sampled sequences against each other to 1e-14.
- **B2 · One pole is a poor anti-alias filter.** With the bandwidth limit at 20.00 kHz
  a 5 kHz signal keeps 97.0 % and a 95 kHz interferer keeps 20.6 %, and the interferer
  aliases straight onto 5 kHz. Forty decibels of rejection needs 2.000 MHz, a hundred
  times the corner, which is why a scope samples far above its analog bandwidth.
  Measured: `|H|` at four frequencies, and the frequency at which one pole reaches
  40 dB against `f₀·√(10⁴ − 1)`.

### Group C: The multimeter (5)

A meter is three circuits behind one pair of leads. This group builds each of them and
measures the error each one makes.

- **C1 · A voltmeter is a resistor across the circuit.** A 10 MΩ meter on a divider
  whose Thévenin resistance is 500 kΩ reads 4.7619 V where the true value is 5 V, low
  by 4.762 %. The ratio is exactly `R_m/(R_m + R_th)`. On a 10 kΩ divider the same
  meter is low by 0.050 %. Measured: both readings, `R_th` from `thevenin`, and the
  ratio against the formula.
- **C2 · The range switch is a tap on one divider.** The input chain is 10 MΩ on every
  range, and the range is where the ADC's 200 mV full scale is tapped. 9 MΩ over 1 MΩ
  is the 2 V range and 9.9 MΩ over 0.1 MΩ is the 20 V range. Take the buffer out and a
  1 MΩ ADC drags the 20 V range's tap from 0.200 V to 0.182 V, 9.008 % low. Measured:
  the three ratios, the input resistance on each, and the unbuffered error.
- **C3 · An ammeter is a shunt, and burden voltage is what it costs.** Measuring 100 mA
  through a 1 Ω shunt gives 98.04 mA and drops 98.04 mV across the meter. A 0.1 Ω shunt
  gives 99.80 mA and 9.98 mV. The shunt for a 10 A range at 100 mV full scale is
  10 mΩ, and it turns 1 W into heat. Measured: the three currents, the burden voltages,
  and the shunt value against `V_fs/I_fs`.
- **C4 · A two-wire resistance reading has the leads in it.** Forcing 1 mA through
  0.1 Ω leads into a 1 Ω resistor reads 1.2 Ω, high by 20 %. The error is `2·R_lead`
  whatever the resistor, so it is invisible at 1 kΩ and ruinous at 1 Ω. Measured: the
  reading, and the error against `2·R_lead/R_x`.
- **C5 · Four wires put the leads outside the answer.** Force through one pair and
  sense through the other, into a 10 MΩ voltmeter. The sense leads carry 100 pA of the
  1 mA forced, so their drop does not enter. The reading is 0.99999988 Ω, low by
  1.2 × 10⁻⁵ %. The exact form is `R_x·R_m/(R_x + R_s1 + R_m + R_s2)`. Measured: the
  reading, the sense-lead current, and the closed form.

### Group D: The spectrum analyser as a swept filter (4)

An analyser is a tuned filter, a detector and a sweep. This group is the filter, and it
ends where Signal Lab's window begins.

- **D1 · The resolution bandwidth is the filter's bandwidth.** A series RLC with the
  output across R, `L = 10 mH` and `C = 25.3303 nF`, peaks at 10.000 kHz. With
  `R = 6.283 Ω` the Q is 100 and the −3 dB points are 9950.1 Hz and 10050.1 Hz, exactly
  100 Hz apart. Their geometric mean is f₀, not their arithmetic mean. Measured: f₀,
  both −3 dB points, the width against `f₀/Q`, and `√(f₁f₂) = f₀` to 1e-9.
- **D2 · A single tone draws the filter, not the signal.** Move one tone off centre and
  the trace falls the way `|H|` falls, 3.00 dB at 50 Hz off and 12.2 dB at 200 Hz off.
  Widen the resolution bandwidth to 1 kHz and the same tone draws a ten times wider
  line. The tone did not change. Measured: `|H|` at six offsets at each of two
  bandwidths, against the RLC's closed form.
- **D3 · Two tones need a bandwidth narrower than their spacing.** Tones at 9.900 and
  10.100 kHz, 1 V each. At 100 Hz resolution the trace reads 0.7280 at each tone and
  0.4472 between them, a dip of 4.24 dB, so they resolve. At 1 kHz it reads 0.9655 at
  the tones and 0.9806 between them, so there is no dip and no pair. Signal Lab's
  Resolution needs time is the same trade in a frame length. Measured: the three trace
  values at each bandwidth, and the transient's rms against the phasor rms to 1e-9.
- **D4 · A filter that narrow needs time.** The RLC's envelope rises with
  `τ = 2L/R = 1/(π·RBW) = 3.183 ms`, and reaches 90 % after 2.303 τ, which is 7.33 ms.
  So a 2 kHz span at 100 Hz resolution cannot be swept in less than 63.7 ms without
  reading low. Halve the resolution bandwidth and the sweep takes four times as long.
  Measured: τ from the exact envelope, the time to 90 %, and the sweep time against
  `span·τ/RBW`.

### Group E: The lock-in amplifier (4)

A lock-in finds a small signal at a known frequency by multiplying and averaging. The
multiplier is written as its two sidebands (§2.4) and everything after it is a circuit.

- **E1 · Multiply by the reference and one term stops moving.** A 10 mV signal at
  1 kHz against a 1 V reference at 1 kHz gives a 5 mV term at 0 Hz and a 5 mV term at
  2 kHz. Through `g_m·R_f = 1` and a 1 ms filter the output settles at 5.000 mV with
  794 µV of ripple peak to peak. Measured: the settled mean, the ripple against
  `2M/√(1 + (2ω_r R C)²)`, and the product identity to 1e-15.
- **E2 · The filter sets both the ripple and the speed.** At `C_f = 1 µF` the output
  reaches 63.2 % in 1 ms and carries ±397 µV of ripple. At 10 µF it takes 10 ms and
  carries ±39.8 µV. The equivalent noise bandwidth of one pole is `1/(4RC)`, which is
  250 Hz and 25 Hz, and it is `π/2` times the −3 dB frequency exactly. Measured: the
  ripple and τ at three capacitances, and the ENBW against `1/(4RC)`.
- **E3 · The output follows the cosine of the phase.** At 0° it is 5.000 mV, at 60° it
  is 2.500 mV, at 90° it is zero and at 180° it is −5.000 mV. A lock-in that reads zero
  has not lost the signal, it is in quadrature with it. Measured: the settled mean at
  four phases against `M·cos φ`.
- **E4 · Off frequency, the output beats instead of settling.** A signal 200 Hz above
  the reference puts the difference term at 200 Hz. The 1 ms filter passes that at
  0.6227, so the output swings ±3.113 mV on a 5 ms beat instead of sitting still. The
  detection band is the filter's, `f_r ± 250 Hz` at 1 µF and `f_r ± 2.5 Hz` at 100 µF.
  Measured: the difference frequency, the swing from a phasor solve at that frequency,
  and the transient's peak as that swing plus the sum term's 361 µV.

### Group F: Uncertainty (4)

A reading is not a value. This group turns four readings from Group C into numbers with
an error bar, and none of it needs a new solver.

- **F1 · Resolution is the last count.** C1's 4.7619 V on a 3½-digit meter's 20 V range
  counts in 10 mV and displays 4.76 V, so half a count is ±5 mV, or ±0.105 %. A
  4½-digit meter counts in 1 mV and displays 4.762 V, ±0.0105 %. More digits do not
  make the loading error smaller. Measured: the count size against `F/(N+1)`, the
  displayed value, and the half-count percentage at three meters.
- **F2 · Accuracy is two terms, and one of them wins.** A specification of ±(0.5 % of
  reading + 2 counts) at 4.7619 V on the 20 V range is 23.8 mV plus 20 mV, so ±43.8 mV,
  or ±0.920 %. At 1 V on the same range the counts term is most of it. The loading
  error C1 measured is 4.762 %, which is 5.43 times the whole specification. Measured:
  both terms, the total, and the ratio to the loading error.
- **F3 · Errors through a divider add by their sensitivities.** For `V = V_in·R₂/(R₁+R₂)`
  the logarithmic sensitivities are −0.5 and +0.5 at equal resistors. With 1 %
  resistors the quadrature sum is 0.707 % and the worst case is 1.000 %. Move both
  resistors the same way and the output does not move at all, because the ratio is what
  matters. Measured: both sensitivities against a re-solve, the two sums, and the
  cancellation to 1e-12.
- **F4 · The instrument has a floor of its own.** A 1 MΩ input at 300 K carries
  `√(4kTR) = 128.7 nV/√Hz`. Loaded by 15 pF its noise bandwidth is `1/(4RC) = 16.67 kHz`,
  so the rms across the capacitor is `√(kT/C) = 16.62 µV`, which does not depend on R
  at all. The meter of F1 counts in 10 mV, six hundred times that, so its floor is
  resolution and not noise. Both lines are labelled models, and nothing here is
  simulated. Measured: both closed forms from the knobs, and their product against
  `√(kT/C)`.

---

## 6. Hand-overs

Four seams, each named at both ends.

- **Elements F4 to A2.** The Thévenin time constant that sets a first-order response is
  the same idea as the source resistance that sets a probe's bandwidth. A2's `why`
  names F4.
- **Elements H4 to D1.** Resonance and Q are taught there and used here as a resolution
  bandwidth. D1's `why` names H4.
- **B1 and D3 to Signal Lab.** Aliasing and resolution are Signal Lab's subject. This
  lab shows where they come from in the instrument and hands over by name, to the
  Aliasing and Resolution needs time presets.
- **F4 to Electronics O1 and the Random Signals Lab.** Two closed forms this lab states
  and those labs measure. Recorded in `NEEDS.md` so the director can wire the seam when
  either is built.

Nothing hands over to a lab that is not built, and no lesson names an experiment that
does not exist.

---

## 7. Testing discipline

The suite's rule, applied here. Four test files, all copied from Circuit Elements Lab
and adapted rather than rewritten.

- `experiments.test.js`. Every experiment solves at its defaults with KCL holding and
  Tellegen closing. Every math-panel check row agrees at the defaults and at
  twenty-five random settings. Every `see`, `try` and `why` is measured. A number with
  a unit in a lesson sentence has to be a reading the solver produced, a knob value, or
  the cursor time. §2.7's eight invariants are its own describe block.
- `prose.test.js`. Every name, `see`, `try`, `why` and term definition against its
  `STYLE.md` budget, through `@ee-labs/prose/testing`.
- `release.test.js`. `RELEASE_STATUS` reads `dark` and nothing outside
  `apps/instruments-lab/` mentions the lab.
- `course.test.js`, `glossary.test.js`, `terms.test.js`. The group intros, the
  builds-on thread, and every term introduced before it is used.

Two disciplines this lab needs more than most.

**Every pin is a function of the knobs.** The probe's flat ratio is `R2/(R1+R2)`
computed from the parameters in the test, never 0.1 typed in. The analyser's bandwidth
is `f₀/Q` computed from L, C and R. A test that types a constant cannot notice a
default changing under it.

**Tolerances are relative to the solution's scale.** This lab has 100 pA and 10 MΩ in
the same circuit. Every comparison is against the largest quantity of its kind in that
solve, the way `solutionScale` in `pwl.js` does it, never against a fixed epsilon.

---

## 8. Integration and the dark launch

`RELEASE_STATUS` reads `dark` from the first commit. `release.test.js` fails when
`site/index.html`, `README.md` or `packages/ui/src/LabNav.jsx` mentions the lab, and
inverts to demand all three when Reed writes `released`.

Three items go to the director through `apps/instruments-lab/NEEDS.md`.

1. One line in `.github/workflows/deploy.yml`,
   `cp -r apps/instruments-lab/dist _site/instruments-lab`, so the dark URL exists to
   review.
2. The lab's ids and counts in `packages/ui/src/progression.test.js`, owned by the
   seams overseer.
3. Two canvases, the error bar and the contributions bar. They go to `packages/ui`
   when the Applied Analog Lab claims the first as its specification pane
   (`PROGRAM.md` §4). Both are written in the app with that second home in their props
   from the start, and the props are named in the brief.

---

## 9. Phasing

Six sittings, each ending green.

| Phase | Work | Exit |
| --- | --- | --- |
| 1 | The app shell, dark, one stub experiment | the shell loads at 390 px, `release.test.js` passes |
| 2 | Group A, the scope input and the probe | A1 to A6 pinned, invariants 1 to 4 green |
| 3 | Group C, the multimeter | C1 to C5 pinned |
| 4 | Group D, the analyser, with the two rms paths | D1 to D4 pinned, invariants 6 and 7 green |
| 5 | Group E, the lock-in, and Group B, the sampler | E1 to E4 and B1, B2 pinned, invariants 5 and 8 green |
| 6 | Group F, uncertainty, and the two new canvases | F1 to F4 pinned, the harness extended |

Groups A, C, D, E and F are independent of each other and can be taken in parallel by
five agents once phase 1 lands. Group B leans on Group A's front end and follows it.

---

## 10. Non-goals, stated so they are decisions rather than omissions

- **The network analyser.** Deferred to the RF Lab, Decision 2, and recorded in
  `BACKLOG.md` with four named experiments.
- **A real multiplier, and a square-wave reference lock-in.** §2.4 declines both with
  the reason. The Applied Analog Lab takes them.
- **The sample-and-hold, aperture time and hold droop.** Decision 4. They need
  scheduled switch events, and the contract is in `NEEDS.md`.
- **Any generated noise.** F4 states two closed forms and labels them. The Random
  Signals Lab is where noise becomes a signal.
- **Counters, timers and time-interval measurement.** A counter is a digital
  instrument, and the Logic Lab is its home.
- **Calibration and traceability.** A subject about institutions rather than circuits.
- **Connecting to anything.** `EE_LABS_MAP.md` §5, Reed, 2026-09-05.

---

## 11. Risks, named

- **The lab is thirty per cent arithmetic.** Groups B and F compute rather than solve,
  and a lab of spreadsheets would not be a lab. The mitigation is that every one of
  those numbers starts from a circuit the reader has already turned the knobs on. F1
  quantises C1's reading, not an invented one.
- **The mixer's hand-derived step.** §2.4 does one line of algebra outside the solver,
  and a reader who does not notice would think the multiplier was simulated. The
  mitigation is invariant 8, a check row in the math panel, and one sentence in E1's
  `why` naming where the algebra was done.
- **The swept filter's direction.** §2.3 sweeps the source rather than the filter, and
  the two differ in the skirts. The mitigation is that D2's `why` states the difference
  and the size of it, rather than letting the reader assume they are the same function.
- **Five instruments and one interaction model.** Every group is a netlist with meters,
  and six groups of that could read as one long experiment. The mitigation is the two
  new views, and a topbar whose numbers change with the instrument.
- **Nothing gates this lab, so nothing schedules it.** `EE_LABS_MAP.md` §4 puts it in
  the last band precisely because it blocks nothing. The mitigation is that it is
  small, it needs no package, and it is useful beside every lab that is built.
