# Logic Lab: build brief

You are one of up to six agents building this lab in parallel. The plan is
`/LOGIC_LAB_PLAN.md`, and this brief turns it into lanes an agent can take
without colliding with another. Read the plan's §2 (engine) and §5 (curriculum)
for your lane before writing a line. Reed reviews everything.

## Boundaries: read first

- **One lane per agent, one worktree per agent.** Work in a git worktree of your
  own on the branch `lab/logic-lab`, and `npm ci` inside it so that `@ee-labs/*`
  resolves there. Never work in the shared checkout.
- **Edit only the files your lane owns** (§1). Everything else is read-only. If
  you need a change outside your lane, write it into `apps/logic-lab/NEEDS.md`
  under your lane's heading and continue with what you can do. The owning lane
  picks it up.
- **Stage by path.** `git add apps/logic-lab/src/groups/d.js`, never
  `git add -A` and never `commit -a`. Workers do not commit at all. The overseer
  reviews, tests and commits.
- **Never push.** The director merges `lab/logic-lab` and pushes.
- **Preview port.** Lane number plus 4320, so lane 3 previews on 4323.

## The house discipline (non-negotiable)

Read `/CORE_SCOPE.md`, `/STYLE.md` and `/REVIEW_PLAYBOOK.md` first. Then the rule
every lab obeys: **every explanatory sentence is a claim about physics, and a
test must measure it.** A lesson quotes no number the engine does not produce. A
prediction follows every control that can change it. A claim the settings cannot
show is footnoted, never crossed out. On-screen text passes
`npm run lint:prose`.

This lab's own version of the rule: **no number in a lesson is a constant in a
test.** Every delay in §5 of the plan is a sum of library entries, and the test
adds those entries up. Change the inverter from 30 ps to 25 ps and every pinned
number moves with it, or the test is wrong.

Commit messages are narrative: what changed, why, and what fell out. Read
`git log` for the register. Never put a model name in a commit or a file.

## 1. The lanes

| Lane | Work | Owns | Starts | Exit |
| --- | --- | --- | --- | --- |
| 1 | The engine | `packages/events/**` | now | the four invariants of the plan's §2.12 fuzzed green, contracts in §3 met |
| 2 | The app shell | everything in `apps/logic-lab/` not owned by another lane, `RELEASE_STATUS`, `release.test.js`, `scripts/verify.mjs` | after lane 1's contracts | the shell loads a stub experiment at 390 px, the release test passes dark |
| 3 | The timing diagram and the gate diagram | `src/components/{TimingCanvas,GateCanvas}.jsx` and their tests | after lane 1 | both canvases draw a run, and the props of §5 are all exercised |
| 4 | Groups A and B | `src/groups/{a,b}.js`, `src/lessons/{a,b}.js`, `src/components/{TruthTable,KarnaughCanvas}.jsx` | after lane 2's shell | every A and B number pinned, prose lint clean |
| 5 | Groups C and D | `src/groups/{c,d}.js`, `src/lessons/{c,d}.js`, `src/components/PathList.jsx` | after lane 2's shell | every C and D number pinned |
| 6 | Groups E and F | `src/groups/{e,f}.js`, `src/lessons/{e,f}.js`, `src/components/StateCanvas.jsx` | after lane 3 | every E and F number pinned, the state diagram drawn |
| 7 | Groups G and H | `src/groups/{g,h}.js`, `src/lessons/{g,h}.js` | after lane 6 | every G and H number pinned |

**The gate.** No group lane starts before lane 1's exit is met and lane 2's
shell loads. Lane 1 is the only lane that may edit `packages/events`. A group
lane that needs a new builder writes the signature into `NEEDS.md` under its
heading, and lane 1 adds it.

**Shared seams, landed first.** Lane 2's first commit adds the app skeleton,
`RELEASE_STATUS` and `release.test.js`. Lane 3's first commit adds
`TimingCanvas` against the stub of §3.6. Every group lane rebases onto those two
before it is reviewed.

## 2. The app skeleton (lane 2)

Circuit Elements Lab's shape, file for file, with what this lab does not need
deleted:

```
apps/logic-lab/
  index.html  package.json  vite.config.js  RELEASE_STATUS (dark)
  AGENT_BRIEF.md  NEEDS.md
  scripts/verify.mjs
  src/App.jsx  main.jsx  styles.css
  src/experiments.js      merges groups/*.js in plan order, no prose
  src/lessons.js          merges lessons/*.js, and readQuantity
  src/groups/{a..h}.js    one file per group, owned by that group's lane
  src/lessons/{a..h}.js   the see / try / why registers, same owner
  src/terms.js            definitions on contact, one registry
  src/analysis.js         the one call from an experiment to the engine
  src/format.js           picoseconds, nanoseconds and hertz for a reader
  src/report.js           the issue link's summary
  src/release.test.js  experiments.test.js  prose.test.js  terms.test.js
  src/components/         TimingCanvas, GateCanvas, StateCanvas, TruthTable,
                          KarnaughCanvas, PathList, EventTable, panes.jsx
```

`release.test.js` is the Elements file with the paths changed, copied rather than
rewritten. `experiments.test.js` follows Elements' shape. The structural checks
come first, then the claim checks. Last come the register checks, which require
every number in `see`, `try` and `why` to be a reading the engine produced.

## 3. Contracts

Every signature below is a promise between lanes. A lane may add to a return
shape, never rename or remove. Each contract ships with the failing test named
beside it, written before the implementation.

### 3.1 The netlist of gates (lane 1, `packages/events/src/netlist.js`)

```js
{
  name: 'the static-1 hazard',
  // One driver per signal, and the signal carries the driver's name.
  sources: [
    { id: 'a', kind: 'input', value: 0 | 1 },                      // held, and enumerable
    { id: 'x', kind: 'step', at: 100, from: 1, to: 0 },            // whole picoseconds
    { id: 'clk', kind: 'clock', period: 1000, high: 500, phase: 0, init: 0 },
    { id: 'd', kind: 'pattern', period: 200, bits: [0, 1, 1, 0], at: 0, repeat: false },
  ],
  gates: [{ id: 'p', kind: 'and', in: ['a', 'b'], delay: 70, tr: 70, tf: 70, init: null }],
  wires: [{ id: 'clk2', from: 'clk', delay: 10 }],                 // a driver with no logic
  flops: [{ id: 'q', d: 'p', clk: 'clk', edge: 'rising', tcq: 80, tsu: 40, th: 20, init: 0 }],
  outputs: ['q'],
  delayMode: 'transport',        // or 'inertial'
  lib: { and: { 2: 60 } },       // per-kind, per-fan-in delay overrides
}
```

Kinds and their fan-in. `not` and `buf` take 1 input. `and`, `or`, `nand` and
`nor` take 2 to 4. `xor` and `xnor` take 2 or 3. A fan-in the library has no
delay for is refused, because a delay this package cannot state is a number it
must not invent.

Test: `simulate.test.js` checks every default, every refusal message, and each
kind's law at every row of its own table.

### 3.2 The event queue (lane 1, `queue.js`)

```js
class EventQueue {
  push(t, event)      // t is a whole number of picoseconds
  nextTime()          // the earliest time with anything in it, or null
  popBatch()          // { t, events: [...] }: EVERY event at that time, or null
  remove(t, event)    // take one back out; returns whether it was there
  get size()
}
```

`popBatch` returning the whole instant is the contract, not an optimisation. The
simulator applies the batch before it evaluates a gate, so no order within an
instant reaches the model.

Test: `simulate.test.js` "hands back every event at the earliest instant as one
batch", and the determinism fuzz that shuffles the gate list.

### 3.3 `simulate` (lane 1, `simulate.js`)

```js
/**
 * @param net   a netlist, or the result of normalize(net)
 * @param opts  { tEnd } in picoseconds, { maxEvents }
 */
export function simulate(net, opts = {}) => ({
  tEnd, signals: string[],
  events: [{ t, signal, from, to, by, delay, cause: { signal, t } | null }],
  waves: { [signal]: { t: number[], v: number[] } },   // v[i] holds from t[i] to t[i+1]
  final: { [signal]: 0 | 1 },
  violations: [{ kind: 'setup' | 'hold', flop, t, actual, required, slack, d }],
  swallowed: [{ signal, at, to, width, mode, dropped: [{ t, value }] }],
  settled: boolean,          // the state at t = 0 was consistent with itself
  steps: number,
})

export function valueAt(res, signal, t)     // 0 or 1
export function edgesOf(res, signal)        // [{ t, from, to }]
export function relax(norm)                 // { value: Map, settled }
```

Test: an inverter's single event with `t === cause.t + delay`. The hazard's two
events 30 ps apart. Both delay models on a 20 ps pulse into a 60 ps gate.

### 3.4 The analysis (lane 1, `analyse.js`)

```js
export function evaluate(net, vector)        // { [signal]: 0|1 }, no time at all
export function truthTable(net, opts)        // { inputs, outputs, rows, minterms }
export function pulsesOf(res, signal)        // [{ from, to, width, value }]
export function hazardOf(net, { input, from, to, output, at })
  // { before, after, static, pulses, hazard: { width, at, value } | null, result }
export function timingPaths(net, { starts })  // starts: 'flops' times register to register
  // { long, short, arrival, endpoints: [{ signal, kind, long, short, path, shortPath }] }
export const criticalPath = (net) => timingPaths(net).long
export function fMax(net, { skew })
  // { tMin, fMax, terms: { tcq, tpd, tsu, skew }, holdSlack, tpdShort, path, shortPath }
```

`truthTable` throws `EventsError` with code `combinational-loop` on a netlist
with a ring in it, and `has-memory` on one with a flip-flop. Both refusals are
content, and Group E1 renders the first.

Test: `analyse.test.js`. The adder's 256 operand pairs. The critical path equal
to the sum of the library delays along it. The hold slack unchanged by the clock
period.

### 3.5 Minimisation (lane 1, `boolean.js`)

```js
export function grayOrder(n)                          // the map's cell order
export function primeImplicants(minterms, n, dontCare = [])   // every prime, by Quine-McCluskey
export function minimalCover(minterms, primes, n)     // { cover, essential, literals, cubes }
export function expressionOf(cover, names)            // "a'b' + bc' + ac"
export function netFromCover(cover, names, opts)      // the two-level netlist
export function cubeMinterms(cube, n)                 // the minterms one cube covers
export function literals(cube, n)
```

A cube is `{ mask, bits }`, with a 1 in `mask` where the variable appears and
`bits` saying whether it appears true or complemented. `names[0]` is the high
bit. A complement is written with a prime, one notation in the code, the lesson
and the test.

Test: `boolean.test.js`. Six primes for `Σ(0, 1, 2, 5, 6, 7)`, a minimum cover of
three cubes and six literals, and the built netlist's table equal to the one it
was minimised from.

### 3.6 The state machine (lane 1, `build.js`)

```js
// The specification a reader writes down first.
const detector = {
  name: 'the 101 detector',
  inputs: ['x'],
  states: ['s0', 's1', 's2'],
  reset: 's0',
  next: (state, v) => 's1',            // v is { x: 0 | 1 }
  out: (state, v) => ({ y: 0 }),       // reads v for a Mealy machine, ignores it for Moore
}

export function fsmTable(spec)
  // { states, inputs, bits, code, rows, outputs, type: 'Moore' | 'Mealy', unused }
export function fsmEquations(spec)
  // { table, vars, dontCare, equations: { [name]: { cover, literals, cubes, expression } } }
export function fsmNet(spec, { period, values })
  // a netlist with the minimised logic and one flip-flop per state bit
```

`fsmNet` is the whole design flow in one call: enumerate, encode, minimise with
the unused codes free, and build. A next-state bit that is the same in every row
becomes a source held at that value rather than a gate.

Test: `boolean.test.js` "the built machine detects 101". The netlist is simulated
against the specification it came from, which no intermediate step can pass by
accident.

### 3.7 The two new canvases (lane 3 and lane 6)

```jsx
// apps/logic-lab/src/components/TimingCanvas.jsx
<TimingCanvas
  res={result}                          // what simulate returned
  signals={['a', 'na', 'p', 'q', 'y']}  // rows, in the order given
  groups={[{ label: 'inputs', signals: ['a', 'b'] }]}   // a labelled band
  busses={[{ label: 'sum', signals: ['s3', 's2', 's1', 's0'] }]}  // one numeric row
  marks={[{ t: 240, label: 'y falls' }]}
  spans={[{ from: 240, to: 270, label: 'the glitch', signal: 'y' }]}
  causes                                // draw the line from each event to its cause
  window={[0, 1000]} cursor={500} onCursor={fn}
/>

// apps/logic-lab/src/components/StateCanvas.jsx
<StateCanvas
  states={['s0', 's1', 's2']} encoding={{ s0: '00', s1: '01', s2: '10' }}
  edges={[{ from: 's0', to: 's1', label: 'x = 1', out: { y: 0 } }]}
  active="s1" taken={{ from: 's0', to: 's1' }}
  outputs                               // draw a Moore output inside the circle
/>
```

`busses` and `spans` are the Interfaces Lab's needs and `causes` is the VLSI
Lab's, written now so that promoting the component into `packages/ui` later is a
move rather than a rewrite (plan Decision 5). `outputs` is the Computer Lab's.

Test: `components/TimingCanvas.test.jsx` renders a known run and checks the
geometry of each row against `schematicGeometry`'s conventions, as the Elements
lab checks its layouts. No text overlaps another.

### 3.8 The stub the app lanes build against

Until lane 1 lands, lanes 2 and 3 import `apps/logic-lab/src/stub.js`. It
exports one frozen `simulate` result for the hazard netlist, in the shape of
§3.3. The stub is deleted in the commit that switches the imports to
`@ee-labs/events`, and `experiments.test.js` fails if it is imported after that.

## 4. The lesson schema, and the quantity paths

Copy Elements' `lessons.js` header comment and its three registers: `see` (≤ 70
words), `try` (each step ≤ 45 words, with `set`, `at` and `reads`), and `why`
(≤ 160 words). An experiment entry is Elements' shape: `id`, `group`, `name`,
`terms`, `params`, `net`, `layout`, `show`, `view`, `views`, `claim`. Two fields
are new. `mode` is the delay model the experiment opens with. `step` names the
input a hazard experiment moves, with its two values.

Quantity paths a `reads` pair may name:

```
final.<signal>                     the settled value, 0 or 1
at.<signal>.<t>                    the value at time t, picoseconds
edge.<signal>.<k>                  the time of the k-th transition, k from 1
edges.<signal>                     how many times it changed
first.<signal>  last.<signal>      the first and last transition times
pulse.<signal>.<width|from|to>     the first pulse on that signal
path.<long|short>                  the longest and shortest arrival, picoseconds
arrive.<signal>                    that endpoint's longest arrival
gates  flops  levels               counts from the netlist
table.<row>.<output>               one cell of the truth table
minterms.<output>                  how many minterms
primes  cubes  literals            the minimisation's counts
tmin  fmax  holdslack              the clock period in ps, the frequency in Hz
violation.<k>.<kind|slack|actual>  the k-th setup or hold violation
swallowed.<k>.<width>              the k-th pulse the delay model rejected
mtbf  settling                     seconds, and picoseconds
```

`experiments.test.js` resolves every path against the analysis and fails on a
path it cannot resolve, as Elements' does.

## 5. What each lane pins

Every number in the plan's §5 for your groups becomes a `reads` pair or a
`claim` checked in `experiments.test.js`. Each is computed from the library
rather than typed in.

| Lane | Pins |
| --- | --- |
| 4, Group A | 30 ps for an inverter, 70 ps for an AND, 50 ps for a NAND, 80 ps for a NAND and an inverter against the library's 70 ps. Four NAND gates and 150 ps for an exclusive-or against 90 ps. Eight rows for three inputs, 40 ps for a buffer and 10 ps for a wire |
| 4, Group B | 6 primes, a cover of 3 cubes and 6 literals, `a'b' + bc' + ac`. 7 gates and 180 ps against the canonical 10 gates and 18 literals. 50 ps against 100 ps for De Morgan. The multiplexer at 2 cubes and 4 literals |
| 5, Group C | 170 ps and 140 ps for the multiplexer. 100 ps and 70 ps for the decoder. 90 ps and 70 ps for the half adder. 180 ps and 230 ps for the full adder. 650 ps, 600 ps and 180 ps for the 4-bit adder, 20 gates, 140 ps a bit, and every one of 256 sums |
| 5, Group D | 140 ps and 170 ps for the two paths. A 30 ps pulse at 240 ps, and the settled 1. No event with the consensus term, and 80 ps for the 3-input OR. One swallowed pulse under inertial delay. 1180, 1230, 1370 and 1510 ps for the adder's sum bits |
| 6, Group E | The `combinational-loop` refusal and the ring it names. 350 ps and 400 ps for the latch. 5 gates for the D latch, 11 for the flip-flop, and 100 ps to Q. A violation window from 461 ps to 519 ps, 59 ps of the 60 ps of `t_su + t_h` |
| 6, Group F | 6 gates and 4 flip-flops for the counter, 350 ps, and 70 ps a bit. 6 rows, 2 state bits, 1 unused code, Mealy. `d1 = q0x'`, `d0 = x`, `y = q1x`. 6 gates and 230 ps for the built machine, and its output on all eight clocks |
| 7, Group G | 770 ps as 80 + 650 + 40, and 1.2987 GHz. 1330, 2450 and 4690 ps at eight, sixteen and thirty-two bits. 490 ps and 2.0408 GHz pipelined, a factor of 1.571. 720 ps and 150 ps of hold slack at 50 ps of skew, and hold failing at 201 ps |
| 7, Group H | 1.10 s, 24 260 s and 16.93 years at 200, 400 and 600 ps. A factor of e per 20 ps. 880 ps and 2.036 × 10⁷ years for two flip-flops. 681.6 ps for a thousand years |

## 6. Library netlists, with fixed names

Built by `@ee-labs/events`. A lane does not write its own copy of one of these.

```js
import { hazardNet, mux2, decoder24, halfAdder, fullAdder, rippleAdder,
         srLatch, dLatch, masterSlave, ring, counter, onePath,
         pipelinedAdder, oneGate, nandOnly, fsmNet } from '@ee-labs/events'

hazardNet({ a, b, c, consensus })   // a, b, c, na, p, q, r (consensus only), y
mux2({ a, b, s })                   // a, b, s, ns, m0, m1, y
decoder24({ a1, a0 })               // a1, a0, n1, n0, d0, d1, d2, d3
fullAdder({ a, b, cin })            // a, b, cin, x, s, g, p, cout
rippleAdder(n, { a, b, cin })       // a0.., b0.., x0.., s0.., g0.., p0.., c1.., cout
srLatch({ s, r, q })                // s, r, q, qn
dLatch({ d, g, q })                 // d, g, nd, sa, ra, q, qn
masterSlave({ d, period, q })       // clk, d, nclk, nd, ma, mb, m, mn, nm, sa, sb, q, qn
ring(n, { delay })                  // i0 .. i(n-1), starting alternating
counter(n, { period })              // clk, q0.., d0.., e2..  (the enable chain)
onePath({ period, skew, logic })    // clk, clk2, din, q1, mid, q2
pipelinedAdder(n, { period, a, b, skew })  // the adder's, plus ra0.., rb0.., r0.., rc
```

A group lane that needs a netlist not on this list writes its signature into
`NEEDS.md` and lane 1 adds it to `build.js`. A netlist written inside an app is a
netlist the engine's own tests never see.

## 7. Verify before every hand-back

```
npx vitest run                                   # the whole monorepo, from the root
node packages/prose/bin/lint.mjs                 # every word a reader sees
npm run build --workspace apps/logic-lab
npx vite preview --outDir apps/logic-lab/dist --port 432N --strictPort &
cd apps/logic-lab && APP_URL=http://localhost:432N node scripts/verify.mjs
```

The harness catches what unit tests cannot: a prop not passed, a pane fed stale
state, a canvas that stopped redrawing. Extend it for every view you add.
Screenshot every view at 390 px and at 1280 × 900, and read the screenshots as a
student would, per `/REVIEW_PLAYBOOK.md` §11.

## 8. Gotchas this suite has already paid for

- Engineering-notation fields read a bare number in the displayed prefix. Harness
  code types explicit prefixes ("30p", "1n").
- Every time in the engine is a whole number of picoseconds. A knob that offers
  30.5 ps produces a refusal, not a rounded delay. Knobs step in whole
  picoseconds.
- A test that fails may be the test. Decide which, and say which in the commit.
- Wherever two numbers are shown as equal, ask what could make them differ
  silently. Then remove the cause or print it.
- A waveform drawn from `waves` is a step function. Draw it as one, with vertical
  edges, and never interpolate between two transitions.
- The dark launch is enforced by a test. While `RELEASE_STATUS` says `dark`,
  nothing outside `apps/logic-lab/` may mention the lab, and the release test
  fails when anything does.
- No lesson may reference Electronics D6 (plan Decision 7). The progression test
  fails on a reference to an experiment that is not built, by design.
