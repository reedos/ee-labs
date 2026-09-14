# Photonics Lab

25 working experiments in the local rollout. The app remains **dark**: a successful deployment serves its direct URL without adding a public splash-page card. This checkpoint does not claim the changes are already live.

21 original lessons plus B1–B4 on receiver noise, bandwidth, sensitivity and photon counting; the catalog places B between A and C.

New lessons follow the Circuit Elements learning structure: Start here with symbols and assumptions, Worked math with substitutions, Explore with parameter-linked plots/tables, and Practice with entered answers. Navigation stays anchored; equations and tables scroll internally on narrow screens. Circuit drawings can be enlarged where supplied.

## Model scope

One-sided noise densities, rectangular/effective noise bandwidth and OOK shot noise are explicit. Photon-counting and Gaussian thresholds are separate models rather than identical BER claims.

## Run and check

From the repository root:

```powershell
npm run dev --workspace apps/photonics-lab
npx vitest run apps/photonics-lab
npm run build --workspace apps/photonics-lab
node scripts/verify-extended.mjs photonics-lab
```

The browser check serves the built app under its actual lab path, walks every new lesson and all four views at 1440, 390 and 320 px, and checks math, tab geometry, page overflow, answer feedback and applicable drawing dialogs. `npm run site` assembles the full set of sibling apps for cross-lab link checks.
