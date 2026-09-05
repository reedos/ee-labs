# Applied Analog Lab: the plan

Tier 2 of `ANALOG_ROADMAP.md`, and the first lab in the suite where the reader is
asked for values rather than for a reading. Its subject is board-level analog design.
The op-amp chosen from a datasheet, the loop that a capacitive load turns unstable,
the reference and the regulator, the sensor front end, and the filter built to a
passband and a stopband. Then the yield of all of it over parts and temperature.
Splash glyph `⊞`, directory `apps/applied-analog-lab`, engine as `packages/network`
plus two functions and one statistical pass.

The path, in order. The datasheet as the model. Which of the op-amp's limits binds a
given task. Stability on a board. Precision. References and regulators. Front ends.
Filters to a specification. Protection. Timers and the lock-in. Corners, sensitivity,
Monte Carlo and yield.

This is a draft (2026-09-05) for Reed to settle. §0 lists what needs a decision. §1 is
the progression map, and it names every idea this lab leans on with the experiment
that teaches it. Most of those experiments are not built yet. Each such row is a
**dependency** with a named blocker, mirrored in `BACKLOG.md`, and no lesson here
references an experiment that does not exist.

The two rules that govern the other labs govern this one with no exemption. **Every
explanatory sentence is a claim about physics, and a test must measure it.** And
`CORE_SCOPE.md` decides what the engine may state exactly, what it may approximate
behind a guard, and what it declines with a reason. This lab adds a third discipline
of its own. **Every design task states its specification as numbers with units, and
the margin against it is measured, not asserted.**

---

## 0. Open decisions

### Decision 1: the name (recommended: Applied Analog Lab)

`ANALOG_ROADMAP.md` §1 already uses the name, and `EE_LABS_MAP.md` carries it in
track A. LabNav short form **"Applied"**. The splash card names the path in one line:
"the datasheet, the loop on a board, the reference, the front end, the filter to a
spec, the yield".

Alternatives considered. *Board Analog Lab* names the substrate and none of the
method. *Analog Design Lab* collides with tier 3, which is the design lab an IC
engineer means. *Practical Analog Lab* is an evaluative word about the work, which
`STYLE.md` S8 removes.

### Decision 2: a sibling app or a second set of groups in Electronics Lab

`ANALOG_ROADMAP.md` §1 raises this and recommends sibling apps that share the shell.
This plan agrees, for two reasons that the roadmap does not give. Electronics Lab is
already 77 experiments in 15 groups, which is the suite's longest sidebar. And this
lab's interaction model differs by one pane and one run mode, which is enough to
change what the topbar shows on every screen.

Recommended: **a separate app that imports the Electronics Lab's canvases from
`packages/ui`**. The schematic, the Bode view, the pole-zero view and the loop view
are shared. The two labs then differ in three places. They differ in their sidebars,
their specification pane and their ensemble view, and they share every renderer.

### Decision 3: who builds the specification pane, and when

`PROGRAM.md` §4 names Applied Analog Lab as the first lab for the specification pane
and the DSP Lab as the second. The DSP Lab is building now, on `lab/dsp-lab`, and it
needs filter design to a specification in its own first group. Two labs therefore
need the same pane at the same time.

Recommended: **this plan writes the pane's contract (§4.3), the DSP Lab overseer
reviews it before either lab builds, and whichever lands first puts it in
`packages/ui`**. The contract below already carries the DSP Lab's needs in its props,
which is what `PROGRAM.md` §4 requires of a new canvas. The director resolves the
order.

### Decision 4: who builds the ensemble view

`PROGRAM.md` §4 names the Random Signals Lab as the first lab for the ensemble view
and this lab as the second. The Random Signals Lab is building now, on
`lab/random-lab`. This lab's Monte Carlo needs the same canvas with two additions:
a spec band drawn behind the runs, and a yield count in the corner.

Recommended: **the Random Signals Lab builds it, and this plan's §4.3 states the two
props it must carry from the start**. This lab does not copy the canvas. If the
Random Signals Lab ships without those props, the director adds them in one commit
with their test.

### Decision 5: how many op-amp part models ship

Every experiment here picks a part. Six datasheets cover the whole curriculum: a
general-purpose bipolar, a precision bipolar, a JFET input, a low-noise audio, a
chopper, and a rail-to-rail single-supply part. Recommended: **six, each as a named
parameter set on the op-amp macro Electronics Lab's Group A builds**, with no new
element. §3 gives the six sets and the datasheet field each number comes from.

---

## 1. The progression map

This section lists every idea the lab leans on, the experiment that teaches it, and
whether that experiment is built. The lab sits two tiers above the built suite, so
most rows are dependencies. A dependency row names the lab, the experiment and the
branch it is being built on. `BACKLOG.md` carries the same rows, and the progression
test fails on any lesson that references an experiment which does not exist.

| Idea the lab leans on | Needed by | Taught at | Status |
| --- | --- | --- | --- |
| The two laws, nodal analysis, Thévenin, superposition | everything | Elements A to D | built |
| The op-amp as a black box with `R_in`, A, `R_out` | A, B, C | Elements E1, E2 | built |
| The four op-amp circuits and the Schmitt trigger | A, H1, H2 | Elements E3 to E9 | built |
| First and second order response, damping, the RLC | B, F | Elements F, G | built |
| Phasors, impedance, resonance | B, F, G | Elements H | built |
| The diode's four models, the Zener, the clipper | G1, G2 | Elements I1 to I8 | built |
| H(s), poles and zeros, dB, Q, the active filter | B, F | Circuit Lab, 15 experiments | built |
| Tolerance on one part, and which part to blame | I1, I3 | Circuit Lab resonance group | built |
| Loop gain, margins, root locus, the step's overshoot | B, D2, H4 | Control Lab, 13 experiments | built |
| Spectra, harmonics, two tones in one nonlinearity | H3, I5 | Signal Lab Fourier and Nonlinearity | built |
| Aliasing and the Nyquist limit | E5 | Signal Lab Sampling group | built |
| Efficiency as a ceiling, the switch, the buck | D5 | Power Lab A, B | built |
| Offset, bias current, gain-bandwidth, slew, CMRR | A1 to A6, C3 | Electronics A1 to A5 | **dependency, `lab/electronics-lab`** |
| The precision rectifier, a diode inside the loop | G1 | Electronics A6 | **dependency, `lab/electronics-lab`** |
| `V_BE` against temperature, `I_S(T)`, the junction | C3, D1, H4 | Electronics C1 to C4 | **dependency, `lab/electronics-lab`** |
| The transistor as a switch and as a controlled source | D4, H4, H5 | Electronics D1 to D7 | **dependency, `lab/electronics-lab`** |
| The tangent at the point, `g_m`, the hybrid-π | C1, D1, H4 | Electronics F1 to F6 | **dependency, `lab/electronics-lab`** |
| `R_in` and `R_out` by test source, the loading rule | A5, B1, E1 | Electronics G1, G2 | **dependency, `lab/electronics-lab`** |
| The current mirror and the active load | D1, D2 | Electronics I1 to I3 | **dependency, `lab/electronics-lab`** |
| The differential pair, its CMRR and its mismatch | C1, C2 | Electronics J1 to J5 | **dependency, `lab/electronics-lab`** |
| Loop gain by breaking the loop, Blackman's form | B1 to B5, D2 | Electronics L1 to L6 | **dependency, `lab/electronics-lab`** |
| The op-amp from the inside, compensation, the output stage | A1, H5 | Electronics M1 to M6 | **dependency, `lab/electronics-lab`** |
| Thermal and shot noise, the noise figure, `kT/C` | A4, C4, H3 | Electronics O1 to O5 | **dependency, `lab/electronics-lab`** |
| The thermal network, junction to ambient | D4, H5 | Power Lab Group N | **dependency, no overseer** |
| Design to a specification, as a pane | every group | nowhere | **new here, §4.3** |
| PVT corners and Monte Carlo over any parameter | I2, I3, I4 | nowhere | **new here, §2.3, §2.4** |
| Sensitivity as the derivative of an output | I1 | Circuit Lab's tolerance idiom, partly | **new here, §2.5** |
| The chopper as a sampled system | C4 | Mixed-Signal Lab Group G | **dependency, tier 4** |

Three things the map shows that this plan does not fix, so that they are decisions
rather than omissions. **Ten of the Electronics Lab's fifteen groups gate
this lab**, which are A, C, D, F, G, I, J, L, M and O. Nothing in Groups A to H below
can be built before them, and the phasing in §9 starts after that gate. **The thermal network** has no overseer, and
only H5 and D4 need it, so both carry a note naming Power Lab Group N. **The chopper's
exact switched form** is the Mixed-Signal Lab's, and C4 here ships the labelled
averaged model with its guard, as `ANALOG_ROADMAP.md` §2 requires.

The order of the groups follows the map. Nothing in a group leans on an experiment
that comes later in this lab.

---

## 2. The engine: the same solve, run many times, against a target

### 2.1 What exists, and what is missing

Nothing in this lab needs a new element or a new solver. Every circuit here is one
that `packages/network` already solves once Electronics Lab's transistor work lands.
What is missing is the machinery that runs the same solve over a parameter set and
compares the result with a target.

| Need | Today | This plan |
| --- | --- | --- |
| A named target with units and a margin | nothing | `specify(spec, measures)` (§2.2) |
| The solve at the vertices of a parameter box | nothing | `corners(net, box, opts)` (§2.3) |
| The solve over a random sample of parameters | Circuit Lab's one-part tolerance | `monteCarlo(net, spread, opts)` (§2.4) |
| The derivative of an output with respect to a part | nothing | `sensitivity(net, output, params)` (§2.5) |
| A datasheet as a parameter set | nothing | `parts.js`, six sets (§3.1) |
| The instrument a number would be measured with | nothing | a `bench` field per experiment (§2.7) |

### 2.2 The specification, as an object with units

A specification is a list of named requirements. Each carries a measured quantity, a
comparison, a target with a unit, and an optional condition naming the corner or the
band it applies over.

```js
/**
 * A design target and the margin against it.
 * @param spec  { id, title, items: Array<{
 *                  key,            // a quantity path, as §4.4 lists them
 *                  cmp,            // 'atLeast' | 'atMost' | 'within'
 *                  target, unit,   // 90.9e3, 'Hz'
 *                  tol,            // for 'within', a fraction: 0.02
 *                  over }> }       // optional: 'corners' | 'band:20..20000'
 * @param measures  the analysis result, one number per key
 * @returns {{
 *   items: Array<{ key, value, target, unit, margin, marginPct, pass }>,
 *   pass: boolean,          // every item passes
 *   binding: string,        // the key with the smallest marginPct
 *   worst: number           // that margin, as a fraction of the target
 * }}
 */
export function specify(spec, measures)
```

`margin` is signed and in the quantity's own unit. `binding` is what the pane shows
first, because a design task is answered by naming the limit that binds. CORE_SCOPE:
this is arithmetic over exact solves, and it is admitted with no hedge.

### 2.3 Corners: the same solve at the vertices of a box

```js
/**
 * The circuit solved at every vertex of a parameter box, and at its centre.
 * @param net    a netlist
 * @param box    { [paramPath]: [lo, nom, hi] }   // process, voltage, temperature, parts
 * @param opts   { analysis, keys, include: 'vertices' | 'vertices+centre' }
 * @returns {{
 *   runs: Array<{ point: {[p]: number}, measures: {[key]: number}, label: string }>,
 *   worst: { [key]: { value, point, label } },   // per key, in the spec's direction
 *   count: number                                 // 2^n + 1
 * }}
 */
export function corners(net, box, opts)
```

Each run is an ordinary exact solve, so `corners` is exact and is admitted. One claim
in it needs a test of its own. A worst case found at a vertex is the true worst case
only when the output is monotone in each parameter over the box. The pane states that
assumption. `corners` checks it by re-solving at the centre of each face and comparing
with the interpolation between its vertices. When the check fails by more than 1 % the
pane says that the worst case lies inside the box and names the face. That is a guard
under Rule 3.

### 2.4 Monte Carlo and yield

```js
/**
 * The circuit solved over a random sample of its parameters.
 * @param net     a netlist
 * @param spread  { [paramPath]: { dist: 'normal' | 'uniform', tol, sigmaOf } }
 *                tol is the catalogue tolerance. sigmaOf says how many sigma
 *                that tolerance is, default 3.
 * @param opts    { n, seed, analysis, keys, spec }
 * @returns {{
 *   runs: Array<{ point, measures }>,       // kept when n <= 2000, else summarised
 *   stats: { [key]: { mean, sd, min, max, p1, p50, p99 } },
 *   yield: { pass, n, fraction, stderr },   // stderr = sqrt(p(1-p)/n)
 *   correlation: { [keyA]: { [keyB]: number } }
 * }}
 */
export function monteCarlo(net, spread, opts)
```

The generator is seeded, so a run repeats exactly. `yield.stderr` is printed beside
`yield.fraction` every time, because a yield read off 200 runs and a yield read off
two million are different claims. At two million runs and a yield near 96 % the
standard error is 0.0139 %, and at two hundred runs it is 1.39 %.

CORE_SCOPE: each run is exact. The yield is an estimate, and its guard is the
standard error, printed with it and tested against the analytic value where a closed
form exists. §5's I3 is the experiment that shows the estimate converging.

### 2.5 Sensitivity, exact from the solve

The suite already solves `M x = r` for each analysis. The derivative of any solution
entry with respect to any parameter is one more solve with the same matrix.

```
M x = r,  differentiate:  M ∂x/∂p + (∂M/∂p) x = ∂r/∂p
∂x/∂p = M⁻¹ (∂r/∂p − (∂M/∂p) x)
```

```js
/**
 * The exact derivative of each output with respect to each parameter, and the
 * normalised sensitivity S = (∂y/y)/(∂p/p).
 * @returns {{
 *   d: { [key]: { [param]: number } },      // absolute, in key-unit per param-unit
 *   s: { [key]: { [param]: number } },      // dimensionless
 *   ranked: Array<{ key, param, s }>        // by |s| descending
 * }}
 */
export function sensitivity(net, { keys, params })
```

`∂M/∂p` is one stamp, and it is written next to the element's own stamp. The result
is exact to floating point and is admitted with no hedge. The Sallen–Key section of
§5's F4 has `S = −1/2` for each of its four parts on `f_0`, and `S = ±1/2` for its two
capacitors on Q. Circuit Lab's "Blame the right part" is one instance of this
function, and the two are pinned equal.

### 2.6 What stays exactly as it is

`solveDC`, `sweepAC`, `transferOf`, `returnRatio`, `noise.js`, `pwlTransient` and the
op-amp macro come from Electronics Lab unchanged. This lab adds no element type and
no solver. The 555's comparators and its RC are piecewise-linear, so `pwlTransient`
gives its waveform exactly, events and all, and H1's period is a closed form rather
than a measurement of a timestep.

### 2.7 The bench note

`ANALOG_ROADMAP.md` §3 asks for a "how you would measure this" note on each
experiment. It is a data field, not engine work.

```js
bench: {
  instrument: 'oscilloscope, 10x probe',
  method: 'AC couple, 20 MHz bandwidth limit, average 16',
  floor: '1 mV, set by the probe attenuation and the 8-bit digitiser',
}
```

Nothing is loaded from an instrument (`EE_LABS_MAP.md` §5). The note states the
instrument's own floor next to the number the model produces, so that a reader can
see which claims a bench could check and which sit below its noise.

### 2.8 Invariants, the fuzzer's checklist

Across random component values and part sets on every library circuit:

1. **A corner run is an ordinary solve.** Every entry of `corners.runs[k].measures`
   equals the direct solve of the netlist with those parameter values, to floating
   point.
2. **The centre is in the hull.** For a monotone output the centre run lies between
   the two extreme vertices. When it does not, the monotonicity guard fires.
3. **Sensitivity is the derivative.** Every entry of `sensitivity.d` equals a central
   finite difference of the same output, to 10⁻⁶ relative, at three step sizes.
4. **Sensitivity predicts the corner.** For a 1 % box the first-order prediction
   `Σ S_k Δp_k` matches the corner run to within 1 % of the change.
5. **Monte Carlo statistics converge.** The measured standard deviation of a
   first-order output equals the root-sum-square of its sensitivities times the
   parameter sigmas, to within three standard errors at 10⁶ runs.
6. **The seed repeats.** Two runs with the same seed give identical samples.
7. **Yield and its error agree with the closed form.** For a Gaussian output the
   measured yield equals `erf(m/(σ√2))` within three standard errors.
8. **The specification is arithmetic.** `specify` with a measured value equal to the
   target gives a margin of exactly zero and `pass` true for `atLeast` and `atMost`.
9. **The binding limit is the smallest margin.** `binding` names the item with the
   smallest `marginPct` over every item, including those that pass.
10. **Cross-lab.** The loop gain of B1's buffer sent to Control Lab as a plant gives
    the same phase margin there as here. F1's filter sent to Signal Lab as a cascade
    of biquads agrees at the corner and at the stopband edge.

---

## 3. Models: the parts library

No new element. Two new data files.

### 3.1 Six op-amps, from six datasheets

Each is a parameter set on the op-amp macro of `ELECTRONICS_LAB_PLAN.md` §2.2. The
column names are the datasheet's own.

| Set | `gbw` | `slew` | `vos` | drift | `ib` | `e_n` at 1 kHz | CMRR | Use |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| general bipolar | 1 MHz | 0.5 V/µs | 1 mV | 3 µV/K | 100 nA | 20 nV/√Hz | 90 dB | the default, and the canon's 741 |
| precision bipolar | 0.6 MHz | 0.3 V/µs | 60 µV | 0.5 µV/K | 1.2 nA | 9.6 nV/√Hz | 120 dB | C3, D1, E3, E4 |
| JFET input | 3 MHz | 13 V/µs | 3 mV | 10 µV/K | 65 pA | 18 nV/√Hz | 86 dB | A5, B3, B4 |
| low-noise audio | 10 MHz | 9 V/µs | 0.5 mV | 5 µV/K | 200 nA | 5 nV/√Hz | 100 dB | A4, H3, H5 |
| chopper | 2 MHz | 2 V/µs | 5 µV | 0.02 µV/K | 100 pA | 55 nV/√Hz | 130 dB | C4 |
| rail-to-rail, single supply | 1.5 MHz | 1 V/µs | 1 mV | 4 µV/K | 10 pA | 30 nV/√Hz | 80 dB | A6, E1, E5 |

A part is a set of toggles on one macro. No experiment says a part is better than
another. Each says which limit binds for the task on screen, and the specification
pane reads the margin.

### 3.2 The rest of the library

| Element | Ideal law | Toggles, each labelled |
| --- | --- | --- |
| Resistor | R | tolerance (0.01 %, 0.1 %, 1 %, 5 %), tempco in ppm/K, self-heating off |
| Capacitor | C | tolerance, tempco, ESR, ESL, and a dielectric that halves C at rated volts |
| Zener and TVS | Elements I8's model | clamping voltage, dynamic resistance, standoff |
| Shunt | R with a tempco | 0.1 % and 25 ppm/K, the sense-resistor grade |
| Pt100 | `R(T) = R₀(1 + αT)` | α = 3.851 × 10⁻³ K⁻¹, self-heating from a thermal resistance |
| Type K thermocouple | 41 µV/K over the range used | cold-junction temperature as a knob |
| Photodiode | a current source with `C_j` and a shunt | responsivity 0.5 A/W, `C_j` 20 pF, dark current |
| Thermal network | Power Lab Group N's `R_th`, `C_th` | junction to case to ambient, one node each |
| The 555 | two comparators, a flip-flop, a discharge switch | all piecewise-linear, all existing elements |

The 555 is worth naming as a model choice. It is built from parts the suite already
stamps, so its waveform is exact under `pwlTransient` and its period is a closed
form. No new element type is introduced for it.

### 3.3 Schematic description

As the Electronics Lab: each library circuit is a netlist with grid positions, drawn
by `packages/ui/Schematic.jsx`. Three symbols are added, the shunt with its two sense
leads, the photodiode, and the three-terminal regulator as a block. The corner overlay
(§4.2) is the renderer's one new capability, and it is one prop.

---

## 4. The app

### 4.1 Layout

The Electronics Lab's shape, with one addition. Sidebar: LabNav, report link,
experiment groups, circuit picker, component NumFields with chips and a tolerance
chip on each, the part picker, and the math panel. Main: topbar meters, the schematic
always visible, the **specification pane** below it, and one analysis pane below that
with a pane selector. Phone-width first, no horizontal scroll at 390 px,
harness-checked.

The topbar shows the binding limit first, then the experiment's headline numbers,
then the part in use. A reader who arrives mid-task should be able to read what is
short and by how much without opening a pane.

### 4.2 Views

- **Schematic, with a corner overlay.** The DC and AC overlays of the Electronics
  Lab, plus a third mode that prints each meter's nominal value and its spread over
  the current parameter box, as `3.30 V (3.21 to 3.38)`.
- **Specification pane.** §4.3. Always visible, never a tab.
- **Ensemble.** The Monte Carlo runs as a translucent bundle, the spec band drawn
  behind them, the yield and its standard error in the corner. §4.3.
- **Corners.** A table of vertices with the worst case highlighted, and a parallel
  coordinates plot when the box has more than three parameters.
- **Bode and pole-zero.** From `transferOf`, reused from the Electronics Lab, with the
  spec mask drawn on the magnitude axis for the filter group.
- **Loop.** T(jω) with margins marked and the Control Lab link beside it, reused.
- **Scope.** The exact piecewise-linear waveform, for the 555, the clamps and the
  slew-limited driver.
- **Noise.** The output density as a stack, one band per source, reused.
- **Thermal.** The junction, case and ambient nodes with their temperatures, for D4
  and H5 only.
- **Sensitivity.** A ranked bar of `S` per part, with the sign, which is the pane
  that answers "which part do I tighten".
- **Equations.** The MNA rows, as every lab prints them.

### 4.3 The two new canvases, and their contracts

Both are `packages/ui` canvases under `PROGRAM.md` §4, and both carry a second lab's
needs in their props from the start.

```jsx
/**
 * SpecPane — a target and the margin against it.
 * Second lab: DSP Lab, whose filter group states a passband ripple, a stopband
 * attenuation and a transition width, and needs `mask` to draw them on an axis.
 */
<SpecPane
  items={[{ key, label, value, target, unit, cmp, tol, margin, pass }]}
  binding="corner.high"          // the item to show first
  mode="table" | "bars"          // bars for a phone
  mask={{ axis: 'f', bands: [...] }}   // optional, drawn by the Bode view
  onEdit={(key, target) => {}}   // a design task lets the reader move the target
/>
```

```jsx
/**
 * EnsembleCanvas — many runs and their spread.
 * First lab: Random Signals Lab. This lab is the second, and needs two props
 * that lab does not: `band` and `count`.
 */
<EnsembleCanvas
  runs={[{ x: Float64Array, y: Float64Array }]}
  summary={{ mean, p1, p50, p99 }}
  band={{ lo, hi, label: 'spec' }}      // needed here, drawn behind the runs
  count={{ pass, n, stderr }}           // needed here, shown in the corner
  axes={{ x: {...}, y: {...} }}
/>
```

### 4.4 Quantity paths

Everything the Electronics Lab lists, plus:

```
spec.<key>.<value|target|margin|marginPct|pass>   the pane's own rows
spec.binding                                      the key that binds
corner.<key>.<worst|best|spread>                  over the current box
corner.<key>.at                                   the vertex label, "PVT: slow, 3.0 V, 125 C"
mc.<key>.<mean|sd|p1|p99>                         the Monte Carlo statistics
mc.yield.<fraction|stderr|n>                      the yield and its error
sens.<key>.<param>                                the normalised sensitivity
thermal.<node>.t                                  junction, case, ambient, kelvin
```

### 4.5 Numbers

The defaults are chosen so that every quoted number is round enough to remember and
every picture fits a phone.

- Filter section: Sallen–Key unity gain, Butterworth, `f_0 = 100 kHz`, `R₁ = R₂ =
  10 kΩ`, `C₁ = 225.08 pF`, `C₂ = 112.54 pF`. Multiple-feedback, same corner and Q,
  `R₁ = R₂ = R₃ = 7.503 kΩ`, `C₁ = 450 pF`, `C₂ = 100 pF`.
- Filter specification: 0.5 dB at 100 kHz, 40 dB at 500 kHz. Butterworth order 4
  (3.515 rounded up), Chebyshev order 3 (2.770 rounded up).
- Transimpedance amplifier: `R_f = 1 MΩ`, `C_in = 25 pF` (20 pF diode, 5 pF amplifier),
  JFET part at 3 MHz. Read with a 10 MHz part in B4, where `C_f = 0.892 pF`.
- Capacitive load: 10 MHz part, `r_o = 50 Ω`, `C_L = 1 nF`, `R_iso` 22 Ω to 100 Ω.
- Instrumentation amplifier: `R_G = 1 kΩ`, `R = 24.9 kΩ`, so the first stage is 50.8.
  Difference stage at 0.1 %.
- LDO: `V_out = 3.30 V` from a 1.25 V reference, `C_out = 10 µF`, ESR 0.01 Ω to 1 Ω,
  load 1 mA to 100 mA. Error amplifier gain 1000 with a 100 Hz pole, and a pass
  transconductance of 1 A/V.
- Bandgap: `V_G0 = 1.206 V`, `V_BE(300 K) = 0.650 V`, `η = 4`, `N = 8`, so `M =
  11.79` and `V_ref = 1.2836 V`.
- Current sense: 100 mΩ shunt, 1 A, 12 V common mode.
- 555: `R_A = R_B = 10 kΩ`, `C = 10 nF`. Monostable `R = 100 kΩ`, `C = 10 nF`.
- Audio output stage: ±20 V rails, 8 Ω load, low-noise audio part driving it.
- Tolerances: 1 % read as three sigma, so `σ = 0.3333 %`.

---

## 5. Curriculum: 45 experiments in 9 groups

Format, as the other plans: **the claim** the note makes, what the reader turns, and
what is **measured** against what **formula**. Every quoted number becomes a pinned
test. Each experiment ships `see`, `try` and `why` in the three registers, within the
`STYLE.md` budgets, plus the `bench` note of §2.7.

Groups A to H each end with one design task, where the specification pane is editable
and the reader supplies values. Group I is the method group, and every circuit above
returns to it.

### Group A: The op-amp, chosen (6)

- **A1 · The datasheet is the model.** Six parameter sets on one macro. The
  general-purpose part at gain 11 has a closed-loop corner of 90.92 kHz, and the
  1 MHz gain-bandwidth product is the datasheet line it comes from. Measured: the
  exact closed-loop pole from `transferOf` for three parts, each equal to that part's
  `gbw`/11.
- **A2 · Gain-bandwidth binds a filter.** The 100 kHz Sallen–Key section. With a
  1 MHz part the corner falls to 98.32 kHz, 1.68 % low, and the passband peaks by
  0.0605 dB. With a 3 MHz part the error is 0.211 %, and with 10 MHz it is 0.0197 %.
  Measured: the corner and the peaking at four gain-bandwidths against the ideal
  99.999 kHz.
- **A3 · Slew binds a driver.** A 10 V peak sine needs 1.257 V/µs at 20 kHz. The
  0.5 V/µs part reaches full power only to 7.958 kHz, while its small-signal
  bandwidth is still 1 MHz. The 9 V/µs audio part reaches 143.2 kHz. Measured: the
  ramp slope from `pwlTransient`, and the frequency at which a 10 V sine first
  distorts, for both parts.
- **A4 · Noise binds a preamp.** Over a 20 kHz band a 20 nV/√Hz part contributes
  2.828 µV rms and a 5 nV/√Hz part 0.7071 µV rms. On a 1 mV signal that is 50.97 dB
  against 63.01 dB. Measured: both densities integrated over the band, and both
  signal-to-noise ratios.
- **A5 · Bias current binds a high-impedance source.** Into 10 MΩ, 100 nA makes 1.000 V
  of error, 1.2 nA makes 12.0 mV, and 65 pA makes 0.650 mV. The JFET part's bias
  current doubles every 10 K, so at 85 °C it is 4.16 nA and the error is 41.6 mV.
  Measured: the output error for three parts at 25 °C and at 85 °C.
- **A6 · The supply pin, and the decoupling capacitor.** A 100 nH supply lead carries
  a 100 mA edge in 10 ns and drops 1.000 V. A 100 nF capacitor at the pin supplies the
  same 1 nC and drops 10.0 mV, a hundred times less. The pair resonates at 1.592 MHz.
  Measured: both drops, and the resonance. **Design task:** choose a part for a
  1 mV rms preamp with a 100 kΩ source and a 20 kHz band, and read the margin.

### Group B: Stability on a board (5)

- **B1 · A capacitive load moves a pole into the loop.** A 10 MHz part with
  `r_o = 50 Ω` into 1 nF puts a pole at 3.183 MHz. The loop crosses at 5.212 MHz, so
  the phase margin is 31.41°, and the step rings. Measured: the crossover, the margin
  and the overshoot, with the loop gain crossing to Control Lab.
- **B2 · The isolation resistor buys the margin back.** `R_iso` in series with the
  load, feedback taken at the amplifier's own output. At 22 Ω the margin is 58.44°, at
  50 Ω it is 76.15°, at 100 Ω it is 85.68°. The price is a divider: 50 Ω into a 1 kΩ
  load loses 4.762 % of the output. Measured: the margin and the droop at three
  values.
- **B3 · The photodiode puts a pole in the feedback.** `R_f = 1 MΩ` with 25 pF at the
  input makes a noise-gain zero at 6.366 kHz. The loop crosses where that rising gain
  meets the amplifier's falling gain, at √(GBW/(2π `R_f` `C_in`)) = 252.3 kHz, and the
  phase margin is 1.446°. Measured: the zero, the crossover and the margin.
- **B4 · The feedback capacitor restores it.** `C_f = √(2C_in/(2π R_f · GBW)) =
  0.892 pF` gives a Butterworth pair. The margin rises to 65.80°, the crossover moves
  to 380.5 kHz, and the closed-loop corner is 178.4 kHz from `1/(2π R_f C_f)`.
  Measured: all four, and the transimpedance of 1.00 V/µA at DC.
- **B5 · The composite amplifier.** A second amplifier inside the loop multiplies the
  gain available. Two 1 MHz parts at an outer gain of 100 reach 78.62 kHz with a 51.83°
  margin when the inner one is closed at 10, against 10.00 kHz for one part alone.
  Raise the inner gain to 30 and the margin falls to 18.92°. Measured: the crossover
  and the margin at four inner gains. **Design task:** hit 100 kHz at a gain of 100
  with at least 45° of margin.

### Group C: Precision (5)

- **C1 · CMRR comes from resistor matching.** The rejection of a difference amplifier
  at gain 1 is `(1 + G)/(4t)`. With 1 % resistors it is 33.98 dB, with 0.1 % it is
  53.98 dB, and with 0.01 % it is 73.98 dB. A 12 V common-mode input through the 0.1 %
  version appears as 24.0 mV. Measured: the rejection at three tolerances, and the
  error voltage.
- **C2 · The instrumentation amplifier puts the gain first.** `R_G = 1 kΩ` with
  `R = 24.9 kΩ` gives a first stage of 50.8, whose common-mode gain is one. Total
  rejection with a 0.1 % difference stage is 88.10 dB, and with 0.01 % it is
  108.1 dB. Measured: the first-stage gain, and the rejection with both difference
  stages.
- **C3 · Offset and its drift.** At a gain of 1000 the general part's 1 mV offset
  makes 1.000 V at the output, and its 3 µV/K drift over 60 K adds 180 mV. The
  precision part's 60 µV and 0.5 µV/K make 60.0 mV and 30.0 mV. Measured: both
  contributions for both parts, and the drift slope.
- **C4 · The chopper, as a labelled model.** Chopping at 100 kHz moves the offset to
  the chop frequency and leaves 5 µV. The averaged model is the approximation, and its
  guard is the ratio of signal bandwidth to chop frequency, set at 10. Below that the
  pane warns and prints the ripple, `(4/π)·V_OS·A·(f_c/f_chop)` = 12.73 mV at a 1 kHz
  corner. The exact switched form is Mixed-Signal Lab Group G. Measured: the residual
  offset, the ripple, and the guard firing at both sides of 10.
- **C5 · Trimming and calibration.** A two-point calibration over 0 to 10 V removes
  the offset and the gain error exactly and leaves the nonlinearity. At 0.01 % of full
  scale that residual is 1.00 mV. Measured: the three error terms before and after,
  and that the residual is unchanged by the calibration. **Design task:** reach 0.05 %
  total error over 60 K on a 10 mV bridge signal.

### Group D: References and regulators (5)

- **D1 · The bandgap, summed to first order.** `V_BE` falls at −2.112 mV/K and
  `V_T ln 8` rises at 86.17 µV/K per unit of multiplier, so `M = 11.79` flattens the
  sum. `V_ref = 1.2836 V`, and over −40 to 125 °C it moves 3.746 mV, which is
  17.69 ppm/K. Measured: the two slopes, `M`, the reference and the curvature.
- **D2 · The LDO's loop, and the ESR zero.** DC loop gain 81.94 dB. At 100 mA the
  output pole sits at 481 Hz and the loop crosses at 24.66 kHz. With a 0.1 Ω ESR the
  zero is at 159.2 kHz and the margin is 10.16°. With 1 Ω the zero is at 15.92 kHz,
  the crossover moves to 39.62 kHz and the margin is 68.93°. Measured: the pole, the
  zero, the crossover and the margin at three ESR values, with the loop crossing to
  Control Lab.
- **D3 · PSRR against frequency.** Supply rejection is the loop gain. It is 81.94 dB
  at DC, 78.73 dB at 100 Hz, 54.44 dB at 1 kHz, 15.73 dB at 10 kHz and 0.110 dB at
  100 kHz. A 100 mV ripple at 100 Hz therefore reaches the output as 11.6 µV, and at
  100 kHz as 98.7 mV. Measured: the rejection at five frequencies against `|1 + T|`.
- **D4 · Dropout, dissipation and the load pole.** A 3.30 V output from 12 V is 27.5 %
  efficient and dissipates 870 mW at 100 mA, which is 43.5 K of rise at 50 K/W. From
  5 V the efficiency is 66.0 %. At 1 mA the output pole falls to 4.82 Hz and the loop
  is a different loop. Measured: efficiency, dissipation, junction rise, and both
  poles.
- **D5 · Where the switching regulator takes over.** The same 3.30 V at 1 A from 12 V
  dissipates 8.70 W as a linear regulator. Power Lab's buck at 90 % delivers it with
  0.37 W. The hand-over states the noise the reader trades for it. Measured: both
  dissipations, and the cross-lab link to Power Lab's buck at the same operating
  point. **Design task:** supply 3.3 V at 200 mA from a 5 V rail with under 100 µV rms
  of output noise in a 100 kHz band, and name which regulator meets it.

### Group E: Front ends (5)

- **E1 · High-side current sensing.** A 100 mΩ shunt at 1 A gives 100 mV and
  dissipates 0.100 W. Through a 0.1 % difference amplifier, a 12 V common mode adds
  24.0 mV, which is 24.0 % of the reading. A part with 100 dB of rejection adds 120 µV,
  which is 0.120 %. Measured: the shunt voltage, and both errors as fractions.
- **E2 · Low-side sensing moves the problem to the ground.** No common mode, and a
  10 mΩ ground trace at 1 A shifts the load's return by 10.0 mV. Measured: the sense
  voltage, and the ground shift seen by the rest of the board.
- **E3 · The RTD and its self-heating.** A Pt100 changes 0.3851 Ω/K, and 1 mA of
  excitation makes 385.1 µV/K. That current dissipates 100 µW, which at 0.5 K/mW is
  0.0500 K of self-heating error. A 1 Ω lead resistance in a two-wire connection reads
  as 2.597 K. Measured: the slope, the self-heating, and the two-wire error against
  four-wire.
- **E4 · The thermocouple and its cold junction.** A type K junction gives 41 µV/K, so
  a 0 to 1000 K span needs a gain of 243.9 to reach 10 V. A 1 mV amplifier offset
  reads as 24.39 K, and 1 K of cold-junction error reads as 1 K. Measured: the gain,
  the offset referred to temperature, and the cold-junction correction.
- **E5 · The anti-aliasing filter, designed.** A 12-bit converter has a 74.0 dB
  ceiling. At 1 MSPS with a 100 kHz band the first alias arrives at 900 kHz, nine
  times the corner. A Butterworth filter therefore needs order 3.877, which rounds to
  4. That order gives 76.34 dB there and costs 3.010 dB at the corner. Oversampling
  four times drops the order to 2.325. Measured: the required order, the attenuation
  at 900 kHz for orders 3 and 4, and the passband droop. **Design task:** meet 74 dB
  of alias rejection with a passband flat to 0.1 dB at 100 kHz.

### Group F: Filters to a specification (5)

- **F1 · The specification sets the order.** For 0.5 dB at 100 kHz and 40 dB at
  500 kHz, `n ≥ log₁₀((10⁴ − 1)/ε²)/(2 log₁₀ 5)` gives 3.515, so a Butterworth filter
  needs order 4. It then reaches 55.92 dB at 500 kHz, 15.92 dB more than asked.
  Measured: the exact order, the realised attenuation, and the 130.1 kHz corner that
  puts 0.5 dB at 100 kHz.
- **F2 · Chebyshev buys order with ripple.** The same specification needs order 2.770,
  which rounds to 3, and the realised attenuation is 44.58 dB. One section fewer, at
  the price of 0.5 dB of ripple across the passband. Measured: the order, the ripple,
  and the attenuation.
- **F3 · Bessel buys group delay with order.** A fourth-order Bessel filter holds its
  group delay to 0.0078 % at the corner and 1.26 % at twice the corner, where a
  fourth-order Butterworth filter changes by 41.4 % at the corner. Its magnitude is
  0.630 dB down at the delay-normalised corner. Measured: both group delays at three
  frequencies, and the step response overshoot of each.
- **F4 · Sallen–Key, and where its sensitivity sits.** `f_0` has a sensitivity of
  −1/2 to each of the four parts and Q has ±1/2 to the two capacitors, so 1 % parts
  give 0.333 % on `f_0` and 0.236 % on Q. Measured: the sensitivities from
  `sensitivity`, each against a finite difference, and the spread from Monte Carlo.
- **F5 · Multiple feedback, and the gain-bandwidth error.** The same corner and Q
  inverting. With a 1 MHz part the corner falls to 91.97 kHz, 8.03 % low, against the
  Sallen–Key section's 1.68 % at the same part, because the inverting topology's noise
  gain is higher. At 10 MHz the error is 0.723 %. Measured: the corner error for both
  topologies at three parts. **Design task:** meet F1's mask with parts no faster than
  3 MHz, and say which topology and which order.

### Group G: Protection and the real world (4)

- **G1 · Clamping an overvoltage.** A series resistor and two clamp diodes to the
  rails. From a 100 V transient, 1 kΩ limits the diode current to 100 mA, and 8.8 kΩ
  holds it to 10 mA. The resistor's noise and its bias-current drop are the price.
  Measured: the clamp current, the added noise, and the offset the resistor adds
  through the part's bias current.
- **G2 · The input stage's own limits.** Beyond the rails an input transistor's
  junction conducts, and the part latches or draws current. The three-region model
  shows the path. Measured: the input current against the applied voltage, and the
  voltage at which it leaves the linear region.
- **G3 · Ground loops, and the differential input as the cure.** A 100 mA return
  current in 10 mΩ of ground makes 1.00 mV of difference between two boards. A
  single-ended input adds all of it to the signal. A differential input with 100 dB
  of rejection adds 10.0 nV. Measured: the ground voltage, and the error through both
  input types.
- **G4 · Cable capacitance and the driven shield.** One metre of coaxial cable at
  100 pF/m from a 10 kΩ source rolls off at 159.2 kHz. Driving the shield from a
  buffer leaves about 1 % of the capacitance, so the corner rises to 15.92 MHz.
  Measured: both corners, and the buffer's own loop margin with the shield as its
  load.

### Group H: Timers, the lock-in, and the audio output (5)

- **H1 · The 555 astable.** Two comparators, a flip-flop and an RC. With
  `R_A = R_B = 10 kΩ` and `C = 10 nF` the high time is `ln 2 (R_A + R_B) C =
  138.6 µs`, the low time is `ln 2 R_B C = 69.31 µs`, the period is 207.9 µs, the
  frequency is 4.809 kHz and the duty cycle is 66.67 %. Every edge is an event, so the
  period is exact. Measured: both times, the frequency, the duty cycle, and the count
  of events per period.
- **H2 · The 555 monostable.** One trigger, one exponential to two thirds of the
  supply. `T = ln 3 · RC = 1.0986 ms` with 100 kΩ and 10 nF, and the datasheet's
  1.1 RC is that logarithm rounded. Measured: the period, the exponential between the
  edges, and the difference between `ln 3` and 1.1.
- **H3 · The lock-in amplifier.** A 1 µV signal under 10 nV/√Hz of noise in a 100 kHz
  band has a signal-to-noise ratio of −10.00 dB. Multiplying by a reference at the
  signal frequency and low-passing to 1 Hz leaves 10.0 nV of noise, so the ratio
  becomes 40.00 dB. The improvement is `√(B_in/B_out) = 316.2`, which is 50.00 dB.
  Measured: both ratios, the improvement, and the recovered amplitude within 1 %.
- **H4 · Thermal runaway, and the `V_BE` multiplier.** At fixed `V_BE` a bipolar
  collector current rises 8.043 % per kelvin, so a class AB stage biased by a fixed
  voltage runs away. A `V_BE` multiplier at `R₂/R₁ = 1` gives `2 V_BE` with a
  −4.00 mV/K tempco, which tracks the two output junctions. Measured: the current rise
  per kelvin, the multiplier's voltage and tempco, and the quiescent current over 60 K
  with and without it.
- **H5 · The safe operating area.** A class B pair on ±20 V rails into 8 Ω delivers
  25.0 W at 78.54 % efficiency, and its worst-case device dissipation is
  `V_cc²/(π² R_L) = 5.066 W` at 40.53 % efficiency, not at full power. At 2 K/W that is
  10.13 K of junction rise. Measured: the output power, the worst-case dissipation and
  the efficiency at which it occurs, and the junction temperature. **Design task:**
  reach 20 W into 8 Ω with the junction under 125 °C in a 45 °C enclosure.

### Group I: Corners, sensitivity, Monte Carlo and the canon (5)

- **I1 · Sensitivity names the part to tighten.** For the non-inverting amplifier at
  gain 11, `S` to `R_f` is 10/11 and to `R_g` is −10/11, so a 1 % error on either
  moves the gain 0.909 %. For the Sallen–Key section, `f_0` has `S = −1/2` on four
  parts and Q has `S = ±1/2` on two. Measured: every sensitivity against a finite
  difference to 10⁻⁶, and the ranked list matching Circuit Lab's "Blame the right
  part".
- **I2 · Corners are the vertices of a box.** Four parameters give sixteen vertices.
  With the part's gain-bandwidth spread from 0.5 to 1.5 MHz, the Sallen–Key corner
  runs from 94.52 kHz to 99.20 kHz. The pane names the worst vertex and states the
  monotonicity it assumed. Measured: every vertex, the worst case, and the face check
  of §2.3 firing on a deliberately non-monotone output.
- **I3 · Monte Carlo is a different question.** With 1 % parts read as three sigma,
  `σ = 0.3333 %`, `f_0` has `σ = 0.3333 %` and Q has `σ = 0.2357 %`. Over two million
  runs the measured sigmas are 0.3335 % and 0.2358 %. The worst-case corner of 2 % is a
  six-sigma point that no sample of this size contains. Measured: both sigmas, the
  corner, and the probability of all four parts at three sigma, 3.32 × 10⁻¹².
- **I4 · Yield is a number with an error bar.** For `f_0` within 1 %, the measured
  yield is 99.730 % and the closed form gives 99.730 %. For Q within 0.5 % it is
  96.593 % against 96.611 %. Both together give 96.33 %, which equals the product,
  because the two are independent here. The standard error at two million runs is
  0.0139 %. Measured: all three yields, both closed forms, and the standard error.
- **I5 · The canon, reproduced.** Four real parts, each as a parameter set, each
  reproducing its datasheet's headline numbers. The 741's 1 MHz and 0.5 V/µs give a
  90.91 kHz corner at gain 11. The 555 gives H1's 4.809 kHz. The LM317 with 240 Ω and
  720 Ω gives 5.00 V, and its 50 µA adjust current adds 36.0 mV. The NE5532's
  9 V/µs reaches full power to 143.2 kHz at 10 V peak, and its 5 nV/√Hz gives
  0.7071 µV rms over 20 kHz. Measured: each headline number against the model.

---

## 6. Hand-overs

- **→ Control Lab** (B1, B2, B3, B4, B5, D2, G4). The loop gain T(s) as
  `plant=custom` with `ctrl=p:1`, exactly as Electronics Lab L5 does. The mapping is
  exact and is presented without hedge (CORE_SCOPE counter-rule). Tested both ways:
  the margins agree and the link round-trips.
- **→ Signal Lab** (E5, F1, F2, F3). A filter of order two or less crosses as the raw
  coefficient tier. A higher-order filter crosses as a cascade of second-order
  sections with the order stated, and a section that is not second order is declined
  with the reason. E5's alias is shown in Signal Lab's Sampling group by
  cross-reference, and the two labs' corner frequencies are pinned equal.
- **→ Power Lab** (D5). The same 3.3 V rail at the same load, as a buck. The
  hand-over states the efficiency and the output ripple on both sides, and the two
  numbers are pinned. Power Lab's Group H closes its own loop, and this lab does not
  reopen it.
- **← Electronics Lab.** Group A's toggles become this lab's six parameter sets. L1 to
  L6's loop machinery is B1 to B5's. J3's CMRR becomes C1's resistor matching. O2 and
  O4's densities become A4's budget. M6's class B becomes H5's output stage. Nothing
  is copied, and every link is a deep link with values.
- **→ Analog IC Lab** (tier 3). Every circuit here reappears on a die, where a
  resistor costs area and a capacitor is small. The bandgap of D1 is the same law with
  a different multiplier, and the two labs pin `M = 11.79` and `V_ref = 1.2836 V`
  equal.
- **→ Mixed-Signal Lab** (tier 4). C4's chopper crosses with its guard, and the
  Mixed-Signal Lab solves it as the switched circuit it is. E5's anti-aliasing filter
  is the front of that lab's sampler, and the same `f_s` and order are pinned in both.
- **→ Instruments Lab and Photonics Lab.** H3's lock-in is the Instruments Lab's
  lock-in, and B3's transimpedance amplifier is the Photonics Lab's receiver. Both are
  cross-references by name, as Power Lab does with Signal Lab.

---

## 7. Testing discipline

- **Unit** (`packages/network`): `specify` against hand margins for every comparison.
  `corners` against a direct solve at each vertex. `sensitivity` against central
  finite differences at three step sizes. `monteCarlo` against the analytic mean and
  variance of a linear output. `parts.js` against the six datasheet tables.
- **Invariants** (§2.8), fuzzed across the library and the parameter boxes. Four
  hostile cases are included. A non-monotone output over the box, a yield of exactly
  zero or one, a spread with a zero-tolerance parameter, and a specification whose
  measured value matches its target.
- **Experiments**: every number in §5 pinned, the way every other lab pins its notes.
  Among them are 90.92 kHz, 1.68 %, 7.958 kHz, 41.6 mV, 31.41°, 0.892 pF and 53.98 dB.
  Also 88.10 dB, 1.2836 V, 17.69 ppm/K, 68.93°, 24.0 %, 385.1 µV/K and 3.877. Also
  3.515, 8.03 %, 138.6 µs, 316.2, 8.043 %/K, 5.066 W, 99.730 % and 0.0139 %.
- **The map's promises**: a test walks every `why` and every cross-reference in it. It
  requires the referenced experiment to exist in the named lab. A reference to an
  Electronics Lab experiment that is not built fails the suite. That is what makes §1
  a dependency list rather than a wish.
- **Guards**: the monotonicity check on `corners`, the chopper's bandwidth ratio, the
  Signal Lab order refusal, and the yield's standard error. Each is tested at both
  sides of its threshold.
- **Cross-lab pins**: B1's margin in Control Lab, D5's efficiency in Power Lab, and
  E5's corner in Signal Lab. Then D1's bandgap in the Analog IC Lab, and C4's guard in
  the Mixed-Signal Lab.
- **Playwright harness**: the specification pane names the binding limit and updates
  when a knob moves. The ensemble view's yield count matches the runs drawn. No
  horizontal scroll at 390 px.
- **REVIEW_PLAYBOOK audit** before release, all eleven classes, a screenshot pass, and
  a sittings script with three seats. One seat sits a design task, because the design
  task is the genre this lab introduces.

---

## 8. Integration and the dark launch

The mechanism is the one Power Lab and the Elements lab share, unchanged.

- Deployed **dark** at `/applied-analog-lab/` from the first vertical slice. Unlisted,
  not secret.
- `apps/applied-analog-lab/RELEASE_STATUS` reads `dark`. A test asserts that while it
  does, the splash, the root README and the other labs' LabNav contain no reference to
  this lab. Flip the word to `released` and the same test demands the splash card, the
  README row and the nav entries, with counts pinned.
- `deploy.yml` gains one `cp` line, from this lab's `NEEDS.md`, added by the director
  at integration (`PROGRAM.md` §5).
- `progression.test.js` gains this lab's ids and counts, by the same route.
- The flip is **Reed's action**, after the release gate in §9.

---

## 9. Phasing

Each phase ships green and deployable dark. Phase 0 is a gate rather than work.

0. **The Electronics Lab gate.** Groups A, C, D, F, G, I, J, L, M and O built and
   merged. Nothing below starts before it. Exit: `smallSignal`, `transferOf`, `returnRatio`,
   `noise.js` and the op-amp macro all merged and fuzzed green.
1. **The method engine.** `specify`, `corners`, `monteCarlo`, `sensitivity`,
   `parts.js`. Invariants 1 to 9 fuzzed green before any UI exists. Exit: the
   Sallen–Key section's sensitivities and its Monte Carlo sigmas pinned.
2. **The shell and the two panes.** App skeleton, dark deploy, `RELEASE_STATUS` test,
   `SpecPane`, and the `EnsembleCanvas` props agreed with the Random Signals Lab.
   **Group A** (6). Exit: the pane names the binding limit at 390 px, and A1 to A6 are
   pinned.
3. **Loops on a board.** The loop view and the Control Lab link. **Groups B, C** (10).
   Exit: B1's margin agrees with Control Lab's, and C4's guard is tested at both sides
   of 10.
4. **Supplies and sensors.** The thermal view. **Groups D, E** (10). Exit: D1's
   17.69 ppm/K and D2's three margins pinned, and D5's link to Power Lab tested.
5. **Filters and protection.** The spec mask on the Bode view. **Groups F, G** (9).
   Exit: F1's order 4 and F5's 8.03 % pinned, and the Signal Lab link tested both
   ways.
6. **Timers, the lock-in and audio.** **Group H** (5). Exit: H1's 207.9 µs from the
   event count, and H3's 50.00 dB improvement.
7. **The method group.** **Group I** (5), and the design tasks in every earlier group
   made editable. Exit: I4's yields within three standard errors of their closed
   forms, and every design task reachable with a passing answer.
8. **The release gate**, in order, each blocking the next. The full audit. The
   sittings. Reed's own pass against the dark deployment. Then the flip.

---

## 10. Non-goals (v1, stated so they are decisions rather than omissions)

- **A schematic capture tool.** Curated circuits with editable values, as every other
  lab. A design task moves values and part choices, never topology.
- **SPICE-level part models.** A datasheet's typical column is the model, and the pane
  says which fields it read. Minimum and maximum columns appear only as corner boxes.
- **Layout, coupling and electromagnetic effects.** `ANALOG_ROADMAP.md` §5 keeps them
  out, and no experiment here needs them.
- **The bench as a data source.** The `bench` note names the instrument and its floor.
  Nothing is loaded from one (`EE_LABS_MAP.md` §5).
- **The chopper's exact switched form.** Guarded here, exact in the Mixed-Signal Lab.
- **Switching regulator design.** D5 hands to Power Lab and stops there.
- **Analog computing, log amplifiers and multipliers.** The Analog IC Lab's translinear
  group owns them.
- **Optimisation.** The lab measures a margin and ranks sensitivities. It does not
  search a parameter space for the reader.
- **Worst-case analysis past the box.** Root-sum-square and vertex methods only. An
  interval-arithmetic bound is a different object with a different guard.
- **Reliability, derating and aging.** `ANALOG_ROADMAP.md` §5 keeps them out.

---

## 11. Risks, named

- **The dependency is the whole of Electronics Lab.** Ten of its fifteen groups gate
  this one. Mitigation: §1 lists them by id, `BACKLOG.md` mirrors them, and the
  progression test fails on a reference to an unbuilt experiment rather than shipping
  a broken link. Phase 1 is engine work that needs none of them, so it can start
  early.
- **Two labs need the specification pane at once.** Decision 3 names it. Mitigation:
  the contract in §4.3 carries the DSP Lab's `mask` prop from the start, and the
  director picks the order.
- **The ensemble view arrives from another lab.** Decision 4 names it. Mitigation:
  the two extra props are stated here, and the fallback is a one-commit addition by
  the director with its test.
- **Monte Carlo runtime.** Two million solves of a five-node circuit is fast, and two
  million solves of a two-stage op-amp is not. Mitigation: the default is 2000 runs
  with the standard error printed. The large runs are reserved for linearised outputs,
  where `sensitivity` gives the sigma in closed form. I3's two million is a
  precomputed pin rather than a live run.
- **The design task changes the genre.** Every lab today loads a setup and asks a
  question. A design task states a target and asks for values, which is a different
  reading experience and a different failure mode. Mitigation:
  `ANALOG_ROADMAP.md` §3 asks for it to be prototyped in the first group, so A6 is
  the prototype and the sittings decide whether it spreads.
- **Corner counts explode.** Six parameters give 64 vertices, and a reader cannot
  read that table. Mitigation: the box is capped at four parameters per experiment,
  the parallel coordinates view carries the rest, and `sensitivity` ranks which four
  matter.
- **Datasheet numbers drift between parts.** Six sets of eight numbers is 48 facts
  that could be typed wrong. Mitigation: each set cites the datasheet field it comes
  from, and the canon of I5 reproduces four of them from the model. No number is
  quoted in a lesson that the analysis does not produce.
- **Cost.** Four new functions, two new canvases, nine groups and 45 experiments,
  behind a nine-group gate in another lab. Mitigation: Phase 1's engine is small and
  independently useful, and Phases 2 and 3 are a complete short course on choosing an
  op-amp and keeping its loop stable.
