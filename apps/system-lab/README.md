# System Lab

25 working experiments in the local rollout. The app remains **dark**: a successful deployment serves its direct URL without adding a public splash-page card. This checkpoint does not claim the changes are already live.

A: four receiver-chain foundations. B–F: 21 noise, linearity, dynamic-range, link-budget and design-trade lessons.

New lessons follow the Circuit Elements learning structure: Start here with symbols and assumptions, Worked math with substitutions, Explore with parameter-linked plots/tables, and Practice with entered answers. Navigation stays anchored; equations and tables scroll internally on narrow screens. Circuit drawings can be enlarged where supplied.

## Model scope

Independent native FFT and forward-noise checks support the budget equations. Random-phase power is an ensemble quantity, not a universally ordered intercept. The capstone exposes gain, NF, IP3 and power for the LNA, mixer and IF amplifier. Memoryless in-band blocks do not simulate a complete radio waveform.

## Run and check

From the repository root:

```powershell
npm run dev --workspace apps/system-lab
npx vitest run apps/system-lab
npm run build --workspace apps/system-lab
node scripts/verify-extended.mjs system-lab
```

The browser check serves the built app under its actual lab path, walks every new lesson and all four views at 1440, 390 and 320 px, and checks math, tab geometry, page overflow, answer feedback and applicable drawing dialogs. `npm run site` assembles the full set of sibling apps for cross-lab link checks.
