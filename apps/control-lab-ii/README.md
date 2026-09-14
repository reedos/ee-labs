# Control Lab II

35 working experiments in the local rollout. The app remains **dark**: a successful deployment serves its direct URL without adding a public splash-page card. This checkpoint does not claim the changes are already live.

32 original lessons plus F3–F5: covariance recursion, steady-state estimator and Monte Carlo verification.

New lessons follow the Circuit Elements learning structure: Start here with symbols and assumptions, Worked math with substitutions, Explore with parameter-linked plots/tables, and Practice with entered answers. Navigation stays anchored; equations and tables scroll internally on narrow screens. Circuit drawings can be enlarged where supplied.

## Model scope

The statistical extension uses position/velocity states, independent acceleration disturbances, position measurements, Joseph covariance updates and Gaussian variance intervals. Sensor-noise mismatch demonstrates overconfidence. Earlier deterministic observer examples remain available.

## Run and check

From the repository root:

```powershell
npm run dev --workspace apps/control-lab-ii
npx vitest run apps/control-lab-ii
npm run build --workspace apps/control-lab-ii
node scripts/verify-extended.mjs control-lab-ii
```

The browser check serves the built app under its actual lab path, walks every new lesson and all four views at 1440, 390 and 320 px, and checks math, tab geometry, page overflow, answer feedback and applicable drawing dialogs. `npm run site` assembles the full set of sibling apps for cross-lab link checks.
