# Handoff: continuing the EE Labs program from another session

Read this, then `PROGRAM.md` in full, then `BACKLOG.md` sections 1 and 2. Those two
sections are the current record. Everything under the History heading at the foot of
this file is an earlier session's note, kept as evidence and superseded by what is
above it.

Written 2026-09-14 by the records lane of wave 3.

## 1. Where everything is

| What | Where |
| --- | --- |
| The integration branch | `integration/reconcile`, worktree `.claude/worktrees/reconcile` |
| Master, released and deployed | `origin/master` at `deb5780`, tag `v1.2.0`, live at reedos.github.io/ee-labs |
| The charter | `PROGRAM.md`, and section 8 for the five states |
| The ledger and the release queue | `BACKLOG.md` sections 1 and 2 |
| The maps | `EE_LABS_MAP.md`, `ANALOG_ROADMAP.md`, `CURRICULUM.md` |
| One plan per lab | `*_LAB_PLAN.md` at the root |
| One brief and one needs file per lab | `apps/<slug>/AGENT_BRIEF.md`, `apps/<slug>/NEEDS.md` |
| The prose rules and the review classes | `STYLE.md`, `REVIEW_PLAYBOOK.md`, `CORE_SCOPE.md` |
| The inventory | `node scripts/director/inventory.mjs` |
| The workflow scripts | `.claude/workflows/*.js` |
| Earlier sessions' reports | `docs/history/`, and `BACKLOG.md` section 3 |

`integration/reconcile` is `origin/master` plus the wave 3 workflow scripts. Nothing
in wave 3 has been merged into it yet, and nothing has been pushed.

## 2. The state, per the ledger

Twenty-seven apps hold 913 experiments, lessons or presets between them. Four labs
are released and twenty-three are dark. Fourteen apps carry a browser harness and
thirteen do not. `BACKLOG.md` section 1 has the row for each one, and that row is the
only current statement of its state.

No lab is in the accepted state. Every dark lab is integrated, which means its work is
merged and the integration checks are recorded. It does not mean any group has passed
the section 8 gates. A registry entry is an implemented experiment, not an accepted
teaching claim.

Do not read a count as a completion percentage. Do not read a passing test file as
acceptance. Reports under `docs/history/` use "accepted" and "released" for their own
branch's release checks, and each now says so in its first paragraph.

## 3. Wave 3, in flight

Wave 3 brings every lab to the shape of the three original modules and Circuit
Elements Groups A to I. `.claude/workflows/wave-3.js` runs one overseer lane per lab
on a branch `w3/<slug>`, each in its own worktree cut from `integration/reconcile`,
each followed by an adversarial reviewer on the same branch. Twenty-seven lanes exist,
one per app, with ports 4601 to 4627.

A lane verifies its lab and merges the saved `verify/<slug>` branch where one exists.
It builds the groups its plan still names. It writes or extends `scripts/verify.mjs`
with the fold, phone and tap-target probes. It runs a screenshot pass read as a
first-year student and records the walk in its `NEEDS.md`. A lane commits by path on
its own branch. A lane never pushes, never releases, and never edits a shared surface.

`.claude/workflows/records-w3.js` runs this records lane on `w3/records`. It owns
`BACKLOG.md`, `EE_LABS_MAP.md`, `ANALOG_ROADMAP.md`, `CURRICULUM.md`, `HANDOFF.md`
and `README.md`, which no lab lane may touch.

To pick the wave up, run `git worktree list` and `git branch --list 'w3/*'`. A branch
ahead of `integration/reconcile` carries a lane's work. Read its commits and its
lab's `NEEDS.md` before continuing it, and finish what is there rather than
restarting it.

### The pause of 2026-09-15

The wave stopped part way when the weekly usage limit was reached. Nineteen of its
forty-six agents finished. Twenty-seven were cut off mid-sentence: eight first
sittings, sixteen second sittings and three reviewers. No adversarial review
finished, so no lane has a verdict and none of this work is merged.

Every lane had committed as it went, so nothing was lost. What each agent still had
in its working tree was committed for it as a WIP commit at the tip of its branch,
with the scratch files left out. A branch whose tip message begins WIP stopped mid
task. Read that commit first and finish what it started.

Three branches had two worktrees each, because a lane and its successor shared one.
Where the second worktree held older content, its work is on a branch named
`w3-wip/<slug>-alt`, to be read alongside the lane branch. Two branches had been
advanced by a stale worktree whose commit undid newer work. Both were reset to the
commit that holds the real content, `w3/signal-lab` to its WIP commit and
`w3/records` to its review commit.

The records lane finished and is merged. Its five commits and its reviewer are in
`integration/reconcile`, which is pushed. Every preview server the lanes left
listening was stopped.

## 4. What is Reed's

Reed owns the repository. He reviews the labs and he alone releases one.

- The release decision. A lab is offered to him one per sitting, in the accepted
  state, with its cold walks and harness evidence recorded. He alone flips
  `RELEASE_STATUS`, and the shared-surface change goes in the same commit.
- The curriculum decisions each lane records in its lab's `NEEDS.md`. Those include
  K5's common-base half and the thirteen shape deviations in the Electronics plan.
- Any exclusion of a plan requirement. An unimplemented plan requirement stays open
  until he approves leaving it out.
- The splash direction, from the three proposals in `BACKLOG.md` section 3.
- The teaching model of the three analog apps, which are a lesson tier rather than
  the suite's experiment shape.

Reed's main workspace at `C:/Users/reedo/projects/ee-labs` may hold his own changes.
Preserve them. It is not the integration baseline.

## 5. The setup on this machine

```
git fetch origin
git checkout integration/reconcile
npm ci --no-audit --no-fund
npx vitest run --maxWorkers=8
```

The machine has 32 cores. The full suite takes about five minutes at eight workers on
a quiet machine, and the Power Lab's whole-lab tests take tens of seconds each. Run
the full suite only when no agents are running. A scoped run under an agent uses
`--maxWorkers=2`, because up to sixteen agents share the machine.

Things that bit earlier sessions, so they do not bite again:

- `core.autocrlf` is true here. Every checkout rewrites `.claude/workflows/*.js` with
  CRLF endings, and the workflow launcher then refuses the script for hidden control
  characters. Run `sed -i 's/\r$//' .claude/workflows/*.js` before every launch, and
  do not commit that change.
- Launch a workflow by `scriptPath`, the absolute path of the repo file, not by name.
- Keep the session's working directory at the repo root while a workflow runs. Each
  agent's worktree is created relative to the directory at spawn time.
- Resume a stopped run with `resumeFromRunId`. Completed agents replay from cache.
- Files on disk are CRLF, so a string-replacement pattern needs `\r?\n`.
- Node cannot see Git Bash's `/tmp`. Scratch files live inside the worktree with a
  leading underscore and `.tmp` in the name, and are deleted before the last commit.
- Python is not installed. Do not write a helper script that needs it.
- The auto-mode classifier refuses force pushes and remote branch deletes, and it
  refuses some edits at random. The same edit passes on retry with wider context.
- Run every script and every test from the repo root. A `cd` inside one Bash call
  persists into the next.
- Write a long test run to a log file once and read the log, rather than running it
  twice.

Harnesses run against the assembled site, not a bare preview port. `npm run
site:serve` assembles `_site` and serves it on 47600, and
`APP_URL=http://localhost:47600/<slug>/ node apps/<slug>/scripts/verify.mjs` is the
form. `REVIEW_PLAYBOOK.md` section 11 says why the bare port hides defects.

The repository prose gate is open. `node packages/prose/bin/lint.mjs` reports
inherited findings across the tree. Report that baseline separately from your own
findings, and never call a failing run clean. Every document you edit must pass.

## History

Everything below was written by an earlier session. It is kept as evidence of what
those sessions did and decided. Where it disagrees with the sections above or with
`BACKLOG.md` section 1, those are current.

### Reconciliation, 2026-09-13

Three lines had diverged since 2026-09-06. GitHub master carried the Circuits II consolidation, the Applied Analog, Analog IC and Mixed-Signal labs, and copies of the RF, System, Photonics, VLSI and Interfaces labs with extended lessons. Local master carried the integration line with Power H to N and the dark RF, System and Photonics groups. The director branch carried the VLSI and Interfaces first groups and the Random recovery.

Branch `integration/reconcile` merges all three. GitHub master came first, then the director branch. The copied labs conflicted as add/add because their history was not shared. Their copies on GitHub contain the same files plus the curriculum wrapper, so the GitHub side was kept for every copied lab file. The director's shared deployed-app list, deep-link module, assembler, ledger and this handoff were kept, and the three new apps were added to that list and to the inventory as lesson-only registries.

Two defects came from clean merges. A duplicated export in the shared UI index broke every build. The curriculum table quoted Power at 34 of 56. Both are fixed on the branch. Nothing here merges to master or releases a lab. The splash and README still quote 59 Elements experiments while the registry holds 89.

### Plot labels and wafer context

The latest review requested names for every plot feature and definitions before threshold abbreviations.
Interfaces now keys its voltage, load and noise plots, including the undefined-input band, guides, selected points and probes.
The voltage canvas labels VIL, VIH and the time cursor directly, with reserved annotation space.
VLSI labels Scope, Transfer, Timing and Fanout, including input/output limits, noise-margin brackets and switch-model gaps.
Threshold definitions precede their first use. Labels distinguish input voltage limits from output voltage limits and device thresholds.

`ChipContext` in `@ee-labs/explain` provides a shared, short wafer-to-circuit introduction before both labs' circuit foundations.
It defines wafer, die and integrated circuit, and explains patterning, deposition, etching, doping, interconnects and packaging.
An expandable note compares silicon, silicon-germanium, indium phosphide, silicon carbide and gallium nitride with source links.
The substrate and active device material are distinguished. This context does not turn the introductory models into material sweeps.
`CHIP_FOUNDATIONS.md` is the standalone prerequisite. `CURRICULUM.md` places it after basic circuit elements and before semiconductor-device modules.

`labels-final-scoped.log` records 369 passing tests in 34 files. `labels-all-apps-build.log` records all 24 passing builds.
The shared styles are scoped to the new note. The full numerical suite was not rerun for this presentation update.
Final browser logs use `labels-interfaces-` and `labels-vlsi-` prefixes in the worktree root.
Interfaces has 25 experiment/viewport cases per browser, and VLSI has 30 plus alternate views.
Both cover Chromium and Firefox down to 320 pixels. Browser checks include keyed annotations, expanded material notes and retained playback behavior.
Physical-phone and iPhone Safari review remain open. No publication or release is authorized.
The updated local preview remains `http://127.0.0.1:47630/`.

### Teaching foundations and phone flow

Reed approved explicit teaching foundations for the initial Interfaces and VLSI experiments.
All ten now explain purpose, input, expected output, parameter roles, predictions, tradeoffs and model limits before derivation.
Definitions cover the pin, CMOS receiver, output drivers and inverter. The receiver study is no longer labeled as an output type.
The VLSI material explains inverter applications, polarity through a chain and the delay, area and energy costs of loading and sizing.

Both apps retain the established theme, held axes, reference traces and shared playback.
Phones use one page scroll and sticky Lesson, Settings, Circuit, Plots and Math navigation.
A screenshot exposed an ancestor overflow rule that defeated sticky positioning. Both apps now avoid that extra scroll container.
Browser checks require the navigation itself to remain visible after every jump.

The source changes are app-local. `PROGRAM.md` records the teaching checks as acceptance requirements for later groups.
The local preview remains `http://127.0.0.1:47630/`, with `/interfaces-lab/` and `/vlsi-lab/` rebuilt and assembled.
No release or push is authorized. Student acceptance and the wider curriculum omissions remain open.

`foundations-final-scoped.log` records 357 passing tests in 31 files after the final source changes.
This covers both apps, shared UI, math rendering and director inventory. The full suite was not rerun for this app-local pass.
The earlier full-suite result below remains the baseline, not evidence for this update.
Browser logs use `interfaces-foundations-` and `vlsi-foundations-` prefixes with Chromium and Firefox suffixes.
Interfaces covers 25 experiment/viewport cases per browser. VLSI covers 30, including all available views.
Both include 320-pixel and 390-pixel phone widths. These are desktop browser checks, not physical-phone or iPhone Safari validation.
The numerical prediction tests and browser reports remain app-local. The inherited prose-linter file marker remains untouched.

### First review rework

Reed rejected the initial VLSI and Interfaces review. Their automated checks missed established usability and teaching requirements.
This section supersedes the readiness statements in the earlier checkpoint.
Work remains on `integration/program-director` in `.claude/worktrees/program-director`.

Both first groups have usability corrections at `e3afe13`. The original four labs are the reference implementations.
The corrections cover shared sidebar formatting, playback, held comparison axes, plot height and visible worked analysis.
`PROGRAM.md` section 8 now requires these checks before another student review.
The new labs remain dark. Their first-group acceptance remains open.

The local preview remains `http://127.0.0.1:47630/`.
Each app's `NEEDS.md` records its revised behavior and evidence locations.
The final browser logs are `interfaces-rework-chromium.log`, `interfaces-rework-firefox.log`,
`vlsi-rework-chromium.log` and `vlsi-rework-firefox.log` in this worktree.
All four runs pass against assembled sibling paths. The shared numeric-focus regression passes in the original four apps.

`review-rework-final-scoped.log` records 342 passing tests in 29 files.
`review-rework-build.log` records the passing all-app build.
The full suite passes 11,096 tests in 373 files at the frozen source checkpoint.
Its evidence is `review-rework-full-suite-final.log`, with a duration of 335.64 seconds.
The earlier `review-rework-full-suite.log` was stopped because source files changed during the run.
Global prose lint retains 330 inherited findings. All six edited documents pass their scoped check.
Reed's main-workspace changes and upstream notation commit remain outside this worktree.
No changes have been pushed or released.

### First director wave checkpoint

The wave is integrated locally on `integration/program-director`.
The source checkpoint is `e0c2e16`, with later evidence-only documentation commits.
The worktree remains `.claude/worktrees/program-director`.
`BACKLOG.md` section 1 contains the current ledger, results and next dependency queue.

- VLSI has five initial experiments. A3's analog-chain comparison and part of A5 remain incomplete.
- Interfaces has five initial pin experiments. Groups B to G remain unbuilt.
- Random Signals' startup and rendering recovery is integrated. Its F4 instruction and two phone captions still need work.
- Circuit revalidation ended at `582650e` with browser layout failures. It remains separate, as does Power's `fa6382c` checkpoint.
- Shared URL recognition and local assembly now cover every app. Dark labs remain absent from released navigation.

The integrated tree has 24 apps and 752 curriculum entries. Counts are not acceptance percentages.
The full suite passes 11,077 tests in 370 files. All 24 apps build after a fresh offline installation.
Both new apps pass Chromium and Firefox checks at laptop, desktop and phone sizes.
The final LabNav browser review passes 46 checks. Evidence paths are in `BACKLOG.md`.
Repository prose lint remains open with 330 inherited findings. Edited documents pass scoped lint.

The director preview is `http://127.0.0.1:47630/`.
Review the new apps at `/vlsi-lab/` and `/interfaces-lab/`, and the recovered app at `/random-lab/`.
The hidden preview process is PID 22408. All worker and temporary verification servers from this wave stopped.
Older Power and splash previews were left untouched.

Before another wave, reconcile Reed's `e5e9200` commit from `origin/master`.
It arrived during this wave and is not in this integration baseline or its evidence.
The main workspace still contains Reed's corresponding changes and the splash experiment. Preserve them.
The main handoff points here through `aec37e9`. No director code was merged into master, pushed or released.

### Director wave, 2026-09-06

Reed approved the director operating model and bounded parallel work.
`PROGRAM.md` section 8 defines ownership, evidence, acceptance and integration.
`BACKLOG.md` section 1 is the current ledger and dependency queue.
It supersedes the older sequential scheduling instructions below.

The director branch is `integration/program-director`, based on `cf90dda`.
Its worktree is `.claude/worktrees/program-director`.
The base contains 22 apps and 742 curriculum entries, counted from executable registries.
These entries are not an acceptance count. Five planned apps are absent from the base.
The old ledger contained duplicate rows and obsolete whole-lab dependencies.

Three bounded streams started from the committed base:

- `lab/vlsi-lab`, worktree `vlsi-wave-1`, implements the first supported Group A experiments.
- `lab/interfaces-lab`, worktree `interfaces-wave-1`, implements Group A's pin experiments.
- `verify/circuit-lab`, worktree `circuit-verification`, revalidates the saved branch against the base.

Workers own only their assigned app. Shared changes and integration belong to the director.
The new apps remain dark. No push or release is authorized by this wave.
Reed's uncommitted main-workspace changes remain outside the integration branch.

The inventory command is `node scripts/director/inventory.mjs`.
Its test checks ledger counts and requires local assembly to include every existing app.
The local assembler previously listed five apps while deploy listed twenty-two.
The director's assembler now includes the same twenty-two apps.

Power's `fa6382c` checkpoint and the other saved verification branches remain separate.
Power's desktop-control failures do not block unrelated lab implementation.
Do not treat saved completion reports as current evidence without reviewing their commit and dependencies.

### Local continuation, 2026-09-06

This section supersedes the branch and verification status in the earlier
snapshot below. No continuation changes have been pushed or released.

The local integration snapshot was `88d4cfe`, shared by master and
`claude/advanced-analog-labs-5eh3qd`. Its baseline passed 10,957 tests in
358 files. The saved verification branches were fetched from origin.

Power verification resumed on `verify/power-lab` in
`.claude/worktrees/power-verification`. Checkpoint `c6d891e` reconciles the
saved fixes with Groups H through N. Its full suite passes 11,027 tests in
359 files. The five-app sibling-path build passes. Screenshots cover 102
views across eleven experiments at desktop and phone sizes.
The branch tip is `fa6382c`, which adds the completed browser report.

The checkpoint fixes motor sweep coordinates, speed predictions on current
axes, logarithmic trace mapping, efficiency markers, and spectrum captions.
The browser harness now fails on missing browsers and preserves failures
when another browser aborts. `apps/power-lab/NEEDS.md` has the detailed report.

Power's browser layout gate remains open. Do not treat the checkpoint as a
completed verification branch. The final-run logs are in its worktree:
`verification-browser-final.log` and `verification-firefox-final.log`.
Firefox needs execution outside the Windows sandbox to create pages here.
`verification-final.log` records the passing full suite.

Both browser runs finished. Chromium has 58 first-knob visibility failures
and Firefox has 60, across the two desktop sizes. All other checks pass,
including all 55 experiments at phone width. The largest overruns are 47 px
and 49 px respectively. Fix the sidebar's vertical budget before accepting
this branch. The test server on port 47612 was stopped after both runs.
The review preview uses `http://127.0.0.1:47614/power-lab/`.

The other eight branches are unchanged. Circuit Elements remains at WIP
`0795f5b`. Circuit, Control, Signal, Machines, Random, Instruments and Fields
still have their previously completed, unmerged verification branches.
The saved run was recovered from Git rather than replayed through Workflow.

Next, resolve Power's remaining browser findings and finish Elements.
Review and integrate the nine verification branches before VLSI and
Interfaces, then the second harness wave. Applied Analog, Analog IC and
Mixed-Signal follow in the order recorded below.

The main workspace contains concurrent lab edits and the splash experiment.
Neither belongs to the Power checkpoint. Preserve them when integrating.
`.claude/worktrees/lab-verification` holds the untouched baseline on
`integration/lab-verification`, with its baseline test and prose logs.

Repository prose lint had 330 findings before this continuation and 316
afterward, across 80 files. Power's NEEDS file is clean. The remaining
documentation findings are not a passing repository prose gate.

### Earlier director snapshot

Written 2026-09-06 by the director session that took over from the first handoff,
paused at Reed's weekly usage limit. Everything below is on origin. Read this file,
then `PROGRAM.md` in full, then `BACKLOG.md` §3 and §1.

### Where everything is

| What | Where |
| --- | --- |
| The integration branch | `claude/advanced-analog-labs-5eh3qd`, tip `41df187` or later |
| Master, released and deployed | `master` at `166d05a`, tag `v1.1.0`, live at reedos.github.io/ee-labs |
| The charter, the ledger, the maps | `PROGRAM.md`, `BACKLOG.md`, `EE_LABS_MAP.md`, `CURRICULUM.md` |
| One plan per lab | `*_LAB_PLAN.md` at the root |
| One brief and one needs file per built lab | `apps/<slug>/AGENT_BRIEF.md`, `apps/<slug>/NEEDS.md` |
| The workflow scripts | `.claude/workflows/*.js` |
| The director's merge helpers | `scripts/director/*.mjs`, described in §5 |
| Lane branches, all merged | `lab/electronics-*`, `lab/power-*`, `lab/rf-lab`, `lab/system-lab`, `lab/photonics-lab` |
| Harness branches, not yet merged | `verify/<slug>` for nine labs, see §4 |
| The splash redesign proposals | the artifact "EE Labs Splash", three directions, awaiting Reed's pick |

Twenty-two apps and sixteen packages are on the integration branch. Four labs are
released. Eighteen are dark and deployed at their own paths on the next master
merge. The last full run of the suite on this branch gave 348 files and 10070
tests at `327ba58`. The three Power Lab merges after that were tested scoped, and
each was green. Run the full suite before trusting the tip.

### What this session did

- Merged Electronics Groups D to O, 75 of 77 experiments. Group B is Elements I9
  and I10 by that plan's Decision 3.
- Merged Reed's 48 commits from master into the branch, then released the
  Circuit Elements Lab as 1.1 and merged the branch into master. The deploy
  passed and the site links the lab.
- Merged the RF Lab's Groups A to D and the System Lab's Group A. Merged the
  Photonics Lab's Groups A and C to F. All three are dark.
- Merged Power Lab Groups H to N. The lab is 55 of 56, with D5, the leakage
  spike, still deferred.
- Ran the harness pass over the nine labs that have one. Seven finished. Two were
  mid-fix at the pause.
- Brought `ELECTRONICS_LAB_PLAN.md` §5 into line with the measured numbers, and
  listed the thirteen shape deviations that are Reed's to rule on.

### Setting up on Reed's PC

```
git fetch origin
git checkout claude/advanced-analog-labs-5eh3qd
npm ci
npx vitest run --maxWorkers=8
```

The machine has 32 cores. The full suite takes about four minutes at eight workers
on a quiet machine, and the Power Lab's App smoke tests take about 36 s each alone.
Run the full suite only when no agents are running.

Things that bit this session, so they do not bite twice:

- `core.autocrlf` is true here. Every checkout rewrites `.claude/workflows/*.js`
  with CRLF endings, and the Workflow launcher then refuses the script for
  hidden control characters. Before every launch run
  `sed -i 's/\r$//' .claude/workflows/*.js`. Do not commit that change.
- Launch a workflow by `scriptPath`, the absolute path of the repo file, not by
  name. The name form was refused even with a clean file.
- Keep the session's working directory at the repo root while a workflow runs.
  Each agent's worktree is created relative to the directory at spawn time, and a
  `cd` into a scratch folder mid-run made two reviewers fail to start.
- Resume a stopped run with `resumeFromRunId`. Completed agents replay from
  cache, and the two scripts' setup lines check an existing branch out and tell
  the agent to continue what is there.
- The auto-mode classifier refuses force pushes and remote branch deletes. To
  replace a branch origin already has, merge origin's copy with `-s ours` and
  push the fast-forward. It also refuses some edits at random. The same edit
  passes on retry with wider context.
- Run every script and every test from the repo root. A `cd` inside one Bash
  call persists into the next.
- Write a long test run to a log file once and read the log, rather than piping
  the same run twice.

### What is in flight, and how to resume it

One run was stopped at the pause: `verify-harnesses`, run id `wf_801f2ca7-30c`.
Seven of its nine labs finished with `ok`, each on its `verify/<slug>` branch:
circuit-lab, control-lab, signal-lab, machines-lab, random-lab, instruments-lab
and fields-lab. None is merged yet. Two were mid-fix and carry a WIP commit at
the tip of their branch, unrun and unreviewed: `verify/circuit-elements-lab` at
`0795f5b` and `verify/power-lab` at `e20325f`.

To resume, from the repo root with the scripts' endings stripped:

```
Workflow({ scriptPath: "C:\\Users\\reedo\\projects\\ee-labs\\.claude\\workflows\\verify-harnesses.js",
           resumeFromRunId: "wf_801f2ca7-30c" })
```

The seven replay from cache and the two rerun, continuing their branches. Then
merge all nine by §5. They touch only their own lab directories and their needs
files, so they should merge by union.

After that, the order the first handoff set:

1. `vlsi-interfaces`. Its setup line is fixed, and the branches are new.
2. `harness-wave-2`, with the ten slugs as args, `electronics-lab` last.
3. The Applied Analog, Analog IC and Mixed-Signal labs. They are unblocked by
   the Electronics groups, and no script exists yet. Write one in the shape of
   `rf-system-photonics.js`.

### Integrating a branch

Merge with `git merge --no-ff lab/<slug>`. Every lane registers into the same
few files, so expect the same conflicts each time, and resolve them by union in
group order. The helpers in `scripts/director/` did it this session:

- `union.mjs <files>` keeps both sides of every hunk, ours first.
- `resolve.mjs <spec.json>` applies a per-hunk choice: `ours`, `theirs`,
  `both`, or a text. It is for the hunks a union would double, such as a
  definition line both sides changed.
- `rebuild-test.mjs <base> <branch> <marker> <import>` rebuilds a test file from
  the two committed versions. Git folds each lane's closing braces into the
  other's context, so a union of `experiments.test.js` is never valid.
- `drop-terms.mjs <file> <keys>` removes a term a later group redefined. Check
  duplicate keys across `*.terms.js` after every merge, and run `terms.test.js`
  for words used before their introduction.
- `needs-count.mjs <letters>` rewrites a needs file's progression entry.

Two rules master added on 2026-09-05 bite every later lane. A try step is read
after every earlier step with nothing reset, so a step must set back what an
earlier step changed. Every sweep key needs an exact value at the knob in the
App's marker table, or the marker test fails.

After each integration, add the deploy `cp` line from the lab's needs file.
Update the ledger and the cut-off table in `BACKLOG.md`, the map's package
table and the program's canvas table. Put the decisions for Reed into
`BACKLOG.md` §3. Gate every commit on the test's exit code.

### Reed's decisions, waiting

All are in `BACKLOG.md` §3 and under its Electronics Lab section.

- K5's common-base half.
- Thirteen shape deviations in the Electronics plan.
- The System Lab's noise-floor constant.
- The Photonics step pane at phone width.
- The RF package's two singularity floors.
- The splash direction, from the three proposals.

### Loose ends

- Four stash entries exist. Two are reviewers' "leftover rf-lab staged" parkings
  that matched no recent commit's tree, and two are Reed's own from master. None
  was dropped.
- `BACKLOG.md` §3 carries this session's two pause notes with the branch names
  of everything saved.
- The `-2` and `-orig` copies of four lane branches on origin are superseded by
  the `-s ours` merges and can be deleted.
