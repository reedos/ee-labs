# Analog IC Lab

45 working experiments across Groups A–J. The app remains **dark** (direct URL, no public splash-page card). See [buildout progress](../../LAB_BUILDOUT_PROGRESS.md) for deployment verification.

A1 continuous inversion law; A2 gm/ID ceiling; A3 sizing tradeoffs; A4 pair matching; A5 mirror mismatch; A6 short-channel corrections.

B1 correlated process variation; B2 beta-multiplier bias; B3 bandgap slope and curvature; B4 startup root enumeration; B5 current-reference drift.

New lessons follow the Circuit Elements learning structure: Start here with symbols and assumptions, Worked math with substitutions, Explore with parameter-linked plots/tables, and Practice with entered answers. Navigation stays anchored; equations and tables scroll internally on narrow screens. Circuit drawings can be enlarged where supplied.

## Model scope

Group A uses one consistent charge-based device law. Group B explicitly uses a square-law beta-multiplier and an analytic junction-temperature reference. Startup is DC root enumeration, not a transistor-level startup transient. Parameter ensembles use the shared random package and report uncertainty. Groups I onward and a general EKV network companion remain planned.

## Run and check

From the repository root:

```powershell
npm run dev --workspace apps/analog-ic-lab
npx vitest run apps/analog-ic-lab
npm run build --workspace apps/analog-ic-lab
node scripts/verify-extended.mjs analog-ic-lab
```

The browser check serves the built app under its actual lab path, walks every new lesson and all four views at 1440, 390 and 320 px, and checks math, tab geometry, page overflow, answer feedback and applicable drawing dialogs. `npm run site` assembles the full set of sibling apps for cross-lab link checks.

C1 telescopic cascodes; C2 folded input/headroom comparison; C3 Miller compensation; C4 finite-bandwidth gain boosting; C5 output current near the rails; C6 complementary input-pair handover and ideal bias control. Architecture metrics use single-ended peak-to-peak swing consistently.

D1 differential feedback and common-mode bias drift; D2 exact differential/common half-circuits and consistent single-ended CMRR; D3 two independent feedback loops with four-state propagation and both Control Lab links; D4 resistive, follower and reset switched-capacitor sensor loading. The sampler conserves charge and solves a periodic track/hold state, including incomplete acquisition.

```powershell
node scripts/verify-differential.mjs
node scripts/verify-differential.mjs --live
```


## Group E — Compensation

E1 exact Miller poles and right-half-plane zero; E2 series nulling resistance and its extra state; E3 bandwidth/margin/current-budget tradeoffs; E4 three-stage nested Miller versus feedforward, with exact global poles and a conditional inner-loop diagnostic.

All lessons retain defined symbols, worked numerical LaTeX, parameter-driven plots, aligned tables and answer-entry practice. Run `node scripts/verify-group-e.mjs` against an assembled site, or add `--live` after publication.

## Group F

F1 finite-acquisition preamplifier gain and input-referred errors; F2 regeneration with explicit initial state; F3 native PWL Schmitt regions and output history; F4 unresolved probability and event rate, with corrected nanovolt units.

Run `node scripts/verify-group-f.mjs` against an assembled site, or add `--live` after publication. The same shared learning shell retains worked LaTeX, defined quantities, aligned tables, stable tabs, keyboard practice and enlarged circuit drawings.

## Group G

- **G1:** Explicit orientation VBE1+VBE3=VBE2+VBE4 gives I4=I1·I3/I2 for matched forward-active exponential junctions. Defaults give 40 µA. Saturation-current mismatch is retained in the product ratio and checked by the voltage-KVL residual. Base current, headroom and the diode-law minus-one term are omitted explicitly.
- **G2:** Bipolar tanh and long-channel MOS square-law steering are compared with their respective tangents at selectable compression. MOS full steering occurs at √2 VOV; bipolar full steering is asymptotic, so its reported reference is 99% steering.
- **G3:** A nonlinear signal pair and finite-tanh or hard-switched LO generate coherent sidebands and explicit tail-current-imbalance feedthrough. The 2/π factor is normalized to the signal-pair tangent gain, not total voltage gain. Signal Lab opens a clearly labeled ideal sine-multiplier comparison; it does not impersonate the nonlinear/hard-switched cell.
- **G4:** A translinear current-ratio cell gives gain Ic/Ir and exponential voltage control, linear in decibels before limiting. Available control current explicitly clips the requested gain. A single bounded differential-pair steering fraction is not used as an unbounded current-gain law.

## Group H

- **H1:** Native gm source, parallel Ro and capacitor. KCL gives finite DC gain gmRo=150, leakage pole, the exact unity crossing √(gm²−Ro⁻²)/(2πC), phase and zero-initial-state step. The ideal 1.591549 MHz crossing is a high-gain approximation.
- **H2:** Two explicit capacitor states, damping gd=gm2/q and output leakage at both nodes. Native AC, extracted transfer and state solution agree. Leakage changes both denominator coefficients: nominal and high-Q examples lose Q, while some low-Q cases gain Q as natural frequency moves. No universal sign is asserted. The complete second-order transfer crosses to Signal Lab after stated 1000× time scaling and bilinear frequency mapping.
- **H3:** A 512-member seeded ensemble uses explicitly bounded uniform common gm/C/R factors and separate slave mismatch. A 128-step bounded master calibration loop targets ug/c=1. Tuning-range clipping and unobserved slave mismatch remain as residual error. Exact reciprocal laws replace linearized spread claims; mean, sample SD and RMS target error are reported separately.
- **H4:** A fourth-order doubly terminated Butterworth LC ladder is converted into four normalized integrator states. Native LC AC verifies the state realization. A nominally identical two-biquad cascade is compared under separately declared component-error models. Local half-power-frequency and 0.5f0 gain sensitivities are distinguished from finite-perturbation passband error on a stated grid. No claim of universally lowest ladder sensitivity is made. Both pole pairs of the perturbed ladder are preserved through the scaled bilinear handover.

## Group I

- **I1:** A differential small-signal equivalent refers four independent physical channel-noise sources to the input. The loaded pair has power density 8kTγ(1+r)/gm; defaults give 12.871592 nV/√Hz before the explicitly referred second-stage term. Per-source powers agree with the native nodal noise solver. The second-stage equivalent uses gm2=500 µS and divides its power by first-stage gain squared; its share is calculated, not fixed to the draft percentage.
- **I2:** Four times gm halves first-stage noise at fixed load ratio. This costs four times current only at fixed gm/ID with resized geometry; a fixed-geometry strong-inversion comparison costs sixteen times current. Defaults at 800 µS and r=0.5 give 6.435796 nV/√Hz, correcting the draft 5.574 value. Per-device current, pair tail current and total-amplifier current are distinguished.
- **I3:** One device's gate-referred spectrum is 4kTγ/gm + Kf/(CoxWLf), with generic Kf=10^-25 V²F and Cox=8.63 fF/µm². The 10×1 µm corner is approximately 20.982 kHz; 40×2 µm lowers it by eight to approximately 2.62275 kHz. Eightfold area is 0.90309 decade, not one decade. White and flicker powers integrate over explicit positive frequency limits and agree with independent numerical integration.
- **I4:** The thermal target determines gm, then the same Group A charge law determines current and geometry. The pair mismatch model checks an independently editable offset-sigma target and reports pass/miss. Input lengths 1–5 µm keep all permitted combinations within the declared mismatch area floor. The noise-temperature knob changes noise temperature; the sizing process remains explicitly fixed at 300 K. First-stage thermal noise excludes later stages, flicker and external resistors.

Group J is implemented below. These lessons do not claim foundry extraction, layout matching, generic engine completion or a public-release gate.

## Group J

- **J1:** Remove Cgd, then compute H0=−gmRD, ZD=RS+RD+gmRSRD and ZN=−1/gm with dependent sources active. The restored transfer is H0(1−sCgd/gm)/(1+sCgdZD). Exact extra-element, native nodal, sinusoidal and capacitor-state routes agree. Defaults give a 113.682102 MHz pole and positive-real zero scale 1591.549431 MHz; the draft 114.3 MHz direct-solve discrepancy is removed. The initially uncharged capacitor state remains continuous while both node voltages jump, producing an inverse initial response.
- **J2:** The input-only Miller pole drops the RD time-constant contribution. Its overestimate is RD/[RS(1+gmRD)], exactly 40% at defaults. A 10% pole-error check changes the guidance. Magnitude and continuous phase plots retain the omitted zero; a passing pole estimate is not a full-response guarantee. The actual half-power crossing is calculated separately and is absent when fz≤√2fp.
- **J3:** The trim DAC uses explicitly symmetric midrise codes: L=2^b, Δ=2R/L, ck=−R+(k+1/2)Δ. The ±R endpoints are bin edges; an even code count has no zero level. Exact Gaussian code-cell moments include saturation tails. At 2.5 µm² and gm/ID=10, sigma=2.607681 mV and outside-range probability is 0.215598% for R=8 mV. Five bits give approximately 144.336 µV conditional in-range RMS but 154.418 µV total RMS; six bits give 88.102 µV total RMS. The draft 144/72 µV values describe a quantization approximation, not total population residual. A 5% check compares Δ/√12 with the conditional integrated result. The plot enlarges central bins so code steps remain visible.
- **J4:** One code is selected from actual offset plus a fixed measurement error at 25°C, then held unchanged. With additive offset drift α and fractional correction gain coefficient β, e(T)=u0−c0+(α−c0β)(T−25°C). Rounding, range overload, measurement error and drift remain distinct. Defaults store code 21 and give 133.5 µV residual at 85°C, 4.725 µV/K slope and 457.125 µV worst error over −40 to 125°C. The ±500 µV task has reachable pass/miss cases. A related-lesson link opens Mixed-Signal C6 at its own defaults; no circuit or trim-code mapping is claimed.

All ten planned Analog IC curriculum groups now have lessons (45 total). Broader reusable engine APIs, full release audits, reader sittings and public-release gates remain separate work. Direct-URL/unlisted status is retained.
