# Computer Lab: what it needs from elsewhere

What this lab cannot change itself, written here so the director resolves each
once (`PROGRAM.md` §1). Every entry names the file, the change, and who owns it.

## 1. The deploy workflow

`.github/workflows/deploy.yml`, owned by the director. One line, beside the dark
labs already there:

```
          # Dark-launched: built and served at its URL, linked from nowhere until
          # apps/computer-lab/RELEASE_STATUS says `released`.
          cp -r apps/computer-lab/dist _site/computer-lab
```

`release.test.js` in this app already requires that line, so the app's own test
fails until the director adds it. That is on purpose. The URL has to exist for
the dark review to happen.

## 2. The progression test

`packages/ui/src/progression.test.js`, owned by the seams overseer. This lab's
ids and counts:

| Field | Value |
| --- | --- |
| Lab slug | `computer-lab` |
| Experiment ids built | `a1` to `a4`, `b1` to `b3`, `c1` to `c5`, `d1` to `d3`, `e1` to `e6`, `f1` to `f6`, `g1` to `g3` |
| Count built | 30 |
| Count planned | 30, in seven groups (`COMPUTER_LAB_PLAN.md` §5) |
| Groups built | `A · Arithmetic, where the delay is`, `B · The register file and the memory`, `C · One instruction, one clock`, `D · Control`, `E · Pipelining`, `F · The memory hierarchy`, `G · The machine and the world` |
| Groups planned, not built | none |
| Status word | building, dark |

Two rules this lab asks the progression test to enforce for it.

- **No lesson may reference an experiment in another lab that is not built.**
  This lab's model card is quoted from the VLSI Lab, which has no overseer, so
  no lesson names a VLSI experiment. `release.test.js` already refuses one.
- **The cross-reference to the Interfaces Lab's interrupt jitter** (plan §6)
  waits for that lab. G2's note names no experiment there.

## 3. The two canvases, for promotion now that a second lab claims them

`packages/ui`, owned by the director. `PROGRAM.md` §4 names the Computer Lab as
the second lab for both the timing diagram and the state machine diagram, and
this lab now claims both. Neither has been promoted, so both are **copied** into
`apps/computer-lab/src/components/`, file for file, with a comment at the top of
each saying where it came from.

| Component | Where it lives now | What this lab uses |
| --- | --- | --- |
| `TimingCanvas` | copied from `apps/logic-lab/src/components/TimingCanvas.jsx` | A1's carry walking, drawn as the instants each carry changed at |
| `StateCanvas` | copied from `apps/logic-lab/src/components/StateCanvas.jsx` | D2's multicycle control unit, with the `outputs` and `encoding` props that lab wrote for this one |

The copy is a debt, and `release.test.js` fails if either file loses the comment
that records it. Promoting both into `packages/ui` is a move rather than a
rewrite, because each computes its whole picture as data first
(`geometryOf` and `sceneOf`) and the Logic Lab's `canvases.test.jsx` measures
them through those two functions. When the director promotes them, this app
deletes its copies and imports them.

**Landed.** Both canvases are promoted to `packages/ui/src`. This app deleted
its copies, imports `TimingCanvas` and `StateCanvas` from `@ee-labs/ui`, and
passes its own `time` formatter through the new `fmtTime` prop, since this
lab's engine ticks on a finer grid than the Logic Lab's. `release.test.js`
now checks the import resolves instead of checking the copy's provenance
comment.

Three canvases this lab built are its own, and no second lab claims them yet
(`PROGRAM.md` §4). They stay in the app.

| Component | What it draws |
| --- | --- |
| `DatapathCanvas` | every wire of the datapath at one cycle, with the idle ones grey and the control signals as their own layer |
| `ScheduleCanvas` | one row an instruction, one column a cycle, stalls as repeated cells |
| `CacheCanvas` | sets down the page, ways across, with the line the current reference used |

## 4. The engine contract, met without a change to `packages/events`

The director ruled that `packages/events` stays generic and stays the Logic
Lab's, and that this lab's datapath and cache belong in
`apps/computer-lab/src/engine/`. That is where they are. This lab added no file
to that package and changed none of it.

What this lab uses from it, and what it built on top:

| Used from `@ee-labs/events` | Where |
| --- | --- |
| `simulate`, `normalize`, `timingPaths`, `criticalPath`, `fMax` | `engine/blocks.js`, for both adders, the ALU and the decoder |
| `rippleGates` | the ripple-carry adder, so the circuit is the Logic Lab's own |
| The netlist's `lib` field, for per-kind delay overrides | this lab's model card reaches the engine through it |
| The netlist's `unit` field, an exact rational | this lab's grid is 10 fs, because 37.65 ps is not a whole picosecond |

**No hook was missing.** That lab's `NEEDS.md` §4 records three differences:
naming, the meaning of `from`, and where setup and hold are measured. None of
them costs this lab anything. It reads `from` as the previous value and
`cause.signal` for the net that caused the change. It takes the flip-flop's
three times as given numbers, which is what §2.3 of the plan assumed anyway.

One thing this lab would use if the package offered it, written as a contract
rather than a request:

```js
// A named sub-netlist, so a large design can be built from blocks that carry
// their own delays rather than from one flat gate list.
export function block({ name, nets, gates, ports })
```

The 32-bit ALU here is 503 gates in one flat netlist. A datapath built the same
way would be several thousand. This lab worked around it by stating the
datapath's block delays on its model card (`engine/card.js`) rather than
simulating them. That is what the plan's §4.3 already assumed. The request is
for whoever builds the VLSI Lab, which meets the same problem one level down.

## 5. Two decisions for the director

**The model card's ALU entry.** The card charges the datapath 8 gate delays for
the ALU's lookahead carry and 2 more for the output multiplexer, which is the
plan's §4.3. The gate-level ALU netlist in A3 measures 17 gate delays to its
output, because it also carries the operand exclusive-or and the sum
exclusive-or. Both numbers are on screen in A3 and the difference is named
there. Making the card's entry the measured 17 would move the clock period, make
the execute stage the slowest, and change every number in Groups C and E. The
decision is whether the card follows the netlist or the plan.

**Invariant 7 is false as the plan states it.** The plan's §2.8 item 7 says a
fully associative cache with least recently used replacement never misses more
than a direct-mapped one of the same size. It adds that a counter-example fails
the suite. The fuzzer found one. The trace `[12, 64, 4, 12]` on a 16-byte cache
with 8-byte blocks misses 3 times direct mapped and 4 times fully associative.
Direct mapping happened to keep a block that least recently used replacement
threw away. `engine/engine.test.js` pins the counter-example and tests what does
hold beside it. The plan's §2.8 needs the correction.

## 6. Nothing else

This lab needs no change to `packages/network`, `packages/dsp`,
`packages/systems`, `packages/switched`, `packages/explain`, `packages/prose`,
or any other app. It adds one app and edits nothing it does not own.
