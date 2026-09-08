# RF Lab

35 working experiments in the local rollout. The app remains **dark**: a successful deployment serves its direct URL without adding a public splash-page card. This checkpoint does not claim the changes are already live.

A–D: 19 original line, matching and two-port experiments. E–H: 16 transistor, stability, noise, mixer/linearity and oscillator lessons.

New lessons follow the Circuit Elements learning structure: Start here with symbols and assumptions, Worked math with substitutions, Explore with parameter-linked plots/tables, and Practice with entered answers. Navigation stays anchored; equations and tables scroll internally on narrow screens. Circuit drawings can be enlarged where supplied.

## Model scope

Native hybrid-pi two-port and Smith constructions; cubic FFT intercepts are declined near compression. Leeson noise uses a stated sustaining-power convention. No transistor-level oscillator startup, nonlinear PA waveform or foundry RF model is claimed.

## Run and check

From the repository root:

```powershell
npm run dev --workspace apps/rf-lab
npx vitest run apps/rf-lab
npm run build --workspace apps/rf-lab
node scripts/verify-extended.mjs rf-lab
```

The browser check serves the built app under its actual lab path, walks every new lesson and all four views at 1440, 390 and 320 px, and checks math, tab geometry, page overflow, answer feedback and applicable drawing dialogs. `npm run site` assembles the full set of sibling apps for cross-lab link checks.
