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
2. **README** `README.md`: a row in *The tools* table for Power Lab. It covers
   linear against switching, and the buck converter (volt-second balance,
   M = D, ripple, DCM, the CCM/DCM boundary, real parts), with the experiment
   count at the time.
3. **Nav** `packages/ui/src/LabNav.jsx`: `{ id: 'power-lab', label: 'Power' }`
   in `LABS`. Until then the lab passes `currentLabel="Power"` so its own nav
   names it without the released labs listing it back.
4. **Usage counter** `apps/power-lab/index.html`: the GoatCounter tag the other
   labs carry,
   `<script data-goatcounter="https://reedos.goatcounter.com/count" async src="https://gc.zgo.at/count.js"></script>`.
   Add `apps/power-lab/index.html` to the pinned page list in
   `packages/ui/src/analytics.test.js` (~line 109) at the same time. While dark
   the page carries no tag, so review visits do not count as traffic.

## Not needed

- No changes to `packages/explain` or `packages/network`. The lab uses
  `NumField`, `useCanvas`, `drawFrame`, `plotArea`, `COLORS`, `fmt`, `LabNav`,
  `ReportIssue`, `fmtHz` and `buildLink`/`parseLink` from `@ee-labs/ui` as
  exported today, and does not import `Schematic`.

## A gap in `packages/ui`, worked around locally

The buck's averaged small-signal plant now hands over to Control Lab (a
`plant=custom:…` link, `src/handover.js` and `src/components/BuckHandOver.jsx`,
2026-09-03). `packages/ui/src/deeplink.js`'s `siblingUrl` and
`circuitLink.js`'s `labUrl` both hard-code which app names they recognise as
the link's SOURCE — `signal-lab`/`circuit-lab`/`control-lab` for one, those
plus `circuit-elements-lab` for the other — so a call made from power-lab's
own pathname returns null unconditionally, dev or deployed. `src/handover.js`
carries a local `powerSiblingUrl`, the same algorithm with `'power-lab'` added
to the recognised set, rather than editing either shared file from here. The
real fix is a one-line addition to both lists (and, since Power Lab is dark,
gating it the way `RELEASE_STATUS` already gates the splash/README/LabNav
surfaces) — small enough to fold into whichever session next touches
`packages/ui` for an unrelated reason, but out of this territory today.
Control Lab itself needs no change: `fromAppName` falls back to "another
tool" for the unrecognised `power` app, and `fromDisplayName` prefers the
link's own `label` regardless, so the plant still arrives named correctly,
only the sending app's name is generic.

- No hand-over yet for rectifier spectra into Signal Lab (the plan's other
  later-phase bridge). It would need the same `handOverEvent` / `HANDOVERS`
  pattern and the same `packages/ui` gap above.
