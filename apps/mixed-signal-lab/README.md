# Mixed-Signal Lab

12 working experiments across Groups A and B. The app remains **dark** (direct URL, no public splash-page card). Group A was introduced in merge 067c9c7; Group B extends that release. See [buildout progress](../../LAB_BUILDOUT_PROGRESS.md) for deployment verification.

A1 acquisition; A2 charge sharing; A3 signed injection and feedthrough; A4 kT/C; A5 bottom-plate phase order; A6 aperture jitter.

B1 switched-capacitor resistance; B2 charge-derived integrator; B3 continuous approximation boundary; B4 parasitic-sensitive and insensitive phase connections; B5 z-plane biquad design; B6 topology-specific finite-gain leakage.

New lessons follow the Circuit Elements learning structure: Start here with symbols and assumptions, Worked math with substitutions, Explore with parameter-linked plots/tables, and Practice with entered answers. Navigation stays anchored; equations and tables scroll internally on narrow screens. Circuit drawings can be enlarged where supplied.

## Model scope

A shared ideal-switch charge projection conserves floating-conductor charge while allowing driven nodes and ideal amplifier outputs to supply charge. Finite-gain coefficients come from the displayed phase topology. Sampled-filter handovers preserve z coefficients and explicitly label time scaling above Signal Lab’s 192 kHz limit. Converter, noise-shaping, PLL and later groups remain planned.

## Run and check

From the repository root:

```powershell
npm run dev --workspace apps/mixed-signal-lab
npx vitest run apps/mixed-signal-lab
npm run build --workspace apps/mixed-signal-lab
node scripts/verify-extended.mjs mixed-signal-lab
```

The browser check serves the built app under its actual lab path, walks every new lesson and all four views at 1440, 390 and 320 px, and checks math, tab geometry, page overflow, answer feedback and applicable drawing dialogs. `npm run site` assembles the full set of sibling apps for cross-lab link checks.
