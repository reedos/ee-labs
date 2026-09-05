# What the Energy Lab needs from outside its own directory

The lab lives in `apps/energy-lab/` and owns no package. `packages/network` and
`packages/switched` are used exactly as they are exported today, and neither
was touched to build it. `ENERGY_LAB_PLAN.md` §7 states that as the lab's first
decision, and this file is the list of everything that follows from it.

Nothing here blocks the lab. Everything under "at release" is deliberately not
done while `RELEASE_STATUS` says `dark`, and `src/release.test.js` fails if any
of it is.

## 1. Now, at integration

- **The deploy workflow.** `.github/workflows/deploy.yml` needs one line after
  the Power Lab's, so the build ships unlinked at `/energy-lab/` for review:

  ```
  cp -r apps/energy-lab/dist _site/energy-lab
  ```

  `release.test.js` records the requirement rather than asserting the line,
  because the workflow is a shared surface this lab does not own. The suite is
  therefore green before the line lands, and the same test pins it the moment
  `RELEASE_STATUS` flips.
- **The workspace.** `package-lock.json` registers `energy-lab` through
  `npm install`. No dependency version moved.

## 2. The progression, for whoever owns `packages/ui/src/progression.test.js`

That file does not exist on this branch. When it does, the Energy Lab's row is:

```js
{ id: 'energy-lab', label: 'Energy', step: 7, groups: 5, experiments: 26,
  ids: ['a1','a2','a3','a4','a5','a6','a7','a8',
        'b1','b2','b3','b4','b5',
        'c1','c2','c3','c4','c5',
        'd1','d2','d3','d4','d5',
        'e1','e2','e3'] }
```

The counts by group are 8, 5, 5, 5 and 3, in that order.
`experiments.test.js` asserts both the total and the split. The lab opens after
Circuit Elements Lab's Group I and after Power Lab's buck. Both are built, so
it references no experiment that does not exist.

The row for `CURRICULUM.md` §1, which the director owns:

| Step | Lab | Course it mirrors | Experiments | Status |
| --- | --- | --- | --- | --- |
| 7 | Energy Lab | Photovoltaics, storage, microgrids | 26 | built, dark |

## 3. At release: flip `RELEASE_STATUS` to `released`, then `release.test.js` demands

1. **Splash page** `site/index.html`: a lab card linking `energy-lab/`, in the
   style of the cards already there.
2. **README** `README.md`: a row in *The tools* table, with the experiment
   count at the time. It covers the cell as a diode in the light and the
   maximum power point. It covers the tracker that finds it, the battery as an
   equivalent circuit, and a day of energy balance on one bus.
3. **Nav** `packages/ui/src/LabNav.jsx`: `{ id: 'energy-lab', label: 'Energy' }`
   in `LABS`. Until then the lab passes `currentLabel="Energy"`, so its own nav
   names it without the released labs listing it back.
4. **Usage counter** `apps/energy-lab/index.html`: the GoatCounter tag the other
   labs carry. Add `apps/energy-lab/index.html` to the pinned page list in
   `packages/ui/src/analytics.test.js` at the same time. While dark the page
   carries no tag, so review visits do not count as traffic.

## 4. Contracts this lab would use, and built around the absence of

Neither is needed for the lab to ship. Both are written as contracts because
the next lab to solve a long chain of exponential elements will want them.

- **A starting point for `newtonDC`.** `newtonDC(net, opts)` starts every solve
  from `min(0.5, vcrit)` on every diode, so a sweep cannot continue from the
  point it just solved:

  ```js
  newtonDC(net, { v0: { D0_0: 0.61, D0_1: 0.61 } })   // per-element, by id
  ```

  The failing test that would name it: a twelve-cell string swept by terminal
  voltage over its whole range, every point converging. Today the voltage drive
  refuses over about a sixth of that range, which is why `atI` is this lab's
  primitive and `atV` bisects it. That is also the physics, so the lab states
  it rather than working around it, and the plan's §2.2 says so on screen.
  `sourceStepping`, which the Electronics brief already contracts for, would
  answer the same need.

- **Nothing from `packages/switched`.** `converter('buck', …)`, `steadyState`
  and `measures` are used as exported. C5 is the whole of this lab's use of the
  package. Its check is that the switched steady state's own average input
  current agrees with R/D², and it does, to 2 × 10⁻⁷ A on a 4.8 A current.

## 5. Not needed

- No changes to `packages/ui` or `packages/explain`. The lab uses `NumField`,
  `LabNav`, `LessonNav`, `ReportIssue`, `useCanvas`, `drawFrame`, `plotArea`,
  `COLORS`, `fmt`, `niceStep` and `MathBody` as exported today, and does not
  import `Schematic`.
- No new package, and no new canvas in `packages/ui`. The four canvases here
  are this lab's own. The one-line diagram with power-flow arrows that
  `PROGRAM.md` §4 names goes to Grid Lab first. This lab's day view is a bar
  chart of one bus rather than a one-line diagram, so it does not pre-empt
  it.
- No hand-over back from Power Lab. This lab hands an operating point to Power
  Lab's buck, and Power Lab hands nothing back until its Group H closes a loop
  around it.

## 6. For `BACKLOG.md`, under "### Energy Lab"

`BACKLOG.md` is not on this branch. The entry is written here for the director
to paste at integration, rather than added to a file this branch does not
carry.

### Energy Lab

- **The wind group.** Not started. A turbine's electrical half is a machine,
  and no lab in the suite teaches machines yet, so it waits on the Machines
  Lab. What it needs from there is a generator with a torque input and
  electrical terminals. Until it exists, this lab's sources are the
  photovoltaic cell and the battery, and the plan says so as a decision rather
  than an omission.
- **A starting point for `newtonDC`.** Deferred, and §4 above is the contract.
  The lab is complete without it. The current drive converges everywhere, and
  the reason it is the primitive is a sentence the lab teaches.
- **No small-signal model offered to `packages/systems`.** A cell is
  exponential and a string is twelve of them, so it is inadmissible under Rule
  1 of `CORE_SCOPE.md`. The small-signal resistance at an operating point would
  be admissible, and no experiment here needs one. That is a decision rather
  than a gap.
- **The reverse branch has no breakdown.** The model's only reverse path is the
  shunt resistance, so a shaded cell's reverse voltage is the model's rather
  than a real cell's. `src/guards.js` carries the sentence that says so, and
  the pane prints it under every picture that shows a reverse voltage. Adding
  a breakdown region would be a new element in `packages/network`, and no
  experiment here needs the exact volts.
