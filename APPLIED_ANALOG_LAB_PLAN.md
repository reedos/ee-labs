# Applied Analog Lab: the plan

> Current Group H checkpoint, 2026-09-09: Groups A–H are implemented. The Group H record describes actual models and corrections to draft examples. Groups I onward and broader engine/product features remain planned. Earlier checkpoints are historical.
> Local implementation checkpoint, 2026-09-08: Group A (six lessons) is implemented. The six device classes are explicitly illustrative curriculum models, not current manufacturer specifications. A1/A2 compare closed forms with native nodal AC solves; A3 uses the native limited op-amp transient; A4–A6 teach stated noise, error and supply budgets. Later groups, datasheet-specific model libraries, general sensitivity/Monte Carlo tools and design synthesis remain future work.

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

### Group B: Stability on a board (5) — implemented

All five use finite DC gain A0=100,000 and a single dominant amplifier pole.
Native nodal AC and independently broken-loop return ratios check the displayed
transfer functions. Native state propagation checks the small-step response.

- **B1 · Capacitive loading.** At GBW=10 MHz, Ro=50 Ω and CL=1 nF,
  fx=5.21206 MHz, PM=31.4143°, output bandwidth=8.26761 MHz and first-peak
  overshoot=39.702%. The load pole is 3.18310 MHz.
- **B2 · Isolation and load accuracy.** The same model includes both Riso and RL.
  Riso=50 Ω with RL=1 kΩ gives PM=76.4740° and a 4.76190% divider loss from
  the sensed amplifier output to the load. Earlier unloaded-margin numbers are
  not used as if they included the 1 kΩ load.
- **B3 · Uncompensated TIA.** Rf=1 MΩ and Cin=25 pF give a 6.36620 kHz noise-gain
  zero. Exact finite-A0 crossover is 252.273 kHz and PM=1.46828°. The square-root
  crossover estimate is labeled asymptotic.
- **B4 · Compensated TIA.** The approximate Cf sizing gives 0.892062 pF,
  fx=380.479 kHz and PM=65.8180°. The **feedback RC pole is 178.412 kHz**, while
  the **actual closed-loop −3 dB bandwidth is 247.822 kHz**. The earlier draft
  conflated them. Cf voltage depends on the summing-node and output states;
  the two independent state equations are shown and propagated with native expm.
- **B5 · Composite loop.** Two GBW=1 MHz stages, inner gain 10 and outer gain
  100 give crossover=78.6116 kHz, PM=51.8386° and bandwidth=127.200 kHz.
  The design target is explicitly **100 kHz loop crossover and 45° PM**;
  GBW=1.5 MHz with inner gain 10 meets both in the stated linear model.

Loop handovers send exact return-ratio coefficients to Control Lab. That app's
T/(1+T) response is distinguished from the load-voltage transfer where necessary.
Large-signal clipping/slew, device extra poles and board parasitics remain outside
these models. Groups C–E are implemented below; Groups I onward remain planned.

### Group C: Precision (5) — implemented

- **C1:** Four independently adjustable resistor errors. Exact finite-open-loop-gain
  nodal solve, differential/common-mode decomposition and signed output error.
  Opposing 0.1% errors give 53.9794 dB CMRR; perfect ratios give exact common-mode
  cancellation within this model, not a fabricated finite CMRR.
- **C2:** Native three-op-amp solve. R=24.9 kΩ and RG=1 kΩ give ideal first-stage
  differential gain 50.8. Finite gain corrections apply separately to common and
  differential modes. All three outputs receive an explicit headroom check.
- **C3:** Offset follows noise gain; input referral uses absolute signal gain.
  The general bipolar class consistently uses Group A's 10 µV/K drift, so gain
  1000 over 60 K adds 600 mV to its 1 V initial offset (superseding 180 mV).
- **C4:** An ideal ±1 chopper and first-order RC filter have an exact periodic
  state checked against the native transient solver. Peak ripple is
  A tanh(T/(4τ)); the fundamental amplitude is (4A/π)/sqrt(1+(fchop/fc)^2).
  The familiar 12.73 mV default approximation is the fundamental, not total peak
  ripple. A separately specified residual offset remains; the approximation is
  accepted only at fchop/fc >= 10.
- **C5:** Two endpoint measurements calibrate a declared synthetic 10 mV bridge
  channel mapped to 10 V output. Initial offset/gain errors cancel at those
  endpoints. Drift and curvature remain, divided by the calibration gain.
  An analytic worst-error search includes any interior stationary point and
  checks the 0.05% full-scale target over the chosen temperature change.

Each lesson includes symbol definitions, worked substitutions, adjustable
parameters, practice, and a plot/table using the existing learning workbench.
These are declared circuit/error models rather than fabricated bench measurements.

### Group D: References and regulators (5) — implemented

All five lessons retain the four-view learning workbench, defined symbols,
worked substitutions, interactive plots, aligned tables and practice answers.
The draft numerical targets are superseded by the actual model checks below.

- **D1 · Reference temperature compensation.** Shared with Analog IC B3: at
  300 K and N=8, PTAT slope is **179.1924 µV/K**, including ln N. CTAT slope
  is −2.111853 mV/K, M*=11.785395 and Vref=1.283556 V. With fixed optimal
  weight, exact endpoint/interior extrema give 3.760148 mV variation over
  −40 to 125 °C and 17.754407 ppm/K box coefficient. A local zero derivative
  does not remove curvature. Fractional trim moves the stationary temperature.
- **D2 · LDO stability and ESR.** Declared A0=10,000, amplifier pole=100 Hz,
  gm=0.1 S, Rp=10 kΩ, β=1.25/3.3, IL=100 mA and Cout=10 µF. With ESR=0.1 Ω,
  the actual parallel-load pole is 482.4126 Hz, zero=159.1549 kHz,
  crossover=24.6593 kHz and PM=10.1604°. ESR=1 Ω gives crossover=39.6142 kHz
  and PM=68.9354°. ESR=0 has no finite zero. Native loop breaking, native
  closed-loop AC and independent capacitor-state propagation verify the
  derived rational transfer and two-state step. All unity crossings use
  unwrapped phase. The exact return ratio hands over to Control Lab.
- **D3 · Supply rejection.** Rp connects to the driven supply. The actual
  supply transfer is Zo[gds + gm A(s)ρ + gm α/(1+sτa)]/(1+T).
  Reference coupling ρ and amplifier-drive coupling α are explicit controls;
  complex paths are added before computing magnitude. PSRR is −20 log|Hs|,
  **not generally 20 log|1+T|**. Native supply excitation checks every path.
- **D4 · Dropout, heat and load pole.** The declared Ron headroom test rejects
  infeasible targets without claiming a nonlinear dropped-out voltage.
  Loss includes Vin IQ. At 12 V/100 mA with zero IQ the original 0.87 W,
  27.5% and 43.5 K rise remain valid; the default 50 µA IQ adds 0.6 mW.
  Temperature uses the same loss and named θJA. The load-dependent pole
  retains pass output resistance; it is conditional on regulation.
- **D5 · Regulator selection.** At 5 V/200 mA, 100 nV/√Hz linear white noise
  integrates to 31.6228 µV RMS in 0–100 kHz; 500 nV/√Hz buck noise gives
  158.1139 µV RMS. One sinusoidal ripple tone is counted separately when in
  band, and its unfiltered ADC alias is shown. The 90% buck efficiency is
  an explicit scenario assumption, not a simulated result. At 12 V/1 A,
  zero-IQ linear loss is 8.7 W and assumed buck loss is 0.366667 W. The
  Power Lab B3 link transfers an editable ideal buck operating point with
  the same Vin, desired duty, load and switching frequency; it does not
  transfer or certify efficiency/noise assumptions. Incoming links are validated.

These lessons use a reference-core temperature law, a linear incremental LDO,
a conditional DC/steady thermal budget and an architecture comparison. They
do not claim a complete transistor-level reference, nonlinear LDO startup,
modern-part ESR specification, or a finished switching-regulator design.

### Group E: Front ends (5) — implemented

- **E1 · High-side current sensing.** Exact difference-amplifier KCL with a declared four-resistor tolerance corner. Differential-gain error and common-mode leakage are separately input-referred. At G=1, t=0.001 and 12 V common mode, the exact common-mode term is −24.024 mV; 24 mV is its first-order estimate. A separately specified 100 dB CMRR produces 120 µV input error.
- **E2 · Low-side sensing and grounding.** Kelvin sensing excludes the shared trace from the readout. The load return still rises by I(Rs+Rt), not just I·Rt. The extra trace drop and total return rise are separate readings.
- **E3 · RTD excitation and self-heating.** Explicit local linear Pt100 law, slope 0.3851 Ω/K, with exact electrothermal equilibrium and one thermal state. A per-lead resistance is counted twice. Four-wire sensing removes lead error, not self-heating. This is not the full IEC CVD calibration.
- **E4 · Thermocouple and cold junction.** Nonlinear ITS-90 type K direct function and bounded numerical inverse, with cold-junction compensation on the voltage scale. Local hot/cold sensitivity explains offset and cold-sensor error. The constant 41 µV/K shortcut is compared rather than used over a 1000 °C span.
- **E5 · Anti-aliasing design.** Both Butterworth inequalities determine the allowed corner interval and minimum integer order. At 1 MSPS, 100 kHz band, 74 dB rejection and 0.1 dB passband loss, order 5 is required; the earlier order-4 example admitted 3 dB passband loss. The selected order and corner each receive pass/fail checks.

These are explicit teaching models, not a datasheet-qualified sensor interface or automatically synthesized hardware.

### Group F: Filters to a specification (5)

Implemented Group F model record (2026-09-08); this supersedes the earlier draft numerical promises.

- **F1:** Butterworth order 3.51484 rounds to 4 for the default mask; corner 130.075891 kHz and achieved stopband attenuation **46.781947 dB**, correcting the former 55.92 dB claim.
- **F2:** Chebyshev I order 2.770009 rounds to 3, giving 44.579241 dB. Ripple-edge normalization and odd/even DC behavior are explicit.
- **F3:** Reverse Bessel polynomial [1,10,45,105,105], then both fourth-order prototypes scaled to the same −3 dB frequency. Bessel q3=2.113917675. At 100 kHz its DC delay is 3.364404 µs and sampled step overshoot about 0.834%; Butterworth overshoot is about 10.830%. Analytic group delay and zero-state companion dynamics describe the same transfer.
- **F4:** Unity follower, R1=R2=1 kΩ, Cf=2 nF, Cg=1 nF. Four independent uniform ±t part errors give first-order σf/f=t/√3 and σQ/Q=t/√6. Numerical sensitivities and 2000 seeded builds check these predictions; the old tolerance-to-spread numbers are superseded.
- **F5:** Explicit SK and equal-resistor MFB topology, solved by complex KCL with A(s)=2πGBW/s. No empirical GBW error constant. The two fourth-order pole pairs can be retuned with frequency and Q multipliers. At 3 MHz GBW, SK with corner ×1.1 and Q ×0.95 meets the default sampled mask; MFB with corner ×1.2 and Q ×0.95 also meets it. This is a retuned mask-compliant response, not an exact ideal Butterworth prototype.

### Group G: Protection and the real world (4) — implemented

Implemented Group G model record (2026-09-09); this replaces the draft numerical promises.

- **G1:** Constant-drop clamps to ±12 V with VF=0.3 V. At +100 V, 1 kΩ carries 87.7 mA; 8.77 kΩ meets the exercise's 10 mA limit. Native PWL verifies both polarities and zero-current boundaries. Rectangular pulse energy, 20 kHz resistor noise and 100 nA bias error are separate quantities.
- **G2:** ±5 V rails, 0.65 V junction drops and a separately declared ±4.5 V signal range. The 5.2 V case has no clamp current but is outside the signal range. No latch-up or phase-reversal behavior is claimed.
- **G3:** 100 mA through 10 mΩ gives 1 mV remote-ground lift. A 100 dB differential receiver has 10 nV incremental error from that lift; the baseline signal common-mode contribution is calibrated out.
- **G4:** Cc=CL=100 pF/m, source resistance, amplifier A(s)=ωt/s and output resistance define the full driven-shield circuit. Both KCL equations retain source bootstrapping. Closed cubic poles and Routh's criterion determine stability; unstable settings do not report operating bandwidth. The fixed 0.99 tracking example is hypothetical. Control Lab receives the exact third-order return ratio, distinct from the source-to-signal transfer.

### Group H: Timers, synchronous detection and audio output (5) — implemented

Implemented Group H model record (2026-09-09); this supersedes draft timing, noise and thermal claims.

- **H1:** Ideal 555 latch/threshold events, exact RC propagation and capacitor continuity. Defaults give recurring high/low times 138.629/69.315 µs, 4.808983 kHz and 66.667% duty. Uncharged startup has a different first high pulse, ln3·(RA+RB)C. Comparator delays and finite discharge resistance are omitted.
- **H2:** Brief trigger, released before timeout, and a stated initial capacitor voltage. Pulse width is RC·ln[(VCC−v0)/(VCC/3)]. At v0=0, ln3·RC=1.098612 ms; 1.1RC is a rounded approximation. Post-timeout discharge and held-trigger/retrigger behavior are not modeled.
- **H3:** RMS sine amplitude and a unit-RMS √2 cosine reference make the in-phase DC output Vs·cosφ. A first-order low-pass has ENBW=1/(4τ), not its −3 dB corner. Finite input-band edges are retained in the noise integral. Defaults give approximately −10 dB input and 40 dB aligned output SNR. Startup baseband settling, residual 2f ripple and a seeded stationary noise draw are separated; no guaranteed per-draw 1% recovery is claimed.
- **H4:** An explicit local VBE(I,T) law with −2 mV/K fixed-current coefficient, matched two-junction bias, sensor tracking and emitter degeneration. The reference fixed-bias, zero-degeneration logarithmic current slope is approximately 7.736%/K at 300 K. KVL gives current; differentiation gives the local thermal-loop criterion. Increasing current under an imposed temperature is not by itself a runaway simulation.
- **H5:** Exact sine-cycle class-B load/supply/device power. Worst average device heating is VCC²/(π²RL)=5.066059 W at Vm=2VCC/π and **50% efficiency**. The 40.53% figure is output power relative to full scale. The 20 W design task checks worst-amplitude temperature plus a declared illustrative 3 A / 60 V / 15 W instantaneous envelope. Real transistor SOA, reactive loading, thermal lag and shared heatsinks remain outside this model.

### Group I: Corners, sensitivity, Monte Carlo and the canon (5) — implemented

- **I1:** Normalized sensitivities are derived from the ideal non-inverting gain and unity-follower Sallen–Key denominator, with numeric substitutions and finite-change comparisons. Natural-frequency sensitivities are −1/2 for all four passives. At matched resistors, Q sensitivities are 0, 0, +1/2, −1/2 in R1/R2/C1/C2 order.
- **I2:** All sixteen passive-box vertices are evaluated at the selected GBW. Ideal f0 bounds follow from a monotonicity proof; finite-follower cutoff uses the full cubic and is described as a vertex search, not a certified global bound. A Q face check demonstrates an interior maximum at R1=R2. Native nodal solves verify the cubic at every vertex, including 0.5–1.5 MHz GBW.
- **I3:** Seeded Gaussian component ensembles (200–10,000 circuits, default 2,000) compare exact ideal-circuit outputs with linearized errors. Three-sigma spread t gives sigma_f=t/3 and sigma_Q=t/(3√2). Empirical quantiles, estimator uncertainty and a measured linearization-residual check accompany the estimates. A residual above 1% of predicted sigma changes the conclusion. A Gaussian has no hard box; exact corner events have zero probability. The draft two-million-run and corner-probability claims are not live measurements and are superseded.
- **I4:** Frequency, Q and joint pass counts include pointwise 95% Wilson intervals, including zero-failure cases. The analytic product is justified only for independent, equal-variance Gaussian component errors propagated to first order. Default analytic yields are 99.7300204%, 96.6105146% and 96.3496860%; exact nonlinear joint yield is measured directly. A sample count and seed accompany every estimate.
- **I5:** Separate 741, 555, LM317 and NE5532 calculations identify source fields and approximations. TI's LM741 product table supplies typical 1 MHz GBW (90.9091 kHz ideal gain-11 estimate); ideal timer thresholds give 4.808983 kHz. LM317 typical 50 µA adjust current raises 5.000 V to 5.036 V. TI NE5532 SLOS075K specifies typical 5 V/µs, giving 79.5775 kHz at 10 V peak; extending its 5 nV/√Hz white density over 20 kHz gives 0.707107 µV rms. The draft 9 V/µs value is not attributed to this revision.

All nine curriculum groups now have lessons. Generic reusable method-engine APIs, expanding every earlier design exercise into an editable specification, the full release audit and reader sittings remain separate planned work; this implementation does not claim those gates are complete.


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
  Also 88.10 dB, 1.2836 V, 17.7544 ppm/K, 68.93°, 24.0 %, 385.1 µV/K and 3.877. Also
  3.515, 8.03 %, 138.6 µs, 316.2, 7.736 %/K, 5.066 W, 99.730 % and 0.0139 %.
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
   17.7544 ppm/K and D2's three margins pinned, and D5's link to Power Lab tested.
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
