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

## A third gap in `packages/ui`, worked around locally

`drawFrame` sizes its tick step from the room the plot has. It hands that to
`niceStep`, which rounds up to 1, 2 or 5 times a power of ten. On a short
frame the step can come back as wide as the range itself. The axis then gets
one tick label, or none.

Forty of this lab's scope strips did (2026-09-05 review). G4's output strip
said "4.65 V" over a 4.63 to 4.69 V window. D1's flux said "0 T" over a range
of 400 mT each way. `format.js` now carries `tickStep` and `logTickStep`, and
this app's three plots take their steps from those.

The rule is not this lab's. Any lab that splits a canvas into strips, or
frames a ripple on a level, meets it. One guard inside `drawFrame` would give
every lab's plots a scale: ask `niceStep` for more divisions until at least
three ticks land inside the range. This app's callers could then drop the
argument. Out of this territory today.

## Open in the app, for Reed to decide

Two sweeps are framed by a runaway asymptote. The numbers their own notes name
then plot on the axis line.

- **D3, the flyback.** M = n·D/(1 − D) reaches 24.5 at D = 0.98, so the axis
  runs 0 to 30. The note's "M = 0.500" sits at 2 % of the frame and the try
  line's "M rises to 1.50" at 5 %. The curve is flat along the bottom until
  D = 0.9.
- **C4, the inverting buck-boost.** The same shape downward, to −50.

The declared-frame rule added on 2026-09-05 catches neither. The data does
span the frame. It is the useful part of the data that does not.

There are three ways out. A log ratio axis for these two sweeps, where the
descriptor already supports `scale: 'log'` and C4's negative M does not. A
duty range that stops short of the asymptote. Or a frame that lets the curve
leave the top, which reverses `anchoredRange`'s rule that the bound gives way
rather than the curve. Which one is right is a curriculum decision about what
these two sweeps are for.
