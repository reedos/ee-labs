# Photonics Lab: build brief

You are one of up to six agents building this lab in parallel. The plan is
`/PHOTONICS_LAB_PLAN.md`, and this brief turns it into lanes an agent can take
without colliding with another. Read the plan's §2 (the engine) and §5 (the
curriculum) for your lane before writing a line. Reed reviews everything.

Two sittings are built. Groups **A**, **C**, **D**, **E** and **F** ship,
twenty-one experiments, and `packages/photonics` holds `photon.js`,
`fibre.js`, `cavity.js`, `source.js` and `rate.js`. Group **B** is the only
one left, and it waits on the Electronics Lab's Group O. What follows names
what is done, what is contracted, and what is left.

## Boundaries: read first

- **One lane per agent, one worktree per agent.** `PROGRAM.md` §2. The worktree
  gets its own `npm ci`, so `@ee-labs/photonics` resolves inside it.
- **Edit only the files your lane owns** (§1). Everything else is read-only. If
  you need a change outside your lane, write it into
  `apps/photonics-lab/NEEDS.md` under your lane's heading, commit that, and
  continue with what you can do.
- **Stage by path.** `git add packages/photonics/src/rate.js`, never
  `git add -A` and never `commit -a`. Never push.
- **Never edit a shared surface.** `site/`, `README.md`,
  `packages/ui/src/LabNav.jsx`, `.github/workflows/deploy.yml`,
  `CURRICULUM.md`, `packages/ui/src/progression.test.js`, `PROGRAM.md`. Write
  what they need into `NEEDS.md`.
- **Preview port 4181.** `scripts/verify.mjs` drives it.

## The house discipline (non-negotiable)

Read `/CORE_SCOPE.md`, `/STYLE.md` and `/REVIEW_PLAYBOOK.md` first. Then the
rule every lab obeys. **Every explanatory sentence is a claim about physics, and
a test must measure it.** A lesson quotes no number the engine does not produce.
A prediction follows every control that can change it. A claim the settings
cannot show is footnoted rather than crossed out. On-screen text passes
`npm run lint:prose`.

Commit messages are narrative. Read `git log` for the register. Never put a
model name in a commit or a file.

## 1. The lanes

| Lane | Work | Owns | Starts | Exit |
| --- | --- | --- | --- | --- |
| 1 | Photons and the fibre | `packages/photonics/src/{const,photon,fibre,fuzz}.js` and their tests, `src/groups/{a,e}.js`, `src/lessons/{a,e}.js` | **done** | invariants 1, 2, 9 and 10 green, every A and E number pinned |
| 2 | The cavity and the shell | `packages/photonics/src/cavity.js` and its test, `src/groups/f.js`, `src/lessons/f.js`, everything else in `apps/photonics-lab/` | **done** | invariants 11 and 12 green, the shell loads at 390 px, the release test passes dark |
| 3 | The sources | `packages/photonics/src/source.js` and test, `src/groups/c.js`, `src/lessons/c.js` | **done** | C1 to C5 pinned, the LED bandwidth and the laser slope from one junction |
| 4 | The rate equations | `packages/photonics/src/rate.js` and test, `src/groups/d.js`, `src/lessons/d.js`, the equations, modulation and step panes | **done** | invariants 4 to 8 green, the guard measured at five depths |
| 5 | The receiver | `packages/photonics/src/receiver.js` and test, `src/groups/b.js`, `src/lessons/b.js`, the noise pane | after the Electronics Lab's Group O merges | invariant 3 green, B3's two sensitivities pinned against that lab's densities |
| 6 | The link, finished | the waterfall's promotion, the multiplexing view's second half | after the System Lab starts, or by the director's decision | the budget's sum equals the System Lab's for the same line items |

**The gate, kept.** Lanes 3 and 4 both write the laser. Lane 3 owns the
junction and the light it makes. Lane 4 owns the two rate equations and the
linearisation. The threshold current is lane 4's, and `source.js`'s
`laserOutput` requires one rather than defaulting one, so a lane that tried to
invent a threshold would fail its own test. `math.js` passes what
`rate.threshold` returned, at every setting.

**Shared seams, landed.** `packages/photonics/index.js` exports by module, and a
new module adds a block to it. `apps/photonics-lab/src/experiments.js` carries
`ALL_GROUPS` with six entries and filters out the ones with no experiments, so a
new group file appears in the sidebar by being imported and nothing else.
`src/math.js` dispatches on `exp.kind`, so a new kind is one entry in `KINDS`
and one function.

## 2. The app skeleton (built)

```
apps/photonics-lab/
  index.html  package.json  vite.config.js  RELEASE_STATUS (dark)
  AGENT_BRIEF.md  NEEDS.md
  scripts/pins.mjs        every number in the lessons, computed
  scripts/verify.mjs      the browser harness, written and not yet run
  src/App.jsx  main.jsx  styles.css
  src/experiments.js      merges groups/*.js in plan order, no prose
  src/lessons.js          merges lessons/*.js, and readQuantity
  src/groups/{a,c,d,e,f}.js   one file per group, owned by that group's lane
  src/lessons/{a,c,d,e,f}.js  the see / try / why registers, same owner
  src/knobs.js            the knob shapes, in base SI units
  src/math.js             one analysis per kind, and `at(over)` on every one
  src/view.js             the schematic's layout, and the numbers rows
  src/terms.js            definitions on contact, one registry, with MATCH
  src/format.js           every number a reader sees
  src/report.js           the issue link's summary
  src/components/CurveCanvas.jsx  panes.jsx
  src/release.test.js  experiments.test.js  prose.test.js  terms.test.js
  src/components/panes.test.jsx
```

## 3. Contracts

Every signature below is a promise between lanes. A lane may add to its return
shape, never rename or remove. Each contract ships with the failing test named
beside it, written before the implementation.

### 3.1 `photon.js` (lane 1, built)

```js
photonEnergy(lambda)            // { lambda, joules, eV, frequency }
wavelengthOf(eV)                // metres
cutoffWavelength(eg)            // metres, hc/E_g
photonFlux(power, lambda)       // per second
responsivity({ eta, lambda, eg })   // A/W, exactly 0 past the cut-off
quantumEfficiency({ responsivity, lambda })
photocurrent({ eta, lambda, eg, power })
darkEqualsLight({ eta, lambda, eg, dark })  // watts

// The photodiode is a circuit, not a formula.
photodiodeNet(spec)   // { elements: [Vb, RL, D1, Iph], iph, spec }
photodiode(spec)      // { current, reverse, iph, dark, floor, sol, elements, iters }
photodiodeSweep(spec, biases)

detectorArea(d)                     // pi d^2 / 4
capPerArea({ eps, w0 })             // F/m^2
detectorSpeed({ d, load, bias })    // { area, cj0, cj, corner, areaBandwidth }
collectedPower({ d, irradiance })
```

`photodiode().floor` is the reading's own arithmetic floor. A microamp read
across a kilohm from a twenty-volt supply is the difference of two voltages that
agree to six figures, so the last digits are the supply's rounding. Any test
comparing the load current against `iph + dark` uses that floor and not a chosen
epsilon.

Test: `photon.test.js`. Twenty-one cases, including invariant 1 (responsivity is
bounded by `q λ / hc`, with equality at unity) and invariant 2 (KCL at the
cathode, over sixty random detectors).

### 3.2 `fibre.js` (lane 1, built)

```js
attenuation({ alphaDb, length })    // { db, ratio, km }
powerAfter({ alphaDb, length, power })   // adds { in, out, inDbm, outDbm }
lengthForLoss({ alphaDb, db })

dispersion({ D, length, dLambda })  // { spread }, D in s/m^2
beta2({ D, lambda })                // s^2/m, sign flipped from D
dispersionFromBeta2({ beta2, lambda })
bandwidthLimit({ spread, criterion })    // { rate, criterion, text }
bandwidthDistance({ D, dLambda, criterion })  // { product, perWidth }
dispersionReach({ D, dLambda, rate, criterion })

numericalAperture({ n1, n2 })   // { na, angle, delta }, throws when n2 >= n1
vNumber({ a, na, lambda })
singleModeDiameter({ na, lambda })
modeCount(v)                    // { modes, estimate }

channelGrid({ spacing, lambda })   // { width }
bandChannels({ from, to, spacing }) // { width, channels }

linkBudget({ txDbm, items, sensitivityDbm })  // items are { name, db }
lossReach({ txDbm, sensitivityDbm, fixedDb, marginDb, alphaDb })
bindingLimit({ loss, dispersionLength })      // { binds, reach }

refuseNonlinear(what)   // throws; nonlinearAvailable() returns the sentence
```

Two returns carry more than a number, on purpose. `bandwidthLimit` returns the
`criterion` and its `text`, because `B σ ≤ 0.25` is a definition and a pane that
prints the rate without it is over-claiming. `modeCount` returns
`estimate: true` above V = 2.405, because `V²/2` is an asymptote.

`linkBudget` refuses an item with no name. That is what keeps a loss the model
does not include a zero-height row rather than a missing one.

Test: `fibre.test.js`. Thirty-one cases, including invariant 9 (attenuation
composes: decibels add, ratios multiply) and invariant 10 (spreads add, and
`β₂` recovered from `D` returns `D`).

### 3.3 `cavity.js` (lane 2, built)

```js
describeCavity({ n, L, r | r1, r2, loss })   // { roundTrip, opticalLength }
freeSpectralRange(spec, lambda)  // { fsr, roundTripTime, wavelength }
finesse(spec)                    // { finesse, fsr, linewidth, roundTrip }
airy(spec, phi)                  // periodic in phi with period 2 pi, exactly
roundTripPhase(spec, f)
transmissionAt(spec, f)
sweep(spec, { from, to, points }) // { f, t, peaks, fsr }
contrast(spec)                   // { ratio, db }
facetReflectance({ n1, n2 })
mirrorLoss(spec)                 // (1/2L) ln(1/R), the plan's convention
photonLifetime(spec)             // { alpha, mirror, internal, tauP }

refuseRational()   // throws; rationalAvailable() returns the sentence
```

`mirrorLoss` uses the convention `PHOTONICS_LAB_PLAN.md` §2.8 states, where a
single pass of length L loses the factor R. Some texts spread the same
reflectance over a round trip and quote twice this. **Lane 4 checks its
threshold current against this convention before it pins one**, because the
choice is a factor of two in `I_th`.

Test: `cavity.test.js`. Twenty cases, including invariant 11 (periodic in the
round-trip phase, and the peaks one free spectral range apart) and invariant 12
(the `systems` hand-over declined, and the message naming the factor).

### 3.4 `source.js` (lane 3, built)

```js
voltsPerPhoton(lambda)          // h nu / q, in volts. 0.79990 V at 1550 nm

// The electrical port: a @ee-labs/network circuit, not a formula.
driveNet(spec)                  // { elements: [Vd, Rs, D1], spec }
drive(spec)                     // { current, forward, across, floor, sol, elements, iters }
driveSweep(spec, drives)
forwardVoltage({ current, is, n, vt })   // Shockley read backwards

// The optical port: three stated models, each named in MODEL.
ledOutput({ etaInt, lambda, current })   // { power, slope, volts, model }
ledBandwidth({ tauC })                   // { f3db, tauC, model }
ledResponse({ tauC, f })                 // |H| against its low-frequency value
ledPhase({ tauC, f })                    // degrees, exactly −45 at the corner
slopeEfficiency({ etaD, lambda })        // { slope, volts, etaD }, W/A
laserOutput({ etaD, lambda, current, ith, etaSp })
  // { power, stimulated, spontaneous, slope, spontaneousSlope, slopeRatio, above }
wallPlug({ power, current, forward })
widthInWavelength({ lambda, dNu })

MODEL   // { led, bandwidth, laser }, the sentence each number is printed with
```

`laserOutput` requires `ith`. A source module that defaulted a threshold would
let two panes disagree about one laser, so the threshold is always the one
`rate.js` returned.

Test: `source.test.js`. Twenty-four cases. At `τ_c = 5.0 ns` the LED bandwidth
is 31.831 MHz, at 1.0 ns it is 159.15 MHz and at 20.0 ns it is 7.9577 MHz. At
1550 nm the slope is 0.15998 mW/mA at `η_d = 0.2` and 0.31996 mW/mA at 0.4.
The junction's operating point is checked by Kirchhoff's law at its own node,
against `drive().floor` rather than a chosen epsilon, over eighty random
junctions. Invariant 5's second half lives here: the slope above threshold is
measured off the curve rather than read off the return.

### 3.5 `rate.js` (lane 4, built)

```js
LASER_CHIP        // { n: 3.5, L: 100e-6, r: facetReflectance({ n1: 3.5 }), loss: 0 }
LASER_DEFAULTS    // the six parameters, with tauP from that chip

laserSpec(spec)                 // the defaults filled in, every field checked
threshold(spec)                 // { spec, nth, gain, ith, gth }
steadyState({ ...spec, current })
  // { spec, nth, ith, gain, current, n, delta, s, above, sIdeal }
rateTerms({ ...spec, current })
  // adds { carriers[], photons[], carrierSum, photonSum, carrierFloor, photonFloor }

smallSignal(spec, current)
  // { wr, fr, gamma, zeta, resonant, peak, peakDb, peakHz, f3db, dc,
  //   overshoot, b: [...], a: [...], wrText, frText }
modulationAt(sm, f)             // |H| against its low-frequency value
modulationPhase(sm, f)          // degrees, exactly −90 at omega_r

DEPTH_WARN     // 0.05, and the measured error at it is 5.2638 %
DEPTH_DECLINE  // 0.30, and the measured error at it is 26.760 %
stepOvershoot(spec, current, depth)
  // { error, predicted, measured, rise, t[], trace[], predict(t), dt, steps }
linearStep(sm, time)
depthGuard(spec, current, depth)   // { depth, warn, decline, ok, declined, error, says, step }

refuseLargeSignal(what)   // throws; largeSignalAvailable() returns the sentence
```

The photon lifetime is not typed. It is `photonLifetime(LASER_CHIP).tauP`, so
one facet reflectance moves C5's threshold and D2's, and the two agree because
they are the same number. The spontaneous coupling is zero by default, which is
what makes the plan's closed forms exact and `f_r` exactly proportional to
`√(I/I_th − 1)`.

`smallSignal` refuses below threshold at zero coupling. With no photons in the
cavity the pair is uncoupled, and a frequency returned there would be the
cancellation of two equal numbers rather than a measurement.

Test: `rate.test.js`. Thirty-three cases. §4.3's parameters give
`N_th = 1.6713e24 m⁻³` and `I_th = 13.389 mA`. At `2 I_th` the photon density is
4.9793e20 m⁻³, the relaxation frequency is 3.9844 GHz and the damping ratio is
0.034848. The peak is 23.141 dB and the 3 dB bandwidth is 6.1855 GHz. Every one
is recomputed from the six parameters. Invariants 4, 6, 7 and 8 are each named
beside the test that measures them, fuzzed over two hundred random lasers.

### 3.6 `receiver.js` (lane 5, contracted, not built)

```js
export function shotDensity(current)              // sqrt(2 q I), A/sqrt(Hz)
export function thermalDensity({ load, T })       // sqrt(4 k T / R)
export function rmsOver({ density, bandwidth })
export function sensitivity({ q, sigma, responsivity })   // watts, then dBm
export function quantumLimit({ photonsPerBit, lambda, rate })
```

Test: `receiver.test.js`. At 1.000 µA the shot density is 0.5661 pA/√Hz. A
1.000 kΩ load at 300 K gives 4.0704 pA/√Hz. The two are equal at 51.704 µA. For
`Q = 6` over 1.000 GHz the sensitivity is −31.122 dBm at 1.000 kΩ and
−34.617 dBm at 5.000 kΩ, and the quantum limit at 1.000 Gbit/s is −58.923 dBm.
**Every one of those five figures must agree with the Electronics Lab's
`noise.js` for the same inputs**, and `NEEDS.md` §4 is where that seam is
recorded.

## 4. The lesson schema, and the quantity paths

An experiment entry is:

```js
{
  id, group, kind, name,
  terms: ['photon', 'wavelength'],   // ids in src/terms.js, in reading order
  params: [Knob, ...],               // from src/knobs.js, base SI units
  view: 'curve', views: ['curve', 'numbers'],
  headline: (x, p) => ({ value, unit, label }),
  curve: (x, p) => CurveDescriptor,  // only for the curve view
}
```

The lesson merged onto it is:

```js
{
  see: '…',  seeReads: [[path, value]],
  try: [{ say: '…', set: { knob: value }, reads: [[path, value]] }],
  why: '…',  whyAt: { knob: value },  whyReads: [[path, value]],
}
```

`see` is 70 words and `why` is 160. Each `try.say` is 45, and every experiment
has three try steps. `whyAt` is for a `why` that reasons about a setting the
note names rather than about the defaults. The values it sets are justified in
the prose along with the readings.

Quantity paths a `reads` pair may name:

```
hc                                                  eV micrometres, the constant
photon.<eV|joules|frequency|flux>                   the photon
R, cutoff, level                                    responsivity, its edge, the dark level
pd.<current|iph|dark|reverse|floor>                 the solved photodiode
speed.<area|cj0|cj|corner|collected|areaBandwidth>  area against speed
att.<db|ratio|in|out|inDbm|outDbm|km>               attenuation over a span
disp.<spread|beta2|beta2ps>                         dispersion, in both forms
limit.<rate|product|criterion>                      the rate a spread allows
geo.<na|angle|delta|v|single|modes|estimate|vLimit> the step-index geometry
budget.<total|received|margin|txDbm>                the link budget
reach.<length|dispersion|binds|forFibre>            the two reaches
fsr, fsrWavelength, finesse, linewidth              the cavity
facet, mirrorLoss, roundTripTime                    the cavity's other numbers
contrast.<ratio|db>                                 peak against valley
grid.width, band.<width|channels>, widthRatio       the channel grid
j.<current|forward|across|iters>                    the solved forward junction
led.<power|slope|volts>                             the LED's linear output
band.<f3db|tauC|perDecade|perOctave|atCorner|       its one pole
  phaseAtCorner|phaseDecadeUp>                      and its phase
laser.<power|stimulated|spontaneous|slope|          the laser's two slopes
  spontaneousSlope|slopeRatio|above>
ith, nth, tauP, volts                               the device, at this setting
cavity.<tauP|mirror|mirrorPerCm|fsr|finesse>        the chip C5 turns
wall.<led|laser>                                    what each device does with the supply
n, s, current, above                                the steady state
carriers.<0|1|2>.value, photons.<0|1|2>.value       one term of one equation
carrierSum, photonSum                               each equation's own sum
sm.<fr|frText|gamma|zeta|peakDb|peakHz|f3db|dc>     the linearisation
phaseAtFr, phaseAtPeak, phaseAt3db                  its phase, in degrees
dampingPerNs, textFactor                            the two numbers D3 quotes
guard.<error|depth|warn|decline|measured|predicted|declined>   the guard
headline                                            whatever the experiment is about
```

`readQuantity` throws on a path the analysis does not carry, so a lesson cannot
quietly read `undefined` and pass. `experiments.test.js` names that as its own
case.

New paths come from a new `kind` in `math.js`. Add the kind, add the paths to
the list above, and add them to the module comment in `lessons.js`.

## 5. The library circuits

Group A's is the only one built. Values are the plan's §4.3 defaults, node names
are fixed, and the layout is in `src/view.js`.

```js
// The photodiode, reverse-biased, into a load. photodiodeNet() builds it.
[{ type: 'V', id: 'Vb', nodes: ['vb', 'gnd'], value: bias },
 { type: 'R', id: 'RL', nodes: ['vb', 'c'], value: load },
 { type: 'D', id: 'D1', nodes: ['gnd', 'c'], model: 'exp', is: dark, n: 1 },
 { type: 'I', id: 'Iph', nodes: ['c', 'gnd'], value: R * P }]
// The anode is at ground and the cathode at 'c', so a positive supply reverse
// biases the junction. The photocurrent runs cathode to anode, which is the
// direction light drives a junction. No source carries the dark current: it is
// the diode's own saturation current, so turning the light off leaves it.
```

Group C's, which lane 3 writes, follows the same names:

```js
// The LED or the laser, forward-biased from a supply through a series resistor.
[{ type: 'V', id: 'Vd', nodes: ['vd', 'gnd'], value: drive },
 { type: 'R', id: 'Rs', nodes: ['vd', 'a'], value: series },
 { type: 'D', id: 'D1', nodes: ['a', 'gnd'], model: 'exp', is, n }]
// The optical power is source.js's function of the current in D1, and the
// current in D1 comes from the same newtonDC. Nothing types a bias point.
```

## 6. What each lane pins

Every number in the plan's §5 for your groups becomes a `reads` pair checked in
`experiments.test.js`. The pins are functions of the knobs, computed in the test
from the parameters, never constants typed in.

| Lane | Pins |
| --- | --- |
| 1, Group A | 0.79990 eV, 0.94644 eV and 1.4586 eV. 7.8 × 10¹⁵ photons a second. 1.0011 µA flat at four biases, and 53.557 µA at −0.35574 V when the bias runs out. 1.0001 A/W, 0.54846 A/W, 0.64524 A/W, and 1107.0 nm. 1.0000 nA, 2.0001 nA, 0.99987 nW. 0.17455 pF, 911.80 MHz, 7.8540 nW, and 7.1613 m²/s at every diameter |
| 1, Group E | 16.000 dB, 28.000 dB, 160.00 dB, 8.0000 dB and −16.000 dBm. 1360.0 ps, 136.00 ps, 680.00 ps, 160.00 ps and −21.683 ps²/km. 0.18382 Gbit/s, 1.8382 Gbit/s, 0.36765 Gbit/s and 14.706 Gbit/s km. 0.12461, 7.1582°, 9.5224 µm, 2.2731, 23.028 and 265 modes. 18.400 dB, −21.400 dBm, 6.600 dB, 98.000 km and 1.4706 km |
| 2, Group F | 142.76 GHz, 1.1440 nm, 2.5245, 56.549 GHz, 29.804, 4.7899 GHz, 312.58, 45.977 dB and 42.827 GHz. 0.80139 nm, 4.3821 THz, 43 channels, 87 and 21 |
| 3, Group C | 18.778 mA, 1.2231 V, 30.182 mA, 1.2476 V, 8.7749 mA, 13.080 % and 7.6012 %. 3.0041 mW, 1.7458 mW, 3.1996 mW, 6.3992 mW, 0.39995 mW/mA, 7.9990 mW and 0.29173 mW/mA. 31.831 MHz, 159.15 MHz, 7.9577 MHz, 20 dB, 6.0203 dB and −3.0103 dB. 13.389 mA, 0.31996 mW/mA, 4.3052 mW, 2.1368 mW, 0.0079990 mW, 0.47994 mW/mA, 0.0015998 mW/mA and 200.00. 58.779 per cm, 1.9862 ps, 22.162 ps, 8.4929 mA, 1.0141 ps, 18.544 mA, 9.8034 mA and 142.76 GHz |
| 4, Group D | `N_th = 1.6713e24 m⁻³`, `I_th = 13.389 mA`, `S = 4.9793e20 m⁻³`. 1.6713e33, 8.3565e32, 8.3564e32, 2.5069e32 and 1.2483e24 as term values. 9.9588e20, 11.237 mA and 21.399 mA. 3.9844 GHz, 0.034848, 23.141 dB, 6.1855 GHz, 5.6348 GHz, 7.9688 GHz, 19.230 dB, 2.5252 GHz, 1.5779 and 1.7448 per ns. The error at 1, 5, 10, 30 and 60 per cent depth: 1.0853 %, 5.2638 %, 10.152 %, 26.760 % and 45.596 % |
| 5, Group B | 0.5661 pA/√Hz, 4.0704 pA/√Hz, 51.704 µA. 575.64 nA, 128.72 nA, 40.704 nA. −31.122 dBm, −34.617 dBm, −58.923 dBm and the 27.8 dB gap |

`scripts/pins.mjs` computes every figure in the first five rows and prints it
grouped by experiment. **Extend it before you write a lesson, not after.**

## 7. Verify before you hand back

```
npx vitest run apps/photonics-lab packages/photonics --maxWorkers=4
node packages/prose/bin/lint.mjs apps/photonics-lab/*.md
npm run build --workspace apps/photonics-lab
npx vite preview --outDir apps/photonics-lab/dist --port 4181 --strictPort &
APP_URL=http://localhost:4181 node apps/photonics-lab/scripts/verify.mjs
```

The harness catches what unit tests cannot: a prop not passed, a pane fed stale
state, a plot that stopped redrawing. Extend it for every view you add. It has
been run, and it passes: the review sitting of 2026-09-05 drove it against a
served build and shot every view at both widths.
Screenshot every view at 390 px and at 1280 × 900 and read the screenshots as a
student would, per `/REVIEW_PLAYBOOK.md` §11.

## 8. The gate

A lane is done when all of these hold.

1. Its invariants from the plan's §2.11 are fuzzed green, each named beside the
   test that measures it.
2. Every number in its groups' `see`, `try` and `why` is a `reads` pair.
   `experiments.test.js` recomputes each at the setting the step names.
3. Every term its lessons lean on is defined in `src/terms.js`, with a `MATCH`
   pattern. `terms.test.js` passes, and its `CHIPS` list has gained no entry
   that has not been argued for.
4. `prose.test.js` is clean, and so is the markdown lint on every `.md` the lane
   touched.
5. Every view it adds is in `VIEW_ORDER`, `VIEW_LABELS`, `PANE_OF` and
   `panes.test.jsx`, and `verify.mjs` opens it.
6. Nothing it wrote references an experiment that does not exist.
   `experiments.test.js` asserts that directly for Group B, and checks every
   C or D id a lesson names against the built set.

## 9. Gotchas the other labs paid for, and two of this one's

- Engineering-notation fields read a bare number in the displayed prefix.
  Harness code types explicit prefixes ("100k", "1m", "10G").
- A test that fails may be the test. Decide which, and say which in the commit.
- **Tolerances are relative to the reading's own scale, never a fixed epsilon.**
  This lab has paid for that once already. A microamp read across a kilohm from
  a twenty-volt supply loses six digits to cancellation, so `photodiode()`
  returns `floor` and the invariant test uses it.
- **A unit's own prefix letter is not a prefix.** The prose checker in
  `experiments.test.js` strips `[pnµumckMGT]` before it matches a unit, so
  "Gbit/s" is the G prefix on "bit/s" and never appears in the unit list. A
  compound like "Gbit/s km" has to be entered as "bit/s km" with its own scale.
- Wherever two numbers are shown as equal, ask what could make them differ
  silently. Then remove the cause or print it.
- The dark launch is enforced by a test. While `RELEASE_STATUS` says `dark`,
  nothing outside `apps/photonics-lab/` may mention the lab.
- **A term is introduced where it first does work, and the group order decides
  where that is.** Groups C and D sit before E and F, so `decibel` is
  introduced at C3 and `cavity` at C4. A lane that adds a group in the middle
  has to check `terms.test.js` for words its group now meets first.
- **A word in a lesson is matched by a pattern, and a verb can trip one.** The
  fibre group's `reach` matches "reaches", so Group D says "rises" and
  "climbs" instead. Read the failure before widening a pattern.
- **A density written as a mantissa times a power of ten is read as one
  number.** `experiments.test.js` parses `1.6713 × 10²⁴` and removes it from
  the sentence before the bare-figure rules run, so the mantissa is never
  compared against a value twenty-four orders of magnitude away.
- **An integration is not a curve sample.** `depthGuard` runs a Runge-Kutta
  pass, so D4 has no curve view over depth. Its five depths are rows on the
  numbers pane instead, one integration each.
- **A knob default that is a rounding of a derived number makes a second
  device.** The photon lifetime was typed into the knobs at five figures where
  `rate.js` computes it from the chip. C4 and Group D then ran a laser the
  engine's own tests do not, and every figure downstream of it moved in the
  fifth digit. A default that something else derives is imported, never typed.
- **A prefix letter with no unit behind it is read as a unit.** A numerical
  aperture of 0.12461 came out as "124.61 m". `num` in `format.js` prints a
  unitless reading in plain digits, and anything past the prefix table as a
  mantissa and a power of ten. `experiments.test.js` measures that over every
  headline and every numbers row.
