# Power Lab, Groups J and K: the brief

The half-bridge's three siblings, and the tank that changes what a switch
meets at each edge. Six experiments on top of the thirty-four the lab
already carries, and two additions to `packages/switched` that carry them.
`POWER_LAB_PLAN.md` §4 is the curriculum, §2 the models, §11 the quality bar
every group built after 2026-09-02 inherits.

This brief is the contract. Every number below was computed by
`apps/power-lab/scripts/pins-jk.mjs` against the engine before a word of the
notes was written, and every one of them is a test in `jk.test.js`,
`pins.test.js` or `experiments.test.js`.

---

## 1. What is built, and what is not

| Group | Experiments | Ships |
| --- | --- | --- |
| J, isolated DC-DC | J1 the forward, J2 the push-pull and the flux walk, J3 the full bridge | 3 |
| K, resonant conversion | K1 the series tank, K2 the LLC, K3 what the soft edge saves | 3 |

D5, the leakage spike, stays deferred. The forward converter's reset winding
is a second magnetising path, not a clamp on a third state. So it does not
fall out of this work for free, and `BACKLOG.md` names what reopens it.
Groups H, I, L, M and N are not this brief's.

## 2. Lanes and the files each owns

| Lane | Owns | Depends on |
| --- | --- | --- |
| 1 · the forward family | the additions to `packages/switched/src/isolated.js` and its test | nothing |
| 2 · the resonant engine | `packages/switched/src/resonant.js` and its test | lane 1, for the windowed solver |
| 3 · Group J | the J block of `src/groups/jk.js`, the three drawings, the family table | lane 1 |
| 4 · Group K | the K block of `src/groups/jk.js`, the two tank drawings | lane 2 |
| 5 · the record | `NEEDS.md`, `BACKLOG.md`, the §8 phasing note | all |

`isolated.js` gains the forward family and one new solver. `resonant.js` is
new. Nothing else in the package changes, and every existing signature
stands: `ISOLATED_KINDS` is still the flyback and the half-bridge, and
`isolated('forward')` still throws, because a test says so.

Six files outside those are touched, each by one line per table.
`experiments.js`, `math.js`, `terms.js` and `analysis.js` take the group's
tables by spread. `panes.jsx` takes a topology argument on `conductingIn`.
`schematics.jsx` takes the drawing kit out as `KIT`, so the new drawings are
written beside it rather than inside it. `NEEDS.md` lists all six.

## 3. The contracts, as code

### 3.1 The topology table's new rows

```js
// isolated.js — n = N_s/N_p throughout, and the state grows to
// [i_L, v_C, i_M]: the magnetising current is the lesson in this family,
// not a passenger.
forward({ Vin, D, n, L, C, R, fs, Lm, nr, Ron, Vf, rd, RL, ESR })
//  → states { on, reset, 'reset dry', freewheel, dead }
//    M = n·D,  reset interval n_r·D·T,  maxDuty = 1/(1 + n_r)
//    blocking() = V_in(1 + 1/n_r)

pushPull(p) / fullBridge(p)   // pushPullFamily(kind, p)
//  → states { 'Q1 on', freewheel, 'Q2 on', dead }
//    M = 2·n·D,  ripple at 2·f_s,  blocking() = 2·V_in / V_in
//    Ron1, Ron2 = the two halves' resistances, mismatch apart
//    driftFree when both are zero, and then `pinned` holds ⟨i_M⟩ at zero

// resonant.js — x = [i_r, v_Cr, v_o] for the series tank, and
// [i_r, j, v_Cr, v_o] for the LLC, with j = i_r − i_m the current the
// transformer carries. The rectifier's rule is a statement about j alone.
resonantConverter('src' | 'llc', { Vin, fs, Lr, Cr, Lm, n, C, R, Rs, Vf })
//  → states { 'Q1 D+', 'Q1 D−', 'Q1 idle', 'Q2 D+', 'Q2 D−', 'Q2 idle' }
//    fr, fr2, Z0, Rac, Q,  idealM() = fhaRatio(kind, p)
```

| Topology | State | Segments per period | Ratio | Extra events |
| --- | --- | --- | --- | --- |
| Forward | i_L, v_C, i_M | on, reset, freewheel (+ two dry) | n·D | i_M → 0, i_L → 0 |
| Push-pull, full bridge | i_L, v_C, i_M | Q1, freewheel, Q2, freewheel | 2·n·D | i_L → 0 |
| Series resonant | i_r, v_Cr, v_o | 2 to 6, per rectifier leg | n/2 at f_r | i_r → 0, the rectifier unblocking |
| LLC | i_r, j, v_Cr, v_o | 2 to 6, per rectifier leg | n/2 at f_r | j → 0, the rectifier unblocking |

### 3.2 The clock with events in it

`steady.js` solves the converter whose pattern the clock fixes, and
`events.js` the circuit whose topology its own state chooses. A forward
converter is both at once, so the period becomes a list of windows the clock
cuts, with `pick` and `guard` inside each one:

```js
// isolated.js
export function windowedSteadyState(conv, { iters = 80, tol = 1e-13 })
//  → { mode, conv, T, tOn, tOff, td, x0, segments, converged, passes }
```

Periodicity is Newton on the walk itself, with the Jacobian taken by
difference. The affine map with the durations frozen would have done for
every converter before this one, and it will not do here. An undamped tank's
frozen map is a rotation, so `I − Φ` has nothing to solve with, and the
events are the whole of the damping. Three things keep the method honest,
each with a failing test beside it.

- **an empty column is a pinned zero.** A tank current the blocked rectifier
  holds at zero for the whole period leaves the Jacobian a column of zeros,
  and its own answer is zero. `resonant.test.js` "the invariants" reaches it
  at the light-load corners.
- **a trust region and a backtracking line search.** A Newton step twenty
  times the waveform's own size is the linear model believed far outside
  where it holds.
- **rest, and then the circuit itself, as fallbacks.** A guess above what the
  circuit can reach leaves every device blocking. Two starting points are
  tried, and then twenty-five hundred periods of plain forward walking, which
  is unconditionally stable because it is the converter.

The failing test beside the method is `isolated.test.js` "the forward
family's walk from rest agrees with the solver", at 20 000 periods.

### 3.3 The flux walk

Volt-second balance on the magnetising inductance over one period. The
freewheel intervals contribute nothing, and each driven interval carries its
own switch resistance.

```js
// isolated.js
export function fluxWalk({ n, Iout, Ron1, Ron2 }) {
  const s = Ron1 + Ron2
  return s > 0 ? (n * Iout * (Ron2 - Ron1)) / s : 0
}
```

The offset is bounded by n·I_out however bad the mismatch. At R_on1 = R_on2 =
0 there is no fixed point at all, because every offset is periodic and the
circuit prefers none. The solver pins the period mean at zero and says
`driftFree`. That is not a hole in the arithmetic. The failing test beside it
is `isolated.test.js` "has no fixed point for the flux at all with no
resistance in the primary".

### 3.4 The first-harmonic approach, and its guard

```js
// resonant.js
export const acLoad = ({ R, n }) => (8 * R) / (Math.PI * Math.PI * n * n)
export function fhaGain(kind, p)          // |v_primary / v_square| at f_s
export const fhaRatio = (kind, p) => (p.n / 2) * fhaGain(kind, p)
```

This is the way the circuit is taught, and it is an approximation. So it is
labelled where it is created, and shown beside the exact answer rather than
instead of it. `m.fhaError` is the gap, measured at 3.0 % at 120 kHz, 9.3 %
at 160 kHz, and 12.6 % at 60 kHz. At 60 kHz the tank current is a train of
arcs with gaps in it, and the approximation's premise is gone. The failing
test is `resonant.test.js` "agrees with the first-harmonic gain near
resonance and parts from it below".

### 3.5 The invariants, fuzzed

| Invariant | Where | Samples |
| --- | --- | --- |
| ⟨v_L⟩ = 0, ⟨i_C⟩ = 0, segments join, one more period returns | `isolated.test.js` | 240 |
| M against n·D and 2·n·D with ideal parts in continuous conduction | `isolated.test.js` | every ideal CCM sample of the 240 |
| the reset interval is n_r·D·T | `isolated.test.js` | 3 duties, 2 reset ratios |
| ⟨i_M⟩ against the flux-walk form | `isolated.test.js` | 4 mismatches |
| the ledger's residual is zero | both | 480 |
| ⟨v_Lr⟩ = 0, ⟨i_r⟩ = 0, ⟨i_Co⟩ = 0, periodicity | `resonant.test.js` | 240 |
| M = n/2 at resonance, whatever the load | `resonant.test.js` | 3 loads × 2 kinds |
| the walk from rest lands on the solver's orbit | both | 6 + 6 |

The resonant fuzz is drawn in the space the circuit is specified in, not in
component values. Those four numbers are the tank's quality factor against
the reflected load, the inductance ratio, the frequency as a multiple of
resonance, and the filter's time constant in periods. Drawn in component
values instead, most samples sit at loads no such converter is built for.
None sit near the boundaries this circuit has.

## 4. The pins, computed before they were written

Every figure below came out of `scripts/pins-jk.mjs` run against the engine.

### Group J

| Experiment | Defaults | Pinned |
| --- | --- | --- |
| J1 | forward 48 V, D = 40 %, N_p:N_s = 4, L_m = 1 mH, L = 100 µH, C = 100 µF, R = 5 Ω, f_s = 100 kHz | M = 0.100000 = n·D, V_out 4.80000 V, the reset 4.000 µs = n_r·D·T, the duty ceiling one half, the switch blocks 96.0 V, i_M peak 192.0 mA = V_in·D/(L_m f_s), ⟨i_M⟩ 76.80 mA, ΔI_L 288.1 mA, ΔV_out 3.601 mV, i_in −192.0 mA through the reset. At D = 45 %: reset 4.500 µs and 1.000 µs left, V_out 5.400 V. At D = 25 %: M 0.0625, V_out 3.000 V |
| J2 | push-pull 48 V, D = 40 %, N_p:N_s = 8, L_m = 4 mH, R_on = 50 mΩ, mismatch 50 %, L = 100 µH, C = 100 µF, R = 5 Ω, f_s = 100 kHz | M = 0.099985 against 2·n·D = 0.100000, V_out 4.79928 V, I_out 959.9 mA, R_on1 50 mΩ against R_on2 75 mΩ, ΔI_M 47.99 mA = V_in·D/(L_m f_s), ⟨i_M⟩ 23.997 mA against the form's 23.996 mA, i_M from 0.000 to 47.99 mA, ripple at 200 kHz so ΔV_out 0.300 mV against 0.600 mV at f_s, each switch blocks 96.0 V. At 100 %: 39.99 mA, 83.3 % of the ripple. At 0 %: centred on zero. The ceiling n·I_out is 120.0 mA |
| J3 | full bridge 48 V, D = 40 %, N_p:N_s = 8, R_on = 50 mΩ, L_m = 1 mH, L = 100 µH, C = 100 µF, R = 5 Ω, f_s = 100 kHz | M = 0.099975, V_out 4.7988 V, each switch blocks 48.0 V against the push-pull's 96.0 V, switch conduction 1.413 mW against the push-pull's 0.707 mW (twice, for two in series), ΔI_L 47.99 mA against the forward's 288.0 mA at the same output. At D = 45 %: M 0.11247, V_out 5.3985 V. At D = 25 %: M 0.062490, V_out 2.9995 V |

### Group K

The tank all three K experiments carry: L_r = 30 µH, C_r = 84.4 nF, so
f_r = 100.020 kHz, Z_0 = 18.853 Ω. With N_p:N_s = 2 and R = 12 Ω the
rectifier reflects R_ac = 38.907 Ω and the tank's Q is 0.4846. The LLC adds
L_m = 150 µH, so f_r2 = 40.833 kHz.

| Experiment | Defaults | Pinned |
| --- | --- | --- |
| K1 | series tank, 48 V, f_s = 120 kHz, N_p:N_s = 2, R = 12 Ω, C = 100 µF | M = 0.23881, V_out 11.463 V, against the first-harmonic 0.24615, which is 2.98 % out. i_r peak 682.5 mA, RMS 516.6 mA, the tank capacitor swings 23.58 V. Zero-voltage switching, turning on at −416.9 mA. At 100 kHz the tank is a short and M is 0.25000 = n/2 exactly, with the formula agreeing to five figures. At 60 kHz M holds at 0.25000 while the formula says 0.22207, 12.58 % out, and the current has already returned to zero at the edge. At 160 kHz: M 0.20511, the formula 9.27 % out |
| K2 | LLC, 48 V, f_s = 80 kHz, L_m = 150 µH, N_p:N_s = 2, R = 12 Ω, C = 100 µF | M = 0.28580, V_out 13.718 V, which is 1.143 times the n/2 a series tank is held to. The first-harmonic gain is 0.27358, 4.47 % out. Zero-voltage switching. The peak of the gain curve moves with the inductance ratio: at L_m/L_r = 2 it is 0.59312 at 66.263 kHz, at 5 it is 0.42017 at 55.011 kHz, at 10 it is 0.35030 at 47.510 kHz, each above its own f_r2 of 57.747, 40.833 and 30.157 kHz. Across the load: 0.28481 at 6 Ω, 0.28580 at 12 Ω, 0.28912 at 48 Ω |
| K3 | LLC, 48 V, f_s = 130 kHz, R_s = 200 mΩ, t_sw = 20 ns, the same tank and load | V_out 10.172 V on 8.6219 W, turning on at −703.0 mA and off at 703.0 mA. The turn-on costs nothing and the turn-off 87.735 mW, against 55.239 mW in the tank, at 98.37 %. A hard-switched half-bridge on the same rail into the same load delivers 10.005 V and pays 208.10 mW at both edges, 2.372 times as much, at 96.00 %. At 100 ns: 438.67 mW against 2.0810 W, 94.58 % against 78.98 %. At 0: 99.36 % against 98.36 % |

## 5. The lesson schema, unchanged

Each experiment is the shape the built groups already use, and every field is
measured by the test named beside it.

```js
{
  id: 'j2', group: 'Isolated converters', name: '…',   // ≤ 10 words
  about: 'mismatch', chips: [0.5, 0, 1],     // ≥ 2, in range, default among
                                             // them, each spelled in the note
                                             // or the try (path.test.js)
  try: { knob: 'mismatch', text: '…' },      // ≤ 16 words, every number
                                             // measured (jk.test.js)
  note: '…',                                 // ≤ 90 words, ≤ 70 on a group's
                                             // first, ≤ 20 a sentence
  terms: [...], headline: 'eta',
  traces: [...], allTraces: [...],
  views: [...], view: '…', sweep: { x, y },
}
```

New view: **Family** (J3), the three converters solved side by side with
every column measured. New traces: `iM`, the magnetising current, and `iT`,
the current the resonant transformer carries. New sweep axes: `mismatch`
against `iMdc`, `fs` against `Mn`, and `fs` against `eta` with the
hard-switched line beside it.

## 6. The gate

1. `npx vitest run packages/switched apps/power-lab --maxWorkers=4` green,
   with Groups A to G untouched.
2. `npm run build --workspace apps/power-lab` green.
3. `node packages/prose/bin/lint.mjs` clean on every document this work
   touched.
4. `pins.test.js` walks every cell of every new experiment's measures table
   and finds it pinned or excused by name.
5. `BACKLOG.md` and `NEEDS.md` say what is built, what is deferred and what
   the director has to merge.

No Playwright: this environment has no browser, and `verify.mjs` has not been
run against the new groups. `BACKLOG.md` says so and names what reopens it.
