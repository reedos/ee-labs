# System Lab: build brief

You are one of up to six agents building this lab. The plan is
`/SYSTEM_LAB_PLAN.md`, and this brief turns it into lanes an agent can take
without colliding with another. Read the plan's §2 (the engine), §4 (the app)
and §5 (the curriculum) for your lane before writing a line. Reed reviews
everything.

Phase 1 is built. Group A ships, `packages/rf/src/budget.js` is fuzzed green,
and the app deploys dark. Phases 2 to 6 wait on work in other labs, and §7 names
what each one waits on and who owns it.

## Boundaries: read first

- **One lane per agent, one worktree per agent.** Never work in the shared
  checkout.
- **Edit only the files your lane owns** (§2). Everything else is read-only. A
  change you need outside your lane goes into `apps/system-lab/NEEDS.md` under
  your lane's heading, and the owning lane picks it up.
- **Stage by path.** `git add packages/rf/src/link.js`, never `git add -A` and
  never `commit -a`.
- **Never push.** Reed pushes.
- `packages/rf` belongs to the RF Lab's overseer. This lab adds files to it
  under `SYSTEM_LAB_PLAN.md` Decision 3 and changes none of that lab's own.
- **Preview port.** 4182, which `vite.config.js` fixes with `strictPort`.

## The house discipline (non-negotiable)

Read `/CORE_SCOPE.md`, `/STYLE.md` and `/REVIEW_PLAYBOOK.md` first. Then the
rule every lab obeys: **every explanatory sentence is a claim about physics, and
a test must measure it.** A lesson quotes no number the engine does not produce.
A prediction follows every control that can change it. On-screen text passes
`npm run lint:prose`.

The rule that bites hardest here is the second one. Every number in this lab is
a sum or a ratio, so a figure typed into a note reads exactly like a figure the
engine computed. `experiments.test.js` closes that gap. Each step's `set` is
applied over the defaults and the chain is solved at those settings. Every
number-with-unit in the sentence then has to be one of the step's readings or
one of the knob values. A figure that is neither fails the suite.

Commit messages are narrative: what changed, why, and what fell out. Read
`git log` for the register. Never put a model name in a commit or a file.

## 1. The numbers, computed before they are written

`apps/system-lab/scripts/pins.mjs` computes every figure this brief and the plan
quote. Run it before quoting anything.

```
node apps/system-lab/scripts/pins.mjs
```

The reference chain is the plan's §4.3, six blocks, and every passive block's
noise figure is computed from its loss rather than typed. Its output, as the
lanes need it:

| Quantity | Value |
| --- | --- |
| `k T_0` at 290 K | −173.975 dBm/Hz |
| the floor over 200 kHz | −120.965 dBm |
| the floor over 20.00 MHz | −100.965 dBm |
| cumulative gain, node by node | −2.0000, 13.000, 11.000, 19.000, 16.000, 38.000 dB |
| the same as a power ratio | 6309.57 |
| cascaded noise figure | 4.66629 dB |
| cumulative noise figure, node by node | 2.0000, 3.5000, 3.5565, 4.2972, 4.3174, 4.6663 dB |
| cascaded input IP3, aligned phase | −8.04442 dBm |
| the same by power addition | −6.50390 dBm |
| output IP3 | 29.9556 dBm |
| total DC power | 138.0 mW |
| noise shares | 30.33, 33.91, 1.520, 21.87, 0.6497, 11.72 % |
| IP3 shares | 0, 31.30, 0, 62.45, 0, 6.245 % |
| power shares | 0, 23.91, 0, 32.61, 0, 43.48 % |
| the ratio at −80 dBm over 200 kHz, in and out | 40.9649 dB and 36.2986 dB |
| the block with the least backoff | the mixer, at 74.0000 dB |
| a 2 dB filter at 290, 150, 77, 20 and 4 K | 2.00000, 1.14788, 0.626945, 0.171742, 0.0348961 dB |
| the amplifier moved in front of the filter | 3.26480 dB, a gain of 1.40149 dB |
| its input IP3 there | −8.77455 dBm, a loss of 0.7301 dB |
| the amplifier at 25.0 dB | 3.63177 dB, better by 1.03452 dB |
| its input IP3 there | −16.6074 dBm, worse by 8.563 dB |
| sensitivity at 10 dB over 200 kHz | −106.299 dBm |

The three budgets are dominated by three different blocks. The preselect filter
and the amplifier share the noise, the mixer takes the linearity, and the IF
amplifier takes the power. That is the lab's central lesson, and every group
after A is a way of reading it.

## 2. The lanes

| Lane | Work | Owns | Starts | Exit |
| --- | --- | --- | --- | --- |
| 1 | The chain and the table | `packages/rf/src/budget.js` and its two tests, everything in `apps/system-lab/` not owned below, `groups/a.js`, `lessons/a.js` | done | invariants 1, 2, 3, 4, 7 and 9 green, A1 to A4 pinned, the app dark |
| 2 | Noise | `packages/rf/src/noise.js`, `groups/b.js`, `lessons/b.js`, `components/CascadeCanvas.jsx` | RF phase 5 | invariants 4 and 5 green, B2's six shares pinned |
| 3 | Linearity | `packages/rf/src/linearity.js` extended, `groups/c.js`, `lessons/c.js`, `components/TwoSlopeCanvas.jsx` | RF phase 5 | invariants 6 and 7 green, C5's guard tested at both thresholds |
| 4 | Dynamic range | `packages/rf/src/budget.js` gains `dynamicRange`, `groups/d.js`, `lessons/d.js` | RF phase 6 | invariant 8 green, D3's two-thirds ratio pinned |
| 5 | The link | `packages/rf/src/link.js` and its test, `groups/e.js`, `lessons/e.js`, `components/WaterfallCanvas.jsx` | Fields group L | invariants 10 and 11 green, all four worked links pinned |
| 6 | Power and the design task | `groups/f.js`, `lessons/f.js`, `components/PowerPie.jsx` | Electronics M6 | F1's shares pinned, F3 shown to have a valid answer |

Every lane adds its terms to `src/terms.js` and its group heading is already in
`experiments.js`'s `ALL_GROUPS`. A group with no experiments in it contributes no
heading, so a reader never meets a tab with nothing under it, and
`experiments.test.js` holds that.

## 3. The app, as lane 1 left it

```
apps/system-lab/
  index.html  package.json  vite.config.js  RELEASE_STATUS (dark)
  AGENT_BRIEF.md  NEEDS.md  scripts/pins.mjs  scripts/verify.mjs
  src/App.jsx  main.jsx  styles.css
  src/experiments.js      merges groups/*.js in plan order, no prose
  src/lessons.js          merges lessons/*.js, and readQuantity's path list
  src/groups/a.js         the chains, the knobs, the headline. Built
  src/lessons/a.js        the see / try / why registers. Built
  src/terms.js            eleven definitions, and the pattern that finds each word
  src/knobs.js            the knob shapes every group builds from
  src/math.js             analyse(exp, p), the only caller of the engine
  src/view.js             the props each pane takes, computed from the analysis
  src/format.js           every number a reader sees comes through here
  src/report.js           the issue link's summary
  src/components/panes.jsx  FlowStrip, TablePane, LevelsPane, NumbersPane
  src/experiments.test.js  prose.test.js  terms.test.js  release.test.js
  src/App.smoke.test.jsx
```

Three views ship. `table` is the lab's signature, rows are blocks and columns
are budgets, with a switch from the cumulative value to that block's share.
`levels` is the signal and the noise on one decibel axis with the numbers under
it. `numbers` is every closed form the experiment used with the formula beside
it. A lane that adds a view adds it to `VIEW_ORDER` and `VIEW_LABELS` in
`experiments.js`, and to `PANE_OF` in `App.jsx`.

The flow strip sits above every view rather than inside one, because the chain is
what the lab is about.

## 4. Contracts

Every signature below is a promise between lanes. A lane may add to a return
shape, never rename or remove. Each ships with the failing test named beside it,
written before the implementation.

### 4.1 The block record (lane 1, built, in `packages/rf/src/budget.js`)

```js
blockOf({ id, name, kind, gainDb, nfDb, iip3Dbm, powerMw, tempK, fromCircuit, linksTo })
// -> { ...the above, passive }
```

`kind` in `PASSIVE_KINDS` makes the block passive. A passive block's `nfDb` is
computed from its loss and `tempK` when it is not given, its `iip3Dbm` defaults
to `Infinity`, and its `powerMw` to 0. An active block's unstated `powerMw` is
`null`, which reads as unknown and is never totalled as zero. A passive block
with gain above zero is refused by name. Tested in `budget.test.js`, "the block
record".

### 4.2 The walk (lane 1, built)

```js
cascade(blocks)
// -> { n, blocks: [{ ...block, index, gainBeforeDb, cumGainDb, cumNfDb,
//                    cumIip3Dbm, fTerm, ip3Term, noiseShare, ip3Share, powerShare }],
//      gain, gainDb, f, excess, nfDb, iip3Dbm, iip3PowerDbm, oip3Dbm,
//      powerMw, unknownPower, rule }

combine(a, b)   // the same numbers by the closed form, for invariants 1 and 2
levels(blocks, { pinDbm, bandwidthHz, tempK })
// -> { cascade, pinDbm, bandwidthHz, tempK, floorDbm, snrInDb, snrOutDb,
//      nodes: [{ index, id, name, cumGainDb, cumNfDb, signalDbm, noiseDbm,
//                snrDb, driveDbm, backoffDb }], limits }
bypass(blocks, id)          reorder(blocks, first, second)
passiveNf(lossDb, tempK)    noiseFloorDbm(bandwidthHz, nfDb, tempK)
```

`rule` is `'aligned'`, and `iip3PowerDbm` is the same products added as powers.
The worst case is never returned alone. Tested in `budgetInvariants.test.js`,
invariants 1, 2, 3, 4, 7 and 9.

### 4.3 What lanes 2 to 6 add

```js
// lane 4, into budget.js
dynamicRange(blocks, { bandwidthHz, snrReqDb })
// -> { floorDbm, sensitivityDbm, sfdrDb, linearDb, p1dbInDbm, bandwidthHz }

// lane 5, packages/rf/src/link.js
freeSpaceLossDb({ distanceM, frequencyHz })
farFieldM({ apertureM, frequencyHz })
link({ ptDbm, gtDbi, grDbi, distanceM, frequencyHz, losses, nfDb, bandwidthHz, bitRate })
// -> { items: [{ name, db, modelled }], prxDbm, floorDbm, snrDb, cn0DbHz,
//      ebn0Db, marginDb, farFieldM, ok }
```

`items` carries every line item, including the ones set to zero. `modelled` is
false for rain, multipath and pointing, so the waterfall draws a zero-height bar
with its name and nothing leaves by being forgotten. That is the plan's §2.2,
and it is content rather than a caveat.

## 5. The lesson schema, and the quantity paths

An experiment entry is `{ id, group, kind, name, terms, params, chain, input,
view, views, headline }`. `chain(p)` returns the block records at the knob
values. `input(p)` returns `{ pinDbm, bandwidthHz }` and defaults to Group A's
`REFERENCE_INPUT`. `headline(x, p)` returns `{ value, unit, label }`.

The lesson is `{ see, seeReads, try: [{ say, set, reads }], why, whyReads,
whyAt }`, with `see` ≤ 70 words, each `say` ≤ 45 and `why` ≤ 160.

Paths a `reads` pair may name, resolved by `readQuantity` in `lessons.js`:

```
total.<gainDb|gain|nfDb|f|excess|iip3Dbm|iip3PowerDbm|oip3Dbm|powerMw|n>
cum.<k>.<gain|nf|iip3>          the running totals after block k, one-based
block.<id>.<gainDb|nfDb|iip3Dbm|powerMw|tempK>
share.<id>.<noise|ip3|power>    that block's share of one budget
level.<k>.<signal|noise|snr|drive>   the node after block k, with 0 the input
floor.<dbm|bandwidth>           the noise floor, and what it is counted over
snr.<in|out>                    the ratio at the two ends
limits.<backoffDb|id|name>      how far the nearest block is from its own IP3
headline
```

A path that names something the analysis does not carry throws, so a lesson
cannot quietly read `undefined` and pass. A lane that adds a quantity adds its
path here and to `readQuantity`'s switch.

## 6. The library chains

The reference chain is `referenceChain(p)` in `src/groups/a.js`, and every group
after A uses it rather than writing its own. Block ids are fixed, because a
`reads` path names one.

```js
[{ id: 'presel', kind: 'filter', gainDb: -2,             tempK: p.tempK ?? 290 },
 { id: 'lna',    kind: 'lna',    gainDb: p.lnaGainDb ?? 15, nfDb: 1.5, iip3Dbm: -5, powerMw: 33 },
 { id: 'image',  kind: 'filter', gainDb: -2,             tempK: p.tempK ?? 290 },
 { id: 'mixer',  kind: 'mixer',  gainDb: p.mixerGainDb ?? 8, nfDb: 8, iip3Dbm: 5, powerMw: 45 },
 { id: 'iffilt', kind: 'filter', gainDb: -3,             tempK: p.tempK ?? 290 },
 { id: 'ifamp',  kind: 'amp',    gainDb: p.ifGainDb ?? 22, nfDb: 10, iip3Dbm: 20, powerMw: 60 }]
```

Group E adds an antenna and a channel to the front of it, and group D adds a
quantiser to the back. Neither replaces the six.

## 7. What each lane pins, and what it waits on

| Lane | Waits on | Pins |
| --- | --- | --- |
| 1 | nothing | 38.000 dB, 6309.57, the six cumulative gains, 2.0000 and 0.6269 dB at 290 K and 77 K, −120.965 dBm, 40.9649 dB and 36.2986 dB. Done |
| 2 | RF phase 5's noise sources; Electronics group O's density | 4.66629 dB, the six shares summing to 100 %, 3.26480 dB moved, 3.63177 dB at 25 dB gain, −106.299 dBm |
| 3 | RF phase 5's `linearity.js` and its drive guard | −8.04442 dBm, the three shares, −6.50390 dBm by power addition, −17.680 dBm of compression |
| 4 | RF phase 6's 1 dB compression point | 9.63574 dB of offset, −17.6802 dBm of compression, 72.1695 dB and 98.6184 dB over 200 kHz, 58.8361 dB and 78.6184 dB over 20.00 MHz, the two-thirds ratio |
| 5 | Fields group L's antenna gain and Friis | 80.0520 dB, −56.0520 dBm, 38.9129 dB, 18.9129 dB of margin, 205.106 dB, 111.923 dB-Hz |
| 6 | Electronics M6's efficiency ceiling; RF group H's Leeson pane | 138.0 mW, 43.48 %, 32.61 %, 23.91 %, −63.9897 dBc and −93.9897 dBm of reciprocal mixing |

The pins are functions of the six block records, recomputed in the test from the
knobs, never constants typed in. `apps/system-lab/NEEDS.md` §3 is the same list
written for the director, with the overseer named against each dependency.

**Two of the plan's figures do not survive the script, and lanes 4 to 6 use the
script's.** `SYSTEM_LAB_PLAN.md` §4.3 computed every link figure with
`k T_0 = −174 dBm/Hz` rather than the −173.975 its own §2.5 requires, so each
link's floor, ratio and margin there is 0.0251 dB out. The 100 m link's ratio is
38.9129 dB and not 38.938, its margin 18.9129 dB and not 18.938, and `C/N_0` is
111.923 dB-Hz and not 111.950. The 900 MHz link's stated margin of 29.457 dB
also assumes a required ratio of 12 dB, which the plan does not name. The script
states it, and `BACKLOG.md` carries both for the director.

## 8. Verify before every commit

```
npx vitest run apps/system-lab packages/rf --maxWorkers=4
npm run lint:prose
npm run build --workspace apps/system-lab
```

Run the scoped suite, not the whole monorepo, and always pass `--maxWorkers=4`,
because up to a dozen agents share the machine.

Then drive the page, which the suite cannot do:

```
npm run build --workspace apps/system-lab
npm run preview --workspace apps/system-lab     (serves dist/ on :4182)
npm run verify --workspace apps/system-lab      (in another shell)
```

`scripts/verify.mjs` makes all four of the plan's §7 checks in chromium at
1600 × 1000 and again at 390 × 844. It measures the page's own width against
the screen rather than asserting that a `min-width: 0` rule exists, which is
what the unit tests can reach. `vite preview` binds to localhost, and on Windows
that resolves to `::1`, so the script names the host rather than 127.0.0.1.
A lane that adds a view adds its selector to `VIEW_SHOWS` in that file.

Screenshot every view at 390 px and at 1280 × 900 as well, and read the
screenshots as a student would, per `/REVIEW_PLAYBOOK.md` §11. The harness
holds a claim that was written down. A picture is what finds the claim nobody
wrote.

## 9. Gotchas this lab has already paid for

- **The table is the hardest thing in the suite to fit on a phone.** Below
  900 px it transposes into one card per block, and every cell carries a
  `data-label` that the card layout draws in front of it. `App.smoke.test.jsx`
  holds both halves of that together.
- **A grid or flex item sizes from its content**, so one long row sets the whole
  track and the page widens. Every pane carries `min-width: 0`, and only the
  chain strip and the table scroll inside themselves. The smoke test counts the
  `overflow-x: auto` rules so a third one has to be argued for.
- **A share of zero over zero is not a share.** A chain of nothing but passive
  blocks has no third-order product at all, and `cascade` returns `Infinity`
  rather than a large number. The pane says so in words.
- **An unstated DC power is unknown, never zero.** A chain holding one has no
  power total, and `unknownPower` names the blocks.
- **Four or five significant figures, and never more.** Everything here is a sum
  or a ratio in decibels. `format.js` snaps a value far below its own scale to
  zero, so a share of 4e-17 does not print as a measurement.
- **Two of a block's three strip readings are in decibels**, and two of the
  levels view's three columns are in dBm, so a unit cannot tell them apart. Every
  such reading carries a name: `CHAIN_ROWS` tags the strip, `LEVEL_COLUMNS`
  names both traces and all three columns. A hover title is not a name, because
  a phone has no hover.
- **A header's unit follows the switch under it.** The share mode turns three of
  the four table columns into percentages, so `COLUMNS` carries `shareUnit`
  beside `unit` and the pane prints whichever the mode is in.
- **A test that fails may be the test.** Decide which, and say which in the
  commit. Two of the harness's own claims were wrong before the page was.
- **The dark launch is enforced by a test.** While `RELEASE_STATUS` says `dark`,
  nothing outside `apps/system-lab/` may mention the lab. The `cp` line for
  `deploy.yml` is the director's to add, and it lives in `NEEDS.md`.
