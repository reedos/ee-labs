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

## From the director, for Groups J and K

Six experiments on top of the thirty-four, in two groups: the forward, the
push-pull and the full bridge, then the series resonant tank, the LLC and
what its soft edge saves. The lab is at forty. `packages/switched` gained the
forward family and its solver in `src/isolated.js`, and `src/resonant.js`.
Every existing signature stands, and `apps/power-lab/AGENT_BRIEF_JK.md` names
what each contract is.

1. **The splash count moves to 40 at release.** §7 of the plan pins "54
   experiments" as the number the card will carry when the whole curriculum is
   built, and `release.test.js` demands whatever number the card claims. The
   card and the README row are written once, against the count on the day.
2. **Six files outside this group's own were touched, each by one line per
   table**, so three lanes building at once merge by union rather than by
   reading each other. `experiments.js` takes `JK_GROUPS`, `JK_GROUP_INTROS`,
   `JK_TRACES`, `JK_VIEWS`, `JK_SWEEP_X`, `JK_SWEEP_Y` and `JK_EXPERIMENTS` by
   spread. `math.js`, `terms.js` and `analysis.js` take one entry each.
   `App.jsx` takes three (the sweep, the flow chips and the outcome line) and
   the Family pane. `ScopeCanvas.jsx` takes two trace colours.
3. **Two shared surfaces of the app changed shape, and both are additive.**
   `schematics.jsx` exports its drawing kit as `KIT` and hands it to
   `jkDrawings(KIT)`, so a group's drawings live beside it rather than inside
   it. `panes.jsx`'s `conductingIn(name, topology)` takes a second argument
   with a default. A name's prefix is the right rule for two switches and the
   wrong one for a resonant bridge, where Q1 and Q2 each meet all three
   rectifier states. A lane that wants either can follow the same shape.
4. **One fix in `panes.jsx` was not this group's.** The scrub read a signal
   from the first two state components, so every signal of a converter with
   three or four of them was wrong by whatever the rest were worth. Nothing
   before this group had more than two, so nothing before it was affected.
5. **Nothing new is needed from `packages/ui`, `packages/explain` or
   `packages/network`.** The Family pane is a table in this app's own
   stylesheet, and the two new sweeps use `SweepCanvas` as it stands, with a
   `pred` line and a shared second axis it already draws.
6. **`packages/switched/src/isolated.js` now carries a second solver.**
   `windowedSteadyState` is the clock with state events inside it, and
   `resonant.js` imports it. A lane that needs the same shape should use it
   rather than write a third. The shape is a clocked converter whose
   sub-intervals its own state chooses.
7. **The 1366×768 fold needs about 25 px back, once, in the shell.**
   `verify.mjs` §8 passes 31 of 40 in Chromium and 22 of 40 in Firefox, whose
   range inputs are taller. Chromium's nine are B1, B2, B4, C1, C5, E1, E4, E6
   and F2, over by 0 to 23 px. Firefox's eighteen are those nine plus A1, A3,
   B3, B5, B6, B8, C2, C3 and C4, over by 0 to 53 px. Most of them open a
   group, which puts a 48 px intro above the note.
8. **That fold is the shell's, and none of it is these two groups'.** The same
   nine are over with Groups J and K removed from the build, measured at 25 of
   34 in Chromium on 2026-09-05. This lane gave back the 28 px it had added,
   and the review took another 18 px out of J1's note, which was the one
   experiment of these six over in either browser. All six are above the fold
   in both browsers now. One change to the sidebar's chrome fixes the rest.
   §8 is the test, and it still fails on the nine and the eighteen.

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
- No changes to `packages/ui`, `packages/explain` or `packages/network`. The lab
  uses `NumField`, `useCanvas`, `drawFrame`, `plotArea`, `COLORS`, `fmt`,
  `LabNav`, `ReportIssue` and `MathPanel` as exported today, and does not import
  `Schematic`.
- No hand-overs to or from the other labs yet. Two are in the plan's later
  phases: control of the buck in Control Lab, and rectifier spectra in Signal
  Lab. Each will need `handOverEvent` entries and a `HANDOVERS` table, in the
  pattern the Circuit hand-overs set.

## From the director, for Groups H and I

1. **`packages/ui`, `packages/explain` and `packages/network` are unchanged.**
   The three new panes are built from `useCanvas`, `drawFrame`, `plotArea`,
   `COLORS`, `fmt` and `buildLink` as exported today. `buildLink` already
   carries a `plant=custom` with six exact coefficients and a `from=`
   provenance triple, which is the whole of the Power to Control hand-over the
   plan's §5 asks for. No new link grammar was needed.
2. **The hand-over is one-way until Control Lab answers it.** H2's plant pane
   links out to Control Lab with `plant=custom`, `ctrl=p:1` and a `from=`
   naming the experiment. Control Lab reads that fragment today, so the link
   works. What it cannot do is send the closed-loop step back, so H2's own note
   stops at the plant. The round trip needs a return link and a Control Lab
   pane that knows the plant came from a switched converter. That is a
   hand-over decision rather than machinery, and it belongs to the director.
3. **The splash count moves to 40 at release.** §7 of the plan pins "54
   experiments" as the number the card will carry when the whole curriculum is
   built. The lab has forty. `release.test.js` will demand whatever number the
   card claims, so the card and the README row are written once, against the
   count on the day.
4. **Every shared table in the app took one appended line per lane.**
   `experiments.js` gains six spreads and `terms.js` one. `math.js` gains two
   dispatch lines and five exported builders, and `analysis.js` two dispatch
   lines. `panes.jsx` gains five names in `ORDER` and one mode word,
   `schematics.jsx` a drawing and three table rows, and `ScopeCanvas.jsx` five
   colours. `App.jsx` gains three view lines and three branches. Every one is
   an addition at the end of its table, so a merge of three lanes is a union.
5. **`sweeps.test.js` gained a floor on its refinement check.** A synchronous
   converter with ideal parts has M(R) flat to the last bits, so refining the
   grid compared one piece of rounding dust against another. The floor is a
   millionth of a millionth of the curve's own scale, which no real step can
   hide under. It is a shared test file, and the change is one helper and two
   call sites.

6. **The plant link's own range is mirrored here, and nothing pins the two
   together.** Control Lab's custom plant holds each of its six coefficients
   to 1e12 (`apps/control-lab/src/systems.js`), and a link outside that range
   arrives clamped. The averaging guard does not cover it: a buck at
   L = 10 µH, C = 1 µF and f_s = 2 MHz sits well inside f_s/5 and still needs
   b₀ = 1.2e12. `hiPanes.jsx` declines the hand-over there, with the reason,
   and carries `LINK_COEFF_LIMIT = 1e12` as its own constant. Control Lab's
   `fromLink.test.js` pins Circuit Lab's catalog names the same way, so the
   director should add the matching pin when the two labs are merged.
7. **Group F's inverters showed the same rounding dust the three-phase bridge
   did.** `App.smoke.test.js`'s femto probe ended its pattern with a literal
   backspace where a word boundary was meant, so it had never matched
   anything. Repaired during the review of Groups H and I, it found F2, F3 and
   F4 reading `i_L −10.2 fA` in the scope strip alongside the new groups' own
   `V_out −53.29 fV`. Both are fixed in `App.jsx` by formatting against the
   signal's own scale. The change reaches Group F's screens, which is outside
   these groups' lane, so it is named here.
