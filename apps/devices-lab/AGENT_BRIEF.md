# Devices Lab: build brief

You are one of up to seven agents building this lab in parallel. The plan is
`/DEVICES_LAB_PLAN.md`, and this brief turns it into lanes an agent can take
without colliding with another. Read the plan's §2 (engine) and §5 (curriculum)
for your lane before writing a line. Reed reviews everything.

## Boundaries: read first

- **One lane per agent, one clone per agent.** Clone the repo into a directory
  named for your lane (`~/projects/ee-labs-devices-lane-3`), set the remote and
  the author as the other briefs describe, and run `npm ci`. Never work in the
  shared checkout.
- **Edit only the files your lane owns** (§1). Everything else is read-only. If
  you need a change outside your lane, write it into
  `apps/devices-lab/NEEDS.md` under your lane's heading, commit that, and carry
  on with what you can do. The owning lane picks it up.
- **Stage by path.** Write `git add apps/devices-lab/src/groups/c.js`, never
  `git add -A` and never `commit -a`.
- Work on `lab/devices-lab`. Run `git pull --rebase` before every push. Never
  rewrite pushed history. The lab deploys dark at `/devices-lab/` once the
  director adds the deploy line, so push only when the scoped suite is green.
- **Preview port.** Lane number plus 4320, so lane 3 previews on 4323. The
  other labs use 4176 to 4319.

## The house discipline

Read `/CORE_SCOPE.md`, `/STYLE.md` and `/REVIEW_PLAYBOOK.md` first. Then the
rule every lab obeys. **Every explanatory sentence is a claim about physics,
and a test must measure it.** A lesson quotes no number the engine does not
produce. A prediction follows every knob that can change it. A claim the
settings cannot show is footnoted rather than crossed out. On-screen text
passes `npm run lint:prose`.

Commit messages are narrative. They say what changed, why, and what fell out.
Read `git log` for the register. Never put a model name in a commit or a file.

## 1. The lanes

| Lane | Work | Owns | Starts | Exit |
| --- | --- | --- | --- | --- |
| 1 | The engine | the Devices additions in `packages/network/src/junction.js` and `junction.devices.test.js` | now | invariants 1 to 12 fuzzed green, contracts in §3 met, Electronics C unchanged |
| 2 | The app shell | everything in `apps/devices-lab/` not owned by lanes 3 to 8, plus `RELEASE_STATUS` and `release.test.js` | now, against §3.9's stub | the shell loads a stub experiment at 390 px, the release test passes dark |
| 3 | Carriers, Group A | `src/groups/a.js`, `src/lessons/a.js`, `src/components/BandCanvas.jsx` | after lane 1's carriers | A1 to A5 pinned |
| 4 | The junction, Group B | `src/groups/b.js`, `src/lessons/b.js`, `src/components/ProfileCanvas.jsx` | after lane 1's profile | B1 to B6 pinned |
| 5 | The MOS capacitor and the MOSFET, Groups C and D | `src/groups/{c,d}.js`, `src/lessons/{c,d}.js`, `src/components/CVCanvas.jsx` | after lane 1's MOS work | C1 to C5 and D1 to D5 pinned |
| 6 | The BJT and the solar cell, Groups E and F | `src/groups/{e,f}.js`, `src/lessons/{e,f}.js`, `src/components/CurvesCanvas.jsx` | after lane 1's `gummel` | E1 to E4 and F1 to F3 pinned |
| 7 | Fabrication, Group G | `src/groups/g.js`, `src/lessons/g.js`, the step slider on `CrossSection.jsx` | after lane 2's cross-section | G1 and G2 pinned |
| 8 | The progression test | `packages/ui/src/progression.test.js` | after the group counts settle | every id and count in `/CURRICULUM.md` checked |

**The gate.** Groups B to G need lane 1. No agent starts a group past A until
lane 1's exit is met and its contracts are merged. Lane 2's first commit adds
the app skeleton and the `RELEASE_STATUS` test, and every other lane rebases
onto it before it pushes.

**The shared file.** `packages/network/src/junction.js` is the Electronics
Lab's, and the director's ruling lets this lab add exports to it. No existing
signature changes, and `junction.test.js` runs first in the scoped suite as the
regression. Lane 1 is the only lane that may open the file.

## 2. The app skeleton (lane 2)

Copy Circuit Elements Lab's shape, file for file, and delete what it does not
need. There are no netlists in this lab, so nothing here imports the solver.

```
apps/devices-lab/
  index.html  package.json  vite.config.js  RELEASE_STATUS (dark)
  src/App.jsx  main.jsx  styles.css
  src/structures.js       the structure library, one entry per §5 of this brief
  src/experiments.js      merges groups/*.js in plan order, no prose
  src/lessons.js          merges lessons/*.js, and readQuantity
  src/groups/{a..g}.js    one file per group, owned by that group's lane
  src/lessons/{a..g}.js   the see / try / why registers, same owner
  src/terms.js            definitions on contact, one registry
  src/math.js             analyse(), and the math-panel rows
  src/report.js           the issue link's summary
  src/release.test.js  experiments.test.js  prose.test.js  terms.test.js
  src/components/         CrossSection, ProfileCanvas, BandCanvas, CVCanvas,
                          CurvesCanvas, Prose, panes.jsx
```

`experiments.test.js` is the Electronics Lab's file with the netlist checks
removed and §4's paths added. Copy it rather than rewriting it. The cross
section is always visible above the pane, in the place a schematic holds in
every other lab, so a reader who has learnt one lab has learnt this one.

## 3. Contracts

Every signature below is a promise between lanes. A lane may add to a return
shape, and may never rename or remove. Each contract ships with the failing
test named beside it, written before the implementation.

### 3.1 Carriers (lane 1)

```js
export function carriers({ na, nd, T, ni })   // { n, p, ni, net, efi, type, majority, minority, extrinsic }
export function niFrom({ nc, nv, eg, T })     // √(N_c N_v) e^{−E_g/2kT}
export function gapFrom({ ni, nc, nv, T })    // the band gap a stated n_i implies
export function intrinsicAt({ net, factor })  // the temperature a doping stops being extrinsic at
export const N_C_SI = 2.86e25                 // m⁻³, Green 1990
export const N_V_SI = 2.66e25
```

Test (`junction.devices.test.js`): `n p = n_i²` to floating point at ten
dopings. `n` agrees with `N_D` to 10⁻⁶ above 100 `n_i` and departs below it.
`niFrom()` is 1.0790 × 10¹⁶ m⁻³ and `gapFrom({ ni: N_I_300 })` is 1.1030 eV.

### 3.2 The profile (lane 1)

```js
export function profile({ na, nd, T, eps }, v)  // { w, xp, xn, v0, vj, emax, edges, rho, field, potential }
export function peakField(structure, v)         // V/m, the field at the metallurgical boundary
export function breakdown(structure, ecrit)     // { vj, v, w, v0, emax, mechanism }
export function saturationCurrent({ na, nd, area, mup, mun, taup, taun })  // { is, dp, dn, lp, ln }
export function debyeLength({ n, T, eps })      // the tail the step charge replaces
export function driftDiffusion()                // throws, with the reason
```

`rho`, `field` and `potential` take metres and give C/m³, V/m and volts. The
potential is measured from the p-side edge and climbs to `V_0 − v`.

Test: the field integrates to `V_0 − v` by quadrature to 10⁻¹² relative.
`emax` equals `2V_j/W` to floating point. `N_A x_p = N_D x_n` at every doping
pair. `driftDiffusion` throws a message naming the three things the model
replaces.

### 3.3 The MOS capacitor (lane 1)

```js
export function oxideCap({ tox, epsOx })        // ε_ox/t_ox, F/m²
export function bulkPotential({ na, T, ni })    // φ_F
export function surfaceDepletion(process, psi)  // { w, wmax, phiF, psi }
export function flatBand(process)               // { vfb, phims, phiF, cox, oxideShift }
export function threshold(process)              // the four terms, C_min, γ and S
export function surfacePotential(process, vg)   // { psi, regime, ... }
export function mosCap(process, vg, { frequency })  // { c, cd, regime, psi, w, cox }
export function cvCurve(process, { from, to, points, frequency })
export function dopingFromRatio({ ratio, tox })
export function implantFor({ from, to, cox })
export function bodyEffect(process, vsb)
```

A process is `{ na, tox, gate, qf, implant, T }`, with `gate` one of `n+ poly`,
`p+ poly` and `aluminium`. `frequency` is `high` or `low`.

Test: `C_ox = 3.4531 mF/m²` at 10 nm. `φ_F = 406.20 mV` and
`W_max = 102.50 nm` at 10¹⁷ cm⁻³. `C_min/C_ox = 0.226419`. The four terms sum
to `V_T = 321.769 mV`. The high-frequency curve falls with no step, and the two
curves agree outside inversion to floating point.

### 3.4 The MOSFET (lane 1)

```js
export function drainCurrent({ kn, vt, lambda }, { vgs, vds })  // { id, region, vov, gm, ro }
export function channelIntegral({ kn, vt }, { vgs, vds, points })  // the same current, by quadrature
export function subthreshold({ swing, from, to })  // { decades, dv }
export const velocitySaturation = ({ ecrit, length }) => ecrit * length
```

Test: the closed form equals the integral to 10⁻⁹ relative in triode. The two
expressions agree in value and in slope at `V_DS = V_OV`. And `gm` equals a
central difference of `id` against `vgs` to 10⁻⁶ relative.

### 3.5 The BJT (lane 1)

```js
export function gummel({ ne, we, nb, wb, area, de, db, T })  // { is, beta, alpha, gummelBase, gummelEmitter, tauB, ftLimit, vbeAt }
export function earlyVoltage({ nb, wb, nc, T }, vcb)          // { rate, va, intoBase, neutralBase, taken, w, vj }
```

Test: `I_S = 7.4556 × 10⁻¹⁵ A` and `β = 480.01` at §5's process. `vbeAt(1e-3)`
is 662.38 mV. `earlyVoltage(B, 5).intoBase` is 82.238 nm and `va` is 69.954 V.

### 3.6 The solar cell and the LED (lane 1)

```js
export function photovoltaic({ is, il, T, rs, area, irradiance })  // { voc, isc, vmp, imp, pmax, ff, ffEmpirical, ffError, efficiency, current, power, slope }
export function emission({ eg })                                   // { wavelength, vf, photonEnergy }
export const MATERIALS = { silicon: 1.12, ... }                    // band gaps, eV, as data
```

Test: `dP/dV` at `vmp` is below 10⁻¹⁰ of `isc`. `pmax` equals `ff · voc · isc`
by construction. `ffEmpirical` differs from `ff` by 0.011 %, and the difference
is printed rather than hidden.

### 3.7 Fabrication (lane 1)

```js
export function implantDoping({ dose, depth })   // dose over depth
export const doseFor = ({ doping, depth }) => doping * depth
```

Test: an implant of 10¹² cm⁻² over 0.1 µm gives 10¹⁷ cm⁻³. That is the doping
Group B opened with, and `V_0` from it is 752.879 mV.

### 3.8 What does not change

`builtIn`, `depletionWidth`, `junctionCap`, `diffusionCap`, `isAt`,
`doubling`, `niAt`, `vbeSlope`, `transitFreq` and `transitLimit` keep their
signatures and their numbers. `N_I_300` stays at 1.5 × 10¹⁶ m⁻³ by the plan's
Decision 1. `V_0` is 752.879 mV and `C_j` is 0.7235 pF at −5 V from 2 pF.
`junction.test.js` is the regression and it runs unchanged.

### 3.9 The stub lane 2 builds against

Until lane 1 lands, lane 2 imports `apps/devices-lab/src/stub.js`. It exports
`profile` and `threshold`, each returning the plan's §4.3 numbers as constants
in the shapes above. The stub is deleted in the commit that switches the
imports to `@ee-labs/network`, and `experiments.test.js` fails if it is ever
imported after that.

## 4. The lesson schema, and the quantity paths

Copy the Electronics Lab's `lessons.js` header comment and its three registers.
They are `see` (≤ 70 words), `try` (each step ≤ 45 words, with `set` and
`reads`) and `why` (≤ 160 words). An experiment entry is
`{ id, group, name, terms, params, structure, view, views, headline }`. Two
fields are this lab's. `structure` names an entry in `structures.js`, and
`stack` is the cross-section the pane draws.

Quantity paths a `reads` pair may name:

```
carrier.<n|p|ni|efi|net|majority|minority>      A's concentrations and Fermi level
carrier.<niComputed|niRatio|gapImplied>         A2's two intrinsic concentrations
carrier.<intrinsicT>                            A3's crossover temperature
j.<v0|w|xp|xn|emax|vj|cj|area>                  B's profile, at the bias knob
j.<byArea|byQuadrature>                         the two routes B2 and B3 compare
j.<is|dp|dn|lp|ln|vAt1mA|decade>                B4's saturation current
j.<vbr|vbrApplied|mechanism|ecrit>              B6's breakdown
mos.<cox|phiF|wmax|cdmin|cmin|ratio|debye>      C's capacitor
mos.<vfb|phims|qdep|depTerm|implantTerm|vt>     C5's four terms
mos.<c|cLow|regime|psi|w>                       the C–V pane at the gate knob
mos.<implant|gamma|swing|dopingRead>            C3 and C5's derived numbers
fet.<id|region|vov|gm|ro|kn|kprime|charge>      D's MOSFET
fet.<integral|shift|decades|dv|vsat>            D2, D4 and D5
bjt.<is|beta|alpha|tauB|ftLimit|vbe>            E's Gummel numbers
bjt.<intoBase|neutralBase|taken|rate|va|w>      E1 and E4
pv.<voc|isc|vmp|imp|pmax|ff|ffEmpirical>        F's solar cell
pv.<efficiency|seriesLoss|ffError>              F2 and F3
led.<wavelength|vf>                             F3's emission
fab.<doping|dose|depth|tox|step>                G's sequence
```

`experiments.test.js` resolves every path against the analysis and fails on a
path it cannot resolve, as the Electronics Lab's does.

## 5. The structure library

Values are the plan's §4.3 defaults. Names are fixed so that `reads` paths and
cross-sections agree across lanes.

```js
// Bulk silicon (Group A)
{ kind: 'bulk', nd: 1e22, na: 0, T: 300 }                  // 10¹⁶ cm⁻³ donors

// The step junction (Group B, and the collector junction of Group E)
{ kind: 'junction', na: 1e23, nd: 1e22, area: 1e-8, T: 300, v: 0 }
// 10¹⁷ and 10¹⁶ cm⁻³, 10⁻⁴ cm². V_0 = 752.879 mV, W = 327.255 nm,
// E_max = 46.0118 kV/cm, C_j = 31.6554 nF/cm².

// The MOS capacitor (Groups C and D)
{ kind: 'mos', na: 1e23, tox: 10e-9, gate: 'n+ poly', qf: 0, implant: 0, vg: 0 }
// C_ox = 345.313 nF/cm², φ_F = 406.203 mV, W_max = 102.498 nm,
// C_min/C_ox = 0.226419, V_T = 321.769 mV.

// The MOSFET (Group D): the capacitor above, plus
{ kind: 'mosfet', wOverL: 10, mun: 0.05, lambda: 0, vsb: 0, length: 1e-6 }
// k' = 172.657 µA/V², I_D = 215.82 µA and g_m = 863.28 µA/V at V_OV = 0.5 V.

// The BJT (Group E)
{ kind: 'bjt', ne: 1e25, we: 0.3e-6, nb: 1e23, wb: 0.5e-6, nc: 1e22,
  area: 1e-8, db: 1.0341e-3, de: 1.2926e-4, vcb: 5 }
// I_S = 7.4556 × 10⁻¹⁵ A, β = 480.01, τ_B = 120.88 ps, V_A = 69.954 V.

// The solar cell and the LED (Group F)
{ kind: 'cell', is: 1e-12, il: 35e-3, area: 1e-4, rs: 0, irradiance: 1000 }
{ kind: 'led', material: 'gallium nitride' }
// V_oc = 627.651 mV, V_mp = 547.531 mV, P_max = 18.2996 mW, FF = 0.833019.
```

Each structure carries its cross-section as layers with thicknesses to scale.
Group G walks the sequence that produces the second and the fourth of them.

## 6. What each lane pins

Every number in the plan's §5 for your groups becomes a `reads` pair checked in
`experiments.test.js`. The pins are functions of the knobs, computed in the
test from the parameters, and never constants typed in.

| Lane | Pins |
| --- | --- |
| 3, Group A | 25.852 mV. 2.25 × 10⁴ cm⁻³. 1.0790 × 10¹⁰ cm⁻³, the ratio of 1.390 and 1.1030 eV. 287.15, 346.68 and 406.20 meV, and the 59.526 meV decade. `n_i` at four temperatures |
| 4, Group B | 752.879 mV. 297.504 and 29.7504 nm. 46.0118 kV/cm. 1.4218 × 10⁻¹⁵ A and 705.219 mV. 31.6554 nF/cm². 290.99 V, 29.125 V and 2.9387 V, and 1059.4 kV/cm |
| 5, Groups C and D | 345.313 nF/cm². 406.203 mV and 102.498 nm. 78.1856 nF/cm² and 0.226419. 321.769 mV in four terms, and 8.1519 × 10¹¹ cm⁻². 172.657 µA/V², 215.82 µA, 863.28 µA/V, 234.75 mV and 76.949 mV |
| 6, Groups E and F | 7.4556 × 10⁻¹⁵ A, 480.01 and 0.997921. 120.88 ps and 1.3167 GHz. 82.238 nm and 69.954 V. 627.651 mV, 547.531 mV, 18.2996 mW and 0.833019. Four wavelengths from 364.66 nm |
| 7, Group G | 10¹⁷ cm⁻³ from 10¹² cm⁻² over 0.1 µm, and 752.879 mV from it. 345.313 nF/cm² from the oxide step, 700.00 mV from the implant step, and 215.82 µA from the finished device |

## 7. Verify before every push

```
npx vitest run packages/network apps/devices-lab apps/electronics-lab
npm run lint:prose
npm run build --workspace apps/devices-lab
```

The Electronics Lab runs because this lab extends its file. Screenshot every
view at 390 px and at 1280 × 900 and read the screenshots as a student would,
per `/REVIEW_PLAYBOOK.md` §11.

## 8. Gotchas the other labs paid for

- Engineering-notation fields read a bare number in the displayed prefix.
  Harness code types explicit prefixes such as `4.7k` and `100n`.
- Write TeX with editor tools, never through a shell heredoc.
- A test that fails may be the test. Decide which, and say which in the commit.
- A doping knob spans six decades. Every doping field is on a log scale, and
  every tolerance is relative rather than a fixed epsilon.
- Wherever two numbers are shown as equal, ask what could make them differ
  silently. Then remove the cause or print it.
- The dark launch is enforced by a test. While `RELEASE_STATUS` says `dark`,
  nothing outside `apps/devices-lab/` may mention the lab, and
  `release.test.js` fails when anything does.
