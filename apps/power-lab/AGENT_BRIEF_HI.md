# Power Lab, Groups H and I: the brief

Closing the loop, and three phases out. Six experiments on top of the
thirty-four the lab already carries, and two additions to `packages/switched`
that carry them. `POWER_LAB_PLAN.md` §4 is the curriculum, §1.5 the averaged
model, §2 the models, §11 the quality bar every group built after 2026-09-02
inherits.

This brief is the contract. Every number below was computed by
`apps/power-lab/scripts/pins-hi.mjs` against the engine before a word of the
notes was written, and every one of them is a test in `src/hi.test.js`,
`pins.test.js` or `path.test.js`.

---

## 1. What is built, and what is not

| Group | Experiments | Ships |
| --- | --- | --- |
| H, closing the loop | H1 the averaged model, H2 the buck as a plant, H3 the zero in the wrong half | 3 |
| I, three-phase out | I1 six-step, I2 sine PWM in three phases, I3 balanced load, constant power | 3 |

Two things in the plan's §4 text are deferred, each with its reason in
`BACKLOG.md`. H2's round trip through Control Lab stops at the hand-over
link. This lab builds the exact plant and the link that carries it. Closing
the loop happens in Control Lab, whose own step response is not readable from
here. I1's phase voltage is measured on the load rather than on a motor. The
torque story that six-step commutation belongs to waits for Group L.

## 2. Lanes and the files each owns

| Lane | Owns | Depends on |
| --- | --- | --- |
| 1 · loop engine | `packages/switched/src/loop.js` and its test | nothing |
| 2 · three-phase engine | `packages/switched/src/threePhase.js` and its test | `clocked.js`, `inverter.js`, read-only |
| 3 · Group H | the H block of `src/groups/hi.js`, the step and plant views | lane 1 |
| 4 · Group I | the I block of `src/groups/hi.js`, the bridge drawing, the power view | lane 2 |
| 5 · the record | `NEEDS.md`, `BACKLOG.md`, the plan's §8 note | all |

Nothing else in `packages/switched` changes. Every existing signature stands,
and the two new modules are reached by one export line each in
`packages/switched/index.js`. In the app, each shared table takes one appended
line per lane, so the director merges three lanes by union.

## 3. The contracts, as code

### 3.1 The averaged model

```js
// loop.js — state-space averaging, and the transfer function it gives.
averagedModel(conv, D)   // → { A, f, c, d, X, Vo }      A = D·A_on + D′·A_off
gvd(conv, D)             // → { b: [b2, b1, b0], a: [1, a1, a0],
                         //     dc, w0, Q, wz, rhp, slope0, step0 }
gvdClosedForm(kind, p)   // → { dc, w0, Q, wz } the textbook forms of §1.5
rhpZero(kind, p)         // → D′²R/L for the boost, D′²R/(D·L) for the buck-boost
averagingGuard(tf, fs)   // → { limit: fs/5, highest, ratio, state, reason }
switchedStep(c0, c1, o)  // → the exact walk: { t, sig, cycles, blocked }
averagedStep(c0, c1, o)  // → the smooth curve: { t, sig, from, to }
stepAgreement(c0, c1, o) // → { pairs, worst, span, ripple, dip, peak }
dcGainMeasured(conv, mk) // → dV_o/dD from two full steady states
```

`gvd` is exact algebra on the averaged matrices, so it carries any
non-ideality already in them. Its numerator is `c·adj(sI − A)·B_d` plus
`E_d·den`, with

    B_d = (A_on − A_off)·X + (f_on − f_off),
    E_d = (c_on − c_off)·X + (d_on − d_off).

The failing test beside it is `loop.test.js` "the averaged model reproduces
the plan's closed forms".

The model is an approximation, and `CORE_SCOPE.md` Rule 3 says an
approximation ships with its guard. `averagingGuard` is that guard, with two
bands: `warn` once a feature of the model passes half of f_s/5, `refuse` once
it passes f_s/5. Its failing test is `loop.test.js` "the guard warns before
the model stops being the converter".

### 3.2 The three-phase bridge

```js
// threePhase.js — three legs, one carrier, a balanced wye of R and L.
threePhase('sixstep' | 'spwm3', { Vdc, f1, L, R, ma, fsw, inject })
//  → { plan, states, mf, fsw, referencePeak, ceiling, commanded }
threePhaseSteadyState(conv)      // clocked.js: one linear solve, no shooting
threePhaseMeasures(ss)           // → { Vll1, V1, I1, thd, p2, p6, pa2, Pa, … }
threePhaseWaveform(ss, opts)
triplenRatio(fsw, f1)            // the nearest odd multiple of three, at least 3
referencePeak(inject)            // the height of sin θ + h·sin 3θ
legEdges({ ref, mf, f1 })        // one leg's crossings, with the sign after each
```

| Topology | State | Segments per cycle | Fundamental | Extra events |
| --- | --- | --- | --- | --- |
| Six-step | i_a, i_b | 6 | line rms (√6/π)·V_dc | none, the clock is the whole story |
| Three-phase sine PWM | i_a, i_b | 3·2·m_f + 1 | line peak (√3/2)·m_a·V_dc | none |

The load is a balanced wye of R and L with a floating neutral, so
v_no = (v_ao + v_bo + v_co)/3 and the load sees v_an = v_ao − v_no. Anything
the three legs share lands in v_no and never reaches the load. That one line
carries the absent triplens of I1 and the free headroom of I2.

The state is [i_a, i_b] with i_c = −i_a − i_b. A is then diagonal and every
segment is exact. `pa` and `pdc` are linear forms of the state as well, which
is what lets I3 take a Fourier coefficient of a power rather than of a
current.

### 3.3 The carrier the three legs share

```js
// threePhase.js — m_f is an odd multiple of three, and both halves matter.
export function triplenRatio(fsw, f1) {
  const raw = Math.max(3, fsw / f1) / 3
  const odd = 2 * Math.round((raw - 1) / 2) + 1
  return 3 * Math.max(1, odd)
}
```

Odd keeps every leg half-wave symmetric, so there are no even harmonics. A
multiple of three makes one carrier serve all three references, so a 120°
shift of the reference is a whole number of carrier periods and the three
legs carry the same pattern shifted. The failing test beside it is
`threePhase.test.js` "the three legs are one leg, shifted".

### 3.4 The invariants, fuzzed

| Invariant | Where | Samples |
| --- | --- | --- |
| the averaged DC gain equals dV_o/dD on the exact solver | `loop.test.js` | 240 |
| ω₀, Q and ω_z against the plan's closed forms | `loop.test.js` | 240 |
| the averaged trajectory tracks the exact cycle averages | `loop.test.js` | 120 |
| the walk from the old orbit lands on the new one | `loop.test.js` | 60 |
| the guard's state follows f_s | `loop.test.js` | 40 |
| the three phase currents sum to zero, and each carries one RMS | `threePhase.test.js` | 160 |
| V_dc·⟨i_dc⟩ = the load's own dissipation | `threePhase.test.js` | 160 |
| no even harmonic, and no triplen line-to-line | `threePhase.test.js` | 160 |
| the exact Fourier integral against a dense discrete transform | `threePhase.test.js` | 5 signals |
| the fundamental against (√6/π)·V_dc and (√3/2)·m_a·V_dc | `threePhase.test.js` | 8 + 12 |
| one more period returns the same state | `threePhase.test.js` | 160 |

## 4. The pins, computed before they were written

Every figure below came out of `scripts/pins-hi.mjs` run against the engine.

### Group H

| Experiment | Defaults | Pinned |
| --- | --- | --- |
| H1 | synchronous buck 12 V, D = 5/12, L = 100 µH, C = 100 µF, R = 5 Ω, f_s = 100 kHz, R_on = 50 mΩ, R_L = 50 mΩ, stepping to 2.5 Ω | V_o 4.902 V with 3.647 mV of ripple, sagging 94.3 mV to 4.808 V. The averaged curve stays within 325 µV of the exact cycle average, 0.345 % of the step and eleven times under the ripple it discards. i_L 0.980 → 1.923 A. To 10 Ω the output rises 48.5 mV |
| H2 | synchronous buck 12 V, D = 5/12, L = 100 µH, C = 100 µF, R = 5 Ω, f_s = 100 kHz | b = [0, 0, 1.2e9], a = [1, 2000, 1e8]. G(0) = 12.000 V by three routes: the model, V_in, and dV_o/dD on the switched engine. f₀ = 1591.55 Hz, Q = 5.000, no zeros. The ceiling f_s/5 = 20.00 kHz, 12.6 times the corner. At f_s = 10 kHz the ceiling is 2.000 kHz, 79.6 % of the way down to the corner, and the guard warns |
| H3 | synchronous boost 12 V, D = 0.5, L = 1 mH, C = 100 µF, R = 10 Ω, f_s = 100 kHz, step +5 % | V_o 24.00 V, f_z = 397.887 Hz = D′²R/(2πL), f₀ = 251.6 Hz, Q = 1.581, G(0) = 48.00 V. A 5 % duty step ends at 26.667 V and dips to 23.609 V first, 391 mV below where it started, on an initial slope of −2400 V/s. At D = 60 %: f_z = 254.6 Hz, 30.00 → 34.286 V, dipping 857 mV |

### Group I

| Experiment | Defaults | Pinned |
| --- | --- | --- |
| I1 | six-step, V_dc = 48 V, f₁ = 60 Hz, wye load L = 20 mH, R = 10 Ω | line-to-line fundamental 37.425 V rms = (√6/π)·V_dc, phase fundamental 21.608 V = (√2/π)·V_dc. v_ab rms 39.192 V = √(2/3)·V_dc, v_an rms 22.627 V = (√2/3)·V_dc, v_an peak 32.000 V = 2V_dc/3. No 3rd and no 9th, the 5th at 20.00 %, the 7th at 14.29 %, the 11th at 9.091 %, THD 31.08 %. Current THD 7.484 %, P = 89.80 W. At V_dc = 24 V every voltage halves and every share holds |
| I2 | three-phase sine PWM, m_a = 80 %, f_sw = 1.26 kHz (m_f = 21), wye load as I1 | line-to-line fundamental peak 33.255 V = (√3/2)·m_a·V_dc, phase peak 19.200 V = m_a·V_dc/2. The offset puts 3.200 V of third harmonic on each leg and 4.6e-14 V on the line. At m_a = 115 % the plain sine gives 45.191 V against the 47.805 V the line promises, and the offset gives 47.805 V. The ceiling is 2/√3 = 115.5 %, a rise of 15.47 % |
| I3 | three-phase sine PWM as I2 | the load takes 35.31 W. Phase a's own power averages 11.77 W and swings 14.72 W at twice the output frequency, 125.1 % of its mean, which is 1/cos φ at φ = 37.02°. The three add to a bus that swings 9.2e-14 W there, and 10.2 mW at six times the output frequency. At m_a = 40 % the power falls to 8.838 W and the swing stays 125.0 % of one phase and zero on the bus |

## 5. The lesson schema, unchanged

Each experiment is the shape the built groups already use, and every field is
measured by the test named beside it.

```js
{
  id: 'h3', group: 'Closing the loop', name: '…',  // ≤ 10 words, prose.test.js
  about: 'D', chips: [0.5, 0.6],             // ≥ 2, in range, default among
                                             // them, each spelled in the note
                                             // or the try (path.test.js)
  try: { knob: 'D', text: '…' },             // ≤ 16 words, every number
                                             // measured (path.test.js)
  note: '…',                                 // ≤ 90 words, ≤ 70 on a group's
                                             // first, ≤ 20 a sentence
                                             // (notes.test.js, prose.test.js)
  terms: [...],                              // every term of art it uses
  headline: 'eta' | 'pf' | 'rms' | 'thd',    // the top bar's third meter
  traces: [...], allTraces: [...],           // every signal the note names is
                                             // in the opening set
  views: [...], view: '…', sweep: { x, y },  // the pane the lesson is in
}
```

New views: **Step** (H1, H3), **Plant** (H2, H3), **Power** (I3). New traces:
`v_ao`, `v_ab`, `v_an`, `i_a`, `i_dc`. New sweep axis: `inject` against the
line-to-line fundamental.

## 6. The gate

1. `npx vitest run packages/switched apps/power-lab --maxWorkers=4` green,
   with Groups A to G untouched.
2. `npm run build --workspace apps/power-lab` green.
3. `node packages/prose/bin/lint.mjs` clean on every document this work
   touched.
4. `pins.test.js` walks every cell of every new experiment's measures table
   and finds it pinned or excused by name.
5. `BACKLOG.md` says what is built, what is deferred, and why.

No Playwright: this environment has no browser, and `verify.mjs` has not been
run against the new groups. `BACKLOG.md` says so and names what reopens it.
