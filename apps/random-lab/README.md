# Random Signals Lab

Probability and random processes for electrical engineers, on Signal Lab's
chain. Thirty experiments in nine groups, from a histogram approaching a density
to the Kalman gain as a variance ratio.

The plan is [`/RANDOM_LAB_PLAN.md`](../../RANDOM_LAB_PLAN.md) and the build
brief is [`AGENT_BRIEF.md`](AGENT_BRIEF.md). The engine is
[`packages/random`](../../packages/random).

```
npm run dev --workspace apps/random-lab      # port 1426
npm run build --workspace apps/random-lab
npx vitest run apps/random-lab
```

## What it covers

| Group | Teaches | Count |
| --- | --- | --- |
| A | a random signal has a density, the seeded source, the histogram at one over root N | 4 |
| B | expectation, variance, and the sample variance's own interval | 3 |
| C | the Gaussian, the central limit theorem, the Q function | 3 |
| D | autocorrelation, Wiener-Khinchin, ergodicity and a process without it | 4 |
| E | the periodogram, averaging, the chi-square interval, the integral | 4 |
| F | white noise through a filter, noise bandwidth, kT over C | 4 |
| G | the sample mean, coverage, Monte Carlo and yield | 3 |
| H | the matched filter, 2E over N0, the error rate against the count | 3 |
| I | the Wiener filter and the Kalman filter | 2 |

## Which of its objects are admissible

Restated for this lab, as `CORE_SCOPE.md` asks of every new app.

**Exact, printed with no hedge.** The Q function, the error rate closed forms,
`|H|² S`, `kT/C`, `2E/N0`, the noise bandwidth of a first-order stage, the
Wiener weight, the Kalman steady-state gain, and every mean and variance in the
distribution registry. These are formulas, and the lab prints them bare.

**Guarded by an interval.** Every quantity computed from data. The sample mean,
the sample variance, a counted proportion, a histogram bar, an averaged
periodogram bin, and a Monte Carlo yield. The interval is the guard required by
`CORE_SCOPE.md` Rule 3, and the readout component cannot render one of these
without it.

**Approximated, with the threshold stated.** The analogue `(π/2) f_c` noise
bandwidth, used to describe the sampled first-order filter. It is 11 % out at a
corner of `f_s/24` and within 1 % below `f_s/320`, and `enbRatio` is printed
beside it. The averaged periodogram's degrees of freedom under overlapping
segments, where `dofExact` reads false.

**Declined, with the reason.** A stationary variance for a random walk, which
has none. `stationaryVariance` throws and names the reason, and the Kalman pane
prints that reason where the comparison would have gone. Spectral estimation by
a fitted model, which belongs to the DSP Lab.

## The dark launch

`RELEASE_STATUS` reads `dark`. The lab is built and served at `/random-lab/` and
linked from nowhere. `src/release.test.js` enforces that, and Reed alone changes
the file.
