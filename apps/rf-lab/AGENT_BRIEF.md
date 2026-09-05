# RF Lab: build brief

The plan is `/RF_LAB_PLAN.md`, and this brief turns it into lanes an agent can take
without colliding with another. Read the plan's §2 (the engine) and §5 (the
curriculum) for your lane before writing a line. Reed reviews everything.

Every number in this brief was computed by `apps/rf-lab/scripts/pins.mjs` before it
was written. Run that script to see any figure re-derived from the knobs.

## Boundaries: read first

- **One lane per agent, one worktree per agent.** The overseer works on
  `lab/rf-lab`, and every worktree gets its own `npm ci` so that `@ee-labs/*`
  resolves inside it.
- **Edit only the files your lane owns** (§1). Everything else is read-only. A
  change you need outside your lane goes into `apps/rf-lab/NEEDS.md` under your
  lane's heading. The owning lane picks it up.
- **Stage by path.** `git add packages/rf/src/smith.js`, never `git add -A` and never
  `commit -a`.
- **Never push.** The director merges `lab/rf-lab` and pushes.
- **Never edit a shared surface.** `site/`, `README.md`,
  `packages/ui/src/LabNav.jsx`, `.github/workflows/deploy.yml`, `CURRICULUM.md`,
  `PROGRAM.md` and `packages/ui/src/progression.test.js` belong to the director or to
  the seams overseer. Write what they need into `NEEDS.md`.
- **Preview port.** Lane number plus 4340, so lane 3 previews on 4343.

## The house discipline (non-negotiable)

Read `/CORE_SCOPE.md`, `/STYLE.md` and `/REVIEW_PLAYBOOK.md` first. Then the rule
every lab obeys. **Every explanatory sentence is a claim about physics, and a test
must measure it.** A lesson quotes no number the engine does not produce. A number is
never typed into a test as a constant when it can be computed from the knobs. On
screen text passes `node packages/prose/bin/lint.mjs`.

This lab carries one refusal that a reader could mistake for a missing feature. A
transmission line has no rational transfer function, and A5 is an experiment about
that rather than a footnote. The refusal message is content, and it has a test like
every other claim.

Commit messages are narrative. Read `git log` for the register. Never put a model
name in a commit or a file.

## 1. The lanes

| Lane | Work | Owns | Starts | Exit |
| --- | --- | --- | --- | --- |
| 1 | The exact core | `packages/rf/src/{sparam,convert,cascade,smith,line,fuzz}.js` and their tests, `packages/rf/index.js`, `packages/rf/package.json` | now | invariants 1, 2, 3, 5, 6 and 7 fuzzed green, contracts in §3 met |
| 2 | The chart canvas | `packages/ui/src/SmithCanvas.jsx` and its test, its export line in `packages/ui/index.js` | after lane 1's §3.4 | the canvas draws the Fields Lab and Instruments Lab prop sets, and its test names both |
| 3 | The app shell | everything in `apps/rf-lab/` not owned by lanes 4 and 5, `RELEASE_STATUS`, `release.test.js`, `NEEDS.md` | now, against §3.6's stub | the shell loads a stub experiment at 390 px, the release test passes dark |
| 4 | Group A, the line at one frequency | `apps/rf-lab/src/groups/a.js`, `lessons/a.js`, the terms group A lists | after lanes 1 and 3 | a1 to a5 pinned, A5's refusal on screen with its reason |
| 5 | Group B, the Smith chart | `apps/rf-lab/src/groups/b.js`, `lessons/b.js`, the terms group B lists | after lanes 1, 2 and 3 | b1 to b4 pinned, every circle read off `smith.js` |
| 6 | Matching and two-ports | `packages/rf/src/match.js`, `groups/{c,d}.js`, `lessons/{c,d}.js`, the S-parameter view | after the gate | invariant 4 green, c1 to c5 and d1 to d5 pinned |
| 7 | The device | `packages/rf/src/stability.js`, `groups/e.js`, `lessons/e.js` | after the gate and the Electronics Lab's Group K | invariants 8 to 10 green, e1 to e5 pinned |

**The gate.** Lanes 6 and 7 do not start until lane 1's exit is met and its contracts
are merged. Groups C to H are later sittings, and their ids stay out of the lesson
text until they exist. `experiments.test.js` fails on a reference to an experiment
that is not in the tree, by design.

**Shared seams, landed first.** Lane 1's first commit creates `packages/rf` and the
lockfile entry, so that `@ee-labs/rf` resolves for everyone. Lane 3's first commit
adds the app skeleton and the release test. Every other lane rebases onto those two.

## 2. The app skeleton (lane 3)

The Fields Lab's shape, file for file, with what this lab does not need deleted:

```
apps/rf-lab/
  index.html  package.json  vite.config.js  RELEASE_STATUS (dark)
  scripts/pins.mjs
  src/App.jsx  main.jsx  styles.css
  src/experiments.js      merges groups/*.js in plan order, no prose
  src/lessons.js          merges lessons/*.js, and readQuantity
  src/groups/{a..h}.js    one file per group, owned by that group's lane
  src/lessons/{a..h}.js   the see, try and why registers, same owner
  src/terms.js            definitions on contact, one registry
  src/math.js             one analysis per experiment, and nothing else calls the engine
  src/format.js           every number a reader sees comes through here
  src/report.js           the issue link's summary
  src/view.js             what SmithCanvas is given, per experiment
  src/components/panes.jsx  the line, sweep and numbers panes
  src/release.test.js  experiments.test.js  prose.test.js  terms.test.js
```

`experiments.test.js` is the Fields Lab's file with the paths of §4 added. Copy it,
do not rewrite it. The three registers, the guard channel and the refusal channel are
the same fields, so a reader who has used another lab has used this one.

## 3. Contracts

Every signature below is a promise between lanes. A lane may add to its return
shape, never rename or remove. Each contract ships with the failing test named beside
it, written before the implementation.

### 3.1 The scattering record (lane 1, `sparam.js`)

```js
// The record every other module takes. A one-port is the same shape with a 1 by 1 s.
{ f: 1e9, z0: 50, s: [[S11, S12], [S21, S22]], ports: 2, label: null }

twoPort({ f, z0, s, label })          // validated, complex pairs, throws RfError
fromPolar([[mag, deg], ...], opts)    // a data sheet's four, in reading order
onePort(gamma, { f, z0 })             // a load as a record

// Two exact AC solves. Port k is driven through Z0 and the other terminated in Z0,
// so S_kk = 2 V_k - 1 and S_ik = 2 V_i. Every source already in the netlist is
// silenced, because S describes what a network does to a wave.
sFromNetlist(net, ports, f, { z0 })   // ports names one node per port

mismatch(gamma)   // { gamma, mag, deg, vswr, returnLossDb, mismatchLossDb }
reciprocityError(rec)  unitarityError(rec)  maxSingularValue(rec)  powerBalance(rec, k)
```

Test: `sparam.test.js` > "S11 of a resistor to ground is the reflection coefficient,
at ten values", and "invariant 3: passivity and reciprocity".

### 3.2 Conversion (lane 1, `convert.js`)

```js
sToZ(S, z0)  zToS(Z, z0)  sToY(S, z0)  yToS(Y, z0)  sToAbcd(S, z0)  abcdToS(M, z0)
zToAbcd(Z)   abcdToZ(M)   abcdToY(M)   yToAbcd(Y)   zToY(Z)   yToZ(Y)

// The round trip invariant 1 names, with the loss the intermediates explain.
roundTrip(S, z0) // { s, error, scale, tolerance: 1e-12 + 1e-15 * scale }

// Two by two complex algebra, exported because cascade.js and the app use it.
eye2()  m2(a, b, c, d)  madd  msub  mscale  mmul  mdet  mnorm  minv(A, what)
```

A conversion through a matrix with no inverse throws `RfError` with `kind:
'singular-conversion'`, naming the determinant and the scale it is judged against.
An ideal transformer is the standard case, and its message says so.

Test: `convert.test.js`, the describe "invariant 1: S to Z to ABCD to Y to S returns
the input to 1e-12". Also its "an ideal transformer has a finite S-matrix and no
Z-matrix, and says which".

### 3.3 Cascading (lane 1, `cascade.js`)

```js
cascadeAbcd(A, B)        // one matrix product, left first
cascadeS(SA, SB)         // the closed composition, d = 1 - A22 B11
cascade(records)         // a chain by the S route, one z0 and one f
cascadeByAbcd(records)   // the same chain by the ABCD route
gammaIn(rec, gammaL)  gammaOut(rec, gammaS)
seriesTwoPort(Z, opts)  shuntTwoPort(Y, opts)  transformerTwoPort(n, opts)
```

`cascadeS` throws `kind: 'lossless-resonance'` when the round trip between the facing
ports has unit gain. That is a real circuit rather than an arithmetic accident, and
the message names it.

Test: `cascade.test.js` > "invariant 2: the two cascade routes agree", and "names the
lossless resonance rather than dividing by nothing".

### 3.4 The chart's geometry (lane 1, `smith.js`), and the canvas (lane 2)

```js
// The map and the two impedance families come from packages/fields/src/line.js and
// are re-exported. Decision 3 of the plan gives the derivation to the Fields Lab.
zToGamma(z)  gammaToZ(g)  normalise(Z, z0)  resistanceCircle(r)  reactanceCircle(x)
towardsGenerator(gamma, betaD, alphaD)

// What this lab adds.
gammaOfY(g)              // the admittance chart is the impedance chart turned round
conductanceCircle(g)  susceptanceCircle(b)
magnitudeCircle(mag)  vswrCircle(swr)  qArc(Q, sign)  qOf(gamma)
chart({ mode, r, x, vswr, q, mag })   // mode: 'z' | 'y' | 'both'
pointOn(circle, theta)  onCircle(circle, pt, tol)  arcPoints(circle, opts)
markerAt(Z, z0, { label })            // impedance, admittance, and three costumes
impedanceAt(gamma, z0)
pathTowardsGenerator(gammaL, { beta, length, alpha, points })
turnDegrees(beta, length)  inWavelengths(beta, length)
```

The canvas takes the five props the plan's §4.2 fixes. It carries the Fields Lab and
the Instruments Lab from the first commit.

```jsx
<SmithCanvas
  mode="z"                 // 'z' | 'y' | 'both', the admittance overlay for matching
  normalise={50}           // the reference impedance, printed on the chart
  points={[{ id, gamma, label, kind }]}         // labelled markers
  paths={[{ id, points: [[re, im], ...], label, kind }]}  // motion along a line
  circles={[{ family, value, cx, cy, radius, label }]}    // every family smith.js returns
  caption="…"              // the sentence under the chart
/>
```

`kind` on a marker or a path is one of `load`, `source`, `probe`, `move` or `ghost`.
The Fields Lab's transmission-line group needs `points` and `paths` with a rotation
towards the generator. The Instruments Lab's network analyser group needs `circles`
carrying a `family` it does not know about, so the renderer draws what it is given
and never switches on the family's name.

Test: `SmithCanvas.test.jsx`, the case "draws the Fields Lab's load and its rotation
towards the generator". Also its "draws a family it has never heard of".

### 3.5 The line (lane 1, `line.js`)

```js
lineAbcd(line, f, { atLength })        // { m: [[cosh, Z0 sinh], [sinh/Z0, cosh]], at, l }
lineTwoPort(line, f, { z0, atLength }) // the same as a scattering record
sweepLine(line, ZL, { from, to, points, z0 })   // { f, Z, gamma, points }

// The refusal. CORE_SCOPE Rule 2: a refused bridge is a finished feature.
refuseRational(line)      // throws RfError, kind: 'no-rational-line'
rationalAvailable(line)   // { ok: false, says, kind } — the sentence the pane prints
```

The physics is `packages/fields/src/line.js`, which derives `Z_0` and `gamma` from
the telegrapher's equations. This module holds the record shape and the refusal.

Test: `line.test.js`, the describe "invariant 6: N sections of a line equal one
section of the whole". Also its "invariant 7: the line is not rational, and the
refusal says why".

### 3.6 The stub lane 3 builds against

Before lane 4 lands, `groups/a.js` exports one experiment with the shape §4 gives and
the analysis returning a headline of `NaN`. The stub is deleted in the commit that
lands Group A. `experiments.test.js` fails if a stub survives it.

## 4. The lesson schema, and the quantity paths

The Fields Lab's `lessons.js` header and its three registers. They are `see` (at most
70 words), `try` (each step at most 45 words, with `set` and `reads`) and `why` (at
most 160 words). An experiment entry is the Fields Lab's shape, with `id`, `group`,
`kind`, `name`, `terms`, `params`, `view`, `views` and `headline`.

Three fields are this lab's. `z0` is the reference impedance the experiment works in.
`load` is the termination, as a complex pair or `Infinity`. `sweep` is the band the
sweep view walks, as `{ from, to, points }`.

Quantity paths a `reads` pair may name:

```
gamma.<mag|deg|re|im>              the reflection coefficient at the port
vswr  returnLoss  mismatchLoss     the same number in its other costumes
zin.<re|im|mag|deg>                the impedance looking into the line, ohms
zl.<re|im>                         the load, ohms
line.<beta|lambda|quarter|vp|electricalDeg|alphaDb|len>   the line at this frequency
sweep.<points|spread|first|last>   the exact sweep, and its extremes
refusal.<length|declined>          the hand-over the pane declines
chart.<r|x|g|b>.<cx|cy|radius>     a circle family's centre and radius
chart.<vswr|q>.radius              the standing-wave and constant-Q families
marker.<z|y>.<re|im>               the normalised impedance and admittance
marker.q                           the Q of the point on the chart
turn.<deg|wavelengths>             how far a length of line turns the point
path.<mag|turns>                   the path's magnitude, and the turns it makes
s.<11|21|12|22>.<mag|db|deg>       the two-port beside the chart
```

`experiments.test.js` resolves every path against the analysis and fails on a path it
cannot resolve, as the Fields Lab's does.

## 5. The library, with fixed names

Every fixture is a function of the knobs. Nothing below is a table.

```js
// The medium. PTFE at a relative permittivity of 2.1, which every group A and B
// experiment opens on. vp = c / sqrt(epsr) = 2.0688e8 m/s, 69.007 % of c.
const EPSR = 2.1
const VP = C0 / Math.sqrt(EPSR)
const QUARTER = (f) => VP / f / 4        // 5.1719 cm at 1.000 GHz

// `ptfeLine(len, alpha)` — the lab's line, lossless or with a stated attenuation in
// nepers per metre carried as a series resistance on the per-metre four.
ptfeLine(len, alpha) = alpha === 0
  ? describeLine({ Z0: 50, vp: VP, len })
  : describeLine({ L, C, R: 2 * alpha * 50, G: 0, len })

// The four loads group A turns, in ohms.
LOADS = { matched: [50, 0], high: [100, 0], low: [25, 0], complex: [30, -40] }

// The pi attenuator of a stated loss, for group D and for the two-port pane.
piPad(lossDb, z0)   // in packages/rf/src/fuzz.js, K = 10^(L/20)

// The two curated device sets, for group E. Both are generated from a small-signal
// netlist by the Electronics Lab's smallSignal, never loaded from a vendor file.
DEVICE_1 = at 2.000 GHz, potentially unstable, K = 0.6071
DEVICE_2 = at 8.000 GHz, unconditionally stable, K = 1.4332
```

Node names are fixed so that `reads` paths and layouts agree across lanes. A port is
`p1` or `p2`, and every internal node is numbered from `n0`.

## 6. What each lane pins

Every number in the plan's §5 for your groups becomes a `reads` pair checked in
`experiments.test.js`. The pins are functions of the knobs, computed in the test from
the parameters, never constants typed in.

| Lane | Pins |
| --- | --- |
| 1, the core | the round trip under `1e-12 + 1e-15 × scale` on forty random networks. The two cascade routes equal. `S12 = S21` and a largest singular value at most one. A lossless network unitary to `1e-8`. Every point on a constant-resistance circle at that resistance. N sections equal to one, for N from one to eight. The refusal thrown at a lossless line and at a lossy one |
| 2, the canvas | one marker, one path and one circle of an unknown family drawn from the props alone |
| 4, Group A | `0.3333` and `−0.3333`. VSWR `2.000`, `9.542 dB`, `0.5115 dB`. `30 − j40 Ω` giving `|Γ| = 0.5000`, VSWR `3.000` and `6.021 dB`. `5.1719 cm`, `20.688 cm` and `69.007 %`. `25.000 Ω`, `40.000 − j30.000 Ω` and `100.000 Ω`. `0.4343 dB/m` and `25.097 Ω`. 241 exact points, and the refusal firing |
| 5, Group B | the open at `Γ = 1`, the short at `−1`, the match at the centre. `r = 1` centred at `(0.5000, 0)` with radius `0.5000`. `x = 1` centred at `(1, 1.0000)` with radius `1.0000`. `3480.3 degrees` of turn per metre at 1.000 GHz, `180.00` over a quarter wave. The VSWR circle at `0.3333`. `y = 0.6000 + j0.8000` for the `30 − j40 Ω` load, and its Q of `1.3333` |
| 6, Groups C and D | `Q = 1.0000`, `7.9577 nH`, `1.5915 pF`, `100.00 %`. `70.711 Ω` and `36.700 %`. `−3.0000 dB`, `S11 = 0` and `−6.0000 dB` cascaded |
| 7, Group E | `K = 0.6071`, `|Δ| = 0.6964`, `μ = 0.8628`, `MSG = 21.934 dB`. `K = 1.4332` and `MAG = 11.667 dB`. `U = 0.10851` with the error inside its bound |

## 7. Verify before every hand-back

```
npx vitest run apps/rf-lab packages/rf packages/ui --maxWorkers=2
node packages/prose/bin/lint.mjs
npm run build --workspace apps/rf-lab
npx vite preview --outDir apps/rf-lab/dist --port 434N --strictPort
```

Screenshot every view at 390 px and at 1280 by 900, and read the screenshots as a
student would, per `/REVIEW_PLAYBOOK.md` §11. Nearly half of that document's defects
were invisible to a test suite and obvious in a picture.

## 8. The gate, and the gotchas the other labs paid for

- **Nothing in a lesson names an experiment that is not in the tree.** The Fields
  Lab's transmission-line group is not built, so Group A defines `Z_0` and `gamma` in
  a term panel and the cross-reference stays unlinked. Decision 3 of the plan says
  so, and `NEEDS.md` §2 carries the ids for the day it lands.
- **A closed form is exact and is never hedged.** The counter-rule in
  `CORE_SCOPE.md` is as serious as the guards. Nothing in groups A and B carries a
  guard, because everything in them is exact.
- **A refusal is not a missing feature.** A5's pane states the mathematics under the
  sweep rather than in a tooltip, and the test reads the message.
- **A number a lesson quotes is recomputed at the setting the step names.** A step's
  `set` is applied over the defaults, and every number with a unit in the sentence
  has to be one of the readings or a knob value.
- **Tolerances are relative to the scale of the answer**, never a fixed epsilon. A
  round trip through a matrix whose entries reach a million has thrown away six
  digits before the last conversion starts.
- **Wherever two numbers are shown as equal, ask what could make them differ
  silently.** Then remove the cause or print it.
- **The dark launch is enforced by a test.** While `RELEASE_STATUS` says `dark`,
  nothing outside `apps/rf-lab/` may mention the lab, and `release.test.js` fails
  when anything does.
