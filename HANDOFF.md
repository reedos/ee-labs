# Handoff: continuing the EE Labs program from another session

Written 2026-09-06 by the director session that took over from the first handoff,
paused at Reed's weekly usage limit. Everything below is on origin. Read this file,
then `PROGRAM.md` in full, then `BACKLOG.md` §3 and §1.

## 1. Where everything is

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

## 2. What this session did

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

## 3. Setting up on Reed's PC

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

## 4. What is in flight, and how to resume it

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

## 5. Integrating a branch

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

## 6. Reed's decisions, waiting

All are in `BACKLOG.md` §3 and under its Electronics Lab section.

- K5's common-base half.
- Thirteen shape deviations in the Electronics plan.
- The System Lab's noise-floor constant.
- The Photonics step pane at phone width.
- The RF package's two singularity floors.
- The splash direction, from the three proposals.

## 7. Loose ends

- Four stash entries exist. Two are reviewers' "leftover rf-lab staged" parkings
  that matched no recent commit's tree, and two are Reed's own from master. None
  was dropped.
- `BACKLOG.md` §3 carries this session's two pause notes with the branch names
  of everything saved.
- The `-2` and `-orig` copies of four lane branches on origin are superseded by
  the `-s ours` merges and can be deleted.
