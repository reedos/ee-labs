# Logic Lab: what it needs from elsewhere

What this lab cannot change itself, written here so the director resolves each
once (`PROGRAM.md` §1). Every entry names the file, the change, and who owns it.

## 1. The deploy workflow

`.github/workflows/deploy.yml`, owned by the director. One line, beside the two
dark labs already there:

```
          # Dark-launched: built and served at its URL, linked from nowhere until
          # apps/logic-lab/RELEASE_STATUS says `released`.
          cp -r apps/logic-lab/dist _site/logic-lab
```

`release.test.js` in this app already requires that line, so the app's own test
fails until the director adds it. That is on purpose. The URL has to exist for
the dark review to happen.

## 2. The progression test

`packages/ui/src/progression.test.js`, owned by the seams overseer. This lab's
ids and counts:

| Field | Value |
| --- | --- |
| Lab slug | `logic-lab` |
| Experiment ids built | `a1` to `a6`, `b1` to `b6`, `c1` to `c6`, `d1` to `d6`, `e1` to `e6`, `f1` to `f7`, `g1` to `g5`, `h1` to `h3` |
| Count built | 45 |
| Count planned | 45, in eight groups (`LOGIC_LAB_PLAN.md` §5) |
| Groups built | `A · Gates and truth tables`, `B · Boolean algebra and the map`, `C · The blocks a datapath is made of`, `D · Delay, glitches and hazards`, `E · The latch and the flip-flop`, `F · Registers, counters and the machine`, `G · The clock`, `H · Metastability` |
| Groups planned, not built | none |
| Status word | building, dark |

One rule this lab asks the progression test to enforce for it.

- **No lesson may reference an experiment in another lab that is not built.**
  Track D opens after Electronics D6, the CMOS inverter, which is not built
  (`LOGIC_LAB_PLAN.md` Decision 7). A reference to it must fail the suite until
  D6 exists.

The second rule this file used to ask for is gone, because the groups it was
about are built. `release.test.js` now takes the ids that exist and requires
every reference in every sentence to be one of them, so the rule keeps working
without naming a group. The progression test does not need to repeat it.

## 3. The two new canvases, for promotion when a second lab claims them

`packages/ui`, owned by the director. `PROGRAM.md` §4 names the second labs, and
none of them is built, so nothing can claim either component yet. Both live in
`apps/logic-lab/src/components` and both carry the second lab's props already
(`AGENT_BRIEF.md` §3.7).

| Component | Second lab | The props built for it |
| --- | --- | --- |
| `TimingCanvas` | Interfaces Lab, VLSI Lab | `busses` for a set of rows drawn as one numeric row, `spans` for a measured interval with its width printed, `analog` for one real-valued row against two threshold levels, `cursors` for a read pair with the interval between them, `causes` for the line from an event to the event that caused it |
| `StateCanvas` | Computer Lab | `outputs` for a Moore output drawn inside the state, `encoding` for the state's bits beside its name, `taken` for the arc last followed |

Promote both when the second lab starts, as a move rather than a copy.

Each of them computes its whole picture as data before it draws anything, and
the draw call reads that and nothing else. `geometryOf` on the timing diagram
places every row, the span, the cursor pair and each threshold level.
`sceneOf` on the state diagram places every state and says which circle and
which arc are lit. `components/canvases.test.jsx` measures every prop through
those two functions, so the move into `packages/ui` carries its own tests with
it.

A third component may be worth promoting with them. `RatePane` in
`components/panes.jsx` prints a model's parameters and its assumptions beside
its answer, which is what CORE_SCOPE Rule 3 asks of every inexact model in the
suite. It is written for this lab's rate law and it is not general, so it is
named here as a shape rather than as a request.

**Landed.** Both canvases moved to `packages/ui/src`, with `geometryOf`,
`sceneOf` and their tests, and this app now imports them from `@ee-labs/ui`.

## 4. The engine contract, reconciled with the three track D plans

`packages/events` is this lab's, and `VLSI_LAB_PLAN.md`, `COMPUTER_LAB_PLAN.md`
and `INTERFACES_LAB_PLAN.md` each state in their §2.3 what they assume of it.
**Met**, and covered by `packages/events/src/contract.test.js`:

- `simulate(design, stim, { until })` beside this lab's `simulate(net, { tEnd })`.
- `at(t)` and `waveform(net)` on the result, and `net` and `value` on every event.
- `criticalPath(design)` returning the path and not only its length.
- `violations` reporting setup and hold failures, with no third logic value.
- A net with several drivers, resolved per net as `wired-and`, `wired-or` or
  `single`, with a conflict under `single` reported as an event.
- Exact times. Every time is a whole number of the netlist's own `unit`, and the
  unit is an exact rational number of seconds. A 9600 baud bit time and a 30 ps
  gate are both whole numbers on one grid.
- Cells a consumer registers on its own netlist, so `extract.js`, `cache.js`,
  `datapath.js`, `pin.js` and `protocol.js` stay out of `packages/events`.

**Three differences the director reconciles once.** None of them blocks a lab,
and each of the three plans says it changes where this lab chose differently.
All three are unchanged since the engine was written, and the contract test
still covers every promise above.

1. **Names.** Those plans write `design.nets`, `gates[].out`, `flops[].q`,
   `tpLH`, `tpHL`, `tPcq`, `tSetup` and `tHold`. This package's own names are
   `nets`, `out`, `out`, `tr`, `tf`, `tcq`, `tsu` and `th`. Every one of their
   spellings is read, so a design written either way normalises. The engine's
   own netlists use this package's names, and a lab may use either.
2. **`from` on an event.** Their shape is `{ t, net, value, from }`, and `from`
   there reads as the net that caused the change. Here `from` is the value the
   net held before, and `cause` is `{ signal, t }` of the event that produced
   it. Both are on every event, so nothing is lost. The clash is in the word.
3. **Setup and hold, where they are measured.** This engine measures them at
   the flip-flop's terminals, as how long D was still on either side of the
   edge. `VLSI_LAB_PLAN.md` defines them inside the cell, as the storage node
   reaching its trip point before the gate closes. The two agree once the cell's
   internal delays are folded into `tsu` and `th`, which is what a characterised
   library does. This lab takes them as given, and the VLSI Lab derives them.
   The seam is the hand-over of two numbers, and `LOGIC_LAB_PLAN.md` §2.8a says
   so.

One request, for whoever writes the VLSI Lab. Hand the derived `tsu` and `th`
back as plain numbers of the cell, with the trip point they were measured at
stated. This engine will not need to know how they were found.

## 5. The engine's own additions, for the three labs that read it

`packages/events` grew three builders while the sequential half was written.
The three track D plans should know they are there, rather than writing their
own copies of the same netlists.

| Builder | What it is | Who asked |
| --- | --- | --- |
| `oneFlop({ period, phase, at })` | one flip-flop and its clock, with a D that steps where the caller says | Group E's setup and hold window |
| `shiftRegister(n, { period, bits })` | `n` flip-flops with nothing at all between them | Group F's register, and the floor every design is measured from |
| `DETECTOR_101` | the 101 detector as a specification, not as a netlist | Group F, and the engine's own test of `fsmNet` |

`shiftRegister` also answers a question the Computer Lab will ask. A register
fed from primary inputs has no path from one flip-flop to another at all, so
`fMax` declines it by name rather than timing a path that is not there. That is
the right refusal, and a lab that wants the register's own closing period feeds
each stage from the one before it.

## 6. Nothing else

This lab needs no change to `packages/network`, `packages/dsp`,
`packages/systems`, `packages/switched`, `packages/explain`, or any other app.
It adds one package, one app and one plan, and it edits nothing it does not own.
