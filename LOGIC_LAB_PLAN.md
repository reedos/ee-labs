# Logic Lab: the plan

Track D's first lab: **digital logic**, from one gate to a state machine with a
clock period. It is the root of the digital half of the map, and three labs wait
on it. Splash glyph `⊓`, directory `apps/logic-lab`, engine the new package
`packages/events`.

The path, in order. The gate and its truth table. Boolean algebra, the Karnaugh
map, and minimisation. The multiplexer, the decoder and the adder. Propagation
delay, the glitch, and the hazard. The latch, the flip-flop, setup and hold.
Registers, counters, and the finite state machine built from a specification.
The clock: skew, the critical path, and the maximum frequency. Metastability, as
a labelled rate.

This is a draft (2026-09-05) for Reed to settle. §0 lists what needs a decision.
§1 is the progression map against what the suite has built. Every number quoted
below was computed by a script against `packages/events` before it was written,
and each becomes a pinned test.

The two rules that govern the other labs govern this one with no exemption.
**Every explanatory sentence is a claim about physics, and a test must measure
it.** And `CORE_SCOPE.md` decides what the engine may state exactly, what it may
approximate behind a guard, and what it declines with a reason. Logic is the
easiest lab in the map to make exact and the easiest to make dishonest. A gate
with a delay has an exact waveform. A gate's rise time, its voltage, and what a
flip-flop does when its setup time is violated do not, and §2 declines all three
by name.

---

## 0. Open decisions

### Decision 1: the name (recommended: Logic Lab)

`EE_LABS_MAP.md` §2 already calls it the Logic Lab, and the course it mirrors is
called digital logic or digital design in most catalogues. LabNav short form
**"Logic"**. The splash card names the path in one line: "gates, the map, the
adder, the glitch, the flip-flop, the clock".

Alternatives considered. *Digital Lab* reads as the opposite of the analog track
and would collect the Computer Lab and the Interfaces Lab under one name.
*Gates Lab* names the first group and none of the sequential half.

### Decision 2: time as a whole number of picoseconds

Recommended: **every time in the engine is an integer count of picoseconds.**

A discrete-event simulator earns the word exact only if adding a delay to an
instant lands on an instant. In floating point it does not, and two paths that
should reconverge at the same time miss each other by an amount that depends on
the order the additions happened in. An integer picosecond removes the question.
The library's fastest cell is 30 ps, so the grid is thirty times finer than
anything the lab draws, and the app converts to nanoseconds for display only.

The cost is that a netlist cannot carry a delay of 30.5 ps. `normalize` refuses
one with the reason rather than rounding it.

### Decision 3: transport delay by default, inertial as a labelled toggle

Recommended: **transport delay is the default, and inertial delay is a switch on
the same netlist.**

Transport delay passes a pulse of any width, which is what makes a hazard
visible. Inertial delay rejects a pulse shorter than the gate's own delay, which
is what a real cell does. Neither is an approximation of the other, and both are
exact statements of the model they name. The pane says which one produced the
picture, and the run reports every pulse the inertial model rejected with the
width it rejected. Group D is built on the pair.

### Decision 4: metastability ships here, as a labelled model

Recommended: **build Group H now, with `τ` and `T0` as this lab's parameters.**

`EE_LABS_MAP.md` says the rate comes from the Analog IC Lab's latch. That lab is
not built and is not scheduled. The alternative to shipping the model is
shipping nothing about metastability, and a digital logic course that never
mentions it has a hole in it where the synchroniser goes. The model is the
standard exponential one, it carries its three assumptions in the panel, and its
`τ` becomes a hand-over the day the Analog IC Lab measures one.

### Decision 5: the two new canvases live in the app for now

Recommended: **build the timing diagram and the state machine diagram in
`apps/logic-lab/src/components`, with the second lab's needs already in their
props.**

`PROGRAM.md` §4 names the Interfaces Lab and the VLSI Lab as the timing
diagram's second users, and the Computer Lab as the state machine diagram's.
None of the three is built, so nothing can claim the component yet. The props
they will need are listed in §4.2 and are implemented now, and `NEEDS.md` asks
the director to promote both into `packages/ui` when the second lab arrives.

### Decision 6: no hardware description language

Recommended: **no Verilog and no VHDL, in this lab or in the map.**

A hardware description language is a notation for the same objects, and every
one of those objects appears here as a netlist a reader can see and time. The
lab teaches what synthesis produces, not how to write the input to it. Stated
here so that it is a decision rather than an omission.

---

## 1. The progression map

This section lists every idea the lab leans on, the experiment that teaches it,
and whether that experiment exists.

| Idea the lab leans on | Needed by | Taught at | Status |
| --- | --- | --- | --- |
| Two voltage levels, and a gate that maps one set of levels onto another | A onward | nowhere. Electronics D6 is its plan | **gap, deferred (Decision 7)** |
| A waveform that is exact between events, and a race as the order of events | the whole engine | Power Lab's `switched` engine | built, generalised here |
| The time constant, and why a real transition takes time | A6, D1 | Elements F1, F2 | built, and used only to say what this engine declines |
| Frequency as one over a period | G, H | Elements H1, Signal Lab's sampling group | built |
| The switch with `R_on`, and the transistor as one | nowhere in v1 | Power Lab A1, Electronics D5 | built and planned, not needed |
| Noise margins, and why two levels survive a wire | D1's note, G4 | nowhere. Electronics D6 | **gap, deferred (Decision 7)** |
| Sets, counting, and the binary numeral | A5, B, C | nowhere, and nowhere needed | self-contained, defined on contact |
| A rate, and the mean time between events at that rate | H | Random Signals Lab | not built, and the model is labelled |

The lab leans on almost nothing that another lab must build first. That is why
`EE_LABS_MAP.md` §4 puts it third in the order, ahead of six labs with heavier
dependencies. Two rows are gaps, and both are the same gap.

### Decision 7: the CMOS inverter, and what this plan does about it

`EE_LABS_MAP.md` says track D opens after Electronics D6, the CMOS inverter. D6
is not built. The Electronics Lab's own brief puts groups D to O behind its lane
1 gate, so D6 is at least a phase away.

**No lesson in this lab references D6, and the progression test enforces it.**
The one place a reader would want it is the sentence explaining why a gate has
exactly two values, and Group A1 states the two-level abstraction as this lab's
own starting point instead. `BACKLOG.md` carries the cross-reference as deferred,
with the dependency named, and the day D6 lands the director reopens it. What
changes then is one sentence in A1 and one hand-over link, and no experiment
moves.

---

## 2. The engine: exact delays, and no continuous state between them

### 2.1 What `switched` already had, and what is new

`packages/switched/src/events.js` walks a period by propagating a state vector
to the next switching instant, locating that instant by bisection, and going on.
Two of its three parts carry over. The event idea carries over whole. The
bisection does not, because a logic event's time is known when the event is
scheduled rather than found by search. The propagator does not either, because
nothing moves between two events in a logic netlist.

| Need | In `switched` | In `events` |
| --- | --- | --- |
| The instant the next thing happens | found by bisection on the exact solution | known when the event is scheduled, as an integer |
| The state between two instants | a matrix exponential of the state vector | unchanged, by construction |
| A tie between two events at one instant | broken by probing past the root | removed. Every event at an instant is applied together |
| The waveform | sampled from the analytic solution | the list of instants and values, complete |

### 2.2 The netlist of gates

A **net** is a wire with a name. A **driver** is a source, a gate, a wire or a
flip-flop, and it drives one net. A driver's `out` names that net and defaults
to the driver's own id, so the common case reads as "the gate `p` drives the
signal `p`" with nothing extra written down. A `wire` is a driver with no logic,
which is how clock skew and interconnect are written.

```js
{
  name: 'the static-1 hazard',
  unit: { num: 1, den: 1e12 },   // the time grid, an exact rational of a second
  sources: [{ id: 'a', kind: 'input', value: 1 },              // held, and enumerable
             { id: 'clk', kind: 'clock', period: 1000, high: 500, phase: 0 },
             { id: 'x', kind: 'step', at: 100, from: 1, to: 0 },
             { id: 'd', kind: 'pattern', period: 200, bits: [0, 1, 1, 0], repeat: false }],
  gates: [{ id: 'p', kind: 'and', in: ['a', 'b'], out: 'p', delay: 70, tr: 70, tf: 70, init: null }],
  wires: [{ id: 'clk2', from: 'clk', delay: 50 }],
  flops: [{ id: 'q', d: 'p', clk: 'clk', edge: 'rising', tcq: 80, tsu: 40, th: 20, init: 0 }],
  outputs: ['q'],
  resolve: { sda: 'wired-and' },  // per net: 'single' (the default), 'wired-and', 'wired-or'
  delayMode: 'transport',         // or 'inertial' (Decision 3)
  lib: {},                        // per-kind delay overrides
  cells: {}                       // cells this netlist registers of its own
}
```

### 2.2a A net with more than one driver

Two devices on one open-drain line each either pull it low or release it, and a
pull-up holds it high when nobody pulls. That net is the conjunction of what its
drivers do, and `resolve` says so. Three rules, and each is exact.

- `wired-and`, the open-drain bus the Interfaces Lab needs.
- `wired-or`, its dual.
- `single`, the default. Drivers that agree give their common value. Drivers
  that disagree produce a **conflict event**, with the net, the drivers and
  their values, rather than a silently chosen winner. The truth table declines a
  net in that state and names it.

### 2.2b The time grid

Every time is an integer count of the netlist's `unit`, and the unit is an exact
rational number of seconds. One picosecond is the default, and this lab uses it
throughout.

A lab whose natural time is not a round number of picoseconds picks its own.
A 9600 baud bit time is 1/9600 of a second, which is not a whole number of
picoseconds. On a grid of one three-hundred-billionth of a second it is
31 250 000 units, and a 30 ps gate beside it is 9 units. Both exact, both whole,
in one run. That is what lets the Interfaces Lab put a protocol and a gate in
the same netlist without either drifting.

### 2.2c What a consumer may register

`packages/events` stays general. A lab that needs a cell this library has no
entry for registers it on its own netlist, as
`{ name, fanIn: [lo, hi], fn, delay: { [fanIn]: units } }`. The VLSI Lab's
extracted cells and the Interfaces Lab's pin models are registered that way.
Neither they nor an extraction module, a cache model, a datapath or a protocol
checker become this package's business. Those belong to the labs that need
them.

### 2.3 One instant, in three steps

1. Every event at time `t` is applied at once. Nothing is evaluated first.
2. Each flip-flop whose clock has an edge at `t` samples D as it stood before
   `t`. The setup check is made against the same instant.
3. Every gate and wire that reads a signal which changed at `t` is evaluated
   once, against the state after step 1. It schedules its output for `t` plus
   the delay for the direction it is going.

Step 1 before step 3 is the determinism argument. Two gates that change at 140 ps
both change at 140 ps, and the gate below them sees both. No order within an
instant reaches the model, so the answer does not depend on the order the netlist
lists its gates. The fuzzer shuffles the gate list and requires the same events.

### 2.4 Scheduling, and what a gate swallows

A gate schedules an output change only when the value differs from the last one
already scheduled on that signal. Two things then cancel a scheduled event, and
both are reported.

- **Overtaking.** A gate whose rise and fall delays differ can send a later input
  change to an earlier instant. The event it overtakes never reaches the output.
- **Inertial rejection.** Under `delayMode: 'inertial'` a new schedule cancels
  everything pending on that signal, which rejects any pulse shorter than the
  gate's own delay.

Each cancelled event is returned in `swallowed`, with the width of the pulse that
did not appear and the mode that removed it. A pulse the model dropped in silence
would be a race the reader cannot see.

### 2.5 The state at t = 0

Every gate given an `init` is held at it, and every other gate is updated from
the same snapshot as all the others until nothing moves. Simultaneous update, so
the answer does not depend on the netlist's order. `settled` then says whether
every gate agrees with its own inputs.

A ring of three inverters does not agree, and the run reports `settled: false`
rather than inventing a state. The simulation starts anyway, finds the one stage
that disagrees, and schedules its correction. The result is a ring oscillator with
a period of 180 ps, which is two laps of three 30 ps inverters.

### 2.6 The truth table, computed with no delays at all

`truthTable(net)` evaluates each gate once in topological order for each of the
2ⁿ input vectors. It shares no code with the simulator, which is what makes the
agreement between them evidence rather than restatement. It declines two kinds of
netlist by name.

- A netlist with a ring in it, naming the ring. That ring is a latch, and Group E
  opens on this refusal.
- A netlist with a flip-flop in it, because a flip-flop's output depends on when
  and not only on what.

### 2.7 Minimisation, exactly

`boolean.js` is finite combinatorics, so every answer is exact and none of it is
a search that stops early.

- `primeImplicants(minterms, n, dontCare)` by Quine and McCluskey. Every prime,
  not a sample of them.
- `minimalCover(minterms, primes, n)` takes the essential primes, then covers the
  rest by exhaustive search over subsets. Fewest cubes first, then fewest
  literals among the covers of that size.
- `netFromCover(cover, names)` builds the two-level netlist the cover describes,
  one inverter per complemented variable, one AND per cube, one OR over them.

So a group B experiment minimises a function, builds the circuit, and times it.
Each step is a measurement of the one before.

### 2.8 The paths, and the clock period

`timingPaths(net)` gives every endpoint its longest and shortest arrival by one
pass over the topological order. A startpoint is a primary input or a flip-flop
output, and an endpoint is a declared output or a flip-flop D input. Each cell
contributes the larger of its two delays to the long path and the smaller to the
short one.

`fMax(net, { skew })` times the register-to-register paths only.

```
setup:  T ≥ t_cq + t_pd + t_su − t_skew
hold:   t_cq + t_pd(min) ≥ t_h + t_skew
```

The hold inequality does not contain T. A hold failure is not fixed by slowing
the clock, and the test pins that by giving the same design two periods and
requiring the same hold slack.

### 2.8a Where this engine measures setup and hold

**At the flip-flop's terminals.** The setup time is how long D had been still
when the clock edge arrived, and the hold time is how long it stays still after.
Both are read off the event list, and the violation carries the measured time,
the required time and the slack between them.

The VLSI Lab's plan defines the same two times inside the cell, as the storage
node reaching its trip point before the gate closes. The two agree when the
cell's own internal delays are folded into `t_su` and `t_h`, which is what a
characterised library does. The difference is where the boundary is drawn, not
what is being claimed. This lab takes `t_su` and `t_h` as given numbers of the
cell. The VLSI Lab derives them and hands them back. `NEEDS.md` records the
seam so the director reconciles it once.

### 2.9 Metastability, the one model that is not exact

`1 / MTBF = T0 · f_clk · f_data · exp(−t_r / τ)`. CORE_SCOPE Rule 3 applies. The
function returns its parameters and three assumptions with every answer, and the
panel prints all four.

- The asynchronous edges are uniform in time and independent of the clock.
- `τ` and `T0` are taken as constants of the cell.
- The exponential is the tail of the settling, not the first `τ` of it.

### 2.10 Declined, with the reason

- **A rise time.** A transition in this engine takes no time. A signal that
  spends time between the levels is the Electronics Lab's transfer characteristic
  and the VLSI Lab's Elmore delay.
- **A voltage.** There are two values. The noise margins that separate them are
  Electronics D6 (Decision 7).
- **A zero-delay gate.** `normalize` refuses it, because a ring with no delay has
  no waveform.
- **A delay that is not a whole picosecond** (Decision 2).
- **What a flip-flop does on a violated setup time.** The run reports the
  violation with its slack and takes the value that stood before the edge, and
  the report says that this is the model's choice rather than a measurement.

### 2.11 Measures

Every event with its cause and the delay that produced it. Every signal's
waveform as its transitions. Setup and hold violations with slack. Swallowed
pulses with width. The truth table and its minterms. Prime implicants, the
minimum cover, and its literal count. Every endpoint's longest and shortest
arrival, and the gates along each. `t_min`, `f_max`, hold slack. The metastable
rate and its mean time.

### 2.12 Invariants, the fuzzer's checklist

Over sixty random netlists of up to twelve gates, with and without asymmetric
rise and fall delays.

1. **Causality.** No event precedes its cause, the gap between them is exactly
   the gate's own delay for the direction it went, and the cause is an input of
   that gate which changed at that instant.
2. **Determinism.** The same netlist gives the same events twice. Shuffling the
   gate list and the source list changes nothing.
3. **The truth table.** A combinational netlist's settled state equals the table
   computed with no delays, for every input vector, and the run reports
   `settled: true`.
4. **Slack.** A synchronous design's registered values do not change when any
   gate's delay is perturbed by anything up to the slack on its path. One
   picosecond past the slack, a setup violation is reported with slack −1 ps.

Two more, on the library netlists rather than random ones. The ripple adder's
outputs equal `a + b` for all 256 operand pairs. The state machine built from a
specification detects the sequence that specification describes.

---

## 3. Models: the gate library

The delays below are this lab's library, not a datasheet. They are chosen so
that the arithmetic a reader does on paper is the arithmetic the engine does.
Every one is a knob, and every quoted number is computed from the knob.

| Cell | Fan-in 1 | 2 | 3 | 4 |
| --- | --- | --- | --- | --- |
| NOT | 30 ps | | | |
| BUF | 40 ps | | | |
| NAND, NOR | | 50 ps | 60 ps | 70 ps |
| AND, OR | | 70 ps | 80 ps | 90 ps |
| XOR, XNOR | | 90 ps | 130 ps | |
| wire | 10 ps | | | |

An AND is a NAND and an inverter. The library's AND is 70 ps and that pair is
80 ps, and B4 measures the 10 ps as the saving a single cell buys over two.

The flip-flop: `t_cq = 80 ps`, `t_su = 40 ps`, `t_h = 20 ps`. Metastability:
`τ = 20 ps`, `T0 = 20 ps`.

The library netlists, with the names every lesson reads:

| Name | Signals a lesson reads | Built by |
| --- | --- | --- |
| One gate | `a`, `b`, `y` | `oneGate(kind)` |
| NAND alone | `a`, `b`, `y` | `nandOnly('not' \| 'and' \| 'or' \| 'xor')` |
| The hazard | `a`, `b`, `c`, `na`, `p`, `q`, `r`, `y` | `hazardNet({ consensus })` |
| The multiplexer | `a`, `b`, `s`, `ns`, `m0`, `m1`, `y` | `mux2()` |
| The decoder | `a1`, `a0`, `d0` to `d3` | `decoder24()` |
| The full adder | `a`, `b`, `cin`, `x`, `s`, `g`, `p`, `cout` | `fullAdder()` |
| The ripple adder | `a0…`, `b0…`, `x0…`, `s0…`, `c1…`, `cout` | `rippleAdder(n)` |
| One flip-flop | `clk`, `d`, `q` | `oneFlop({ at, phase })` |
| The register | `clk`, `din`, `q0…` | `shiftRegister(n)` |
| The latch | `s`, `r`, `q`, `qn` | `srLatch()` |
| The D latch | `d`, `g`, `q`, `qn` | `dLatch()` |
| The flip-flop from gates | `clk`, `d`, `m`, `mn`, `q`, `qn` | `masterSlave()` |
| The ring | `i0`, `i1`, `i2` | `ring(n)` |
| The counter | `clk`, `q0…`, `e2…`, `d0…` | `counter(n)` |
| Two flip-flops and a path | `clk`, `clk2`, `q1`, `mid`, `q2` | `onePath({ skew, logic })` |
| The adder between registers | the adder's, plus `ra0…`, `rb0…`, `r0…`, `rc` | `pipelinedAdder(n, { skew })` |
| A state machine | `clk`, its inputs, `q0…`, `d0…`, its outputs | `fsmNet(spec)` |

---

## 4. The app

### 4.1 Layout

Circuit Elements Lab's shape, unchanged: a sidebar with LabNav, the report link,
the experiment groups folded, the knobs as NumFields with chips, and the terms
panel. Main: a topbar of headline numbers, the gate diagram always visible, and
one pane below with a pane selector. Phone-width first, with no horizontal
scroll at 390 px.

The topbar shows the experiment's headline first. Then come the delay of the
longest path, the gate count, and the delay model in use.

### 4.2 Views

- **Timing diagram** (`TimingCanvas`, new). Signals down the left, time across,
  one row per signal drawn as its transitions. Every event is a mark, and a
  cause line joins an event to the event that caused it.

  Its props are written for the two labs that will want it. `signals` takes any
  order the caller gives. `groups` draws a labelled band of rows. `marks` names
  an instant and `spans` measures an interval with its width printed. `busses`
  draws a set of rows as one numeric row, and `cursor` moves the read line. The
  Interfaces Lab needs the bus row and the span, and the VLSI Lab needs the
  cause line.
- **State machine diagram** (`StateCanvas`, new). States as circles, transitions
  as arcs labelled with the input that takes them, the current state lit, and the
  arc last taken lit. Props: `states`, `edges`, `active`, `taken`, `outputs` for
  a Moore output drawn inside the circle, and `encoding` to print the state's
  bits beside its name. The Computer Lab needs `outputs` for the control unit.
- **Gate diagram** (`GateCanvas`). The netlist drawn as gates and wires, with
  each signal's present value beside it and the critical path highlighted.
- **Truth table.** Every row, with the current input vector lit.
- **Karnaugh map.** The map in Gray-code order, the cover drawn as loops, and the
  literal count beside it.
- **Path list.** Every endpoint with its longest and shortest arrival, and the
  gates along the path.
- **Events.** The event list as a table, with cause, delay and time.

### 4.3 Numbers

The defaults, all computed and all pinned. The library of §3, plus:

- The hazard: `b = c = 1` and `a` stepping from 1 to 0 at 100 ps. The two paths
  are 140 ps and 170 ps, and the pulse is 30 ps wide at 240 ps.
- The 4-bit ripple adder: `cout` at 650 ps, `s3` at 600 ps, `s0` at 180 ps.
  It has 20 gates, and costs 140 ps per extra bit.
- The counter: 4 bits, 6 gates, 4 flip-flops, `t_min = 350 ps`, 70 ps per bit.
- The adder between registers: `t_min = 770 ps` and `f_max = 1.2987 GHz`, with
  200 ps of hold slack.
- The 101 detector: 3 states, 2 state bits, 6 rows, 1 unused code, 6 gates,
  `t_min = 230 ps`.
- Metastability: `f_clk = 1 GHz`, `f_data = 1 MHz`, and a 1000 ps clock period.

---

## 5. Curriculum: 45 experiments in 8 groups

Format, as the other plans: **the claim** the note makes, what the reader turns,
and what is **measured** against what **formula**. Every quoted number becomes a
pinned test, computed from the knobs rather than typed in. Each experiment ships
with `see`, `try` and `why` in the Elements lab's three registers.

### Group A: Gates and truth tables (6)

- **A1 · Two values, and one gate.** An inverter, with its input held. The output
  is the input's complement, and it arrives 30 ps later. The two-level
  abstraction is stated as this lab's starting point, with what it leaves out
  named (Decision 7). Measured: the output for both inputs, and the 30 ps.
- **A2 · AND and OR, and the table that defines them.** Both gates on the same
  two inputs, and all four rows walked. An AND takes 70 ps and so does an OR.
  Measured: eight rows, and both delays.
- **A3 · NAND and NOR, and why they are faster.** 50 ps against 70 ps, because an
  AND is a NAND with an inverter after it. Measured: both delays, and the 80 ps
  of the pair against the library's 70 ps single cell.
- **A4 · One gate is enough.** An inverter, an AND, an OR and an exclusive-or,
  each built from NAND gates alone. The exclusive-or takes four NAND gates and
  150 ps, where the library's own cell is 90 ps. Measured: the four truth
  tables, the gate counts, and the four delays.
- **A5 · The truth table of a netlist.** Three inputs into a small netlist, and
  all eight rows read off. A table of n inputs has 2ⁿ rows, and 2^(2ⁿ) tables are
  possible for n inputs. Measured: the eight rows against the simulated steady
  state, and the two counts.
- **A6 · The wire, and the delay that is not a gate.** A buffer at 40 ps and a
  wire at 10 ps in the same netlist. The wire changes no value and moves every
  time. Measured: both delays, and the output value unchanged by either.

### Group B: Boolean algebra and the map (6)

- **B1 · The algebra's laws, measured.** Commutation, association, distribution
  and absorption, each as two netlists with the same truth table and different
  gate counts. Measured: the tables agree row for row, and the counts differ.
- **B2 · De Morgan.** `(a·b)' = a' + b'`, as two netlists. The NAND is one cell at
  50 ps and the inverted-inputs OR is two levels at 100 ps. Measured: the tables
  agree, and the two delays.
- **B3 · The canonical sum of products.** `f = Σ(0, 1, 2, 5, 6, 7)` written
  straight from its minterms: 6 terms, 18 literals, 12 gates and 260 ps. Six
  terms do not fit one OR cell, so the last level is a tree of them. Measured:
  the gate count, the literal count, the delay, and the table.
- **B4 · The Karnaugh map, and the loops on it.** The same function on a
  three-variable map in Gray-code order. Six prime implicants, and a minimum
  cover of 3 cubes and 6 literals: `a'b' + bc' + ac`. Measured: the prime count,
  the cover, and the literal count.
- **B5 · The minimised circuit, built and timed.** The cover of B4 built as
  gates: 7 gates and 180 ps against B3's 12 gates and 260 ps. The truth table is
  unchanged. Measured: both gate counts, both delays, and that the tables agree.
- **B6 · The multiplexer, minimised.** The multiplexer's own table reduced to
  `bs + as'`, 2 cubes and 4 literals, which is the circuit C1 already draws.
  Measured: the minterms, the cover, and the literal count.

### Group C: The blocks a datapath is made of (6)

- **C1 · The multiplexer.** `y = a·s' + b·s`. The select path is 170 ps and the
  data path is 140 ps, because the select passes an inverter first. Measured:
  the four rows, and both arrivals.
- **C2 · The decoder.** Two inputs, four outputs, exactly one high in every row.
  Three outputs arrive at 100 ps and `d3` at 70 ps, because `d3` needs no
  complement. Measured: the one-high property in all four rows, and the two
  arrivals.
- **C3 · The half adder.** Sum is XOR and carry is AND. The sum arrives at 90 ps
  and the carry at 70 ps, and the two bits read as `a + b`. Measured: the four
  rows as a two-bit number, and both arrivals.
- **C4 · The full adder.** Three inputs, and a carry-out at 230 ps against a sum
  at 180 ps. The carry-out's path is `cin` through one AND and one OR, at 140 ps.
  Measured: the eight rows as a two-bit number, and the three arrivals.
- **C5 · The ripple-carry adder.** Four full adders. `cout` at 650 ps, `s3` at
  600 ps, `s0` at 180 ps. Every one of the 256 operand pairs adds correctly.
  Measured: the sum for a swept operand, and the three arrivals.
- **C6 · The carry is the cost.** The adder's width on a knob. The carry chain
  grows by 140 ps a bit: 230 ps at one bit, 650 ps at four, 1210 ps at eight and
  4570 ps at thirty-two. Measured: the delay at four widths, and the slope.

### Group D: Delay, glitches and hazards (6)

- **D1 · Propagation delay is additive.** A chain of gates, and the output's
  arrival equal to the sum of the delays along it. The path list names each gate.
  Measured: the arrival against the sum, at three chain lengths.
- **D2 · Two paths, one output.** The hazard netlist with `b = c = 1`, and `a`
  falling at 100 ps. The two paths to the OR are 140 ps and 170 ps. Measured:
  both arrivals, and the 30 ps between them.
- **D3 · The glitch.** The same run, watching `y`. The output should hold at 1
  for either value of `a`, and it falls at 240 ps and rises again at 270 ps. The
  pulse is 30 ps wide, which is the inverter's own delay. Measured: the two
  events, the width, and the settled value against the truth table.
- **D4 · Covering the hazard.** The consensus term `b·c` added, which is the
  Karnaugh map's bridge between two loops. The output does not move at all, and
  the OR grows from 70 ps to 80 ps. Measured: no event on `y`, the two OR delays,
  and the table unchanged.
- **D5 · Inertial delay, and the pulse a real cell swallows.** The same netlist
  under the other delay model. The glitch does not appear, one pulse is reported
  swallowed, and its width is 30 ps against the gate's 70 ps. Measured: the event
  count under each model, and the swallowed width.
- **D6 · The adder glitches while it settles.** 7 + 0 changing to 7 + 1. Every
  sum bit moves in turn at 1180, 1230, 1370 and 1510 ps, and `cout` never moves.
  The answer is right 510 ps after the change and wrong before it. Measured: the
  four arrivals, and the settled sum.

### Group E: The latch and the flip-flop (6)

- **E1 · A ring has no truth table.** Two NOR gates cross-coupled. The truth
  table declines the netlist and names the ring. That refusal is what memory is.
  Measured: the refusal's code and the ring it names.
- **E2 · The set-reset latch.** A pulse on `s` at 300 ps. `qn` falls at 350 ps
  and `q` rises at 400 ps, two NOR delays after the pulse, and both hold after
  the pulse ends. Measured: both events, and the state after the pulse.
- **E3 · The D latch is transparent.** A gate signal, and `q` following `d` while
  the gate is high and holding while it is low. Five gates. Measured: the
  following, the holding, and the gate count.
- **E4 · The flip-flop is two latches.** Eleven gates, master on the low phase
  and slave on the high. `q` moves 100 ps after the clock edge, once per edge,
  whatever `d` did in between. Measured: the event count per edge, and the
  100 ps.
- **E5 · Setup and hold, as one window.** The flip-flop primitive, with its
  clock edge at 500 ps and the D step swept past it. Every step from 461 ps to
  519 ps is reported as a violation, which is 59 of the 60 picoseconds of
  `t_su + t_h`. Measured: the
  window's two edges, and its width against the sum.
- **E6 · A violated setup time is not a value.** One run inside the window. The
  report gives the kind, the slack and the flip-flop, and the panel says the
  sampled value is the model's assumption. Group H is where the rest of that
  sentence goes. Measured: the violation record, and its slack.

### Group F: Registers, counters and the machine (7)

- **F1 · The register.** Four flip-flops on one clock, each fed from the one
  before, which is `shiftRegister(4)`. Everything moves together, 80 ps after
  the edge, and nothing between them can race. A register fed from primary
  inputs has no path from one flip-flop to another, and `fMax` declines it by
  name rather than timing a path that is not there. Measured: the four
  arrivals, and `t_min` of 120 ps with no logic between.
- **F2 · The counter counts.** Four bits, 6 gates, 4 flip-flops. Bit 0 toggles
  every clock, and bit i toggles when every bit below it is 1. Measured: all
  sixteen counts in order, and the wrap.
- **F3 · The enable chain is the carry chain.** The counter's longest path is
  `q0` through two ANDs to `d3`, at 230 ps of logic. It grows 70 ps a bit:
  210 ps at two bits, 350 ps at four, 630 ps at eight. Measured: `t_min` at three
  widths, and the slope.
- **F4 · A specification is a state table.** The 101 detector written as states
  and a next-state rule. Three states, one input, six rows, and the table is
  Mealy because its output reads the input. Measured: the row count, the type,
  and the state count.
- **F5 · Encoding, and the codes left over.** Three states in two bits leaves one
  code unused, and that row is free to take whatever value makes the logic
  smaller. Measured: the bit count, and the one unused code.
- **F6 · The equations, minimised.** `d1 = q0·x'`, `d0 = x`, `y = q1·x`. Two
  literals, one literal and two literals. Measured: the three expressions, and
  the literal counts.
- **F7 · The machine, built and run.** Six gates and two flip-flops, and the
  built machine raises `y` on the fourth bit and the seventh of `01011010`.
  `t_min` is 230 ps. Measured: the output on all eight clocks, the gate count,
  and `t_min`.

### Group G: The clock (5)

- **G1 · The critical path sets the period.** The 4-bit adder between registers.
  `t_min = 80 + 650 + 40 = 770 ps`, so `f_max = 1.2987 GHz`. The path list names
  every gate on it. Measured: the three terms, the sum, and `f_max`.
- **G2 · Width costs frequency.** The adder's width on a knob. `t_min` is 770 ps
  at four bits, 1330 ps at eight, 2450 ps at sixteen and 4690 ps at thirty-two,
  so `f_max` falls from 1.2987 GHz to 213.2 MHz. Measured: `t_min` at the four
  widths.
- **G3 · Pipelining buys frequency, not latency.** Two bits between registers
  instead of four. `t_min` falls to 490 ps and `f_max` rises to 2.0408 GHz, a
  factor of 1.571, and the answer now takes two clocks. Measured: both periods,
  the ratio, and the two-clock latency.
- **G4 · Skew, and the two directions it moves.** A wire between the launching
  and capturing clocks. At 50 ps of skew `t_min` falls to 720 ps and the hold
  slack falls from 200 ps to 150 ps, one picosecond for one. At 201 ps the hold
  check fails. Measured: both numbers at three skews, and the skew that fails.
- **G5 · A hold failure is not fixed by slowing down.** The same design at two
  periods with the same hold slack, and the setup slack changing between them.
  The hold inequality has no T in it. Measured: the hold slack at both periods,
  and the setup slack at both.

### Group H: Metastability (3)

- **H1 · The model, and its three assumptions.** The rate law with its
  parameters printed. The mean time between failures rises by a factor of e for
  every 20 ps of settling time. At 200 ps it is 1.10 s, at 400 ps it is 24 260 s,
  and at 600 ps it is 16.93 years. Measured: the three values, and the ratio
  between consecutive ones.
- **H2 · The synchroniser.** One flip-flop leaves no settling time at all. A
  second gives it a whole clock period less the setup and clock-to-Q times. At a
  1000 ps period that is 880 ps, and the mean time goes from 124 ns to
  2.036 × 10⁷ years. Measured: both settling times, and both mean times.
- **H3 · Designing to a target.** A mean time of 1000 years at 1 GHz and 1 MHz
  asks for 681.6 ps of settling. The panel names what the answer rests on, and
  the note says `τ` comes from a latch this suite has not built. Measured: the
  settling time, and that it reproduces the target.

---

## 6. Hand-overs

- **→ VLSI Lab.** The gate library as data. That lab replaces each delay with one
  extracted from a transistor circuit and reruns every netlist here. The
  netlists and their names do not change.
- **→ Computer Lab.** `fsmNet` and the state machine diagram. The instruction
  decoder is F4's machine with more states.
- **→ Interfaces Lab.** The timing diagram with its bus rows and spans, and the
  flip-flop's setup and hold times as a pin's.
- **→ Fields Lab.** The event queue, for the lossless transmission line's bounce
  diagram (`EE_LABS_MAP.md` §3).
- **← Electronics Lab.** D6's CMOS inverter, when it is built, becomes A1's
  opening sentence and the source of the noise margins (Decision 7). Deferred in
  `BACKLOG.md`.
- **← Analog IC Lab.** `τ` and `T0` from a measured latch, replacing Group H's
  parameters. Deferred.
- **↔ Power Lab.** The event idea, generalised. `packages/switched` keeps its own
  copy, because its events carry a state vector and these do not (§2.1).

---

## 7. Testing discipline

- **Unit** (`packages/events`): the queue's batching and removal. Each source's
  transitions. Each gate kind's table at its own delay. Both delay models on the
  same pulse. Every refusal message, at both sides of its threshold. The
  minimiser against hand-worked functions. The rate model's law and its inverse.
- **Invariants** (§2.12), fuzzed over sixty random netlists and the library ones.
- **Experiments**: every number in §5 pinned in `experiments.test.js`, computed
  from the knobs. Among them 30 ps, 150 ps, 180 ps, 650 ps, 770 ps, 1.2987 GHz,
  59 ps, 350 ps, 230 ps, 2.0408 GHz and 16.93 years.
- **The map's promises**: a test walks every `why` and requires each experiment
  it names to exist in the named lab. A reference to Electronics D6 fails the
  suite while D6 is not built, which is Decision 7's enforcement.
- **Prose**: `prose.test.js` over every `see`, `try`, `why`, term and chrome
  string. `npm run lint:prose` over this plan and the brief.
- **Playwright harness** (`scripts/verify.mjs`): the timing diagram redraws when
  a delay knob moves. The critical path highlight follows the netlist. The
  Karnaugh map's loops follow the cover. No horizontal scroll at 390 px.
- **REVIEW_PLAYBOOK audit** before release, all eleven classes, with a screenshot
  pass at 390 px and at 1280 × 900.

---

## 8. Integration and the dark launch

The mechanism Power Lab and the Elements lab share, unchanged.

- Deployed **dark** at `/logic-lab/` from the first vertical slice. Unlisted, not
  secret.
- `apps/logic-lab/RELEASE_STATUS` reads `dark`. A test asserts that while it
  does, the splash, the root README and the other labs' nav contain no reference
  to the Logic Lab. Flip the word to `released` and the same test demands the
  splash card, the README row and the nav entry.
- `NEEDS.md` carries the one `cp` line for `deploy.yml` and the ids and counts
  for `progression.test.js`. The director applies both at integration.
- The flip is **Reed's action**, after the release gate in §9.

---

## 9. Phasing

Each phase ships green and deployable dark.

1. **The engine.** `packages/events` in full, with §2.12 fuzzed green before any
   UI exists. Exit: the four invariants green, and every refusal tested.
   **Shipped.**
2. **The app shell and the combinational half.** The gate diagram, the timing
   diagram, the truth table and the Karnaugh map. **Groups A, B, C** (18). Exit:
   every A to C number pinned, the release test passes dark, and the harness is
   written.
3. **Timing.** The events pane and the path list. **Group D** (6). Exit: the
   hazard's 30 ps and both delay models pinned.
4. **Sequential.** The waveform's clock rows, and the violation marks. **Groups
   E, F** (13). Exit: the state machine diagram drawn, and F7's built machine
   running.
5. **The clock and the rate.** **Groups G, H** (8). Exit: `f_max` at four widths
   pinned, and Group H's model printing its assumptions.
6. **The release gate**, in order, each blocking the next. The full audit. The
   student sittings. Reed's own pass against the dark deployment. Then the flip.

**What this sitting shipped**: phases 1 to 3, which is the engine and the
combinational half with its timing. That is 24 of the 45 experiments, in groups A
to D. Groups E to H are specified above and are not built. `BACKLOG.md` carries
them with the phase named.

---

## 10. Non-goals (v1, stated so they are decisions rather than omissions)

- **A hardware description language** (Decision 6).
- **Synthesis from an expression to a netlist beyond two levels.** The minimiser
  is exact and two-level. Multi-level synthesis is an optimisation problem, and
  the lab teaches the objective rather than the algorithm.
- **A rise time, a voltage, or a noise margin** (§2.10, Decision 7).
- **Power.** Dynamic power is `CV²f` and it needs a capacitance, which needs a
  transistor. The VLSI Lab is its home.
- **Tri-state, and a third logic value.** A net has two values here. A driver
  that has let go of a net is not one of them, so a bus modelled as high, low
  and released is the Interfaces Lab's to add. What this engine does build is
  the resolved net of §2.2a: several drivers on one net, combining by a rule
  the net names. That much the three track D plans asked for, and it ships.
- **Asynchronous sequential design past the latch.** Group E builds the latch and
  Group D shows why a synchronous design tolerates a glitch. A full treatment of
  flow tables and races is a graduate course.
- **Memory arrays.** The SRAM cell's static noise margin is a transfer
  characteristic, and the VLSI Lab holds it.
- **Arithmetic past the ripple adder.** Carry-lookahead, carry-select and the
  multiplier are the Computer Lab's datapath.
- **A free-form schematic editor.** Curated netlists with editable values, as
  every other lab.

---

## 11. Risks, named

- **The lab reads as easy.** Every number here is an integer sum, and a reader
  who has met the analog labs may take that for a toy. Mitigation: Groups D, G
  and H are where the subject is hard, and the phasing puts D in the first
  release. The splash line names the glitch and the clock, not the gates.
- **The two new canvases have no second lab yet.** Their props are designed for
  labs nobody has started. Mitigation: §4.2 lists which prop each future lab
  needs and why, and `NEEDS.md` asks the director to promote them rather than
  copy them. If the props are wrong, they are wrong inside one app.
- **Metastability without a measured `τ`** (Decision 4). Mitigation: the model
  prints its parameters and its three assumptions, and every number in Group H is
  a function of them.
- **The picosecond grid** (Decision 2). A delay of 30.5 ps cannot be written.
  Mitigation: the refusal names the rule, and the grid is thirty times finer than
  the fastest cell.
- **The state machine builder is a small synthesis tool.** It enumerates,
  encodes, minimises and builds, and each step can be wrong in a way the next
  hides. Mitigation: the built machine is simulated against the specification it
  came from, which is a test that no intermediate step can pass by accident.
- **Numbers that are right for one library.** Every quoted number is for the
  defaults in §3. Mitigation: each pin is a function of the library and is
  re-derived in the test rather than typed in.
- **Cost.** A new package and two new canvases. Mitigation: the engine has no
  numerical analysis in it at all, which is why `EE_LABS_MAP.md` calls it the
  simplest engine in the map, and phase 1 is done.
