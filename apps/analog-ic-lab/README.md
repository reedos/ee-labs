# Analog IC Lab

6 working experiments in the local rollout. The app remains **dark**: a successful deployment serves its direct URL without adding a public splash-page card. This checkpoint does not claim the changes are already live.

A1 continuous inversion law; A2 gm/ID ceiling; A3 sizing tradeoffs; A4 pair matching; A5 mirror mismatch; A6 short-channel corrections.

New lessons follow the Circuit Elements learning structure: Start here with symbols and assumptions, Worked math with substitutions, Explore with parameter-linked plots/tables, and Practice with entered answers. Navigation stays anchored; equations and tables scroll internally on narrow screens. Circuit drawings can be enlarged where supplied.

## Model scope

One consistent normalized-charge law determines current, overdrive and gm/ID. Matching coefficients describe pair mismatch. Cgs/fT are named approximations. Later groups and a general EKV network companion remain planned; this is not a PDK.

## Run and check

From the repository root:

```powershell
npm run dev --workspace apps/analog-ic-lab
npx vitest run apps/analog-ic-lab
npm run build --workspace apps/analog-ic-lab
node scripts/verify-extended.mjs analog-ic-lab
```

The browser check serves the built app under its actual lab path, walks every new lesson and all four views at 1440, 390 and 320 px, and checks math, tab geometry, page overflow, answer feedback and applicable drawing dialogs. `npm run site` assembles the full set of sibling apps for cross-lab link checks.
