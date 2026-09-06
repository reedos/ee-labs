# Computer Lab: build brief

The plan is `/COMPUTER_LAB_PLAN.md`, 30 experiments in 7 groups. This brief turns
it into lanes an agent can take without colliding with another, and it fixes the
contracts between them as code. Read the plan's §2 (engine), §4.3 (the model card)
and §5 (curriculum) for your lane before writing a line. Reed reviews everything.

## Boundaries: read first

- **One lane per agent, one worktree per agent.** Work in a git worktree of your
  own on the branch `lab/computer-lab`, and install inside it so that
  `@ee-labs/*` resolves there. Never work in the shared checkout.
- **Edit only the files your lane owns** (§1). Everything else is read-only. A
  change you need outside your lane goes into `apps/computer-lab/NEEDS.md` under
  your lane's heading, and you carry on with what you can do.
- **`packages/events` is the Logic Lab's, and it stays generic.** This lab adds
  no file to it. The datapath, the pipeline and the cache are this lab's, under
  `apps/computer-lab/src/engine/`, built on the registration API that package
  already offers. A hook the engine lacks is written into `NEEDS.md` as a
  contract and worked around inside this app.
- **Stage by path.** Never `git add -A`, and never `commit -a`. Workers do not
  commit. The overseer reviews, tests and commits.
- **Never push.** The director merges `lab/computer-lab` and pushes.

## The house discipline (non-negotiable)

Read `/CORE_SCOPE.md`, `/STYLE.md` and `/REVIEW_PLAYBOOK.md` first. Then the rule
every lab obeys. **Every explanatory sentence is a claim about physics, and a test
must measure it.** A lesson quotes no number the engine does not produce. A
prediction follows every control that can change it. On-screen text passes
`npm run lint:prose`.

This lab's own version of the rule. **No number in a lesson is a constant in a
test.** Every delay is a multiple of the model card's gate delay, every cycle
count comes from a run, and every hit rate comes from a trace. Change the gate
delay in `engine/card.js` and every pinned number moves with it, or the test is
wrong.

Commit messages are narrative. Read `git log` for the register. Never put a model
name in a commit or a file.

## 1. The lanes

| Lane | Work | Owns | Starts | Exit |
| --- | --- | --- | --- | --- |
| 1 | The model card and the instruction set | `src/engine/{card,isa,programs}.js` | now | every opcode encodes and decodes, the card's derived delays pinned |
| 2 | The cache | `src/engine/cache.js` and its test | now | invariants 6 to 9 fuzzed green |
| 3 | The gate-level blocks | `src/engine/blocks.js` and its test | after lane 1 | the ripple carry at 64 gate delays, the lookahead at 8, both measured on a netlist |
| 4 | The datapath and the pipeline | `src/engine/{datapath,pipeline}.js` | after lane 1 | invariants 1 to 3 fuzzed green over ten thousand programs |
| 5 | The app shell and the canvases | everything in `apps/computer-lab/` not owned by another lane | after lane 2 | the shell loads at 390 px, the release test passes dark |
| 6 | Groups F and A and B | `src/groups/{f,a,b}.js`, `src/lessons/{f,a,b}.js` | after lane 5 | every F, A and B number pinned |
| 7 | Groups C and D | `src/groups/{c,d}.js`, `src/lessons/{c,d}.js` | after lane 4 | every wire of C3 checked, D2's states drawn |
| 8 | Groups E and G | `src/groups/{e,g}.js`, `src/lessons/{e,g}.js` | after lane 7 | every E and G number pinned |

**The gate.** No group lane starts before lane 5's shell loads. A group lane that
needs a new engine call writes the signature into `NEEDS.md` under its heading,
and the owning engine lane adds it.

## 2. The app skeleton (lane 5)

The Logic Lab's shape, file for file, with what this lab does not need deleted:

```
apps/computer-lab/
  index.html  package.json  vite.config.js  RELEASE_STATUS (dark)
  AGENT_BRIEF.md  NEEDS.md
  src/App.jsx  main.jsx  styles.css
  src/experiments.js      merges groups/*.js in plan order, no prose
  src/lessons.js          merges lessons/*.js, and readQuantity
  src/groups/{a..g}.js    one file per group, owned by that group's lane
  src/lessons/{a..g}.js   the see / try / why registers, same owner
  src/terms.js            definitions on contact, one registry
  src/analysis.js         the one call from an experiment to the engine
  src/format.js           picoseconds, nanoseconds, hertz and per cent
  src/report.js           the issue link's summary
  src/release.test.js  experiments.test.js  prose.test.js  terms.test.js
  src/App.smoke.test.jsx  groups/{a..g}.test.js
  src/components/         DatapathCanvas, ScheduleCanvas, CacheCanvas,
                          TimingCanvas, StateCanvas, panes.jsx, canvases.test.jsx
```

`TimingCanvas` and `StateCanvas` are copied from `apps/logic-lab/src/components`
with the props they were built with. That copy is a debt, and `NEEDS.md` §3 asks
the director to promote both into `packages/ui` now that a second lab claims them.

## 3. Contracts

Every signature below is a promise between lanes. A lane may add to a return
shape, never rename or remove.

### 3.1 The model card (lane 1, `engine/card.js`)

Two unit values, and everything else a multiple of them (plan Decision 5).

```js
export const UNIT = { num: 1, den: 1e14 }   // 10 fs, the netlist's time grid
export const CARD = {
  gate: 3765,            // a NAND2 driving one NAND2 input, 37.65 ps
  inverter: 2259,        // an inverter driving one inverter, 22.59 ps
  fo4: 5647,             // a fanout-4 inverter, 56.47 ps
  tcq: 5273, tsu: 3013, th: 2260,          // the flip-flop's three times
  blocks: { imem: 12, dmem: 12, rfRead: 8, rfWrite: 4, aluCarry: 8,
            mux2: 2, control: 3, signExtend: 1 },   // in gate delays
  mix: { arith: 0.45, load: 0.25, store: 0.10, branch: 0.15, jump: 0.05 },
  rates: { loadUse: 0.40, taken: 0.60, dep1: 0.30, dep2: 0.15 },
}
export const psOf = (units) => units / 100      // 10 fs units to picoseconds
export const gates = (n) => n * CARD.gate       // n gate delays, in units
export const LIB = { /* the per-kind delay overrides an events netlist takes */ }
```

Every time in this lab is a whole number of units on that grid, so 37.65 ps is
the integer 3765 and nothing rounds. The grid is finer than the Logic Lab's
picosecond because the card's numbers are not whole picoseconds.

Test: `card.test.js` checks that every entry is a whole number of units. It also
checks the derived block delays against the plan's §4.3 numbers, to four figures.

### 3.2 The instruction set (lane 1, `engine/isa.js`)

```js
export const OPS = { add, sub, and, or, slt, addi, andi, lw, sw, beq, bne, j }
export function encode(instr)          // { op, rd, rs, rt, imm } -> a 32-bit word
export function decode(word)           // -> { op, rs, rt, rd, shamt, funct, imm, target, kind }
export function fields(word)           // the six field slices, for C1
export function execOne(state, instr)  // { regs, mem, pc } -> the next state
export const CLASS = (op) => 'arith' | 'load' | 'store' | 'branch' | 'jump'
```

Twelve opcodes, 32-bit words, 32 registers of 32 bits, register 0 reading zero.
The encoding is the textbook subset's, so a reader's cross-reference holds.

Test: `isa.test.js` round-trips every opcode through `encode` and `decode`, and
checks each field slice against the encoding table.

### 3.3 The datapath (lane 4, `engine/datapath.js`)

```js
/**
 * @param program  [{ op, rd, rs, rt, imm }]
 * @param opts     { cycles, stages: 1 | 5, forwarding, predict, regs, mem, resolve }
 * @returns {{ trace: [{ cycle, pc, instr, wires, stage }],
 *             regs: Int32Array, mem: Int32Array,
 *             addresses: [{ cycle, kind: 'i' | 'd', addr }],
 *             cpi, cycles, retired, stalls, flushes }}
 */
export function runDatapath(program, opts)
```

`wires` carries the value of every named wire in that cycle, which is what the
datapath view draws. `addresses` is the address trace, and it is the input to the
cache model. Every field is a count or a value the machine produced.

The wire names are the contract, and the canvas and the lessons share them:

```
pc pc4 instr op rs rt rd imm target
regDst regWrite aluSrc aluOp memRead memWrite memToReg branch jump
readData1 readData2 signImm aluB aluResult zero
memAddr memReadData writeData writeReg branchTarget jumpTarget pcSrc pcNext
```

Test: `datapath.test.js` runs each of the twelve opcodes alone and checks the
whole wire set against a hand trace.

### 3.4 The pipeline (lane 4, `engine/pipeline.js`)

```js
export function runPipeline(program, opts)   // the same return shape, stages: 5
export function scheduleOf(run)              // [{ instr, cells: [{ cycle, stage, bubble }] }]
export function predictorRun(pattern, kind)  // { predictions, mispredicts, kind }
```

A stall is a repeated stage in the schedule and a flush is a struck-through row.
Both are read from the trace and neither is drawn from a formula.

Test: `pipeline.test.js` holds invariants 1 to 3 of the plan's §2.8, fuzzed over
ten thousand generated programs.

### 3.5 The cache (lane 2, `engine/cache.js`)

```js
/**
 * @param trace  [{ addr, kind }] or a plain address array
 * @param cfg    { bytes, blockBytes, ways, policy: 'lru' | 'fifo', write, allocate, seed }
 * @returns {{ hits, misses, rate, compulsory, capacity, conflict,
 *             evictions, writebacks, sets,
 *             perAccess: [{ addr, set, tag, offset, hit, evicted, kind }] }}
 */
export function cacheRun(trace, cfg)
export function amat(hitTime, missRate, penalty, hitPenalty)
```

The three kinds of miss are counted rather than estimated. A compulsory miss is
the first reference to a block. A capacity miss is a miss a fully associative
cache of the same size would also take. A conflict miss is the rest, and the
model runs the fully associative cache alongside the real one to get it.

Test: `cache.test.js` holds invariants 6 to 9, fuzzed over random traces and
configurations from 16 B to 4 kB.

### 3.6 The gate-level blocks (lane 3, `engine/blocks.js`)

```js
export function rippleAdder32(a, b, cin)    // an events netlist, 32 full adders
export function lookahead32(a, b, cin)      // generate and propagate, two levels
export function alu32(fn, a, b)             // the adders, the logic and the mux
export function decoder5to32(addr)          // the register file's address decode
export function pathOf(net)                 // criticalPath in gate delays and picoseconds
```

Each is a netlist for `@ee-labs/events`. The card's delays reach it through the
netlist's own `lib` field, so the engine times the block and this lab does not.

Test: `blocks.test.js` checks the ripple carry at 64 gate delays, the lookahead
at 8, and the 4-bit lookahead block at 4. It checks every sum against its
operands.

### 3.7 The three canvases (lane 5)

```jsx
<DatapathCanvas run={run} cycle={n} pinned={['aluResult']} onPin={fn} zoom="block" />
<ScheduleCanvas run={run} rows={scheduleOf(run)} cycle={n} />
<CacheCanvas cache={result} step={k} />
```

Each computes its whole picture as data first, through `geometryOf`, and the draw
call reads that and nothing else. A prop nothing draws fails the canvas test.

`DatapathCanvas` draws every wire of §3.3 at the cycle it is given. A wire that
carries no meaningful value in that cycle is drawn grey, and the control signals
are their own layer. `zoom="block"` collapses the register file and the memories,
which is how the picture holds at 390 px.

## 4. The lesson schema, and the quantity paths

An experiment is the Logic Lab's shape: `id`, `group`, `name`, `terms`, `params`,
`wants`, `view`, `views`, `main`. The lesson carries `see`, `try` and `why`, and
each register names the readings that justify its numbers.

Quantity paths a `reads` pair may name:

```
ps.<name>              a delay or a period in picoseconds, from the card
g.<name>               the same delay in gate delays
freq.<name>            a frequency in hertz
share.<name>           a fraction of a period or of a time, as a per cent
cycles retired stalls flushes cpi        counts from the run
stall.<loadUse|branch> stall cycles by cause
reg.<n>  mem.<addr>    the final register file and memory
wire.<cycle>.<name>    one wire's value in one cycle
lit.<cycle>            how many wires carry a value in that cycle
stage.<instr>.<cycle>  the stage that instruction is in, as a word
hits misses rate       the cache, over the trace the experiment names
compulsory capacity conflict evictions
distinct refs sets indexbits offsetbits tagbits
amat  amat2            the average access time, one level and two
mispredict.<kind>      the predictor's count on the experiment's pattern
cpimix  cpiterm.<name> cycles per instruction from the stated mix
speedup.<name>  bound  Amdahl's speed-up and its limit
gates  path  arrive.<net>  levels     from an events netlist
tablesize  reach  translate           the page table's three numbers
buscycles.<burst|single>  bustime.<burst|single>
latency  latencyns  interruptshare
```

`experiments.test.js` resolves every path against the analysis and fails on a
path it cannot resolve.

## 5. What each lane pins

Every number in the plan's §5 for your groups becomes a `reads` pair. Each is
checked in `experiments.test.js`, computed from the card rather than typed in.

| Lane | Pins |
| --- | --- |
| 6, Group F | 36 references to 9 distinct addresses. 75.00 % direct mapped and 91.67 % two way. 3 compulsory and 6 conflict misses. 58.33 %, 69.44 %, 75.00 % and 77.78 % across the block sizes. 26.00 and 9.53 cycles of access time. 4.00 MB of page table and 256 kB of reach |
| 6, Groups A and B | 64 gate delays and 2409.6 ps for the ripple carry. 8 gate delays and 301.2 ps for the lookahead, a factor of 8.00. 150.6 ps for the 4-bit block. 75.30 ps for the multiplexer. 32 cycles and 17.11 ns for the multiply. 451.8 ps for a memory access, and 52.0 % of the single-cycle period across two |
| 7, Groups C and D | 1287.7 ps for an arithmetic instruction, 1739.5 ps for a load, 1212.4 ps for a branch, and 574.9 MHz. 26.0 % of a cycle wasted. Nine control signals over twelve opcodes. Five states, four cycles for an arithmetic instruction and five for a load |
| 8, Groups E and G | 534.7 ps a stage and 1870 MHz. 82.86 ps of register overhead, 15.5 % of the period. A factor of 3.25 in throughput. 1.330 cycles an instruction with forwarding and 1.980 without. 10, 19, 10 and 1 mispredictions. 23 cycles and 12.30 ns of interrupt latency. 4.277 ns and 2.673 ns on the bus |

## 6. Verify before every hand-back

```
npx vitest run packages/events apps/computer-lab apps/logic-lab
node packages/prose/bin/lint.mjs
npm run build --workspace apps/computer-lab
```

Run the scoped set above rather than the whole suite. `packages/events` and
`apps/logic-lab` are in it because this lab reads that package, and a change here
that breaks its other consumer has to fail here.

There is no browser harness in this lab, and `BACKLOG.md` carries it.
`App.smoke.test.jsx` mounts every pane of every experiment against that
experiment's own analysis, so a pane fed something it cannot draw fails in the
suite. `components/canvases.test.jsx` measures every canvas prop against the
geometry it produces, so a prop that is passed and not drawn fails there.

## 7. Gotchas this suite has already paid for

- Every time in the engine is a whole number of the netlist's unit. This lab's
  unit is 10 fs, so a delay knob steps in whole units and never offers a
  fraction of one.
- A hit rate belongs to its trace. Every cache number on screen names the trace
  it came from, and the trace view sits beside it.
- Two numbers with one name is the defect this lab is most exposed to. Cycles
  per instruction from a stated mix and cycles per instruction from a run are
  different numbers, and both appear together wherever either appears.
- A test that fails may be the test. Decide which, and say which in the commit.
- The dark launch is enforced by a test. While `RELEASE_STATUS` says `dark`,
  nothing outside `apps/computer-lab/` may mention the lab.
- No lesson may reference an experiment that is not built, in this lab or in
  another. The VLSI Lab is not built, so no lesson names a VLSI experiment.
