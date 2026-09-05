# Fields Lab: build brief

You are one of up to six agents building this lab. The plan is
`/FIELDS_LAB_PLAN.md`, and this brief turns it into lanes an agent can take
without colliding with another. Read the plan's §2 (the engine) and §5 (the
curriculum) for your lane before writing a line. Reed reviews everything.

## Boundaries: read first

- **One lane per agent.** Work in the overseer's worktree on branch
  `lab/fields-lab`. Never work in the shared checkout.
- **Edit only the files your lane owns** (§1). Everything else is read-only. If
  you need a change outside your lane, write it into
  `apps/fields-lab/NEEDS.md` under your lane's heading and continue with what
  you can do. The owning lane picks it up.
- **Stage by path.** `git add packages/fields/src/relax.js`, never `git add -A`
  and never `commit -a`. Workers do not commit. The overseer commits.
- **Never push.** The director merges `lab/fields-lab`.
- **Do not touch** `packages/network`, `packages/ui`, `site/`, `README.md`,
  `LabNav.jsx`, `deploy.yml`, or any other app.
- **Preview port.** Lane number plus 4320, so lane 3 previews on 4323.

## The house discipline

Read `/CORE_SCOPE.md`, `/STYLE.md` and `/REVIEW_PLAYBOOK.md` first. Then the
rule every lab obeys: **every explanatory sentence is a claim about physics, and
a test must measure it.** A lesson quotes no number the engine does not produce.
A prediction follows every control that can change it. On-screen text passes
`npm run lint:prose`.

Three rules are this lab's own.

1. **A closed form is exact and is never hedged.** No "approximately", no
   "roughly", no tilde. `CORE_SCOPE.md`'s counter-rule is as serious as its
   Rule 3.
2. **A grid number is quoted to the figures its guard allows.** Call
   `quoted(report, value)`. Never format a grid answer by hand.
3. **A refusal is content.** It has a message that names the reason and points
   at what is available instead, and it has a test.

Commit messages are narrative. Never put a model name in a commit or a file.

## 1. The lanes

| Lane | Work | Owns | Starts | Exit |
| --- | --- | --- | --- | --- |
| 1 | The static engine | `packages/fields/src/{const,geometry,integrate,closed,electrostatics,relax,conduction}.js` and their tests | now | invariants 1 to 5 fuzzed green, contracts §3.1 to §3.4 met |
| 2 | The magnetic engine | `packages/fields/src/{magnetics,induction}.js` and their tests | now | invariants 6 green, §3.5 met |
| 3 | The wave engine | `packages/fields/src/{wave,line,bounce,waveguide,antenna}.js` and their tests | now | invariants 7 to 10 green, §3.6 to §3.8 met |
| 4 | The app shell and the field map | everything in `apps/fields-lab/` not owned by lanes 5 and 6, plus `RELEASE_STATUS`, `release.test.js`, `scripts/verify.mjs` | now, against §3.9's stub | the shell loads a stub experiment at 390 px, the release test passes dark |
| 5 | Groups A to F | `apps/fields-lab/src/groups/{a..f}.js`, `lessons/{a..f}.js` | after lanes 1, 2 and 4 | 29 experiments pinned |
| 6 | Groups G to L | `apps/fields-lab/src/groups/{g..l}.js`, `lessons/{g..l}.js`, `components/{SmithCanvas,PatternCanvas,BounceCanvas}.jsx` | after lanes 3 and 4 | 24 experiments pinned |

**The gate.** Lanes 5 and 6 need their engine lane's exit met and its contracts
merged. No lesson is written against a function that does not exist.

**Shared seams, landed first.** Lane 1's first commit adds `const.js` and
`geometry.js`, which every other engine lane imports. Lane 4's first commit adds
the app skeleton and the release test. Every other lane builds on those two.

## 2. The app skeleton (lane 4)

Copy Circuit Elements Lab's shape, file for file, and delete what it does not
need.

```
apps/fields-lab/
  index.html  package.json  vite.config.js  RELEASE_STATUS (dark)
  AGENT_BRIEF.md  NEEDS.md
  scripts/numbers.mjs      every number the plan and the lessons quote
  scripts/verify.mjs       the Playwright pass, written not run
  src/App.jsx  main.jsx  styles.css
  src/experiments.js       merges groups/*.js in plan order, no prose
  src/lessons.js           merges lessons/*.js, and readQuantity
  src/groups/{a..l}.js     one file per group, owned by that group's lane
  src/lessons/{a..l}.js    the see / try / why registers, same owner
  src/terms.js             definitions on contact, one registry
  src/math.js              the analysis every view reads from
  src/format.js            engineering units and the figure rule
  src/report.js            the issue link's summary
  src/release.test.js  experiments.test.js  prose.test.js  terms.test.js
  src/components/  FieldMapCanvas (2d and profile modes), SmithCanvas,
                   BounceCanvas, PatternCanvas, GuideCanvas, SweepCanvas,
                   panes.jsx
```

`experiments.test.js` is Elements' file with this lab's quantity paths added.
Copy it, do not rewrite it.

## 3. Contracts

Every signature below is a promise between lanes. A lane may add to a return
shape, never rename or remove. Each contract ships with the failing test named
beside it, written before the implementation.

### 3.1 The geometry description (lane 1, `geometry.js`)

```js
// One object shape for every canonical geometry.
{ kind: 'coax', a: 0.45e-3, b: 1.475e-3, epsr: 2.25, mur: 1, sigma: 0, length: 1 }

// kind is one of these nine. `dims` is the order a lesson names them in.
KINDS = {
  parallelPlate: { dims: ['area', 'gap'],            has: ['capacitance', 'resistance'] },
  coax:          { dims: ['a', 'b'],                 has: ['capacitance', 'inductance', 'resistance'] },
  spherical:     { dims: ['a', 'b'],                 has: ['capacitance', 'resistance'] },
  twoWire:       { dims: ['a', 'd'],                 has: ['capacitance', 'inductance'] },
  wireOverGround:{ dims: ['a', 'h'],                 has: ['capacitance', 'inductance'] },
  bar:           { dims: ['area', 'len'],            has: ['resistance'] },
  solenoid:      { dims: ['area', 'len', 'turns'],   has: ['inductance'] },
  toroid:        { dims: ['a', 'b', 'height', 'turns'], has: ['inductance'] },
  loop:          { dims: ['a', 'wire'],              has: ['inductance'] },
}

describeGeometry(g) -> the same object with defaults filled and orderings checked
hasClosedForm(kind, quantity) -> boolean
labelOf(g) -> 'Coaxial, a = 0.00045 m, b = 0.001475 m'
epsOf(g), muOf(g) -> absolute permittivity and permeability
```

Every failure throws `FieldsError` with a `field` naming the dimension. Test:
`geometry.test.js` checks every default, every ordering message, and that
`describeGeometry` is idempotent.

### 3.2 The closed forms (lane 1, `closed.js`)

```js
capacitance(geometry) -> { value, perMetre, formula, neglects, symbol }
resistance(geometry, sigma) -> the same shape
inductance(geometry, { internal }) -> the same shape, plus `guard` for the loop
peakField(geometry, volts) -> V/m, the largest field in the geometry
fieldEnergy(geometry, volts) -> { W, Emax, density, at }
rcProduct(geometry, sigma) -> eps / sigma, in seconds
```

`value` is the whole object's figure including its `length`. `perMetre` is the
per-unit-length figure, or null for a geometry that has none. A geometry with no
closed form for the quantity throws, and the message says to solve it on a grid.

Test: `closed.test.js` checks every form against an independent numerical
integral of the field law. It also checks R C against eps over sigma, for every
geometry that has both.

### 3.3 The relaxation solver (lane 1, `relax.js`)

```js
// A specification.
{ width, height, n, potential(x, y), epsr(x, y),
  neumann: { left, right, top, bottom }, outer, tol, maxIter }

solveLaplace(spec) -> { nx, ny, h, W, V, fixed, iterations, maxUpdate, converged, spec }
valueAt(sol, x, y) -> volts, bilinear between nodes
fieldAt(sol, i, j) -> { ex, ey, mag }
energyPerMetre(sol, { symmetry }) -> J/m
capacitancePerMetre(sol, volts, { symmetry }) -> F/m
conductancePerMetre(sol, volts, sigma, { epsr, symmetry }) -> S/m
normalIntegral(sol, { i0, j0, i1, j1 }) -> volts, the contour's normal integral of E
fluxThrough(sol, rect) -> eps0 times that
chargeInside(sol, rect) -> C/m, from the discrete operator
staircaseFraction(sol) -> 0 to 1
```

### 3.4 The convergence report (lane 1, `relax.js`)

The guard, and the only sanctioned way to hand a grid answer to a caller.

```js
converge(build, { n, threshold, read, levels }) -> {
  levels: [{ n, h, value }],   // three refinements
  value,                       // the finest
  change,                      // |finest - previous| / |finest|, the guard's quantity
  threshold, ok,               // ok is change <= threshold
  order,                       // the observed convergence order
  richardson, estimate,        // the extrapolated value and its implied error
  staircase, boundary,         // 'follows the mesh' or 'cuts across the mesh'
  safety, band,                // 1.25 or 3, and safety times the error figure
  says,                        // one sentence for the panel
  solution,                    // the finest solve
}

agreesWithin(report, value) -> { rel, band, ok }
figuresOf(report) -> 3 when ok, 2 when not
quoted(report, value) -> the value rounded to those figures
```

`build(n)` returns a specification at n cells across. `read(sol)` reads the one
number the guard is about. An unconverged relaxation throws rather than being
read.

Test: `relax.test.js` checks three cases. The trough against its Fourier series.
The parallel plate against eps A over d, to machine precision. The round coax
against its closed form inside `band`, at twelve radius ratios.

### 3.5 Magnetics and induction (lane 2)

```js
segmentField(a, b, I, p, mu) -> [bx, by, bz]     // one straight segment, closed form
biotSavart(path, I, p, mu) -> [bx, by, bz]       // a polyline
circlePath(a, { sides, z, centre }) -> [[x,y,z]] // a loop as a polyline
loopOnAxis(a, I, z, mu) -> tesla                 // the closed form it is checked against
ampereLoop(field, { centre, r, axis, points }) -> the line integral
enclosedCurrent(lineIntegral, mu) -> amperes

magneticCircuit({ meanLength, area, mur, gap, gapArea, turns, current }) -> {
  reluctance: { core, gap, total }, mmf, flux, Bcore, Bgap, Hcore, Hgap,
  inductance, gapShare, fringed, guard,
}
transformer({ ...circuit, n1, n2, leakage }) -> { L1, L2, M, k, turnsRatio, ... }

skinDepth(f, { mur, sigma }) -> metres
surfaceImpedance(f, material) -> { R, X, mag, phaseDeg, delta }
wireImpedance(a, f, material) -> { R, L, Rdc, ratio, Lint, delta, q, steps }
wireHighFrequency(a, f, material) -> { R, exact, error, guard }
eddyLossSheet({ thickness, Bpeak, f, rho, mur }) -> { P, delta, guard }
faradayEmf({ turns, area, Bpeak, f }) -> { fluxPeak, peak, rms, coefficient }
motionalEmf({ B, length, speed, angleDeg }) -> { emf, force }
```

Every `guard` has the same five fields: `quantity`, `value`, `threshold`, `ok`
and `says`. The app renders any guard without knowing which it has.

Test: `magnetics.test.js` checks a polygon against `loopOnAxis` at three side
counts, and Ampere's law against Biot-Savart. `induction.test.js` checks
`wireImpedance` at its two limits and against the published Kelvin-function
table at q = 2, 4 and 8.

### 3.6 The wave (lane 3, `wave.js`)

```js
planeWave(f, { epsr, mur, sigma }) -> {
  alpha, beta, gamma, eta, etaMag, etaDeg, vp, lambda, lambda0, n,
  lossTangent, penetration, lossless,
}
polarisation({ ax, ay, phaseDeg }) -> { kind, axialRatio, axialRatioDb, tiltDeg, sense, at }
reflectNormal(f, medium1, medium2) -> { gamma, tau, mag, deg, powerReflected, powerTransmitted, swr }
standingWave(gamma, beta, { E0 }) -> { swr, max, min, firstMinAt, period, at }
reflectOblique(thetaDeg, m1, m2, pol) -> { transmittedDeg, total, criticalDeg, brewsterDeg, perpendicular, parallel }
```

A lossless medium's `alpha` is exactly zero and its `eta` exactly real, computed
by the lossless branch rather than by a complex square root. Oblique incidence
onto a conducting medium throws with its reason.

### 3.7 The line (lane 3, `line.js`)

```js
describeLine({ Z0, vp, len }) or describeLine({ R, L, G, C, len })
  -> { R, L, G, C, len, Z0, vp, lossy, delay, source }
lineFromGeometry(geometry, { len, sigmaDielectric }) -> the same
lineAt(line, f) -> { gamma, alpha, beta, Z0, Z0mag, lambda, vp, electricalDeg, lossless }
reflectionCoefficient(ZL, Z0) -> [re, im];  Infinity is an open and gives exactly 1
inputImpedance(line, ZL, f, { atLength }) -> { Z, at, l }
quarterWave(Zin, ZL, { f, vp }) -> { Z0, length, lambda }
sMatrix(line, f, Zref) -> { s11, s12, s21, s22, abcd }
lineStandingWave(line, ZL, f) -> { gamma, mag, swr, returnLossDb, mismatchLossDb, atDistance }
zToGamma(z), gammaToZ(g), normalise(Z, Z0), resistanceCircle(r), reactanceCircle(x),
towardsGenerator(gamma, betaD, alphaD)
timeDomainAvailable(line) -> { ok, says }
refuseLossyTime(line) -> throws FieldsError with kind 'lossy-line-in-time'
```

**`describeLine` must be idempotent.** A described line carries both `Z0` and
the per-metre four, so reading it a second time must take the branch that keeps
the losses. Reading the other branch first turns a lossy line into a lossless
one silently, and `line.test.js` has a test named for exactly that.

### 3.8 The bounce diagram (lane 3, `bounce.js`)

```js
bounceDiagram({ Vs, Rs, Z0, RL, len, vp })  // or T instead of len and vp, or line
  -> { Z0, T, len, Rs, RL, Vs, gammaS, gammaL, first, product, rings,
       waves, steady: { v, divider, i }, truncatedAt, complete,
       at(x, t), atEnd(t), atSource(t), ladder, says }
loadTrace(diagram, { until, points }) -> { t, v, i }
snapshot(diagram, time, { points }) -> { x, v, i }
resistiveGamma(R, Z0) -> number; Infinity is an open and gives exactly +1
requireLossless(line) -> the described line, or throws
```

`steady.v` must equal `steady.divider` to floating point for every resistive
pair that has a steady state. That is invariant 7 and it is the test that says
the event loop is right.

`rings` is true when the two reflection coefficients multiply to a magnitude of
one. No steady value is quoted for such a line.

**The events note.** This loop is self-contained because `@ee-labs/events` is
not built. `NEEDS.md` records that it should later run on that package. Keep the
wave record (`amp`, `dir`, `launchedAt`, `arrivesAt`) as it is, because it is
the shape an events queue carries.

### 3.9 The field map canvas (lane 4, `components/FieldMapCanvas.jsx`)

This one is a contract with another lab, not only between lanes. The Devices Lab
is the second user named in `PROGRAM.md` §4, and `/DEVICES_LAB_PLAN.md`
Decision 5 states what it needs. Build to this shape from the first commit.

```js
{
  mode,        // '2d' or 'profile'
  domain,      // { width, height } in metres
  scalar,      // (x, y) => number, the colour field
  vector,      // (x, y) => [ex, ey], arrows and field lines
  equipotentials, // [{ level, points }]
  conductors,  // [{ path, potential }]
  probe,       // { x, y }, the cursor, read out in the header
  units,       // { length: 'mm', scalar: 'V', vector: 'V/m' }
  profile: {
    axis,      // 'x' or 'y', the spatial axis the curve runs along
    cut,       // the cut's position in the other coordinate, in metres
    scalar:    { read(t), label, unit },        // the left axis
    secondary: { read(t), label, unit } | null, // the right axis, optional
    regions:   [{ from, to, label, edge }],     // boundaries drawn as marked lines
    stack:     [{ scalar, secondary, regions }] | null, // panels over one position axis
  },
}
```

`regions` draws a depletion edge. `secondary` puts a second scalar on a right
axis. `stack` draws a triple of charge density, field and potential over one
position axis with the edges aligned, which is the Devices Lab's own view. Every
panel in a stack shares the position axis and its ticks, so one knob moves all
of them together.

Test: `components/FieldMapCanvas.test.jsx` renders both modes, a stack of three,
and a profile with two axes and two regions. It then checks that the position
axis ticks are identical across the stack.

### 3.10 The stub lane 4 builds against

Until lanes 5 and 6 land, `experiments.js` exports one experiment so the shell
has something to render.

```js
export const STUB = {
  id: 'b2',
  group: 'B · Capacitance',
  name: 'A coaxial cable holds 2 pi eps over ln(b/a)',
  geometry: { kind: 'coax', a: 0.45e-3, b: 1.475e-3, epsr: 2.25 },
  params: [Len('a', 'Inner radius', 0.45e-3), Len('b', 'Shield radius', 1.475e-3),
           Eps('epsr', 'Dielectric', 2.25), Volt('V', 'Voltage', 100)],
  view: 'map',
  views: ['map', 'profile', 'numbers'],
}
```

## 4. The lesson schema, and this lab's quantity paths

The schema is Circuit Elements Lab's, unchanged.

```js
{
  see: 'the picture at the defaults, one paragraph',
  seeReads: [['path', value]],
  try: [{ say: 'Set b to 3 mm. C falls to 84.1 pF/m.', set: { b: 3e-3 }, reads: [['C.perMetre', 84.1e-12]] }],
  why: 'the reasoning, for after the picture has made its point',
}
```

A step's `set` is applied on top of the defaults. `experiments.test.js` solves
each step and checks both the pair and every number-with-unit in the sentence.
`refuses: true` marks a step whose point is that the engine declines.

The quantity paths this lab adds:

| Path | Reads |
| --- | --- |
| `C.value`, `C.perMetre` | capacitance, whole and per metre |
| `L.value`, `L.perMetre` | inductance |
| `R.value`, `R.perMetre` | resistance |
| `E.peak`, `E.at.<x>.<y>` | field magnitude |
| `V.at.<x>.<y>` | potential, from the closed form or the grid |
| `W.total`, `W.density` | stored energy and its density |
| `grid.value`, `grid.change`, `grid.order`, `grid.band` | the convergence report |
| `flux.value`, `flux.charge` | the Gauss check |
| `B.at.<x>.<y>.<z>`, `B.centre` | flux density |
| `circuit.<flux\|inductance\|gapShare\|Bcore>` | the magnetic circuit |
| `xfmr.<L1\|L2\|M\|k>` | the transformer |
| `skin.<delta\|ratio\|Rac>` | the skin effect |
| `wave.<eta\|beta\|alpha\|lambda\|vp\|lossTangent>` | the plane wave |
| `refl.<mag\|deg\|swr\|powerReflected>` | reflection |
| `line.<Z0\|beta\|lambda\|delay\|electricalDeg>` | the line |
| `zin.<re\|im\|mag\|deg>` | input impedance |
| `bounce.<first\|gammaS\|gammaL\|steady\|at>` | the bounce diagram |
| `guide.<fc\|lambdaGuide\|vp\|vg\|eta>` | the waveguide |
| `ant.<directivity\|dbi\|beamwidth\|rrad\|gain>` | the antenna |

## 5. What each lane pins

- **Lane 1.** Invariants 1 to 5. The trough against its series to five figures.
  The plate against eps A over d to fourteen. The coax inside its band at twelve
  radius ratios, with the worst margin reported.
- **Lane 2.** Invariant 6. `wireImpedance` at q = 2, 4 and 8 against the
  published table to four figures, and its two limits to twelve.
- **Lane 3.** Invariants 7 to 10. `steady.v` against `steady.divider` at fifty
  fuzzed resistive pairs. S21 against S12 at fifty fuzzed frequencies on lossy
  and lossless lines. The dipole's 1.64092 and its 73.0790 ohms.
- **Lane 4.** The release test dark. The shell at 390 px with no horizontal
  scroll. Every view switch reachable.
- **Lanes 5 and 6.** Every number in every `see`, `try` and `why`, recomputed
  from the engine. Every term used in a lesson defined in `terms.js` and
  introduced by the first experiment that lists it.

## 6. Verify before every hand-back

```
npx vitest run                              # the whole suite, green
node packages/prose/bin/lint.mjs            # every .md, clean
npm run build --workspace apps/fields-lab   # succeeds
node apps/fields-lab/scripts/numbers.mjs    # every plan figure still reproduces
```

## 7. Gotchas the other labs paid for

- **A sentence must follow every control that can change its fact.**
  `REVIEW_PLAYBOOK.md` §1. A note that says "the field is largest at the inner
  conductor" is false for a parallel plate, so it branches on the geometry.
- **State the base rule before applying it.** §2 of the same. "The field falls
  as one over r squared, so at twice the distance it is a quarter" beats "it is
  a quarter".
- **Never print a number you have not computed from the running code.** §3.
- **Axes carry a quantity and a unit, and adapt without fidgeting.** §4. The
  field map's colour scale is fixed while a knob moves and re-frames on a
  geometry change.
- **Check the lesson's feature can be seen.** §5. A staircase boundary at 20
  cells is four pixels of step on a 400 pixel canvas. C3 opens at 60.
- **Occlusion.** §6. Equipotentials and field lines cross everywhere, so they
  differ in weight and in colour, not only in style.
- **Definitions on contact.** §8. Every term a lesson leans on is in
  `terms.js`, and `glossary.test.js` checks that no earlier experiment uses the
  word.
- **The grid solver is slow.** Cache a solve by its specification inside
  `math.js`. A view switch must not re-solve.
