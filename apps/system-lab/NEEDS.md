# System Lab: what it needs from elsewhere

`PROGRAM.md` §1 says two overseers who need the same thing write it here and the
director resolves it once. This file is that list for the System Lab. Nothing in
it is a request to another overseer. Every line is for the director.

## 1. The deploy line

One line for `.github/workflows/deploy.yml`, added at integration.

```
cp -r apps/system-lab/dist _site/system-lab
```

`release.test.js` holds this file to carrying that line. It says nothing about
the workflow itself, because the workflow is the director's file and this lab
must not read a decision into it that the director has not taken. The lab
deploys dark at `/system-lab/`, and `RELEASE_STATUS` reads `dark` until Reed
changes it.

## 2. The progression test

`packages/ui/src/progression.test.js` belongs to the seams overseer. These are
this lab's ids and counts for it.

The slug is `system-lab`. Four experiments exist today, and they are the whole
of Group A. Groups B to F are planned and not built, so their ids are listed
apart and do not go into the progression test until they land.

| Group | Ids | Count |
| --- | --- | --- |
| A The chain as a budget | a1 to a4 | 4 |

Not built. `SYSTEM_LAB_PLAN.md` §9 says which phase each waits for, and
`BACKLOG.md` carries them under this lab's heading.

| Group | Ids | Count | Waits for |
| --- | --- | --- | --- |
| B The noise budget | b1 to b5 | 5 | RF Lab phase 5 |
| C The linearity budget | c1 to c5 | 5 | RF Lab phase 5 |
| D Dynamic range | d1 to d4 | 4 | RF Lab phase 6 |
| E The link budget | e1 to e4 | 4 | Fields Lab group L |
| F Power and the whole system | f1 to f3 | 3 | Electronics Lab group M |

Group A makes no cross-reference into another lab, by design. Decision 4 of the
plan gives every block a `linksTo` field for the experiment that solves its
circuit, and every block in this lab carries `null` there. A lesson may not
point at an experiment that does not exist, and the labs those links go to are
not built.

Cross-references this lab will make once the labs they name have shipped. None
of them is written into a lesson yet, and none should be added to the
progression test before its group lands.

| From | To | What it needs |
| --- | --- | --- |
| b2, c3 | RF Lab groups F and G | the noise figure and the IP3 of a solved circuit |
| e1, e2 | Fields Lab group L | antenna gain and the Friis equation |
| f1 | Electronics Lab M6 | the efficiency ceiling of a linear stage |
| f2 | RF Lab group H | the local oscillator's phase noise, from Leeson |
| d4 | Signal Lab, "4 bits" | the quantiser at a stated bit depth |
| e4 | Communications Lab | the bit error rate against `E_b/N_0` |

## 3. What Phases 2 to 6 need, and from whom

`SYSTEM_LAB_PLAN.md` §9 phases this lab so that Phase 1 depends on nothing
unbuilt. It is built. Each phase below names the work it waits on, and the
overseer who owns it.

### Phase 2, the noise budget, Group B (5)

`cascadeNF` is built and fuzzed in `packages/rf/src/budget.js`, so the
arithmetic is not the blocker. What is missing is invariant 5 of the plan's
§2.9, which checks the cascaded noise figure against a chain of noise sources
run through `packages/dsp`'s `runChain`. **From the RF Lab overseer, phase 5:**
the noise sources, as the module that gives a block a noise density rather than
only a figure. **From the Electronics Lab overseer, group O:** the density that
a real stage makes, which is where B2's shares stop being arithmetic.

### Phase 3, the linearity budget, Group C (5)

`cascadeIIP3` is built. It returns the aligned-phase total and the
power-addition total together. Two things are missing. **From the RF Lab
overseer, phase 5, `linearity.js`:** the extraction of IP3 from two tones through
an FFT, which is invariant 6. That module also carries the drive guard, which
warns 10 dB below compression and declines 3 dB below it. **The third rule,** random
phase, which the plan's C4 needs and this sitting did not write. Invariant 7 is
green for the two rules that exist, and its third leg is named in
`budgetInvariants.test.js` as waiting.

### Phase 4, dynamic range, Group D (4)

**From the RF Lab overseer, phase 6:** the 1 dB compression point. Its 9.636 dB
offset from the input IP3 is a property of the cubic model rather than an
assumption, and it is measured there. `dynamicRange` is not written here. The
spurious-free range is `(2/3)(IIP3 − floor)` and the linear range is
`P1dB − floor`, and half of that pair does not exist yet.

### Phase 5, the link budget, Group E (4)

**From the Fields Lab overseer, group L:** antenna gain in dBi and the Friis
transmission equation, derived from the pattern. This lab uses them and cites
them, and until that group ships both gains would be numbers in a term panel
with no derivation to point at. `link.js` is not written. Nothing else in this
phase is blocked, so it is the cheapest phase to unblock.

### Phase 6, power and the design task, Group F (3)

**From the Electronics Lab overseer, M6:** the efficiency ceiling of a linear
stage, which is F1's argument seen from one stage. **From the RF Lab overseer,
group H:** Leeson's phase-noise model with its label intact, for F2's
reciprocal mixing. The power total itself is built, and a block with no stated
power already reads as unknown rather than as zero.

## 4. `packages/rf` is the RF Lab overseer's package

Decision 3 of the plan puts `budget.js` in `@ee-labs/rf` rather than in a package
of its own. The RF Lab's groups F and G and this lab's groups B to D are the
same formulas. This sitting added `src/budget.js`, its two test
files and two paragraphs in `index.js`. It changed no file the RF Lab's first
sitting wrote.

**What the RF Lab overseer should know.** `budget.js` states its own scope class
list at the top, object by object, as `index.js` requires. The cascade of noise
figures, the level walk and the noise floor are exact. The cascaded input IP3 is
the aligned-phase worst case, and `cascade` returns the power-addition total
beside it so the worst case is never quoted alone. A block that does not state
its DC power reads as unknown, and a chain holding one has no power total.

**What this lab asks for.** That the RF Lab's groups F and G use `cascadeNF` and
`cascadeIIP3` rather than writing the formulas again, and that the two labs'
cascade is pinned equal on one chain in `packages/rf`. Two copies would drift,
which is the whole of Decision 3.

**One conflict the director will meet at merge.** Both branches change
`packages/rf/index.js`, and both changes are additions. This branch appends the
`budget.js` export block at the end of the file and extends the EXACT paragraph
of the header comment with the cascade, the level walk and the noise floor. The
RF Lab appends its `match.js` export block at the same end of the same file and
extends the same paragraph with the L network and the quarter-wave transformer.

So the two sides touch the same two places for two different reasons, and git
will not resolve them. **Both export blocks and both sentences belong in the
merged file**, and nothing on either side is meant to replace the other. The
branch removes nothing from `index.js`, and no other file in `packages/rf` that
the RF Lab wrote was touched here.

## 5. The budget table, if a second lab wants it

`PROGRAM.md` §4 says a new canvas goes into `packages/ui` when a second lab
needs it, and carries that lab's needs in its props from the start. The budget
table is in the app for now, in `src/components/panes.jsx`, because no second
lab has claimed it. The plan's §4.2 names the Applied Analog Lab's
specification pane as its nearest relative and names that claim as the trigger.

The table already takes its props as data rather than reading the engine.
`view.js`'s `tablePropsFor` returns `{ columns, rows, totals, shareTotals,
caption }`, and the pane draws what it is given. Each entry of `columns` carries
a `unit` and a `title` for the cumulative mode, and a `shareUnit` and a
`shareTitle` for the share mode. The switch changes the cells, the unit over
them and the sentence that says what they hold, so all four travel together.
`TABLE_MODES` is the switch itself. Promotion is a file move and an export,
not a rewrite.

## 6. Nothing else

This lab needs no new element in `packages/network`, no change to
`packages/ui`'s existing components, and no experiment from another lab for the
group it has built. Group A leans only on Signal Lab, which is built and
released.
