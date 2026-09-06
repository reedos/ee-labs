# Handoff: continuing the EE Labs program from another session

Written 2026-09-05 for the session that takes over as director. The state below is
on origin, and nothing that matters is left in the container that wrote this.

## 1. Where everything is

| What | Where |
| --- | --- |
| The integration branch, 177 commits ahead of `master` | `claude/advanced-analog-labs-5eh3qd` |
| The charter, the ledger, the maps | `PROGRAM.md`, `BACKLOG.md`, `EE_LABS_MAP.md`, `CURRICULUM.md`, `ANALOG_ROADMAP.md` |
| One plan per lab, 25 of them | `*_LAB_PLAN.md` and `CONTROL_LAB_II_PLAN.md` at the root |
| One brief per built lab | `apps/<slug>/AGENT_BRIEF.md` |
| The workflow scripts for the work in flight | `.claude/workflows/*.js` |
| Partial work from the cut-off lanes | the six branches named in `BACKLOG.md` §3, all on origin |

Nineteen apps and fourteen packages are on the integration branch. Sixteen apps are
dark, three are released, and every app builds. The last full run of the suite gave
312 test files and 8961 tests with one failure, since fixed. Run it again before
trusting that. Nothing beyond the second pull request has been merged to `master`,
and merging is Reed's call.

## 2. Setting up

```
git fetch origin
git checkout claude/advanced-analog-labs-5eh3qd
npm ci
npx vitest run
npm run lint:prose
```

The suite takes a few minutes on a quiet machine. Two Elements experiment walks,
the Newton diode sweeps, exceed the 90 s timeout when the machine is loaded, so
run the full suite only when no agents are running.

Read `PROGRAM.md` in full before anything else. It is the charter every agent reads.
Then `BACKLOG.md` §3, the director's queue, and §1, the ledger.

## 3. The role

The session that continues is the director. The director owns `PROGRAM.md`,
`BACKLOG.md`, the maps, the shared surfaces (`site/`, `README.md`,
`packages/ui/src/LabNav.jsx`, `.github/workflows/deploy.yml`) and integration.
Overseers own one lab each and never touch a shared surface. Workers own one lane.

Reed's standing decisions, to keep:

- Overseers are Opus. Reed asked for that twice.
- Nothing loads measurements from real instruments. The roadmap's seventh tier is
  out.
- Every lab ships dark. Only Reed flips a `RELEASE_STATUS`, and only that commit
  touches the shared surfaces.
- No model names in files, apart from the commit trailer and the model tier a
  workflow script sets.

The commit trailer is the session's own. `PROGRAM.md` §2 says so.

## 4. What was in flight, and how to resume it

Five workflows of Opus agents were running when the account's session limit fell,
at 19:50 UTC on 2026-09-05. Every agent died inside its first hour. What each left
was committed on its branch and pushed. `BACKLOG.md` §3 has the table. It says which
script drives which branches, what is already on each branch, and the order to run
them.

Each script lives in `.claude/workflows/` and runs by name from Claude Code's
Workflow tool. The order:

1. `electronics-lanes`, args `["de","fg","hi"]`, then again with `["jk","lm","no"]`.
   Electronics is the critical path. Its groups gate the Applied Analog, Analog IC
   and Mixed-Signal labs, and the later phases of RF, System and Photonics.
2. `power-h-to-n`. Three lanes, each adding its groups in its own file with one
   registration line per table, so the three merge by union.
3. `rf-system-photonics`. RF's first sitting is already on `lab/rf-lab`, with the
   brief, the exact core and an untested Smith canvas. Photonics has its brief,
   package and first app files on `lab/photonics-lab`.
4. `verify-harnesses`, then `vlsi-interfaces`, then `harness-wave-2` with a list of
   slugs as args, `electronics-lab` last and only after its lanes have merged.

Every script's setup checks a lane branch out if it already exists and tells the
agent to read what is there and continue it. Every agent runs its tests in the
foreground with a long timeout, scoped to what it touched, with vitest throttled to
two workers. Raise that number if the machine has more than four cores.

Two things to change for a different machine:

- The two harness scripts name Chromium at `/opt/pw-browsers`, which was the
  container's path. On another machine the agents should use what Playwright has
  installed. Edit the sentence or tell them.
- Each script runs at most two agents at once, a cap the Workflow tool sets from
  the machine's cores. More cores give more lanes.

The session limit is the real constraint. Twenty agents spent about three million
tokens for six small commits. Run one or two workflows at a time, and stagger them,
so that a limit falls between waves rather than inside one.

## 5. Integrating a branch

The director integrates each branch a reviewer marks mergeable. The loop that
worked:

```
for c in $(git rev-list --reverse --right-only --cherry-pick HEAD...lab/<slug>); do
  git cherry-pick -x $c || break
done
```

The `--right-only --cherry-pick` form skips commits already applied under another
hash. On a conflict:

- `BACKLOG.md` and any `NEEDS.md`: keep both sides in full, the union.
- `package-lock.json`: take ours, then `npm install --package-lock-only`, then
  commit the result. A lockfile resolved by either side alone loses workspaces.
- `CURRICULUM.md`: take the branch's side, then re-run the progression test.
- One-line registrations in a lab's tables (Power Lab's `experiments.js`,
  `math.js`, `terms.js`, `analysis.js`, `packages/switched/index.js`): keep every
  lane's line, in group order.

After each integration:

1. Add the lab's `cp` line to `.github/workflows/deploy.yml` from its `NEEDS.md`.
   Dark means unlinked, not unbuilt, so the dark URL exists to review.
2. Add the lab's ids and counts to `CURRICULUM.md` from its `NEEDS.md`, and run
   `npx vitest run packages/ui/src/progression.test.js`. A planned row must begin
   with its group span, as in `H to N, and the leakage spike`, because the parser
   looks for the letters first.
3. Promote a canvas to `packages/ui` when a second lab claims it, and update the
   table in `PROGRAM.md` §4.
4. Update the ledger in `BACKLOG.md` §1 and move each lane's phasing note into its
   plan's phasing section.
5. Run the scoped tests, then the full suite on a quiet machine, then
   `npm run lint:prose`, then build every app, then push.

Gate every commit on the test's exit code. Two commits went out with a failing
progression test because a `grep` in the chain swallowed the code.

## 6. Things that bit, so they do not bite twice

- An agent's worktree is created from `master`, which is far behind. Every script's
  setup checks the integration branch out first.
- A branch name already in use fails `git checkout -b` and an agent will invent
  another name. The scripts now fall back to checking the branch out.
- A background test run never wakes an agent. Tests run in the foreground with the
  Bash timeout at 600000 ms.
- `pkill -f vitest` killed the shell that ran it. Kill by pid.
- A release test that asserts `deploy.yml` must not mention the lab is wrong. The
  workflow ships every build. The test asserts only `site/index.html`, `README.md`
  and `LabNav.jsx`.
- One planner wrote to the main tree's `BACKLOG.md` by absolute path from its
  worktree. Tell agents to work only in their worktree, and check `git status` in
  the main tree after a wave.
- The prose lint has caps of 22 words a sentence on average and 34 at most, no
  semicolons, no em dashes, no colon reveals, and a short list of banned words.
  Run `node packages/prose/bin/lint.mjs <files>` on every `.md` before committing.

## 7. What waits, and on what

- Applied Analog, Analog IC, Mixed-Signal: the Electronics lanes.
- RF Groups E to H, System Phases 2 to 6: Electronics K and O.
- Photonics Group B: Electronics O.
- Machines drives: Power Lab Group L.
- Power Lab D5, the leakage spike, needs a third state and a clamp. The `jk` lane
  may find that it falls out of the forward converter's reset.
- The decisions in `BACKLOG.md` §3 are Reed's. They cover the `n_i` pin and the
  MOSFET threshold. They cover the Grid Lab's own Newton and the ensemble canvas's
  props. They cover the Elements timeouts, the home of `createComplexChain`, the
  DC-flow guard's promise, and the error-rate canvas.

## 8. A first prompt for the session that takes over

> You are the director of the EE Labs program. Read HANDOFF.md, then PROGRAM.md,
> then BACKLOG.md §3 and §1. Confirm the suite is green on this machine. Then run
> the workflows in HANDOFF.md §4 in order, one or two at a time, integrate each
> branch a reviewer marks mergeable by HANDOFF.md §5, and keep BACKLOG.md current.
> Overseers are Opus. Nothing is released and nothing is merged to master without
> Reed.
