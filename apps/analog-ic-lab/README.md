# Analog IC Lab

33 working experiments across Groups A–G. The app remains **dark** (direct URL, no public splash-page card). See [buildout progress](../../LAB_BUILDOUT_PROGRESS.md) for deployment verification.

A1 continuous inversion law; A2 gm/ID ceiling; A3 sizing tradeoffs; A4 pair matching; A5 mirror mismatch; A6 short-channel corrections.

B1 correlated process variation; B2 beta-multiplier bias; B3 bandgap slope and curvature; B4 startup root enumeration; B5 current-reference drift.

New lessons follow the Circuit Elements learning structure: Start here with symbols and assumptions, Worked math with substitutions, Explore with parameter-linked plots/tables, and Practice with entered answers. Navigation stays anchored; equations and tables scroll internally on narrow screens. Circuit drawings can be enlarged where supplied.

## Model scope

Group A uses one consistent charge-based device law. Group B explicitly uses a square-law beta-multiplier and an analytic junction-temperature reference. Startup is DC root enumeration, not a transistor-level startup transient. Parameter ensembles use the shared random package and report uncertainty. Groups H onward and a general EKV network companion remain planned.

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
