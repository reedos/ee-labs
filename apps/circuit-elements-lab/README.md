# Circuit Elements Lab

One Circuit Elements interface teaches the Circuits I and II progression. The catalog
contains 89 experiments: 30 additions to the previous 59. Public experiment IDs remain
stable, including H6 and H7, which now appear after Laplace in the filters group.

Use the next arrow to follow the teaching order. The course picker separates Circuits I,
Circuits II and the optional diode extension. F1, G1 and H1 introduce derivatives,
state vectors and complex sinusoids before their analysis views. J1 introduces Laplace.

## Course coverage

| Course stage | Experiments | What the learner does |
| --- | --- | --- |
| Circuit laws and resistive methods | A–D, including D7–D10 | Define signs, write node/mesh equations, transform sources, construct Norton equivalents, solve a supermesh and convert delta–wye networks |
| Controlled sources and amplifiers | E1–E10 | Apply ideal amplifier models and measure port resistance while dependent sources remain active |
| Stored energy and switching | F1–F9, G1–G8 | Carry initial states through switching, separate zero-input and zero-state responses, derive coupled state equations and complete the Circuits I capstone |
| Sinusoidal circuit analysis | H1–H5, H8–H11 | Solve complex circuit equations, use RMS/peak conventions, construct AC equivalents, match loads and correct power factor |
| Complete Laplace solutions | J1–J7 | Transform derivatives with initial conditions, invert real/complex/repeated poles, check value-theorem conditions and derive H(s) from a state model |
| Filters and periodic inputs | H6, H7, K1–K4 | Connect poles to frequency response, design a corner, include loading, reconstruct Fourier harmonics and derive step/pulse responses by convolution |
| Coupled and polyphase circuits | L1–L4 | Apply dot conventions and mutual energy, ideal transformer ratios, balanced star/delta relations and an unbalanced floating-neutral solve |
| Terminal models and assessment | M1–M3, N1 | Perform open/short two-port tests, convert Z/Y/h parameters, cascade ABCD matrices with loading and reconcile four solution routes |
| Optional electronics extension | I1–I10 | Apply diode models, rectification, regulation, clipping, clamping and doubling |

## Teaching and interface

Every addition uses the existing schematic, controls, analysis tabs and scrolling panes.
Worked LaTeX proceeds from variable definitions and circuit laws through substitutions
to a numerical result. Independent circuit checks compare that result with the native
solve. Method comparisons explain when a route is useful and what it leaves out.

Practice accepts an independently entered numerical answer, including scientific
notation. It offers a hint, explanatory feedback and an optional result reveal after
an incorrect attempt. Changed parameters reset the answer. The capstones include
three variants, including forming a state-equation coefficient. These exercises are
self-study feedback, not a secure examination or a claim of learner mastery.

Analysis tabs retain their position between views. Tables keep their headers aligned.
The **Enlarge drawing** dialog provides readable inspection of dense schematics without
permanently taking space from the mathematics. It supports keyboard focus, Escape and
horizontal scrolling on phones. Course progress retains the existing local-storage behavior.

## Model boundaries

- Phasors represent sinusoidal steady state. Scope and state/Laplace solutions retain startup.
- The Fourier reconstruction has a displayed conservative truncation bound; the complete
  time response includes a separately stated initial-state correction.
- Mutual inductance uses reciprocal signed coupling and a positive-energy inductance
  matrix. Perfect coupling is singular in this state model and uses the separately
  taught ideal-transformer equivalent instead.
- Three-phase examples cover balanced RL star loads, balanced delta relations and an
  unbalanced resistive star with connected or floating neutral. Fault analysis, machines
  and power-flow studies remain later courses.
- Two-port examples derive lumped linear resistor-network parameters. Distributed RF
  waves and S-parameter design remain outside this course.
- Semiconductor design, control synthesis and converter design stay in their later labs.

The course addresses the repository's agreed Circuits I–II outcomes. University syllabi
vary; the coverage table states the actual taught examples rather than promising every
possible topic in every institution's two-course sequence.

## Verification

From this app directory:

```sh
npm test -- --maxWorkers=2
node scripts/verify-view-tabs.mjs
node scripts/verify-completion.mjs
```

Browser scripts default to the assembled local site at
`http://127.0.0.1:4192/circuit-elements-lab/`; set `APP_URL` for another server.
Set `BROWSER=firefox` to repeat the browser checks there. The tab walkthrough discovers
the catalog from the rendered picker and checks every available view at four widths.
The completion walkthrough exercises all additions, practice feedback/reset, design
application and the enlarged drawing at desktop and phone sizes.

The shared network tests independently check coupled winding laws, energy conservation,
AC/time agreement and invalid coupling rejection. Existing experiment tests also sweep
parameters and check schematic geometry, circuit laws and displayed results.
