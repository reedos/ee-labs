# What the Instruments Lab needs from outside its own directory

The lab lives entirely in `apps/instruments-lab/`. It owns no package. Nothing
else in the repo has been changed to build it, and the four items below are what
the director applies at integration. Everything under "at release" is
deliberately not done while `RELEASE_STATUS` says `dark`, and
`src/release.test.js` fails if any of it is done early.

## 1. The deploy line (director, `.github/workflows/deploy.yml`)

One line in the "Assemble the site" step, after the Power Lab's:

```
cp -r apps/instruments-lab/dist _site/instruments-lab
```

`src/release.test.js` accepts the line here in `NEEDS.md` until the workflow
carries it, and then pins the workflow.

## 2. The progression entry (seams overseer, `packages/ui/src/progression.test.js`)

Twenty-five ids in six groups, in course order. The lab's own
`src/course.test.js` already pins the counts and the thread.

```
instruments-lab: 25 experiments in 6 groups
  A · The oscilloscope’s input   6   a1 a2 a3 a4 a5 a6
  B · The sampling scope         2   b1 b2
  C · The multimeter             5   c1 c2 c3 c4 c5
  D · The spectrum analyser      4   d1 d2 d3 d4
  E · The lock-in amplifier      4   e1 e2 e3 e4
  F · Uncertainty                4   f1 f2 f3 f4
```

Hand-overs this lab names, for the seam table. Each is prose in a `why`, not a
link, until the seams overseer lands `handOverEvent`:

- Elements F4 → A2, the Thévenin time constant as a probe's bandwidth.
- Elements E4/E5 → C2, the follower as a meter's input buffer.
- Signal Lab's Sampling → B1 and B2, aliasing with a spectrum beside it.
- Signal Lab's Resolution needs time → D3, the same trade in a frame length.
- Circuit Lab's order group → B2, what a steeper anti-alias filter costs.

## 3. Package contracts (`packages/network`, owned by the Electronics overseer)

Nothing is missing. Every experiment is built from `R`, `C`, `L`, `V`, `I`,
`OPAMP` and `VCCS` as exported today, with `solveDC`, `solveAC`, `sweepAC`,
`transient`, `thevenin`, `meanRms`, `extrema`, `crossings` and `omegaOf`. Three
observations, none of them a request:

1. **`transient`'s floor at long horizons.** B1 reads the exact solution at the
   sample instants and compares it against the analytic alias. At the defaults
   the two agree to a part in 10¹⁴. Swept across every knob's range, with
   windows of a few hundred drive cycles, the worst gap rises to 6 × 10⁻¹² of
   the tone. The math row is judged at 10⁻¹⁰ of it and says why. If the solver
   ever carries an error bound of its own, that row should read it instead of a
   constant.
2. **A multiplier element is not needed.** The lock-in's mixer is written as the
   two sinusoids its product is, exactly (the plan's §2.4), so E1 to E4 are
   ordinary linear circuits and `transient` solves them without a new element.
   If a later lab wants a four-quadrant multiplier as a component, this lab's
   `groups/e.js` is the second consumer to name in that contract.
3. **`sweepAC` reads only sine sources.** A square- or step-driven experiment
   sweeps as the phasor zero at every frequency, silently. This lab keeps a sine
   in every experiment that declares a `sweep` (A4 is the square wave and has
   none), and `experiments.test.js` would not have caught the mistake. A guard
   in `sweepAC` would catch it for every lab at once, by refusing or warning
   when the only source carries a wave that is not a sine.

## 4. At release: flip `RELEASE_STATUS` to `released`, then `release.test.js` demands

1. **Splash page** `site/index.html`: a lab card linking `instruments-lab/`, in
   the style of the Signal/Circuit/Control cards.
2. **README** `README.md`: a row in *The tools* table. The lab covers the scope
   input and its probe, the sampling scope, and the multimeter's divider, shunt
   and four-wire ohmmeter. It also covers the spectrum analyser as a swept
   filter, the lock-in amplifier, and the error bar around a reading. Twenty-five
   experiments in all.
3. **Nav** `packages/ui/src/LabNav.jsx`: `{ id: 'instruments-lab', label:
   'Instruments' }` in `LABS`. Until then the lab passes
   `currentLabel="Instruments"` so its own nav names it without the released
   labs listing it back.
4. **Usage counter** `apps/instruments-lab/index.html`: the GoatCounter tag the
   other labs carry, and `apps/instruments-lab/index.html` added to the pinned
   page list in `packages/ui/src/analytics.test.js`. While dark the page carries
   no tag, so review visits do not count as traffic.

## 5. What the browser pass found outside this lab

Three defects the verification sitting found in shared code. Each is worked
around inside `apps/instruments-lab/` and none of the workarounds belongs in
the package.

1. **`packages/ui` `fmt` prefixes a unit that cannot take one.** `fmt(0.5, '%')`
   is `"500 m%"`, and `fmt(0.1, '')` is `"100 m"`. This lab's topbar carried
   both until `src/format.js` stopped sending a ratio, a per cent, a multiple,
   a degree and a decibel through it. `packages/ui/src/format.js` already
   carries the note that names the fault, in `fmtNum`'s comment. Every lab that
   prints a unitless quantity through `fmt` has it.

2. **`Schematic` draws a driven source's resting value.** A source is written
   `{ type: 'V', value: 0, wave: sine(p.A, p.f) }`, and `valueText` in
   `schematicGeometry.js` prints `value`, so every sine source in this lab was
   labelled "V₁ 0 V" beside an amplitude knob reading 1 V. `drawables` in
   `src/experiments.js` now relabels the drawn copy with the wave's amplitude.
   The proper fix is for `valueText` to read `wave`, which would also let the
   symbol say that the source is driven. Signal, Circuit and Power all draw
   wave sources.

3. **`equations` prints "v = 0" for a driven source.** The `V` case in
   `packages/network/src/equations.js` writes `0` when `eff.value === 0`, which
   is true of every wave source, so the constraint row read `v_tip = 0` beside
   a schematic reading `v_tip = 1 V`. This lab hands the pane a netlist whose
   wave sources carry their instantaneous value, which turns the row into
   `v_tip = E_1`. A source that carries a wave should print its own symbol.

Two things this lab wants and has not asked any package for:

- **The equations pane cannot show an AC solve.** `equations` renders the real
  DC system, and its KCL rows treat a capacitor as an open. So the six
  experiments that read their meters from the steady state (`analyse`'s `snap`)
  show the system without live numbers. Rendering the phasor system would need
  complex terms in `equations`, and this lab has not sized that work.
- **A3 cannot become a dynamic experiment.** Two capacitors and an ideal source
  in one loop have no state space, and `transient` declines it with the reason.
  That is the plan's own decision (`AGENT_BRIEF.md` §8) and it is why A3 reads a
  steady state rather than a cursor.

## Not needed

- No changes to `packages/ui`, `packages/explain` or `packages/prose`. The lab
  uses `NumField`, `Schematic`, `schematicGeometry`, `LabNav`, `ReportIssue`,
  `LessonNav`, `TryLine`, `useCanvas`, `plot.js`, `anchor.js`, `format.js`,
  `units.js` and `MathPanel` as exported today.
- No new package. The two views this lab builds, the error bar and the
  contributions bars, live in `src/components/` until a second lab claims them.
  The Applied Analog Lab's specification pane is the error bar's second home,
  and the plan's §8 says so.
- Nothing from the RF Lab yet. The network-analyser group is not built. It
  waits on the Smith chart and the line model, and `BACKLOG.md` carries the
  entry.
