# DSP Lab: build brief

You are one of up to six agents building this lab in parallel. The plan is
`/DSP_LAB_PLAN.md`, and this brief turns it into lanes an agent can take without
colliding with another. Read the plan's §2 (engine) and §5 (curriculum) for your
lane before writing a line. Reed reviews everything.

## Boundaries: read first

- **One lane per agent.** Work in the lab's worktree on `lab/dsp-lab`, and
  `npm ci --no-audit --no-fund` before anything else so `@ee-labs/*` resolves
  inside the worktree.
- **Edit only the files your lane owns** (§1). Everything else is read-only. If you
  need a change outside your lane, write it into `apps/dsp-lab/NEEDS.md` under your
  lane's heading and continue with what you can do. The owning lane picks it up.
- **Stage by path.** `git add apps/dsp-lab/src/groups/a.js`, never `git add -A` and
  never `commit -a`. Workers do not commit at all. The overseer commits.
- **Never push.** The director merges `lab/dsp-lab` and pushes.
- **`packages/dsp` is additions only.** Signal Lab, Circuit Lab, Control Lab and
  Power Lab all call it. A new module and a new export are fine. A changed signature
  is not, and the whole suite must be green before any commit that touches it.
- **Preview port.** Lane number plus 4320, so lane 3 previews on 4323.

## The house discipline (non-negotiable)

Read `/CORE_SCOPE.md`, `/STYLE.md` and `/REVIEW_PLAYBOOK.md` first. Then the rule
every lab obeys. **Every explanatory sentence is a claim about physics, and a test
must measure it.** A lesson quotes no number the engine does not produce. A
prediction follows every control that can change it. A claim the settings cannot
show is footnoted, never crossed out. On-screen text passes `npm run lint:prose`.

This lab leans on the third of `CORE_SCOPE.md`'s categories more than any other in
the suite. Three of its blocks have no transfer function, and each says why in a
sentence the card prints. Do not add a response curve to any of them.

Commit messages are narrative. Read `git log` for the register.

## 1. The lanes

| Lane | Work | Owns | Starts | Exit |
| --- | --- | --- | --- | --- |
| 1 | The engine (**done**) | `packages/dsp/src/{multirate,design,adaptive,fixpoint,estimate,complexChain}.js` and their tests, plus the export block in `index.js` | done | invariants 1 to 18 fuzzed green, contracts in §3 met |
| 2 | The app shell and the specification pane (**done**) | everything in `apps/dsp-lab/` not owned by lanes 3 to 6, `RELEASE_STATUS`, `release.test.js`, `components/SpecPane.jsx`, `scripts/verify.mjs` | after lane 1 | the shell loads a lesson at 390 px, the release test passes dark |
| 3 | Rate and design (**done**) | `src/groups/{a,b}.js`, `src/lessons/{a,b}.js`, `components/MaskCanvas.jsx` | after lane 2's shell commit | A1 to A7 and B1 to B8 pinned |
| 4 | Fixed point (**done**) | `src/groups/e.js`, `src/lessons/e.js`, `components/PoleGridCanvas.jsx` | after lane 2 | E1 to E6 pinned |
| 5 | Adaptive (**done**) | `src/groups/c.js`, `src/lessons/c.js`, `components/WeightCanvas.jsx` | after lane 2 | C1 to C7 pinned |
| 6 | Estimation and the transform (**done**) | `src/groups/{d,f}.js`, `src/lessons/{d,f}.js`, `components/{DensityCanvas,ButterflyCanvas}.jsx` | after lane 2 | D1 to D7 and F1 to F5 pinned |

Every lane is built and pinned. `scripts/verify.mjs` is the one item of lane 2 that
is not, and `NEEDS.md` carries it. What follows is the record of the contracts the
lanes were built to, kept because the next pass extends them rather than replaces
them.

**The gate.** Lanes 3 to 6 need lane 2's shell commit, which lands
`src/blocks.js`, `src/chain.js`, `src/experiments.js`, `src/state.js`, `src/App.jsx`
and the stub lesson of §3.7. Nothing starts a group before that commit is on the
branch. After it, the four group lanes are independent and touch no file in common.

**Shared seams, landed first.** Lane 1's export block in `packages/dsp/index.js`,
then lane 2's `src/blocks.js`, which every group lane imports and none of them
edits. A group lane that needs a new block parameter writes it into `NEEDS.md` and
lane 2 adds it.

## 2. The app skeleton (lane 2)

Copy Signal Lab's shape, file for file, and delete what it does not need. The
interaction model is the same one: sources into a chain of blocks into a time view
and a frequency view.

```
apps/dsp-lab/
  index.html  package.json  vite.config.js  RELEASE_STATUS (dark)
  AGENT_BRIEF.md  NEEDS.md  README.md
  scripts/numbers.mjs        every number the plan quotes, computed
  scripts/verify.mjs         the Playwright harness, written not run
  src/App.jsx  main.jsx  styles.css
  src/blocks.js              the block registry, lane 2 only
  src/chain.js               createChain(BLOCK_TYPES), as Signal Lab's
  src/state.js               INITIAL and presetState
  src/chips.js               one-click settings, copied from Signal Lab
  src/experiments.js         merges groups/*.js and lessons/*.js in plan order
  src/measure.js             the quantity paths, and measure.test.js under them
  src/groups/{a,b,c,d,e,f}.js    one file per group, owned by that group's lane
  src/groups/{c,d,e,f}.test.js   that group's pins, one file per lane
  src/lessons/{a,b,c,d,e,f}.js   see / try / why, same owner
  src/terms.js               merges terms/*.js, plus the words scanner
  src/terms/{ab,c,d,e,f}.js  definitions on contact, one file per group
  src/release.test.js  experiments.test.js  prose.test.js  terms.test.js
  src/components/            SpecPane, WeightCanvas, PoleGridCanvas,
                             DensityCanvas, ButterflyCanvas, and the Signal Lab
                             components this lab copies (§6)
```

`release.test.js` is `apps/circuit-elements-lab/src/release.test.js` with the slug
changed. Copy it, do not rewrite it.

## 3. Contracts

Every signature below is a promise between lanes. A lane may add to a return shape,
never rename or remove. Each contract names the test that fails without it.

### 3.1 The rate blocks (lane 2, in `src/blocks.js`)

```js
decimate: {
  label: 'Decimate and hold',
  group: 'Rate',
  defaults: { M: 4, antialias: true, taps: 121, window: 'blackman', implementation: 'direct' },
  // Not shift-invariant, so no H(f) and no phase. The reason is a string the
  // card prints, per CORE_SCOPE Rule 2.
  response: () => null,
  reason: 'A rate change keeps a different set of samples when its input is delayed, so it has no transfer function. The anti-alias filter before it does.',
  make: (p, sampleRate) => makeDecimateHold({
    M: p.M,
    h: p.antialias ? designDecimationFir({ M: p.M, taps: p.taps, window: p.window }, sampleRate) : null,
  }),
  // The polyphase route, for A5. Same output, M times fewer multiplies.
  cost: (p, sampleRate) => multirateCost({ taps: p.taps, factor: p.M, sampleRate }),
}

interpolate: {
  label: 'Interpolate',
  group: 'Rate',
  defaults: { L: 4, fill: 'filter', taps: 121, window: 'blackman', implementation: 'direct' },
  response: () => null,
  reason: 'Zero stuffing is not shift-invariant either, and the images it leaves are what the filter after it removes.',
  make: (p, sampleRate) => makeInterpolateFill({
    L: p.L,
    fill: p.fill,   // 'zeros' | 'hold' | 'filter'
    h: p.fill === 'filter' ? designInterpolationFir({ L: p.L, taps: p.taps, window: p.window }, sampleRate) : null,
  }),
}
```

Test: `blocks.test.js` asserts `response` returns null for both blocks. It asserts
`reason` is a non-empty sentence. And it asserts the chain's response overlay
reports `exact: false` when either block is present.

### 3.2 The design blocks (lane 2)

```js
firspec: {
  label: 'FIR to a specification',
  group: 'Design',
  defaults: { fpass: 4000, fstop: 6000, ripplePassDb: 1, stopDb: 60, method: 'remez', window: 'blackman' },
  // method: 'window' | 'remez'
  design: (p, sampleRate) =>
    p.method === 'remez'
      ? designRemezSpec(p, sampleRate)
      : designFirSpec(p, sampleRate),
  make: (p, sampleRate) => { const h = design(p, sampleRate).h; ... },
  response: (p, f, sampleRate) => firResponse(design(p, sampleRate).h, f, sampleRate),
  phase: (p, f, sampleRate) => firPhase(design(p, sampleRate).h, f, sampleRate),
  kernel: (p, sampleRate) => design(p, sampleRate).h,
  // The pane reads this, and only this.
  spec: (p, sampleRate) => design(p, sampleRate).margin,
}

iirspec: {
  label: 'IIR to a specification',
  group: 'Design',
  defaults: { fpass: 4000, fstop: 6000, ripplePassDb: 1, stopDb: 60, prototype: 'chebyshev1' },
  design: (p, sampleRate) => designIirSpec({ ...p, type: p.prototype }, sampleRate, cascadeResponse),
  response: (p, f, sampleRate) => cascadeResponse(design(p, sampleRate).sections, f, sampleRate),
  pz: (p, sampleRate) => sections.flatMap(biquadPolesZeros),
  spec: (p, sampleRate) => design(p, sampleRate).margin,
}
```

`design()` is memoised per (params, sampleRate) in `blocks.js`, because
`renderChain` calls `make` on every invocation and a Remez exchange is not free.
Test: `blocks.test.js` pins that a hundred calls run one design.

Test: `experiments.test.js` asserts `spec().met` is true for every design preset.
It also asserts `spec().bands` holds one entry per band, each with a margin in
decibels.

### 3.3 The adaptive blocks (lane 2)

```js
plant: {
  label: 'Unknown plant',
  group: 'Adaptive',
  defaults: { taps: '0.4,-0.3,0.25,0.1,-0.05,0.02,0.01,0' },
  // An ordinary FIR, so it keeps its H(f). It is the thing being identified.
  make: (p) => ({ process: makeFir(tapsOf(p)), settle: tapsOf(p).length - 1 }),
  response: (p, f, sampleRate) => firResponse(tapsOf(p), f, sampleRate),
}

adaptive: {
  label: 'Adaptive filter',
  group: 'Adaptive',
  defaults: { algorithm: 'lms', taps: 8, mu: 0.02, lambda: 0.999, delta: 0.01,
              plant: '0.4,-0.3,0.25,0.1,-0.05,0.02,0.01,0', noiseAmp: 0.05, output: 'error' },
  // output: 'error' | 'estimate' | 'wanted'
  response: () => null,
  reason: 'The coefficients change at every sample, so this filter is not one filter and has no H(z). The weight view shows the sequence of filters it is.',
  make: (p, sampleRate) => { /* runs makeAdaptive per sample, plant applied inline */ },
  // The view reads this, not the block's own state.
  run: (p, buf, sampleRate) => runAdaptive({ x: buf, plant: tapsOf(p.plant), ...p, stride: strideFor(buf.length) }),
}
```

`run` is what the weight view calls. It returns `{ y, e, d, w, history, stride }`
from `packages/dsp`, and `history` is one Float64Array per stride. Test:
`blocks.test.js` asserts `response` is null, `reason` is a sentence, and
`run().history[0]` is all zeros.

### 3.4 The fixed-point block (lane 2)

```js
fixedbiquad: {
  label: 'Fixed-point biquad',
  group: 'Fixed point',
  defaults: { mode: 'lowpass', freq: 600, q: 10, coeffBits: 16, coeffInt: 2,
              stateBits: 0, stateInt: 1, rounding: 'round', overflow: 'saturate' },
  // stateBits 0 means float64 state, which is the linear case.
  coeffs: (p, sampleRate) => quantizeBiquad(designBiquad(p, sampleRate), coeffQ(p)),
  make: (p, sampleRate) => makeFixedBiquad(designBiquad(p, sampleRate), {
    coeffQ: coeffQ(p),
    stateQ: p.stateBits > 0 ? stateQ(p) : null,
  }),
  // The quantised coefficients are exactly rational, so this is exact while the
  // state is float64 and describes only part of the behaviour once it is not.
  response: (p, f, sampleRate) => biquadResponse(coeffs(p, sampleRate).coeffs, f, sampleRate),
  lti: (p) => p.stateBits === 0,
  pz: (p, sampleRate) => { const r = coeffs(p, sampleRate); return { poles: r.poles, zeros: r.zeros, exactPoles: r.exactPoles } },
}
```

`lti` is Signal Lab's own predicate, and the chain already asks it before claiming a
kernel is exact. Test: `blocks.test.js` asserts the response equals a measured
impulse response while `stateBits` is 0, and that `lti` is false once it is not.

### 3.5 The specification pane (lane 2, `components/SpecPane.jsx`)

Built to `APPLIED_ANALOG_LAB_PLAN.md` §4.3, with both prop forms from the first
commit.

```jsx
<SpecPane
  items={[{ key, label, value, target, unit, cmp, tol, margin, pass }]}
  binding="stop.depth"
  mode="table" | "bars"
  mask={{ axis: 'f', bands: [{ id, label, from, to, max, min, maxDb, minDb, atHz, marginDb, met }] }}
  onEdit={(key, target) => {}}
/>
```

- `cmp` is `'min' | 'max' | 'window'`. `tol` carries the allowance for `window`.
- `pass` and `margin` are computed by the caller, never by the pane, so one function
  decides them everywhere. For a mask that function is `specMarginRef`.
- `mask.bands` is exactly what `specMarginRef(bands, evaluate).bands` returns, so a
  caller passes it through with no reshaping.
- `mode: 'bars'` is the phone layout, one bar per row with the margin as its length.
- `onEdit` absent means the targets are fixed and no field renders.

Test: `SpecPane.test.jsx` renders both forms. It asserts a met row and a missed row
read differently, and that a missed row names the frequency. It asserts no row
renders a margin the caller did not supply.

### 3.6 The views (lane 2, and the group lanes for their own canvas)

```js
TIME_VIEWS = ['signal', 'weights']
FREQ_VIEWS = ['spectrum', 'density', 'response', 'zplane', 'polegrid', 'butterfly']
```

Each canvas takes the same props Signal Lab's do: `{ width, height, data, axes,
marks }`. A view a lesson does not name is not rendered.

### 3.7 The stub lane 2 builds against

```js
// src/groups/stub.js — deleted when lane 3 lands group A.
export const STUB = [{
  id: 'a1', group: 'Changing the rate', name: 'Decimation, and the fold it causes',
  terms: ['decimation', 'alias', 'nyquist'],
  patch: { sources: [{ id: 1, type: 'sine', freq: 9000, amp: 1, phase: 0, enabled: true }],
           blocks: [{ id: 1, type: 'decimate', bypass: false,
                      params: { M: 4, antialias: false, taps: 121, window: 'blackman' } }],
           sampleRate: 48000, fftSize: 4096, freqView: 'spectrum' },
  claim: { at: 3000, reads: 0.9061 },
}]
```

## 4. The lesson schema, and the quantity paths

Copy Signal Lab's `presets.js` header comment and the three registers. They are
`see` (at most 70 words), `try` (each step at most 45 words) and `why` (at most 160
words). An experiment entry is Signal Lab's shape, with `id`, `group`, `name`,
`terms`, `note`, `try`, `chips`, `featured` and `patch`. Two fields are new.
`spec` names the specification rows the pane shows. `claim` is the pinned reading.

Quantity paths a `claim` may name:

```
line.<hz>                        the amplitude of the spectral line at that frequency
db.<hz>                          the same in decibels, referred to full scale
rate.<nyquist|grid|alias>        the new Nyquist, the coarse grid rate, the fold
cost.<direct|polyphase|ratio>    multiplies a second, and the saving
design.<taps|order|coefficients> what the design settled on
design.<estimate|grew>           what the formula asked for, and what the search added
spec.<band>.<marginDb|maxDb|minDb|atHz|met>   the pane's own rows
spec.worst                       the band that binds
lms.<bound|misadjustment|settled|reach>       the step bound, the excess, the samples
fix.<delta|radius|moved|stable>  the quantiser's step, and what it did to the poles
fix.<deadband|noiseGain|rmsOut>  the limit cycle and the rounding noise
psd.<mean|cv|df|segments>        the estimator's level, scatter and resolution
ar.<a1|a2|sigma2|peak|aic|mdl>   the model and the order criteria
fft.<butterflies|direct|ratio|stages>         the transform's cost
```

`experiments.test.js` resolves every path against the engine and fails on a path it
cannot resolve, as the Elements lab's does.

## 5. Library settings

The plan's §4.4 defaults. Names are fixed so `claim` paths and layouts agree across
lanes.

```js
// Group A: the rate chain
const RATE = { sampleRate: 48000, fftSize: 4096, window: 'hann' }
// A1, A2: one interferer above the new Nyquist and one tone below it
sources: [mk(1, 'sine', 9000, 1)]                       // folds to 3000
sources: [mk(1, 'sine', 1500, 1)]                       // survives, droop 0.9745
blocks:  [bk(1, 'decimate', { M: 4, antialias: false })] // A1
blocks:  [bk(1, 'decimate', { M: 4, antialias: true, taps: 121, window: 'blackman' })] // A2
// A3, A4: images at 10500, 13500 and 22500 Hz
sources: [mk(1, 'sine', 1500, 1)]
blocks:  [bk(1, 'interpolate', { L: 4, fill: 'zeros' })]  // A3
blocks:  [bk(1, 'interpolate', { L: 4, fill: 'filter', taps: 121, window: 'blackman' })] // A4

// Group B: the reference specification, used by every experiment in the group
const SPEC = { fpass: 4000, fstop: 6000, ripplePassDb: 1, stopDb: 60 }
blocks: [bk(1, 'firspec', { ...SPEC, method: 'window', window: 'blackman' })] // 133 taps
blocks: [bk(1, 'firspec', { ...SPEC, method: 'remez' })]                      // 53 taps
blocks: [bk(1, 'iirspec', { ...SPEC, prototype: 'butterworth' })]             // order 18
blocks: [bk(1, 'iirspec', { ...SPEC, prototype: 'chebyshev1' })]              // order 9

// Group C: the plant, and the echo path
const PLANT = '0.4,-0.3,0.25,0.1,-0.05,0.02,0.01,0'
const ECHO  = '0,0,0,0.6,0.3,-0.2,0.1,0.05'
sources: [mk(1, 'noise', 0, 1)]
blocks:  [bk(1, 'adaptive', { algorithm: 'lms', taps: 8, mu: 0.02, plant: PLANT })]
blocks:  [bk(1, 'adaptive', { algorithm: 'nlms', taps: 12, mu: 0.5, plant: ECHO, noiseAmp: 0.1 })]

// Group D: white noise, and a genuine AR(2)
sources: [mk(1, 'noise', 0, 1)]
// The AR process is a source, not a block: y[n] = 1.6 y[n-1] - 0.9 y[n-2] + w[n]

// Group E: the section every fixed-point experiment quantises
blocks: [bk(1, 'fixedbiquad', { mode: 'lowpass', freq: 600, q: 10, coeffBits: 16 })]
// pole radius 0.996085, dead band 81 steps, noise gain 10433.8
```

## 6. What each lane pins, and what it copies

| Lane | Pins |
| --- | --- |
| 3, Group A | 6000 Hz, 3000 Hz, 0.9061, 0.9003, 0.9760, 0.9745, 117.7 dB, 2.043e-6, 112.9 dB, 0.2500 four times, 4.0000, 1.0000, 95.1 dB, 5.808e6, 1.452e6, 6.24e-16, 15 and 57 taps, and both identities bit for bit |
| 3, Group B | 533/1837/1956/3259 estimated and 528/1782/1518/2346 measured, 48.7/50.4/51.4/51.6 dB against 3863/1956/984/788 Hz, 133, 53, 51, 60.40 dB, 28 alternations, 18, 9, 45, 25, 5.3, 26 samples, 3.0103 dB, 28.3423 dB |
| 4, Group E | step 1.95e-3, radius 0.996085, 3.04e-6 / 2.41e-4 / 1.82e-3 / 1.00e-2, unstable at 8 bits, 81 steps at four word lengths, range -1 to 0.9921875, 0.9921875 and -0.796875, 10433.8, 2.819e-4, 2.880e-2, 40.2 dB |
| 5, Group C | 6.30e-5, 0.7461, 0.2487, 1348/693/313/139, 1.0064/1.0133/1.0276/1.0726 against 1.0067/1.0134/1.0268/1.0670, 31 twice, 5 and 31 and 319, 0.1713, 0.00731, 13.7 dB |
| 6, Group D | 1.3889e-5, 0.998/1.015/0.995/0.999, 11.72 and 0.73 Hz, 0.514/0.255/0.136/0.068, 0.258 and 0.255, 65536 and 34816, -1.5798 and 0.8787, -1.5997 and 0.8989 |
| 6, Group F | 1048576, 5120, 204.8, 21.3 / 64.0 / 682.7, the order 0 4 2 6 1 5 3 7, 10 stages, 1e-13 |

Every pin is computed in the test from the parameters. A number typed in as a
constant fails review.

**Components copied from Signal Lab.** `ScopeCanvas.jsx`, `SpectrumCanvas.jsx`,
`BlockCard.jsx`, `Controls.jsx`, `fields.jsx`, `FlowStrip.jsx` and `TopBar.jsx` are
app-local in Signal Lab and are copied here with the minimum change. Each one copied
is recorded in `NEEDS.md` as a `packages/ui` promotion candidate. Anything already
exported from `packages/ui` is imported and never copied: `NumField`, `LabNav`,
`ReportIssue`, `LessonNav`, `TryLine`, `ZPlaneCanvas`, `plot.js`, `scale.js`,
`format.js`, `units.js`, `deeplink.js`.

## 7. Verify before every hand-back

```
npx vitest run                                   # the whole monorepo, from the root
npm run lint:prose                               # every word a reader sees
npm run build --workspace apps/dsp-lab
npx vite preview --outDir apps/dsp-lab/dist --port 432N --strictPort &
cd apps/dsp-lab && APP_URL=http://localhost:432N node scripts/verify.mjs
```

The harness catches what unit tests cannot: a prop not passed, a pane fed stale
state, a plot that stopped redrawing. Extend it for every view you add. Screenshot
every view at 390 px and at 1280 by 900 and read the screenshots as a student would,
per `/REVIEW_PLAYBOOK.md` §11.

## 8. Gotchas this lab has already paid for

- **The Remez exchange stalls if a band edge is not a candidate extremum.** It cost
  one pass of debugging. `converged` is in the return shape, and a design that did
  not converge is drawn as what it is rather than as what was asked for.
- **`designFir` clamps at 201 taps.** That is the right ceiling for a knob and the
  wrong one for a specification that needs 265. Use `windowedSinc` for a design and
  `designFir` for a block a reader drags. A test pins them equal below the clamp.
- **A design is expensive and `make` is called on every render.** Memoise per
  parameter set, or a Remez exchange runs twice a frame.
- **A rate change is not shift-invariant.** Do not give it a response, a phase, a
  group delay or a z-plane. The card prints the reason instead.
- **A 60 dB stopband is off the bottom of Signal Lab's default axis.** The floor
  moves with the specification, or the one feature the lesson exists to show is not
  on screen (`REVIEW_PLAYBOOK.md` §4).
- **The periodogram's scatter is the lesson, not noise to smooth away.** Do not
  average it before drawing it in D1.
- **A number is never typed into a test as a constant when it can be computed from
  the knobs.**
- **The dark launch is enforced by a test.** While `RELEASE_STATUS` says `dark`,
  nothing outside `apps/dsp-lab/` may mention the lab.
