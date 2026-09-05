# What the Devices Lab needs from outside its own directory

The lab lives in `apps/devices-lab/` and in the additions this branch made to
`packages/network/src/junction.js`. Two shared surfaces are listed first.
Everything under "at release" is deliberately not done while `RELEASE_STATUS`
says `dark`, and `src/release.test.js` fails if any of it is.

## Devices overseer

### 1. The deploy line

`.github/workflows/deploy.yml` needs one line, after the Electronics Lab's:

```
cp -r apps/devices-lab/dist _site/devices-lab
```

The lab then ships unlinked at `/devices-lab/` for review. `release.test.js`
does not pin the line, because until the director integrates this branch the
line does not exist, and this test must not require an action that is not the
overseer's to take.

### 2. The progression test

`packages/ui/src/progression.test.js` belongs to the seams overseer. The
Devices Lab's entry is:

- Slug `devices-lab`, splash glyph `⌗`, short nav name **Devices**.
- **30 experiments in 7 groups.** Group A, "carriers and doping", ids `a1` to
  `a5`. Group B, "the junction in depth", `b1` to `b6`. Group C, "the MOS
  capacitor", `c1` to `c5`. Group D, "the MOSFET", `d1` to `d5`. Group E, "the
  BJT from two junctions", `e1` to `e4`. Group F, "the solar cell and the LED",
  `f1` to `f3`. Group G, "fabrication", `g1` and `g2`.
- No cross-lab reference by id in either direction yet. The lab's own
  `experiments.test.js` fails on a lesson that cites an experiment id this lab
  does not carry, so the hand-overs of the plan's §6 arrive with the labs they
  point at.

### 3. `junction.js`, and what the ruling allowed

The plan's Decision 3 routed this lab's engine additions through the director,
because `packages/network` belongs to the Electronics overseer (`PROGRAM.md`
§5). The ruling was that this lab may add exports to
`packages/network/src/junction.js`, change no existing signature, and keep every
existing test green. That is what landed, and
`packages/network/src/junction.test.js` runs unchanged as the regression.

Two things about it the director should record.

- **The plan's Decision 2 asked for a sibling `mos.js`.** The ruling named one
  file, so the MOS capacitor, the MOSFET, the transistor and the solar cell all
  went into `junction.js`. The file is now 830 lines. Splitting it is a
  refactor the Electronics overseer can take at any time, and nothing outside
  imports the file directly.
- **`packages/network/index.js` gained one re-export block.** Without it the
  app cannot reach the new functions, because the package exports only `.`. It
  adds names and removes none.

The exports added, in the order the file carries them:

```
carriers  niFrom  gapFrom  intrinsicAt  degenerate
profile  peakField  breakdown  saturationCurrent  debyeLength  driftDiffusion
oxideCap  bulkPotential  surfaceDepletion  flatBand  threshold  implantFor
bodyEffect  surfacePotential  mosCap  cvCurve  dopingFromRatio
drainCurrent  channelIntegral  subthreshold  velocitySaturation
gummel  earlyVoltage  photovoltaic  emission
implantDoping  doseFor
```

The constants beside them are `EPS_OX`, `N_C_SI`, `N_V_SI`, `H_PLANCK`,
`C_LIGHT`, `E_AVALANCHE`, `E_ZENER`, `DEGENERATE`, `GATES` and `MATERIALS`.

### 4. The profile canvas merges into the Fields Lab's field map

`PROGRAM.md` §4 names the field map with the Fields Lab first and this lab
second. The plan's Decision 5 says to adapt rather than build. That lab's canvas
is being built and its one-dimensional mode is not on the integration branch, so
this lab carries `apps/devices-lab/src/components/ProfileCanvas.jsx` in the
meantime.

It is written against the props that overseer was sent, so the merge is a
rename rather than a rewrite:

```jsx
<ProfileCanvas
  traces={[{ label, unit, at: (x) => value, colour }, ...]}  // one or more scalars
  from={metres} to={metres}                                  // the one position axis
  edges={[metres, ...]}                                      // region boundaries, ruled
  caption="the model, the bias, and the width"
/>
```

The three traces this lab draws are charge density, field and potential, and the
bias knob redraws all three because each `at` closes over the profile the knob
produced. At promotion the Fields Lab's field map takes `mode: 'profile'` with
this prop shape, this file is deleted, and `panes.jsx` changes one import. The
director resolves which of the two names survives.

### 5. Numbers this lab computed that the plan and other plans quote

Every number in the plan's §4.3 was recomputed from the running engine before it
was written into a lesson. Five moved, and the labs that quote them should quote
the measured ones.

- **The breakdown voltages.** The plan's 290.96 V, 29.096 V and 2.9096 V are the
  one-sided closed form. The engine keeps the `1/N_A` term, so the same
  junctions read 290.99 V, 29.125 V and 2.9387 V. The difference is exactly the
  doping ratio, and at 10¹⁷ cm⁻³ that is one part in a hundred.
- **The Early voltage.** 69.954 V, not the plan's 69.888 V. The plan rounded the
  edge's rate to 7.1543 nm/V before dividing, and the rate is 7.14757 nm/V.
- **`n_i` at 250 K and 400 K.** The plan's 1.08 × 10⁸ cm⁻³ and 3.74 × 10¹² cm⁻³
  were computed from the band-edge value of `n_i`, which contradicts the plan's
  own Decision 1. Carried at the pinned constant they are 1.499 × 10⁸ cm⁻³ and
  5.193 × 10¹² cm⁻³. The ratio across the range, 34 641, is what A3 quotes and
  it does not depend on the constant.
- **The depletion approximation's error at the edges.** The plan's 8 % divides
  the heavily doped side's Debye length by the whole width. Each side has its
  own Debye length, and the two tails against the width they sit in give 16.4 %
  at the plan's junction. B1 quotes the second.
- **Invariant 5's stated tolerance.** The plan asks for `n ≈ N_D` to 10⁻⁶ above
  100 `n_i`. The departure is the square of the ratio, so 100 `n_i` buys 10⁻⁴
  and 10⁻⁶ needs 1000 `n_i`. The test states the relation and lets both
  thresholds follow from it.

### 6. `npm ci` does not run on this branch

`package-lock.json` is out of sync with the workspaces: `@ee-labs/machines`,
`@ee-labs/random`, `electronics-lab`, `energy-lab`, `machines-lab` and
`random-lab` are all missing from it. `npm ci` refuses, and `npm install` is
what an overseer has to run instead. This lab did not commit the lock file it
regenerated, because the lock is not this lab's to change. The director
regenerates it once at integration, with `apps/devices-lab` in it.

## At release: flip `RELEASE_STATUS` to `released`, then `release.test.js` demands

1. **Splash page** `site/index.html`: a lab card linking `devices-lab/`, with
   the glyph `⌗`, in the style of the other cards.
2. **README** `README.md`: a row in *The tools* table. The lab covers carriers
   and doping, the junction's charge, field and potential, the MOS capacitor and
   the MOSFET over it, the transistor from two junctions, the solar cell and the
   LED, and fabrication. The experiment count goes in the row.
3. **Nav** `packages/ui/src/LabNav.jsx`: `{ id: 'devices-lab', label: 'Devices' }`
   in `LABS`. Until then the lab passes `currentLabel="Devices"` so its own nav
   names it without the released labs listing it back.
4. **Usage counter** `apps/devices-lab/index.html`: the GoatCounter tag the
   other labs carry. Add the page to the pinned list in
   `packages/ui/src/analytics.test.js` at the same time.

## Two decisions that are still Reed's

Both are the plan's, and this lab built to the plan as the director directed.

- **The value of `n_i`** (plan Decision 1). `N_I_300` stays at 1.5 × 10¹⁶ m⁻³,
  and A2 makes the spread the content. It prints 1.079 × 10¹⁰ cm⁻³ beside the
  constant, the ratio of 1.390, and the 1.103 eV gap the pinned value implies.
  If Reed prefers the computed value, every Electronics Group C pin moves with
  it, and invariant 6 is the regression that would catch it.
- **The threshold implant** (plan Decision 4). C5 derives 321.769 mV and lands
  on 700.000 mV with a dose of 8.152 × 10¹¹ cm⁻². The cross-lab pin is written
  against `MOSFET_DEFAULTS.vt` from `packages/network`, so it fails the day the
  Electronics Lab moves its threshold.
