# What the Power Lab needs from outside its own directory

The lab lives in `apps/power-lab/` and `packages/switched/`. Nothing else in the
repo was changed to build it, apart from the two entries listed first.
Everything under "at release" is deliberately not done while `RELEASE_STATUS`
says `dark`, and `src/release.test.js` fails if any of it is.

## Already in place (outside this directory)

- `.github/workflows/deploy.yml` carries one `cp -r apps/power-lab/dist
  _site/power-lab` line after the Circuit Elements Lab's, so the build ships
  unlinked at `/power-lab/` for review. `release.test.js` pins the line.
- `package-lock.json` registers the two new workspaces (`@ee-labs/power-lab`
  and `@ee-labs/switched`) through `npm install`. No dependency versions moved.

## At release: flip `RELEASE_STATUS` to `released`, then `release.test.js` demands:

1. **Splash page** `site/index.html`: a lab card linking `power-lab/`, in the
   style of the Signal/Circuit/Control cards (~line 213 onward).
2. **README** `README.md`: a row in *The tools* table for Power Lab, with the
   experiment count at the time. The row covers linear against switching and
   the buck converter. Then the boost and buck-boost, magnetics and the two
   isolated converters, the line side, the inverters, and where the losses go.
3. **Nav** `packages/ui/src/LabNav.jsx`: `{ id: 'power-lab', label: 'Power' }`
   in `LABS`. Until then the lab passes `currentLabel="Power"` so its own nav
   names it without the released labs listing it back.
4. **Usage counter** `apps/power-lab/index.html`: the GoatCounter tag the other
   labs carry,
   `<script data-goatcounter="https://reedos.goatcounter.com/count" async src="https://gc.zgo.at/count.js"></script>`.
   Add `apps/power-lab/index.html` to the pinned page list in
   `packages/ui/src/analytics.test.js` (~line 109) at the same time. While dark
   the page carries no tag, so review visits do not count as traffic.

## From the director, for Groups D, F and G

1. **`package-lock.json` is stale on this branch.** It is missing
   `random-lab`, so `npm ci` refuses in a fresh worktree and the install has
   to be `npm install --no-audit --no-fund --no-save`. No dependency version
   moved and the lock file was not touched here. It is the director's file,
   and one `npm install` at integration fixes it.
2. **The splash count moves to 34 at release.** §7 of the plan pins "54
   experiments" as the number the splash card will carry when the whole
   curriculum is built. The lab has thirty-four, and `release.test.js` will
   demand whatever number the card claims, so the card and the README row are
   written once, against the count on the day.
3. **Nothing new is needed from `packages/ui`, `packages/explain` or
   `packages/network`.** The three new panes are built from `useCanvas`,
   `drawFrame`, `plotArea`, `COLORS` and `fmt` as exported today. The
   conduction scrub's dimming is two class names in this app's own
   stylesheet.

## Not needed

- No changes to `packages/ui`, `packages/explain` or `packages/network`. The lab
  uses `NumField`, `useCanvas`, `drawFrame`, `plotArea`, `COLORS`, `fmt`,
  `LabNav`, `ReportIssue` and `MathPanel` as exported today, and does not import
  `Schematic`.
- No hand-overs to or from the other labs yet. Two are in the plan's later
  phases: control of the buck in Control Lab, and rectifier spectra in Signal
  Lab. Each will need `handOverEvent` entries and a `HANDOVERS` table, in the
  pattern the Circuit hand-overs set.

## From the director, for Groups L, M and N

1. **`packages/switched` now depends on `@ee-labs/machines` and
   `@ee-labs/dsp`.** Both are listed in `packages/switched/package.json` and
   both resolve inside a worktree that has run `npm ci`. Neither package was
   edited. The drive module reads `dcOf`, `operating`, `timeConstants` and
   `pmsmOf` so that one motor is described once, and the interference module
   reads `fft` so a spectrum has a second reader. `package-lock.json` is the
   director's file, and one `npm install` at integration records the two
   edges.
2. **The splash count moves to 43 at release.** §7 of the plan pins "54
   experiments" as the number the card will carry when the whole curriculum is
   built. The lab has forty-three. `release.test.js` will demand whatever
   number the card claims, so the card and the README row are written once,
   against the count on the day.
3. **Three meters and four traces were added to the shell's own tables.**
   The meters are the line's ripple, the switch node's ring, and the junction
   temperature. Both tables read as a base list plus one appended row a lane,
   so a second lane's row merges beside this one. `review.test.jsx` takes its
   added meters from `LMN_HEADLINES`. A lane that declares a meter does not
   also edit the test. `ORDER` in `panes.jsx` partitions the union by axis, so
   the measures table still reads voltages before currents. No lane has to
   place its own signals inside the base list.
4. **The schematic kit is exported.** `schematics.jsx` now exports its
   symbols, so a group can draw a circuit in the lab's own idiom without
   copying one. `lmnSchematics.jsx` is the first user, and the six drawings it
   holds are registered by one `Object.assign` each.
5. **Nothing new is needed from `packages/ui` or `packages/explain`.** The
   four new panes are built from `useCanvas`, `drawFrame`, `plotArea`,
   `COLORS` and `fmt` as exported today.
