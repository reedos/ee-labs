# Power Lab — the plan

A fourth lab for the suite: **power electronics**, from "why switch at all" through
converters, magnetics, rectifiers, inverters, losses, and closing the loop. Splash
glyph ⚡, directory `apps/power-lab`, engine in a new `packages/switched`.

Decisions already made (Reed, 2026-09-01):

- **Larger scope.** DC-DC, magnetics, AC-DC, DC-AC, losses, and the control bridge
  are all in. Phasing orders them; nothing here is cut.
- **Ideal first, non-idealities as labelled toggles.** Every ideal claim gets its
  exact closed form; every non-ideality (R_on, V_f, ESR, switching time, saturation)
  is a switch the reader flips to watch the ideal claim bend, with the panel naming
  what bent it. Ideal-vs-real is the suite's best genre; here it is the whole genre.
- **Magnetics in scope**, including saturation and the flyback.
- **Name: Power Lab.**

The suite's one rule applies with no exemptions: **every explanatory sentence is a
claim about physics, and a test must measure it.** Power electronics is unusually
rich in closed forms, so this lab can be *more* pinned than the others, not less.

---

## 1. The engine: exact piecewise-LTI simulation (`packages/switched`)

### 1.1 Why not a generic ODE solver

Everything in the suite today is LTI. A converter changes topology mid-cycle, which
usually pushes projects into generic timestep simulation — and then every waveform
carries numerical mush the tests cannot tell from physics. We refuse that. The key
observation: **within one switch state, a converter IS a small LTI system**, and for
the 1–3 state systems here, the segment solution has a closed form. No timestep, no
drift, no tolerance knob. The waveform is exact to floating point, which is what
lets a test assert `volt-second balance = 0` rather than `≈ 0 within solver slop`.

### 1.2 The propagator

State x (e.g. `[i_L, v_C]`), constant input u within a segment:

    dx/dt = A x + B u
    x(t)  = φ0(t)·x(0) + φ1(t)·B u,   φ0 = e^{At},   φ1(t) = ∫₀ᵗ e^{Aτ} dτ

For 2×2, write s = tr(A)/2, Δ = s² − det(A). Then with

    Δ > 0:  c(t) = cosh(√Δ t),  σ(t) = sinh(√Δ t)/√Δ        (overdamped)
    Δ < 0:  c(t) = cos(√−Δ t),  σ(t) = sin(√−Δ t)/√−Δ       (ringing)
    Δ = 0:  c(t) = 1,           σ(t) = t                     (critical)

    e^{At} = e^{st} · ( c(t)·I + σ(t)·(A − sI) )

φ1 is the same case analysis with the scalar functions integrated — **no A⁻¹
anywhere**, so a singular A (an inductor across a source, a bare RC hold state)
needs no special-casing. This mirrors the biquad's three-case discriminant handling
already in `@ee-labs/dsp`, and it will be tested the same way: against `expm` by
series at random matrices, and against the physics.

1-state segments (rectifier hold intervals) are scalar exponentials; a 3-state
topology (flyback with leakage, Ćuk if ever) falls back to eigendecomposition with
a balancing step — `@ee-labs/systems` already owns balanced eigen machinery.

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
  are conduction angles. Same shooting on (x₀, angles); rectifiers converge fast.
- **Transients on demand**: the same propagator runs forward from any x₀, so step
  loads / duty steps for the control experiments reuse the machinery unchanged.

**Affordability gates** (a Control Lab lesson, learned the hard way): cap events
per render (~20k) and per-frame solve work; when a setup exceeds it, the pane says
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
waveform: cycle average, true RMS (piecewise closed-form integrals — no sampling
error), peak/valley, peak-to-peak ripple, per-device conduction intervals and
average/RMS currents, P_in, P_out, per-mechanism losses, η, THD (against
`@ee-labs/dsp` FFT as an independent check), displacement and distortion power
factor.

### 1.7 Invariants (the fuzzer's checklist)

Fuzzed across the whole component/duty/frequency space, these must hold:

1. **Volt-second balance**: ⟨v_L⟩ = 0 over a steady-state period, per inductor.
2. **Charge balance**: ⟨i_C⟩ = 0 per capacitor.
3. **Energy**: ideal, P_in = P_out to fp precision; with losses, P_in = P_out +
   Σ losses *as an identity* (losses are integrals of the same exact waveform).
4. **Continuity**: M(D) continuous across the CCM/DCM boundary; waveforms
   continuous across every event.
5. **Consistency**: closed-form RMS/avg vs dense numerical integration; FFT
   fundamental vs analytic Fourier coefficient.
6. **Steady state is steady**: propagating x_ss one more period returns x_ss.

---

## 2. Models

### 2.1 Topologies (switch-state machines)

Each topology = a list of states with (A, B) per state + transition rules + device
annotations for the scrub view.

| Topology | States | Segments (CCM) | Extra events |
|---|---|---|---|
| PWM chopper into R (no filter) | — (memoryless) | on/off | — |
| Buck | i_L, v_C | Q on / D on | i_L→0 (DCM), sync-FET mode |
| Boost | i_L, v_C | Q on / D on | i_L→0 (DCM) |
| Buck-boost (inverting) | i_L, v_C | Q on / D on | i_L→0 (DCM) |
| Flyback | i_M, v_C (+ i_lk stretch) | Q on / D on | i_M→0 (DCM), clamp (stretch) |
| Half-wave rectifier + C | v_C | D on / hold | v_in > v_C + V_f (on), i_D→0 (off) |
| Bridge rectifier + C | v_C | pair A / pair B / hold | conduction angles |
| Phase-cut dimmer (triac, R load) | — | blocked / conducting | fire at α, i→0 |
| Square-wave inverter + LC + R | i_L, v_C | +V_dc / −V_dc | — |
| Sine-PWM inverter (full bridge) + LC + R | i_L, v_C | ±V_dc per PWM edge | — |

Conversion-ratio closed forms to pin (K = 2Lf_s/R):

    Buck:        M = D                    DCM: M = 2/(1+√(1+4K/D²)),   K_crit = 1−D
    Boost:       M = 1/(1−D)              DCM: M = (1+√(1+4D²/K))/2,   K_crit = D(1−D)²
    Buck-boost:  M = −D/(1−D)             DCM: M = −D/√K,              K_crit = (1−D)²
    Flyback:     M = n·D/(1−D)  (n = Ns/Np)

Ripple closed forms (CCM, ideal):

    Buck:   ΔI_L = V_o(1−D)/(L f_s)          ΔV_o = ΔI_L/(8 f_s C)
    Boost:  ΔI_L = V_in·D/(L f_s)            ΔV_o = V_o·D/(R C f_s)
    (…and the reason they differ: the buck's cap sees a triangle, the boost's cap
     sees the load current chopped away entirely during DT — see G3.)

### 2.2 Non-idealities — each a toggle, each labelled

| Toggle | Enters as | The claim it bends, and how |
|---|---|---|
| MOSFET R_on | series R in the on-state A matrix | M droops; conduction loss I²_rms·R_on appears |
| Diode V_f (+ r_d) | affine offset in the diode-state B | M drops by V_f·(interval share); loss V_f·I_avg + r_d·I²_rms; the sync-rectifier lesson |
| Inductor ESR R_L | series R in every state | **boost's M(D) peak**: M = D′/(D′² + R_L/R), max 1/(2√(R_L/R)) at D′ = √(R_L/R) — the reason D→1 gives smoke, not infinity |
| Capacitor ESR | output v = v_C + ESR·i_C | ripple gains a square edge on top of the triangle; ESR heating I²_C,rms·ESR |
| Switching time t_sw | loss term ½·V·I·(t_r+t_f)·f_s (loss-model, not waveform, and the panel says so) | η vs f_s bends over; the frequency tradeoff |
| Source/diode resistance R_s (rectifiers) | series R while conducting | conduction angle, peak-current spikes. *Load-bearing*: an ideal diode straight into a capacitor is ill-posed (infinite current), and the lesson says exactly that — the resistance is not a blemish, it is why the circuit computes |
| Saturation I_sat, L_sat | **piecewise-linear inductance**: L above/below \|i\| = I_sat, crossing = an event | keeps the piecewise-LTI framework *exact through saturation*; the current runaway cliff in D2 |

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

- **Scope** — multi-trace over 1–4 switching periods (or 1–2 line cycles): switch
  node, i_L, v_out ripple (AC-coupled option), device currents. **Dual y-axis**
  (V left, A right — the `rightAxis` pattern from Bode). Reuses the caption-band
  and reconstruction honesty rules from Signal Lab's scope.
- **The conduction scrub** — the lab's signature. A Circuit-Lab-style schematic
  with the conducting path lit, scrubbed through one period in lockstep with a
  cursor on the scope (ConvolutionCanvas's scrub pattern). Event names appear at
  their instants ("D turns off — the inductor ran dry"). *What is conducting right
  now* is the question every student is silently asking; this view answers it.
- **Spectrum** — reused from `@ee-labs/dsp`, for line current (E4), PWM output
  (F3), and ripple.
- **M(D) curve** — conversion ratio vs duty with the CCM region, DCM region
  (per current load) shaded, the operating point sitting on it, and the ideal
  curve ghosted when a non-ideality bends the real one (C2's money shot).
- **Efficiency sweep** — η vs load (G2) and η vs f_s (G1), operating point marked.
- **Loss ledger** — where the watts went: per-mechanism table summing exactly to
  P_in − P_out (it is an identity; the test asserts it).
- **B-H / flux view** (Group D) — flux excursion against the B_sat ceiling.

### 3.3 Numbers (defaults that make the lessons visible)

Chosen so ripple is *visible on screen* while formulas stay exact — pedagogy over
datasheet fashion, stated in the notes:

- Buck: 12 V → 5 V (D = 0.417), L = 100 µH, C = 100 µF, R = 5 Ω, f_s = 100 kHz.
- Boost: 5 V → 12 V (D = 0.583), L = 100 µH, C = 220 µF, R = 24 Ω, f_s = 100 kHz.
- Rectifiers: 120 V/60 Hz line, 12.6 V transformer secondary, R_s = 0.5 Ω,
  C = 100–4700 µF, load 10 Ω–1 kΩ.
- Inverter: V_dc = 48 V full bridge, f₁ = 60 Hz, f_sw = m_f·f₁ with m_f ∈
  {15, 33, 63} (odd, triplen-avoiding options later), LC = 1 mH/10 µF.

---

## 4. Curriculum — 34 experiments in 8 groups

Format per experiment: **the claim** the note makes → what the reader turns → what
is **measured** against what **formula**. Every quoted number below becomes a
pinned test the way `presets.test.js` pins Signal Lab.

### Group A — Why switching (3)

- **A1 · The regulator that is a resistor.** A linear regulator dropping 12 V to
  5 V at 1 A is a 7 W heater wearing a heatsink: η = V_o/V_in = 41.7%, *independent
  of how cleverly it is built*. Measured: P_pass = (V_in−V_o)·I, η. The number the
  whole lab exists to beat.
- **A2 · A switch pays (almost) nothing.** PWM a 12 V source into a resistor at
  D = 0.42: the average is D·V_in = 5 V but the RMS is √D·V_in = 7.8 V — mean and
  RMS part company the moment a waveform stops being flat (the suite's oldest
  lesson, now with consequences: heat follows RMS², not mean²). Measured: both,
  against DV and √D·V. And the switch itself: V≈0 when on, I=0 when off — the
  product that is power never gets a chance.
- **A3 · The LC does the averaging.** Insert the filter: the load now sees the
  mean, not the chop. The filter is a 2nd-order low-pass with f₀ = 1/(2π√(LC))
  two decades under f_s — the ripple that leaks is the harmonics that survive.
  Measured: ripple vs the closed form; f₀ against Circuit Lab's own formula.

### Group B — The buck (6)

- **B1 · Volt-second balance.** In steady state an inductor's average voltage is
  exactly zero — otherwise its current would walk. The triangle explained from
  ⟨v_L⟩ = 0: V_on·DT = V_off·D′T, i.e. (V_in−V_o)·D = V_o·(1−D). Measured: ⟨v_L⟩
  (must be 0 to fp), and the up/down slopes (V_in−V_o)/L and −V_o/L individually.
- **B2 · V_out = D·V_in.** Drag D; the measured line sits on the prediction until
  a non-ideality toggle bends it — and the panel shows the corrected form with the
  correction visible.
- **B3 · Ripple, priced.** ΔI_L = V_o(1−D)/(L f_s), ΔV_o = ΔI_L/(8 f_s C) — the 8
  derived in the panel (the cap integrates the triangle's positive half: two
  quarter-periods of a triangle → T/2·(ΔI/4)/2). Double L, halve ripple; double
  f_s, halve it again — measured at each step.
- **B4 · Running dry: DCM.** Lighten the load until i_L touches zero: a third
  interval appears (both switches off — the scrub shows the dead circuit), and M
  detaches from D: M = 2/(1+√(1+4K/D²)), K = 2Lf_s/R. Measured against that form.
- **B5 · The boundary, continuously.** Sweep the load across K = 1−D: CCM and DCM
  formulas meet without a seam. A claim about the *formulas*, tested as continuity
  of the measured M while the mode chip flips.
- **B6 · The diode's rent.** Ideal: η = 100%. Toggle V_f = 0.7 V: at V_o = 5 V the
  diode conducts D′ of the time and η ≈ V_o/(V_o + D′·V_f) — measured. Swap in a
  synchronous FET (R_on): the rent drops from a fixed 0.7 V to I·R_on, and the
  low-V_out story (why your phone's converters are all synchronous) tells itself.

### Group C — Boost & buck-boost (5)

- **C1 · 1/(1−D).** The inductor charges from V_in, then *stacks on top of it*.
  M = 1/(1−D) measured; the panel derives it from ⟨v_L⟩ = 0 in two lines.
- **C2 · The peak ideal theory misses.** Toggle inductor ESR: M = D′/(D′²+R_L/R),
  peaking at M_max = ½·√(R/R_L) at D′ = √(R_L/R), then *falling* — the ideal curve
  ghosted behind the real one. Measured peak location and height against those
  closed forms. Why "just increase D" ends in smoke.
- **C3 · Boost runs dry too.** DCM with M = (1+√(1+4D²/K))/2, K_crit = D(1−D)².
- **C4 · The inverting bucket.** Buck-boost: the inductor alone ferries energy;
  input and output never touch. M = −D/(1−D) measured; the scrub shows charge
  interval and dump interval sharing no path.
- **C5 · All the energy through one part.** In the buck, (1−D) of the power flows
  straight through; in the buck-boost, every joule is lifted by L: E_cycle·f_s =
  P_o exactly in DCM, and the inductor's mass budget follows. Measured: ½L(i_pk²−
  i_min²)·f_s against P_o + the CCM direct-path accounting.

### Group D — Magnetics (4)

- **D1 · Volt-seconds are flux.** ΔB = ∫v dt/(N·A_e). Same volt-seconds at 60 Hz
  and 100 kHz differ by ~1600× in flux excursion — why the line transformer is
  iron you can barely lift and the flyback transformer fits on a fingertip.
  Measured: ΔB from the integral vs the closed form per waveform.
- **D2 · Saturation: the cliff.** Raise the load or drop f_s until i_pk crosses
  I_sat: L collapses (piecewise-L event), di/dt multiplies, the current spikes —
  runaway *shown exactly*, not hand-waved. The B-H view shows the excursion
  hitting the ceiling. Measured: event location vs B_sat·N·A_e/L.
- **D3 · The flyback: a buck-boost with a passport.** Same two intervals, but the
  energy crosses an isolation barrier and the turns ratio n rescales everything:
  M = nD/(1−D); reflected voltage n·V_o across the switch. Why it owns every
  low-power offline supply.
- **D4 (stretch) · Leakage strikes.** The flux that does not link both windings
  has nowhere to go at turn-off: the spike, and why clamps exist. Third state
  (i_lk); qualitative if the exact model proves heavy.

### Group E — AC in: rectifiers (5)

- **E1 · Half-wave + capacitor.** Conduction only while v_in exceeds v_C: short
  gulps near each crest. Ripple ≈ I_load/(f·C) (first-order, and the panel says
  it is first-order and shows the exact value beside it).
- **E2 · The bridge.** Four diodes, both half-cycles: ripple frequency doubles,
  ripple ≈ I/(2fC), and the two-diode V_f rent appears in the measured DC value.
- **E3 · The price of big C.** Grow C: smoother output, *narrower and taller*
  current gulps — conduction angle shrinks, peak and RMS diode current grow for
  the same average. Measured: conduction angle, i_pk, i_RMS/i_avg vs C.
- **E4 · What the grid sees.** Spectrum of the line current: odd harmonics
  everywhere. PF = (I₁,rms/I_rms)·cos φ₁ — mostly *distortion*, not displacement:
  a rectifier can have cos φ₁ ≈ 1 and PF ≈ 0.6. Measured: PF two ways (P/(V_rms
  I_rms) and the harmonic decomposition — they must agree), THD vs FFT.
- **E5 · The dimmer.** Phase-cut at angle α into a resistive load:
  P/P_full = 1 − α/π + sin 2α/(2π), measured across the α sweep — plus the
  harmonic price, which is why cheap dimmers buzz.

### Group F — DC out as AC: inverters (4)

- **F1 · The square-wave inverter.** Signal Lab's square wave, now carrying watts:
  fundamental rms = (4/π)V_dc/√2, THD = √(π²/8 − 1) = 48.3% — measured both by
  closed-form Fourier and by FFT, which must agree. The filtering problem stated.
- **F2 · Sine PWM.** Compare a sine at m_a to a triangle at m_f: the pulse widths
  breathe. Fundamental peak = m_a·V_dc (full bridge, m_a ≤ 1) — measured across
  the m_a sweep, and the overmodulation departure beyond m_a = 1 shown honestly.
- **F3 · The spectrum has families.** Baseband fundamental, then sideband
  clusters around m_f, 2m_f, … — the LC filter's job is to keep the families and
  surrender the fundamental. Measured: cluster locations, filter attenuation at
  m_f vs Circuit Lab's |H|.
- **F4 · THD vs effort.** Sweep f_sw: output THD falls as the families retreat
  from the filter corner — and Group G will price the same sweep in switching
  loss. One tradeoff, seen from both sides.

### Group G — Losses & efficiency (4)

- **G1 · Conduction vs switching.** P_cond ∝ I²_rms·R_on (flat in f_s);
  P_sw ≈ ½V·I·(t_r+t_f)·f_s (linear in f_s): η(f_s) bends over exactly where they
  cross — measured crossover vs the closed form. Why faster is smaller (D1's flux
  argument) but not free.
- **G2 · The efficiency curve.** η vs load: fixed losses dominate at light load,
  I² losses at heavy; peak where they are equal (measured against P_fixed =
  P_I² point). The curve on every datasheet, explained rather than shown.
- **G3 · The capacitor's hidden heater.** Same load, same ripple spec: the buck's
  output cap carries a small triangle; the boost's carries the *entire chopped
  load current* — I_C,rms differs by an order. ESR toggle turns it into heat on
  screen. Measured: both RMS currents vs closed forms.
- **G4 · Where the watts went.** The loss ledger: every mechanism, summing to
  P_in − P_out as an identity. The reader toggles mechanisms and watches the
  ledger re-balance — bookkeeping as pedagogy.

### Group H — Closing the loop (3)

- **H1 · The averaged model.** Overlay: the smooth averaged trajectory threading
  the exact switching waveform through a load step. Where averaging is honest
  (f ≪ f_s) and where it is blind (the ripple it discards).
- **H2 · The buck is a plant.** G_vd(s) closed form; **hand over to Control Lab**
  (`plant=custom:…` — the grammar exists). Close the loop there; come back and
  verify the closed-loop step against the switched truth.
- **H3 · The zero in the wrong half.** Boost: step D upward and V_o *dips first*
  (the inductor must divert energy before it can deliver more) — the RHP zero at
  ω_z = D′²R/L, measured from the switched transient's initial undershoot, then
  handed to Control Lab to see the bandwidth ceiling it imposes. The lab's best
  single moment: a nonminimum-phase zero you can watch happen in a circuit.

---

## 5. Hand-overs

| Direction | Payload | Mechanism |
|---|---|---|
| Power → Control | averaged G_vd for buck/boost/buck-boost, provenance-labelled | existing `plant=custom` + `from=` link grammar |
| Power → Circuit | the output filter as the RLC it is | existing `b=`/`src=` grammar, low effort |
| Power ↔ Signal | spectra live inside Power Lab (reused dsp) — square-inverter and band-limited-square lessons cross-reference by name in notes | prose links, no new grammar |

No new link grammar in v1 — the hand-over territory belongs to the parallel
session's fidelity work, and `plant=custom` already carries coefficients exactly.

## 6. Testing discipline

- **Closed-form pins**: every formula quoted in §2 and §4 (M, ripple, boundaries,
  THD 48.3%, PF identity, dimmer power, ω_z, efficiency crossover…) asserted
  against the exact engine, at the preset's numbers and under fuzz.
- **Invariant fuzz** (§1.7) across component/duty/frequency space, including
  hostile corners (D→0, D→1, K near critical, saturation boundary).
- **Triple agreement**: closed-form steady state vs long transient vs averaged
  model, wherever each claims validity — disagreement fails the build.
- **Independent cross-checks**: RMS/avg by piecewise closed form vs dense
  integration; Fourier coefficients vs `@ee-labs/dsp` FFT (two codebases, one
  answer).
- **Note claims pinned** like `presets.test.js`: every number in an experiment
  note is a test.
- **Browser verify**: Chromium + Firefox pixel checks of scope geometry, scrub
  sync, mode chip, and gate messages; probes must measure the claim, not a proxy
  (see the caption-plate lesson).
- **readme-claims**: splash card count, README tables, pinned as the other labs.

## 7. Integration

- `LabNav` LABS array + splash card (⚡, "34 experiments" pinned by test) +
  deploy workspace entry + `report.js` summary (converter, components, toggles,
  D, f_s, mode) + AGENT_BRIEF.md for future sessions.
- New app + new package = naturally conflict-free territory alongside the
  parallel session; shared-file touches (LabNav, splash, deploy config) batched
  late and small.

## 8. Phasing (each phase ships green and deployable)

1. **Engine**: `packages/switched` propagator + events + steady state + measures,
   fully fuzzed *before any UI exists*. Exit: invariants 1–6 green under fuzz.
2. **Buck vertical slice**: app shell, scope, math panel, meters; Groups A + B
   (9 experiments). Exit: every B-note pinned; browser verify green.
3. **Boost/buck-boost + conduction scrub + M(D) view**: Group C. Exit: C2 peak
   formula pinned; scrub-vs-scope sync pixel-verified.
4. **Magnetics**: piecewise-L saturation events, B-view, flyback; Group D.
5. **AC**: rectifiers + dimmer (Group E), then inverters + PWM spectra (Group F).
6. **Losses + control bridge + integration**: Groups G, H; loss ledger,
   efficiency sweeps, Control Lab hand-over round-trip; splash/nav/report;
   **then the full-suite audit treatment** — the same all-angles pass the other
   three labs got, before it ships on the splash page.

## 9. Non-goals (v1, stated so they are decisions rather than omissions)

Three-phase, motor drives, resonant/LLC converters, current-mode control loops
*inside* Power Lab (the loop lives in Control Lab — that is the point of the
bridge), EMI/layout, thermal RC networks, digital control/DPWM. Each is a
coherent later group; none blocks the curriculum above.

## 10. Risks, named

- **DCM shooting robustness** at hostile corners → bisection fallback + gate
  with reason (never a frozen tab, never silent wrongness).
- **Dual-axis scope legibility** → the one genuinely new UI idiom; prototype
  early in Phase 2 with the caption-band rules applied from day one.
- **Scrub-schematic authoring cost** per topology → schematic definitions data-
  driven from the same topology tables the engine uses, so a circuit and its
  picture cannot drift apart.
- **Scope creep in Group D** → D4 pre-marked stretch; saturation ships, leakage
  may slip.
