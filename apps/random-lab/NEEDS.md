# Random Signals Lab: what it needs from elsewhere

Everything this lab needs that it does not own. `PROGRAM.md` §1 says two
overseers who need the same thing write it here, and the director resolves it
once. Nothing in this file has been changed outside this lab.

## 1. The deploy line

One `cp` line in `.github/workflows/deploy.yml`, added by the director at
integration, beside the other dark labs:

```
cp -r apps/random-lab/dist _site/random-lab
```

The lab reads `dark` in `apps/random-lab/RELEASE_STATUS`, so it is built and
served at its URL and linked from nowhere. `release.test.js` enforces that
nothing a visitor sees mentions it, and it also enforces that this file carries
the line above.

## 2. The progression test

For `packages/ui/src/progression.test.js`, which the seams overseer owns.

**Counts.** The lab has 30 experiments in 9 groups.

| Group | Header | Count | Ids |
| --- | --- | --- | --- |
| A | A random signal, and the density that describes it | 4 | A1 to A4 |
| B | Expectation and variance | 3 | B1 to B3 |
| C | The Gaussian, and why it keeps appearing | 3 | C1 to C3 |
| D | Autocorrelation, the density, and ergodicity | 4 | D1 to D4 |
| E | The periodogram and its averages | 4 | E1 to E4 |
| F | White noise through a filter | 4 | F1 to F4 |
| G | Estimation, and the interval | 3 | G1 to G3 |
| H | Detection | 3 | H1 to H3 |
| I | The Wiener and Kalman filters | 2 | I1 and I2 |

**The ids other labs will reference.**

- `A1`, a random signal has a density. The Electronics Lab's O1 cross-references
  this by id.
- `F3`, kT over C. The Electronics Lab's O2 cross-references this by id.
- `H1` to `H3`, the matched filter and the error rate. The Communications Lab
  opens on these.
- `I2`, the Kalman gain. Control Lab II opens on this.

**What this lab references outward.** Signal Lab's Filters group and its FFT
vocabulary, by name and not by id, as Power Lab does. This lab references no
experiment id in a lab that is not built, so no cross-reference here can fail
the progression test today.

## 3. Promotion candidates for packages/ui

### EnsembleCanvas

`PROGRAM.md` §4 names the ensemble view as a new canvas whose first lab is this
one and whose second is the Applied Analog Lab's Monte Carlo. It lives in
`apps/random-lab/src/components/EnsembleCanvas.jsx` and moves to `packages/ui`
when the second lab claims it.

Its props already carry the second lab's needs, as §4 requires. The director
asked for two of them by name, and `APPLIED_ANALOG_LAB_PLAN.md` §4.3 is where
they come from:

- **`band={{ lo, hi, label }}`.** A pass/fail region, drawn behind the runs so
  the runs stay readable over it. Both edges are drawn as dashed lines and the
  label names the region.
- **`count={{ pass, n, stderr }}`.** How many runs met the band, out of how
  many, with the standard error of the fraction. The corner reads
  "1917 of 2000, 95.9 % ± 0.4 %" rather than a bare percentage. A yield printed
  without its standard error invites a reader to act on a digit that is not
  there, and this is the view where that is most tempting.

The other props are `ensemble`, `x`, `y`, `show`, `level`, `highlight`,
`target` and `onPickRun`. `show.spread` draws the statistical spread of the
process and is named apart from `band` deliberately. One is a specification a
designer chose and the other is a property of the process, and a canvas that
called both a band would imply the first is the second.

**One thing for the director to settle at promotion.** The two plans describe
the same canvas with different data props. This lab passes `ensemble` (the
object `@ee-labs/random` returns), `x` and `y`. `APPLIED_ANALOG_LAB_PLAN.md`
§4.3 passes `runs` (an array of `{ x, y }`), `summary` and `axes`. `band` and
`count` are identical in both, so only the data shape is open.

The two labs do not negotiate that between themselves. Whichever shape the
director picks, this lab adapts its call site. The arguments each way are these.
The `ensemble` object carries `quantileBand` and `withinSpec` as methods, which
an array of runs cannot. An array of `{ x, y }` lets each run carry its own
horizontal axis, which a Monte Carlo over part values may want and this lab does
not.

### The estimate readout

`components/panes.jsx` exports `Closed`, `Estimate` and `Against`. `Estimate`
cannot render without an interval, which is this lab's discipline made
structural. Any lab that prints a measured quantity would benefit, and the DSP
Lab's spectral estimation group is the likely second caller. Not urgent.

## 4. Package needs

None. `@ee-labs/random` is this lab's own package and is complete against the
plan's §3. `@ee-labs/dsp` is used unchanged, for `fft` and `windowFn` only, and
this lab has not edited it.

## 5. Notes for the Electronics overseer

Group O should import `@ee-labs/random` rather than writing a second generator
or a second periodogram.

- **O1** calls `whiteNoise({ n, sampleRate, rms, seed })` and
  `averagedPeriodogram(x, sampleRate, { segment, window })`. It reads `asd`,
  `integral`, `flatness` and `ci`. The Electronics plan's 6.45 µV/√Hz is
  6.4550 µV/√Hz from this function, and the integral returns 0.996 mV at 100
  averages.
- **O2** calls `capacitorNoise({ R, C, T })`. The Electronics plan's 2.04 µV is
  2.035 µV from this function, and `viaBandwidth` is the same number reached
  through the noise bandwidth.
- **O3** calls `shotDensity(I)`. 1 mA gives 17.9007 pA/√Hz.
- One caution. The `(π/2) f_c` noise bandwidth is exact for an analogue single
  pole. A sampled first-order filter has its own, given by
  `firstOrderLowpass(fc, fs).enb`, and the two differ by 11 % at a corner of
  `f_s/24`. `enbRatio` is the guard, and a pane that quotes the analogue figure
  for a sampled filter should print it.

The contracts are frozen in `apps/random-lab/AGENT_BRIEF.md` §3.5 and §3.6.
