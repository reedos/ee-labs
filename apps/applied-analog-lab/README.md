# Applied Analog Lab

45 working experiments across Groups A–I. The app remains **dark** (direct URL, no public splash-page card). Group A was introduced in merge 067c9c7; Group B extends that release. See [buildout progress](../../LAB_BUILDOUT_PROGRESS.md) for deployment verification.

A1 amplifier classes; A2 active-filter GBW; A3 slew; A4 noise; A5 bias and temperature; A6 decoupling and a preamplifier budget.

B1 capacitive loading; B2 isolation and load accuracy; B3 photodiode input capacitance; B4 feedback compensation; B5 composite-loop stability.

New lessons follow the Circuit Elements learning structure: Start here with symbols and assumptions, Worked math with substitutions, Explore with parameter-linked plots/tables, and Practice with entered answers. Navigation stays anchored; equations and tables scroll internally on narrow screens. Circuit drawings can be enlarged where supplied.

## Model scope

Native nodal AC, broken-loop return ratios and state propagation check the stability models. TIA transient analysis eliminates the dependent Cf state explicitly. Crossover, feedback RC corner and closed-loop bandwidth are separate quantities. General sensitivity/synthesis tools and Groups I onward remain planned.

## Run and check

From the repository root:

```powershell
npm run dev --workspace apps/applied-analog-lab
npx vitest run apps/applied-analog-lab
npm run build --workspace apps/applied-analog-lab
node scripts/verify-extended.mjs applied-analog-lab
```

The browser check serves the built app under its actual lab path, walks every new lesson and all four views at 1440, 390 and 320 px, and checks math, tab geometry, page overflow, answer feedback and applicable drawing dialogs. `npm run site` assembles the full set of sibling apps for cross-lab link checks.

C1 resistor matching and common-mode rejection; C2 three-amplifier instrumentation; C3 offset and temperature drift; C4 chopped offset and exact periodic ripple; C5 two-point calibration and the remaining error budget.

D1 reference temperature compensation; D2 LDO loop, ESR and two-state settling;
D3 supply rejection through pass, reference and amplifier paths; D4 dropout,
quiescent loss and thermal limits; D5 regulator selection with integrated noise,
ripple and aliasing. The LDO transfers its exact return ratio to Control Lab;
the selection lesson opens a validated ideal buck operating point in Power Lab.
The shared bandgap law is also used by Analog IC B3.

Additional regression checks:

```powershell
node scripts/verify-regulators.mjs
```

Run after `npm run build` and `npm run site`. This checks diagrams, model
boundaries and both cross-lab handovers at desktop and mobile widths.


## Group E — Sensor front ends

E1 high-side resistor-ratio leakage versus specified CMRR; E2 Kelvin sensing versus physical return lift; E3 RTD lead error and electrothermal warm-up; E4 nonlinear type K cold-junction correction; E5 Butterworth passband/stopband design.

All lessons retain defined symbols, worked numerical LaTeX, parameter-driven plots, aligned tables and answer-entry practice. Run `node scripts/verify-group-e.mjs` against an assembled site, or add `--live` after publication.

## Group F

F1 Butterworth order from both mask edges; F2 Chebyshev ripple; F3 equal-half-power Bessel/Butterworth delay and state response; F4 Sallen–Key sensitivities and seeded independent-uniform tolerances; F5 exact finite-bandwidth SK/MFB nodal responses and a retuned fourth-order mask exercise.

Run `node scripts/verify-group-f.mjs` against an assembled site, or add `--live` after publication. The same shared learning shell retains worked LaTeX, defined quantities, aligned tables, stable tabs, keyboard practice and enlarged circuit drawings.

## Group G

- **G1:** Constant-drop clamps to ±12 V with VF=0.3 V. At +100 V, 1 kΩ carries 87.7 mA; 8.77 kΩ meets the exercise's 10 mA limit. Native PWL verifies both polarities and zero-current boundaries. Rectangular pulse energy, 20 kHz resistor noise and 100 nA bias error are separate quantities.
- **G2:** ±5 V rails, 0.65 V junction drops and a separately declared ±4.5 V signal range. The 5.2 V case has no clamp current but is outside the signal range. No latch-up or phase-reversal behavior is claimed.
- **G3:** 100 mA through 10 mΩ gives 1 mV remote-ground lift. A 100 dB differential receiver has 10 nV incremental error from that lift; the baseline signal common-mode contribution is calibrated out.
- **G4:** Cc=CL=100 pF/m, source resistance, amplifier A(s)=ωt/s and output resistance define the full driven-shield circuit. Both KCL equations retain source bootstrapping. Closed cubic poles and Routh's criterion determine stability; unstable settings do not report operating bandwidth. The fixed 0.99 tracking example is hypothetical. Control Lab receives the exact third-order return ratio, distinct from the source-to-signal transfer.

## Group H

- **H1:** Ideal 555 latch/threshold events, exact RC propagation and capacitor continuity. Defaults give recurring high/low times 138.629/69.315 µs, 4.808983 kHz and 66.667% duty. Uncharged startup has a different first high pulse, ln3·(RA+RB)C. Comparator delays and finite discharge resistance are omitted.
- **H2:** Brief trigger, released before timeout, and a stated initial capacitor voltage. Pulse width is RC·ln[(VCC−v0)/(VCC/3)]. At v0=0, ln3·RC=1.098612 ms; 1.1RC is a rounded approximation. Post-timeout discharge and held-trigger/retrigger behavior are not modeled.
- **H3:** RMS sine amplitude and a unit-RMS √2 cosine reference make the in-phase DC output Vs·cosφ. A first-order low-pass has ENBW=1/(4τ), not its −3 dB corner. Finite input-band edges are retained in the noise integral. Defaults give approximately −10 dB input and 40 dB aligned output SNR. Startup baseband settling, residual 2f ripple and a seeded stationary noise draw are separated; no guaranteed per-draw 1% recovery is claimed.
- **H4:** An explicit local VBE(I,T) law with −2 mV/K fixed-current coefficient, matched two-junction bias, sensor tracking and emitter degeneration. The reference fixed-bias, zero-degeneration logarithmic current slope is approximately 7.736%/K at 300 K. KVL gives current; differentiation gives the local thermal-loop criterion. Increasing current under an imposed temperature is not by itself a runaway simulation.
- **H5:** Exact sine-cycle class-B load/supply/device power. Worst average device heating is VCC²/(π²RL)=5.066059 W at Vm=2VCC/π and **50% efficiency**. The 40.53% figure is output power relative to full scale. The 20 W design task checks worst-amplitude temperature plus a declared illustrative 3 A / 60 V / 15 W instantaneous envelope. Real transistor SOA, reactive loading, thermal lag and shared heatsinks remain outside this model.

## Group I

- **I1:** Normalized sensitivities are derived from the ideal non-inverting gain and unity-follower Sallen–Key denominator, with numeric substitutions and finite-change comparisons. Natural-frequency sensitivities are −1/2 for all four passives. At matched resistors, Q sensitivities are 0, 0, +1/2, −1/2 in R1/R2/C1/C2 order.
- **I2:** All sixteen passive-box vertices are evaluated at the selected GBW. Ideal f0 bounds follow from a monotonicity proof; finite-follower cutoff uses the full cubic and is described as a vertex search, not a certified global bound. A Q face check demonstrates an interior maximum at R1=R2. Native nodal solves verify the cubic at every vertex, including 0.5–1.5 MHz GBW.
- **I3:** Seeded Gaussian component ensembles (200–10,000 circuits, default 2,000) compare exact ideal-circuit outputs with linearized errors. Three-sigma spread t gives sigma_f=t/3 and sigma_Q=t/(3√2). Empirical quantiles, estimator uncertainty and a measured linearization-residual check accompany the estimates. A residual above 1% of predicted sigma changes the conclusion. A Gaussian has no hard box; exact corner events have zero probability. The draft two-million-run and corner-probability claims are not live measurements and are superseded.
- **I4:** Frequency, Q and joint pass counts include pointwise 95% Wilson intervals, including zero-failure cases. The analytic product is justified only for independent, equal-variance Gaussian component errors propagated to first order. Default analytic yields are 99.7300204%, 96.6105146% and 96.3496860%; exact nonlinear joint yield is measured directly. A sample count and seed accompany every estimate.
- **I5:** Separate 741, 555, LM317 and NE5532 calculations identify source fields and approximations. TI's LM741 product table supplies typical 1 MHz GBW (90.9091 kHz ideal gain-11 estimate); ideal timer thresholds give 4.808983 kHz. LM317 typical 50 µA adjust current raises 5.000 V to 5.036 V. TI NE5532 SLOS075K specifies typical 5 V/µs, giving 79.5775 kHz at 10 V peak; extending its 5 nV/√Hz white density over 20 kHz gives 0.707107 µV rms. The draft 9 V/µs value is not attributed to this revision.

All nine curriculum groups now have lessons. Generic reusable method-engine APIs, expanding every earlier design exercise into an editable specification, the full release audit and reader sittings remain separate planned work; this implementation does not claim those gates are complete.
