# Splash page copy — `site/index.html`

The splash is the first page a stranger sees, and it carries the highest density
of mannered prose in the repository. Nothing structural changes: same header,
same three lab cards, same hero canvas, same triangle diagram.

`apps/signal-lab/src/readme-claims.test.js` pins three literal strings on this
page: `35 experiments`, `15 experiments, 10 circuits`, and
`13 experiments, 7 plants`. The rewrite keeps them exactly.

---

## Header

**Now**

> Build a signal and watch a filter reshape it. Wire a circuit and read its
> poles. Close a loop and find its margins. The three labs trade in one currency
> — the transfer function — so the circuit you wire in one opens in the others as
> the exact same system: filter a signal through it in Signal Lab, steer it as
> the plant in Control Lab. And **every claim on every page is measured against
> what is drawn.**

**Rewrite**

> Three interactive labs for undergraduate signals, circuits and control. Build a
> signal and filter it, wire a circuit and read its poles, or close a loop and
> measure its margins. All three represent a system as a transfer function, so a
> circuit built in one lab opens in the others as the same system: as a filter in
> Signal Lab, as a plant in Control Lab. **Every number and every statement on
> screen is checked by a test against what the page draws.**

Kicker ("Electrical Engineering focused.") is unchanged.

## Hero captions

| Now | Rewrite |
|---|---|
| square, 3 harmonics shown of ∞ | square wave, 3 of its harmonics shown |
| low-pass f<sub>c</sub> = — | unchanged |

## Lab cards

**Signal Lab — now**

> Build waveforms from harmonics, sample and alias them, run them through chains
> of biquads and FIRs. Read the result four ways: spectrum, kernel, z-plane,
> group delay — and watch convolution happen one sample at a time.

**Signal Lab — rewrite**

> Build waveforms from harmonics, sample them, and run them through chains of
> biquads and FIR filters. Each result is shown as a spectrum, an impulse
> response, a z-plane plot and a group-delay curve. A convolution view steps
> through the sum one sample at a time.
> `35 experiments`

**Circuit Lab — now**

> RC, RLC, twin-T, op-amp stages. Component values become poles, Bode plots and
> step responses — every H(s) derived where you can check it, and ±5% parts shown
> for what they do to the promises.

**Circuit Lab — rewrite**

> RC, RLC, twin-T and op-amp stages. Component values set the poles, the Bode
> plot and the step response. Each H(s) is derived on screen, and a ±5 %
> tolerance view shows how far the response moves.
> `15 experiments, 10 circuits`

**Control Lab — now**

> Close a loop and pay its bills: margins, root locus, Nyquist, disturbance
> rejection, S + T = 1. Seven plants, four controllers, and the point −1 — with
> every rule of thumb marked where it stops holding.

**Control Lab — rewrite**

> Close a feedback loop and measure it: gain and phase margins, root locus,
> Nyquist, disturbance rejection, and S + T = 1. Each rule of thumb states the
> conditions under which it holds.
> `13 experiments, 7 plants` and four controllers

## Triangle section

| Now | Rewrite |
|---|---|
| One object, three vocabularies | One circuit, three labs |
| series RLC / a biquad / same f₀, same Q | unchanged (labels are already plain) |

The section body follows the same rule as the header: one sentence stating that
the same network is handed to each lab exactly, and one naming what is preserved
(f₀ and Q to Signal Lab, the plant polynomial to Control Lab).

## Footer

Keep the repository link. Remove any sentence that praises the suite; the testing
claim is made once, in the header (S14).
