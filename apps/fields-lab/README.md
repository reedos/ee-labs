# Fields Lab

53 working experiments in the local rollout. The app remains **dark**: a successful deployment serves its direct URL without adding a public splash-page card. This checkpoint does not claim the changes are already live.

A–H: 36 original field experiments. I–L: 17 transmission-line, waveguide/cavity and antenna lessons.

New lessons follow the Circuit Elements learning structure: Start here with symbols and assumptions, Worked math with substitutions, Explore with parameter-linked plots/tables, and Practice with entered answers. Navigation stays anchored; equations and tables scroll internally on narrow screens. Circuit drawings can be enlarged where supplied.

## Model scope

Lossless arrival ladders and lossy frequency responses have separate validity limits. Antenna patterns and Friis links state their geometry and far-field assumptions. Original empty I–L group placeholders are superseded by extended.js and guideLessons.js in the combined main.jsx catalog.

## Run and check

From the repository root:

```powershell
npm run dev --workspace apps/fields-lab
npx vitest run apps/fields-lab
npm run build --workspace apps/fields-lab
node scripts/verify-extended.mjs fields-lab
```

The browser check serves the built app under its actual lab path, walks every new lesson and all four views at 1440, 390 and 320 px, and checks math, tab geometry, page overflow, answer feedback and applicable drawing dialogs. `npm run site` assembles the full set of sibling apps for cross-lab link checks.
