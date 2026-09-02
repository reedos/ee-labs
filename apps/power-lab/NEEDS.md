# What the Power Lab needs from outside its own directory

The lab lives in `apps/power-lab/` and `packages/switched/`; nothing else in
the repo was changed to build it, with two small exceptions listed first.
Everything under "at release" is deliberately *not* done while
`RELEASE_STATUS` says `dark` — `src/release.test.js` fails if any of it is.

## Already in place (outside this directory)

- `.github/workflows/deploy.yml` — one `cp -r apps/power-lab/dist _site/power-lab`
  line after the Circuit Elements Lab's, so the build ships unlinked at
  `/power-lab/` for review. `release.test.js` pins the line.
- `package-lock.json` — the two new workspaces (`@ee-labs/power-lab`,
  `@ee-labs/switched`) registered by `npm install`; no dependency versions moved.

## At release — flip `RELEASE_STATUS` to `released`, then `release.test.js` demands:

1. **Splash page** `site/index.html`: a lab card linking `power-lab/`, in the
   style of the Signal/Circuit/Control cards (~line 213 onward).
2. **README** `README.md`: a row in *The tools* table — Power Lab, covering
   linear vs switching, the buck converter (volt-second balance, M = D, ripple,
   DCM, the CCM/DCM boundary, real parts); experiment count at the time.
3. **Nav** `packages/ui/src/LabNav.jsx`: `{ id: 'power-lab', label: 'Power' }`
   in `LABS`. Until then the lab passes `currentLabel="Power"` so its own nav
   names it without the released labs listing it back.
4. **Usage counter** `apps/power-lab/index.html`: the GoatCounter tag the other
   labs carry —
   `<script data-goatcounter="https://reedos.goatcounter.com/count" async src="https://gc.zgo.at/count.js"></script>`
   — and `apps/power-lab/index.html` added to the pinned page list in
   `packages/ui/src/analytics.test.js` (~line 109). While dark the page carries
   no tag, so review visits do not count as traffic.

## Not needed

- No changes to `packages/ui`, `packages/explain` or `packages/network`: the
  lab uses `NumField`, `useCanvas`, `drawFrame`, `plotArea`, `COLORS`, `fmt`,
  `LabNav`, `ReportIssue` and `MathPanel` as exported today, and does not
  import `Schematic`.
- No hand-overs to or from the other labs yet; the plan's later phases
  (control of the buck → Control Lab; rectifier spectra → Signal Lab) will
  need `handOverEvent` entries and a `HANDOVERS` table, in the pattern the
  Circuit → Signal/Control hand-overs set.
