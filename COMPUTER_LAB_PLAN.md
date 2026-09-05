# Computer Lab: the plan

A lab for **computer organisation**, the course that follows digital logic. It
starts where the Logic Lab stops, at a finite state machine built from gates and
flip-flops, and it builds a processor out of them. Every wire in the datapath is
lit, every stage of the pipeline is a picture, and every hit rate comes from a trace
the reader can read. Splash glyph `▤`, directory `apps/computer-lab`, engine as the
Logic Lab's `events` package driving a curated datapath, plus one new model.

The path, in order. The adder, because arithmetic is where the delay is. The
register file and the memory block. The single-cycle machine, one instruction a
clock. Control, which is the Logic Lab's state machine doing a job. Pipelining, and
the three kinds of hazard. The memory hierarchy, from a trace. The bus and the
interrupt, which are how the machine meets the world.

This is a draft (2026-09-05) for Reed to settle. Its dependency, the Logic Lab and
its `events` package, is being built in parallel. Section 0 lists what needs a
decision, and §2.3 states the `events` API this plan assumes as a contract to
reconcile against the Logic Lab's brief when that brief exists.

The two rules that govern the other labs govern this one with no exemption. Every
explanatory sentence is a claim about physics, and a test must measure it. And
`CORE_SCOPE.md` decides what the engine may state exactly, what it may approximate
behind a guard, and what it declines with a reason. This lab is the easiest case in
the whole map. Every object in it is a finite state machine, and a hit rate from a
given trace is a count. There is nothing here to approximate, and §2.7 says so
without hedging it.

---

## 0. Open decisions

### Decision 1: the name (recommended: Computer Lab)

`EE_LABS_MAP.md` §2 track D calls it the Computer Lab. The course it mirrors is
called computer organisation, computer architecture, or digital design and computer
architecture, depending on the catalogue. LabNav short form **"Computer"**. The
splash card names the path in one line, "the adder, the datapath, the pipeline, the
cache".

Alternatives considered. *Architecture Lab* reads as a lab about buildings to a
reader arriving from the splash page. *Processor Lab* names the artefact and not the
memory hierarchy, which is a third of the lab.

### Decision 2: which instruction set

Recommended: **a 32-bit register-to-register set of twelve instructions**, named in
§3. Its encoding and register conventions are the textbook subset's, as Patterson and
Hennessy define it. It is the smallest set that needs every wire in the five-stage
datapath. It is also the set every reader of that book already knows.

Alternatives considered. A full instruction set adds encodings and no experiment.
An invented set costs the reader every cross-reference to a textbook. Naming a
commercial set brings its licence and its errata into a teaching lab.

### Decision 3: how the reader supplies a program

Recommended: **curated programs, chosen from a picker, with editable immediate
fields and a settable register file**. No assembler, no text editor. The lab has
fourteen programs, each written for one experiment, and each shown as instructions
with their fields decoded beside them. This matches every other lab in the suite,
where the circuit is curated and the values are the knobs.

`EE_LABS_MAP.md` §5 declines toolchains for the whole of track D, and this decision
is that refusal applied here.

### Decision 4: where the cache model lives

Recommended: **`packages/events/src/cache.js`**, a trace-driven model with no
timing in it, owned by this lab's overseer. The alternative is a new package, which
would hold one file. The cache model is a counting machine over an address list, and
it shares the events package's discipline of exact integers rather than its event
queue.

The Logic Lab owns `packages/events` under `PROGRAM.md` §5. This lab's `NEEDS.md`
carries the request, and the director resolves it once.

### Decision 5: gate delays, quoted or extracted

Recommended: **quoted from the VLSI Lab's model card**, with the VLSI Lab's own
`extractGate` as the source when that lab is built. Until then the six numbers in
§4.3 are stated as this lab's model card and pinned as functions of the two unit
values. Both labs then quote the same 37.65 ps NAND2 delay, and a test compares them
when both exist.

---

## 1. The progression map

This lab leans on two labs, one of which is being built and one of which is planned.
This section lists every idea it uses, where the suite teaches it, and the status of
that teaching. Nothing is closed silently.

| Idea the lab leans on | Needed by | Taught at | Status |
| --- | --- | --- | --- |
| Boolean algebra, the truth table, minimisation | A, D1 | Logic Lab, gates group | being built |
| The gate with a propagation delay | A, B, C | Logic Lab, gates group | being built |
| The multiplexer and the decoder | A3, B1, C | Logic Lab, combinational group | being built |
| The adder and its carry | A1, A2 | Logic Lab, adder group | being built |
| The flip-flop, setup and hold | B, C, E | Logic Lab, sequential group | being built |
| The finite state machine from a specification | D2 | Logic Lab, state machine group | being built |
| The state machine diagram as a canvas | D2 | Logic Lab | being built |
| The timing diagram as a canvas | C, E | Logic Lab, timing group | being built |
| The critical path and the maximum frequency | C4, E2 | Logic Lab, clock group | being built |
| Where a gate delay comes from | A, B, §4.3 | VLSI Lab A3, C3 | planned, `VLSI_LAB_PLAN.md` |
| The SRAM cell behind a register file | B2, F1 | VLSI Lab G1, G2 | planned, VLSI G |
| The DRAM cell behind main memory | F5 | VLSI Lab G4 | planned, VLSI G4 |
| The transistor as a switch, and the CMOS inverter | none directly | Electronics D5, D6 | planned, Electronics D |
| Instruction encoding and the register conventions | C1 | nowhere | **gap, C1** |
| The datapath as one picture | C | nowhere | **gap, Group C** |
| Pipelining and its hazards | E | nowhere | **gap, Group E** |
| The cache, and a hit rate from a trace | F | nowhere | **gap, Group F** |
| Virtual memory and the translation buffer | F6 | nowhere | **gap, F6** |
| Amdahl's law | G3 | nowhere | **gap, G3** |

Three things the map shows, so that they are decisions and not omissions. **The
whole lab waits on the Logic Lab's `events` package**, unlike the VLSI Lab, which
has a transistor-level half that ships without it. Section 9 phases the cache model
first for that reason, because it is the one group that needs no event queue.
**The VLSI Lab is planned and not built**, so §4.3's gate delays are stated here and
cross-referenced by id, and the progression test fails until VLSI A3 exists.
**Nothing above the physical machine is in scope**, so operating systems, compilers
and multiprocessors are named in §10 rather than deferred.

The order of the groups follows the map. Nothing in a group leans on an experiment
later in this lab. Group F can be sat first, and §9 ships it first.

---

## 2. The engine: events over a datapath, and counting over a trace

### 2.1 What exists, and what is missing

Nothing this lab needs exists today. The Logic Lab's `events` package is being
built, and it will carry the event queue, the gate models and the flip-flop.
`packages/network` is irrelevant here, because no experiment in this lab has a
continuous voltage in it. That is the sense in which this lab is the simplest in
track D.

Two things are missing beyond the Logic Lab's package. There is no datapath model,
which is a curated design plus the register and memory state that events alone do
not hold. And there is no cache model.

### 2.2 The datapath, as a design plus state

A datapath is an `events` design with three additions. A register file, which is 32
words that a write port sets on a clock edge and two read ports read
combinationally. A memory, which is a word array with a stated access delay. And an
instruction decoder, which is combinational logic the Logic Lab's gates already
express.

```js
// packages/events/src/datapath.js
/**
 * @param design   an events design, plus:
 *                 regs:  { count, width, readPorts, writePorts, tRead, tWrite }
 *                 mems:  [{ id, words, width, tAccess, init }]
 * @param program  [{ op, rd, rs, rt, imm }]        Decision 2's twelve opcodes
 * @param opts     { cycles, stages: 1 | 5, forwarding, predict }
 * @returns {{ trace: [{ cycle, pc, stage, instr, wires, stalls }],
 *             regs: Int32Array, mem: Int32Array,
 *             addresses: [{ cycle, kind: 'i' | 'd', addr }],
 *             cpi, cycles, retired }}
 */
export function runDatapath(design, program, opts)
```

`wires` is the value on every named wire in that cycle, which is what the datapath
view draws. `addresses` is the address trace, and it is the input to §2.4's cache
model. Nothing in the return is sampled or estimated. Every field is a count or a
value the event simulator produced.

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
 * @param stim    [{ t, net, value }]
 * @param opts    { until, glitches: true }
 * @returns {{ events, at: (t) => Record<net, 0|1>, waveform, violations }}
 */
export function simulate(design, stim, opts)

// packages/events/src/path.js
/** Longest combinational path between two sequential elements, and its delay. */
export function criticalPath(design) // -> { path: string[], delay, from, to }
```

Three properties this lab needs, and each is an invariant in §2.8. `criticalPath`
returns the path and not only its length, because C4 draws it on the datapath.
`violations` reports setup and hold failures rather than propagating a third value,
because E2 measures the margin. And event times are exact rationals, so a
five-stage run's cycle count is an integer and not a rounding.

### 2.4 The cache, as a count

```js
// packages/events/src/cache.js
/**
 * @param trace  [{ addr, kind }] or a plain address array
 * @param cfg    { bytes, blockBytes, ways, policy: 'lru' | 'fifo' | 'random',
 *                 write: 'through' | 'back', allocate: boolean }
 * @returns {{ hits, misses, rate,
 *             compulsory, capacity, conflict,
 *             evictions, writebacks,
 *             perAccess: [{ addr, set, tag, hit, evicted }] }}
 */
export function cacheRun(trace, cfg)
```

The three kinds of miss are counted rather than estimated. A compulsory miss is the
first reference to a block. A capacity miss is a miss that a fully associative cache
of the same size would also take. A conflict miss is the rest. The model runs the
fully associative cache alongside the real one to get the second number, which is
the definition rather than a rule of thumb.

`policy: 'random'` takes a seed and is the only place in the lab where a number
depends on one. Its note says so, and its test pins the count at the stated seed.

### 2.5 The pipeline, as a schedule

The five-stage machine is not simulated by a second engine. It is the same events
design with four sets of pipeline registers, and the hazard logic is gates. What the
lab adds is the schedule view's data, which is one row per instruction and one
column per cycle, filled from `trace`. A stall is a repeated stage in that grid and
a flush is a removed row. Both are read from the trace and neither is drawn from a
formula.

The formula appears beside the picture. Cycles per instruction from a stated mix and
stated hazard rates is arithmetic, and the lab prints both the arithmetic and the
count from the run. They agree when the program's mix matches the stated mix, and
E6's lesson is what happens when it does not.

### 2.6 Measures

Cycle count, retired instruction count, and cycles per instruction, each a count.
Clock period from the critical path, and frequency from it. Stage delay per stage,
and the register overhead as a share of the period. Stall cycles by cause, which are
load-use, branch and structural. Hit rate, miss rate, and the three kinds of miss.
Average memory access time in cycles. Misprediction rate on a stated branch pattern.
Speed-up against a stated baseline, and Amdahl's bound on it. Interrupt latency in
cycles and in nanoseconds. Bus occupancy for a stated transfer.

### 2.7 Scope, stated plainly

Every object in this lab is exactly representable, and none of them is hedged.

- **The datapath and the pipeline** are finite state machines over integers. Their
  cycle counts are exact.
- **The hit rate from a trace** is a count over that trace. It is exact for that
  trace and it is not a prediction about any other program. The note says which
  trace it came from, every time.
- **The gate delays** are exact under the VLSI Lab's piecewise-linear model. That is
  that lab's `CORE_SCOPE.md` position, and it is inherited here without change.
- **The clock period** is a sum of exact delays, so it is exact.
- **Cycles per instruction from a stated mix** is arithmetic over stated rates. It
  is exact arithmetic, and it is a model of a program rather than a measurement of
  one. Both numbers are on screen together, which is the guard.
- **Nothing is declined**, and no view in this lab carries a warning threshold. The
  boundary is at the edge of the lab rather than inside it, and §10 draws it.

### 2.8 Invariants, the fuzzer's checklist

Across random programs from Decision 2's twelve opcodes, random register contents,
random cache configurations and random traces:

1. **The pipeline computes what the single-cycle machine computes.** For every
   generated program, the final register file and memory of the five-stage run equal
   the single-cycle run's, to the integer.
2. **Forwarding changes the time and not the answer.** The same program with
   forwarding off and on gives identical final state and a different cycle count.
3. **Stalls are accounted.** Cycles equals retired instructions plus stall cycles
   plus flush cycles plus the fill of the pipeline, exactly.
4. **The critical path is a path.** `criticalPath` returns an edge sequence that
   exists in the design, and no other path in the design is longer.
5. **The clock period holds.** In every run at the reported period, `violations` is
   empty. At one picosecond less, at least one setup violation appears.
6. **Hits and misses close.** Hits plus misses equals the trace length, for every
   configuration and every trace.
7. **Associativity does not hurt.** For the same trace and the same total size, a
   fully associative cache with least-recently-used replacement takes no more misses
   than a direct-mapped one. A counter-example fails the suite.
8. **The three kinds of miss sum.** Compulsory plus capacity plus conflict equals
   the miss count, and compulsory equals the number of distinct blocks touched.
9. **A bigger cache does not miss more**, at the same block size and associativity,
   under least-recently-used replacement. Belady's anomaly appears under
   first-in-first-out, and the test asserts it appears there and not under the
   default policy.
10. **Cross-lab.** The gate delays equal the VLSI Lab's `extractGate` output for the
    same cells. The control unit's state machine, drawn on the Logic Lab's canvas,
    has the transitions the Logic Lab's own simulator gives it.

---

## 3. Models: the machine

### 3.1 The instruction set (Decision 2)

Twelve opcodes, 32-bit words, 32 registers of 32 bits, register 0 reading zero.

| Class | Instructions | What it exercises |
| --- | --- | --- |
| Arithmetic and logic | `add`, `sub`, `and`, `or`, `slt` | the register file, the ALU, the write-back mux |
| Immediate | `addi`, `andi` | the sign extender and the second ALU mux |
| Memory | `lw`, `sw` | the data memory, the address adder, the load-use hazard |
| Control | `beq`, `bne`, `j` | the branch comparator, the PC mux, the control hazard |

### 3.2 The blocks

| Block | Contents | What it teaches |
| --- | --- | --- |
| `adder32.rc` | 32 full adders in a ripple | the carry as the critical path |
| `adder32.cla` | 8 blocks of 4 with a second lookahead level | 8 gate delays against 64 |
| `alu32` | the two adders, the logic units, and a function mux | the mux as the cost of generality |
| `regfile32` | a 5-to-32 decoder, 1024 cells, two read muxes | the register file as a memory |
| `mem1k` | 256 words with a stated access delay | the memory as a timed block |
| `dp.single` | one-cycle datapath, every wire named | Group C |
| `dp.multi` | the multicycle datapath with its control state machine | Group D |
| `dp.pipe5` | five stages, pipeline registers, hazard unit, forwarding unit | Group E |
| `cache.dm`, `cache.2w`, `cache.fa` | three configurations of one model | Group F |
| `bus32` | address phase, data phase, burst mode | Group G |

### 3.3 The programs (Decision 3)

Fourteen curated programs, each written for one experiment. Among them a
three-instruction dependence chain for E3 and a load followed by its use for E4. A
loop of four iterations serves E6 and the predictors. An array sum over eight words
serves F2, a two-array loop that thrashes a direct-mapped cache serves F3, and a
sequential walk over sixty-four words serves F4. Each program is shown as
instructions with their fields decoded, and each has a settable immediate.

---

## 4. The app

### 4.1 Layout

The Elements lab's shape, unchanged. Sidebar with LabNav, report link, experiment
groups, program picker, register and immediate NumFields with chips, model and
toggle switches, and the math panel. Main area with topbar meters, the datapath
always visible, and one pane below with a pane selector. Phone width first, no
horizontal scroll at 390 px, harness checked.

The topbar shows the cycle count and the cycles per instruction first. Then come the
experiment's headline numbers (period, frequency, stalls, hit rate, speed-up) and the
configuration in use.

### 4.2 Views

- **The datapath, with every wire lit.** New to this lab, and the lab's centre. Every
  wire carries its value at the current cycle, in colour by activity, and a wire
  that carries no meaningful value this cycle is drawn grey. The control signals are
  drawn as their own layer. Clicking a wire pins its value into the topbar. This
  canvas is built here and no second lab claims it, so it lives in the app rather
  than in `packages/ui`, per `PROGRAM.md` §4.
- **The timing diagram.** The Logic Lab's canvas, first built there, reused
  unchanged for gate-level runs inside a block. Group A uses it for the carry
  arriving 64 gate delays late.
- **The state machine diagram.** The Logic Lab's canvas, first built there, reused
  here for the multicycle control unit. `PROGRAM.md` §4 names the Computer Lab as its
  second lab, and D2 is the experiment that claims it.
- **The pipeline schedule.** One row per instruction, one column per cycle, each cell
  naming the stage. Stalls are repeated cells and flushes are struck through. New to
  this lab.
- **The cache map.** Sets down the page, ways across, each line showing its tag,
  its valid bit and its age. The current reference is highlighted, and a miss shows
  what it evicted. New to this lab.
- **The trace.** The address list with hit or miss beside each entry, scrollable,
  with the running hit rate. This is where a hit rate stops being a claim.
- **Program and registers.** The instructions with decoded fields, the program
  counter marked, and the register file with the changed register highlighted.
- **Budget.** The clock period broken into its parts, stage by stage, with the
  register overhead as its own bar.

### 4.3 Numbers

Every number below is computed by the plan's script from the gate delays and the
block composition. Every one becomes a pinned test.

- **The two gate delays** (Decision 5, from the VLSI Lab's model card). A NAND2
  driving one NAND2 input takes **37.65 ps**. An inverter driving one inverter takes
  22.59 ps. A fanout-4 inverter takes 56.47 ps. A flip-flop has
  `t_pcq = 52.73 ps`, `t_setup = 30.13 ps` and `t_hold = 22.60 ps`.
- **The adders.** A 32-bit ripple carry is 64 gate delays, which is 2409 ps. A
  two-level lookahead is 8 gate delays, which is 301.2 ps, a factor of 8.00. A
  4-bit lookahead block is 4 gate delays, 150.6 ps. Carry select over 8-bit blocks is
  13 gate delays, 489.4 ps.
- **The blocks.** Instruction and data memory 12 gate delays, 451.8 ps. Register file
  read 8, 301.2 ps. Register file write 4, 150.6 ps. The lookahead ALU 8, 301.2 ps. A
  two-input multiplexer 2, 75.29 ps. Control decode 3, 112.9 ps. Sign extension 1,
  37.65 ps.
- **The single-cycle machine.** A load's path is 1739 ps, so the machine runs at
  574.9 MHz. An arithmetic instruction needs 1288 ps and a branch needs 1212 ps, so
  26.0 % of every cycle is wasted on an arithmetic instruction.
- **The pipeline.** Stage periods are 534.6 ps for fetch, 384.0 ps for decode,
  459.3 ps for execute, 534.6 ps for memory and 308.7 ps for write-back. The clock
  period is **534.6 ps**, so 1870 MHz. The register overhead is 82.86 ps, which is
  15.5 % of the period. One instruction now takes 2673 ps, 1.54 times the
  single-cycle latency, and throughput rises by 3.25.
- **The trace** (Group F). Eight words of an array at address 0, then one scalar at
  address 256, four times over. Thirty-six references to nine distinct addresses.
- **The cache.** A 64-byte cache with 16-byte blocks gives 75.00 % hits direct
  mapped, and **91.67 %** two-way or fully associative. The direct-mapped run takes 3
  compulsory misses and 6 conflict misses. At 4-byte blocks the hit rate falls to
  58.33 %, and at 32-byte blocks it reaches 77.78 %. On a sixty-four word sequential
  walk, 4-byte blocks give 0.00 % and 32-byte blocks give 87.50 %.
- **Average memory access time.** At a 100-cycle penalty, direct mapped costs 26.00
  cycles and two-way costs 9.53 cycles including a 0.2-cycle hit penalty. A second
  level at 10 cycles with a 20 % local miss rate brings a 25 % first-level miss rate
  down to 8.50 cycles.
- **Cycles per instruction.** The mix is 45 % arithmetic, 25 % load, 10 % store,
  15 % branch and 5 % jump. With forwarding and branches resolved in execute, the
  count is **1.330**. Resolving in decode gives 1.240, and a 90 % predictor gives
  1.180. Without forwarding it is 1.980, so forwarding is worth 32.8 %.
- **Branch prediction** on a four-iteration loop repeated ten times, forty branches.
  Always-taken mispredicts 10, one-bit mispredicts 19, a two-bit saturating counter
  mispredicts 10, and a three-bit correlating predictor mispredicts 1. On an
  eight-iteration loop the correlating predictor mispredicts 19 and the two-bit
  counter still mispredicts 10.
- **Pages.** 4 KB pages and 32-bit addresses give a 20-bit page number, so a
  one-level table of 4-byte entries is 4.00 MB a process. A 64-entry translation
  buffer reaches 256 KB. At a 1 % miss rate and a 40-cycle walk, translation costs
  1.400 cycles.
- **The world.** A pipeline flush plus sixteen register saves plus a two-cycle
  vector fetch is 23 cycles, which is 12.30 ns. A 16-byte line takes 4.277 ns without
  a burst and 2.673 ns with one, a saving of 37.5 %.

---

## 5. Curriculum: 30 experiments in 7 groups

Format, as the other plans. **The claim** the note makes, what the reader turns, and
what is **measured** against what **formula**. Every quoted number becomes a pinned
test computed from the model card, never a constant. Each experiment ships with
`see`, `try` and `why` in the three registers, within the `STYLE.md` budgets.

### Group A: Arithmetic, where the delay is (4)

- **A1 · The carry is the critical path.** A 32-bit ripple-carry adder. The sum bits
  settle early and the top carry arrives after 64 gate delays, which is 2409 ps. The
  timing diagram shows the carry walking. Measured: the delay against 2 gate delays a
  bit, and the settling time of bit 0 against bit 31.
- **A2 · Look ahead, and pay in gates.** Generate and propagate for each bit, then
  two levels of block lookahead. The top carry now arrives in 8 gate delays, 301.2 ps,
  a factor of 8.00. The gate count rises by about five. Measured: the delay, the
  factor, and the gate count of both adders.
- **A3 · The ALU is a multiplexer over functions.** Add, subtract, and, or, and
  set-on-less-than share one adder and one output mux. The mux costs 2 gate delays,
  75.29 ps, on every operation. Measured: the ALU delay against the adder's plus the
  mux's, and the subtract path using the same adder with an inverted operand.
- **A4 · Multiplication is a loop.** Shift and add, 32 iterations, one addition a
  cycle. The product takes 32 cycles at 534.6 ps, which is 17.11 ns. A single-cycle
  array multiplier would need 32 adders. Measured: the cycle count, the total time,
  and the adder count of both.

### Group B: The register file and the memory block (3)

- **B1 · A decoder turns five bits into one hot wire.** Two levels of three-input
  gates, 5 gate delays. One of 32 word lines rises. Measured: the delay, and exactly
  one word line high for each of the 32 addresses.
- **B2 · Two reads and one write, at once.** 1024 cells, two read ports and one
  write port. Reading takes 8 gate delays, 301.2 ps, and writing takes 4, 150.6 ps.
  Reading and writing the same register in one cycle returns the old value, unless
  the write-back stage forwards. Measured: both delays, and the read value in the
  conflict case with forwarding off and on.
- **B3 · Memory is a block with a delay.** 256 words with a 12 gate delay access,
  451.8 ps. It is the slowest block in the machine, and it appears twice in the
  datapath. Measured: the access delay, and its share of the single-cycle period,
  which is 52.0 % across the two appearances.

### Group C: One instruction, one clock (5)

- **C1 · An instruction is a set of fields.** Thirty-two bits carrying an opcode,
  three register numbers and an immediate. The decoded fields drive the register
  file's addresses and the control unit's input. Measured: the field extraction for
  all twelve opcodes, against the encoding table.
- **C2 · Fetch, and the program counter.** The counter feeds the instruction memory
  and an adder that makes the next address. Both happen in the same cycle. Measured:
  the fetch path's delay, 451.8 ps, and the counter advancing by four each cycle.
- **C3 · An arithmetic instruction, wire by wire.** Every wire in the datapath is
  lit and carries a value. Nine of them matter for this instruction and the rest are
  grey. The path is 1288 ps. Measured: the value on every named wire against a hand
  trace, and the path delay.
- **C4 · The load sets the clock.** A load reads memory after the ALU has made the
  address, so its path is 1739 ps and the machine runs at 574.9 MHz. Every other
  instruction finishes earlier and waits. Measured: the four instruction paths, and
  the 26.0 % waste on an arithmetic instruction.
- **C5 · A branch is a comparison and a multiplexer.** Subtract, test for zero,
  select between the incremented counter and the branch target. The path is 1212 ps.
  Measured: the branch path, and the target address against the sign-extended offset
  shifted by two.

### Group D: Control (3)

- **D1 · Control is a truth table.** Nine control signals from a six-bit opcode. The
  table has twelve rows, and the logic that implements it is 3 gate delays, 112.9 ps.
  Measured: every signal for every opcode, against the table.
- **D2 · The multicycle machine is a state machine.** Five states, drawn on the Logic
  Lab's state machine canvas. Each instruction walks the states it needs, so an
  arithmetic instruction takes four cycles and a load takes five. Measured: the state
  sequence per opcode, and the transitions against the Logic Lab's own simulator.
- **D3 · Fewer cycles, or a shorter one.** The multicycle clock is set by the slowest
  block rather than the longest path, so it is 534.6 ps. With four cycles for
  arithmetic and five for a load, the stated mix gives 4.35 cycles an instruction.
  That is 2325 ps, against the single-cycle 1739 ps. Measured: the mean cycle count,
  and both machines' time per instruction.

### Group E: Pipelining (6)

- **E1 · Five stages, five instructions at once.** The same blocks, four sets of
  pipeline registers between them. Throughput rises to one instruction a cycle at
  534.6 ps, a factor of 3.25 over the single-cycle machine. Measured: the throughput,
  and invariant 1, that the final state matches the single-cycle run.
- **E2 · The registers cost, and imbalance costs more.** Each register adds 82.86 ps,
  which is 15.5 % of the period. The five stages need 451.8, 301.2, 376.5, 451.8 and
  225.9 ps of logic, so the slowest sets the clock and the fastest wastes 226 ps.
  Split the logic evenly and the period would be 414.1 ps. Measured: all five stage
  delays, the overhead share, and the even-split period.
- **E3 · Forwarding.** Three dependent instructions in a row. Without forwarding the
  second waits two cycles and the third waits one. With forwarding both proceed, and
  the result comes from the pipeline register rather than the register file. Measured:
  the cycle count both ways, the forwarding multiplexer's select signals, and
  invariant 2.
- **E4 · The stall forwarding cannot remove.** A load followed by its use. The value
  leaves memory one stage after it is needed, so one bubble is unavoidable. At 40 %
  of loads and 25 % loads in the mix, that is 0.1000 cycles an instruction. Measured:
  the single bubble in the schedule, and the contribution to the count.
- **E5 · A taken branch throws work away.** Resolved in execute, a taken branch
  discards two instructions. At 15 % branches and 60 % taken that is 0.1800 cycles.
  Move the comparison into decode and it halves to 0.0900, at the cost of a second
  comparator. Measured: both penalties, and the flushed rows in the schedule.
- **E6 · Guessing, and how well.** A loop of four iterations, forty branches.
  Always-taken mispredicts 10, a one-bit predictor mispredicts 19, a two-bit
  saturating counter mispredicts 10, and a three-bit correlating predictor
  mispredicts 1. On an eight-iteration loop the correlating predictor falls back to
  19. Measured: all four counts on both patterns, and the cycles-per-instruction
  penalty of each.

### Group F: The memory hierarchy (6)

- **F1 · A cache is a lookup on part of the address.** The address splits into a tag,
  an index and an offset. A 64-byte cache with 16-byte blocks uses 2 index bits and 4
  offset bits. Measured: the split for every address in the trace, against the
  configuration.
- **F2 · A hit rate is a count over a trace.** Thirty-six references, nine distinct
  addresses. Direct mapped, the run takes 9 misses and 27 hits, so 75.00 %. Three
  misses are compulsory and six are conflicts. Measured: the counts, and invariant 8,
  that the three kinds sum.
- **F3 · Two ways, and the conflicts go.** The scalar at address 256 and the array at
  address 0 share an index. Two-way associativity puts them in different ways, and
  the hit rate rises to 91.67 % with zero conflict misses. On a two-array thrashing
  trace, direct mapped gives 0.00 % and two-way gives 87.50 %. Measured: both traces,
  both organisations.
- **F4 · Block size buys locality, then costs it.** On the array trace, 4-byte blocks
  give 58.33 %, 8-byte 69.44 %, 16-byte 75.00 % and 32-byte 77.78 %. On a sequential
  walk of sixty-four words the same sweep gives 0.00 %, 50.00 %, 75.00 % and 87.50 %.
  Measured: both sweeps, and the sequential case against `1 − blockBytes⁻¹` in words.
- **F5 · The miss penalty is the whole story.** At a 100-cycle penalty the
  direct-mapped cache costs 26.00 cycles an access and the two-way costs 9.53. Add a
  second level of 10 cycles missing 20 % of the time, and a 25 % first-level miss
  rate costs 8.50 cycles. Measured: all three, against the access-time sum.
- **F6 · Addresses that are not addresses.** 4 KB pages, a 20-bit page number, a
  one-level table of 4.00 MB a process. A 64-entry translation buffer reaches 256 KB.
  At 1 % misses and a 40-cycle walk, translation costs 1.400 cycles. Measured: the
  table size, the reach, and the effective time.

### Group G: The machine and the world (3)

- **G1 · A bus is an address phase and a data phase.** A 16-byte line as four
  separate transfers takes 8 cycles, 4.277 ns. As one burst it takes 5 cycles,
  2.673 ns, a saving of 37.5 %. Measured: both counts, and the bus occupancy over a
  stated miss rate.
- **G2 · An interrupt costs the pipeline.** Five cycles of flush, sixteen register
  saves, two cycles of vector fetch. That is 23 cycles, 12.30 ns. At ten thousand
  interrupts a second it is 0.0123 % of the machine's time. Measured: the cycle
  count, the time, and the share.
- **G3 · Amdahl bounds every improvement.** Make the adder three times faster and
  the machine gains 1.154. Make memory twice as fast and it gains 1.212. Remove every
  branch penalty and it gains 1.156. Measured: all three, against
  `1/((1 − p) + p/s)`, and the limit as the speed-up goes to infinity.

---

## 6. Hand-overs

- **← Logic Lab** (every group). The `events` package, the timing diagram, the state
  machine diagram, the gate models and the flip-flop. The contract in §2.3 is
  reconciled against that lab's brief before Phase 2 starts.
- **→ Logic Lab** (D2). The multicycle control unit is a five-state machine, and it
  is the largest worked example that lab's state machine group could hand forward. If
  the Logic Lab wants it as a closing experiment, it is specified here.
- **← VLSI Lab** (§4.3, A, B). Every gate delay, the flip-flop's three times, and the
  cell behind the register file. Both labs pin the same numbers, and a test compares
  them once both exist.
- **→ VLSI Lab** (A2, B2). The adder and the register file are the two blocks whose
  sizing the VLSI Lab's Group C is worth doing on. The netlists are specified here.
- **→ Interfaces Lab** (G2). The interrupt's cost in cycles is this lab's, and the
  jitter it causes at a sampling instant is that lab's F5. The link is a
  cross-reference by id in both directions.
- **← Electronics Lab**, indirectly. D5's switch and D6's inverter are under every
  gate in this lab, through the VLSI Lab. No experiment here references them
  directly, and §1 records the chain.

---

## 7. Testing discipline

- **Unit** (`packages/events/src/cache.js`): every configuration against a hand-walked
  trace of twelve references. The three kinds of miss against their definitions. The
  replacement policies against hand sequences. Belady's anomaly reproduced under
  first-in-first-out and absent under least-recently-used.
- **Unit** (`packages/events/src/datapath.js`): each of the twelve opcodes executed
  alone, with the whole wire set checked against a hand trace. The register file's
  read-during-write case. The hazard unit's outputs for the sixteen dependence
  patterns.
- **Invariants** (§2.8), fuzzed across ten thousand generated programs of up to forty
  instructions, and across cache sizes from 16 B to 4 kB. Three hostile corners are
  included. They are the branch to the instruction after itself, the load whose value
  is used by three following instructions, and the trace whose stride equals the
  cache size.
- **Experiments**: every number in §5 pinned as a function of the model card, never
  as a constant. Among them 2409 ps, 301.2 ps, 1739 ps, 534.6 ps, 3.25, 75.00 %,
  91.67 %, 1.330, 26.00 cycles and 12.30 ns.
- **The map's promises**: a test walks every `why` and every cross-reference, and
  requires the referenced experiment to exist in the named lab. A reference to VLSI
  A3 fails until VLSI A3 is built, which is the design.
- **Guards**: this lab has none, per §2.7. A test asserts that no view in the app
  renders a warning threshold, so that a future approximation cannot arrive
  unlabelled.
- **Cross-lab pins**: the VLSI Lab's gate delays. The Logic Lab's state machine for
  D2. The Interfaces Lab's interrupt cross-reference.
- **Playwright harness**: the datapath's wires change colour with the cycle slider.
  The pipeline schedule shows a bubble when forwarding is switched off. The cache map
  highlights the evicted line. No horizontal scroll at 390 px.
- **REVIEW_PLAYBOOK audit** before release, all eleven classes, a screenshot pass,
  and the sittings script with three seats. One seat sits Group F first, because it
  is the group that needs no processor.

---

## 8. Integration and the dark launch

The mechanism is the one Power Lab and the Elements lab share, unchanged.

- Deployed **dark** at `/computer-lab/` from the first vertical slice. Unlisted, not
  secret.
- `apps/computer-lab/RELEASE_STATUS` reads `dark`. A test asserts that while it does,
  the splash, the root README and the other labs' LabNav contain no reference to the
  Computer Lab. Flip the word to `released` and the same test demands the splash
  card, the README row and the nav entries, with counts pinned.
- `NEEDS.md` carries four items for the director. One `cp` line in `deploy.yml`. The
  lab's ids and counts in `progression.test.js`. The request for
  `packages/events/src/cache.js` and `datapath.js` under Decision 4. And the two
  Logic Lab canvases promoted to `packages/ui`, since this lab is their second
  claimant under `PROGRAM.md` §4.
- The flip is **Reed's action**, after the release gate in §9.

---

## 9. Phasing

Each phase ships green and deployable dark. The cache comes first, because it is the
one group that needs no event queue and therefore nothing from the Logic Lab.

1. **The cache, alone.** `cacheRun`, the cache map, the trace view. App shell, dark
   deploy and the `RELEASE_STATUS` test. **Group F** (6). Exit: invariants 6 to 9
   fuzzed green, and every F number pinned.
2. **The blocks, on `events`.** The Logic Lab's package arrives and §2.3's contract
   is reconciled. `adder32`, `alu32`, `regfile32`, `mem1k`, the timing diagram
   reused. **Groups A, B** (7). Exit: invariant 4 green, and A1's 2409 ps pinned
   against the gate count.
3. **The single-cycle machine.** `runDatapath` at one stage, the datapath view with
   every wire lit, the program picker. **Group C** (5). Exit: every wire in C3
   checked against a hand trace, and C4's period pinned.
4. **Control.** The multicycle datapath, the state machine canvas reused. **Group D**
   (3). Exit: D2's transitions matching the Logic Lab's simulator, and D3's 4.35
   pinned.
5. **The pipeline.** Five stages, the hazard and forwarding units, the schedule view.
   **Group E** (6). Exit: invariants 1 to 3 fuzzed green over ten thousand programs,
   and E6's four counts pinned.
6. **The world.** The bus model, the interrupt path, Amdahl. **Group G** (3). Exit:
   G1's burst saving and G2's latency pinned.
7. **The release gate**, in order, each blocking the next. The full audit, every
   option, every program, every claim, fuzzing, both browsers. The student sittings.
   Reed's own pass against the dark deployment. Then the flip.

Phase 1 is six experiments and needs nothing from the Logic Lab. If that lab slips,
this one still ships a fifth of itself dark, and the cache group stands alone as a
lesson.

### What the build did, and where the numbers moved

Phases 1 to 6 are built and the lab is dark. All seven groups and all thirty
experiments are on `lab/computer-lab`, so the phases landed in one sitting
rather than six. Phase 7, the release gate, is Reed's.

Five things this section records, because the build measured what §4.3 stated
and the two did not always agree.

- **The time grid is 10 fs rather than one picosecond.** A NAND2 driving one
  NAND2 input is 37.65 ps, which is not a whole picosecond, and the engine's
  times are integers. On a grid of one hundred-trillionth of a second the same
  delay is the integer 3765 and nothing rounds. Everything else in the card is
  a whole multiple of that number or of the inverter's 22.59 ps.
- **The two adders are measured rather than stated.** Group A builds both for
  `@ee-labs/events` and the engine times them. The ripple carry is 64 gate
  delays, the two-level lookahead is 8, a four-bit lookahead block is 4, and
  the factor between the two carries is 8.00. Each of those is §4.3's number.
- **Three numbers in §4.3 are wrong, and the built lab uses its own.** The
  even-split pipeline period is 444.3 ps rather than 414.1, because §4.3
  divided the single-cycle path rather than the sum of the five stage delays.
  The multicycle count is 4.05 cycles an instruction rather than 4.35, from the
  five-state machine D2 walks. And E3's dependence chain costs four stall
  cycles without forwarding rather than three, because the schedule puts the
  second dependent instruction where it puts it.
- **Invariant 7 of §2.8 is false.** A counter-example is pinned in the engine's
  test and `apps/computer-lab/NEEDS.md` §5 states the correction.
- **Carry select is not built.** §4.3 quotes it and no experiment in §5
  measures it, so Group A builds the two adders A1 and A2 need.

One layout decision differs from §4.1. The datapath is not on screen in every
group, because Groups A, B, F and G have no datapath to draw. Each experiment
names its own first pane instead, and the datapath is that pane wherever a
program runs.

---

## 10. Non-goals (v1, stated so they are decisions rather than omissions)

- **HDL, assemblers, compilers and toolchains.** `EE_LABS_MAP.md` §5 declines these
  for the whole of track D, and Decision 3 applies it here. The programs are curated.
- **A full commercial instruction set.** Decision 2. Twelve opcodes exercise every
  wire, and a hundred more add encodings without adding experiments.
- **Out-of-order execution, register renaming, speculation past one branch,
  superscalar issue.** Each needs a scheduler that is a research subject rather than
  a picture, and none of them changes the five-stage lessons.
- **Multiprocessors, coherence protocols and consistency models.** A second course,
  and one whose objects are protocols rather than circuits.
- **Operating systems.** Virtual memory appears in F6 as an address translation and a
  buffer. Scheduling, processes and system calls are not electrical engineering.
- **Floating point.** The format is a standard and the arithmetic is a subject in
  itself. The integer datapath teaches every organisation lesson.
- **Disk, flash and networking.** `EE_LABS_MAP.md` §5 stops the Interfaces Lab at
  the pin, and this lab stops at the bus.
- **Performance counters from real hardware.** Every number here comes from a model
  the lab runs. Nothing is loaded from a machine, which is the suite's rule.
- **Power and energy of the processor.** The VLSI Lab's Group E owns that, and
  repeating it here would be a second model of the same thing.
- **Cache hit rates presented as general facts.** Every rate in this lab names its
  trace. A rate without a trace is not a claim this lab makes.

---

## 11. Risks, named

- **The whole lab waits on the Logic Lab.** Unlike the VLSI Lab, only one group here
  ships without `events`. Mitigation: Phase 1 is that group, the contract in §2.3 is
  written down rather than assumed, and `BACKLOG.md` carries the dependency with the
  branch named.
- **The `events` contract moves.** §2.3 is a guess at a package another overseer is
  writing today. Mitigation: no §5 experiment depends on the names, and the
  reconciliation is a phase boundary rather than a rewrite.
- **The datapath view is the largest canvas in the suite.** Every wire and every
  control signal, on a 390 px screen. Mitigation: it is built in Phase 3, after the
  app shell is proven. It ships with a block-level zoom that collapses the register
  file and the memories, and the sittings seat one reader on C3 at phone width.
- **Two canvases arrive from a lab that is still writing them.** The timing diagram
  and the state machine diagram are the Logic Lab's. Mitigation: `PROGRAM.md` §4 says
  a new canvas carries its second lab's needs in its props from the start, and this
  plan names those needs in §4.2 so the Logic Lab can build them in.
- **A hit rate read as a general fact.** A reader who meets 91.67 % in F3 may carry
  it as the hit rate of a two-way cache. Mitigation: the trace view is beside the
  number in every cache experiment, the note names the trace, and §10 states the
  boundary.
- **Cycles per instruction from a mix, against cycles per instruction from a run.**
  Two numbers with one name. Mitigation: §2.5 puts both on screen together, E4 and E5
  quote both, and the schedule view is the arbiter.
- **Thirty experiments and no continuous quantity.** The lab has no waveform in the
  analog sense, so it looks unlike its neighbours. Mitigation: the timing diagram from
  the Logic Lab carries the gate-level groups, and Group A's carry walking is a
  picture a reader remembers.
- **Cost.** Two new modules, three new canvases, a twelve-opcode machine and fourteen
  programs. Phasing keeps every phase shippable dark, and Phase 1 is useful alone as
  the answer to "what does a cache actually do".
