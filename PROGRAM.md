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
| Smith chart, in `packages/ui` since 2026-09-05 | RF Lab | Fields Lab, Instruments Lab |
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

## 8. Director execution, 2026-09-06

Reed approved bounded parallel implementation with director-owned integration.
This section governs scheduling and evidence for that continuation.
The ownership and physics rules above still apply. Reed alone releases labs.

### The ledger and states

`BACKLOG.md` section 1 is the current completion ledger.
Historical reports remain available but do not override that section.
Every lab has one row. Counts come from its executable curriculum registry.
`scripts/director/inventory.mjs` produces those counts without claiming acceptance.

- **Implemented:** the assigned model, app and curriculum exist on a named commit.
- **Verified:** the assigned scope passed the gates below on that commit.
- **Integrated:** reviewed changes are merged and the integration checks are recorded.
- **Accepted:** the agreed scope has passed all gates, with no material open defect.
- **Released:** Reed approved public navigation and the release marker changed.

State the scope beside every status. Accepting Group A does not accept the whole lab.
A dark app can be integrated while its acceptance remains open.
A tested refusal is complete behavior, not missing implementation.
An unimplemented plan requirement remains open unless Reed approves its exclusion.

### Assignment and capacity

Start with at most three worker streams and reserve director capacity for review.
Use one verification stream and two independent implementation streams initially.
Each assignment names its branch, worktree, owned files, dependencies and exit checks.
The usual deliverable is one complete experiment group.
Review the first usable group before extending its interface across the lab.

Keep urgent shared-contract decisions with the director.
Do not assign two workers to edit the same shared package files.
Promote shared components when the second consumer's tested contract is known.
Workers record requests in their lab's `NEEDS.md`, not another lab's files.

Run worker tests with at most two workers during this wave.
Reserve full-suite runs for integration, with at most eight workers on a quiet machine.
Reduce concurrent jobs when resource contention affects the evidence.
Do not change correctness tolerances or weaken checks to meet a runtime target.

### Acceptance gates

Reed rejected the first VLSI and Interfaces review on 2026-09-06.
Their passing checks missed established interaction and teaching requirements.
Use Circuit, Signal, Control and Circuit Elements as the reference apps.
Review `REVIEW_PLAYBOOK.md` against working behavior, not just source imports.

- Inherit shared typography, section styling, numeric fields and navigation. Explain any necessary departure before extending it.
- Change each featured parameter with the axes held. Verify that the lesson's feature moves visibly against a reference.
- Keep time playback, pause, speed, rewind and replay consistent. Verify live plots and readings together.
- Measure useful plot area, not just canvas presence. Review laptop, widescreen and phone screenshots at readable sizes.
- Present the model, assumptions, worked substitutions and measured comparisons near the result. Use available space for the lesson.
- Perform a student walkthrough before offering a group for acceptance. Passing automation does not establish teaching quality.
- Before derivation, identify the block's purpose, input and expected output. Define unfamiliar circuit terms on contact.
- Distinguish design parameters, external loads, requirements and observation controls. Check each stated prediction against the model.
- Include practical tradeoffs and model limits. Verify phone navigation between the lesson, settings, circuit, plots and math without nested page scrolling.

Do not extend either new app's interface until its revised first group has been reviewed.
The director owns these checks before requesting Reed's time.

1. Check each assigned plan requirement against an experiment, model and visible result. Record missing requirements and deviations.
2. Test physics against independent calculations, invariants and boundary cases. Test each approximation guard on both sides of its threshold.
3. Pin lesson claims to the controls. Execute try steps in order without an implicit reset. Define terms on contact.
4. Exercise controls and views in the deployed sibling-path layout. Check phone and desktop sizes, accessibility, console output and readable screenshots.
5. Verify affected package contracts, curriculum references and cross-lab hand-overs. A selector or registry containing zero items must not pass vacuously.
6. Run scoped tests and builds before a worker commit. Run the full suite and prose lint at integration.

Record the commit, commands, exit codes, browser versions, viewports and evidence paths.
Tie inherited evidence to its original commit and tested dependencies.
Changed dependencies invalidate the affected evidence until it is rerun.
Report an unavailable browser as incomplete verification, never as a passing browser run.
Separate environment failures from application defects without hiding either.

Existing repository prose findings remain an open gate.
Report their baseline separately from new findings. Do not describe a failing lint run as clean.
Edited documents and lesson prose must pass their scoped checks.

### Integration and progress

Review and integrate independent branches individually. One lab's defect does not block another lab's work.
Use a clean director worktree. Preserve Reed's concurrent changes in the main workspace.
Stage only owned paths, merge explicitly, and do not push or release this wave.
For each integration, record verified scope and remaining acceptance findings.

Report accepted or integrated groups, resolved dependencies and the next bounded deliverable.
Do not use test counts, commit counts or screenshot counts as curriculum completion measures.
Escalate curriculum changes, exclusions and release decisions to Reed.
Resolve routine engineering choices within the plans without adding approval delays.
