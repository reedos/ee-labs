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
| Experiment ids built | `a1` to `a6`, `b1` to `b6`, `c1` to `c6`, `d1` to `d6` |
| Count built | 24 |
| Count planned | 45, in eight groups (`LOGIC_LAB_PLAN.md` §5) |
| Groups built | `A · Gates and truth tables`, `B · Boolean algebra and the map`, `C · The blocks a datapath is made of`, `D · Delay, glitches and hazards` |
| Groups planned, not built | E, F, G, H |
| Status word | building, dark |

Two rules this lab asks the progression test to enforce for it.

- **No lesson may reference Electronics D6.** Track D opens after the CMOS
  inverter, which is not built (`LOGIC_LAB_PLAN.md` Decision 7). A reference to
  it must fail the suite until D6 exists.
- **No lesson may reference an experiment in groups E to H of this lab.** They
  are specified and not built.

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

## 5. Nothing else

This lab needs no change to `packages/network`, `packages/dsp`,
`packages/systems`, `packages/switched`, `packages/explain`, or any other app.
It adds one package, one app and one plan, and it edits nothing it does not own.
