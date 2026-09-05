# VLSI Lab: the plan

A lab for **digital integrated circuit design**, the course that follows digital
logic. It starts where the Logic Lab stops, at a gate with a propagation delay
that arrives as a number, and it asks where that number comes from. The answer is
a transistor circuit, and `packages/network` already solves transistor circuits
exactly under the piecewise-linear model. Splash glyph `▦`, directory
`apps/vlsi-lab`, engine as a bridge between `packages/network` and `packages/events`.

The path, in order. The inverter as two switches, and its delay extracted from
those switches. Gates as transistor networks, and what a series stack costs.
Logical effort, which is that cost written as one number per gate. Wires, and
Elmore's bound on them. Power, in its three parts. The clock, and the flip-flop
taken apart. Memory, where a cell's stability is a curve rather than a number.

This is a draft (2026-09-05) for Reed to settle. Its dependency, the Logic Lab and
its `events` package, is being built in parallel. Section 0 lists what needs a
decision, and §2.3 states the `events` API this plan assumes as a contract to
reconcile against the Logic Lab's brief when that brief exists.

The two rules that govern the other labs govern this one with no exemption. Every
explanatory sentence is a claim about physics, and a test must measure it. And
`CORE_SCOPE.md` decides what the engine may state exactly, what it may approximate
behind a guard, and what it declines with a reason. This lab has one exact object
and one approximation, and keeping them apart is most of the content. A gate's
delay under the piecewise-linear transistor model is exact. Elmore's delay is a
bound, and the plan labels it a bound everywhere it appears.

---

## 0. Open decisions

### Decision 1: the name (recommended: VLSI Lab)

`EE_LABS_MAP.md` §2 track D calls it the VLSI Lab, and the course it mirrors is
called that or "digital integrated circuit design" in most catalogues. LabNav short
form **"VLSI"**. The splash card names the path in one line, "the gate as
transistors, its delay, its power, and the memory cell".

Alternatives considered. *Digital IC Lab* is accurate and reads as a sibling of the
Analog IC Lab, which is a lab this one does not depend on. *Chip Lab* names an
artefact rather than a subject.

### Decision 2: where the delay-extraction bridge lives

Recommended: **a new module `packages/events/src/extract.js`**, owned by this lab's
overseer, importing from `network` and exporting into `events`. The alternative is a
module inside `packages/network`, which would make the network package depend on the
events package for its output types. The bridge reads a transistor netlist and
writes a gate model, so it belongs on the events side of the seam.

The Logic Lab owns `packages/events` under `PROGRAM.md` §5. This lab's `NEEDS.md`
carries the request, and the director resolves it once.

### Decision 3: one process model card, or several

Recommended: **one**, stated in §4.3 and used by every experiment. It is a 180 nm
model card, because 180 nm is the last node where the square law and the equivalent
resistance are close enough to the silicon for a course to use both. Scaling to a
smaller node changes every number in the lab and no lesson in it. Group E's voltage
sweep is where scaling appears, as a knob rather than a second card.

### Decision 4: how much of the Analog IC Lab this lab waits for

`EE_LABS_MAP.md` puts the VLSI Lab after "the Analog IC Lab's device group", for the
subthreshold model behind leakage. That lab is not planned. Recommended: **build
leakage here from a stated subthreshold slope**, 80 mV per decade, as a labelled
one-parameter model, and hand the parameter's derivation to the Analog IC Lab when it
exists. The lab is then blocked only on the Logic Lab, and §1 marks the row.

### Decision 5: the sizing convention

Recommended: **Weste and Harris's**. Every gate in the library is sized so that its
drive resistance equals the unit inverter's. The logical effort numbers then come out
at their textbook values, and §5 Group C measures them rather than quoting them. The
alternative is minimum-size gates throughout. That convention makes `g` and `p` depend
on the gate rather than on the topology, and no course teaches it that way.

---

## 1. The progression map

This lab leans on three labs and one package that do not all exist. This section
lists every idea it uses, where the suite teaches it, and the status of that
teaching. Nothing is closed silently. A row marked "being built" is the Logic Lab,
whose branch is `lab/logic-lab` today.

| Idea the lab leans on | Needed by | Taught at | Status |
| --- | --- | --- | --- |
| The two laws, nodal analysis, RC charging | A, D | Elements A to D, F | built |
| The capacitor as charge over voltage, and its energy | E1 | Elements F2, F3 | built |
| The MOSFET's square law and its three regions | A2, E3, G | Electronics D4 | planned, `ELECTRONICS_LAB_PLAN.md` Group D |
| The transistor as a switch with `R_on` | A1, B, C, D | Electronics D5 | planned, Electronics D5 |
| The CMOS inverter, `V_M`, and the noise margins | A2, G1 | Electronics D6 | planned, Electronics D6 |
| The load line and the operating point | A2 | Electronics D7 | planned |
| A gate with a propagation delay, and a truth table | B, C | Logic Lab, gates group | being built |
| The timing diagram as an interaction model | every group | Logic Lab, timing group | being built |
| Setup, hold, and the flip-flop | F | Logic Lab, sequential group | being built |
| The critical path and the maximum frequency | F2, F3 | Logic Lab, clock group | being built |
| The state machine diagram | none here | Logic Lab | being built, used by the Computer Lab |
| Subthreshold conduction as a slope | E4 | nowhere | **gap, E4 states it as a labelled model** |
| Interconnect as a distributed RC | D | nowhere | **gap, Group D** |
| Elmore's delay | D2 | nowhere | **gap, D2** |
| Logical effort | C | nowhere | **gap, Group C** |
| The SRAM cell and its noise margin | G1, G2 | nowhere | **gap, Group G** |
| Exact PWL waveforms in time | A1, A3, F1 | `packages/network` `pwl.js` | built |
| Newton over a companion, for the quasi-static sweep | A2, E3, G | `packages/network`, extended | planned, Electronics lane 1 |

Three things the map shows, so that they are decisions and not omissions. The lab's
**gate-level half cannot ship before the Logic Lab's `events` package**, and §9
phases the transistor-level half first for that reason. **Electronics D5 and D6 are
planned and not built**, so Group A restates their results from this lab's own model
card and cross-references them by id, and the progression test fails until they
exist. **The Analog IC Lab's subthreshold model does not exist**, and Decision 4
states what this lab does instead.

The order of the groups follows the map. Nothing in a group leans on an experiment
later in this lab. Group A is the bridge from Electronics D6, and it is the only
group a reader can sit before the Logic Lab ships.

---

## 2. The engine: a gate's delay from its transistors

### 2.1 What exists, and what is missing

`packages/network` has the two things a transistor-level cell needs.
`solvePWL` and `pwlTransient` give exact waveforms for piecewise-linear elements in
time, with every region change located as an event. `newtonDC` with junction
limiting finds an operating point and keeps its iterations. The MOSFET element and
its `switch` model arrive with the Electronics Lab's lane 1, in the schema
`apps/electronics-lab/AGENT_BRIEF.md` §3.1 fixes.

Three things are missing. There is no discrete-event simulator, which is the Logic
Lab's `events` package. There is no bridge from a transistor circuit to a gate model.
And there is no wire model, because no lab before this one has needed one.

### 2.2 The PWL MOSFET, and why the delay is exact

Under the `switch` model a MOSFET is a resistor of `ron` between drain and source
when `v_gs` crosses `vt`, and an open circuit otherwise. An inverter driving a
capacitance is then one resistor into one capacitor, whose solution is an
exponential. The 50 % crossing is at `R_on C ln 2`, and that is a closed form, not a
numerical result. `pwlTransient` produces the same number from the exact segment
solution, and a test pins the two against each other.

This is the sense in which "the PWL transistor in time is exact" in
`EE_LABS_MAP.md` §2. The waveform is exact, the crossing time is exact, and the
region changes are located rather than stepped over. Nothing here is a time step.

The square-law model is the other route, and it is a quasi-static sweep with the
Electronics Lab's guard. Group A2 draws both and prints the difference.

### 2.3 The `events` API this lab assumes

The Logic Lab owns `packages/events`. This lab assumes the following shape, and
**this is a contract to reconcile with the Logic Lab's brief when that brief
exists**. Where the Logic Lab chooses differently, this lab changes, and no
experiment in §5 depends on the names below.

```js
// packages/events/src/sim.js
/**
 * @param design  { nets: string[],
 *                  gates: [{ id, type, in: string[], out, tpLH, tpHL }],
 *                  flops: [{ id, d, q, clk, tPcq, tSetup, tHold }] }
 * @param stim    [{ t, net, value }]         value is 0 or 1
 * @param opts    { until, glitches: true }
 * @returns {{ events: [{ t, net, value, from }],
 *             at: (t) => Record<net, 0|1>,
 *             waveform: (net) => [{ t, value }],
 *             violations: [{ t, flop, kind }] }}
 */
export function simulate(design, stim, opts)
```

Three properties this lab needs from it, and each is an invariant in §2.8. Events
carry exact rational times, so two edges that coincide coincide in the record.
`waveform` returns the value changes and not a sampled trace. And `violations`
reports setup and hold failures rather than propagating an unknown value, because
Group F measures the margin and does not want a third logic level.

### 2.4 The delay-extraction bridge, exact

The bridge is this lab's own object, and it is the seam between the two engines.

```js
// packages/events/src/extract.js
/**
 * A gate model for the event simulator, extracted from a transistor netlist.
 * @param cell  { net, inputs: string[], output: string, vdd, model: 'switch' }
 * @param load  farads on the output node, or a netlist to solve into
 * @returns {{ tpLH, tpHL, tr, tf, cin: Record<input, farads>,
 *             cself, exact: true, path: [{ input, pattern, tp }] }}
 */
export function extractGate(cell, load)
```

How it works, and why it is exact. For each input transition the bridge enumerates
the switch states the transistors take, which is a finite set because the model is
piecewise linear. In each state the output node is driven through a resistance that
is a series and parallel combination of `ron` values, so the node's voltage is a
single exponential. The 50 % crossing is solved in closed form, and the worst input
pattern over the enumeration becomes `tpHL` or `tpLH`. `path` keeps every pattern
and its time, because Group B's lesson is that a NAND gate has two different falling
delays and the library quotes the slower one.

`cin` is read from the transistor widths in the netlist, and `cself` from the drain
areas. Both are sums, not fits. The bridge declines a cell whose output node is not
driven by a single conducting path in every state, and it gives the reason. A ratioed
or a pass-transistor cell has no single `R_on C`, and its waveform is not one
exponential. That refusal is content and it has a test.

### 2.5 Elmore, labelled a bound

For an RC tree the Elmore delay at a sink is a sum over resistors. Each resistor's
value is multiplied by the capacitance downstream of it. The sum is the first moment
of the impulse response. For a monotone step response it is an upper bound on the
50 % delay. `elmore(tree, sink)` returns the number. Every view that draws it draws it
as a bound, with the exact 50 % delay beside it where the exact one exists.

On the lab's default wire, 1 kΩ and 200 fF, Elmore gives 100.0 ps at the far end. The
exact 50 % delay of the distributed line is 75.4 ps. Elmore is 32.6 % high, and D2's
note quotes both numbers. This is `CORE_SCOPE.md` Rule 3, with the comparison itself
as the guard. The lab draws the convergence over the section count. It reads 200.0 ps
at one section, 125.0 ps at four, 106.3 ps at sixteen, and 100.0 ps in the limit.

### 2.6 The wire, as an element

A wire is `N` sections of series resistance and shunt capacitance, and it enters the
netlist as ordinary R and C elements. Nothing new is stamped. `wireOf({ R, C, N })`
builds the section list, and the app's wire knob is `N`. At `N = 1` the wire is a
lumped RC and the exact PWL solution applies. At larger `N` the exact solution is
still available, because the circuit is still linear, and D1's lesson is the
convergence of the two.

### 2.7 Measures

Everything the Elements lab measures, plus the following. The 50 % propagation delay
per input pattern and per edge. The 10 % to 90 % transition time. Input capacitance
per input, and self-load, in farads and in units of `C_u`. Logical effort `g`,
parasitic delay `p`, electrical effort `h`, and stage effort `f`. Path effort `F`,
its `N`-th root, and the path delay `D`, in `τ` and in picoseconds.

Then the rest. Elmore delay per sink, and the skew between two sinks. Energy per
transition, average power at a stated activity and frequency, short-circuit charge
per transition, and leakage current per gate. Static noise margin, read and hold, in
millivolts and as a fraction of `V_DD`. Setup, hold and clock-to-Q, each extracted
from the flip-flop's transistors.

### 2.8 Invariants, the fuzzer's checklist

Across random widths, loads, wire sections and supply voltages on every library
cell:

1. **The waveform is the closed form.** `pwlTransient` on an inverter into a
   capacitance agrees with `V_DD exp(−t/R_on C)` at every sample, to floating point,
   and its 50 % crossing agrees with `R_on C ln 2`.
2. **The extraction agrees with the simulation.** `extractGate`'s `tpHL` equals the
   50 % crossing measured by `pwlTransient` on the same netlist with the same load,
   to floating point, for every input pattern in `path`.
3. **Logical effort is the same number.** The delay `(g h + p) τ` with `τ = 3 R_u C_u`
   equals the extracted 50 % delay divided by `ln 2`, to 10⁻¹² relative, for every
   library gate at every load. Group C1 is this invariant made visible.
4. **Elmore bounds the exact delay.** On every generated RC tree the Elmore delay at
   every sink is greater than or equal to the exact 50 % delay from the linear
   solution. A counter-example fails the suite.
5. **Charge closes.** The charge delivered from the supply over one output rise
   equals `C_load V_DD` to floating point, and the energy dissipated in the pull-up
   resistance equals half of `C_load V_DD²`, independently of `R_on`.
6. **The switch model and the square law agree at the point.** The quasi-static
   sweep's transfer characteristic and the PWL model's rail voltages agree to the
   stated error, and the error the panel prints is the measured one.
7. **The butterfly is symmetric.** For a cell with matched halves, the read static
   noise margin computed from the upper lobe equals the one from the lower lobe to
   10⁻⁹, and the largest inscribed square is inscribed.
8. **Tellegen.** In every DC operating point, the sum of `v_k i_k` over the elements
   is zero, with the switch resistances counted.
9. **Events are ordered and exact.** In a run driven by `extractGate` models, no
   event precedes its cause, coincident events are recorded at the same time, and
   the total delay along any path equals the sum of its gate delays.
10. **Cross-lab.** The inverter's noise margins equal Electronics D6's at the same
    supply and threshold. The gate models handed to the Logic Lab reproduce that
    lab's timing diagram for the same design. The Computer Lab's adder built from
    this library has the delay the Computer Lab quotes.

---

## 3. Models: the cell library

Everything in the Elements plan's element table stays, and the Electronics plan's
MOSFET arrives as specified in `apps/electronics-lab/AGENT_BRIEF.md` §3.1. These are
added, each as a curated netlist with grid positions, drawn by
`packages/ui/Schematic.jsx`.

| Cell | Transistors | What it teaches |
| --- | --- | --- |
| `inv` | nMOS width 1, pMOS width 2 | the unit of the library, `g = 1`, `p = 1` |
| `nand2` | two nMOS width 2 in series, two pMOS width 2 in parallel | the series stack, `g = 4/3`, `p = 2` |
| `nand3` | three nMOS width 3 in series, three pMOS width 2 | `g = 5/3`, `p = 3` |
| `nor2` | two nMOS width 1 in parallel, two pMOS width 4 in series | `g = 5/3`, and why a wide gate is built from NAND |
| `nor3` | three nMOS width 1, three pMOS width 6 in series | `g = 7/3`, the gate a designer avoids |
| `mux2` | two transmission gates and an inverter | `g = 2`, and a cell the bridge declines to reduce to one exponential |
| `tgLatch` | transmission gate, two inverters, feedback | setup, hold and clock-to-Q, extracted |
| `dff` | two `tgLatch` cells on opposite clock phases | Group F's flip-flop |
| `sram6t` | two cross-coupled inverters, two access nMOS | the butterfly and its margins |
| `dram1t` | one access nMOS, one storage capacitor, one bit line | charge, swing and refresh |
| `wire` | `N` sections of R and C | Group D |

The MOSFET element gains no new fields. `ron` and `vt` are the switch model's, and
`kn`, `vt` and `lambda` are the square law's, both already in the schema. The wire is
ordinary R and C elements, so the netlist normaliser needs no change.

**Schematic description.** Four MOSFET glyphs, as the Electronics plan already
specifies. Two new overlays. The switch state draws each transistor open or closed at
the time cursor. The delay path lights the conducting path from the rail to the
output node, with its series resistance printed.

---

## 4. The app

### 4.1 Layout

The Elements lab's shape, unchanged. Sidebar with LabNav, report link, experiment
groups, cell picker, component NumFields with chips, model and toggle switches, and
the math panel. Main area with topbar meters, the schematic always visible, and one
pane below with a pane selector. Phone width first, no horizontal scroll at 390 px,
harness checked.

The topbar shows the extracted delay first. Then come the experiment's headline
numbers (`t_pHL`, `t_pLH`, `g`, `p`, `E` per transition, `SNM`) and the model in
use.

### 4.2 Views

- **Schematic with the switch overlay.** Each transistor drawn open or closed at the
  time cursor, the conducting path lit, and the series resistance of that path
  printed beside it. This is the picture the delay comes from.
- **Timing diagram.** The Logic Lab's canvas, first built there, reused here for
  gate-level runs. Signals against time with events marked. This lab's needs are in
  its props from the start, which are an analog trace overlaid on a digital one and a
  measurement cursor pair that prints the interval.
- **Scope, exact.** The PWL waveform of the output node, with the 50 % crossing
  marked and the closed form `R_on C ln 2` printed beside the measured time.
- **Transfer characteristic.** `v_out` against `v_in` from the quasi-static sweep,
  the unity-gain points marked, and the noise margins read off. Electronics D6's
  view, reused.
- **Butterfly.** Two transfer characteristics, one mirrored, with the largest
  inscribed square drawn and its side printed. Group G's canvas, new to this lab.
- **Effort.** The path drawn as boxes, each with its `g`, `h`, `p` and stage delay,
  the total `D` at the end, and a slider for the number of stages. New to this lab,
  and the Computer Lab will not need it.
- **Wire.** The ladder drawn with `N` sections, the exact response and the Elmore
  estimate on one axis, and the bound's excess printed as a percentage.
- **Power.** A stack of the three components at the current activity, frequency and
  supply, with the numbers in the corner and the supply on a slider.
- **Equations.** The extracted gate model printed as a table, then the netlist it
  came from, as the Elements lab prints its MNA rows.

### 4.3 Numbers

One model card, per Decision 3. Every number below is computed by the plan's script
from the four lines at the top, and every one becomes a pinned test.

- **Process.** `V_DD = 1.8 V`, `V_tn = 0.45 V`, `V_tp = 0.45 V`, `L = 0.18 µm`,
  `t_ox = 4 nm` so `C_ox = 8.62 fF/µm²`. Unit nMOS width `0.36 µm` with
  `I_DSAT = 216 µA`. Square law `k_n' = 300 µA/V²`, mobility ratio 2.
- **The two unit numbers.** `R_u = (3/4) V_DD / I_DSAT = 6.25 kΩ`, and
  `C_u = W (L + 2 L_ov) C_ox = 0.869 fF` at an overlap of 0.05 µm each side. So
  `R_u C_u = 5.43 ps`, and logical effort's `τ = 3 R_u C_u = 16.3 ps`.
- **The unit inverter.** Input capacitance `3 C_u = 2.61 fF`, self-load `3 C_u`,
  drive resistance `R_u`. Fanout-1 delay 22.6 ps, fanout-4 delay **56.5 ps**, which
  is the lab's unit of time. The published fanout-4 delay for this node is 80 ps to
  90 ps, and §11 names the gap and its cause.
- **The library's efforts.** `g` is 1, 4/3, 5/3, 5/3, 7/3 and 2 for the inverter,
  NAND2, NAND3, NOR2, NOR3 and the multiplexer. `p` is 1, 2, 3, 2, 3 and 4.
- **A path.** An inverter chain into 64 unit loads is fastest at three stages, with
  a stage effort of 4.00 and a delay of 15.0 τ, which is 169.5 ps exactly. One stage
  costs 65.0 τ, and six stages cost 18.0 τ, 20.0 % over the best.
- **The wire.** 1 kΩ and 200 fF. Elmore at the far end is 100.0 ps, the exact 50 %
  delay is 75.4 ps. A 5 kΩ, 1 pF wire takes 8779 ps unrepeated, and 974.9 ps with
  twelve repeaters of 22 unit inverters each, a factor of 9.01.
- **Power.** One fanout-1 inverter carries 5.22 fF, so 8.45 fJ a transition and
  16.9 fJ a cycle. A chip of 950 pF at 10 % activity plus a 50 pF clock net at
  500 MHz draws 153.9 mW and 81.0 mW, so the clock is 34.5 % of 234.9 mW. Leakage at
  3.6 nA a device is 6.48 mW over a million gates, 2.76 % of that total.
- **Short circuit.** A 100 ps input ramp costs 0.506 fC, which is 0.911 fJ, or 5.39 %
  of `C V²`. A 500 ps ramp costs 27.0 %.
- **The SRAM cell.** Cell ratio 2, pull-up ratio 1. Hold margin 647.4 mV, read
  margin **316.5 mV**, which is 17.6 % of the supply. At a cell ratio of 1 the read
  margin is 238.0 mV, at 4 it is 385.8 mV. Word-line under-drive to 1.4 V raises it
  to 455.7 mV. The bit line must reach 0.322 V to write, so the write margin is
  1.478 V.
- **The DRAM cell.** 25 fF against a 250 fF bit line gives an 81.8 mV swing, and
  22.5 fC is 140 000 electrons. A 0.7 V budget over 64 ms allows 273 fA of leakage.
- **The clock.** With `t_pcq = 52.7 ps` and `t_setup = 30.1 ps` extracted from the
  flip-flop, twelve fanout-4 stages of logic run at 1364 MHz with no skew and
  1201 MHz with 100 ps of skew, a loss of 12.0 %.

---

## 5. Curriculum: 30 experiments in 7 groups

Format, as the other plans. **The claim** the note makes, what the reader turns, and
what is **measured** against what **formula**. Every quoted number becomes a pinned
test computed from the model card, never a constant. Each experiment ships with
`see`, `try` and `why` in the three registers, within the `STYLE.md` budgets.

### Group A: The inverter as two switches (5) · bridge from Electronics D6

- **A1 · One resistor, one capacitor, one exponential.** The pull-down transistor in
  its switch model is 6.25 kΩ. Into a fanout-1 load of 5.22 fF the output falls as
  `V_DD exp(−t/R_on C)`, and the half-way crossing is at `R_on C ln 2 = 22.6 ps`.
  Measured: the exact waveform against the closed form at every sample, and the
  crossing against 22.6 ps.
- **A2 · The transfer characteristic, and where digital begins.** The quasi-static
  sweep of the matched inverter. `V_M = 0.90 V`, and the unity-gain points are
  `V_IL = 0.788 V` and `V_IH = 1.013 V`, so both noise margins are 0.675 V. The
  closed forms are `(3V_DD + 2V_t)/8` and `(5V_DD − 2V_t)/8`, which give Electronics
  D6's 2.05 V and 2.95 V at a 5 V supply. Measured: both margins, and the supply
  current at each rail.
- **A3 · The delay, extracted.** `extractGate` reads the two-transistor netlist and
  returns 22.6 ps falling and 22.6 ps rising for the matched inverter. The event
  simulator then runs a chain of them and its timing diagram matches the analog
  waveform's crossings. Measured: the extraction against `pwlTransient`, to floating
  point, and the chain's total against the sum.
- **A4 · Sizing the pull-up.** The pMOS carries half the current per width, so
  width 2 matches the two edges. Set it to width 1 and the rising delay doubles to
  45.2 ps while the falling delay stays at 22.6 ps. Measured: both edges at three
  width ratios, and the ratio that equalises them.
- **A5 · Fanout.** Delay against the number of identical inverters driven, which is
  a straight line. One load gives 22.6 ps, four give 56.5 ps, eight give 101.7 ps.
  The slope is the drive resistance times the input capacitance, and the intercept is
  the self-load. Measured: the line's slope and intercept against `R_u · 3C_u` and
  `R_u · 3C_u`.

### Group B: Gates as transistor networks (4)

- **B1 · The series stack.** A NAND2 puts two nMOS in series, so each is widened to 2
  and the stack's resistance returns to `R_u`. Its input capacitance rises to
  `4 C_u = 3.48 fF`, and its self-load to `6 C_u`. Into one inverter it falls in
  33.9 ps against the inverter's 22.6 ps. Measured: the input capacitance from the
  widths, and the delay against the extraction.
- **B2 · Two ways to fall.** A NAND2 falls at one time when both inputs switch
  together and at another when the lower input is already low. `extractGate`'s `path`
  keeps both, and the library quotes the slower. Measured: the two times, and which
  input pattern gives each.
- **B3 · Why a designer avoids NOR.** A NOR2 puts two pMOS in series, and a pMOS
  needs width 4 to match. Its input capacitance is `5 C_u` against the NAND's
  `4 C_u`, and a NOR3 needs `7 C_u`. Measured: the input capacitance of all six
  library gates, and the ratio to the inverter's.
- **B4 · The cell the bridge declines.** A two-input multiplexer built from
  transmission gates has no single conducting path from a rail to the output, so its
  output node is not one exponential. `extractGate` declines it with that reason, and
  the lab gives its delay from the exact linear solution instead. Measured: the
  refusal message, and the exact delay from `pwlTransient`.

### Group C: Logical effort (5)

- **C1 · The effort is the capacitance ratio.** `g` is the gate's input capacitance
  divided by an inverter's at the same drive resistance. For the library that is 1,
  4/3, 5/3, 5/3, 7/3 and 2. Measured: `g` computed from the netlist widths for all
  six gates, against the textbook values.
- **C2 · The parasitic delay is the self-load ratio.** `p` is the gate's own drain
  capacitance divided by an inverter's, which is 1, 2, 3, 2, 3 and 4. It is the delay
  the gate has when driving nothing. Measured: the extracted delay at zero external
  load, against `p τ ln 2`.
- **C3 · One number, two routes.** The delay `(g h + p)` in units of `τ = 16.3 ps`,
  multiplied by `ln 2`, equals the extracted 50 % delay exactly. Every gate, every
  load. Measured: the ratio, which is 0.693147 for all of them, to 10⁻¹² relative.
- **C4 · Sizing a path.** A NAND2, a NAND2 and an inverter driving sixteen unit
  loads. `G = 1.778`, `F = 28.44`, the best stage effort is 3.053, and the path delay
  is 14.16 τ, which is 160.0 ps exactly. The stage capacitances that achieve it are
  4.00, 6.87 and 15.7 in units of `C_u`. Measured: the three sizes, and the delay
  against the extracted chain.
- **C5 · The number of stages.** An inverter chain into 64 loads is fastest at three
  stages, 15.0 τ. One stage costs 65.0 τ, four cost 15.31 τ, and six cost 18.0 τ. The
  curve is flat near its minimum and steep away from it. Measured: the delay at each
  stage count, and the 2.09 % penalty at four against the 333 % penalty at one.

### Group D: Wires (4)

- **D1 · A wire is not a node.** A 1 kΩ, 200 fF wire as one lumped RC delays the far
  end by 200.0 ps under Elmore. Split it into four sections and Elmore falls to
  125.0 ps, into sixteen and 106.3 ps, and the limit is `RC/2 = 100.0 ps`. Measured:
  the Elmore delay at each section count, against `RC(N+1)/2N`.
- **D2 · Elmore is a bound, and here is by how much.** The exact 50 % delay of the
  distributed line is `0.377 RC = 75.4 ps`. Elmore's 100.0 ps is 32.6 % high. The
  view draws both, and the label on Elmore reads "bound". Measured: both numbers, and
  the bound holding on every generated tree in the fuzzer.
- **D3 · A tree, and the skew between its leaves.** Three resistors and three
  capacitances. Elmore gives 20.0 ps at the branch, 40.0 ps at one leaf and 36.0 ps
  at the other, so the skew is 4.0 ps. Raise the second branch's resistance to
  1000 Ω and the skew is zero. Measured: all three delays, and the resistance that
  balances the tree.
- **D4 · Repeaters.** A 5 kΩ, 1 pF wire takes 8779 ps unrepeated, because the delay
  grows with the square of the length. Twelve repeaters of 22 unit inverters each
  bring it to 974.9 ps, a factor of 9.01. Measured: the unrepeated delay, the optimum
  count and size, and the repeated delay.

### Group E: Power (5)

- **E1 · Energy per transition.** Charging 5.22 fF to 1.8 V takes 16.9 fJ from the
  supply, of which half is stored and half is dissipated in the pull-up resistance.
  The dissipated half does not depend on `R_on`. Measured: the supply charge against
  `C V_DD`, the stored energy against `½ C V_DD²`, and the resistor's integral at
  three values of `R_on`.
- **E2 · Activity, and the clock net.** 950 pF of logic at 10 % activity and 500 MHz
  draws 153.9 mW. A 50 pF clock net switches every cycle, so it draws 81.0 mW and is
  34.5 % of the 234.9 mW total. Measured: both powers, the share, and the saving from
  gating half the logic.
- **E3 · The current that goes nowhere.** During an input transition both devices
  conduct. From the quasi-static sweep the peak supply current is 30.4 µA, and a
  100 ps input ramp costs 0.506 fC, which is 5.39 % of `C V²`. A 500 ps ramp costs
  27.0 %. Measured: the peak current, and the charge at four ramp times.
- **E4 · Leakage, and the threshold.** At a subthreshold slope of 80 mV a decade,
  3.6 nA a device gives 6.48 mW over a million gates. Lower the threshold by 100 mV
  and the current rises by a factor of 17.8 to 64.0 nA. Measured: the current at four
  thresholds, and the factor against `10^(ΔV_t/S)`. The slope is a labelled model,
  per Decision 4.
- **E5 · The supply is the strongest knob.** Energy falls with the square of the
  supply and delay rises with `V/(V − V_t)²`. From 1.8 V to 1.2 V the energy falls
  55.6 % and the delay rises by a factor of 2.16. Measured: both curves, and the
  product `E d²` at five supplies.

### Group F: The clock (3)

- **F1 · A flip-flop, taken apart.** Two transmission-gate latches on opposite
  phases. The gate's resistance is `R_u/2 = 3.125 kΩ` into a 3.48 fF storage node.
  Clock-to-Q is 52.7 ps, setup is 30.1 ps, and hold is one inverter, 22.6 ps.
  Measured: all three, each from the exact PWL waveform of the storage node.
- **F2 · The maximum frequency.** The period must hold clock-to-Q, the logic, and
  setup. Twelve fanout-4 stages of logic give 732.9 ps and 1364 MHz. Eight stages
  give 1973 MHz and twenty give 843.9 MHz. Measured: the period at three depths, and
  the frequency from it.
- **F3 · Skew, both ways.** Skew adds to the period and steals frequency. 100 ps of
  it costs 12.0 %. It also sets a floor under the contamination delay, because a fast
  path plus skew can violate hold, and 50 ps of skew demands 50 ps of contamination
  delay. Measured: the frequency at four skews, and the hold constraint at three.

### Group G: Memory (4)

- **G1 · The cell is two inverters that hold each other.** The butterfly is one
  transfer characteristic and its mirror. With the word line low the largest
  inscribed square has a side of 647.4 mV, which is the hold margin. Measured: the
  square's side, and the two lobes agreeing to 10⁻⁹.
- **G2 · Reading disturbs the cell.** The access transistor pulls the storing-zero
  node up, and the margin falls from 647.4 mV to 316.5 mV, which is 17.6 % of the
  supply. Raise the cell ratio from 1 to 4 and the read margin goes from 238.0 mV to
  385.8 mV. Lower the word line to 1.4 V and it reaches 455.7 mV. Measured: the
  margin at six cell ratios and five word-line voltages.
- **G3 · Writing needs the opposite ratio.** The access transistor must now beat the
  load pMOS. The bit line has to fall to 0.322 V before the cell flips, so the write
  margin is 1.478 V. A stronger load pMOS improves reading and hurts writing.
  Measured: the flipping bit-line voltage, and the trade against the pull-up ratio.
- **G4 · One transistor and a capacitor.** 25 fF at 0.9 V holds 22.5 fC, which is
  140 000 electrons. Sharing it with a 250 fF bit line gives an 81.8 mV swing, and
  the sense amplifier resolves that. A 0.7 V budget over 64 ms allows 273 fA of
  leakage. Measured: the swing against `C_s/(C_s + C_bl)`, and the retention time at
  three leakage currents.

---

## 6. Hand-overs

- **← Logic Lab** (every group after A). The `events` package, the timing diagram
  canvas, and the gate and flip-flop abstractions this lab explains. The contract in
  §2.3 is reconciled against that lab's brief before Phase 3 starts.
- **→ Logic Lab** (A3, C3, F1). The extracted gate models replace that lab's typed
  delays, as an optional model source. Its timing diagrams then carry numbers from a
  transistor circuit. The link is tested both ways, and a mismatch fails the suite.
- **← Electronics Lab** (A1, A2, E3, G). D5's switch is this lab's switch element.
  D6's inverter is A2, with the same closed forms at a different supply. D4's square
  law is the quasi-static route. D7's load line is the picture behind A2.
- **→ Computer Lab** (C, F). The gate delays this lab extracts are the Computer Lab's
  datapath timing. Its adder, its register file and its clock period are quoted from
  this library, and both labs pin the same numbers.
- **→ Interfaces Lab** (A2, A4). The pin's output stage and its input threshold are
  this lab's inverter at a 3.3 V supply, and that lab quotes the same two closed
  forms.
- **← Analog IC Lab** (E4), which is not planned. The subthreshold slope is a stated
  parameter here and becomes a derived one there. `BACKLOG.md` carries the row.

---

## 7. Testing discipline

- **Unit** (`packages/events/src/extract.js`): the extraction against hand values for
  all six library gates at three loads. The declined cells and their messages. The
  Elmore function against hand sums on four trees. The wire builder against the
  section formula.
- **Unit** (`packages/network`): the switch-model MOSFET against its law at twenty
  points, which is the Electronics lane's test reused. `pwlTransient` on an inverter
  against the exponential.
- **Invariants** (§2.8), fuzzed across widths from 1 to 16, loads from 1 fF to 1 pF,
  wires from 1 to 64 sections, and supplies from 0.8 V to 1.8 V. Three hostile
  corners are included. They are the unloaded gate, the NOR3 with a 1 pF load, and
  the cell ratio of 1.
- **Experiments**: every number in §5 pinned as a function of the model card, never
  as a constant. Among them 22.6 ps, 56.5 ps, 16.3 ps, 0.693147, 15.0 τ, 100.0 ps,
  75.4 ps, 8.45 fJ, 34.5 %, 316.5 mV, 81.8 mV and 1364 MHz.
- **The map's promises**: a test walks every `why` and every cross-reference, and
  requires the referenced experiment to exist in the named lab. A reference to
  Electronics D6 fails until Electronics D6 is built, which is the design.
- **Guards**: the extraction's refusal for a non-single-path cell, the square law's
  quasi-static guard inherited from the Electronics Lab, and Elmore's bound label.
  Each is tested at both sides of its threshold.
- **Cross-lab pins**: the Logic Lab's timing diagram for a chain driven by extracted
  models. The Computer Lab's adder delay. The Interfaces Lab's pin thresholds.
- **Playwright harness**: the switch overlay follows the time cursor. The butterfly's
  square resizes with the cell ratio. The effort view's slider changes the stage
  count and the delay. No horizontal scroll at 390 px.
- **REVIEW_PLAYBOOK audit** before release, all eleven classes, a screenshot pass,
  and the sittings script with three seats. One seat sits Group A, because a reader
  arriving from the Logic Lab meets it first.

---

## 8. Integration and the dark launch

The mechanism is the one Power Lab and the Elements lab share, unchanged.

- Deployed **dark** at `/vlsi-lab/` from the first vertical slice. Unlisted, not
  secret.
- `apps/vlsi-lab/RELEASE_STATUS` reads `dark`. A test asserts that while it does, the
  splash, the root README and the other labs' LabNav contain no reference to the VLSI
  Lab. Flip the word to `released` and the same test demands the splash card, the
  README row and the nav entries, with counts pinned.
- `NEEDS.md` carries three items for the director. One `cp` line in `deploy.yml`. The
  lab's ids and counts in `progression.test.js`. And the request for
  `packages/events/src/extract.js` under Decision 2.
- The flip is **Reed's action**, after the release gate in §9.

---

## 9. Phasing

Each phase ships green and deployable dark. The transistor-level half comes first,
because it depends on `network` alone and `network` is built.

1. **The bridge, without events.** `extractGate` against `pwlTransient` on the
   inverter and the NAND2. App shell, schematic with the switch overlay, the scope,
   dark deploy and the `RELEASE_STATUS` test. **Group A** (5). Exit: invariants 1, 2
   and 5 fuzzed green, and A1 to A5 pinned.
2. **The library and its efforts.** The six gates, the quasi-static sweep, the
   transfer-characteristic view, the effort view. **Groups B, C** (9). Exit:
   invariant 3 green at 10⁻¹² across the library, and B4's refusal tested.
3. **Wires.** `elmore`, `wireOf`, the wire view. **Group D** (4). Exit: invariant 4
   green on ten thousand generated trees, and D2's 32.6 % pinned.
4. **Power.** The power view, the short-circuit integral, the leakage model.
   **Group E** (5). Exit: E1's charge closing to floating point, and E3's ramp sweep
   pinned.
5. **The clock, on `events`.** The Logic Lab's package arrives, §2.3's contract is
   reconciled, and the timing-diagram canvas is reused. **Group F** (3). Exit:
   invariant 9 green, and the Logic Lab link tested both ways.
6. **Memory.** The butterfly view, the SRAM and DRAM cells. **Group G** (4). Exit:
   invariant 7 green, and G2's margin curve pinned at six cell ratios.
7. **The release gate**, in order, each blocking the next. The full audit, every
   option, every preset, every claim, fuzzing, both browsers. The student sittings.
   Reed's own pass against the dark deployment. Then the flip.

Phases 1 to 4 are twenty-three experiments and need nothing from the Logic Lab. If
that lab slips, this one still ships four fifths of itself dark.

---

## 10. Non-goals (v1, stated so they are decisions rather than omissions)

- **HDL and synthesis.** No Verilog, no VHDL, no logic synthesis. The library is
  curated, as every lab's circuits are curated. `EE_LABS_MAP.md` §5 already declines
  this for the whole of track D.
- **Place and route, layout, design rules, parasitic extraction.** No form the suite
  could state, and no lesson that survives without the tool. The wire's R and C are
  stated parameters here.
- **Process design kits and foundry models.** BSIM parameters are datasheet facts.
  The two models per device are the ones a course teaches.
- **Nodes below 180 nm as separate model cards.** Decision 3. Velocity saturation,
  drain-induced barrier lowering and gate leakage each change a number, and the
  first two change the accuracy of the square law rather than a lesson.
- **Dynamic, domino and pass-transistor logic families.** Each needs a ratioed or a
  precharged cell that the extraction declines, and B4 states the boundary once.
- **Full-custom analog cells inside a digital lab.** The sense amplifier is drawn as
  a block with a stated resolution, and the Analog IC Lab owns its inside.
- **Statistical timing and process variation as distributions.** E4's threshold
  spread is a knob, not a Monte Carlo. The Random Signals Lab owns ensembles.
- **Electromigration, thermal maps, packaging, power delivery networks.** Datasheet
  and tool facts.
- **Testing, scan chains and built-in self test.** A subject with no waveform in it.
- **Digital past the physics of a gate.** The Logic Lab crosses that boundary on
  purpose, and this lab crosses back the other way. Neither reopens the other's
  ground.

---

## 11. Risks, named

- **The `events` contract moves.** §2.3 is a guess at a package another overseer is
  writing today. Mitigation: no §5 experiment depends on the names, Phases 1 to 4
  need nothing from it, and the contract is reconciled at the start of Phase 5 rather
  than assumed through the build.
- **Electronics D5 and D6 are planned, not built.** Group A cross-references them,
  and the progression test fails on a reference to an experiment that does not exist.
  Mitigation: Group A restates both results from this lab's own model card, so it
  stands alone, and the cross-reference is added in the release commit once
  Electronics ships. `BACKLOG.md` carries the row.
- **The fanout-4 delay is 56.5 ps against a published 80 ps to 90 ps.** The model has
  no wire capacitance, no input-slope effect and no velocity saturation.
  Mitigation: §4.3 states the gap and its three causes, and A5's note quotes the
  published figure beside the modelled one. The lesson is the linear fanout law,
  which the gap does not touch.
- **The equivalent resistance is a fitted quantity.** `R_u = (3/4) V_DD / I_DSAT` is
  Weste and Harris's average over the swing, not a measurement. Mitigation: A2 draws
  the square-law sweep beside the switch model and prints the difference, so the
  reader sees which model produced which number.
- **The static noise margin is a construction, not a formula.** The largest
  inscribed square is found numerically. Mitigation: invariant 7, the symmetry check,
  and a test that the returned square is inscribed and that no larger one is.
- **Elmore read as a delay.** A reader who meets 100.0 ps in D1 may carry it as the
  answer. Mitigation: D2 is the next experiment, the label reads "bound" in every
  view, and invariant 4 fails the suite if the bound is ever violated.
- **Thirty experiments over two engines.** The lab spans `network` and `events`, and
  the bridge between them is new code. Mitigation: the bridge is Phase 1, before any
  gate-level work, and invariant 2 pins it against the analog solution.
- **Cost.** One new module, one new canvas, and a library of eleven cells. Phasing
  keeps every phase shippable dark, and Phase 1 is useful on its own as the answer to
  "where does a gate delay come from".
