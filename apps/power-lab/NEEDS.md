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

## A gap in `packages/ui`, now fixed at the source

The buck's averaged small-signal plant hands over to Control Lab (a
`plant=custom:…` link, `src/handover.js` and `src/components/BuckHandOver.jsx`,
2026-09-03). `packages/ui/src/deeplink.js`'s `siblingUrl` (and, separately,
`homeUrl`) and `circuitLink.js`'s `labUrl` used to hard-code which app names
they recognise as a link's SOURCE — `signal-lab`/`circuit-lab`/`control-lab`
for the first two, those plus `circuit-elements-lab` for the third — so a
call made from power-lab's own pathname returned null unconditionally, dev or
deployed. That was a routing gap, not a Power-Lab-specific rule, and it hit
Circuit Elements Lab's own LabNav the same way (it rendered no nav row at
all, RELEASE_STATUS aside) — so it has now been fixed in `packages/ui`
itself: `deeplink.js` and `circuitLink.js` both recognise every folder the
suite deploys as a possible link source, `circuit-elements-lab` and
`power-lab` included. Recognising a name as a link SOURCE is independent of
which labs LINK to it — LabNav's own `LABS` array is what the released labs'
nav rows are built from, and it still lists only the three released labs, so
neither dark lab is added to their nav. Each dark lab still names itself in
its own row via `currentLabel`, unchanged.

`src/handover.js` used to carry a local `powerSiblingUrl`, a copy of
`siblingUrl`'s exact algorithm with `'power-lab'` added to its recognised
set, because editing the shared file was out of this territory. Now that
`packages/ui/src/deeplink.js`'s `siblingUrl` itself recognises `'power-lab'`,
that copy bought nothing the shared helper doesn't already do — it has been
deleted, and `handover.js` imports `siblingUrl` from `@ee-labs/ui` directly.
`handover.test.js`'s dedicated `powerSiblingUrl` test went with it; the
resolver itself is pinned in `packages/ui/src/deeplink.test.js`, and
`handover.test.js` still checks that `buckHandOverLink` resolves a URL on the
deployed layout. Control Lab itself needed no change: `fromAppName` falls
back to "another tool" for the unrecognised `power` app, and
`fromDisplayName` prefers the link's own `label` regardless, so the plant
still arrives named correctly, only the sending app's name is generic.

- No hand-over yet for rectifier spectra into Signal Lab (the plan's other
  later-phase bridge). It would need the same `handOverEvent` / `HANDOVERS`
  pattern and the same `packages/ui` gap above.

## A second gap in `packages/ui`, worked around locally

`drawFrame` (`packages/ui/src/plot.js`) always rotates a sweep's left-axis
title 90°. Right for a worded title; wrong for a lone glyph — rotated, η's
descender reads as a stray hook, not as η (Reed, 2026-09-02, on A1's sweep;
the same bug independently on B6, B7 and B8, whose sweeps put η alone on
that axis with no unit to go with it). `SweepCanvas.jsx`'s own right-hand
axis already carried the fix (a title of two characters or fewer stays
upright); `drawSweep` now applies the same rule to the left axis by
withholding `yTitle` from `drawFrame` when the title is that short and
drawing it upright itself, at the same position `drawFrame` would have
used. The real fix is one `title.length > 2` guard inside `drawFrame`
itself, so every lab's sweep gets it rather than only this one working
around it — small enough for whichever session next touches
`packages/ui/src/plot.js`, out of this territory today.
