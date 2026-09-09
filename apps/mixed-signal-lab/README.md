# Mixed-Signal Lab

23 working experiments across Groups A–D. The app remains **dark** (direct URL, no public splash-page card). See [buildout progress](../../LAB_BUILDOUT_PROGRESS.md) for deployment verification.

A1 acquisition; A2 charge sharing; A3 signed injection and feedthrough; A4 kT/C; A5 bottom-plate phase order; A6 aperture jitter.

B1 switched-capacitor resistance; B2 charge-derived integrator; B3 continuous approximation boundary; B4 parasitic-sensitive and insensitive phase connections; B5 z-plane biquad design; B6 topology-specific finite-gain leakage.

New lessons follow the Circuit Elements learning structure: Start here with symbols and assumptions, Worked math with substitutions, Explore with parameter-linked plots/tables, and Practice with entered answers. Navigation stays anchored; equations and tables scroll internally on narrow screens. Circuit drawings can be enlarged where supplied.

## Model scope

A shared ideal-switch charge projection conserves floating-conductor charge while allowing driven nodes and ideal amplifier outputs to supply charge. Finite-gain coefficients come from the displayed phase topology. Sampled-filter handovers preserve z coefficients and explicitly label time scaling above Signal Lab’s 192 kHz limit. Groups C and D now cover static and dynamic converter errors. Noise-shaping, PLL and later groups remain planned.

## Run and check

From the repository root:

```powershell
npm run dev --workspace apps/mixed-signal-lab
npx vitest run apps/mixed-signal-lab
npm run build --workspace apps/mixed-signal-lab
node scripts/verify-extended.mjs mixed-signal-lab
```

The browser check serves the built app under its actual lab path, walks every new lesson and all four views at 1440, 390 and 320 px, and checks math, tab geometry, page overflow, answer feedback and applicable drawing dialogs. `npm run site` assembles the full set of sibling apps for cross-lab link checks.

C1 charge-redistribution DACs; C2 SAR decisions; C3 capacitor mismatch and endpoint errors; C4 flash bubbles and encoder policies; C5 redundant pipeline correction; C6 measured-weight voltage estimates. The one-dummy split DAC includes its bridge in the physical capacitance total.

D1 resolution and settling bandwidth; D2 continuous slew/settling transition;
D3 regenerative decisions and conditional unresolved-event rates; D4 finite-record
SNDR/SNR/THD/ENOB with explicit FFT bins; D5 code-density inference with uniform
Wilson intervals or sine-CDF inversion and simultaneous DKW bands.

The acquisition error plots use a logarithmic ordinate so the half-LSB crossing
stays visible. Their display floor is labeled and does not replace computed
residuals. The spectrum reuses D2’s state propagator and measures combined effects
directly. Histogram planning resolution is separate from the measured six-bit ADC.

```powershell
node scripts/verify-dynamic.mjs
node scripts/verify-dynamic.mjs --live
```
