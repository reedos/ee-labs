# Photonics Lab: build brief

The plan is `/PHOTONICS_LAB_PLAN.md`, and this brief turns it into lanes an agent
can take without colliding with another. Read the plan's §2 (engine) and §5
(curriculum) for your lane before writing a line. Reed reviews everything.

Every number in this brief was computed by `scripts/pins.mjs` before it was
written. Run `node apps/photonics-lab/scripts/pins.mjs` from the repository root
to reproduce all of them. A figure that is not in that script's output is not a
figure this lab may quote.

## Boundaries: read first

- **One lane per agent, one worktree per agent.** The overseer works on
  `lab/photonics-lab`. A worker takes one lane, edits only that lane's files, and
  hands the result back. Workers do not commit.
- **Edit only the files your lane owns** (§1). Everything else is read-only. A
  change you need outside your lane goes into `apps/photonics-lab/NEEDS.md` under
  your lane's heading, and the owner picks it up.
- **Stage by path.** `git add packages/photonics/src/rate.js`, never
  `git add -A`, and never `commit -a`.
- **Never push.** The director merges `lab/photonics-lab` at integration.
- **Preview port.** Lane number plus 4340, so lane 3 previews on 4343.

## The house discipline

Read `/CORE_SCOPE.md`, `/STYLE.md` and `/REVIEW_PLAYBOOK.md` first. Then the rule
every lab obeys. **Every explanatory sentence is a claim about physics, and a
test must measure it.** A lesson quotes no number the engine does not produce. A
number is a function of the knobs in the test, never a constant typed beside it.
On-screen text passes `node packages/prose/bin/lint.mjs`.

Commit messages are narrative. Read `git log` for the register. No model name
appears in a commit or a file.

## 1. The lanes

The plan's §9 phases the build so that the groups with no unbuilt dependency ship
first. Lanes 1 to 4 are this sitting. Lanes 5 to 8 wait on the engine modules
their row names.

| Lane | Work | Owns | Starts | Exit |
| --- | --- | --- | --- | --- |
| 1 | The engine, phases 1 and 2 | `packages/photonics/` entire | now | invariants 1, 2, 9, 10, 11 and 12 fuzzed green, §3's contracts met |
| 2 | The app shell | everything in `apps/photonics-lab/` not owned by lanes 3 and 4, plus `RELEASE_STATUS` and `release.test.js` | after lane 1's contracts land | the shell loads at 390 px with no sideways scroll, the release test passes dark |
| 3 | Groups A and E | `src/groups/{a,e}.js`, `src/lessons/{a,e}.js`, `src/terms/{a,e}.js` | after lane 2's skeleton | every A and E number in §6 pinned |
| 4 | Group F | `src/groups/f.js`, `src/lessons/f.js`, `src/terms/f.js`, `src/components/CavityCanvas.jsx` | after lane 2's skeleton | F1 and F2 pinned, the refusal message tested |
| 5 | `rate.js`, then Groups C and D | `packages/photonics/src/rate.js`, `src/groups/{c,d}.js`, `src/lessons/{c,d}.js` | next sitting | invariants 4 to 8 green, the guard measured at five depths |
| 6 | `receiver.js`, then Group B | `packages/photonics/src/receiver.js`, `src/groups/b.js`, `src/lessons/b.js` | next sitting | invariant 3 green, B3's two sensitivities pinned |
| 7 | The link view, finished | `src/components/LinkCanvas.jsx` and the waterfall it shares | after the System Lab's waterfall lands | the budget's sum equals the System Lab's for the same line items |
| 8 | The verify harness | `scripts/verify.mjs` | after lane 4 | every view screenshot at 390 px and at 1280 by 900 |

**The gate.** Groups B, C and D need `receiver.js` and `rate.js`, which lane 1
does not build. No lesson in this sitting references an experiment in those
groups, and `progression.test.js` fails on such a reference by design.

**Shared seams.** `packages/photonics` is a new package and its listing in
`EE_LABS_MAP.md` §3 is the director's, per `PROGRAM.md` §5. The deploy line, the
progression ids and the waterfall component are in `NEEDS.md`, and the director
resolves each once.

## 2. The app skeleton (lane 2)

The Fields Lab's shape, file for file, with what this lab does not need deleted.

```
apps/photonics-lab/
  index.html  package.json  vite.config.js  RELEASE_STATUS (dark)
  scripts/pins.mjs
  src/App.jsx  main.jsx  styles.css
  src/experiments.js      merges groups/*.js in plan order, no prose
  src/lessons.js          merges lessons/*.js, and readQuantity
  src/groups/{a..f}.js    one file per group, owned by that group's lane
  src/lessons/{a..f}.js   the see, try and why registers, same owner
  src/terms.js            definitions on contact, one registry per group file
  src/knobs.js            the knob shapes every group builds from
  src/math.js             one analysis per experiment kind
  src/format.js           every number a reader sees comes through here
  src/report.js           the issue link's summary
  src/release.test.js  experiments.test.js  prose.test.js  terms.test.js
  src/components/         LinkCanvas, CavityCanvas, PulseCanvas, panes.jsx
```

`experiments.test.js` is the Fields Lab's file with §5's paths added. Copy it,
and do not rewrite it. The schematic is `Schematic.jsx` from `@ee-labs/ui`, given
a layout and live meters, with no new prop.

## 3. Contracts

Every signature below is a promise between lanes. A lane may add to a return
shape. A lane never renames or removes one. Each contract ships with the failing
test named beside it, written before the implementation.

### 3.1 The photon and the detector (lane 1, `photon.js`)

```js
export const EV_UM                                    // h c / q, 1.239842 eV um
export function photonEnergy(lambda)                  // joules
export function photonEnergyEv(lambda)                // electronvolts
export function opticalFrequency(lambda)              // hertz
export function responsivity({ eta, lambda })         // amps per watt
export function idealResponsivity(lambda)             // the eta = 1 ceiling
export function quantumEfficiencyOf({ responsivity, lambda })
export function cutoffWavelength(egEv)                // metres
export function photonFlux({ power, lambda })         // photons a second
export function photocurrent({ eta, lambda, power, dark })
export function darkCrossover({ eta, lambda, dark })  // watts
export function detectorCapacitance({ area, cPerArea })
export function detectorCorner({ load, capacitance }) // hertz
export function collectedPower({ irradiance, area })
export function photodiodeNet({ eta, lambda, power, dark, bias, load, is, n })
```

`photodiodeNet` returns `{ iph, dark, elements }`. The elements are a `V` bias
source, an `R` load, an exponential `D`, and two `I` sources. The node names are
`bias` and `k`, and a lesson's meter reads them. Nothing new is added to
`packages/network` `KINDS`, which is that package's owner's to change.

Test: `photon.test.js` checks each closed form against the same physics written
a second way, and `invariants.test.js` holds invariants 1 and 2.

### 3.2 The fibre (lane 1, `fibre.js`)

```js
export const CRITERION                                 // 0.25, the B sigma criterion
export const V_CUTOFF                                  // 2.405
export const LINK_ITEMS                                // the seven named line items
export function lossDb({ alpha, length })              // dB, alpha in dB/km, length in km
export function powerRatio(db)                         // the fraction that survives
export function throughFibre({ alpha, length, power })
export function pulseSpread({ D, length, dLambda })    // seconds
export function beta2FromD({ D, lambda })              // ps2/km
export function dFromBeta2({ beta2, lambda })          // ps/(nm km)
export function bandwidthLimit({ spread, criterion })  // { rate, criterion }
export function bandwidthDistance({ D, dLambda, criterion })
export function numericalAperture({ n1, n2 })
export function acceptanceAngle({ n1, n2, n0 })        // degrees
export function indexContrast({ n1, n2 })
export function vNumber({ a, n1, n2, lambda })
export function singleModeCore({ n1, n2, lambda, vc })  // { radius, diameter }
export function modeCount(V)                            // { modes, ok, threshold, says }
export function linkBudget({ pinDbm, sensitivityDbm, losses })
export function lossLimitedReach({ pinDbm, sensitivityDbm, fixedDb, reserveDb, alpha })
export function dispersionLimitedReach({ rate, D, dLambda, criterion })
export function bindingLimit({ loss, dispersion })      // { reach, binds }
export function gridWavelength({ lambda, spacing })     // metres
export function bandChannels({ lambdaLow, lambdaHigh, spacing })
```

Units are stated once and never mixed. Fibre lengths are in kilometres and
attenuation is in dB/km, because that is how a fibre is specified. Wavelengths,
core radii and spreads are SI.

`linkBudget` returns every name in `LINK_ITEMS`. An item the caller does not give
comes back at zero, so a loss the model leaves out is a zero on the record. Modal
noise, the reflection penalty and mode-partition noise are the three that are
always zero in this lab.

Test: `fibre.test.js` checks the closed forms, the composition of loss and
spread, and the refusal of a cladding index above the core's.

### 3.3 The cavity (lane 1, `cavity.js`)

```js
export const LINEWIDTH_GUARD                           // finesse 10
export function facetReflectance({ n, n0 })
export function freeSpectralRange({ n, length })        // hertz
export function fsrWavelength({ n, length, lambda })    // metres
export function roundTrip({ R1, R2, lossInternal, length })
export function finesse(spec)
export function linewidth(spec)                         // fsr over finesse
export function halfPowerWidth(spec)                    // the exact width
export function linewidthGuard(spec)                    // { value, threshold, ok, error, says }
export function contrast(spec)                          // { ratio, db }
export function roundTripPhase({ n, length, freq })      // radians
export function airy({ phase, R1, R2, lossInternal, length })
export function transmissionAt({ n, length, freq, R1, R2 })
export function spectrum({ n, length, centre, span, points, R1, R2 })
export function mirrorLoss({ R1, R2, length })          // per metre
export function photonLifetime({ n, length, R1, R2, lossInternal })
export function rationalAvailable()                     // { ok: false, says }
export function refuseRational()                        // throws PhotonicsError
```

The linewidth has a guard, which the plan did not anticipate. The standard form,
the free spectral range over the finesse, is the half-power width of the Airy
peak only when the round trip loses little. At a bare facet it is 7.35 per cent
narrow, and at a facet of 0.9 it is 0.0463 per cent narrow. `linewidthGuard`
measures the difference and gives its verdict at a finesse of 10.

Test: `cavity.test.js` checks the periodicity, the peaks, the guard at both sides
of its threshold, and the refusal message. `invariants.test.js` holds invariants
11 and 12.

### 3.4 What lane 1 does not build

`receiver.js` and `rate.js` are lanes 6 and 5. Nothing in this sitting imports
them, and no lesson names an experiment in Groups B, C or D. A lane that needs a
laser number before lane 5 lands writes the need into `NEEDS.md` and stops.

## 4. The library circuits and their fixed names

An experiment that draws a schematic builds it from `photodiodeNet`, so the node
names are the same in every group. The layout is the owning lane's, on the 420 by
180 grid the other labs use.

```js
// A2, A4, A5: the photodiode into its load, reverse biased
photodiodeNet({ eta: p.eta, lambda: p.lambda, power: p.power, dark: p.dark, bias: p.bias, load: p.load })
// nodes: 'bias' at the top of the source, 'k' at the cathode, 'gnd' at the anode
// elements: VB, RL, D1, Iph, Idark

// E5: the link, as three blocks and a budget
{ pinDbm: p.pinDbm,
  sensitivityDbm: p.sensitivityDbm,
  losses: { fibre: lossDb({ alpha: p.alpha, length: p.length }),
            connectors: p.connectors, splices: p.splices, dispersion: p.penalty } }

// F1: the cavity, as an index, a length and a facet
{ n: p.n, length: p.length, R1: p.R1, R2: p.R1, lossInternal: p.lossInternal }
```

## 5. The lesson schema, and the quantity paths

The Fields Lab's `lessons.js` header comment and its three registers, unchanged.
They are `see` (at most 70 words), `try` (each step at most 45 words, with `set`
and `reads`) and `why` (at most 160 words). An experiment entry carries `id`,
`group`, `kind`, `name`, `terms`, `params`, `view`, `views` and `headline`.

A `reads` pair names a path into the analysis. These are the paths this lab
carries, and `experiments.test.js` fails on a path it cannot resolve.

```
photon.<energyEv|energyJ|frequency|flux>        the photon, group A
detector.<responsivity|ideal|cutoff|eta>        the detector's closed forms, group A
detector.<current|dark|crossover>               the photocurrent and the leakage
circuit.<current|node|junction|residual>        the solved photodiode, group A
speed.<capacitance|corner|collected|product>    area against bandwidth, A5
fibre.<db|ratio|out>                            attenuation, E1
spread.<ps|beta2|D>                             dispersion, E2
limit.<rate|product|criterion>                  the bandwidth limit, E3
geo.<na|angle|delta|V|singleMode|modes>         the guided geometry, E4
budget.<loss|out|margin|item.NAME>              the link budget, E5
reach.<loss|dispersion|binds>                   which limit binds, E5
cavity.<fsr|fsrNm|finesse|linewidth|exact|contrast|mirrorLoss|tau>   F1
cavity.<guard.error|guard.ok>                   the linewidth guard, F1
wdm.<gridNm|bandHz|channels>                    many colours, F2
refusal                                         the sentence the hand-over gives
headline.value                                  whatever the experiment is about
```

## 6. What each lane pins

Every number in the plan's §5 for your groups becomes a `reads` pair checked in
`experiments.test.js`. Each is a function of the knobs, computed in the test.

| Lane | Pins |
| --- | --- |
| 3, Group A | 0.79990 eV, 0.94644 eV and 1.45864 eV. 193.41 THz. 7.8029e15 photons a second. 1.0011 µA at four bias voltages, and 10.000 fA taken back. 1.00013, 0.84527 and 0.54846 A/W. 1107.0 nm. 2.0001 nA at a nanowatt, and 0.99987 nW at the crossover. 31.831 MHz at 5.0000 pF, and 0.31831 W Hz that area does not move |
| 3, Group E | 16.000 dB, 28.000 dB and 160.00 dB, and 2.5119e-2 surviving. 1360.0 ps and 136.00 ps. −21.683 ps²/km and −15.488 ps²/km. 0.18382 Gbit/s and 14.706 Gbit/s km. 0.12461, 7.1582°, 0.36051 % and 9.5224 µm. 23.028 and 265 modes. 18.400 dB, −21.400 dBm and 6.6000 dB. 98.000 km against 1.4706 km |
| 4, Group F | 0.30864, 142.76 GHz and 1.1440 nm. 2.5245, 29.804 and 312.58. 56.549 GHz quoted against 61.035 GHz exact. 5.3769 dB, 25.575 dB and 45.977 dB. 19.593 per cm and 5.9587 ps. 0.80139 nm, 4.3821 THz and 43 channels |
| 5, Groups C and D | the plan's §4.3 source and laser figures, when `rate.js` lands |
| 6, Group B | the plan's §4.3 noise and sensitivity figures, when `receiver.js` lands |

## 7. Verify before every hand-back

```
npx vitest run apps/photonics-lab packages/photonics --maxWorkers=2
node packages/prose/bin/lint.mjs apps/photonics-lab/AGENT_BRIEF.md apps/photonics-lab/NEEDS.md
npm run build --workspace apps/photonics-lab
node apps/photonics-lab/scripts/pins.mjs
```

Ten agents share four cores, so `--maxWorkers=2` is not optional. Run the scoped
suite, never the whole one.

## 8. Gotchas the other labs paid for

- Fibre lengths are kilometres and wavelengths are metres. A function that takes
  both says so in its own comment, and a caller that mixes them gets a number
  that is a thousand times wrong and looks plausible.
- A KCL residual is judged against the scale of the node equation, which is the
  bias over the load, not against the nanoamp the light happens to make. A fixed
  epsilon has cost this suite a day already.
- An optical frequency is 2e14 hertz, and a round-trip phase at that frequency
  runs to millions of radians. The difference of two of them carries the rounding
  of the larger, so a periodicity test needs a tolerance of 1e-8 and not 1e-15.
- Engineering-notation fields read a bare number in the displayed prefix. Harness
  code types explicit prefixes, as "0.2" and "1550n".
- Wherever two numbers are shown as equal, ask what could make them differ
  silently. Then remove the cause, or print it.
- The dark launch is enforced by a test. While `RELEASE_STATUS` says `dark`,
  nothing outside `apps/photonics-lab/` mentions the lab, and the release test
  fails when anything does.
