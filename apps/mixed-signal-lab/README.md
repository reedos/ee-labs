# Mixed-Signal Lab

6 working experiments in the local rollout. The app remains **dark**: a successful deployment serves its direct URL without adding a public splash-page card. This checkpoint does not claim the changes are already live.

A1 acquisition; A2 charge sharing; A3 signed injection and feedthrough; A4 kT/C; A5 bottom-plate phase order; A6 aperture jitter.

New lessons follow the Circuit Elements learning structure: Start here with symbols and assumptions, Worked math with substitutions, Explore with parameter-linked plots/tables, and Practice with entered answers. Navigation stays anchored; equations and tables scroll internally on narrow screens. Circuit drawings can be enlarged where supplied.

## Model scope

Ideal event charge projection is checked against finite resistance. Jitter is measured from an actual seeded sample record with uncertainty. Full converters, switched-capacitor synthesis and PLL groups remain planned in MIXED_SIGNAL_LAB_PLAN.md.

## Run and check

From the repository root:

```powershell
npm run dev --workspace apps/mixed-signal-lab
npx vitest run apps/mixed-signal-lab
npm run build --workspace apps/mixed-signal-lab
node scripts/verify-extended.mjs mixed-signal-lab
```

The browser check serves the built app under its actual lab path, walks every new lesson and all four views at 1440, 390 and 320 px, and checks math, tab geometry, page overflow, answer feedback and applicable drawing dialogs. `npm run site` assembles the full set of sibling apps for cross-lab link checks.
