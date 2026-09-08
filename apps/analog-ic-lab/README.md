# Analog IC Lab

11 working experiments across Groups A and B. The app remains **dark** (direct URL, no public splash-page card). Group A was introduced in merge 067c9c7; Group B extends that release. See [buildout progress](../../LAB_BUILDOUT_PROGRESS.md) for deployment verification.

A1 continuous inversion law; A2 gm/ID ceiling; A3 sizing tradeoffs; A4 pair matching; A5 mirror mismatch; A6 short-channel corrections.

B1 correlated process variation; B2 beta-multiplier bias; B3 bandgap slope and curvature; B4 startup root enumeration; B5 current-reference drift.

New lessons follow the Circuit Elements learning structure: Start here with symbols and assumptions, Worked math with substitutions, Explore with parameter-linked plots/tables, and Practice with entered answers. Navigation stays anchored; equations and tables scroll internally on narrow screens. Circuit drawings can be enlarged where supplied.

## Model scope

Group A uses one consistent charge-based device law. Group B explicitly uses a square-law beta-multiplier and an analytic junction-temperature reference. Startup is DC root enumeration, not a transistor-level startup transient. Parameter ensembles use the shared random package and report uncertainty. Groups C onward and a general EKV network companion remain planned.

## Run and check

From the repository root:

```powershell
npm run dev --workspace apps/analog-ic-lab
npx vitest run apps/analog-ic-lab
npm run build --workspace apps/analog-ic-lab
node scripts/verify-extended.mjs analog-ic-lab
```

The browser check serves the built app under its actual lab path, walks every new lesson and all four views at 1440, 390 and 320 px, and checks math, tab geometry, page overflow, answer feedback and applicable drawing dialogs. `npm run site` assembles the full set of sibling apps for cross-lab link checks.
