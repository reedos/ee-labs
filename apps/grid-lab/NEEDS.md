# What the Grid Lab needs from outside its own directory

The lab lives in `apps/grid-lab/` and owns one new package, `packages/grid`.
`packages/network` and `packages/machines` are used exactly as they are
exported today, and neither was touched to build it. One file was added to
`packages/ui`, `src/OneLineCanvas.jsx`, by the director's ruling and with the
Energy Lab's props in its signature.

Nothing here blocks the lab. Everything under "at release" is deliberately not
done while `RELEASE_STATUS` says `dark`, and `src/release.test.js` fails if any
of it is.

## 1. Now, at integration

- **The deploy workflow.** `.github/workflows/deploy.yml` needs one line after
  the Energy Lab's, so the build ships unlinked at `/grid-lab/` for review:

  ```
  cp -r apps/grid-lab/dist _site/grid-lab
  ```

  `release.test.js` records the requirement rather than asserting the line,
  because the workflow is a shared surface this lab does not own. The suite is
  therefore green before the line lands, and the same test pins it the moment
  `RELEASE_STATUS` flips.
- **The workspace.** `package-lock.json` registers `packages/grid` and
  `apps/grid-lab` through `npm install`. No dependency version moved.
- **The new canvas.** `packages/ui/src/OneLineCanvas.jsx` and its test are new,
  and `packages/ui/index.js` exports them. No other file in `packages/ui`
  changed. The canvas carries the Energy Lab's props already, so promoting it
  costs that lab an import and nothing else.

## 2. The progression, for whoever owns `packages/ui/src/progression.test.js`

That file does not exist on this branch. When it does, the Grid Lab's row is:

```js
{ id: 'grid-lab', label: 'Grid', step: 9, groups: 10, experiments: 42,
  ids: ['a1','a2','a3','a4',
        'b1','b2','b3','b4','b5',
        'c1','c2','c3','c4',
        'd1','d2','d3','d4','d5','d6',
        'e1','e2','e3',
        'f1','f2','f3','f4',
        'g1','g2','g3','g4','g5',
        'h1','h2','h3','h4',
        'i1','i2','i3','i4','i5',
        'j1','j2'] }
```

The counts by group are 4, 5, 4, 6, 3, 4, 5, 4, 5 and 2, in that order.
`experiments.test.js` asserts both the total and the split. The lab opens after
Circuit Elements Lab's Group H, which is built, and after the Machines Lab's
synchronous machine, which is merged.

The row for `CURRICULUM.md` §1, which the director owns:

| Step | Lab | Course it mirrors | Experiments | Status |
| --- | --- | --- | --- | --- |
| 9 | Grid Lab | Power systems analysis | 42 | built, dark |

## 3. At release: flip `RELEASE_STATUS` to `released`, then `release.test.js` demands

1. **Splash page** `site/index.html`: a lab card linking `grid-lab/`, in the
   style of the cards already there. Splash glyph `⌁`.
2. **README** `README.md`: a row in *The tools* table, with the experiment
   count at the time. The row covers per unit and three phase, the line and
   the transformer, and power flow by Newton with its linear approximation.
   It also covers symmetrical components and the four faults, protection, the
   swing equation, and economic dispatch.
3. **Nav** `packages/ui/src/LabNav.jsx`: `{ id: 'grid-lab', label: 'Grid' }` in
   `LABS`. Until then the lab passes `currentLabel="Grid"`, so its own nav
   names it without the released labs listing it back.
4. **Usage counter** `apps/grid-lab/index.html`: the GoatCounter tag the other
   labs carry. Add `apps/grid-lab/index.html` to the pinned page list in
   `packages/ui/src/analytics.test.js` at the same time.

## 4. Cross-references that stay deferred

Both are to Power Lab groups that are planned with no overseer.
`GRID_LAB_PLAN.md` §6 says the progression test fails on each until they
exist, and that failure is the design. They are carried as data in
`src/experiments.js` rather than only in prose, so the director can find them
without reading the lessons.

- **B5 to Power Lab I3.** B5 resolves an unbalanced set into three balanced
  ones. The inverter that produces a balanced three-phase set is Power Lab's
  Group I, and B5's lesson names it without linking to it. Reopens when Power
  Lab Group I lands.
- **C4 to Power Lab D1.** C4 is the transformer's voltage drop and the two
  controls that fix it. The magnetic core the winding sits on is Power Lab's
  Group D, and C4's lesson names it without linking to it. Reopens when Power
  Lab Group D lands.

Neither reference is a link today, so no test is red on their account. The day
either group lands, the director adds a deep link through `deeplink.js` and the
progression test's id list picks it up.

## 5. What this lab took from the Machines Lab, and what it did not

Group I imports the synchronous machine through `@ee-labs/grid`'s `stability`,
which calls `swing()` in `packages/machines/src/sync.js`. What it uses is the
inertia `M = 2H/ω_elec`, the equilibrium angle, the synchronising coefficient,
the exact second-order plant and the energy integral. It writes no second
machine model, and it edits nothing in `packages/machines`.

`internalEmf` and the five named reactances are exported and read, but no
experiment turns a fault study on `X_d''` yet. Group G runs on the reactances
given in `library.js`'s `FAULT_NETWORK`, which are a textbook set rather than
the Machines Lab's machine. Wiring Group G to the machine's own subtransient
reactance is one line in `faults.js` and is deferred to the sitting that runs
the release audit.

## 6. Numbers where this lab and `GRID_LAB_PLAN.md` differ

Each was recomputed from the engine, and the plan's figure is left in place for
the director to settle. The plan's own rule is that a quoted number is computed
by a script before it is written, and `packages/grid/scripts/numbers.mjs` is
that script.

- **§2.8, the closed-form clearing time.** The plan's 0.172761 s applies the
  zero-transfer closed form to the critical angle of the 0.5 pu fault.
  Recomputing the critical angle for a fault that removes the transfer gives
  59.1035°, and the closed form then gives 0.146827 s. I4 quotes the second.
- **§2.8, the integrator's step.** The plan says a 1 ms step gives 89.702°
  against an exact 89.7763°. Fixed-step Runge–Kutta of fourth order at 1 ms
  gives 89.776278° against 89.776289°, a gap of 1.2 × 10⁻⁵ degrees. The guard
  is real at a coarser step. It fires at 50 ms and is met at 25 ms, and I5
  measures both sides.
- **§2.7, the small-angle cost.** The plan's 0.0542 % is the sine-against-angle
  error at the largest branch *difference*, 3.267°. At the largest branch angle
  the column names, 4.759°, it is 0.115 %. E2 quotes the second and still makes
  the same point, because the flow error is 3.675 %.
- **§4.3, the shunt that restores 1.00 pu.** The plan says 40 Mvar. Bisecting
  on the solve gives 63.2051 Mvar, and the tap that does the same job is
  1.06301 rather than 1.07305, because raising the ratio raises the current
  through the reactance as well. C4 quotes both computed values.
- **§5, the group letters.** The plan's Group H, protection, carries the ids I1
  to I4, and its Group I, the machine, carries H1 to H4 and then I5. The ids
  here follow the group letters. §9's phase 6 and phase 7 name the same
  experiments they always did.
- **§5 I4, the infeed.** 36 Ω needs an infeed equal to the relay's own current,
  with the tapped bus 30 km along a 100 km line. At half the relay's current
  the same fault reads 30 Ω. H4 quotes both.

## 7. Not needed

- No change to `packages/network`. `assembleAC`, `solveAC`, `readoutAC` and
  `solve` are used as exported. The polar Newton is `packages/grid`'s own, for
  the reason the plan's Decision 2 gives.
- No change to `packages/explain`. `MathBody` is used as exported.
- No second machine model, no second complex-arithmetic module, and no second
  linear solver.
- No Playwright harness. `src/experiments.test.js` measures every number and
  `src/components/` is drawn from geometry the tests can read, so what is left
  uncovered is the app end to end and the 390 px layout. Deferred to the
  sitting that does the REVIEW_PLAYBOOK audit, which needs the screenshots
  anyway.
