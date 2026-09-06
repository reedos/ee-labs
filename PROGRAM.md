# The program: how the labs are built as an organisation

`EE_LABS_MAP.md` names twenty-eight labs. This document is how they get built by
many agents at once without treading on each other. It is the charter every
overseer and every worker reads before touching a file. Reed reviews everything, and
Reed alone releases a lab.

## 1. The organisation

- **The director** owns this document, `BACKLOG.md`, the maps and roadmaps, the
  shared surfaces (`site/`, `README.md`, `packages/ui/src/LabNav.jsx`,
  `.github/workflows/deploy.yml`), and integration. The director merges each lab's
  branch, runs the whole suite, and resolves what two labs both needed.
- **An overseer** owns one lab. The overseer writes the lab's plan and brief, splits
  the work into lanes, commands the workers, commits by path, and reports. An
  overseer never edits another lab's files, and never edits a shared surface.
- **A worker** owns one lane of one lab, for one sitting. A worker edits only the
  files its lane owns, runs the tests for what it touched, and hands the result to
  the overseer. Workers do not commit.

Two overseers who need the same thing write it into their own `NEEDS.md`, and the
director resolves it once. Overseers do not negotiate with each other through files
they do not own.

## 2. One lab, one branch, one worktree

Every overseer works in its own git worktree on a branch named `lab/<slug>`, where
`<slug>` is the app directory's name (`lab/logic-lab`). The worktree gets its own
`npm ci`, so that `@ee-labs/*` resolves inside the worktree and not to the main tree.
Nothing is pushed by an overseer. The director merges `lab/<slug>` into the
integration branch, runs `npx vitest run` and `npm run lint:prose` from the root, and
pushes.

Stage by path. `git add apps/logic-lab packages/events`, never `git add -A`, never
`commit -a`. Commit messages are narrative, in the register of `git log`. No model
names in files. A commit's attribution trailer is the session's, and it is the one
place a model's name appears. The one exception is the model tier a workflow
script in `.claude/workflows/` sets on each agent. That is a setting, not a
signature.

## 3. What every lab delivers, in order

1. **The plan**, `/<LAB>_PLAN.md` at the root, in the shape of
   `ELECTRONICS_LAB_PLAN.md`. Its sections are the open decisions, the progression
   map for the lab against what is built, the engine, the models, the app, and the
   curriculum. Then the hand-overs, testing, the dark launch, phasing, non-goals and
   risks. Every quoted number is computed by a script before it is written.
2. **The brief**, `apps/<slug>/AGENT_BRIEF.md`, in the shape of
   `apps/electronics-lab/AGENT_BRIEF.md`. It holds the lanes with file ownership,
   and the contracts as code with the failing test named beside each. It holds the
   library netlists or their equivalent with fixed names, the lesson schema and
   quantity paths, the pins per lane, and the gate.
3. **The engine**, in its package, fuzzed green against the plan's invariants before
   any UI exists.
4. **The app**, dark. `RELEASE_STATUS` reads `dark` and `release.test.js` enforces
   that nothing outside the app mentions it. Copy Circuit Elements Lab's shape file
   for file and delete what is not needed.
5. **The curriculum**, group by group. Each experiment has `see`, `try` and `why`
   in the three registers. Every number is pinned in `experiments.test.js`. The
   prose lint is clean, terms are defined on contact, and the Playwright harness
   is extended.
6. **The report**, appended to `BACKLOG.md` under the lab's heading: what is built,
   what is deferred and why, what was needed from elsewhere.

A lab whose dependencies are not all built still delivers 1 and 2, and as much of 3
to 5 as its built dependencies allow. What it cannot build yet goes into the backlog
with the dependency named, and nothing in a lesson references an experiment that does
not exist. The progression test fails on such a reference, by design.

## 4. Reuse, adapt, or build

The suite has one shell and one set of controls, and a reader who learns one lab has
learned them all. Before writing a component, look in `packages/ui` and
`packages/explain`:

| Need | Reuse | Where |
| --- | --- | --- |
| Numeric entry with units and chips | `NumField` | `packages/ui` |
| The lab nav, the report link, lesson navigation | `LabNav`, `ReportIssue`, `LessonNav`, `TryLine` | `packages/ui` |
| Axes, ticks, engineering formatting | `plot.js`, `scale.js`, `format.js`, `units.js` | `packages/ui` |
| A schematic with live meters | `Schematic.jsx` and `schematicGeometry.js` | `packages/ui` |
| Poles and zeros, the z-plane | `PoleZeroCanvas`, `ZPlaneCanvas` | `packages/ui` |
| The math panel and its two rules | `MathPanel`, `packages/explain/testing` | `packages/explain` |
| Deep links between labs | `deeplink.js`, `circuitLink.js` | `packages/ui` |
| Prose budgets and the lint | `packages/prose` | `packages/prose` |

**Adapt** by adding a prop or a mode to the shared component, never by copying it
into an app. The DC/AC overlay on `Schematic.jsx` is the model. It is one new prop,
and the renderer draws what it is given.

**Build new** when the plan names an interaction model the suite lacks. Each of these
is a new canvas, and it goes into `packages/ui` if a second lab will need it, or
into the app if only one will:

| New | First lab | Second lab |
| --- | --- | --- |
| Timing diagram, signals against time with events marked | Logic Lab | Interfaces Lab, VLSI Lab |
| Constellation and eye diagram | Communications Lab | Mixed-Signal Lab |
| Field map, a scalar or vector field over a geometry | Fields Lab | Devices Lab |
| One-line diagram with power flow arrows | Grid Lab | Energy Lab |
| Smith chart | RF Lab | Fields Lab, Instruments Lab |
| Specification pane, a target and the margin against it | Applied Analog Lab | DSP Lab |
| Ensemble view, many runs and their spread | Random Signals Lab | Applied Analog Lab (Monte Carlo) |
| State machine diagram | Logic Lab | Computer Lab |
| Phase plane | Control Lab II | Machines Lab |

A new canvas built for one lab carries the second lab's needs in its props from
the start. The plan says which those are.

## 5. Shared surfaces, and who may touch them

| File | Owner | Rule |
| --- | --- | --- |
| `site/index.html`, `README.md`, `packages/ui/src/LabNav.jsx` | director | changed only in a release commit, when Reed flips a lab's `RELEASE_STATUS` |
| `.github/workflows/deploy.yml` | director | one `cp` line per dark lab, added at integration from the lab's `NEEDS.md` |
| `packages/ui/src/progression.test.js` | the seams overseer | every other lab adds its ids by a `NEEDS.md` entry |
| `packages/network` | the Electronics overseer, then by request | a lab that needs a new element writes the contract in its `NEEDS.md` |
| `packages/dsp` | the DSP Lab overseer | as above |
| `packages/systems` | the Control Lab II overseer | as above |
| `packages/switched` | the Power Lab lanes, Groups H to N, then by request | as above |
| `packages/ui`, `packages/explain` | director, by request | a new prop or canvas comes with its test and its second lab named |
| a new package | the overseer whose lab creates it | listed in `EE_LABS_MAP.md` §3 |

## 6. The house discipline, restated

`CORE_SCOPE.md`, `STYLE.md`, `REVIEW_PLAYBOOK.md`, `CONTRIBUTING.md`. Every
explanatory sentence is a claim about physics, and a test must measure it. Every
object is admitted exactly, guarded with a threshold, or declined with a tested
reason. Exact mappings are never hedged. Prose passes the lint. Nothing is loaded
from an instrument. A number is never typed into a test as a constant when it can be
computed from the knobs.

## 7. Reporting

An overseer's final report has seven parts, in this order. The branch and its
commits. The plan and brief paths. What is built, as groups and counts. The test
and lint state. What is deferred and why, mirrored in `BACKLOG.md`. What is needed
from elsewhere, mirrored in `NEEDS.md`. Anything the director should decide.
