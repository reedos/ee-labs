# Applied Analog Lab

11 working experiments across Groups A and B. The app remains **dark** (direct URL, no public splash-page card). Group A was introduced in merge 067c9c7; Group B extends that release. See [buildout progress](../../LAB_BUILDOUT_PROGRESS.md) for deployment verification.

A1 amplifier classes; A2 active-filter GBW; A3 slew; A4 noise; A5 bias and temperature; A6 decoupling and a preamplifier budget.

B1 capacitive loading; B2 isolation and load accuracy; B3 photodiode input capacitance; B4 feedback compensation; B5 composite-loop stability.

New lessons follow the Circuit Elements learning structure: Start here with symbols and assumptions, Worked math with substitutions, Explore with parameter-linked plots/tables, and Practice with entered answers. Navigation stays anchored; equations and tables scroll internally on narrow screens. Circuit drawings can be enlarged where supplied.

## Model scope

Native nodal AC, broken-loop return ratios and state propagation check the stability models. TIA transient analysis eliminates the dependent Cf state explicitly. Crossover, feedback RC corner and closed-loop bandwidth are separate quantities. General sensitivity/synthesis tools and Groups C onward remain planned.

## Run and check

From the repository root:

```powershell
npm run dev --workspace apps/applied-analog-lab
npx vitest run apps/applied-analog-lab
npm run build --workspace apps/applied-analog-lab
node scripts/verify-extended.mjs applied-analog-lab
```

The browser check serves the built app under its actual lab path, walks every new lesson and all four views at 1440, 390 and 320 px, and checks math, tab geometry, page overflow, answer feedback and applicable drawing dialogs. `npm run site` assembles the full set of sibling apps for cross-lab link checks.
