# Power Lab: the plan

A fourth lab for the suite: **power electronics**, from "why switch at all" through
converters, magnetics, rectifiers, inverters, losses, and closing the loop. Splash
glyph ⚡, directory `apps/power-lab`, engine in a new `packages/switched`.

Decisions already made (Reed, 2026-09-01):

- **Larger scope.** DC-DC, magnetics, AC-DC, DC-AC, losses, and the control bridge
  are all in. Phasing orders them. Nothing here is cut.
- **Ideal first, non-idealities as labelled toggles.** Every ideal claim gets its
  exact closed form. Every non-ideality (R_on, V_f, ESR, switching time, saturation)
  is a switch the reader flips to watch the ideal claim bend, with the panel naming
  what bent it. Ideal-vs-real is the suite's best genre. Here it is the whole genre.
- **Magnetics in scope**, including saturation and the flyback.
- **Name: Power Lab.**
- **Everything in v1** (Reed, 2026-09-01, on seeing the buck slice): three-phase,
  motor drives, resonant/LLC, the forward/push-pull/full-bridge DC-DC family,
  EMI and thermal, the things §9 once listed as non-goals, are v1 groups I–N.
  The engine was built general enough to carry them (event-driven, n-state,
  polyphase sources as oscillator state), so the cost is curriculum, not
  machinery. §9 now says what is *still* out.

The suite's one rule applies with no exemptions: **every explanatory sentence is a
claim about physics, and a test must measure it.** Power electronics is unusually
rich in closed forms, so this lab can be *more* pinned than the others, not less.

---

## 1. The engine: exact piecewise-LTI simulation (`packages/switched`)

### 1.1 Why not a generic ODE solver

Everything in the suite today is LTI. A converter changes topology mid-cycle, which
usually pushes projects into generic timestep simulation, and then every waveform
carries numerical mush the tests cannot tell from physics. We refuse that. The key
observation: **within one switch state, a converter IS a small LTI system**, and for
the 1–3 state systems here, the segment solution has a closed form. No timestep, no
drift, no tolerance knob. The waveform is exact to floating point, which is what
lets a test assert `volt-second balance = 0` rather than `≈ 0 within solver slop`.

### 1.2 The propagator

> **Amendment (2026-09-01):** the propagator below and the event bisection of §1.3
> are built first by Circuit Elements Lab, in `packages/network` (see
> `CIRCUIT_ELEMENTS_LAB_PLAN.md` §1.5–1.6). `packages/switched` imports them and adds
> what is Power Lab's own: the switch-state machine, periodic steady state, averaging.

State x (e.g. `[i_L, v_C]`), constant input u within a segment:

    dx/dt = A x + B u
    x(t)  = φ0(t)·x(0) + φ1(t)·B u,   φ0 = e^{At},   φ1(t) = ∫₀ᵗ e^{Aτ} dτ

For 2×2, write s = tr(A)/2, Δ = s² − det(A). Then with

    Δ > 0:  c(t) = cosh(√Δ t),  σ(t) = sinh(√Δ t)/√Δ        (overdamped)
    Δ < 0:  c(t) = cos(√−Δ t),  σ(t) = sin(√−Δ t)/√−Δ       (ringing)
    Δ = 0:  c(t) = 1,           σ(t) = t                     (critical)

    e^{At} = e^{st} · ( c(t)·I + σ(t)·(A − sI) )

φ1 is the same case analysis with the scalar functions integrated, **no A⁻¹
anywhere**, so a singular A (an inductor across a source, a bare RC hold state)
needs no special-casing. This mirrors the biquad's three-case discriminant handling
already in `@ee-labs/dsp`, and it will be tested the same way: against `expm` by
series at random matrices, and against the physics.

1-state segments (rectifier hold intervals) are scalar exponentials. A 3-state
topology (flyback with leakage, Ćuk if ever) falls back to eigendecomposition with
a balancing step, `@ee-labs/systems` already owns balanced eigen machinery.

### 1.3 Events

Segments end at one of:

- a **clock edge** (PWM: t = DT, T; known in advance),
- a **state event**: diode current reaching zero (DCM entry), diode forward-biasing
  (conduction start, rectifiers), |i| crossing I_sat (saturation), SCR/triac firing
  at angle α, triac current zero (turn-off).

State events are found by **bisection on the exact segment solution** to ~1e-13·T —
the solution is closed-form, so refining costs nanoseconds and introduces no error
model of its own. Every event is recorded with a *name* ("D₁ stops conducting"),
because the conduction-scrub view (§3.2) and the math panel both narrate them.

### 1.4 Periodic steady state, in closed form where it exists

The steady-state waveform is what every lesson is about, and we will not "run until
it settles":

- **CCM, fixed pattern**: over one period, x(T) = Φ·x(0) + d with Φ the product of
  segment φ0's and d the accumulated forced response. Periodicity x(0) = x(T) is a
  linear solve: **x_ss(0) = (I − Φ)⁻¹ d**. Exact, instant, no transient.
- **DCM / event-dependent patterns**: the interval lengths depend on the state, so
  wrap the same map in a shooting iteration (Newton on the 1–2 unknown event times,
  with bisection fallback). Converges in a handful of steps for these systems.
- **Line-frequency circuits** (rectifiers, dimmer): period = one line cycle, events
  are conduction angles. Same shooting on (x₀, angles). Rectifiers converge fast.
- **Transients on demand**: the same propagator runs forward from any x₀, so step
  loads / duty steps for the control experiments reuse the machinery unchanged.

**Affordability gates** (a Control Lab lesson, learned the hard way): cap events
per render (~20k) and per-frame solve work. When a setup exceeds it, the pane says
so and names the setting that caused it, rather than freezing the tab.

### 1.5 Averaged models (the Control Lab bridge)

State-space averaging over the switch states: A_avg = D·A₁ + D′·A₂ (D′ = 1−D),
linearized about the operating point for the control-to-output transfer functions:

    Buck:   G_vd(s) = V_in / (1 + s/(Qω₀) + s²/ω₀²),      ω₀ = 1/√(LC),  Q = R√(C/L)
    Boost:  G_vd(s) = (V_o/D′)·(1 − s/ω_z) / (1 + s/(Qω₀) + s²/ω₀²),
            ω₀ = D′/√(LC),  Q = D′R√(C/L),  ω_z = D′²R/L    ← the RHP zero
    Buck-boost: RHP zero at ω_z = D′²R/(D·L), same structure.

These are stated in closed form AND cross-checked numerically: perturb D in the
switched simulation, extract the response, compare against the averaged prediction
in its valid band (f ≪ f_s/2). That is the lab's own triple-agreement invariant:
**exact switched steady state, long transient simulation, and averaged model must
tell one story** wherever all three claim validity.

### 1.6 Measures

One module, shared by panes, topbar and math panel, all defined on the exact
waveform: cycle average, true RMS (piecewise closed-form integrals, no sampling
error), peak/valley, peak-to-peak ripple, per-device conduction intervals and
average/RMS currents, P_in, P_out, per-mechanism losses, η, THD (against
`@ee-labs/dsp` FFT as an independent check), displacement and distortion power
factor.

### 1.7 Invariants (the fuzzer's checklist)

Fuzzed across the whole component/duty/frequency space, these must hold:

1. **Volt-second balance**: ⟨v_L⟩ = 0 over a steady-state period, per inductor.
2. **Charge balance**: ⟨i_C⟩ = 0 per capacitor.
3. **Energy**: ideal, P_in = P_out to fp precision. With losses, P_in = P_out +
   Σ losses *as an identity* (losses are integrals of the same exact waveform).
4. **Continuity**: M(D) continuous across the CCM/DCM boundary. Waveforms
   continuous across every event.
5. **Consistency**: closed-form RMS/avg vs dense numerical integration. FFT
   fundamental vs analytic Fourier coefficient.
6. **Steady state is steady**: propagating x_ss one more period returns x_ss.

---

## 2. Models

### 2.1 Topologies (switch-state machines)

Each topology = a list of states with (A, B) per state + transition rules + device
annotations for the scrub view.

| Topology | States | Segments (CCM) | Extra events |
|---|---|---|---|
| PWM chopper into R (no filter) |, (memoryless) | on/off |, |
| Buck | i_L, v_C | Q on / D on | i_L→0 (DCM), sync-FET mode |
| Boost | i_L, v_C | Q on / D on | i_L→0 (DCM) |
| Buck-boost (inverting) | i_L, v_C | Q on / D on | i_L→0 (DCM) |
| Flyback | i_M, v_C (+ i_lk stretch) | Q on / D on | i_M→0 (DCM), clamp (stretch) |
| Half-bridge DC-DC (isolated buck) | i_L, v_C (midpoint held at V_in/2 in v1) | Q1 on / freewheel / Q2 on / freewheel | i_L→0 (DCM) |
| Half-wave rectifier + C | v_C | D on / hold | v_in > v_C + V_f (on), i_D→0 (off) |
| Bridge rectifier + C | v_C | pair A / pair B / hold | conduction angles |
| Phase-cut dimmer (triac, R load) |, | blocked / conducting | fire at α, i→0 |
| Square-wave inverter + LC + R | i_L, v_C | +V_dc / −V_dc |, |
| Sine-PWM inverter (full bridge) + LC + R | i_L, v_C | ±V_dc per PWM edge |, |

Conversion-ratio closed forms to pin (K = 2Lf_s/R):

    Buck:        M = D                    DCM: M = 2/(1+√(1+4K/D²)),   K_crit = 1−D
    Boost:       M = 1/(1−D)              DCM: M = (1+√(1+4D²/K))/2,   K_crit = D(1−D)²
    Buck-boost:  M = −D/(1−D)             DCM: M = −D/√K,              K_crit = (1−D)²
    Flyback:     M = n·D/(1−D)  (n = Ns/Np)
    Half-bridge: M = n·D        (D = per-switch duty, D ∈ (0, ½): the primary sees
                                 ±V_in/2, the rectified secondary a pulse train of
                                 amplitude n·V_in/2 with total duty 2D — the panel
                                 derives it from volt-second balance so the duty
                                 convention is on screen, not in a footnote)

Ripple closed forms (CCM, ideal):

    Buck:   ΔI_L = V_o(1−D)/(L f_s)          ΔV_o = ΔI_L/(8 f_s C)
    Boost:  ΔI_L = V_in·D/(L f_s)            ΔV_o = V_o·D/(R C f_s)
    (…and the reason they differ: the buck's cap sees a triangle, the boost's cap
     sees the load current chopped away entirely during DT — see G3.)

### 2.2 Non-idealities: each a toggle, each labelled

| Toggle | Enters as | The claim it bends, and how |
|---|---|---|
| MOSFET R_on | series R in the on-state A matrix | M droops. Conduction loss I²_rms·R_on appears |
| Diode V_f (+ r_d) | affine offset in the diode-state B | M drops by V_f·(interval share). Loss V_f·I_avg + r_d·I²_rms. The sync-rectifier lesson |
| Inductor ESR R_L | series R in every state | **boost's M(D) peak**: M = D′/(D′² + R_L/R), max 1/(2√(R_L/R)) at D′ = √(R_L/R), the reason D→1 gives smoke, not infinity |
| Capacitor ESR | output v = v_C + ESR·i_C | ripple gains a square edge on top of the triangle. ESR heating I²_C,rms·ESR |
| Switching time t_sw | loss term ½·V·I·(t_r+t_f)·f_s (loss-model, not waveform, and the panel says so) | η vs f_s bends over. The frequency tradeoff |
| Source/diode resistance R_s (rectifiers) | series R while conducting | conduction angle, peak-current spikes. *Load-bearing*: an ideal diode straight into a capacitor is ill-posed (infinite current), and the lesson says exactly that, the resistance is not a blemish, it is why the circuit computes |
| Saturation I_sat, L_sat | **piecewise-linear inductance**: L above/below \|i\| = I_sat, crossing = an event | keeps the piecewise-LTI framework *exact through saturation*. The current runaway cliff in D2 |

Every toggled row in the math panel switches from the ideal closed form to the
corrected one **with the correction shown**, never a silent renumbering.

### 2.3 Magnetics model

Minimal but honest: an inductor is N turns on a core of area A_e with saturation
flux density B_sat.

    B = L·i / (N·A_e)         ΔB = (1/(N·A_e)) ∫ v dt      L collapses past B_sat

That one integral, ΔB ∝ volt-seconds, carries three lessons: why a 60 Hz
transformer is iron and heavy while a 100 kHz flyback is ferrite and small (same
volt-seconds budget, 1/f the flux excursion), why duty asymmetry walks a
transformer into saturation, and what the saturation cliff looks like as an event
in the exact simulation (D2). Flyback = buck-boost whose inductor got a second
winding: same two states, turns ratio n in the mapping, isolation as the point.

---

## 3. The app

### 3.1 Layout (the suite's shape)

Sidebar: LabNav ("Power" added), report link, experiment groups (fold like
everywhere else), converter picker, component NumFields with engineering units and
chips, non-ideality toggles, math panel. Main: topbar meters + two stacked panes
with a pane selector, matching Circuit Lab's rhythm.

Topbar meters (live, from exact measures): V_out (avg ± ripple), I_L (avg, pk),
mode chip (CCM/DCM/SAT), P_in → P_out, η, and for AC experiments PF and THD.

### 3.2 Views

- **Scope**, multi-trace over 1–4 switching periods (or 1–2 line cycles): switch
  node, i_L, v_out ripple (AC-coupled option), device currents. **Dual y-axis**
  (V left, A right, the `rightAxis` pattern from Bode). Reuses the caption-band
  and reconstruction honesty rules from Signal Lab's scope.
- **The conduction scrub**, the lab's signature. A Circuit-Lab-style schematic
  with the conducting path lit, scrubbed through one period in lockstep with a
  cursor on the scope (ConvolutionCanvas's scrub pattern). Event names appear at
  their instants ("D turns off, the inductor ran dry"). *What is conducting right
  now* is the question every student is silently asking. This view answers it.
- **Spectrum**, reused from `@ee-labs/dsp`, for line current (E4), PWM output
  (F3), and ripple.
- **M(D) curve**, conversion ratio vs duty with the CCM region, DCM region
  (per current load) shaded, the operating point sitting on it, and the ideal
  curve ghosted when a non-ideality bends the real one (C2's money shot).
- **Efficiency sweep**, η vs load (G2) and η vs f_s (G1), operating point marked.
- **Loss ledger**, where the watts went: per-mechanism table summing exactly to
  P_in − P_out (it is an identity. The test asserts it).
- **B-H / flux view** (Group D), flux excursion against the B_sat ceiling.

### 3.3 Numbers (defaults that make the lessons visible)

Chosen so ripple is *visible on screen* while formulas stay exact, pedagogy over
datasheet fashion, stated in the notes:

- Buck: 12 V → 5 V (D = 0.417), L = 100 µH, C = 100 µF, R = 5 Ω, f_s = 100 kHz.
- Boost: 5 V → 12 V (D = 0.583), L = 100 µH, C = 220 µF, R = 24 Ω, f_s = 100 kHz.
- Rectifiers: 120 V/60 Hz line, 12.6 V transformer secondary, R_s = 0.5 Ω,
  V_f = 0.7 V, C = 100–4700 µF, load 10 Ω–1 kΩ. The six-pulse case is the same
  secondary per phase, so its DC output (≈ 1.35·V_LL) lands near 28 V.
- Inverter: V_dc = 48 V full bridge, f₁ = 60 Hz, f_sw = m_f·f₁ with m_f ∈
  {15, 33, 63} (odd, triplen-avoiding options later), LC = 1 mH/10 µF.

---

## 4. Curriculum: 54 experiments in 14 groups

Format per experiment: **the claim** the note makes → what the reader turns → what
is **measured** against what **formula**. Every quoted number below becomes a
pinned test the way `presets.test.js` pins Signal Lab.

### Group A: Why switching (3)

- **A1 · The regulator that is a resistor.** A linear regulator dropping 12 V to
  5 V at 1 A is a 7 W heater wearing a heatsink: η = V_o/V_in = 41.7%, *independent
  of how cleverly it is built*. Measured: P_pass = (V_in−V_o)·I, η. The number the
  whole lab exists to beat.
- **A2 · A switch pays (almost) nothing.** PWM a 12 V source into a resistor at
  D = 0.42: the average is D·V_in = 5 V but the RMS is √D·V_in = 7.8 V, mean and
  RMS part company the moment a waveform stops being flat (the suite's oldest
  lesson, now with consequences: heat follows RMS², not mean²). Measured: both,
  against DV and √D·V. And the switch itself: V≈0 when on, I=0 when off, the
  product that is power never gets a chance.
- **A3 · The LC does the averaging.** Insert the filter: the load now sees the
  mean, not the chop. The filter is a 2nd-order low-pass with f₀ = 1/(2π√(LC))
  two decades under f_s, the ripple that leaks is the harmonics that survive.
  Measured: ripple vs the closed form. F₀ against Circuit Lab's own formula.

### Group B: The buck (6)

- **B1 · Volt-second balance.** In steady state an inductor's average voltage is
  exactly zero, otherwise its current would walk. The triangle explained from
  ⟨v_L⟩ = 0: V_on·DT = V_off·D′T, i.e. (V_in−V_o)·D = V_o·(1−D). Measured: ⟨v_L⟩
  (must be 0 to fp), and the up/down slopes (V_in−V_o)/L and −V_o/L individually.
- **B2 · V_out = D·V_in.** Drag D. The measured line sits on the prediction until
  a non-ideality toggle bends it, and the panel shows the corrected form with the
  correction visible.
- **B3 · Ripple, priced.** ΔI_L = V_o(1−D)/(L f_s), ΔV_o = ΔI_L/(8 f_s C), the 8
  derived in the panel (the cap integrates the triangle's positive half: two
  quarter-periods of a triangle → T/2·(ΔI/4)/2). Double L, halve ripple. Double
  f_s, halve it again, measured at each step.
- **B4 · Running dry: DCM.** Lighten the load until i_L touches zero: a third
  interval appears (both switches off, the scrub shows the dead circuit), and M
  detaches from D: M = 2/(1+√(1+4K/D²)), K = 2Lf_s/R. Measured against that form.
- **B5 · The boundary, continuously.** Sweep the load across K = 1−D: CCM and DCM
  formulas meet without a seam. A claim about the *formulas*, tested as continuity
  of the measured M while the mode chip flips.
- **B6 · The diode's rent.** Ideal: η = 100%. Toggle V_f = 0.7 V: at V_o = 5 V the
  diode conducts D′ of the time and η ≈ V_o/(V_o + D′·V_f), measured. Swap in a
  synchronous FET (R_on): the rent drops from a fixed 0.7 V to I·R_on, and the
  low-V_out story (why your phone's converters are all synchronous) tells itself.

### Group C: Boost & buck-boost (5)

- **C1 · 1/(1−D).** The inductor charges from V_in, then *stacks on top of it*.
  M = 1/(1−D) measured. The panel derives it from ⟨v_L⟩ = 0 in two lines.
- **C2 · The peak ideal theory misses.** Toggle inductor ESR: M = D′/(D′²+R_L/R),
  peaking at M_max = ½·√(R/R_L) at D′ = √(R_L/R), then *falling*, the ideal curve
  ghosted behind the real one. Measured peak location and height against those
  closed forms. Why "just increase D" ends in smoke.
- **C3 · Boost runs dry too.** DCM with M = (1+√(1+4D²/K))/2, K_crit = D(1−D)².
- **C4 · The inverting bucket.** Buck-boost: the inductor alone ferries energy;
  input and output never touch. M = −D/(1−D) measured. The scrub shows charge
  interval and dump interval sharing no path.
- **C5 · All the energy through one part.** In the buck, (1−D) of the power flows
  straight through. In the buck-boost, every joule is lifted by L: E_cycle·f_s =
  P_o exactly in DCM, and the inductor's mass budget follows. Measured: ½L(i_pk²−
  i_min²)·f_s against P_o + the CCM direct-path accounting.

### Group D: Magnetics (5)

- **D1 · Volt-seconds are flux.** ΔB = ∫v dt/(N·A_e). Same volt-seconds at 60 Hz
  and 100 kHz differ by ~1600× in flux excursion, why the line transformer is
  iron you can barely lift and the flyback transformer fits on a fingertip.
  Measured: ΔB from the integral vs the closed form per waveform.
- **D2 · Saturation: the cliff.** Raise the load or drop f_s until i_pk crosses
  I_sat: L collapses (piecewise-L event), di/dt multiplies, the current spikes —
  runaway *shown exactly*, not hand-waved. The B-H view shows the excursion
  hitting the ceiling. Measured: event location vs B_sat·N·A_e/L.
- **D3 · The flyback: a buck-boost with a passport.** Same two intervals, but the
  energy crosses an isolation barrier and the turns ratio n rescales everything:
  M = nD/(1−D). Reflected voltage n·V_o across the switch. Why it owns every
  low-power offline supply.
- **D4 · The half-bridge: the transformer as a gearbox.** The conceptual foil to
  D3, and the doorway to every isolated buck-derived supply. The flyback *stores*
  each cycle's energy in the core and dumps it. The half-bridge's transformer
  stores (ideally) nothing, energy passes *through* it while the turns ratio
  gears the voltage, which is why the same core moves far more power in forward
  mode than as a bucket. Two switches across a capacitor divider drive the
  primary with ±V_in/2, the rectified secondary feeds the LC at **twice f_s**
  (measured: ripple frequency 2f_s, so the same ripple spec costs half the
  filter), M = n·D with D ∈ (0, ½) measured across the sweep, and each switch
  sees only V_in, the stress row compares it against the flyback's V_in + n·V_o.
  The freewheel intervals (both switches off, the output inductor flying through
  both rectifier legs) are the scrub view's moment. Bonus tie to D1/D2: the
  series capacitor path blocks DC, so the half-bridge *forgives* duty asymmetry
  that would walk other transformers into saturation, stated, and demonstrated
  with the asymmetry slider if the midpoint is promoted to a third state
  (stretch. V1 holds it stiff at V_in/2 and says so).
- **D5 (stretch) · Leakage strikes.** The flux that does not link both windings
  has nowhere to go at turn-off: the spike, and why clamps exist. Third state
  (i_lk). Qualitative if the exact model proves heavy.

### Group E: AC in: rectifiers (6)

- **E1 · Half-wave + capacitor.** Conduction only while v_in exceeds v_C: short
  gulps near each crest. Ripple ≈ I_load/(f·C) (first-order, and the panel says
  it is first-order and shows the exact value beside it).
- **E2 · The bridge.** Four diodes, both half-cycles: ripple frequency doubles,
  ripple ≈ I/(2fC), and the two-diode V_f rent appears in the measured DC value.
- **E3 · The price of big C.** Grow C: smoother output, *narrower and taller*
  current gulps, conduction angle shrinks, peak and RMS diode current grow for
  the same average. Measured: conduction angle, i_pk, i_RMS/i_avg vs C.
- **E4 · What the grid sees.** Spectrum of the line current: odd harmonics
  everywhere. PF = (I₁,rms/I_rms)·cos φ₁, mostly *distortion*, not displacement:
  a rectifier can have cos φ₁ ≈ 1 and PF ≈ 0.6. Measured: PF two ways (P/(V_rms
  I_rms) and the harmonic decomposition, they must agree), THD vs FFT.
- **E5 · The dimmer.** Phase-cut at angle α into a resistive load:
  P/P_full = 1 − α/π + sin 2α/(2π), measured across the α sweep, plus the
  harmonic price, which is why cheap dimmers buzz.
- **E6 · Three phases, six pulses.** Three secondaries 120° apart into a
  six-diode bridge: the pair with the highest line voltage conducts, so the
  output ripples at 6f with ≈ 1/6 the swing of E1's for the same C, and sits
  near the peak *line-to-line* voltage (√3 × phase). The line current has no
  third harmonic, the 5th and 7th are the first that survive, which is why
  industrial rectifiers are three-phase. Measured: 6 pulses, ripple vs I/(6fC),
  V_dc vs 1.35·V_LL, absent triplens, PIV = peak line-to-line. Uses the same
  event engine with the source carried as oscillator state, three phases being
  three linear forms in it.

### Group F: DC out as AC: inverters (4)

- **F1 · The square-wave inverter.** Signal Lab's square wave, now carrying watts:
  fundamental rms = (4/π)V_dc/√2, THD = √(π²/8 − 1) = 48.3%, measured both by
  closed-form Fourier and by FFT, which must agree. The filtering problem stated.
- **F2 · Sine PWM.** Compare a sine at m_a to a triangle at m_f: the pulse widths
  breathe. Fundamental peak = m_a·V_dc (full bridge, m_a ≤ 1), measured across
  the m_a sweep, and the overmodulation departure beyond m_a = 1 shown as it is.
- **F3 · The spectrum has families.** Baseband fundamental, then sideband
  clusters around m_f, 2m_f, …, the LC filter's job is to keep the families and
  surrender the fundamental. Measured: cluster locations, filter attenuation at
  m_f vs Circuit Lab's |H|.
- **F4 · THD vs effort.** Sweep f_sw: output THD falls as the families retreat
  from the filter corner, and Group G will price the same sweep in switching
  loss. One tradeoff, seen from both sides.

### Group G: Losses & efficiency (4)

- **G1 · Conduction vs switching.** P_cond ∝ I²_rms·R_on (flat in f_s);
  P_sw ≈ ½V·I·(t_r+t_f)·f_s (linear in f_s): η(f_s) bends over exactly where they
  cross, measured crossover vs the closed form. Why faster is smaller (D1's flux
  argument) but not free.
- **G2 · The efficiency curve.** η vs load: fixed losses dominate at light load,
  I² losses at heavy. Peak where they are equal (measured against P_fixed =
  P_I² point). The curve on every datasheet, explained rather than shown.
- **G3 · The capacitor's hidden heater.** Same load, same ripple spec: the buck's
  output cap carries a small triangle. The boost's carries the *entire chopped
  load current*, I_C,rms differs by an order. ESR toggle turns it into heat on
  screen. Measured: both RMS currents vs closed forms.
- **G4 · Where the watts went.** The loss ledger: every mechanism, summing to
  P_in − P_out as an identity. The reader toggles mechanisms and watches the
  ledger re-balance, bookkeeping as pedagogy.

### Group H: Closing the loop (3)

- **H1 · The averaged model.** Overlay: the smooth averaged trajectory threading
  the exact switching waveform through a load step. Where averaging is honest
  (f ≪ f_s) and where it is blind (the ripple it discards).
- **H2 · The buck is a plant.** G_vd(s) closed form. **hand over to Control Lab**
  (`plant=custom:…`, the grammar exists). Close the loop there. Come back and
  verify the closed-loop step against the switched truth.
- **H3 · The zero in the wrong half.** Boost: step D upward and V_o *dips first*
  (the inductor must divert energy before it can deliver more), the RHP zero at
  ω_z = D′²R/L, measured from the switched transient's initial undershoot, then
  handed to Control Lab to see the bandwidth ceiling it imposes. The lab's best
  single moment: a nonminimum-phase zero you can watch happen in a circuit.

### Group I: Three-phase out (3)

- **I1 · Six-step.** Three half-bridges, 120° apart, each a square wave: the
  line-to-line voltage is a quasi-square with a 60° gap and the phase voltage a
  six-level staircase. Fundamental line rms = (√6/π)V_dc. No triplens on the
  line, the 5th and 7th at 1/5 and 1/7, measured against Fourier both ways.
- **I2 · Sine PWM in three phases.** F2's comparator, thrice: line-line
  fundamental peak = (√3/2)·m_a·V_dc. Adding a third-harmonic (or space-vector)
  offset to the references raises the ceiling by 15 % without appearing on the
  line, measured: the ceiling with and without, and the triplens that cancel.
- **I3 · Balanced load, constant power.** A balanced three-phase load draws
  constant instantaneous power, the DC bus sees no 2f ripple, unlike the
  single-phase inverter's. Measured: p(t) flat to rounding, the single-phase
  case's 2f swing beside it.

### Group J: Isolated DC-DC: the half-bridge's siblings (3)

- **J1 · Forward.** A buck through a transformer: M = n·D, with a reset winding
  and D < 0.5 so the core resets, the magnetising current's own volt-second
  balance, drawn. Measured: M, the reset interval, switch stress 2·V_in.
- **J2 · Push-pull.** Two switches alternating into a centre-tapped primary,
  both halves of the core's loop: M = 2·n·D, ripple at 2f_s, and the flux-walk
  hazard when the two halves are not symmetric (a small R_on mismatch, and the
  magnetising current drifts every cycle, measured over the drift).
- **J3 · Full bridge.** Four switches, the primary swung both ways: the same
  M = 2·n·D at a switch stress of V_in rather than 2·V_in. The three compared
  on one table, stress, utilisation, parts, with every column measured.

### Group K: Resonant conversion (3)

- **K1 · The series resonant tank.** An LC tank driven by a square wave, loaded
  through a rectifier: current is a sine, and above resonance it lags the
  voltage, so the switches turn on at zero voltage. Measured: the gain curve
  |M(f)| against the fundamental-approximation formula, and where the FHA is
  honest (near resonance) and where it is not (well below).
- **K2 · LLC.** Add the magnetising inductance and the gain can exceed 1 below
  resonance: the two resonances, the load-dependent peak, ZVS everywhere on the
  right slope. Measured: gain vs f at three loads, the peak gain's location vs
  the L_m/L_r ratio.
- **K3 · Why resonant.** Same power, same devices: the LLC's turn-on loss is
  zero and its turn-off loss small. The hard-switched bridge pays the full
  ½VI·t per edge. G1's loss crossover, redrawn with a resonant line under it.

### Group L: Motor drives (3)

- **L1 · The DC motor is an R–L–EMF load.** A chopper into R_a, L_a and a back
  EMF K·ω: the armature current is the buck's inductor current with the output
  capacitor replaced by a heavy flywheel. Mechanical time constant ≫ electrical,
  so ω is quasi-static per period and stepped between them. Measured: torque =
  K·⟨i_a⟩, the speed the duty commands, current ripple by the buck formula.
- **L2 · Four quadrants.** The H-bridge: forward/reverse, motoring/braking.
  Bipolar vs unipolar PWM, twice the ripple frequency for the same switching.
  Regeneration: the bus sees current come back, measured as negative ⟨i_in⟩.
- **L3 · Six-step BLDC.** Hall sensors pick two of three phases. The current
  commutates every 60° and the torque ripples where it does. E6's pair-picking
  rule, run backwards. Measured: commutation angles, torque ripple depth.

### Group M: EMI (3)

- **M1 · What the input sees.** The buck's input current is a pulse train. Its
  spectrum is E4's problem at 100 kHz. Measured: harmonic magnitudes vs the
  closed-form pulse-train Fourier series, the input capacitor's share.
- **M2 · The input filter.** An LC in the line: attenuation at f_s vs Circuit
  Lab's |H|. The damping it needs so it does not resonate with the converter's
  negative input resistance (Middlebrook's criterion, measured as the impedance
  ratio).
- **M3 · The switch node rings.** Parasitic inductance and the diode's
  capacitance: an RLC at each edge, its frequency and decay measured against
  the parasitic values, and the snubber that damps it (with its cost in G's
  ledger).

### Group N: Thermal (3)

- **N1 · Loss becomes temperature.** Junction-to-ambient as a thermal
  resistance: T_j = T_a + P·R_th. The loss ledger's total, read as degrees;
  the derating line where T_j reaches its limit. Measured against the ledger.
- **N2 · The thermal RC.** Foster/Cauer networks: a load step heats the die in
  milliseconds and the heatsink in minutes, Circuit Lab's step response with
  °C on the axis. Measured: time constants vs the network, peak T_j for a pulse.
- **N3 · Faster is hotter.** G1's f_s sweep, finished: switching loss vs f_s
  through R_th gives T_j vs f_s, and the frequency a given package can afford
  for a given ripple. One curve with the whole tradeoff on it.

---

## 5. Hand-overs

| Direction | Payload | Mechanism |
|---|---|---|
| Power → Control | averaged G_vd for buck/boost/buck-boost, provenance-labelled | existing `plant=custom` + `from=` link grammar |
| Power → Circuit | the output filter as the RLC it is | existing `b=`/`src=` grammar, low effort |
| Power ↔ Signal | spectra live inside Power Lab (reused dsp), square-inverter and band-limited-square lessons cross-reference by name in notes | prose links, no new grammar |

No new link grammar in v1, the hand-over territory belongs to the parallel
session's fidelity work, and `plant=custom` already carries coefficients exactly.

## 6. Testing discipline

- **Closed-form pins**: every formula quoted in §2 and §4 (M, ripple, boundaries,
  THD 48.3%, PF identity, dimmer power, ω_z, efficiency crossover…) asserted
  against the exact engine, at the preset's numbers and under fuzz.
- **Invariant fuzz** (§1.7) across component/duty/frequency space, including
  hostile corners (D→0, D→1, K near critical, saturation boundary).
- **Triple agreement**: closed-form steady state vs long transient vs averaged
  model, wherever each claims validity, disagreement fails the build.
- **Independent cross-checks**: RMS/avg by piecewise closed form vs dense
  integration. Fourier coefficients vs `@ee-labs/dsp` FFT (two codebases, one
  answer).
- **Note claims pinned** like `presets.test.js`: every number in an experiment
  note is a test.
- **Browser verify**: Chromium + Firefox pixel checks of scope geometry, scrub
  sync, mode chip, and gate messages. Probes must measure the claim, not a proxy
  (see the caption-plate lesson).
- **readme-claims**: splash card count, README tables, pinned as the other labs.

## 7. Integration: and the dark launch

**Power Lab stays off the splash page until Reed confirms it good.** While it is
being built it must be reachable for testing but *advertised nowhere*:

- It **deploys from Phase 2 onward** at `/power-lab/`, unlinked, so browser
  verification and Reed's own testing happen against the real deployment, not a
  local preview. (Unlisted, not secret: the repo is public, and that is fine.)
- The splash page, the root README's lab table, and the **other three labs'
  `LabNav`** carry no reference to it. Power Lab's *own* LabNav may link outward
  to the released labs, visibility is one-way while it is dark.
- The promise is **pinned by a test**, in the suite's own style, not left as a
  note: `apps/power-lab/RELEASE_STATUS` holds `dark`. A readme-claims-style test
  asserts that while it says `dark`, `site/index.html`, `README.md` and `LabNav`
  contain no `power-lab` reference, and the moment it says `released`, the SAME
  test inverts and *requires* the splash card, the README row and the nav entry,
  each with counts pinned. Flipping one word flips the whole contract, and
  nothing can be half-linked.
- Flipping that word is **Reed's action**, taken after the release gate in §8
  passes, not a side effect of any phase completing.

Everything else as usual once released: splash card (⚡, "54 experiments" pinned
by test), deploy workspace entry, `report.js` summary (converter, components,
toggles, D, f_s, mode), AGENT_BRIEF.md for future sessions.

New app + new package = naturally conflict-free territory alongside the parallel
session. Shared-file touches (LabNav, splash, deploy config) are exactly the
release-gated ones, so they land in one small batch at the end.

## 8. Phasing (each phase ships green and deployable)

Built so far: the engine, Groups **A**, **B**, **E** and **C** (20 experiments,
dark at `/power-lab/`). Group C came after E because E's event engine was the
riskier piece and worth proving first. C then needed no new machinery, only the
lossy CCM ratio (`ratioWithRL`, `boostPeak`) the engine now exports. Next by
this list: **D** (magnetics) and **F** (inverters).


1. **Engine**: `packages/switched` propagator + events + steady state + measures,
   fully fuzzed *before any UI exists*. Exit: invariants 1–6 green under fuzz.
2. **Buck vertical slice**: app shell, scope, math panel, meters. Groups A + B
   (9 experiments). Exit: every B-note pinned. Browser verify green. **deployed
   dark at `/power-lab/`** with the RELEASE_STATUS test enforcing zero splash,
   README or cross-lab-nav references.
3. **Boost/buck-boost + conduction scrub + M(D) view**: Group C. Exit: C2 peak
   formula pinned. Scrub-vs-scope sync pixel-verified. *(Shipped without the
   scrub, which lands with Group D's freewheel intervals, the M(D) sweep and
   the signed inverting output carried C on their own.)*
4. **Magnetics**: piecewise-L saturation events, B-view, flyback, half-bridge
   (D4's freewheel intervals exercise the scrub view hardest). Group D.
5. **AC**: rectifiers + dimmer + six-pulse (Group E), the event engine's
   first outing: topology chosen by state, shooting on the capacitor voltage,
   exact Fourier integrals, then inverters + PWM spectra (Group F).
6. **Losses + control bridge**: Groups G, H. Loss ledger, efficiency sweeps,
   Control Lab hand-over round-trip. Report link. AGENT_BRIEF.
7. **Three-phase out and the isolated family**: Groups I, J, F's PWM and D4's
   half-bridge machinery, three times over.
8. **Resonant and motor drives**: Groups K, L, the tank and the armature are
   both LTI per segment. K needs the output rectifier's diode events (E's
   engine), L a slow mechanical state stepped between periods.
9. **EMI and thermal**: Groups M, N, spectra and filters from Signal/Circuit
   Lab's existing tools. Thermal networks are Circuit Lab RCs with °C on them.
10. **The release gate**, in order, each blocking the next:
   1. the full-suite audit treatment: the same all-angles pass the other three
      labs got (every option, every preset, every claim, fuzzing, both browsers,
      pixel-level checks that measure the claim and not a proxy) — and the
      §11 bar, which turns the 2026-09-02 review's scores into tests;
   2. Reed's own hands-on pass against the dark deployment;
   3. Reed flips `RELEASE_STATUS` to `released`, which makes the pinning test
      *demand* the splash card, README row and LabNav entries — and only that
      commit touches the shared surfaces.

## 9. Non-goals (v1, stated so they are decisions rather than omissions)

Current-mode control loops *inside* Power Lab (the loop lives in Control Lab —
that is the point of the bridge), digital control/DPWM, PCB layout, magnetic
field solvers, and device physics (reverse recovery, gate charge) beyond what a
labelled toggle can carry. Three-phase, motor drives, resonant/LLC, the
forward/push-pull/full-bridge family, EMI and thermal were on this list until
2026-09-01 and are now Groups I–N. Each is a coherent later group and none
blocks the curriculum before it.

## 10. Risks, named

- **DCM shooting robustness** at hostile corners → bisection fallback + gate
  with reason (never a frozen tab, never silent wrongness).
- **Dual-axis scope legibility** → the one genuinely new UI idiom. Prototype
  early in Phase 2 with the caption-band rules applied from day one.
- **Scrub-schematic authoring cost** per topology → schematic definitions data-
  driven from the same topology tables the engine uses, so a circuit and its
  picture cannot drift apart. *(Settled differently: the nine drawings are
  hand-laid-out in `apps/power-lab/src/components/schematics.jsx`, a generated
  layout produced awkward diagrams, and the drift is held by tests instead:
  the diode count against the engine's rectifier, the freewheel symbol against
  the sync toggle, every value against the parameters the engine ran with. The
  sidebar slot and symbol kit follow Circuit Lab's so the two labs read alike.)*
- **Scope creep in Group D** → D4 pre-marked stretch. Saturation ships, leakage
  may slip.

## 11. The 9.5 bar: from the 2026-09-02 review

On 2026-09-02, with Groups A, B, C and E built, the lab was walked cold as a
new student and scored on six metrics:

| Metric | Score |
|---|---|
| Physics rigour & correctness | 9 |
| Information — content | 8 |
| Information — delivery | 4 |
| Layout | 5 |
| Flow & intuition | 5 |
| Plots | 6 |

The finding underneath all six: **a green suite told us nothing about any of
this.** Stacked table cells, femto-volt dust, seven dead knobs, auto-ranging
axes, a hidden math panel, 1372 passing tests and not one was about any of
them, because none was about a number being wrong. So the bar for 9.5 is not
"I feel better about it". It is:

> **Every complaint in the review becomes a test that fails on `d8bd978` and
> passes after.** A metric reaches 9.5 when its list below is green *and* a cold
> re-walk of all 20 experiments finds nothing left that a student would trip
> on. The last half-point on the two "new student" metrics is Reed's to give,
> from a hands-on pass — a model can't stand in for a newcomer, only for the
> reviewer who already found these.

Tests are written **first**, against the current build, and watched fail, the
caption-plate lesson (the probe must restate the complaint, not a proxy for it).

### 11.0 The independent pass (2026-09-02)

A second reviewer walked the live deployment at 1366×768, 1440×900 and 390 px
and read the A/B/C/E code, agreed with the six scores, and found defects the
first pass missed. Each was checked against the source before it was added
below. Every one is real.

**Claim bugs, the page says something the note contradicts:**

- **A2's topbar reads η = 100 %.** `analysis.js` hard-codes `eta: 1` for the
  chopper. It is true by the book's definition (P_out = ⟨v²⟩/R, P_switch = 0)
  and it is the opposite of the lesson, which is that the chopper puts 12 W
  into a load that wanted 5. A2's headline is **V_rms vs ⟨v⟩** (7.75 V vs
  5.00 V); η leaves that topbar. → 11.2.2, 11.3.6.
- **A3's 3.65 mV ripple cannot be seen.** Opening traces are `vsw` (0–12 V)
  and `vout` (5 V ± 1.8 mV) on one voltage range, the note's whole number is
  a flat green line. Class 5 of the audit playbook. → 11.6.1 (two strips) and
  11.6.7 (opening traces show the claim).
- **C4 says "watch i_in go flat" and `iin` is not an opening trace.** → 11.6.7.
- **A3's topbar shows K and K_crit**, B5's symbols on a Group A screen,
  because `flowNodes` shows them for every buck. → 11.3.7.
- **C2 opens at D = 0.5**. The peak it is about is at 0.9. → 11.5.5 (a chip
  at the peak, and the default moves there).
- **A3's last sentence** says "the rest of this group is why it works". A3 is
  the last experiment in its group. It means Group B. → 11.5.4.

**Delivery, measured in pixels** (1440×900, sidebar 900 px tall):

| | note | schematic | first knob | math toggle |
|---|---|---|---|---|
| A1 | in view | in view | 880 px | 1122 px |
| B4 | in view | 805 px | 1040 px | 1531 px |
| E1 | in view | 889 px | 1124 px | 1638 px |

You can read the essay. You cannot turn the knob it names or open the panel
that checks it without scrolling. That is 11.3.2's test, with its numbers.

**Names and shell:**

- The lower pane is called **Underneath**. Elements Lab renamed its pane
  **Analysis** after its own entry-level review. The same word here, so the
  labs read as one suite. → 11.3.8.
- **390 px is not a pass**: the topbar truncates (`η = 4`), the title appears
  twice, the schematic is below the fold. → 11.4.6.

**Architecture:** `packages/switched/src/expm.js` is a **second exact
exponential**. The 2026-09-01 amendment (§1.2) said Elements Lab's
`packages/network` owns φ₀/φ₁ and Power Lab imports them; `network/src/expm.js`
now exports `expm` and `expm2`, committed. Two scaling-and-squaring
implementations will drift. → 11.1.5, before Group D adds a third state.

The reviewer's ordering agrees with 11.7, with the claim bugs pulled into
step 1 because they are first-screen. Stay dark through step 3.

### 11.1 Physics rigour: 9 → 9.5+

What 9 already means: every note number measured, every formula footnoted where
it stops applying. The half point is the region *between* the notes: a wrong
fixed point somewhere in the knob space no note visits.

1. **Transient agreement.** Run every clocked converter from rest for N periods
   through the same propagator and require the last period to match the closed-
   form steady state to 1e-6 relative, at the defaults and under fuzz. A shooting
   method that converges to the wrong orbit is the one bug the steady-state tests
   cannot see, and this is the only test that can.
2. **Whole-space fuzz for the PWM family** (buck/boost/buck-boost × CCM/DCM ×
   diode/sync): seeded random knobs across every range, plus the hostile
   corners pinned by name, D → 0.02, D → 0.98, K within 1 % of K_crit, r → 0,
   ESR → 1 Ω. Invariants 1–6 (§1.7) hold. No NaN, no negative period, no
   `mode` that disagrees with the diode current's sign.
3. **Every quantity in the measures table has a closed form or a stated
   reason it hasn't.** A test walks `TOPOLOGY_SIGNALS` × experiments and requires
   each avg/rms/min/max/pp shown to be either pinned against a formula or listed
   in an explicit `unpinned` set with a one-line reason. Today the table shows
   more than the tests read.
4. **Sweep monotonicity and continuity**: M(D) and M(R) traces have no
   discontinuity larger than the step's own physics allows (the CCM/DCM kink is a
   kink, never a jump). P_out(C) sweeps in E3 are smooth.
5. **One propagator.** `switched` imports `expm`/`expm2` from `@ee-labs/network`
   and keeps only its own `propagator`/`propagator01` wrappers (φ₁ without A⁻¹).
   Done in two commits: first a test that the two implementations agree to
   1e-14 on 500 random matrices across all three discriminant cases, then the
   deletion. `packages/network` is the other session's territory, this is an
   import, not an edit. Anything it needs from `network` goes in NEEDS.md.

Exit: `packages/switched` invariants green under a 2 000-sample fuzz per kind
within the CI budget; `experiments.test.js` has no measured value without a
pin or a reason; `switched/src/expm.js` is gone.

*As built (step 7):* item 1, `runPeriods(conv, x0, {periods, settle})` in
`switched/src/transient.js` walks the circuit from rest knowing nothing of the
solver's answer: exact on/full-off steps through the propagator, the diode's
zero found by scan-and-bisect on the closed-form 2×2 exponential (~8 µs a
period), settle judged on two consecutive quiet periods against the walk's own
scale (measured at both switching instants, a buck-boost's capacitor is nearly
empty at the end of the on-interval). Held at 1e-8 relative, not the planned
1e-6: nine named cases, a 150-sample seeded fuzz bounded to converters whose
slowest mode settles within 200 000 periods, and every clocked experiment at
its defaults (`apps/power-lab/src/transient.test.js`). The walker found the
bug the plan feared: a ringing buck (resonant period shorter than the
off-interval) has a multi-rooted DCM residual, and the bisection landed on a
root where the inductor current had already gone to −11 A. `steadyState` now
rejects any root that is not the first zero of the off-interval current and
scans for the earliest physical one (`steady.test.js` "the diode blocks at
the first zero of its current"). Item 2, `space.test.js`: 2 000 seeded
converters per kind (measures every tenth) plus the named corners with the
mode asserted at K = 1.01/0.99 K_crit. It catches the pre-fix solver at buck
#147. Item 3 — `pins.test.js` walks `TOPOLOGY_SIGNALS` × experiments: 852
cells, 730 pinned to closed forms, 122 excused by named reason
(TRANSCENDENTAL for the rectifier's output, RIPPLE for DCM extrema the
first-order model does not place, sampled-trace extremes at 2e-5). An
unpinned cell fails the walk. Item 4, `sweeps.test.js`: M(D) and M(R) for
all fourteen clocked experiments at 61 and 241 points. Continuity by
refinement (the largest step halves under 4× the points. A jump would not),
the step at every mode change bounded by its neighbours, |M| never falling
with R, the boundary crossed once and toward DCM, M(D) turning at most once
and only for a boost with a winding. E3's sweep is angle and peak current
against C (not P_out, which the E3 view never plots). Angle, i_pk, ripple and
V_dc are held smooth and monotone. A 1 % offset in DCM fails 13 of 29. Item
5, `oneExpm.test.js` first (500 seeded matrices, four classes, four
durations, e^{At} and the 6×6 augmented matrix): the two agree to 1e-14 below
‖M‖ ≈ 10 and proportionally above, where both lose the same last bits to
squaring (≤ 5e-14 at ‖M‖ ≈ 140 against the closed form). Then the retirement:
`propagator.js` imports `expm` from `@ee-labs/network`, the Taylor lives on
only as that test's oracle, `switched` declares the dependency, nothing was
needed from `network`. One tolerance moved: the space fuzz's η ≤ 1 + 1e-12
became 1 + 1e-9 (the balance's bar), a lossless converter with RC ≈ 1e5
periods carries ~1e-11 from the conditioning of I − Φ, and the old bar had
passed that sample only by the retired routine's rounding.

### 11.2 Information: content, 8 → 9.5+

The notes are strong. Two experiments are wrong-sized and every note tells the
reader what is true without telling them what to *do*.

1. **Split B6** into three: **B6 · The diode's rent** (V_f, sync toggle: the
   drop as a fraction of V_out, why sync wins at 5 V and doesn't at 48 V);
   **B7 · The resistances** (R_on, R_L, ESR: M sags, ripple grows a step from ESR
  , the step is the tell). **B8 · The edges** (t_sw: loss ∝ f_s·t_sw, the first
   place frequency costs something). Each with a pinned number and one knob it
   is *about*. Group B becomes 8. The splash count moves when released.
2. **Rebuild A2.** Chopper into a resistor: v and i are proportional, so two
   traces overlap by physics, draw one, and draw **⟨v⟩ and V_rms as labelled
   reference lines** so the gap between them is the plot's subject. Add the
   losses view (the switch's P = 0 while the load's is ⟨v²⟩/R) and a D sweep of
   ⟨v⟩ and V_rms together (the straight line and the square-root curve, the
   lesson as a picture). Pin: ⟨v⟩ = DV_in, V_rms = √D·V_in, P_load = D·V_in²/R.
   The measures table stops listing `v_sw` and `v_out` as the same row twice.
   **Its topbar shows V_rms against ⟨v⟩, never η**, the chopper's η = 1 is
   true and is the opposite of the point. Test: A2's rendered topbar contains
   `7.75` and `5.00` and does not contain `100`.
3. **One imperative per note**, in the note's last sentence and stored as its
   own field (`try`) so it can be rendered apart: "Set f_s to 400 kHz, the
   ripple should drop to a quarter." B3, E3, A3, C3 each already contain the
   experiment as a fact. Every note gets one. Test: every experiment has a
   `try`. Every number in a `try` is measured like the note's.
4. **Group intros**, two sentences per group stating what the group will
   establish, as a `GROUP_INTROS` map rendered above the group's experiments
   when open. Test: every group has one. Word count ≤ 45.
5. **Reading level.** Notes ≤ 100 words, sentences ≤ 20 words on average,
   measured by test (the numbers today are 121 and 24). First use of a term in
   a group's notes is either defined inline or in that experiment's `terms`.
   Test: every term-of-art that appears in `terms.js` and in a note is in that
   experiment's `terms` list.
6. **E1's 42.9° is on the plot** (see 11.6 item 4) and the note points at it.

Exit: the tests above green. A2 and B6–B8 re-walked cold and each carries one
claim, one knob, one picture.

*As built (step 6):* item 1 as planned, B6 is about V_f (chips 0.5 / 1 / 0,
sync toggle beside it, η-vs-D sweep), B7 about ESR (chips 0.05 / 0.5 / 0, the
14.40 → 3.63 mV step, η-vs-R sweep), B8 about t_sw (chips 20 / 5 / 100 ns) with
a new **η-vs-f_s sweep** (`sweepFs`, log axis 10 kHz – 2 MHz) so the first
place frequency costs something is a picture. Item 2: the scope draws `v_out`
alone (i_R is in `allTraces`, off by default, since it is v_out/R by physics);
the reference lines were dropped in favour of the **sweep on one shared volt
axis** (`sweep.shared`, `label2`): ⟨v⟩ = D·V_in straight, V_rms = √D·V_in
above it at every D, the gap is the subject and it is drawn once, not
per-trace. Measures list `v_out` and `i_R` only (`TOPOLOGY_SIGNALS.chopper`).
Item 5 landed at ≤ 90 words (≤ 70 for a group's first experiment) and ≤ 20
words a sentence, with `try` ≤ 16 words, tighter than the 100 planned,
because the 1366×768 fold in 11.3 item 2 is the real arbiter and the planned
100 did not fit under it. The term test is whole-word with explicit plural
aliases. Verbs ("ripples", "averages") are not term mentions. Even so the
group-first experiments (intro + note) ran 48 px past the fold at 1366×768,
so the experiments section's "Experiments" heading went: the row of group
tabs is now the section's cap (sticky, ruled, the name kept for a screen
reader), and the section chrome tightened by a few pixels each. verify.mjs:
22/22 above the fold at 1366×768 and 1440×900.

### 11.3 Information: delivery, 4 → 9.5+

The lab's thesis, the formula beside what it predicts, sits 170 px below the
fold in a 950 px window, collapsed. Nothing else in this section matters until
that is fixed.

1. **Math becomes a lower-pane view**: Measures · Balance · **Math** · Sweep ·
   Losses. Full width, one click, found. The sidebar's `MathPanel` goes. The
   sidebar shortens by its longest element. Test: the math view renders for all
   20 experiments. A Playwright probe asserts the view button is visible without
   scrolling at 1366×768.
2. **Above the fold, always**: at 1366×768 and 1440×900, for every experiment,
   the note, the schematic and the first knob are inside the viewport without
   scrolling the sidebar. Playwright asserts bounding boxes, per experiment —
   the complaint was measured in pixels and its test is in pixels.
3. **The header says what the lab is for**, not how the engine works: one
   sentence a newcomer can use ("Each experiment loads a converter, names one
   knob, and states the number to read."). The engine's fidelity moves to the
   report link's provenance.
4. **Terms open on first visit** of an experiment that declares terms, closed
   thereafter (per-session state). The rescue only works if it is seen once.
   *As built (step 5):* the list does not open by itself, open, it is a
   screen of definitions above the schematic and the knobs, and item 2's fold
   is the harder promise. Instead the summary always names the terms
   ("Terms: Duty (D) · RMS · Average") and is in the accent on the first visit,
   plain on a return. Seen once, one click away, no lines lost.
5. **The `try` line renders as its own element** under the note, with the
   knob's name as a chip that focuses it.
6. **The topbar's third meter is the experiment's own headline**, declared per
   experiment (`exp.headline`): η for A1 and the converters, V_rms vs ⟨v⟩ for
   A2, PF for the line side. Test: every experiment declares one. A2's is not η.
7. **Symbols appear when they are taught.** K and K_crit in the top bar are
   B5's. They show from B4 on, not on A3's first buck. `flowNodes` takes the
   experiment, not the kind. Test: A3's rendered topbar contains no `K`.
8. **The lower pane is "Analysis"**, Elements Lab's word, not "Underneath".
   Test: the pane heading text, pinned like Elements Lab pins its own.

Exit: the fold test green at both sizes for all 20. The math view has been
opened in a cold walk without being looked for.

### 11.4 Layout: 5 → 9.5+

Both panes are 453 px whatever the experiment is about. Eight of twenty open on
a sweep that then gets the lower half.

1. **Weighted split.** The pane an experiment names as its `view` gets 62 % of
   the main height. The other 38 %. The user can drag the divider (a
   `pane-split` state in `App`, remembered per session) or click a pane's header
   to swap. Test: primary pane height ≥ 55 % at every experiment, 1366×768.
2. **An experiment can declare the scope silent** (`scope: false`): A1 hands its
   whole pane to the lesson. (A2 gets a real scope from 11.2 and keeps it.)
   Test: A1 renders no canvas in the upper pane. Every other experiment does.
3. **Nothing overflows.** Playwright asserts `scrollWidth === clientWidth` on the
   app and every pane at 1280, 1366, 1440 and 1920 wide, for every experiment
   and view, the spectrum-scroll complaint, generalised.
4. **Knob order by lesson**: the knob the experiment is about first, then its
   supporting knobs, then the rest folded ("More"). Test: `exp.about` names a
   knob and it is first in `exp.params`.
5. **Sidebar order**: Experiments → note → try → Schematic → Knobs. (Math has
   left.) Group folds keep the active group open and never auto-close the one
   you are in.
6. **390 px is a pass.** The topbar wraps to two rows and never truncates a
   meter. The experiment title appears once. The schematic moves into the main
   column above the panes on phone. A1 shows its loss bars, not lines. Test:
   Playwright at 390×844, no clipped text in the topbar (every meter's
   `scrollWidth` fits), one `h3.note-title`, schematic bounding box inside the
   first viewport.

Exit: the five Playwright layout probes green at every size × experiment × view.

### 11.5 Flow & intuition: 5 → 9.5+

There is no path through the material and the group letters advertise a hole.

1. **Drop the letters from every visible surface**: group names ("Why switch",
   "The buck", …), the note title, the top bar. The ids stay `a1…e6` internally
   and in deep links; `release.test.js` and the plan keep their letters. Test:
   no rendered text matches `/\b[A-N]\d\b/` except inside `data-id`.
2. **Next / previous** in the top bar, with "7 of 20" and the group name. The
   sequence is `EXPERIMENTS` order. Test: from every experiment, next and
   previous land where the list says. Last has no next.
3. **"Start here" on A1**, and the lab opens on it with the group intro shown.
4. **Each note ends with where it leads**: a `next` hint ("Next: M = D") rendered
   as a link, distinct from the top-bar button, the within-group arcs (A's
   three beats, E1→E2, C1→C2) become visible as arcs. Test: every `next`
   resolves to an existing id, and a note that says "this group" is in a
   group with an experiment after it (A3's currently isn't: it means Group B).
5. **Preset chips on the featured knob**, NumField already takes `presets`;
   each experiment lists the stops its lesson lives at (E3: C = 100 µF, 1 mF,
   4.7 mF. B3: f_s = 100 k, 400 k. C2: D = 0.5, 0.9). Test: every experiment's
   `about` knob has ≥ 2 chips, all inside the knob's range, and each chip's
   number appears in the note or `try`. **And the default sits where the
   lesson is**: C2 opens at D = 0.9, on the peak, with 460.8 W in the winding —
   the same class as Elements Lab's H2 cursor once sitting on a zero crossing.
   Test: for every experiment, the number the note leads with is the number at
   the defaults.
6. **The "you have moved away from the defaults" line gets a way back**: a
   reset chip beside it. Test: clicking it restores `defaultsOf(id)`.

Exit: a cold walk from A1 to E6 using only next/previous, never the list, with
the group intro read at each boundary, finds no "why am I here" moment. Reed's
pass sets the last half-point.

### 11.6 Plots: 6 → 9.5+

Ripple, sweep and spectrum read well now. The dual-axis scope needs decoding,
and two experiments draw pictures that don't show their claim.

1. **Two strips, one time axis.** Voltages above, currents below, the time axis
   shared, each strip with its own anchored range. Where only one kind is shown
   the strip takes the full height. The dual-axis convention (the plan's "one
   genuinely new UI idiom", §10) is retired. It was the idiom that needed a
   legend to decode. Test: a pixel probe finds the current trace's colour only
   in the lower strip and no voltage colour there.
2. **Legends off the canvas.** Trace names live in the chips above the frame
   (already coloured). The canvas keeps only the edge names. Test: no
   `fillText` of a trace label in the scope's draw path.
3. **Axis anchoring for every plot, promoted to `packages/ui`** as an additive
   module (`anchor.js`: `niceBounds`, `traceExtent`, `scopeRange`) so the other
   three labs can adopt it, a new file, no edits to shared files, else via
   NEEDS.md. The sweep's y-range anchors to the defaults the way the scope does.
   Test (already written for the scope, extended to the sweep and balance
   panes): frame unchanged across a knob change that stays inside it.
4. **Marks on the plot for the note's numbers**: E1's conduction angle as a
   shaded interval labelled "42.9°". B5's boundary as a marked point on the
   sweep. A2's ⟨v⟩ and V_rms lines. C2's peak D marked. Test per mark: the
   label text is drawn and its x maps to the measured value to within a pixel.
5. **A1 draws the loss**: no scope. Its pane is the losses bar with the 7 W
   named, so the first screen shows the number the lab exists to beat.
6. **A visual regression harness**, the piece every other lab has and this one
   doesn't: `apps/power-lab/scripts/verify.mjs` in the suite's idiom —
   Chromium and Firefox, every experiment × view at two sizes, with probes that
   restate the complaints above (ripple spans ≥ 15 % of its strip at defaults;
   frame unchanged after a knob change. Table cells not stacked. No femto
   dust in any rendered text. No overflow). Run by hand before every push, in
   CI when the deploy workflow gains a browser step.
7. **The opening traces show the claim.** An experiment's default trace set is
   the one its note describes, nothing else: A3 opens on `vout` alone (so the
   3.65 mV is the whole strip), C4 opens with `iin` (the note says to watch
   it), and no Group A experiment offers the twelve-chip trace bar, the chips
   are the traces the topology has *and the group has met*. Test: every signal
   a note names is in the opening set. The ripple probe in item 6 runs on A3
   and B3 at their defaults.

Exit: `verify.mjs` green in both browsers. The review's plot complaints —
the four from the first pass and A3's, C4's from the second, each have a
probe that failed on `d8bd978`.

### 11.7 Order and cost

Sequenced so each step is deployable and the first-run experience improves
first:

| Step | Items | Buys | Size |
|---|---|---|---|
| 1 | 11.3.1, 11.5.1, 11.4.2, 11.6.5, **and the claim bugs**: 11.3.6–8 (A2's topbar, K hidden until B4, "Analysis"), 11.6.7 (A3 and C4 open on the claim), 11.5.5's C2 default, A3's last sentence | Math visible. No D-hole. A1 shows its loss. No screen contradicts its note | a day |
| 2 | 11.6.6 harness + the failing probes for every complaint (A3 ripple ≥ 15 % of its strip. Math button on-screen at 1366×768; A2's topbar without `100`. The fold table of 11.0) | The bar itself. Everything after is measured | a day |
| 3 | 11.6.1–4 (two-strip scope, legends off, anchoring everywhere, marks) | Plots 6 → 9.5 | a day |
| 4 | 11.4.1, 11.4.3–6 (split, overflow, knob order, phone) | Layout 5 → 9.5 | a day |
| 5 | 11.5.2–6 (path, intros, chips, reset) + 11.3.2–5 | Flow and delivery | a day |
| 6 | 11.2.1–3, 11.2.5 (B6 split, A2 rebuild, `try` lines, reading level) | Content 8 → 9.5 | a day |
| 7 | 11.1.1–5 (transient agreement, whole-space fuzz, pin-or-reason, sweep continuity, one propagator) | Rigour 9 → 9.5 | a day |
| 8 | Cold re-walk of all 20, re-score against the same rubric. Then Reed's pass | The number | half a day |

Seven and a half days. Group D waits behind it, because every group built
after this inherits the fixes and every group built before it would need
them retrofitted, four new topologies on the current shell would retrofit
all of it. The lab stays dark through step 3 at the least. Each step lands as
its own commit with its tests, pushed only when asked.

### 11.8 Step 8 as walked (2026-09-02)

All 22 experiments (Group B is eight since step 6) walked cold at 1366×768
and 1440×900 in Chromium and Firefox, every trace pill clicked, every
Analysis view opened, screenshots read one by one. Six things a student
would trip on were left, each now a test that failed first:

- **B1–B8 offered v_in, v_rect, v_D and i_R**, rectifier traces the buck has
  no waveform for. Clicking one drew nothing. The scope now offers only
  traces the circuit has (`review.test.jsx`).
- **The outcome chip was scrolled out of the top bar** on twelve experiments
  at 1366 and 1440, the strip scrolls sideways, so the overflow probe never
  saw it. The name chip is the only one that gives way. Below 1366 the chips'
  detail lines stack under their headings. Measured against `FLOW_BUDGET` in
  `review.test.jsx` and in the real layout at 1280/1366/1440 by verify §10b.
- **Firefox put B1, C1 and E1's first knob 7 px below the 768 fold**, its
  range inputs are 20 px tall and its `normal` line height 2 px taller;
  pinned in `styles.css`, verify §8 green in both browsers.
- **C2's rotated η axis title read as a stray mark**. A lone glyph stays
  upright (`draw.test.js`).
- **B5's zero-length dead interval** wrote "dea" at the frame edge and "dead"
  over the next "on". An edge is named only where the name fits.
- Verify §10b had been inserted with a syntax error and never ran. Fixed.

Deferred, cosmetic, not a trip: the sidebar schematic is small at 1366 (the
main-column copy is the one a reader studies). The phone sidebar's 45 vh cap
is the shared shell's.

**Re-score against the same rubric**, from the lists in 11.1–11.6 being
green plus this walk:

| Metric | Review | Now | What holds it |
|---|---|---|---|
| Physics rigour & correctness | 9 | 9.5 | walker vs solver at 2000/kind, 852 cells pinned or excused, sweeps continuous, one exponential (11.1 as built) |
| Information — content | 8 | 9.5 | B6 split, A2 rebuilt on RMS, every `try` line a measured claim, reading level tested |
| Information — delivery | 4 | 9.5 | note, schematic, first knob and Math all above the fold on all 22 in both browsers. No screen contradicts its note |
| Layout | 5 | 9.5 | weighted split, no overflow at four widths, the strip whole at 1280–1440, 390 px passes |
| Flow & intuition | 5 | 9 | path, intros, chips, reset, the last half-point is the newcomer's, per §11 |
| Plots | 6 | 9.5 | two strips, legends off, anchored axes, marks the note points at, edge names that fit |

The two "new student" metrics wait on Reed's hands-on pass for their last
half-point, as §11 says a model cannot give it.
