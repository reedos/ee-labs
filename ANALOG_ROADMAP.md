# Analog electronics, all the way: the roadmap

Reed's aim (2026-09-05) is to cover analog electronics in full, from the first
transistor to the circuits and methods a working engineer uses. This document maps
that path as tiers. Each tier is one lab, with what it covers, what it leans on, the
engine it needs, and where `CORE_SCOPE.md` admits, guards or declines its objects. It
is an outline. A tier gets a plan file of its own, in the shape of the existing ones,
when the tier before it is built enough to know what it hands over.

"Everything" has three axes, and the tiers are cut across all three:

- **Circuits.** From the single stage to the op-amp, the reference, the converter and
  the front end.
- **Methods.** What industry does that a course does not: design to a specification,
  corners, yield, the datasheet as a model, and the bench.
- **Contexts.** The board, the chip, the sampled world, and the radio.

The suite's rules hold at every tier. Every explanatory sentence is a claim about
physics with a test behind it. Every object is admitted exactly, approximated behind
a guard, or declined with a reason. The last of those is where the upper tiers earn
their place, because industry-level analog is full of objects that a simulator
approximates silently and this suite will not.

---

## 1. The tiers

| Tier | Lab | Mirrors | Size | Engine | Status |
| --- | --- | --- | --- | --- | --- |
| 0 | Circuit Elements Lab, Circuit Lab | Circuits I and II | 55 + 15, plus two seam experiments | `network`, `systems` | built |
| 1 | Electronics Lab | Electronics I and II | 77 | `network` extended (§4) | planned, `ELECTRONICS_LAB_PLAN.md` |
| 2 | Applied Analog Lab | the board-level analog a working engineer designs | about 45 | tier 1's, plus corners and yield | outlined here |
| 3 | Analog IC Lab | analog integrated circuit design | about 45 | tier 1's, plus a subthreshold model, matching, differential analysis | outlined here |
| 4 | Mixed-Signal Lab | sampled circuits, converters, clocks | about 40 | `switched` and `dsp` together, plus charge conservation | outlined here |
| 5 | RF Lab | the radio front end | about 35 | a frequency-domain package, `rf`, at the `systems` boundary | outlined here |

The order is a dependency order. Tier 2 needs tier 1's op-amp, feedback and noise
groups. Tier 3 needs tier 1's amplifiers through its op-amp. Tier 4 needs tier 3's
comparator and op-amp and Signal Lab's sampling. Tier 5 needs tier 3 and tier 1's
frequency response.

One suite rule bears on the split. The README divides labs by interaction model, not
by topic. Tiers 2 and 3 share tier 1's model (a netlist, a schematic, an operating
point, a small-signal view), so the suite's own rule would make them more groups of
one lab. Recommended: **sibling apps that share the shell code**, the way Elements and
Electronics share the schematic renderer, split for length and audience rather than
for model. Tiers 4 and 5 have interaction models of their own (clock phases and a
sampled output, and a Smith chart with S-parameters), so they are separate labs by the
rule itself.

---

## 2. Tier by tier

### Tier 0: built, with two seams to close

Circuits I and II are built as Circuit Elements Lab and Circuit Lab. `CURRICULUM.md`
names two thin seams, from jω to s and the impulse response in continuous time, each
one experiment with no engine work. They are the first things to build, because
every tier above leans on H(s) and on the step as the integral of the impulse.

### Tier 1: Electronics Lab (planned)

The plan is written. It runs from the op-amp's limits and the junction through the
transistor, the amplifiers, the differential pair, frequency response, feedback, the
op-amp from the inside, oscillators and noise. Nothing above it can be built first,
and its engine work (§4) is the foundation for tiers 2 and 3.

### Tier 2: Applied Analog Lab, the board

The circuits a working engineer draws on a board. Each comes with the specification
it is designed to and the reason it fails when it does. The interaction model is tier
1's, with two additions. A **specification** pane states the target and reads the
margin against it. **Corners** re-solve the circuit at the edges of its parameters.

What it covers, grouped:

- **The op-amp, chosen.** The datasheet as the macro model of tier 1's Group A. Which
  limit binds for a given task: gain-bandwidth for a filter, slew for a driver, noise
  for a preamp, bias current for a high-impedance source. Rail-to-rail and single
  supply. The decoupling capacitor and why the pin needs it.
- **Stability on a board.** The capacitive load and the isolation resistor. The
  photodiode transimpedance amplifier, whose input capacitance puts a pole in the
  feedback and whose feedback capacitor restores the margin. The composite amplifier.
  Every loop hands to Control Lab.
- **Precision.** The instrumentation amplifier and its CMRR from resistor matching.
  Offset drift with temperature, from tier 1's Group C. The chopper and auto-zero
  amplifier, as a sampled system with a labelled model (tier 4 owns its exact form).
- **References and regulators.** The bandgap at board level. The LDO: its loop, the
  ESR zero, PSRR against frequency, dropout. The shunt regulator. Where the switching
  regulator takes over, and the hand-over to Power Lab.
- **Front ends.** Current sensing high-side and low-side. The RTD and thermocouple
  interface. The ADC driver and the anti-aliasing filter designed to a spec, with the
  hand-over to Signal Lab for the alias. The reference buffer.
- **Filters to a specification.** Butterworth, Chebyshev and Bessel from a passband
  and stopband, realised as Sallen–Key and multiple-feedback sections, with the
  op-amp's gain-bandwidth as the error on the corner. Circuit Lab's active group,
  designed instead of read.
- **Protection and the real world.** ESD and overvoltage clamps from tier 1's
  diodes. Input current limits. Ground loops and the differential input as the cure.
  Cable capacitance and the driven shield.
- **Corners and yield.** Every circuit above at the process, voltage and temperature
  corners, and under Monte Carlo over part tolerances (Circuit Lab's tolerance idiom,
  generalised). The yield against the spec as a number.

Engine: nothing new in the solver. Corners are the existing solve at the vertices of
a parameter box. Monte Carlo is the existing tolerance sweep over more parameters.
The specification pane is UI. CORE_SCOPE: everything here is admitted, the chopper
amplifier's averaged model is guarded (its ripple is at the chop frequency, and the
guard is the ratio of signal bandwidth to it), and nothing is declined.

### Tier 3: Analog IC Lab, the chip

Analog design as an integrated-circuit designer practises it. The circuits are tier
1's, made from matched devices on one die, where resistors are expensive, capacitors
are small, and every current comes from a mirror.

- **Devices on a die.** The MOSFET below threshold and the `g_m/I_D` method, the
  industry's design procedure, as a view: `g_m/I_D` against current density, and
  every stage designed from it. Matching: Pelgrom's law as a labelled model, so that
  offset and mirror error have a statistical size. Short-channel effects as toggles
  that change a number and are said to.
- **Bias.** The beta-multiplier and the supply-independent reference. The bandgap:
  PTAT from two junctions at different current densities, CTAT from one, the sum flat
  to first order and curved to second. Start-up circuits, and the state the circuit
  sits in without one, shown as a second consistent operating point.
- **Op-amp architectures.** Telescopic, folded cascode, two-stage with Miller and the
  nulling resistor, gain boosting, class AB output, rail-to-rail input. Each with
  gain, bandwidth, swing, noise and power on one table against one specification.
- **Fully differential.** Common-mode feedback, its own loop with its own margin.
  Differential and common-mode half-circuits as the analysis, with the exact solve
  beside them.
- **Compensation.** Nested Miller, feedforward, the nulling resistor's zero moved onto
  the second pole. Every loop hands to Control Lab.
- **Comparators.** Preamplifier and regenerative latch. Offset, hysteresis by design,
  and metastability as the exponential that decides how long a decision takes. The
  latch is positive feedback in a region model, and its time constant is exact.
- **Translinear and multipliers.** The Gilbert cell, the variable-gain amplifier, the
  translinear principle as a loop of junctions.
- **Integrated filters.** `g_m`-C and active-RC biquads, Q enhancement, tuning against
  process spread. The ladder simulated by integrators.
- **Noise and mismatch, designed.** The noise budget of a full op-amp by stage, and
  the input pair sized from it.

Engine: a subthreshold MOSFET model (EKV's interpolation or the simpler exponential
below threshold, labelled), which is one more companion. Pelgrom mismatch as a
statistical parameter on the small-signal model. Common-mode and differential
decomposition as a view over the existing solve. CORE_SCOPE: admitted throughout, the
short-channel toggles are labelled models, and the latch's regeneration is exact
under its region model.

### Tier 4: Mixed-Signal Lab, the sampled world

Circuits with a clock. The interaction model changes: a schematic with switch phases,
a scrub through one clock period, and an output that is a sequence. This is where
`packages/switched` and `packages/dsp` meet, and it is the bridge from tier 3 to
Signal Lab.

- **Sampling as a circuit.** The sample-and-hold: the switch's `R_on`, the acquisition
  time constant, charge injection, and `kT/C` noise from tier 1's Group O now setting
  the resolution.
- **Switched-capacitor circuits.** The SC resistor, the SC integrator, the SC biquad.
  Under ideal switches an SC filter has an **exact H(z)**, which is admitted to
  `systems` without hedge and handed to Signal Lab as the biquad it is. The
  switched-to-continuous approximation is the guarded object.
- **Converters.** The charge-redistribution DAC and the SAR ADC, one decision per
  clock. The flash ADC from tier 3's comparators. The pipelined stage and its residue.
  Static errors (INL, DNL) from mismatch, dynamic errors from settling.
- **Noise shaping.** The delta-sigma modulator, whose quantiser is nonlinear. The
  linear model with the quantiser as additive noise is the approximation, guarded by
  the input amplitude against overload, and the exact switched simulation sits beside
  it. Decimation hands to Signal Lab.
- **Clocks.** The PLL, whose phase detector is nonlinear and whose phase-domain
  linear model is guarded by the lock range. The charge pump and loop filter as a
  Control Lab loop. Jitter as noise on time, and its effect on an ADC's SNR.
- **The chopper and auto-zero, exactly.** Tier 2's labelled model, now solved as the
  switched circuit it is.

Engine: charge conservation at a switch event. Two capacitors joined by a switch form
a capacitor loop, which `packages/network` today declines. The mixed-signal engine
resolves it by conserving charge across the event, an impulsive current, and the
declined case becomes the defining event of this lab. The z-domain extraction of an SC
network's exact H(z). A quantiser as a block in `dsp`, which Signal Lab's 4-bit preset
already has. CORE_SCOPE: the SC filter's H(z) is admitted, the sampled continuous
approximation and the delta-sigma linear model are guarded, and the time-domain
transistor inside the comparator is declined as always, its region model used
instead.

### Tier 5: RF Lab, the radio front end

The high-frequency end of analog, where impedance is matched rather than driven and
the transistor is used near its `f_T`. New interaction model: the Smith chart, the
S-parameter view, and a two-tone spectrum.

- **Matching and two-ports.** Impedance matching with L networks, the Smith chart,
  S-parameters as the industry's two-port description. This is where the two-port
  matrices tier 1 declined come back, because here they are what is measured.
- **The transistor at `f_T`.** Maximum available gain, stability circles, the
  unilateral approximation with its error stated.
- **The low-noise amplifier.** Noise figure, the optimum source impedance from tier
  1's Group O, inductive degeneration, the trade of gain against noise.
- **Mixers.** The Gilbert cell from tier 3 as a multiplier, conversion gain, image,
  and the two-tone test from Signal Lab's Nonlinearity group as IP3.
- **Oscillators and phase noise.** The LC oscillator from tier 1's stretch, its Q and
  its phase noise by Leeson's model, labelled as the model it is.
- **Power amplifiers.** Classes A through C from tier 1's output stage, then class E
  and F as switched (Power Lab's engine), efficiency against linearity.
- **Transmission lines.** Declined at the `systems` boundary by CORE_SCOPE, and that
  does not change. What is admitted is the exact frequency-domain evaluation. At
  each ω the line is an exact complex two-port, and a sweep is exact point by point.
  The rational H(s) does not exist, the pane says so, and time-domain reflections are
  Power Lab's event engine's if anyone wants them.

Engine: a `packages/rf` for S-parameters, the Smith chart geometry, and the
frequency-by-frequency line. It sits at the `systems` boundary and imports nothing
approximate from it. CORE_SCOPE: the line is the worked example the scope document
already gives, and this lab is where its refusal becomes a lesson.

High-speed serial links and optical links are not here. The README names the private
`waveform-simulator` as their home.

---

## 3. The methods industry uses, across the tiers

These are not circuits, and no single tier owns them. Each lands where it is first
needed and is reused above.

| Method | First lands | What it is in the suite |
| --- | --- | --- |
| Design to a specification | tier 2 | a pane that states the target and reads the margin, on every circuit that has one |
| PVT corners | tier 2 | the existing solve at the vertices of a parameter box, with the worst case named |
| Monte Carlo and yield | tier 2 | Circuit Lab's tolerance idiom over every parameter, the yield against the spec as a number |
| The datasheet as a model | tier 2 | tier 1's Group A toggles, read from a real datasheet's table |
| `g_m/I_D` | tier 3 | a design view, current density against efficiency, and every stage sized from it |
| Matching and Pelgrom | tier 3 | a statistical size on every mirror and pair |
| The bench | tier 2 | a "how you would measure this" note on each experiment, naming the instrument and its own floor |
| Settling and dynamic error | tier 4 | time to a fraction of a bit, from the exact transient |
| Two-tone linearity | tier 5 | Signal Lab's nonlinearity presets as IP3 and IP2 |

The design-to-specification pane is the one that changes the suite's genre. Every
lab today loads a setup and asks a question. A design task states a target and asks
for values. It is the same engine and the same tests, with the reader on the other
side of the equation, and it is worth prototyping in tier 2's first group before it
is promised everywhere.

---

## 4. The engine roadmap

| Capability | Package | First tier | CORE_SCOPE stance |
| --- | --- | --- | --- |
| BJT and MOSFET, two models each | `network` | 1 | region models exact, exponential Newton-only |
| Newton over a companion interface | `network` | 1 | exact at the point |
| The small-signal netlist, `transferOf`, `returnRatio` | `network` | 1 | admitted, labelled with the point |
| The op-amp macro and the slew limit | `network` | 1 | admitted, slew exact as PWL |
| Junction closed forms, noise sources | `network` | 1 | admitted |
| Corners and Monte Carlo over any parameter | `network`, `ui` | 2 | exact solves, statistics stated |
| Subthreshold MOSFET, Pelgrom mismatch | `network` | 3 | labelled models |
| Common-mode and differential decomposition | `network` | 3 | a view over the exact solve |
| Charge conservation at a switch event | `switched` | 4 | exact, and today's refusal becomes the event |
| Exact H(z) of a switched-capacitor network | `switched`, `systems` | 4 | admitted |
| Quantiser and delta-sigma loop | `dsp`, `switched` | 4 | exact switched, linear model guarded |
| Phase-domain PLL model | `systems` | 4 | guarded by lock range |
| S-parameters, Smith chart, the line per frequency | `rf` | 5 | exact per frequency, rational form declined |

Two entries decide the shape of the whole roadmap. Tier 1's engine is the foundation
and cannot be skipped. Tier 4's charge conservation is the one place a refusal the
suite already makes is turned into a feature. It should be designed with the
refusal's tests in hand, so that the message and the event agree on where the
boundary is.

---

## 5. What stays out, and why

- **Device physics below the closed forms.** Carrier transport, the diffusion
  equation, band diagrams. A physics course, and tier 1's Group C states what it
  takes on trust.
- **Process design kits and BSIM.** Datasheet facts with hundreds of parameters. The
  labelled short-channel toggles of tier 3 change the numbers a course changes.
- **Layout, extraction and electromagnetic simulation.** No exact form the suite
  could state, and no lesson that survives without the tool.
- **Reliability and aging.** Electromigration, hot carriers, NBTI. Statistical models
  of statistical models.
- **High-speed serial and optical links.** The private `waveform-simulator`.
- **Digital design past the inverter.** Tier 1's D6 is the door.

---

## 6. Order, and the next step

1. Close tier 0's two seams (two experiments, no engine).
2. Build tier 1 by its plan. Its Phases 1 to 4 are a complete first electronics
   course on their own.
3. Write tier 2's plan when tier 1's Group L (feedback) is built. The plan needs the
   loop view and the Control Lab link to exist before it can say what a board-level
   loop hands over.
4. Write tier 3's plan when tier 1's Group M (the op-amp inside) is built. Every
   tier 3 architecture is a variation on it.
5. Prototype the design-to-specification pane in tier 2's first group before it is
   promised anywhere else.
6. Tiers 4 and 5 get their plans after tier 3 is dark, in that order.

Each plan, when written, takes the shape of the existing ones. That shape is the
engine, the models, the app, the curriculum with every number computed, the
hand-overs, the tests, the dark launch, the phasing, the non-goals, and the risks.

---

## 7. Beyond tier 5

After the radio, analog electronics as a subject is covered. What remains is of two
kinds.

**Applications, added as groups to the tiers that own them.** Audio (preamps, RIAA,
power amplifiers, class D handing to Power Lab) in tier 2. Biomedical front ends (the
neural amplifier, the ECG instrumentation amplifier, electrode impedance) in tiers 2
and 3. Optical receivers and laser drivers on tier 2's transimpedance amplifier, with
the link itself in the private waveform simulator. Power management ICs as Power Lab's
Group H seen from the chip. High voltage and isolation on tier 2's protection group.
Analog computing and current-mode circuits on tier 3's translinear group. None of
these needs a new lab or a new engine.

**One further tier, if wanted.**

- **Tier 6, the system.** The whole chain from antenna or sensor to bits: cascaded
  noise figure, linearity and dynamic-range budgets, power allocation across blocks,
  and where to put the gain. This is what a lead engineer does that a block designer
  does not. Signal Lab's chain model, sources into a cascade of blocks, already fits
  it, so the engine cost is low. Its objects are budgets over exact block models, all
  admitted.

**Not a tier: the bench.** The suite does not load measurements from real instruments
(Reed, 2026-09-05). Every claim is checked by its own test, nothing is installed, and
a lab stays a model a reader can trust without owning a scope. The bench appears only
as tier 2's note on each experiment: how the number would be measured, with which
instrument, and what that instrument's own floor is.

Past these the ground changes. Electromagnetics, device physics, reliability and
process technology are neighbouring disciplines with no exact form the suite could
state, and §5 keeps them out.
