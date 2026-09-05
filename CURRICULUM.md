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

Status as of 2026-09-05. Built means on the deployed site, dark or released. Planned
means in a plan file with the experiment specified. Nowhere means no plan names it.

---

## 1. The order

The course order is the order a curriculum teaches these subjects. It is also the
order the nav will fold to (`ELECTRONICS_LAB_PLAN.md` Decision 5).

| Step | Lab | Course it mirrors | Experiments | Status |
| --- | --- | --- | --- | --- |
| 1 | Circuit Elements Lab | Circuits I | 58 | built, dark |
| 2 | Circuit Lab | Circuits II, the frequency-domain half | 16 | released |
| 3 | Electronics Lab | Electronics I and II | 43 of 77 | built in part, dark |
| 4 | Signal Lab | Signals and Systems, DSP | 35 | released |
| 5 | Control Lab | Control | 13 | released |
| 6 | Power Lab | Power electronics | 34 of 56 | built in part, dark |

Signal Lab's first group needs only sines, so it can be opened after step 1's Group H.
§5 gives the earliest point each group can be opened, for a reader who wants to
interleave.

---

## 2. The path, group by group

### Step 1: Circuit Elements Lab (58, built)

| Group | Teaches | Count |
| --- | --- | --- |
| A · Elements and signs | a source holds its value, ground is a choice, the sign convention | 4 |
| B · Two laws | KCL, KVL, power and its sign | 4 |
| C · Series and parallel | one current or one voltage, the loaded divider, the bridge | 4 |
| D · Analysis and theorems | nodal, supernode, mesh, superposition, Thévenin three ways, maximum power | 6 |
| E · Op-amps | the dependent source, the black box, the golden rules, the four circuits, the Schmitt trigger | 9 |
| F · Elements that remember | C and L, the first-order equation, energy, the spark, the integrator | 7 |
| G · Second order | the characteristic equation, three dampings, the LC | 7 |
| H · Sinusoids and phasors | natural and forced, phasors, impedance, resonance, AC power, one sine at a time, the roots as poles | 7 |
| I · The diode | four models, the load line and Newton, assumed state, rectifiers, clipper, Zener, clamper, doubler | 10 |

What it gives at the end: `H(jω)` read one sine at a time, and the Bode view of an RC.
The same circuit hands over to Circuit Lab.

### Step 2: Circuit Lab (16, released)

| Group | Teaches | Count |
| --- | --- | --- |
| Reading a response | a divider has no dynamics, where the corner comes from, the high-pass, RL is RC, the impulse response | 5 |
| Resonance | three filters from one RLC, Q, series against parallel, resonance in time, the notch, tolerance, which part | 7 |
| Active circuits | why active filters exist, the inverting gain, the pole at the origin | 3 |
| One object, two names | the RLC is a biquad, and the hand-over to Signal Lab and Control Lab | 1 |

What it assumes at the start: dB, impedance and phase, defined on contact. What it
introduces without an experiment: the complex frequency s, poles and zeros, as term
definitions (see §3, seam 1).

### Step 3: Electronics Lab (43 of 77)

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
| J · The differential pair | steering, the half-circuit, CMRR, mismatch, the active load | 5 | planned |
| K · Frequency response | the device's capacitors, the low end, Miller, OCTC, no Miller, the cascode's bandwidth | 6 | planned |
| L · Feedback | the loop broken, desensitivity, gain-bandwidth, the ports, stability, the buffer | 6 | planned |
| M · Inside the op-amp | the two-stage op-amp, compensation, phase margin, slew, offset, the output stage | 6 | planned |
| N · Oscillators | Wien at the threshold, amplitude, relaxation, LC (stretch) | 4 | planned |
| O · Noise | a density, thermal, shot, referred to the input, SNR after gain | 5 | planned |

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

Each seam is the last thing one lab gives and the first thing the next assumes. Five
seams, three of them thin.

**Seam 1, Elements to Circuit Lab: from jω to s.** *Thin.* Elements G1 finds the
roots of the characteristic equation by trying `e^{st}`. Elements H6 reads `H(jω)` one
sine at a time. Circuit Lab then speaks of poles, zeros and the complex frequency s
from its first group, and defines them in term panels rather than in an experiment.
The step a course takes here has no experiment: G1's roots are H6's poles, and the
Bode plot is H(s) read along the jω axis.

Recommended: **Elements H7, "The roots are the poles"**. The series RLC's
`s² + (R/L)s + 1/LC` from G1, its two roots on the plane, and the Bode magnitude of H4
drawn as the distance from jω to those roots. One experiment, no engine work, and
Circuit Lab's first term panel then has something to point at.

**Seam 2, Circuit Lab to Signal Lab: the impulse response in continuous time.**
*Thin.* Circuit Lab shows the step response of the RLC. Signal Lab shows the impulse
response of a digital biquad and convolution as a sum of taps. Nowhere does a student
see that the step response is the integral of the impulse response, or that a
continuous circuit's output is the convolution of its input with `h(t)`.

Recommended: **Circuit Lab, one experiment in "Reading a response"**, "The impulse
response, and why the step is its integral". The RC's `h(t) = (1/τ)e^{−t/τ}`, the
step as its running integral, and a square wave as a sum of shifted steps, all on the
step view that exists. The RK4 machinery Circuit Lab has is enough.

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

---

## 4. Subjects with no home

The map also shows what a full curriculum teaches that no lab and no plan covers.
Each is listed so it is a decision, with a recommended home or a stated reason to
leave it out.

| Subject | Course | Recommended home | Reason |
| --- | --- | --- | --- |
| The ideal transformer and coupled inductors | Circuits II | `packages/network` once, then Elements F8 (turns ratio, reflected impedance) and Power D (flux, saturation) | Power D assumes the turns ratio that no experiment introduces |
| Three-phase from the circuits side (Y and Δ, line and phase) | Circuits II | Power I, as its first experiment, if a reader needs it | Power I3 already carries the payoff, constant power |
| Two-port matrices (h, y, z, g) | Circuits II | none | Electronics G measures every port by test source, and Blackman's form replaces the two-port feedback analysis |
| Laplace transforms as a topic | Circuits II, Signals | none | declined by the Elements plan. Seam 1's experiment is the substitute, and H(s) is used from Circuit Lab on |
| Continuous-time convolution | Signals | Circuit Lab, seam 2 | one experiment |
| Steady-state error constants, lag compensation, state space, discrete control | Control | Control Lab's own plan, when there is one | outside the analog path this document was written for |
| PLLs, data converters, switched-capacitor circuits | Mixed-signal | a later lab, if any | Signal Lab's side of the boundary, and no plan names them |
| Digital logic past the inverter | Digital | none | The Electronics Lab's CMOS inverter is the door, and the room behind it is not the signals half of the curriculum |
| Transmission lines | Fields, high-speed | none | declined at the `systems` boundary by `CORE_SCOPE.md` |

`ANALOG_ROADMAP.md` names the labs that would take the mixed-signal and high-frequency
rows. They are tiers 4 and 5 of the path to industry-level analog.

---

## 5. Reading order, and the earliest point for each lab

For a reader walking the whole path:

1. Elements A to I, in order.
2. Elements H7 (seam 1), then Circuit Lab in order, with the convolution experiment
   (seam 2) in its first group.
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
