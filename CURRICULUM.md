# The progression: one path through the labs

The suite is six labs, and a student can walk them as one course. This document is
the walk. It lists every group in the order a course teaches it and says whether the
experiments exist. It names the seam between each lab and the next: what the last
experiment of one gives, and what the first experiment of the next assumes. Where a
step is missing, this document says so and names the plan that closes it.

The rule it enforces is the suite's own, applied across labs. **No experiment leans on
an idea that no earlier experiment teaches.** The Elements lab already tests this
inside itself, every cross-reference in a note must name an experiment that exists.
§6 extends that test across the seams.

Circuit Elements implementation is updated as of 2026-09-08; its expansion awaits publication.
Other rows retain the 2026-09-05 program baseline. Built in those rows means on the deployed
site, dark or released. Planned means specified in a plan file. Nowhere means no plan names it.

---

## 1. The order

The course order is the order a curriculum teaches these subjects. It is also the
order the nav will fold to (`ELECTRONICS_LAB_PLAN.md` Decision 5).

| Step | Lab | Course it mirrors | Experiments | Status |
| --- | --- | --- | --- | --- |
| 1 | Circuit Elements Lab | Circuits I and II foundations | 89 | implemented, expansion release pending |
| 2 | Circuit Lab | Filters and frequency response | 16 | released |
| 3 | Electronics Lab | Electronics I and II | 75 of 77 | built in part, dark |
| 4 | Signal Lab | Signals and Systems, DSP | 35 | released |
| 5 | Control Lab | Control | 13 | released |
| 6 | Power Lab | Power electronics | 34 of 56 | built in part, dark |

Signal Lab's first group needs only sines, so it can be opened after step 1's Group H.
§5 gives the earliest point each group can be opened, for a reader who wants to
interleave.

---

## 2. The path, group by group

### Step 1: Circuit Elements Lab (89, implemented, expansion release pending)

| Group | Teaches | Count |
| --- | --- | --- |
| A · Elements and signs | a source holds its value, ground is a choice, the sign convention | 4 |
| B · Two laws | KCL, KVL, power and its sign | 4 |
| C · Series and parallel | one current or one voltage, the loaded divider, the bridge | 4 |
| D · Analysis and theorems | nodal and mesh equations, superposition, source transformations, Norton, supermesh and delta-wye | 10 |
| E · Op-amps | controlled sources, amplifier circuits, the Schmitt trigger and dependent-source resistance tests | 10 |
| F · Elements that remember | storage laws, first-order equations, pre/post-switch states and zero-input/zero-state responses | 9 |
| G · Second order | characteristic roots, damping, initial energy, parallel RLC and the Circuits I capstone | 8 |
| H · Sinusoids and phasors | phasors, impedance, resonance, branched KCL, AC equivalents, conjugate matching and power-factor correction | 9 |
| J · Complete responses and Laplace | transform definitions, stored initial conditions, inversion, theorem conditions and state-to-transfer derivation | 7 |
| K · Filters and Fourier signals | frequency response, poles, component targets, loading, harmonic reconstruction and convolution | 6 |
| L · Coupled circuits and three phases | mutual winding laws, ideal transformer relations, balanced line/phase quantities and the floating neutral | 4 |
| M · Two-port networks | open/short terminal tests, Z/Y/h conversion, ABCD cascades and loading | 3 |
| N · Circuits II capstone | reconcile complete time, state, Laplace and phasor solutions with independent practice | 1 |
| I · The diode | optional extension with diode models, rectifiers, regulation, clipping, clamping and doubling | 10 |

Circuit Elements F1, G1 and H1 introduce the necessary notation and arithmetic in their opening
Start here views. The Laplace group follows the phasor and state foundations.
Frequency-response lessons retain their public identifiers but now follow Laplace in the filters group.

The course concludes with an integrated circuit-analysis capstone. Its filter circuits
also hand over to Circuit Lab for further frequency-response exploration.

### Step 2: Circuit Lab (16, released)

| Group | Teaches | Count |
| --- | --- | --- |
| Reading a response | a divider has no dynamics, where the corner comes from, the high-pass, RL is RC, the impulse response | 5 |
| Resonance | three filters from one RLC, Q, series against parallel, resonance in time, the notch, tolerance, which part | 7 |
| Active circuits | why active filters exist, the inverting gain, the pole at the origin | 3 |
| One object, two names | the RLC is a biquad, and the hand-over to Signal Lab and Control Lab | 1 |

Circuit Elements owns the Circuits I and II course sections. Phasor instruction uses
its existing schematic and analysis panes. Circuit Lab remains the frequency-response
tool. Circuit Elements now implements the expanded state-space and Laplace progression.
`CIRCUITS_COMPLETION_PROGRESS.md` records its acceptance evidence and pending publication.

### Step 3: Electronics Lab (75 of 77)

`ELECTRONICS_LAB_PLAN.md` §1 carries this lab's own map, row by row, against what is
built. The groups, in order:

| Group | Teaches | Count | Status |
| --- | --- | --- | --- |
| A · The op-amp as a user meets it | offset, bias current, gain-bandwidth, slew, CMRR, output limits, the precision rectifier | 6 | built |
| B · Diode circuits, finished | the clamper, the doubler | 2 | planned |
| C · Inside the junction | where the exponential comes from, junction and diffusion capacitance, temperature | 4 | built |
| D · The transistor as a controlled source | two junctions, the curves, three regions, the MOSFET, the switch, the CMOS inverter, the load line | 7 | built |
| E · Signal and bias take different paths | the coupling capacitor, four bias schemes, temperature | 6 | built |
| F · Small signals | the tangent again, DC plus AC, `g_m`, the hybrid-π, how small is small, the MOSFET | 6 | built |
| G · Ports | the test source, the two-port and loading | 2 | built |
| H · Single-stage amplifiers | CE, degeneration, CC, CB, CS, CD and CG, swing | 7 | built |
| I · Mirrors and stacking | the mirror, Widlar, the active load, the cascode, loading | 5 | built |
| J · The differential pair | steering, the half-circuit, CMRR, mismatch, the active load | 5 | built |
| K · Frequency response | the device's capacitors, the low end, Miller, OCTC, no Miller, the cascode's bandwidth | 6 | built |
| L · Feedback | the loop broken, desensitivity, gain-bandwidth, the ports, stability, the buffer | 6 | built |
| M · Inside the op-amp | the two-stage op-amp, compensation, phase margin, slew, offset, the output stage | 6 | built |
| N · Oscillators | Wien at the threshold, amplitude, relaxation, LC (stretch) | 4 | built |
| O · Noise | a density, thermal, shot, referred to the input, SNR after gain | 5 | built |

### Step 4: Signal Lab (35, released)

| Group | Teaches | Count | Earliest point |
| --- | --- | --- | --- |
| Signals and Fourier | one tone, harmonics, building a square, sources add, sines in and out, beating | 7 | after Elements H |
| Sampling | coarse against undersampled, aliasing, Nyquist, resolution, leakage | 7 | after Signals and Fourier |
| Filters | low-pass and high-pass on a square, Q, phase, order, impulse and step response | 8 | after Circuit Lab |
| FIR and the z-plane | moving average, linear phase, the kernel, truncation, zeros on the circle, comb, convolution | 7 | after Filters |
| Nonlinearity | clipping, DC and even harmonics, two tones, ring modulation, AM, 4 bits | 6 | after Signals and Fourier |

What it gives: spectra, harmonics and the two-tone test that Electronics F5, H7 and M6
cross-reference. Its convolution is discrete (see §3, seam 2).

### Step 5: Control Lab (13, released)

| Group | Teaches | Count |
| --- | --- | --- |
| What feedback buys | proportional cannot get there, the integrator, disturbance, and what it costs | 5 |
| Losing stability | turn it up, the margin, the poles crossing | 3 |
| Reading the loop | the point −1, a thin margin | 2 |
| Harder plants | the plant that needs feedback, derivative, lead | 3 |

What it assumes: a transfer function, its poles, and the Bode plot, all from Circuit
Lab. A first-order lag, from Elements F. What it gives back: margins and the root
locus, which Electronics L5, M3 and N1 hand their loops to.

### Step 6: Power Lab (34 of 56)

| Group | Teaches | Count | Status |
| --- | --- | --- | --- |
| A · Why switching | the resistor's loss, the switch, the ideal converter | 3 | built |
| B · The buck | volt-second balance, ripple, CCM and DCM, the boundary | 8 | built |
| C · Boost and buck-boost | the two other topologies, the peak, the inverting output | 5 | built |
| D · Magnetics | volt-seconds are flux, saturation, the flyback, the half-bridge | 4 | built |
| E · Rectifiers | half and full wave, the capacitor, the dimmer, six-pulse | 6 | built |
| F · Inverters | the square wave, the comparator, the harmonic clusters, overmodulation | 4 | built |
| G · Losses | the frequency crossover, peak efficiency, the capacitor's RMS, the ledger | 4 | built |
| H to N, and the leakage spike | the loop, three-phase, isolated, resonant, drives, EMI, thermal, and the flux that links one winding only | 22 | planned |

What it assumes: C, L and the RLC from Elements F and G, and the diode from Elements
I. The switch is Elements F6. Its Group H assumes Control Lab.
The plan's 54 became 56 when the buck grew from six experiments to eight.

---

## 3. The seams

Each seam is the last thing one lab gives and the first thing the next assumes. The descriptions distinguish implemented foundations from later planned applications.

**Seam 1, Elements to Circuit Lab: from j? to s.** *Implemented; expansion publication pending.*
Elements G1 derives characteristic roots. Elements J1 defines the Laplace variable and
transform, Elements J7 derives the transfer function from the state matrix, and Elements
H7 connects roots with poles. Elements H6 then reads the response along the j? axis.
Circuit Lab can build on that derivation rather than introducing a new meaning of s
only in a definition panel.

**Seam 2, Circuit Lab to Signal Lab: the impulse response in continuous time.**
*Implemented in the shared foundation; publication pending.* Elements K4 derives the
causal RC impulse response, integrates it for the step response, defines continuous
convolution and predicts a finite pulse using two shifted steps. Elements K3 separately
connects Fourier harmonics to the analog transfer function and includes startup and a
finite-series error bound. These foundations prepare the reader for Signal Lab's
discrete convolution without requiring another core Circuit Lab lesson.

**Seam 3, Circuit Lab to Electronics Lab.** *Closed by the Electronics plan.* Its §1
map lists eight gaps and the bridging groups that close them. They are the op-amp's
limits, the last diode circuits, the junction, the test-source method, the coupling
capacitor, the tangent from the diode, the CMOS inverter, and noise as a signal.

**Seam 4, Electronics and Signal to Control Lab.** *Sound.* Control Lab's plants are
Circuit Lab's transfer functions, its first plant is Elements F3's lag, and its
readouts are defined on contact. Electronics L5 hands a loop gain to it as an exact
plant, and the two labs' margins are pinned equal.

**Seam 5, Control to Power Lab.** *Sound where built, planned where not.* Power Lab's
built groups need only Elements F, G and I. Its Group H, closing the loop, needs
Control Lab and hands its averaged model there with the `f_s/5` guard the Power plan
already states.

Elements L1 and L2 now supply mutual-inductance and transformer foundations before
the magnetics applications in Power D1. Elements L3 and L4 supply the balanced and
unbalanced three-phase foundations; converter switching remains in Power Lab.

---

## 4. Subjects with no home

The map also shows what a full curriculum teaches that no lab and no plan covers.
Each is listed so it is a decision, with a recommended home or a stated reason to
leave it out.

| Subject | Course | Recommended home | Reason |
| --- | --- | --- | --- |
| Steady-state error constants, lag compensation, state space, discrete control | Control | Control Lab's own plan, when there is one | outside the analog path this document was written for |
| PLLs, data converters, switched-capacitor circuits | Mixed-signal | a later lab, if any | Signal Lab's side of the boundary, and no plan names them |
| Digital logic past the inverter | Digital | none | The Electronics Lab's CMOS inverter is the door, and the room behind it is not the signals half of the curriculum |
| Transmission lines | Fields, high-speed | none | declined at the `systems` boundary by `CORE_SCOPE.md` |

`ANALOG_ROADMAP.md` names the labs that would take the mixed-signal and high-frequency
rows. They are tiers 4 and 5 of the path to industry-level analog.

---

## 5. Reading order, and the earliest point for each lab

For a reader walking the whole path:

1. Elements follows its course picker through Circuits I, phasors, Laplace, filters,
   coupled/polyphase circuits, two-ports and the Circuits II capstone. Diodes are an optional extension.
2. Elements H7 (seam 1) and Elements K4 (seam 2), then Circuit Lab in order.
3. Signal Lab's Signals and Fourier and Sampling groups. They need nothing past
   Elements H, so they can be read here or after step 2.
4. Electronics A to J. Signal Lab's Nonlinearity group beside Electronics F5.
5. Signal Lab's Filters and FIR groups.
6. Control Lab, in order.
7. Electronics K to O, which hand their loops to Control Lab.
8. Power Lab, in order.

A reader who wants one subject can enter at that lab. Every lab defines its terms on
contact, and the hand-over links carry a circuit across a seam with its values.

---

## 6. The test

The Elements lab has a test that walks every note and every math panel. It requires
each cross-reference to name an experiment that exists in the named lab. This document
proposes the same test across the suite, in `packages/ui/src/progression.test.js`.
That sits beside the analytics test that already pins the released entry pages:

- every experiment id this document quotes exists in the named lab's experiment,
  lesson or preset list,
- every count in §1 and §2 equals the length of that list,
- every hand-over this document names has a test at both ends,
- and a row marked "planned" must name a plan file that contains the experiment.

A row that claims "built" for an experiment that is not built fails the suite. This
document cannot get ahead of the code, in the same way the Elements lab's sittings
file cannot get ahead of its record.
