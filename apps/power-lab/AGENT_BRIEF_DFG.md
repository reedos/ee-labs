# Power Lab, Groups D, F and G: the brief

Magnetics, inverters, and where the watts go. Twelve experiments on top of the
twenty-two the lab already carries, and five additions to `packages/switched`
that carry them. `POWER_LAB_PLAN.md` §4 is the curriculum, §2 the models, §11
the quality bar every group built after 2026-09-02 inherits.

This brief is the contract. Every number below was computed by
`apps/power-lab/scripts/pins-dfg.mjs` against the engine before a word of the
notes was written, and every one of them is a test in `experiments.test.js`,
`pins.test.js` or `path.test.js`.

---

## 1. What is built, and what is not

| Group | Experiments | Ships |
| --- | --- | --- |
| D, magnetics | D1 volt-seconds are flux, D2 saturation, D3 the flyback, D4 the half-bridge | 4 |
| F, inverters | F1 the square wave, F2 sine PWM, F3 the families, F4 distortion against the carrier | 4 |
| G, losses | G1 conduction against switching, G2 the efficiency curve, G3 the capacitor's heat, G4 the ledger | 4 |

D5, the leakage spike, is the plan's own stretch and is deferred. It needs a
third state and a clamp, which is a new state variable rather than a new
lesson, and `BACKLOG.md` names what reopens it. Groups H to N are not this
brief's.

## 2. Lanes and the files each owns

| Lane | Owns | Depends on |
| --- | --- | --- |
| 1 · magnetics engine | `packages/switched/src/magnetics.js`, `src/saturating.js` and their tests | nothing |
| 2 · isolated engine | `packages/switched/src/isolated.js` and its test | nothing |
| 3 · inverter engine | `packages/switched/src/clocked.js`, `src/inverter.js` and their tests | nothing |
| 4 · ledger | `packages/switched/src/ledger.js`, the three additions to `src/formulas.js`, and their test | lanes 1–3, for the fuzz across every engine |
| 5 · Group D | `experiments.js` (D block), the flux and scrub views, the flyback and half-bridge drawings | lanes 1, 2 |
| 6 · Group F | `experiments.js` (F block), the bridge drawing, the spectrum pane's units | lane 3 |
| 7 · Group G | `experiments.js` (G block), the ledger view, the two new sweeps | lane 4 |
| 8 · the record | `POWER_LAB_PLAN.md` §8, `BACKLOG.md`, `NEEDS.md` | all |

`steady.js` gains one function, `stateAtPeriod`, and `measures` reads the
switch's turn-off current through it rather than extrapolating the first
segment past its own end. Nothing else in the package changes, and every
existing signature stands.

## 3. The contracts, as code

### 3.1 The topology table's new rows

```js
// magnetics.js — a converter whose inductor is wound on a core. Two extra
// switch states, the same circuit with the collapsed inductance in it.
saturatingConverter('buck', { Vin, D, L, C, R, fs, N, Ae, Bsat, hard })
//  → { ...converter('buck', p), Isat, Lsat, core,
//      states: { on, off, dead, 'on·sat', 'off·sat' } }

// isolated.js — n = N_s/N_p throughout, secondary over primary.
flyback({ Vin, D, n, L, C, R, fs, Ron, Vf, rd, RL, ESR })
//  → states { on, off, dead }, hasDead, blocking(Vo) = Vin + (Vo + Vf)/n
//    M = n·D/(1−D)                                      state [i_M, v_C]
halfBridge({ Vin, D, n, L, C, R, fs, ... })
//  → states { on: 'Q1 on', off: 'freewheel', dead }, headroom, deliverable
//    M = n·D, solved over T/2 at a duty of 2·D          state [i_L, v_C]

// inverter.js — the bridge is [i_L, v_C] and the modulator picks the sign.
inverter('square' | 'spwm', { Vdc, f1, L, C, R, ma, fsw, Ron, RL, ESR })
//  → { plan: [{ state, T }], edges, mf, fsw, commanded, states: { pos, neg } }
```

| Topology | State | Segments per period | Ratio | Extra events |
| --- | --- | --- | --- | --- |
| Saturating buck/boost/buck-boost | i_L, v_C | on, on·sat, off·sat, off, dead | the kind's own | \|i_L\| crossing I_sat, i_L → 0 |
| Flyback | i_M, v_C | on, off, dead | n·D/(1−D) | i_M → 0 |
| Half-bridge | i_L, v_C | Q1 on, freewheel (half a period) | n·D | i_L → 0 |
| Square-wave inverter | i_L, v_C | +V_dc, −V_dc | — | none, the clock is the whole story |
| Sine-PWM inverter | i_L, v_C | 2·m_f + 1 | fundamental m_a·V_dc | none |

### 3.2 The saturation event's guard

The knee belongs to both sides of |i| = I_sat, so a memoryless rule hands the
instant after a crossing back to the topology it just left and the walk
chatters. Each state names what makes it stop, with a strict inequality:

```js
// saturating.js
function exitTo(conv, phase, name, x) {
  if (name === 'dead') return null
  if (phase === 'off' && conv.hasDead && x[0] < 0) return 'dead'
  const hot = Math.abs(x[0]) > conv.Isat
  const cool = Math.abs(x[0]) < conv.Isat
  const sat = name.endsWith('·sat')
  if (!sat && hot) return phase === 'on' ? 'on·sat' : 'off·sat'
  if (sat && cool) return phase === 'on' ? 'on' : 'off'
  return null
}
function margin(conv, phase, name, x) {           // positive while it holds
  if (name === 'dead') return Infinity
  const knee = name.endsWith('·sat') ? Math.abs(x[0]) - conv.Isat : conv.Isat - Math.abs(x[0])
  if (phase === 'on' || !conv.hasDead) return knee
  return Math.min(knee, x[0])
}
```

The crossing is the root of `margin`, bisected on the exact segment solution
to 1e-13 of the period. `I_sat = B_sat·N·A_e/L`, and the failing test beside
it is `magnetics.test.js` "happens where B reaches B_sat".

### 3.3 The PWM comparator

```js
// inverter.js — the edges of a bipolar sine-PWM bridge, over one fundamental
// period. Within a ramp the carrier is a straight line, so a crossing is a
// root; outside ±1 there is no root, and that is overmodulation.
export function pwmEdges({ ma, mf, f1 = 1, tol = 1e-14 }) {
  const T = 1 / f1, Tc = T / mf
  const ref = (t) => ma * Math.sin((2 * Math.PI * t) / T)
  const edges = []
  for (let q = 0; q < mf; q++) {
    const t0 = q * Tc, mid = t0 + Tc / 2
    const rise = (t) => ref(t) - (-1 + (4 * (t - t0)) / Tc)
    if (rise(t0) >= 0 && rise(mid) <= 0) edges.push(bisect(rise, t0, mid, tol * T))
    const fall = (t) => -(ref(t) - (1 - (4 * (t - mid)) / Tc))
    if (fall(mid) >= 0 && fall(t0 + Tc) <= 0) edges.push(bisect(fall, mid, t0 + Tc, tol * T))
  }
  return edges
}
export const carrierRatio = (fsw, f1) => // the nearest odd multiple, at least 3
  Math.max(3, 2 * Math.round((Math.max(3, fsw / f1) - 1) / 2) + 1)
```

The carrier is locked to the reference, so the pattern repeats every
fundamental period and the waveform is half-wave symmetric. The knob is a
switching frequency and the model snaps it, which the panel states.

### 3.4 The loss ledger

```js
// ledger.js
export function lossLedger(m) // m from measures(), rectifierMeasures() or
                              // inverterMeasures()
//  → { rows: [{ key, label, formula, watts, share, model }],
//      conduction, switching, Pin, Pout, Psource, residual, eta, outShare }
```

`residual` is `P_in − P_out − Σ conduction`, and it is zero. Every term in it
is an integral of one waveform rather than an estimate of one. Switching loss
is the one row marked `model`, because the engine's states switch
instantaneously. Its ½·V·I·(t_r+t_f)·f_s is charged on top, and efficiency is
taken against `Psource`. The failing test beside it is `ledger.test.js` "the
residual is zero across every engine in the package", at 200 seeded
converters.

### 3.5 The invariants, fuzzed

| Invariant | Where | Samples |
| --- | --- | --- |
| ⟨v_L⟩ = 0 and ⟨i_C⟩ = 0 through saturation | `magnetics.test.js` | 120 |
| the knee crossing is at I_sat = B_sat·N·A_e/L | `magnetics.test.js` | every crossing of all 120 |
| the saturating walk equals `steadyState` with the knee out of reach | `magnetics.test.js` | 180 |
| the walk from rest lands on the solver's orbit | `magnetics.test.js`, `isolated.test.js` | 4 + 4 |
| ⟨v_L⟩ = 0, ⟨i_C⟩ = 0, segments join, one more period returns | `isolated.test.js` | 240 |
| the fundamental against (4/π)V_dc and m_a·V_dc | `inverter.test.js` | 12 + 3 rails |
| THD against √(π²/8 − 1) | `inverter.test.js` | 3 rails |
| the exact Fourier integral against a dense discrete transform | `inverter.test.js` | 4 orders |
| the filter's attenuation at the carrier against \|H\| | `inverter.test.js` | 3 carriers |
| the ledger's residual is zero | `ledger.test.js` | 200 |

## 4. The pins, computed before they were written

Every figure below came out of `scripts/pins-dfg.mjs` run against the engine.

### Group D

| Experiment | Defaults | Pinned |
| --- | --- | --- |
| D1 | buck 12 V, D = 5/12, L = 100 µH, C = 100 µF, R = 2 Ω, f_s = 100 kHz, N = 40, A_e = 40 mm², B_sat = 0.3 T | 29.17 V·µs on the on interval, ΔB = 18.23 mT, B_pk = 165.4 mT, I_sat = 4.80 A. At 10 kHz: 297.7 V·µs, ΔB = 186.1 mT, B_pk = 249.3 mT, ripple 2.977 A |
| D2 | as D1 with R = 1 Ω | SAT, I_sat = 4.80 A, the crossing at 2.898 µs and 4.800 A, B_pk = 305.6 mT, L collapses 100 → 5 µH, ripple 0.292 → 1.981 A, saturated for 30.4 % of the period. At R = 2 Ω, continuous and 165.4 mT |
| D3 | flyback 24 V, D = 0.5, N_p:N_s = 2, L_M = 100 µH, C = 100 µF, R = 12 Ω, f_s = 100 kHz | M = 0.4998 against n·D/(1−D) = 0.5, 11.995 V, ⟨i_M⟩ = 0.999 A, ΔI = 1.200 A, ⟨i_D⟩ = 1.000 A, i_D peak 3.198 A, ripple 50.4 mV, the switch blocks 47.99 V. At D = 75 %: M = 1.50, 36.0 V |
| D4 | half-bridge 48 V, D = 5/12, N_p:N_s = 4, L = 100 µH, C = 100 µF, R = 5 Ω, f_s = 100 kHz | M = 0.10417 = n·D exactly, 5.000 V, v_x = 6.00 V, ΔI_L = 41.67 mA, ripple 260.4 µV at 200 kHz (a filter fed at f_s would carry 520.8 µV), each switch blocks 48 V against the flyback's 2·V_in. At D = 25 %: M = 0.0625, 3.00 V |

### Group F

| Experiment | Defaults | Pinned |
| --- | --- | --- |
| F1 | square wave, V_dc = 48 V, f₁ = 60 Hz, L = 1 mH, C = 10 µF, R = 10 Ω | bridge fundamental 43.215 V rms = (4/π)V_dc/√2, THD 48.34 % = √(π²/8 − 1), V_rms 48.000 V. After the filter 43.246 V and 48.16 %, because \|H\| at 180 Hz is 1.006. At 24 V: 21.608 V and the same 48.34 % |
| F2 | sine PWM, m_a = 80 %, f_sw = 3.78 kHz (m_f = 63) | fundamental peak 38.400 V = m_a·V_dc, load THD 21.19 %. At 40 %: 19.200 V. At 120 %: 53.014 V against the 57.6 V the line promises |
| F3 | as F2 | the cluster at k = 63 carries 102 % of the fundamental, the largest baseband harmonic below it is 0.013 %, attenuation 0.1918 against \|H\| = 0.1918. At 1.98 kHz: 0.7357 both ways |
| F4 | as F2, sweeping the carrier | THD 135.5 % at 0.9 kHz, 81.3 % at 1.98 kHz, 21.19 % at 3.78 kHz, 4.77 % at 7.74 kHz |

### Group G

| Experiment | Defaults | Pinned |
| --- | --- | --- |
| G1 | sync buck 12 V, D = 5/12, L = 100 µH, C = 100 µF, R = 5 Ω, R_on = 0.12 Ω, t_sw = 20 ns, f_s = 488 kHz | crossover f* = R_on·I/(V·t_sw) = 488.3 kHz, where conduction is 114.5 mW and the edges 114.4 mW, η 95.42 %. At 100 kHz: 115.3 and 23.4 mW, η 97.17 %. At 2 MHz: 114.4 and 468.8 mW, η 89.10 % |
| G2 | sync buck 12 V, D = 5/12, L = 22 µH, C = 100 µF, R_on = 0.1 Ω, R_L = 0.05 Ω, R = 13.1 Ω | the peak sits at √12·L·f_s/(1 − D) = 13.06 Ω, which is √3 × R_crit = 7.543 Ω, η 97.73 %, ripple loss 22.0 mW against load loss 21.5 mW. At 1 Ω: 86.87 %. At 1 kΩ: 53.16 % |
| G3 | boost 12 V, D = 0.5, L = 100 µH, C = 220 µF, R = 24 Ω, ESR = 0.05 Ω | I_C,rms = 1.003 A against I_o√(D/D′) = 1.005 A, where a buck with the same 0.600 A of inductor ripple gives 0.173 A. 5.79× the current, 33.6× the heat: 50.3 mW against 1.50 mW. At ESR = 0.2 Ω: 196.4 mW and 453 mV of ripple. At 0: 22.7 mV |
| G4 | buck 12 V, D = 5/12, R = 5 Ω, R_on = 0.05 Ω, V_f = 0.5 V, R_L = 0.03 Ω, ESR = 0.05 Ω, t_sw = 20 ns | the five rows are 18.3, 272, 26.3, 0.374 and 23.3 mW on 4.345 W delivered from 4.685 W drawn, η 92.74 %, residual 0 W. At R_on = 0.2 Ω: 71.3 mW and 91.60 %. At 0: 93.13 % |

## 5. The lesson schema, unchanged

Each experiment is the shape the built groups already use, and every field is
measured by the test named beside it.

```js
{
  id: 'd2', group: 'Magnetics', name: '…',   // ≤ 10 words, prose.test.js
  about: 'R', chips: [1, 2],                 // ≥ 2, in range, default among
                                             // them, each spelled in the note
                                             // or the try (path.test.js)
  try: { knob: 'R', text: '…' },             // ≤ 16 words, every number
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

New views: **Flux** (D1, D2), **Scrub** (D2, D3, D4), **Ledger** (G1, G4).
New sweep axes: `ma` against the fundamental, `fsw` against THD.

## 6. The gate

1. `npx vitest run packages/switched apps/power-lab apps/energy-lab` green.
2. `npm run build --workspace apps/power-lab` green.
3. `npm run lint:prose` clean on every document this work touched.
4. `pins.test.js` walks every cell of every new experiment's measures table
   and finds it pinned or excused by name.
5. `POWER_LAB_PLAN.md` §8 says what is built and what is next.

No Playwright: this environment has no browser, and `verify.mjs` has not been
run against the new groups. `BACKLOG.md` says so and names what reopens it.
