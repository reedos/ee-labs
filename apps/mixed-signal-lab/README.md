# Mixed-Signal Lab

40 working experiments across Groups A–G. The app remains **dark** (direct URL, no public splash-page card). See [buildout progress](../../LAB_BUILDOUT_PROGRESS.md) for deployment verification.

A1 acquisition; A2 charge sharing; A3 signed injection and feedthrough; A4 kT/C; A5 bottom-plate phase order; A6 aperture jitter.

B1 switched-capacitor resistance; B2 charge-derived integrator; B3 continuous approximation boundary; B4 parasitic-sensitive and insensitive phase connections; B5 z-plane biquad design; B6 topology-specific finite-gain leakage.

New lessons follow the Circuit Elements learning structure: Start here with symbols and assumptions, Worked math with substitutions, Explore with parameter-linked plots/tables, and Practice with entered answers. Navigation stays anchored; equations and tables scroll internally on narrow screens. Circuit drawings can be enlarged where supplied.

## Model scope

A shared ideal-switch charge projection conserves floating-conductor charge while allowing driven nodes and ideal amplifier outputs to supply charge. Finite-gain coefficients come from the displayed phase topology. Sampled-filter handovers preserve z coefficients and explicitly label time scaling above Signal Lab’s 192 kHz limit. Groups C and D now cover static and dynamic converter errors. Group E adds behavioral noise shaping and decimation. Group F adds PLLs and jitter. Group G completes the seven planned curriculum groups with chopping, auto-zeroing, noise folding and correlated double sampling. Broader engine and product features remain separate future work.

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


## Group E — Noise shaping

E1 actual quantization error versus independent noise; E2 unshaped oversampling; E3/E4 explicit first/second-order one-bit recurrences; E5 observed overload and its limits; E6 actual sinc-cubed filtering, decimation and a finite three-tap droop corrector.

All lessons retain defined symbols, worked numerical LaTeX, parameter-driven plots, aligned tables and answer-entry practice. Run `node scripts/verify-group-e.mjs` against an assembled site, or add `--live` after publication.

## Group F

F1 detector pulse charge and the selected phase branch; F2 loop states and the closed-loop zero; F3 exact third-order filter and Control Lab handover; F4 event-driven PFD acquisition and whole-cycle slips; F5 phase-noise integration; F6 reference/VCO noise shaping and a jitter-only converter ceiling.

Run `node scripts/verify-group-f.mjs` against an assembled site, or add `--live` after publication. The same shared learning shell retains worked LaTeX, defined quantities, aligned tables, stable tabs, keyboard practice and enlarged circuit drawings.

## Group G

- **G1:** Two ideal synchronized polarity reversals surround an instantaneous offset amplifier. Exact RC propagation resolves each half-period, capacitor-state continuity, uncharged startup and the periodic orbit. Default fundamental ripple is 12.7318 mV; it is distinct from the waveform peak. This is a phase-resolved behavioral circuit, not a transistor switch simulation.
- **G2:** One net charge impulse per cycle, storage capacitance and a finite recovery resistor define a periodic error. Q/C is the edge jump; mean error is Q R fs. Defaults give 1 mV output jump but 100 µV output mean, or 1 µV and 0.1 µV respectively at the input for gain 1000.
- **G3:** Acquire a 1 mV offset through 1 kΩ from zero initial storage, then hold and subtract it. Finite acquisition leaves settling error and thermal variance (kT/C)(1−exp(−2ta/RC)); leakage causes deterministic droop. Seeded independent calibration trials are compared with the predicted mean and standard deviation.
- **G4:** Explicit band-limited white-noise paths compare sample-and-hold alias sums with square-wave harmonic translation. B/fs=10 gives 20 aliases at an interior baseband frequency; the hold sinc envelope is retained. Chopper weights approach a total of one as source bandwidth grows. This does not claim free noise performance or model a complete auto-zero amplifier's direct and correlated noise paths.
- **G5:** H(z)=1−z^−d for d=1 or 2 rejects constant offset and wanted DC. Stationary correlated input noise gives σout=σ√[2(1−ρ^d)], checked against seeded difference records. Exact FIR coefficients cross to Signal Lab at the same rate; initial delay-line history and noise ensemble assumptions are stated.
