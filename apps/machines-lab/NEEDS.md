# Machines Lab: what it needs from elsewhere

Everything this lab wants that it does not own. The director resolves each one
(`PROGRAM.md` §1). Nothing here blocks the lab. Each item names what is wanted,
who owns the file, and what happens meanwhile.

## 1. The deploy workflow

`.github/workflows/deploy.yml` is the director's. One line, beside the other
dark labs':

```
cp -r apps/machines-lab/dist _site/machines-lab
```

`release.test.js` requires the lab to stay unmentioned in `site/index.html`,
`README.md` and `packages/ui/src/LabNav.jsx` while `RELEASE_STATUS` reads
`dark`. It does not require the deploy line, because the workflow is not
readable from the lab. Add the line and the dark URL exists to review.

## 2. The progression test

`packages/ui/src/progression.test.js` is the seams overseer's. The rows this
lab adds:

| Field | Value |
| --- | --- |
| Lab id | `machines-lab` |
| Nav short form | `Machines` |
| Splash glyph | `⊙` |
| Experiments | 35 |
| Groups | 5 |
| Group counts, in order | A 8, B 6, C 9, D 7, E 5 |
| Ids | `a1`–`a8`, `b1`–`b6`, `c1`–`c9`, `d1`–`d7`, `e1`–`e5` |
| Experiment list | `apps/machines-lab/src/experiments.js`, `EXPERIMENTS` |
| Group list | the same file, `GROUPS` |

Cross-references this lab's lessons make to other labs, each of which must name
an experiment that exists:

- Elements F3, from E3's `why`, for the first-order circuit the thermal model
  is.
- Power Lab Group L, from A5's `why`, for the chopper that starts a DC machine
  on a rising voltage. **Not built.** The reference is in prose only and names
  the group rather than an experiment, so it does not fail the progression
  test. Change it to an experiment id when Group L exists.
- Control Lab, from D7's `why` and the plan's §6, for the two loops
  `focPlant` hands over.

## 3. Promotion candidates for `packages/ui`

**The phase plane** (`src/components/canvases.jsx`, `PhasePlaneCanvas`).
`PROGRAM.md` §4 gives it to Control Lab II with this lab as its second. It is
built here because Control Lab II is being built in parallel and was not
available (plan Decision 5). It is minimal on purpose. Two states, one
trajectory, the equilibrium marked, and a `direction` prop that draws a
direction field and is off by default.

Control Lab II's needs are already in its props. It can pass an arbitrary pair
of states rather than current against speed, and the equilibrium as a given
rather than a computed operating point. What it lacks and Control Lab II will
want: a nullcline overlay, a limit cycle drawn as a closed orbit, and more than
one trajectory at once.

**The torque–speed canvas** and **the rotating-field canvas** stay in the app.
No second lab is named for either. The Energy Lab's wind group and the Grid
Lab's Group I are the likely second claimants, and both are unwritten.

## 4. Contracts wanted in `packages/network`

Neither is needed. Both would make this lab's engine smaller, and both are the
Electronics overseer's file to change.

**A current-controlled current source.** `mna.js` stamps VCVS and VCCS. A
machine's torque source and a transformer's primary current are both controlled
by a current, so this lab builds the control out of a resistor and a source
that cancels its drop (`packages/machines/src/port.js`, `senseBranch`). The
construction is exact and the tests sweep the sense resistance over eight
decades to say so. A native stamp would remove two elements per coupling:

```js
// KINDS gains one entry. `over` names the element whose current controls it.
F: { name: 'CCCS', unknownCurrent: false },   // { type: 'F', nodes: [a, b], over: 'V1', gain }
// The stamped row: i = gain · i(over). `over` must be an element that already
// carries a current unknown (V, VCVS, OPAMP, or L in the AC solve).
```

Test to ship with it. The ideal transformer built with `F` and the one built
with a sense branch agree to floating point. Tellegen across both is zero.

**A coupled-inductor element.** Power Lab's Group D and this lab's B3 both draw
a transformer with leakage. Both build it from an ideal transformer with series
reactances, which is the textbook equivalent circuit and is what a reader should
see. A mutual-inductance element `M` would let a transient run through a
transformer, which neither lab needs yet.

```js
// { type: 'M', of: ['L1', 'L2'], k: 0.98 }   coupling coefficient, |k| < 1
// dynamics() would need the inductance matrix inverted rather than each L
// divided, which is the only change of substance.
```

## 5. Three-phase, which no lab teaches

`CURRICULUM.md` §4 lists "three-phase from the circuits side" as a subject with
no home, and recommends Power Lab Group I. Power Lab I is not built. This lab's
C1 and C2 carry the Y and Δ relations as term definitions and one experiment,
because the rotating field cannot be shown without them.

If Power Lab Group I or the Grid Lab's Group B is built, the two labs will state
the same thing twice. The director decides which one keeps it. This lab's
`threephase` term is written so it can be replaced by a cross-reference without
touching an experiment.

## 6. What the Grid Lab asked for, and what it got

`GRID_LAB_PLAN.md` Decision 6 imports this lab's synchronous machine, and its
§2.8 names the contract. It is met in `packages/machines/src/sync.js` and pinned
in `swing.test.js` against that plan's own figures. Nothing is outstanding.

| Wanted | Given |
| --- | --- |
| `E∠δ` behind `jX_d'` | `internalEmf(spec, { V, P, Q, kind })`, any of the five reactances |
| a fault model behind `jX_d''` | `reactance(spec, 'subtransient')` |
| negative- and zero-sequence reactances | `reactance(spec, 'negative' \| 'zero')` |
| an inertia constant `H` | `SYNC_DEFAULTS.H`, MJ/MVA |
| a mechanical power `P_m` | `SYNC_DEFAULTS.Pm`, per unit |
| the swing equation with the pu conventions | `swing(spec, { Pmax, Pm, damping })` |

Two conventions are worth restating, because both are easy to get wrong.

`M = 2H / ω_elec`, not `ω_mech`, because δ is an electrical angle. At
`H = 4 MJ/MVA` and 60 Hz that is `0.0212207 pu·s²/rad`, the Grid Lab's own
number. `syncOf` returns both speeds, named apart.

Every per-unit quantity is on the machine's own base, `Sbase` and `Vbase`.
`syncOf` returns `Zbase` and `Ibase` from them. Changing base is the Grid Lab's
`perUnit.js`, and this lab does not do it.

`swing()` returns the nonlinear `accel` for the Grid Lab's own labelled
integrator and the exact linearisation as `plant` for Control Lab. It does not
integrate anything itself, so the Grid Lab keeps its own guard and its own step.

## 7. The drives group

Four experiments, specified in `MACHINES_LAB_PLAN.md` Decision 4 and recorded in
`BACKLOG.md`. All four need Power Lab's Groups F and L, which have no overseer.
No lesson in this lab references them.
