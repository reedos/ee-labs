# Power Lab, Groups L, M and N: the brief

Motor drives, interference, and heat. Nine experiments on top of the
thirty-four the lab already carries, and three additions to
`packages/switched` that carry them. `POWER_LAB_PLAN.md` §4 is the curriculum,
§2 the models, §11 the quality bar every group built after 2026-09-02
inherits.

This brief is the contract. Every number below came out of
`apps/power-lab/scripts/pins-lmn.mjs` run against the engine before a word of
the notes was written, and every one of them is a test in `src/lmn.test.js`,
`src/pins.test.js` or `src/path.test.js`.

---

## 1. What is built, and what is not

| Group | Experiments | Ships |
| --- | --- | --- |
| L, motor drives | L1 the armature, L2 four quadrants, L3 six-step commutation | 3 |
| M, interference | M1 what the input sees, M2 the input filter, M3 the switch node rings | 3 |
| N, thermal | N1 loss becomes temperature, N2 the thermal RC, N3 faster is hotter | 3 |

Three things the plan's §4 lists inside these groups are deferred. They are
L3's commutation notch, M1's conducted-emission mask, and the Cauer ladder
drawn as a picture a reader can cut open in N2. `BACKLOG.md` names what
reopens each. Groups H, I, J and K are not this brief's.

## 2. Lanes and the files each owns

| Lane | Owns | Depends on |
| --- | --- | --- |
| 1 · drive engine | `packages/switched/src/drive.js` and its test | `@ee-labs/machines` |
| 2 · interference engine | `packages/switched/src/emi.js` and its test | `@ee-labs/dsp` |
| 3 · thermal engine | `packages/switched/src/thermal.js` and its test | nothing |
| 4 · the groups | `apps/power-lab/src/groups/lmn.js`, the three panes in `components/lmnPanes.jsx`, the six drawings in `components/lmnSchematics.jsx` | lanes 1 to 3 |
| 5 · the pins | `src/lmn.test.js`, `src/lmn.pins.js`, one appended row in each walking test | lane 4 |
| 6 · the record | `AGENT_BRIEF_LMN.md`, `NEEDS.md`, `BACKLOG.md` | all |

The lab's shared files gain one line each, appended at the end of a table
keyed by name, so three lanes merge by union. Those files are
`experiments.js`, `analysis.js`, `math.js`, `terms.js`, `panes.jsx`,
`schematics.jsx`, `ScopeCanvas.jsx` and `App.jsx`. Nothing else in the app
changes, and every existing signature stands.

## 3. The contracts, as code

### 3.1 The three new engines

```js
// drive.js — the state is the armature current and the shaft speed, both
// linear inside a switch state. The machine comes from @ee-labs/machines.
drive('dcdrive' | 'hbridge' | 'bldc', { Vdc, D, fs, Ra, La, k, J, B, TL, Ron, Vf, rd, bipolar, lambda, pairs, Rs, Ls })
//  → { kind, p, T, mach, plan, states, hasDead, commanded, pulses, blocking }
driveSteadyState(conv)   // a linear solve in continuous conduction, one
                         // bisection when the chopper's diode blocks
driveMeasures(ss)        // the electrical books, the shaft, and both ripples
driveAveraged(conv)      // @ee-labs/machines' `operating`, at the commanded volts
driveRunUp(conv, x0, { periods, settle })   // the slow state, period by period
armatureRipple(kind, { Vdc, D, La, fs, bipolar })
commutation(conv, omega) // sectors, the electrical frequency, the rate

// emi.js — the input side is four states, the switch node five.
emiConverter({ Vin, D, fs, L, C, R, Ron, RL, Lf, Cin, Rf, Rd })
//  → states [i_Lf, v_Cin, i_L, v_C], signals iin (the pulse train),
//    iline (what the source supplies), icin (what the capacitor takes)
ringConverter({ Vin, D, fs, L, C, R, RL, Lp, Cp, Rp, snubber, Csn, Rsn })
//  → states [i_Lp, v_sw, i_L, v_C] and a fifth when the snubber is on
emiSteadyState(conv)     // a fixed pattern, so one linear solve at any order
emiMeasures(ss) / ringMeasures(ss)
pulseHarmonic(k, D)      // 2·|sin(kπD)|/(kπ), and D at k = 0
inputFilter({ Lf, Cin, Rf, Rd })   // f0, Q, attenuationAt(f), zoutAt(f)
middlebrook(filter, { Vin, Pin })  // the ratio, the margin, and whether it holds
fftHarmonics(ss, name, kMax)       // the same spectrum through @ee-labs/dsp

// thermal.js — an RC network with degrees on it.
thermalNetwork('foster' | 'cauer', stagesOf({ R1, tau1, R2, tau2, R3, tau3 }))
//  → { A, b, read, C, Rtotal, Ctotal, taus }
stepRise(net, P, times) / zth(net, times) / fosterZth(stages, t)
pulsedRise(net, { P, duty, period })  // the periodic steady state, not a run
derating(net, { Ta, Tjmax, P })       // Pmax, Tj, headroom, margin
frequencyCeiling({ Rtotal, Ta, Tjmax, Pcond, kSw })
edgeCost({ Vblk, iOn, iOff, tr, tf })
```

| Topology | State | Segments per period | Ratio | Extra events |
| --- | --- | --- | --- | --- |
| Chopper drive | i_a, ω | on, off, dead | ⟨v⟩ = D·V_dc | i_a → 0 |
| H-bridge, bipolar | i_a, ω | +V_dc, −V_dc | ⟨v⟩ = (2D − 1)·V_dc | none |
| H-bridge, unipolar | i_a, ω | zero, pulse, zero, pulse, zero | the same | none |
| Six-step brushless | i, ω | on, off, dead | ⟨v⟩ = D·V_dc | i → 0 |
| Buck with its input filter | i_Lf, v_Cin, i_L, v_C | on, off | D, less the drops | none |
| Switch node with parasitics | i_Lp, v_sw, i_L, v_C (+ v_Csn) | on, off | D exactly | none |
| Thermal network under a pulse | one per stage | hot, cold | ⟨ΔT⟩ = ⟨P⟩·ΣR | none |

### 3.2 The mechanical state, and what it costs

The armature and the shaft are one two-state system, and both rows are
constant inside a switch state:

```js
// drive.js
A = [[-(Ra + r) / La, -ke / La],
     [ km / J,        -(B + loadB) / J]]
f = [(v - vd) / La, -TL / J]
```

So the shaft's own ripple is solved rather than assumed. The quasi-static
picture a drives course uses becomes a measurement. At L1's defaults the speed
ripples 375 µrad/s on 382.06 rad/s, one part in a million, while the current
ripples 22.3 %. The failing test beside it is `drive.test.js` "agree exactly
with ideal devices, wherever conduction is continuous". It holds the averaged
machine from `@ee-labs/machines` against the exact waveform at 1e-8.

The chopper's diode can still block. The period then starts with an empty
armature, so the only unknown left in the state is the speed. The shaft's own
periodicity gives it directly. The instant the diode blocks is bisected on the
exact solution to 1e-13 of the period.

### 3.3 The input divider is an identity

```js
// emi.js — the rail carries no alternating voltage, so at the input node
// i_conv = i_line + i_Cin with i_line = −v/Z_branch and i_Cin = −jωC_in·v.
//     i_line / i_conv = 1 / (1 + jωC_in Z_branch(jω))
```

This is Kirchhoff rather than a small-signal approximation, so it is stated
with no hedge. It is held at 1e-8 over 120 seeded settings and at every
harmonic, in `emi.test.js` "attenuates by exactly its own |H|, at every
setting". Middlebrook's criterion is a separate thing. It is about a regulated
converter's negative input resistance, and this lab runs its converters open
loop. The criterion is therefore computed from the operating point and
reported as the design rule it is.

### 3.4 The snubber is a switch, not a large resistance

The quadrature cuts every segment into pieces short against the fastest mode
in it. A snubber whose R·C is picoseconds inside a microsecond period is a
million pieces to integrate. That is how the first build ran out of memory. So
`ringConverter` drops the fifth state when the snubber is off, and the knobs
are bounded. C_p and C_sn start at 470 pF, R_sn at 5 Ω, f_s at 500 kHz.
`emi.test.js` states the bound and the reason.

### 3.5 The invariants, fuzzed

| Invariant | Where | Samples |
| --- | --- | --- |
| ⟨v_L⟩ = 0, ⟨T_e⟩ = the load torque, P_in = P_shaft + Σ losses, one more period returns | `drive.test.js` | 240 a kind, 720 in all |
| the walk from rest lands on the solver's orbit | `drive.test.js` | 5 named cases |
| the averaged machine and the exact waveform are one answer | `drive.test.js` | 200 a kind, 150 in range |
| ⟨v_L⟩ = 0, ⟨i_Cin⟩ = 0, ⟨i_line⟩ = ⟨i_conv⟩, the power books, the state returns | `emi.test.js` | 200 |
| the exact Fourier integral and `@ee-labs/dsp`'s FFT read one spectrum | `emi.test.js` | 3 settings, 6 harmonics, plus a windowed third route |
| the filter's attenuation is its own \|H\| | `emi.test.js` | 120, and 5 harmonics of one |
| ⟨v_sw⟩ = D·V_in and the power books, through the ring | `emi.test.js` | 60 |
| the Foster network's step response is Σ R(1 − e^{−t/τ}) | `thermal.test.js` | 200 networks × 6 times |
| both networks settle at P·ΣR | `thermal.test.js` | 200 a model |
| a pulsed load averages to ⟨P⟩·ΣR exactly | `thermal.test.js` | 120 a model |
| every measures cell of the nine is pinned or excused by name | `pins.test.js` | 9 experiments |

## 4. The pins, computed before they were written

Every figure below came out of `scripts/pins-lmn.mjs` run against the engine.

### Group L

| Experiment | Defaults | Pinned |
| --- | --- | --- |
| L1 | chopper drive, V_dc = 48 V, D = 50 %, f_s = 20 kHz, R_a = 1.2 Ω, L_a = 3 mH, k = 0.06 V·s/rad, J = 200 µkg·m², B = 10 µN·m·s/rad, T_L = 50 mN·m | 24.0 V commanded, 382.06 rad/s = 3648 rev/min, ⟨i_a⟩ = 897.0 mA, ΔI = 200.0 mA against V_dc·D(1−D)/(L_a f_s), 22.3 % of the mean, T = 53.82 mN·m and equal to the load's, speed ripple 375 µrad/s, η = 88.72 %, τ_e = 2.5 ms against τ_m = 66.5 ms. At D = 75 %: 581.40 rad/s = 5552 rev/min, ΔI = 150.0 mA |
| L2 | H-bridge, the same machine, D = 75 %, bipolar | 24.0 V commanded, the same 382.06 rad/s, ΔI = 300.0 mA against 2·V_dc·D(1−D)/(L_a f_s), ⟨i_in⟩ = +448.7 mA, P_in = 21.54 W. Unipolar: ΔI = 100.0 mA at twice the rate. At D = 30 %: −19.2 V, −335.55 rad/s, ⟨i_in⟩ = −310.7 mA, P_in = −14.91 W |
| L3 | six-step brushless, λ = 20 mWb, 4 pole pairs, R_s = 0.5 Ω, L_s = 1.5 mH, T_L = 200 mN·m, V_dc = 48 V, D = 50 %, f_s = 20 kHz | the pair is 1 Ω, 3 mH and 0.16 V·s/rad. 142.13 rad/s = 1357 rev/min, ⟨i⟩ = 1.2589 A, T = 201.4 mN·m, ΔI = 200.0 mA, torque ripple 32.0 mN·m and 15.89 % deep, f_e = 90.48 Hz, a sector is 1.842 ms, 543 commutations a second, 36.8 switching periods a sector, phase RMS 1.029 A = √(2/3)·I, η = 94.08 %. At f_s = 5 kHz: 63.54 % deep, 9.2 periods a sector |

### Group M

| Experiment | Defaults | Pinned |
| --- | --- | --- |
| M1 | buck 24 V → 12 V, D = 50 %, f_s = 100 kHz, L = 100 µH, C = 100 µF, R = 6 Ω, stray L_f = 1 µH, C_in = 100 µF, R_f = 50 mΩ | V_out = 11.976 V, I_L = 1.9959 A. The input current averages 998.0 mA and swings 2.295 A. Harmonics 1.277 A, 95.3 mA, 423.8 mA, 254.2 mA, 181.5 mA at 100 to 700 kHz against 2·I·\|sin(kπD)\|/(kπ) = 1.271, 0, 423.6 m, 254.1 m, 181.5 m. The input capacitor takes 1.027 A rms against I√(D(1−D)) = 998.0 mA, 72.5 % of the pulse. It ripples 50.97 mV and the line 64.16 mA. The FFT reads the fundamental 1.27653 A against the integral's 1.27654 A. At C_in = 10 µF: 638.3 mV and 842.1 mA |
| M2 | the same converter with C_in = 10 µF and L_f = 47 µH, R_d = 10 kΩ | f_0 = 7.341 kHz, Q = 43.4, the line's 100 kHz current is 184.5 times below the converter's (6.925 mA against 1.278 A), which is \|H\| exactly. Undamped the filter's output impedance peaks at 93.15 Ω against the converter's 24.02 Ω, a ratio of 3.877, and Middlebrook's criterion fails. At R_d = 1 Ω: 0.9897 Ω, a ratio of 0.0412, and the rejection falls to 6.3. At R_d = 10 Ω: 9.039 Ω, 0.376, and 59.2 |
| M3 | switch node, V_in = 24 V, D = 50 %, f_s = 1 MHz, L_p = 100 nH, C_p = 1 nF, R_p = 50 Ω, snubber off, L = 10 µH, C = 10 µF, R = 6 Ω | the node rings at 15.915 MHz measured and 15.915 MHz from 1/(2π√(L_p C_p)), ζ = 0.1, Q = 5, and overshoots 72.84 % against e^{−ζπ/√(1−ζ²)} = 72.92 %, a peak of 41.48 V on a 24 V rail. 15.8 ring cycles fit a switching period and the loop dissipates 557.4 mW on 24 W delivered. At L_p = 400 nH: 7.958 MHz both ways, 53.58 % against 52.66 %. With a 2.2 nF snubber at 10 Ω: 38.88 % overshoot, a 33.33 V peak, and the node's loss rises 1.250 W against C_sn·V²·f_s = 1.267 W |

### Group N

| Experiment | Defaults | Pinned |
| --- | --- | --- |
| N1 | synchronous buck 48 V → 12 V, D = 25 %, L = 47 µH, C = 100 µF, R = 2 Ω, f_s = 300 kHz, R_on = 30 mΩ, R_L = 20 mΩ, t_sw = 20 ns. Network 0.6 K/W at 1 ms, 1.4 K/W at 100 ms, 12 K/W at 300 s, T_a = 25 °C, T_jmax = 150 °C | V_out = 11.707 V into 5.854 A, 68.53 W delivered. Conduction 1.715 W and edges 1.686 W, 3.401 W in all, η = 95.27 %. The junction sits 47.61 K above ambient at 72.61 °C, against a ceiling of 8.929 W and 77.4 K of headroom. At R = 1 Ω: 9.824 W and 162.5 °C, 12.5 K past the limit |
| N2 | as N1, with the pulse period the knob at 1 s and half duty | Z_th is 58.50 mK/W at 100 µs, 393.2 mK/W at 1 ms, 733.6 mK/W at 10 ms, 1.489 K/W at 100 ms, 2.040 K/W at 1 s and 13.57 K/W at 1000 s, each against Σ R(1 − e^{−t/τ}). The ladder runs 3.84 % cooler at 10 ms and 0.03 % cooler at 1000 s. A 3.401 W load at half duty and a 1 s period peaks 27.19 K above ambient and falls to 20.42 K, a 6.772 K swing about a 23.81 K mean that is ⟨P⟩·ΣR exactly. At 1 ms the swing is 511.7 mK. At 100 s it is 10.19 K |
| N3 | as N1, sweeping f_s | the edges cost 5.62 µW per hertz. At 300 kHz they take 1.686 W and the junction sits at 72.61 °C. At 1 MHz, 5.620 W and 127.66 °C. At 2 MHz, 11.24 W and 206.3 °C. The package can afford 1.284 MHz, where the whole 8.929 W budget is spent. At R = 1 Ω the ceiling falls to 218.4 kHz, and at a 60 °C ambient the budget falls from 8.929 W to 6.429 W |

## 5. The lesson schema, unchanged

Each experiment is the shape the built groups use, and every field is measured
by the test named beside it.

```js
{
  id: 'l2', group: 'Motor drives', name: '…',  // ≤ 10 words, prose.test.js
  about: 'D', chips: [0.75, 0.3],              // ≥ 2, in range, default among
                                               // them, each spelled in the note
                                               // or the try (path.test.js)
  try: { knob: 'bipolar', text: '…' },         // ≤ 16 words, every number
                                               // measured (path.test.js)
  note: '…',                                   // ≤ 90 words, ≤ 70 on a group's
                                               // first, ≤ 20 a sentence
  terms: [...],                                // every term of art it uses
  headline: 'eta' | 'ripple' | 'ring' | 'tj',  // the top bar's third meter
  traces: [...], allTraces: [...],             // every signal a note names is
                                               // in the opening set
  views: [...], view: '…', sweep: { x, y },    // the pane the lesson is in
}
```

New views: **Drive** (L1, L3), **Filter** (M1, M2), **Ring** (M3), **Thermal**
(N1, N2, N3). New headline meters: `ripple` for the line current, `ring` for
the node, `tj` for the junction. New sweep axes: `speed`, `torque`, `iin`,
`ripple`, `Tj` and `att`. New traces: `vemf`, `vcin`, `icin` and `iline`.

## 6. The gate

1. `npx vitest run packages/switched apps/power-lab --maxWorkers=4` green,
   with Groups A to G untouched.
2. `npm run build --workspace apps/power-lab` green.
3. `node packages/prose/bin/lint.mjs` clean on every document this work
   touched.
4. `pins.test.js` walks every cell of every new experiment's measures table
   and finds it pinned or excused by name.
5. `BACKLOG.md` says what is built, what is deferred and why, and `NEEDS.md`
   says what the director has to resolve.

No Playwright: this environment has no browser, and `verify.mjs` has not been
run against the new groups. `BACKLOG.md` says so and names what reopens it.
