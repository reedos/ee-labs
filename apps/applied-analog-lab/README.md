# Applied Analog Lab

26 working experiments across Groups A–E. The app remains **dark** (direct URL, no public splash-page card). Group A was introduced in merge 067c9c7; Group B extends that release. See [buildout progress](../../LAB_BUILDOUT_PROGRESS.md) for deployment verification.

A1 amplifier classes; A2 active-filter GBW; A3 slew; A4 noise; A5 bias and temperature; A6 decoupling and a preamplifier budget.

B1 capacitive loading; B2 isolation and load accuracy; B3 photodiode input capacitance; B4 feedback compensation; B5 composite-loop stability.

New lessons follow the Circuit Elements learning structure: Start here with symbols and assumptions, Worked math with substitutions, Explore with parameter-linked plots/tables, and Practice with entered answers. Navigation stays anchored; equations and tables scroll internally on narrow screens. Circuit drawings can be enlarged where supplied.

## Model scope

Native nodal AC, broken-loop return ratios and state propagation check the stability models. TIA transient analysis eliminates the dependent Cf state explicitly. Crossover, feedback RC corner and closed-loop bandwidth are separate quantities. General sensitivity/synthesis tools and Groups F onward remain planned.

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
