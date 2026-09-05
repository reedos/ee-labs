# Interfaces Lab: the plan

A lab for **embedded interfaces and buses**, the course where a microcontroller
meets the analog world. It starts at the pin, which is Electronics D5's switch
driving a load and D6's inverter reading one. Above the pin it puts four protocols
and their timing budgets. Below it, the pin is a circuit, and its transition is a
waveform with a rise time that either meets a specification or does not. Splash
glyph `⊶`, directory `apps/interfaces-lab`, engine as the Logic Lab's `events`
package for the protocols and `packages/network` for the pins.

The path, in order. The pin, in both directions. The asynchronous frame, and the
crystal that cannot make the baud rate. The two-wire bus and its pull-up window. The
four-wire bus, where the return path is the binding constraint. The differential
bus, where the wire's length is in the bit time. Then the analog side, which is a
pulse train through an RC and a converter with an acquisition window. Then time
itself, which is a timer, an interrupt and a switch that bounces.

This is a draft (2026-09-05) for Reed to settle. Two of its dependencies are being
built or planned in parallel. Section 0 lists what needs a decision, and §2.3 states
the `events` API this plan assumes as a contract to reconcile against the Logic
Lab's brief when that brief exists.

The two rules that govern the other labs govern this one with no exemption. Every
explanatory sentence is a claim about physics, and a test must measure it. And
`CORE_SCOPE.md` decides what the engine may state exactly, what it may approximate
behind a guard, and what it declines with a reason. This lab's objects are all
exact. A protocol is a sequence of events with rational times, and a pin's
transition under the piecewise-linear model is one exponential. What the lab
declines is at its edges, and §10 draws them.

---

## 0. Open decisions

### Decision 1: the name (recommended: Interfaces Lab)

`EE_LABS_MAP.md` §2 track D calls it the Interfaces Lab. The course it mirrors is
called embedded interfacing, microcontroller interfacing, or embedded systems in
most catalogues. LabNav short form **"Interfaces"**. The splash card names the path
in one line, "the pin, the four buses, the pulse-width converter, the sampler".

Alternatives considered. *Embedded Lab* promises firmware, which §10 declines.
*Bus Lab* names four of the seven groups. *Peripherals Lab* names the parts rather
than the timing that joins them.

### Decision 2: which protocols, and how many

Recommended: **four in depth and one in outline**. Asynchronous serial, the two-wire
bus, the four-wire bus and the differential bus each get their own group. The
universal serial bus gets one experiment inside the differential group, at the
physical layer only, because its packet structure is a computer science subject and
its analog front end is the private simulator's.

Alternatives considered. Adding a fifth in depth would push the lab past thirty-five
experiments and add no new class of timing constraint. Dropping the differential bus
would remove the only case where the bus length appears inside the bit time.

### Decision 3: where the protocol timing checker lives

Recommended: **`packages/events/src/protocol.js`**, owned by this lab's overseer,
holding the specification tables and the checker that runs them against a waveform.
The alternative is one checker per protocol inside the app, which would put the
specification numbers in three places and test them in none.

The Logic Lab owns `packages/events` under `PROGRAM.md` §5. This lab's `NEEDS.md`
carries the request, and the director resolves it once.

### Decision 4: the analog pin, and how far down it goes

Recommended: **the piecewise-linear model only**. Its knobs are `R_on` and the load
capacitance, and the input threshold comes from Electronics D6's closed forms. The
square-law route is available through the Electronics Lab and adds no lesson here.
Every protocol number in this lab is a time, and every time comes out of one
exponential.

A transmission line is declined, per `CORE_SCOPE.md` and per `EE_LABS_MAP.md` §5.
The bus lengths in Group E are propagation delays, which is what the specifications
themselves use, and E2's note says which model that is.

### Decision 5: where the converter comes from

`EE_LABS_MAP.md` says "the Mixed-Signal Lab's converters are this lab's ADC". That
lab is not planned. Recommended: **model the converter here as a timing budget
rather than as a circuit**, which is a conversion time, an acquisition window and a
sampling capacitance. Its resolution and its errors are the Mixed-Signal Lab's, and
F4's note names that lab as the place they are explained. The lab is then blocked
only on the Logic Lab, and §1 marks the row.

---

## 1. The progression map

This lab leans on four labs, one built, one being built, one planned and one not
planned at all. This section lists every idea it uses, where the suite teaches it,
and the status of that teaching. Nothing is closed silently.

| Idea the lab leans on | Needed by | Taught at | Status |
| --- | --- | --- | --- |
| The two laws, the RC charging curve, the time constant | A, F, G | Elements A to D, F1 | built |
| The capacitor as an open at DC | A3, F | Elements F1 | built |
| First-order response and the exponential | A4, F2, G3 | Elements F, G | built |
| The RC low-pass and its corner | F1, F2 | Circuit Lab, filter group | built |
| Sampling, the fold, and aliasing | F5 | Signal Lab, Sampling group | built |
| The transistor as a switch with `R_on` | A1, A4 | Electronics D5 | planned, Electronics D5 |
| The CMOS inverter and its noise margins | A2, A5, G4 | Electronics D6 | planned, Electronics D6 |
| The Schmitt trigger and its hysteresis | G4 | Elements E9, Electronics N3 | built, extended |
| Gates, and a design with a propagation delay | B, C, D, E | Logic Lab, gates group | being built |
| The timing diagram as a canvas | every group | Logic Lab, timing group | being built |
| Setup and hold at a receiving flip-flop | D2, D3 | Logic Lab, sequential group | being built |
| The shift register | B1, D1 | Logic Lab, sequential group | being built |
| The state machine, for a protocol's controller | C5, E1 | Logic Lab, state machine group | being built |
| The interrupt and its cost in cycles | G2 | Computer Lab G2 | planned, `COMPUTER_LAB_PLAN.md` |
| The converter's resolution and its errors | F4 | Mixed-Signal Lab | **not planned, Decision 5** |
| An open-drain bus and its pull-up | C1, C2 | nowhere | **gap, Group C** |
| A protocol's timing budget | B, C, D, E | nowhere | **gap, Groups B to E** |
| Pulse-width modulation as a mean plus a ripple | F1, F2 | Power Lab A, from the other side | built |
| A switch that bounces | G3, G4 | nowhere | **gap, G3** |

Four things the map shows, so that they are decisions and not omissions. **The
Mixed-Signal Lab does not exist**, and Decision 5 states what this lab does about
the converter. **Electronics D5 and D6 are planned and not built**, so Group A
restates their results from this lab's own model card and cross-references them by
id, and the progression test fails until they exist. **Signal Lab's Sampling group
is built**, so F5 is the only cross-lab link in this plan that works today.
**Power Lab teaches pulse-width modulation from the converter's side**, and F1 says
so, because the same waveform is a power stage there and a converter here.

The order of the groups follows the map. Nothing in a group leans on an experiment
later in this lab. Group A is the bridge from Electronics D, and Groups F and G lean
on Group A rather than on the protocol groups.

---

## 2. The engine: events above the pin, a circuit below it

### 2.1 What exists, and what is missing

`packages/network` has what a pin needs. `pwlTransient` gives the exact waveform of
a switch driving an RC load, with every threshold crossing located as an event
rather than sampled. The MOSFET's `switch` model arrives with the Electronics Lab's
lane 1, in the schema `apps/electronics-lab/AGENT_BRIEF.md` §3.1 fixes.

Three things are missing. There is no discrete-event simulator, which is the Logic
Lab's `events` package. There is no protocol timing checker. And there is no way to
drive a digital event stream into an analog pin and read the analog crossings back
as events, which is this lab's own seam.

### 2.2 The pin, exactly

A push-pull output is one of two resistors to a rail, chosen by the driven value. An
open-drain output is one resistor to ground or an open circuit, with a pull-up to the
supply. In both cases the pin node is one resistance into one capacitance. Its
voltage is a single exponential, and the time at which it crosses a stated threshold
is a closed form.

```js
// packages/events/src/pin.js
/**
 * @param pin   { drive: 'push-pull' | 'open-drain', ron, rpu, cload, vdd, vil, vih }
 * @param edges [{ t, value }]                     the digital stream driving it
 * @returns {{ wave: (t) => volts,
 *             crossings: [{ t, level: 'vil' | 'vih' | 'vm', dir }],
 *             tr, tf, tpLH, tpHL }}
 */
export function pinDrive(pin, edges)
```

`crossings` is the bridge in both directions. Driving a pin turns events into a
waveform. Reading one turns the waveform's threshold crossings back into events,
which is what a receiving input does. Every time in `crossings` is a closed form,
not a sample, so an interval measured between two of them is exact.

### 2.3 The `events` API this lab assumes

The Logic Lab owns `packages/events`. This lab assumes the following shape, and
**this is a contract to reconcile with the Logic Lab's brief when that brief
exists**. Where the Logic Lab chooses differently, this lab changes, and no
experiment in §5 depends on the names below.

```js
// packages/events/src/sim.js
/**
 * @param design  { nets, gates, flops }           gates carry tpLH and tpHL
 * @param stim    [{ t, net, value }]
 * @param opts    { until, glitches: true }
 * @returns {{ events, at, waveform, violations }}
 */
export function simulate(design, stim, opts)
```

Two properties this lab needs beyond the Logic Lab's own, and each is an invariant
in §2.8. Event times are exact rationals, because a bit time of 104.1667 µs times ten
must be a frame time and not a drift. And a design may contain a net driven by more
than one gate. An open-drain bus is exactly that, and its resolution is the wired
conjunction rather than a conflict.

### 2.4 The protocol timing checker

```js
// packages/events/src/protocol.js
/**
 * @param spec  a named table: { name, params: { tSU, tHD, tHIGH, tLOW, tR, tF, ... } }
 * @param obs   [{ name, measured }]               from the pin's crossings
 * @returns {{ pass: boolean,
 *             checks: [{ param, spec, measured, slack, pass, cite }],
 *             worst: { param, slack } }}
 */
export function checkTiming(spec, obs)
```

Every row carries `cite`, which is the clause of the published specification the
number came from. The tables are data, held in one file, and each is pinned by a
test against the document it is transcribed from. A number nobody can cite does not
go into a table.

The measured side comes from `pinDrive`'s crossings and from the event record, never
from a formula. A rise time is the interval between the 0.3 and 0.7 supply crossings
of the actual waveform, because that is what the two-wire specification measures.
Section 5's Group C is built on that distinction.

### 2.5 The pulse-width converter, exact

An output pin driving an RC low-pass with a periodic square wave has a periodic
steady state, and that state is a closed form. For a period `T`, a duty `D` and a
time constant `τ`, the peak-to-peak ripple is

```
ΔV = V (1 − e^(−DT/τ)) (1 − e^(−(1−D)T/τ)) / (1 − e^(−T/τ))
```

and the mean is `D V` exactly. The lab computes both from that expression and never
from the small-ripple estimate `V D (1 − D) T / τ`. The estimate is drawn beside the
exact value with its error printed, which is 2.07 % when `T = τ` and 0.005 % at the
lab's default. This follows the pattern the Power Lab already uses for the same
waveform seen from the converter's side.

### 2.6 The sampler, as a budget

Per Decision 5 the converter is a timing budget rather than a circuit. Three numbers
define it. A conversion time, which is a clock count. An acquisition window, which
is the sample period minus the conversion time. And a sampling capacitance with a
switch resistance, which sets how long a source of a stated impedance takes to
settle to half a least significant bit. That settling is `ln(2^(N+1))` time
constants, which is 9.011 for twelve bits, and it is a closed form.

Aliasing is not modelled here. F5 hands the reader to Signal Lab's Sampling group by
deep link, with the sample rate and the input frequency carried across, and reads
the folded frequency back. `EE_LABS_MAP.md` names that lab as the sampling authority
and this plan does not build a second one.

### 2.7 Measures

Bit time, frame time, and bytes a second. Divisor, actual baud rate, and error as a
percentage. Accumulated sampling error at the stop bit. Rise and fall times between
stated levels. Setup and hold margin against a specification row, as a slack in
nanoseconds. Maximum clock frequency from a budget. Pull-up bounds, upper from the
rise time and lower from the sink current. Propagation delay in metres and in bit
times.

Then the analog side. Mean and peak-to-peak ripple, exact and estimated, and the
ripple in least significant bits. Settling time to a stated resolution. Acquisition
time against source resistance. Signal-to-noise ratio from jitter, and effective bits
from it. Bounce duration, threshold crossings, and the hysteresis window.

### 2.8 Invariants, the fuzzer's checklist

Across random pin parameters, random specification tables, random baud rates and
random bus loads:

1. **The pin's waveform is the closed form.** `pinDrive`'s wave agrees with
   `V(1 − e^(−t/RC))` at every sample to floating point, and its crossings agree with
   the closed-form crossing times.
2. **Crossings round-trip.** Driving a pin from an event stream and reading its
   crossings back gives the same edge count, with each output edge later than its
   input edge by the computed propagation delay.
3. **Times are rational.** Ten bit times at 9600 baud equal one frame time exactly,
   with no accumulated floating-point drift over ten thousand frames.
4. **The wired conjunction holds.** On an open-drain net with any number of drivers,
   the net is low whenever any driver is low, and the transition to high has the
   pull-up's time constant and not a driver's.
5. **The checker is symmetric.** Every specification row that passes with slack `s`
   fails when the measured value is moved past the limit by any positive amount, and
   the reported slack changes sign at the limit.
6. **Every table row is cited.** No row in `protocol.js` lacks a `cite` field, and a
   test asserts it for every table.
7. **The ripple formula reduces.** As `T/τ` goes to zero, the exact ripple and the
   small-ripple estimate agree to the stated relative error, and the error the panel
   prints is the measured one.
8. **The mean is the duty.** The exact periodic steady state's mean equals `D V` to
   floating point, at every duty from 0 to 1 and every `T/τ`.
9. **The frame decodes.** A frame is driven through a pin at a stated baud rate and
   sampled by a receiver at a stated divisor. It decodes to the byte sent whenever
   the drift at the stop bit is under half a bit, and it fails otherwise. The
   boundary is tested from both sides.
10. **Cross-lab.** The pin's thresholds equal Electronics D6's closed forms at the
    same supply and threshold voltage. The folded frequency handed to Signal Lab
    comes back as the frequency Signal Lab's Sampling group reports. The ripple
    matches the Circuit Lab's RC response to the same square wave.

---

## 3. Models: pins, buses and loads

| Model | Contents | What it teaches |
| --- | --- | --- |
| `pin.pp` | two switches of `R_on`, a load capacitance | the push-pull output, A1 |
| `pin.od` | one switch, one pull-up resistor, a load capacitance | the open-drain output, A3 |
| `pin.in` | the inverter of Electronics D6 at 3.3 V | the input threshold, A2 |
| `bus.i2c` | two open-drain nets, two pull-ups, a bus capacitance, three nodes | Group C |
| `bus.spi` | four push-pull nets with per-net trace delays | Group D |
| `bus.can` | two nets, a differential receiver, a bus of stated length | Group E |
| `rc.pwm` | a pin into an RC, and a second RC in cascade | Group F |
| `adc.sar` | a switch, a sampling capacitance, a conversion counter | F4 |
| `sw.bounce` | a switch with a stated bounce pattern, an RC, a Schmitt input | Group G |

The specification tables in `protocol.js` are the fifth model. Four tables, one for
each protocol in Decision 2, each row carrying its limit, its unit, its direction
and its citation. The lab's numbers come from those tables, and no number appears in
an experiment that does not appear in a table.

**Schematic description.** The pin is drawn as the Electronics Lab draws its switch,
with the load capacitance and the pull-up as ordinary elements. The bus models are
drawn as nodes with their capacitance labelled, which is the picture a datasheet's
bus-loading section assumes.

---

## 4. The app

### 4.1 Layout

The Elements lab's shape, unchanged. Sidebar with LabNav, report link, experiment
groups, model picker, parameter NumFields with chips, mode and toggle switches, and
the math panel. Main area with topbar meters, the pin or bus schematic always
visible, and one pane below with a pane selector. Phone width first, no horizontal
scroll at 390 px, harness checked.

The topbar shows the worst timing slack first. Then come the experiment's headline
numbers (bit time, rise time, margin, ripple, effective bits) and the specification
in use.

### 4.2 Views

- **The protocol timing diagram.** This lab's adaptation of the Logic Lab's timing
  diagram, and the lab's centre. Digital traces as that canvas draws them, with one
  addition. A selected line is drawn as its analog waveform instead, with the two
  threshold levels marked and the rise measured between them. The measurement cursors
  print the interval and the specification row it is checked against. `PROGRAM.md`
  §4 names the Interfaces Lab as the timing diagram's second lab, and this is the
  prop the canvas carries from the start.
- **The budget table.** Every row of the specification, its limit, the measured
  value, the slack, and the citation. Failing rows are marked and sorted first.
- **The pin.** The schematic with the switch state at the time cursor, and the
  analog trace of the pin node beside it with both thresholds drawn.
- **The pull-up window.** Resistance on one axis, with the lower bound from the sink
  current and the upper bound from the rise time drawn as two lines. The current
  choice is a point between them, or outside them. New to this lab.
- **The eye of a frame.** The whole frame at the receiver's sampling instants, with
  the drift accumulating across the ten bits. New to this lab, and Group B's picture.
- **Scope and spectrum.** The exact waveform of the analog node, with the ripple
  measured peak to peak and the mean drawn as a line. Beside it, the pulse train's
  harmonics against the filter's response, from the lab's own use of `@ee-labs/dsp`.
- **Equations.** The ripple expression with the current numbers substituted, and the
  budget's sum written out term by term.

### 4.3 Numbers

Every number below is computed by the plan's script from the stated parameters. Every
one becomes a pinned test.

- **The pin.** `V_DD = 3.3 V` and `V_t = 0.7 V`, so `V_IL = 1.412 V` and
  `V_IH = 1.887 V` from Electronics D6's forms `(3V_DD + 2V_t)/8` and
  `(5V_DD − 2V_t)/8`. The same forms give D6's own 2.05 V and 2.95 V at 5 V.
  `R_on = 25 Ω` into 50 pF gives a 1.25 ns time constant, a 2.75 ns rise, and
  1.061 ns to cross `V_IH`. An open-drain pin with a 10 kΩ pull-up needs 424.3 ns for
  the same crossing, **400 times longer**.
- **Margins at the pin.** At 8 mA, `V_OL = 0.200 V` and both margins are 1.212 V.
  Eight pins switching 132 mA each in 2 ns through 5 nH give 2.640 V of ground
  bounce, so only three pins fit inside the margin. A 20 ns edge gives 0.264 V.
- **The frame.** At 9600 baud a bit is 104.17 µs and a ten-bit frame is 1041.7 µs, so
  960 bytes a second. At 115200 baud a bit is 8.681 µs.
- **The divisor.** A 16 MHz clock at sixteen-times oversampling wants 8.681 for
  115200 baud and can have 9, giving 111111 baud and −3.55 %. An 8 MHz clock gives
  +8.51 % and a 12 MHz clock gives −6.99 %. An 18.432 MHz crystal gives exactly 10,
  so 0.00 %. The stop bit is sampled 9.5 bit times late, so the breaking error is
  **5.263 %**, and +8.51 % drifts 80.8 % of a bit.
- **The two-wire bus.** A rise from 0.3 to 0.7 of the supply takes `0.8473 RC`. The
  3 mA sink at 0.4 V floors the pull-up at **966.7 Ω**. At 400 kHz the ceiling is
  1770 Ω with 200 pF and 885.2 Ω with 400 pF, below the floor, so **no resistor is
  valid**. A 4.7 kΩ pull-up into 100 pF rises in 398.2 ns and fails the 300 ns limit.
- **The two-wire budget.** At 400 kHz the four minimum times, 1.3 µs, 300 ns, 600 ns
  and 300 ns, sum to exactly 2.500 µs, which is the bit period. At 100 kHz they sum
  to exactly 10.00 µs. A one-byte register read is 390.0 µs at 100 kHz and 97.50 µs
  at 400 kHz.
- **The four-wire bus.** A 12 ns master delay, a 20 ns slave delay, 5 ns of setup at
  each end, and 6.7 ns a metre of trace. A 10 cm link needs 17.67 ns outbound and
  26.34 ns for the return, so the return binds and the ceiling is **18.98 MHz**
  rather than 28.30 MHz. At 20 MHz the return margin is −1.340 ns.
- **The differential bus.** At 500 kbit/s the bit is 2.000 µs, and sixteen quanta of
  125.0 ns split 1, 7, 4 and 4 put the sample at 75.00 %. The 875.0 ns propagation
  segment allows **67.50 m** at 5 ns a metre with 50 ns of transceiver delay at each
  end. That is 23.75 m at 1 Mbit/s and 330.0 m at 125 kbit/s. Tolerance is 1.250 %
  from one rule and 0.9804 % from the other, so 0.9804 % binds.
- **The universal serial bus.** Full speed is 83.33 ns a bit. Bit stuffing costs one
  bit in seven, 14.29 %. A 5 m cable at 5.2 ns a metre is 26.00 ns, the
  specification's own limit. A 45 Ω driver into 50 pF rises in 4.950 ns, inside the
  4 ns to 20 ns window, and 202.0 pF would sit at the top of it.
- **The converter.** At 20 kHz, 10 kΩ and 1 µF, `T/τ = 0.005` and the exact ripple at
  half duty is **4.125 mV** against a mean of 1.650 V. That is 0.3200 of an eight-bit
  step and 1.280 of a ten-bit step. The small-ripple estimate is high by 0.00005 %
  here, and by 2.07 % at 1 kHz with 100 nF, where the ripple is 808.2 mV.
- **The settling trade.** The same filter reaches half an eight-bit step in 62.38 ms,
  so the update rate is 16.03 Hz, and half a ten-bit step takes 76.25 ms. Two
  cascaded stages of half the time constant attenuate 314.2 times better.
- **The sampler.** Twelve bits give a 74.00 dB limit and an 805.7 µV step at 3.3 V.
  Fourteen clocks at 20 MHz is 700.0 ns, leaving 300.0 ns of acquisition at 1 MSPS.
  Half a step needs 9.011 time constants, capping the source at **2829 Ω** with a
  10 pF sampling capacitance and a 500 Ω switch.
- **Jitter.** The ratio is `−20 log(2π f t_j)`. At 10 kHz and 100 ns it is 44.04 dB,
  which is 7.02 effective bits, and twelve bits need **3.176 ns**. A latency spread
  uniform over 500 ns has an rms of 144.3 ns.
- **The switch and the timer.** 10 kΩ and 1 µF give 10.00 ms, and the rise to a
  Schmitt threshold at 0.6 of the supply takes 9.163 ms. A 5 ms burst closing 80 % of
  the time leaves 2.212 V, above the 1.320 V lower threshold, so no false edge
  appears. The smallest surviving time constant is 4.365 ms. A 16 MHz clock reloading
  at 15999 gives exactly 1000 Hz, and the duty resolution is 9.644 bits at 20 kHz.

---

## 5. Curriculum: 30 experiments in 7 groups

Format, as the other plans. **The claim** the note makes, what the reader turns, and
what is **measured** against what **formula**. Every quoted number becomes a pinned
test computed from the model card, never a constant. Each experiment ships with
`see`, `try` and `why` in the three registers, within the `STYLE.md` budgets.

### Group A: The pin (5) · bridge from Electronics D5 and D6

- **A1 · The output is two switches.** Electronics D5's switch, one to each rail,
  never on together. `R_on = 25 Ω` into 50 pF gives a 1.25 ns time constant and a
  2.75 ns rise from 10 % to 90 %. Measured: the exact waveform against
  `V(1 − e^(−t/RC))`, and the rise against `2.2 RC`.
- **A2 · The input is a threshold, twice.** Electronics D6's inverter at 3.3 V gives
  `V_IL = 1.412 V` and `V_IH = 1.887 V` from the same two closed forms that give
  2.05 V and 2.95 V at 5 V. The output crosses `V_IH` 1.061 ns after the edge.
  Measured: both thresholds against the closed forms, and the crossing time.
- **A3 · Open drain, and the price of it.** One switch to ground and a resistor to
  the supply. The fall is fast and the rise is the pull-up's. A 10 kΩ pull-up takes
  424.3 ns to reach `V_IH`, which is 400 times the push-pull pin. Measured: both
  crossing times, and the ratio against `R_pu/R_on`.
- **A4 · The load is the whole story.** Sweep the load capacitance from 10 pF to
  500 pF. The rise time is a straight line through the origin with a slope of
  `2.2 R_on`. Measured: the line's slope at three values of `R_on`, and the
  capacitance at which the rise exceeds a stated 10 ns budget.
- **A5 · Margins, and the ground that moves.** At 8 mA both noise margins are
  1.212 V. Eight pins switching together push 132 mA each in 2 ns, and 5 nH of bond
  wire turns that into 2.640 V of ground bounce, which exceeds the margin. Slow the
  edge to 20 ns and the bounce falls to 0.264 V. Measured: both margins, the bounce
  at four edge rates, and the number of pins that fit inside the margin.

### Group B: The asynchronous frame (4)

- **B1 · Ten bits and no clock.** A start bit, eight data bits, a stop bit. At
  9600 baud that is 104.17 µs a bit and 1041.7 µs a frame, so 960 bytes a second.
  The receiver finds the start edge and then counts. Measured: the frame time, the
  throughput, and the decoded byte from the pin's crossings.
- **B2 · The divisor is an integer.** A 16 MHz clock at sixteen-times oversampling
  wants a divisor of 8.681 for 115200 baud and can only have 9, which gives 111111
  baud and −3.55 %. An 8 MHz clock gives +8.51 %. Measured: the divisor, the actual
  rate and the error for four clocks at two baud rates.
- **B3 · The crystal chosen for this job.** 18.432 MHz gives a divisor of exactly 10
  at 115200 baud and exactly 120 at 9600, both with zero error. The crystal is in the
  catalogue for that reason. Measured: both divisors, and the error at zero.
- **B4 · Where the error breaks the frame.** The stop bit is sampled 9.5 bit times
  after the start edge, so the drift is 9.5 times the error and the limit is half a
  bit. The breaking error is 5.263 %. At −3.55 % the frame decodes with 33.7 % of a
  bit to spare, and at +8.51 % it does not. Measured: the drift at five errors, the
  decoded byte at each, and invariant 9 at both sides of the boundary.

### Group C: The two-wire bus (5)

- **C1 · Nobody drives high.** Every device pulls the line low or lets go, and a
  resistor makes the high. The line is low when any device pulls it low, which is
  what lets a device see that another one is talking. Measured: the net's value for
  every combination of three drivers, and the rise having the pull-up's time constant.
- **C2 · The pull-up has two bounds.** The sink current of 3 mA at 0.4 V puts the
  floor at 966.7 Ω. The 300 ns rise limit at 400 kHz and 200 pF puts the ceiling at
  1770 Ω. At 400 pF the ceiling is 885.2 Ω, below the floor, so no resistor is valid
  and the bus must be split. Measured: both bounds at three capacitances, and the
  capacitance at which the window closes.
- **C3 · A rise time is measured between two levels.** From 0.3 to 0.7 of the supply
  is `0.8473 RC`. A 4.7 kΩ pull-up into 100 pF gives 398.2 ns, which fails the 300 ns
  limit even though the waveform looks fast. Measured: the rise from the pin's
  crossings, against the specification row, with the citation shown.
- **C4 · The specification has no slack.** At 400 kHz the four minimum times sum to
  exactly 2.500 µs, which is the bit period. At 100 kHz they sum to exactly 10.00 µs.
  Every nanosecond taken by the rise is taken from the high time. Measured: the four
  times, their sum, and the slack of exactly zero.
- **C5 · What a byte costs.** Nine bit times for a byte and its acknowledgement. A
  one-byte register read is seven phases, 390.0 µs at 100 kHz and 97.50 µs at
  400 kHz. A slave that holds the clock for 100 µs costs 40 bit times. Measured: the
  transaction time at both rates, and the stretching cost in bit times.

### Group D: The four-wire bus (3)

- **D1 · Two shift registers and a shared clock.** The master shifts out on one edge
  and samples on the other. Eight bits at 10 MHz take 0.8000 µs. The mode is which
  edge does which. Measured: the four modes' sampling instants, and the byte received
  in each.
- **D2 · The outbound budget.** The master's output must be valid at the slave's
  setup time before the sampling edge. With 12 ns of output delay, 0.670 ns of trace
  and 5 ns of setup, the half period must be at least 17.67 ns, so 28.30 MHz.
  Measured: the three terms, the sum, and the frequency.
- **D3 · The return path binds.** The slave's answer must travel out, be produced,
  and travel back. That is 26.34 ns, so the real limit is 18.98 MHz. At 20 MHz the
  margin is −1.340 ns and the link fails. Measured: both budgets at four trace
  lengths, which one binds, and the margin at four frequencies.

### Group E: The differential bus (4)

- **E1 · One state wins.** A dominant bit overrides a recessive one on the wire, so
  a device that sends recessive and reads dominant has lost arbitration and stops.
  No bit is lost. Measured: the bus value for every combination of drivers, and the
  losing device stopping at the right bit.
- **E2 · The bus length is inside the bit.** The propagation segment must hold two
  round trips of signalling. At 500 kbit/s with a 875.0 ns segment, 5 ns a metre and
  50 ns of transceiver delay at each end, the bus can be 67.50 m. At 1 Mbit/s it is
  23.75 m. Measured: the length at four bit rates, against the segment budget.
- **E3 · The sample point, and the tolerance it buys.** Sixteen quanta of 125.0 ns as
  1, 7, 4 and 4 put the sample at 75.00 %. The resynchronisation rule allows 1.250 %
  of oscillator error and the phase-segment rule allows 0.9804 %, so the smaller
  binds. Measured: the sample point, both tolerances, and which one binds at four
  segment splits.
- **E4 · The universal bus, at the wire.** Full speed is 83.33 ns a bit. A run of
  ones has no transition, so a stuffed bit is inserted after six, costing 14.29 % at
  worst. A 5 m cable at 5.2 ns a metre is 26.00 ns, which is the specification's
  limit. A 45 Ω driver into 50 pF rises in 4.950 ns, inside the 4 ns to 20 ns window.
  Measured: the bit time, the stuffing overhead, the cable delay, and the rise
  against both window edges.

### Group F: The analog side (5)

- **F1 · A pulse train has a mean.** A pin at 20 kHz and half duty, through 10 kΩ and
  1 µF. The mean is 1.650 V, which is the duty times the supply, exactly. Power Lab's
  Group A is the same waveform seen as a power stage. Measured: the mean against
  `D V` at five duties, to floating point.
- **F2 · The ripple, exactly.** The periodic steady state gives 4.125 mV peak to
  peak at half duty. The small-ripple estimate `V D (1 − D) T / τ` is high by
  0.00005 % here and by 2.07 % when the period equals the time constant. Measured:
  the exact ripple at four filter choices, and the estimate's error at each.
- **F3 · Resolution costs time.** 4.125 mV is 0.3200 of an eight-bit step and 1.280
  of a ten-bit step. Settling to half an eight-bit step takes 62.38 ms, so the
  converter can be updated 16.03 times a second. Two cascaded stages attenuate 314.2
  times better and settle no faster. Measured: the ripple in steps, the settling
  times, and the cascade's attenuation.
- **F4 · The acquisition window.** Fourteen clocks at 20 MHz is 700.0 ns of
  conversion, leaving 300.0 ns at 1 MSPS. Half a step of twelve bits needs 9.011 time
  constants, so a 10 pF sampling capacitance and a 500 Ω switch cap the source at
  2829 Ω. A 3 kΩ source needs 315.4 ns and fails. Measured: the window, the maximum
  source resistance, and the settling at four source impedances.
- **F5 · Aliasing, in software.** Sample a 6 kHz input at 10 kSPS and the reading is
  4 kHz. The deep link carries the rate and the frequency to Signal Lab's Sampling
  group, and the folded frequency comes back. Measured: the fold against
  `|f − k f_s|` at four cases, and the round trip through the link.

### Group G: Time, and the switch (4)

- **G1 · A timer is a counter and a reload.** A 16 MHz clock with a reload of 15999
  gives exactly 1000 Hz. Doubling the modulation frequency halves the duty
  resolution, so 20 kHz gives 9.644 bits and 1 kHz gives 13.97 bits. Measured: the
  frequency at three prescaler settings, and the resolution against `log₂(f_clk/f)`.
- **G2 · The interrupt does not arrive on time.** Its latency varies with what the
  machine was doing, and the Computer Lab's G2 counts the cycles. A spread of 500 ns
  has an rms of 144.3 ns. Sampling at 10 kHz with that jitter caps the ratio at
  44.04 dB, which is 7.02 effective bits. Twelve bits would need 3.176 ns. Measured:
  the rms from the spread, the ratio from `−20 log(2π f t_j)`, and the effective bits.
- **G3 · A switch does not close once.** The contact bounces for about 5 ms, and each
  bounce is an edge the input reports. A counter reads eleven presses for one.
  Measured: the edge count from the pin's crossings over the stated bounce pattern.
- **G4 · Two ways to stop counting them.** A 10 kΩ and 1 µF network into a Schmitt
  input takes 9.163 ms to reach the upper threshold. A 5 ms burst leaves the node at
  2.212 V, above the 1.320 V lower threshold, so no false edge appears. The smallest
  time constant that survives is 4.365 ms. Eight agreeing samples at 1 kHz do the
  same job in software and cost 8 ms of latency. Measured: the node voltage after the
  burst at three duty fractions, the smallest surviving time constant, and the
  software latency.

---

## 6. Hand-overs

- **← Logic Lab** (B to E). The `events` package, the timing diagram canvas, the
  shift register and the state machine. The contract in §2.3 is reconciled against
  that lab's brief before Phase 3 starts.
- **→ Logic Lab.** The multi-driver net of C1 is a resolution rule the Logic Lab's
  simulator needs, and invariant 4 is its test. This lab's `NEEDS.md` carries it.
- **← Electronics Lab** (Group A, G4). D5's switch is the output stage. D6's inverter
  is the input, with the same two closed forms at a different supply. Elements E9's
  Schmitt trigger, extended by Electronics N3, is G4's input.
- **→ Signal Lab** (F5). The sample rate and the input frequency cross as a deep
  link into the Sampling group, and the folded frequency comes back. The mapping is
  exact and is presented without hedge, per the `CORE_SCOPE.md` counter-rule. Tested
  both ways.
- **→ Circuit Lab** (F1, F2). The RC low-pass and its corner are Circuit Lab's, and
  a link opens the same filter there with the pulse train's fundamental marked. The
  ripple this lab computes exactly agrees with that filter's response at the
  fundamental to the stated harmonic truncation.
- **↔ Power Lab** (F1). The same pulse train is a power stage there and a converter
  here. Both quote the same mean and the same ripple expression, and a test pins them
  against each other.
- **← Computer Lab** (G2). The interrupt's cost in cycles is that lab's, and the
  jitter it causes is this lab's. Cross-referenced by id in both directions.
- **← Mixed-Signal Lab**, which is not planned. Decision 5 states what this lab does
  instead, and `BACKLOG.md` carries the row.

---

## 7. Testing discipline

- **Unit** (`packages/events/src/pin.js`): the waveform against the closed form at
  twenty points for both drive modes. The crossings against their closed forms. The
  round trip of invariant 2 at ten random edge streams.
- **Unit** (`packages/events/src/protocol.js`): every table row against the document
  it is transcribed from, by citation. The checker's slack sign at each limit. The
  `cite` field present on every row, which is invariant 6.
- **Unit** (the ripple): the exact expression against a numerical steady state. The
  reference is found by iterating the period map to convergence, at twenty duty and
  period ratios.
- **Invariants** (§2.8), fuzzed across pull-ups from 500 Ω to 100 kΩ, capacitances
  from 10 pF to 1 nF, baud rates from 300 to 3 Mbit/s, and duties from 0.01 to 0.99.
  Three hostile corners are included. They are the duty at 0 and at 1, the bus whose
  pull-up window is empty, and the bit rate at which the propagation segment is one
  quantum.
- **Experiments**: every number in §5 pinned as a function of the model card, never
  as a constant. Among them 104.17 µs, 5.263 %, 966.7 Ω, 2.500 µs, 18.98 MHz,
  67.50 m, 4.125 mV, 2829 Ω, 3.176 ns and 9.163 ms.
- **The map's promises**: a test walks every `why` and every cross-reference, and
  requires the referenced experiment to exist in the named lab. A reference to
  Electronics D6 fails until Electronics D6 is built, which is the design.
- **Guards**: this lab ships one, which is the small-ripple estimate of §2.5. It is
  drawn only beside the exact value and never alone, and its error is printed rather
  than assumed small. Tested at both sides of the period ratio where the error passes
  1 %.
- **Cross-lab pins**: Signal Lab's fold for F5. Circuit Lab's RC response for F2.
  Power Lab's mean for F1. Electronics D6's thresholds for A2. The Computer Lab's
  interrupt cycles for G2.
- **Playwright harness**: the protocol timing diagram switches a line from digital to
  analog and back. The budget table sorts failing rows first. The pull-up window
  moves both bounds when the bus capacitance changes. No horizontal scroll at 390 px.
- **REVIEW_PLAYBOOK audit** before release, all eleven classes, a screenshot pass,
  and the sittings script with three seats. One seat sits Group A, because a reader
  arriving from Electronics meets it first.

---

## 8. Integration and the dark launch

The mechanism is the one Power Lab and the Elements lab share, unchanged.

- Deployed **dark** at `/interfaces-lab/` from the first vertical slice. Unlisted,
  not secret.
- `apps/interfaces-lab/RELEASE_STATUS` reads `dark`. A test asserts that while it
  does, the splash, the root README and the other labs' LabNav contain no reference
  to the Interfaces Lab. Flip the word to `released` and the same test demands the
  splash card, the README row and the nav entries, with counts pinned.
- `NEEDS.md` carries four items for the director. One `cp` line in `deploy.yml`. The
  lab's ids and counts in `progression.test.js`. The request for
  `packages/events/src/pin.js` and `protocol.js` under Decision 3. And the timing
  diagram's analog-line prop, since this lab is that canvas's second claimant under
  `PROGRAM.md` §4.
- The flip is **Reed's action**, after the release gate in §9.

---

## 9. Phasing

Each phase ships green and deployable dark. The pin comes first, because it needs
`network` alone and `network` is built.

1. **The pin, without events.** `pinDrive`, the pin view, the scope. App shell, dark
   deploy and the `RELEASE_STATUS` test. **Group A** (5). Exit: invariants 1 and 2
   fuzzed green, and every A number pinned.
2. **The analog side.** The ripple expression, the cascade, the sampler's budget, the
   Signal Lab link. **Group F** (5). Exit: invariants 7 and 8 green, F5's round trip
   tested, and F2's two error figures pinned.
3. **The frame, on `events`.** The Logic Lab's package arrives, §2.3's contract is
   reconciled, and the timing diagram is adapted with its analog line. `checkTiming`
   and the budget table. **Group B** (4). Exit: invariants 3 and 9 green, and the
   boundary at 5.263 % tested from both sides.
4. **The two-wire bus.** The multi-driver net, the pull-up window view. **Group C**
   (5). Exit: invariants 4 and 6 green, and C4's zero slack pinned from the table.
5. **The other two buses.** The trace-delay model, the differential receiver.
   **Groups D, E** (7). Exit: D3's binding direction and E3's binding rule both
   pinned, and every table row cited.
6. **Time and the switch.** The timer, the jitter model, the bounce pattern.
   **Group G** (4). Exit: G2's effective bits and G4's smallest time constant pinned.
7. **The release gate**, in order, each blocking the next. The full audit, every
   option, every model, every claim, fuzzing, both browsers. The student sittings.
   Reed's own pass against the dark deployment. Then the flip.

Phases 1 and 2 are ten experiments and need nothing from the Logic Lab. If that lab
slips, this one still ships a third of itself dark, and the pin group stands alone as
the bridge from Electronics.

---

## 10. Non-goals (v1, stated so they are decisions rather than omissions)

- **Firmware, drivers, real-time operating systems and interrupt priority schemes.**
  The lab models a pin and a bus. Software above the register is computer science,
  and `EE_LABS_MAP.md` §5 declines it.
- **Protocol layers above the physical one.** Addressing modes, packet structure,
  error correction, enumeration and device classes. The map stops this lab at the
  pin, and Decision 2 applies it.
- **Transmission lines, and the high-speed link.** `CORE_SCOPE.md` declines a lossy
  line in time, and the Fields Lab owns the lossless one. Group E uses propagation
  delay, which is what the specifications use. Eye diagrams, jitter decomposition and
  equalisation are the private simulator's, by the README and by `EE_LABS_MAP.md` §5.
- **The converter as a circuit, and aliasing as a subject.** Decision 5 sends the
  converter's resolution, errors and architecture to the Mixed-Signal Lab, and F4
  names that lab. F5 links to Signal Lab's Sampling group rather than rebuilding it.
  One authority per idea.
- **Electrostatic discharge, latch-up, overvoltage protection and level shifting.**
  Datasheet and layout facts, each of which changes a number and no lesson here.
- **Wireless interfaces, and sensor physics.** The RF Lab and the Communications Lab
  own everything with an antenna. A thermocouple, a strain gauge and a photodiode are
  three other labs' objects, and this lab's source impedance is a resistance with a
  value.
- **A free-form bus editor.** Curated models with editable values, as every other lab.

---

## 11. Risks, named

- **The `events` contract moves.** §2.3 is a guess at a package another overseer is
  writing today. Mitigation: no §5 experiment depends on the names, Phases 1 and 2
  need nothing from it, and the contract is reconciled at the start of Phase 3.
- **The multi-driver net may not exist in `events`.** An open-drain bus needs it, and
  the Logic Lab may have built a single-driver simulator. Mitigation: invariant 4 is
  written as this lab's test, `NEEDS.md` carries the request, and Group C is Phase 4
  rather than Phase 3.
- **Electronics D5 and D6 are planned, not built.** Group A cross-references them,
  and the progression test fails on a reference to an experiment that does not exist.
  Mitigation: Group A restates both results from this lab's own model card, so it
  stands alone, and the cross-reference is added in the release commit once
  Electronics ships. `BACKLOG.md` carries the row.
- **Specification numbers are transcribed by hand.** Four tables of a dozen rows
  each, from four documents. A wrong row makes every budget in its group wrong.
  Mitigation: invariant 6, the citation on every row, and a review pass whose only
  job is the tables. Reed's release pass checks four rows at random against the
  documents.
- **The Mixed-Signal Lab may arrive and disagree.** Decision 5's budget model is a
  placeholder for that lab's converter. Mitigation: F4 quotes only times and
  impedances, never resolution or error, so the two models do not overlap. The
  backlog row names the reopening.
- **Ground bounce is a lumped-inductance model.** A5's 2.640 V comes from one
  inductance and one edge rate. Mitigation: the note states the model in one
  sentence, the number is a scaling argument rather than a prediction, and §10
  declines the layout questions behind it.
- **Four protocol groups that look alike.** A reader may not see why the fourth
  budget is a new idea. Mitigation: each group's first experiment names the
  constraint that group adds, which is the divisor, the pull-up window, the return
  path and the bus length. The sittings seat one reader on Group D after Group C.
- **Cost.** Two new modules, four specification tables, three new views and one
  adaptation of another lab's canvas. Phasing keeps every phase shippable dark, and
  Phase 1 is useful alone as the answer to "how fast can this pin go".
