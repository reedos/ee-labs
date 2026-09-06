# Random Lab bounded verification

## Result

2026-09-06, branch `verify/random-lab`. The saved count formatter resolves the
reported cold-load failure. All 30 experiments and all 50 offered views render
on desktop and phone in Chromium and Firefox. This supports accepting the
recovery/rendering change, not full lab or release acceptance. The findings below
remain open. No runtime app changes were needed in this verification sitting.

## Snapshot and scope

- Saved branch: `ff28ab727956a66940cef51efd1d960a3d75edb5`.
- Merge base with `cf90dda`: `327ba5846a395547ab519d3a08abf5d44aa2779d`.
- Integration merge: `3ae904e`, using `--no-ff`. No Random app/package conflicts.
- Director path-registry cherry-pick: `2435963`, from `f4b2dda`.
- Director nav-wrapping cherry-pick: `bf5ef1f`, from `4bdc478`.
- The assembly-list conflict was resolved to the director's exact committed file.
  All six imported shared files match `4bdc478` byte-for-byte in Git.
- No Circuit verification changes were imported. Circuit's `582650e` stays separate.
- Read `PROGRAM.md`, `CORE_SCOPE.md`, `STYLE.md`, `REVIEW_PLAYBOOK.md`, the full
  `RANDOM_LAB_PLAN.md`, `AGENT_BRIEF.md`, saved `NEEDS.md`, tests, and harness.

The saved delta against the merge base has 23 app-only paths. It includes count
formatting, axis labels, captions, chip wiring, readouts, and associated claims.
This sitting adds `scripts/verify-rendering.mjs`, this report, and the bounded
status in `NEEDS.md`. It does not add views or revise physics/curriculum.

## Evidence

Commands ran from this worktree's root. Logs use `cmd /c` redirection with the
exit code preserved. Dependency installation was offline and worktree-local.

| Check | Result | Local log |
| --- | --- | --- |
| `npm.cmd ci --offline --no-audit --no-fund` | exit 0 | `npm-ci.local` |
| `npx.cmd vitest run apps/random-lab packages/random --maxWorkers=2` | 557 tests, 18 files pass, before and after shared imports | `tests.local`, `tests-final.local` |
| Random build against merged `cf90dda` | exit 0 | `build.local` |
| Random plus four released sibling builds after shared imports | all five pass | `build-assembled.local` |
| Original `scripts/verify.mjs`, Chromium | exit 0, counts below | `verify-existing.local` |
| Bounded rendering, Chromium | exit 0, 2 cold loads, 60 visits, 100 views | `render-chromium.local` |
| Bounded rendering, Firefox | exit 0, 2 cold loads, 60 visits, 100 views | `render-firefox.local` |

The scoped tests include existing claim pins, second-route checks, formatter
regressions, and app prose tests. No full suite or global prose lint was run.
Vite reports the existing native-config-loader warning for `vitest.config.js`.

The original harness counted 214 readouts, including 27 estimates, 50 views,
75 chip presses, and 60 laptop folds. Its five notes are reset-to-default chips
in A1, A2, B3, D3, and E2. No assertions were weakened or skipped.

The new harness uses fresh contexts at 1280x800 and 390x844. It checks A1 cold
load, all 30 selections and every offered view, nonblank colored canvas pixels,
nonempty table rows, and finite readouts. It requires five navigation links
(home and four released siblings), HTTP 200 from each, and a current-lab label.
It resets the actual scrollers before measuring each first knob. Both browsers
reported zero runtime errors, horizontal DOM overflow, or first-knob failures.
Firefox ran with the required sandbox escalation, not as a skipped browser.

Assembly and browser commands:

```powershell
npm.cmd run build --workspace apps/random-lab --workspace apps/signal-lab --workspace apps/circuit-lab --workspace apps/control-lab --workspace apps/circuit-elements-lab
node scripts/assemble-site.mjs --labs random-lab,signal-lab,circuit-lab,control-lab,circuit-elements-lab
node scripts/assemble-site.mjs --no-assemble --serve --port 47624
$env:APP_URL="http://localhost:47624/random-lab/"
cmd /c "node apps/random-lab/scripts/verify.mjs > apps/random-lab/verify-existing.local 2>&1"; exit $LASTEXITCODE
```

Run the next command in a new shell after the preceding exit. Set `BROWSER` to
`chromium` or `firefox` for each bounded pass:

```powershell
$env:APP_URL="http://localhost:47624/random-lab/"
$env:BROWSER="chromium"
cmd /c "node apps/random-lab/scripts/verify-rendering.mjs > apps/random-lab/render-chromium.local 2>&1"; exit $LASTEXITCODE
```

The temporary server was stopped after verification. Port 47614 was occupied,
so that process was left untouched and this work used 47624.

## Remaining findings

1. **Phone canvas captions clip.** C3's histogram tail caption and I1's Wiener
   weight caption extend beyond the right edge in both browsers. `capWrap` in
   `src/components/views.jsx` splits only at separators, so an individual long
   segment can exceed the plot width. DOM overflow checks cannot detect text
   drawn beyond a canvas edge. The new probe is a rendering gate, not a text
   geometry gate. Screenshot review, not its exit code, found this defect.
2. **F4's saved third instruction contradicts the rendered spread.**
   `src/lessons/f.js` says the spread narrows as the run goes on. At its saved
   seed and settings, `analyse(byId('F4').params).ens().sd` starts at
   `0.03338690511136671` and ends at `0.16500641093147206`. The screenshot shows
   the band widening after the filter's initial state. The existing F4 ensemble
   claim only checks nonnegative initial spread, not this direction. This is an
   open lesson/pin issue, not a failing scoped test. No full curriculum re-audit
   was performed, and green existing pins do not establish every prose claim.
3. **Shared dependencies remain explicit.** Base `cf90dda` cannot show Random's
   suite nav without `f4b2dda`. The imported `4bdc478` supplies wrapping and the
   first-knob evidence includes its height. The shared `fmtNum(value, 0)` and
   `niceStep` hazards remain as recorded in `NEEDS.md`, with app-local workarounds.
   No additional shared API is required for the bounded rendering result.

Screenshots and per-view pixel/count data are ignored local evidence under
`shots/rendering/{chromium,firefox}/`. Each browser has 60 fold screenshots,
100 view screenshots, and `results.json`. Reviewed examples cover density,
scope, histogram, correlation, ensemble, outcome, kT/C table, matched filter,
error rate, Wiener, and Kalman views. The most relevant defect evidence is
`phone-C3-histogram.png`, `phone-I1-wiener.png`, and `phone-F4-ensemble.png`.
Desktop A1, C3, I1, I2 and Firefox A1/C3/I1 were also inspected.

## Changed paths

Saved app paths, relative to `apps/random-lab/`:

```text
NEEDS.md
scripts/verify.mjs
src/App.jsx
src/analysis.js
src/axis.js
src/axis.test.js
src/components/EnsembleCanvas.jsx
src/components/panes.jsx
src/components/views.jsx
src/format.js
src/format.test.jsx
src/groups/a.js
src/groups/c.js
src/groups/d.js
src/groups/g.js
src/groups/i.js
src/lessons/c.js
src/lessons/d.js
src/lessons/f.js
src/lessons/g.js
src/lessons/h.js
src/prose.test.js
src/styles.css
```

New verification paths: `scripts/verify-rendering.mjs`, `VERIFICATION.md`.
`NEEDS.md` also has this sitting's status update. The authorized director commits
account for the six shared paths outside this list. Incoming base changes are
unchanged. The npm-ci line-ending marker on `packages/prose/bin/lint.mjs` remains
unstaged and untouched, with no textual diff. No root package/lock change,
push, release flip, or merge into the director's branch was made.
