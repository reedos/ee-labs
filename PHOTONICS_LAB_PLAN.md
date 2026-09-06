# Photonics Lab: the plan

Track E of `EE_LABS_MAP.md`, beside the Fields Lab. Fibre, lasers and detectors, as
junctions and closed forms the suite can state exactly. Splash glyph `◇`, directory
`apps/photonics-lab`, engine as a new package `packages/photonics` over
`packages/network`.

The path, in order. The photon and its energy. The photodiode as a reverse-biased
junction with a responsivity. The noise a detector adds, and the receiver's
sensitivity. The LED and the laser as forward-biased junctions with a threshold. The
rate equations, solved for their steady state exactly and linearised for the
relaxation oscillation. The fibre, its attenuation and its dispersion. The
Fabry-Perot cavity as a transfer function, and wavelength multiplexing.

This is a draft (2026-09-05) for Reed to settle. The lab's two dependencies are not
released. The Electronics Lab is being built on `lab/electronics-lab` and owns the
junction and the noise sources. The Applied Analog Lab is mapped and owns the
transimpedance amplifier. §1 says exactly what this lab leans on from each, and §9
phases the build so that the groups with no unbuilt dependency ship first.

The two rules that govern the other labs govern this one with no exemption. **Every
explanatory sentence is a claim about physics, and a test must measure it.** And
`CORE_SCOPE.md` decides what the engine may state exactly, what it may approximate
behind a guard, and what it declines with a reason. The modulated high-speed link is
the private `waveform-simulator`'s, by the root README, and this plan records that
seam without reopening it.

---

## 0. Open decisions

### Decision 1: the name (recommended: Photonics Lab)

`EE_LABS_MAP.md` §1 and §2 call it the Photonics Lab, and its row reads "fibre,
lasers, detectors". LabNav short form **"Photonics"**. The splash card names the path
in one line: "the photon, the photodiode, the laser's threshold, the fibre, the
cavity".

Alternatives considered. *Optics Lab* promises lenses, imaging and polarisation optics,
which are the Fields Lab's wave half and a physics course. *Fibre Lab* names one of
the three subjects. *Optoelectronics Lab* is the catalogue name in some departments
and is four syllables longer in a phone-width nav.

### Decision 2: where the engine lives

Recommended: **a new `packages/photonics`**, listed in `EE_LABS_MAP.md` §3 by the
director. It holds the closed forms, which are the responsivity, the fibre's
attenuation and dispersion, the Fabry-Perot transfer function and the rate equations.
The junction circuits stay in `packages/network`, which already has `junction.js`
from the Electronics Lab.

The alternative is to put everything in `packages/network`. That would put optical
constants and a two-state differential system into a circuit solver, and the map's §3
already anticipates a package per track. This is the only new package this plan asks
for.

### Decision 3: what the rate equations are allowed to do

The rate equations are two coupled nonlinear differential equations. Their steady
state is algebra and is exact. Their small-signal response about that steady state is
an exactly rational second-order H(s). Their large-signal solution in time needs a
timestep integrator, which `CORE_SCOPE.md` and `diode.js` both decline.

Recommended: **admit the steady state exactly, admit the linearisation as a labelled
second-order H(s) with a stated range, and decline the large-signal transient**. §2.6
states the range, which is a modulation depth, and §4.3 gives the measured error at
five depths. A reader who wants the large-signal turn-on is pointed at the private
simulator, which is where the map already sends the modulated link.

### Decision 4: whether the link view is a chain or a schematic

An optical link is a transmitter, a fibre and a receiver. It could be drawn as a
schematic, since two of the three are circuits, or as a chain in the System Lab's
sense, since the budget is a sum of decibels.

Recommended: **a link view of its own, which is a chain with an optical middle**. The
transmitter and the receiver open into schematics on a click, and the fibre is a
block with a length knob. The budget below it is the System Lab's waterfall with
optical units, and the two labs share that component. The System Lab is named as its
second user from the first commit.

### Decision 5: whether the photodiode noise group duplicates the Electronics Lab

Electronics O3 is shot noise on a junction. This lab's B group is shot noise on a
photodiode, plus the thermal noise of the load, plus the sensitivity that follows.
Recommended: **cite O3 rather than repeat it**, and start Group B at the comparison
between the two noise sources rather than at the definition of either.

That keeps the group at four experiments instead of seven. It also makes the seam
visible. A reader who has not read Electronics O sees a term panel with the density
and a link. Every other cross-lab reference in the suite works the same way.

---

## 1. The progression map

This lab leans on one lab in flight, one lab that is mapped, and one that is being
built beside it. This section lists every idea the lab uses, the experiment or group
that teaches it, and whether that experiment exists today.

| Idea the lab leans on | Needed by | Taught at | Status |
| --- | --- | --- | --- |
| The diode's four models, the exponential law, Newton | A2, C1, C2 | Elements I1 to I3 | built |
| The reverse-biased junction, its depletion region | A2, A3 | Elements I1, Electronics C1 | built and being built |
| Decibels, power ratios | E, F, and every budget | Signal Lab, Signals and Fourier group | built |
| Second-order response, damping, overshoot | D2, D3 | Elements G, Circuit Lab | built |
| H(s), poles and zeros, the Bode plot | D3, F1 | Circuit Lab, 15 built | built |
| The built-in potential, `C_j(v)`, `I_S(T)` | A3, C1 | Electronics Group C | being built, `lab/electronics-lab` |
| Shot noise `2qI` as a density | B1, B2 | Electronics O3 | being built, `lab/electronics-lab` |
| Thermal noise `4kTR` and the noise bandwidth | B2, B3 | Electronics O2 | being built, `lab/electronics-lab` |
| Noise through a network, one transfer per source, summed | B3 | Electronics `noise.js` | being built, `lab/electronics-lab` |
| The transimpedance amplifier, its stability and its noise | B3, B4 | Applied Analog Lab, front-end group | mapped only, not started |
| Noise as a random process, the confidence interval | B4 cites it | Random Signals Lab, estimation group | being built, `lab/random-lab` |
| The plane wave, the refractive index, reflection at an interface | E4, F1 | Fields Lab, wave group | being built, `lab/fields-lab` |
| The optical link budget as a sum of decibels | E5, F2 | System Lab, Group E | planned here, `SYSTEM_LAB_PLAN.md` |
| Bit error rate against a Q factor | B4 cites it | Communications Lab, channel group | proposed only, not started |
| The modulated high-speed link, the eye, jitter | out of scope | the private `waveform-simulator` | out of this repo |

Three things the map shows that this plan does not fix, so that they are decisions
and not omissions. **The transimpedance amplifier** has no built home. Group B models
the receiver as a photodiode into a load resistance, and names the Applied Analog Lab
for the amplifier that replaces it. **The bit error rate** is the Communications
Lab's, and B4 stops at the Q factor. The error rate is a number in a term panel.
**The modulated link** is the private simulator's, by the root README, and this plan
does not reopen it.

The order of the groups follows the map. Groups A, E and F need only what is built
today, which is three of the six groups and twelve of the twenty-five experiments.
Groups B and C need the Electronics Lab's Groups C and O. Group D needs nothing
unbuilt, because the rate equations are this lab's own.

---

## 2. The engine: `packages/photonics`, closed forms and two states

### 2.1 What exists, and what is missing

`packages/network` solves the junction circuits. `junction.js` from the Electronics
Lab gives the built-in potential, the depletion capacitance and the temperature law.
`noise.js` there gives thermal and shot densities through an exactly solved network.
`packages/systems` holds a rational H(s) and everything that reads one. What is
missing is listed here, and nothing else is built.

| Need | Today | This plan |
| --- | --- | --- |
| Photon energy, responsivity, quantum efficiency | none | `photon.js` (§2.3) |
| The photodiode as a circuit element | a diode with a reverse current | `pd` in `netlist.js` `KINDS`, a current source set by the light |
| Detector noise and the receiver's sensitivity | densities only | `receiver.js` (§2.4) |
| The LED and the laser above and below threshold | a forward diode | `source.js` (§2.5) |
| The rate equations, steady state and linearised | none | `rate.js` (§2.6) |
| Fibre attenuation and dispersion | none | `fibre.js` (§2.7) |
| The Fabry-Perot cavity | none | `cavity.js` (§2.8) |
| The optical link budget | none | `link.js` in `packages/rf`, reused (§2.9) |

### 2.2 The scope stance, object by object

`CORE_SCOPE.md` is answered here once, for every object the package holds. Each row
says admitted, guarded or declined, and the reason. §2.10's invariants test each row.

| Object | Stance | Reason |
| --- | --- | --- |
| Photon energy and responsivity | admitted, exact | `R = η q λ / h c`, algebra over constants |
| The photodiode as a current source with a junction | admitted, exact | an ordinary `packages/network` element, solved as any other |
| Shot noise `2qI` and thermal noise `4kT/R` as densities | admitted, exact | the Electronics Lab's, unchanged |
| The receiver's sensitivity from a Q factor | admitted, exact for the model | Gaussian statistics on both levels, with the bit error rate cited to the Communications Lab |
| The LED's power against current | admitted, exact for the model | a linear internal efficiency, which the pane names as the model it is |
| The LED's modulation bandwidth `1/(2π τ)` | admitted, exact | a first-order lag from one carrier lifetime |
| The laser's steady state above threshold | admitted, exact | the two rate equations set to zero solve in closed form |
| The threshold current | admitted, exact | it follows from the steady state, and no approximation enters |
| The relaxation oscillation as a second-order H(s) | guarded | a linearisation about the steady state, with the modulation depth as the threshold |
| The rate equations in large signal, in time | **declined** | a timestep solver's error cannot be told from physics, the reason `diode.js` gives |
| Fibre attenuation over length | admitted, exact | an exponential in length, stated in dB/km |
| Chromatic dispersion as pulse spreading | admitted, exact for the first-order model | `Δτ = D L Δλ`, with `D` a stated fibre property |
| The bandwidth-distance product | admitted, exact for the criterion | the criterion `B σ ≤ 0.25` is stated on the pane, and other criteria give other numbers |
| Higher-order dispersion and nonlinear propagation | declined in v1 | they need the propagation equation solved in space, which is the private simulator's |
| The Fabry-Perot transfer function | admitted, exact | the Airy form is a closed form in the round-trip phase |
| The cavity as a rational H(s) | **declined** | the round-trip phase `e^{−j2βL}` is transcendental, exactly as the transmission line is |
| The optical link budget | admitted, exact | a sum of stated line items, with the System Lab's guards |
| The modulated high-speed link, the eye, jitter | **out of this repo** | the private `waveform-simulator`, by the root README |

Two rows are worth pairing, because they are the same fact twice. The Fabry-Perot
cavity and the transmission line are both periodic in a round-trip phase, and neither
has a rational H(s). The RF Lab's Group A makes that point about the line. This lab's
Group F makes it about the cavity, and the two labs cross-reference each other.

### 2.3 The photon and the photodiode

`photon.js` holds four closed forms. Photon energy `E = h c / λ`, which is
`1.23984 eV` at one micrometre. The responsivity `R = η q λ / (h c)`, which is
`η λ / 1.23984` in A/W with `λ` in micrometres. The cut-off wavelength of a material
of bandgap `E_g`, which is `h c / E_g`. And the photon flux `P / E`, which the quantum
limit needs.

The photodiode is a `packages/network` element, not a formula. It is a junction with a
current source of `R P_opt` in parallel, and the dark current as a second source. The
solver treats it as any other element, so a photodiode into a load resistor is an
ordinary circuit and its operating point comes from the same Newton iteration.

That is the design decision this section rests on. A photodiode is a circuit element
and its light is a knob. The reader loads a circuit, turns the light, and reads the
current, and no part of the answer is computed outside the solver.

### 2.4 The receiver

`receiver.js` sums the noise sources at the detector and returns a sensitivity. The
shot noise density is `2 q I` where `I` is the total current including the dark
current. The thermal density of a load `R` at temperature `T` is `4 k T / R`. Both are
the Electronics Lab's, and this module sums them over a stated bandwidth.

Sensitivity follows from a Q factor. For equal noise on both levels the minimum
average optical power is `Q σ / R` with `σ` the rms noise current, and the pane states
that assumption. The Q factor's own relation to a bit error rate is the Communications
Lab's, and it is a number in a term panel here.

The quantum limit is the other end of the same question. An ideal receiver needs about
20 photons in a one bit, which averages to 10 per bit, and at 1550 nm and
1.000 Gbit/s that is `−58.923 dBm`. Real receivers sit tens of decibels above it, and
the gap is the content of Group B.

### 2.5 The LED and the laser as junctions

`source.js` gives both devices one shape. Below threshold a laser is an LED, and above
threshold its output rises with a different slope. Both are forward-biased junctions,
so both take their current from the same exponential law `packages/network` already
solves.

The LED's optical power is `η_int (h ν / q) I`, linear in current, and its modulation
bandwidth is `1/(2π τ_c)` from one carrier lifetime. At `τ_c = 5.0 ns` that is
31.831 MHz, which is the reason a fibre link past a hundred megabits uses a laser.

The laser's output above threshold is `η_d (h ν / q) (I − I_th)`, and the slope
`η_d h ν / q` is in W/A. The threshold current comes from the rate equations rather
than being typed, which is the next section's work.

### 2.6 The rate equations

`rate.js` holds the pair the lab teaches, in Agrawal's form. The carrier density `N`
and the photon density `S` in the active volume obey

```
dN/dt = I/(qV) − N/τ_c − G(N) S
dS/dt = Γ G(N) S − S/τ_p + Γ β N/τ_c
```

with `G(N) = g_0 (N − N_tr)` the gain, `Γ` the confinement factor, `τ_c` the carrier
lifetime, `τ_p` the photon lifetime and `β` the spontaneous coupling.

**The steady state is exact.** Setting both derivatives to zero with `β = 0` gives
`Γ G(N_th) = 1/τ_p`, so `N_th = N_tr + 1/(Γ g_0 τ_p)`. The threshold current is
`I_th = q V N_th / τ_c`, and above it the photon density is
`S = Γ τ_p (I − I_th)/(q V)`. Every one of those is algebra, and the solver returns
them without approximation.

**The linearisation is a second-order H(s), and it is exact.** Perturbing about the
steady state gives `H(s) = ω_r² / (s² + γ s + ω_r²)`. The damping is
`γ = 1/τ_c + g_0 S`, and `ω_r²` is the determinant of the Jacobian, which at zero
spontaneous coupling is `g_0 S / τ_p`. That is exactly rational, so it is admitted to
`@ee-labs/systems` in full, with the label stating the bias current it was taken at.
This is `CORE_SCOPE.md`'s "linearized transistor stage" row applied to a laser.

**One correction to the draft, measured in the sitting that built Group D.** The
first version of this section quoted the textbook form
`ω_r = √((I/I_th − 1)/(τ_p τ_c))`. That form drops the transparency density, and it
holds only when `Γ g_0 N_tr` is small beside `1/τ_p`. At §4.3's own parameters
`Γ g_0 N_tr` is 7.5 × 10¹¹ per second and `1/τ_p` is 5.0347 × 10¹¹ per second, so the
term it drops is the larger of the two. The exact form is high by
`√(Γ g_0 N_th τ_p)`, which is 1.5779 here. `rate.js` returns both, D3 prints both,
and `rate.test.js` pins the ratio.

**The guard is a modulation depth.** The linear answer describes the overshoot of a
current step to within 1.0853 % at 1 % depth, 5.2638 % at 5 % and 10.152 % at 10 %.
At 30 % the error is 26.760 % and at 60 % it is 45.596 %. §11's rule says a warn
threshold whose own measured error passes 10 % has to move. Ten per cent depth costs
10.152 %, so the pane draws the prediction without a flag to 5 %. Past 30 % it stops
drawing the prediction. §4.3 gives all five measured errors.

**The large-signal solution in time is declined**, with the reason `diode.js` gives. A
timestep solver's error cannot be told apart from physics in this suite. The steady
state and the linearised response carry every lesson in Group D, and the turn-on
transient is the private simulator's.

### 2.7 The fibre

`fibre.js` holds two closed forms and the geometry that goes with them. Attenuation is
`P(L) = P(0) 10^{−αL/10}` with `α` in dB/km, so 0.20 dB/km over 80 km is 16.000 dB and
a power ratio of 0.025119. Nothing here is approximate.

Chromatic dispersion spreads a pulse by `Δτ = D L Δλ`, with `D` the fibre's dispersion
parameter in ps/(nm km). The relation to the group-velocity term is
`β_2 = −D λ²/(2π c)`, which at 1550 nm and `D = 17 ps/(nm km)` is
`−21.683 ps²/km`. Both are exact for a first-order model, and the pane names what
first order leaves out.

The bandwidth limit needs a criterion, and the criterion is stated rather than
implied. The lab uses `B σ ≤ 0.25`, so a 1 nm source over 80 km of `D = 17` fibre is
limited to 0.1838 Gbit/s. Another criterion gives another number, and the pane says
which one is in use.

The geometry is three more closed forms. The numerical aperture `√(n_1² − n_2²)`, the
normalised frequency `V = 2π a NA / λ`, and the single-mode condition `V < 2.405`.
Each is exact. The number of modes in a large core, about `V²/2`, is a labelled
estimate.

### 2.8 The Fabry-Perot cavity

`cavity.js` gives the Airy transmission of a two-mirror cavity as a function of the
round-trip phase. The free spectral range is `c/(2 n L)`, which in wavelength at
`λ` is `λ²/(2 n L)`. The finesse is `π √R / (1 − R)`, and the linewidth is the free
spectral range divided by the finesse.

The cavity is the laser's own structure. The same module gives the mirror loss
`α_m = (1/2L) ln(1/R)` that the photon lifetime comes from. A reader who turns the
facet reflectance sees the threshold current move. The two panes agree because they
share one number.

The transfer function is exact at every frequency and has no rational form. The
round-trip factor `e^{−j2βL}` is transcendental, exactly as the transmission line's
`e^{−γl}` is, so the hand-over to `systems` is declined with the same sentence. The
RF Lab's Group A is cross-referenced as the other place the suite makes this point.

### 2.9 The link budget

The optical link budget is a sum of decibels, and `packages/rf/src/link.js` already
holds that sum for the radio link. This lab reuses it with optical units and optical
line items. The transmitted power, the fibre's attenuation, the connectors, the
splices, the dispersion penalty, and a system margin.

The System Lab's guard applies unchanged. Every loss the model does not include is a
named line item set to zero, drawn as a zero-height bar, so a zero is a decision. For
the optical link those are the modal noise, the reflection penalty and the mode-partition
noise.

### 2.10 Measures

Photon energy and wavelength. Responsivity in A/W and quantum efficiency. Photocurrent
and dark current. Shot and thermal noise densities, and the rms current over a stated
band. Noise-equivalent power. Sensitivity in dBm for a stated Q. Threshold current,
slope efficiency, and optical power in mW and dBm. The relaxation frequency, the
damping and the peak height. Attenuation in dB and the power ratio. Pulse spread in
ps and the bandwidth limit. Numerical aperture, `V`, and the mode count. Free spectral
range in GHz and nm, finesse, and linewidth. The link's margin.

### 2.11 Invariants, the fuzzer's checklist

Across random device parameters, random wavelengths in the three bands, and random
fibre lengths:

1. **Responsivity is bounded.** `R ≤ q λ / (h c)` for every quantum efficiency at or
   below one, with equality at unity, to floating point.
2. **The photodiode is a circuit.** The current a photodiode delivers into any load
   equals `R P_opt` minus what the junction takes back, computed by the same Newton
   iteration as any diode, and KCL holds at every node.
3. **Noise sums in power.** The total density equals the sum of the shot and thermal
   densities to floating point, and removing one source changes the total by exactly
   that source.
4. **The steady state satisfies the equations.** Substituting the returned `N` and `S`
   into both rate equations gives zero to floating point, at ten currents above
   threshold.
5. **Threshold is where the slope changes.** The output power below `I_th` is the
   spontaneous term alone, and the slope above it is `η_d h ν / q` to floating point.
6. **The linearisation is the derivative.** The small-signal response at low frequency
   equals the slope of the steady-state curve at the bias point, to `1e-6` relative.
7. **The relaxation frequency scales.** `f_r` is proportional to `√(I/I_th − 1)` to
   floating point across ten bias currents.
8. **The guard is measured.** The overshoot error against a numerically integrated
   step is under 10 % at the warn threshold and over 25 % at the decline threshold.
   The test measures the error at each threshold rather than asserting the threshold,
   so a threshold that stops meeting §11's rule fails the suite.
9. **Attenuation composes.** The loss of `L_1 + L_2` equals the sum of the two losses
   in decibels to floating point, and the power ratio equals the product.
10. **Dispersion composes.** The spread over `L_1 + L_2` equals the sum of the two
    spreads, and `β_2` recovered from `D` returns `D` to `1e-12` relative.
11. **The cavity is periodic.** The transmission at a round-trip phase and at that
    phase plus `2π` are equal to floating point, and the peaks are one free spectral
    range apart to `1e-12`.
12. **The cavity is not rational.** The hand-over to `systems` is declined, the
    message names the transcendental factor, and the test asserts the refusal.
13. **Cross-lab.** The photodiode's shot noise equals the Electronics Lab's O3 for the
    same current. The laser's linearised H(s) sent to Control Lab gives the same
    damping ratio there as here. The link budget's sum equals the System Lab's for the
    same line items.

---

## 3. Models: the element library

Everything `packages/network` stamps stays. These are added, and each is either a
circuit element or a closed form with the parameters that define it.

| Element | Ideal law | Non-ideality toggles (each labelled) |
| --- | --- | --- |
| Photodiode (`pd`) | a junction with a photocurrent source `R P_opt` in parallel | dark current, junction capacitance from `junction.js`, series resistance, quantum efficiency below one |
| Avalanche photodiode | the same, with a multiplication factor `M` | the excess noise factor `F(M)`, which is a labelled empirical form |
| LED | a forward junction, power linear in current | internal efficiency, carrier lifetime setting the bandwidth, a spectral width in nm |
| Laser diode | a forward junction plus the two rate equations | threshold current, differential efficiency, photon and carrier lifetimes, the confinement factor, the spontaneous coupling |
| Fibre | attenuation in dB/km and dispersion in ps/(nm km) | length, core radius, the two refractive indices, and a second-order dispersion term as a toggle |
| Connector and splice | a fixed loss in dB | none, these are stated line items |
| Fabry-Perot cavity | the Airy transmission from two reflectances and a length | the internal loss, which changes the finesse |
| Optical source | a wavelength, a power and a spectral width | none, these are the three numbers a datasheet gives |

**Schematic description.** As every other lab, each library circuit is a netlist with
grid positions, drawn by `packages/ui/Schematic.jsx`. Three symbols are added. A
photodiode with its two arrows, a laser diode with its two outward arrows, and a fibre
drawn as a curve with its length printed. Each carries the same live-meter slots.

---

## 4. The app

### 4.1 Layout

The Electronics Lab's shape, unchanged. Sidebar with LabNav, the report link, the
experiment groups, the circuit picker, component NumFields with chips, model and
toggle switches, and the math panel. Main area with topbar meters, the schematic or
the link strip always visible, and one pane below with a pane selector. Phone-width
first, with no horizontal scroll at 390 px, harness-checked.

The topbar shows the wavelength first, then the experiment's headline numbers. Those
are the responsivity, the photocurrent, the threshold current, the relaxation
frequency, the attenuation, the pulse spread or the margin, whichever the experiment
uses. The optical power is shown in mW and dBm together, because both are quoted in
practice.

### 4.2 Views

- **Link view.** New, and the lab's signature view. The transmitter, the fibre and the
  receiver as three blocks with the optical power drawn as a line falling along the
  length. Clicking the transmitter or the receiver opens its schematic. The budget
  below it is the System Lab's waterfall with optical units, and that component is
  shared with the System Lab named as its second user from the first commit.
- **Schematic with live meters.** The photodiode into its load, the laser and its
  drive, drawn by the shared renderer. The light is a knob and the current is a meter,
  and the DC and AC overlays are the Electronics Lab's.
- **Device curves.** Optical power against current for the LED and the laser, with the
  threshold marked and the slope printed on each side of it. The photodiode's current
  against reverse voltage at stepped illumination, with the load line.
- **Noise view.** The output noise density as a stack, one band per source, with the
  rms over the stated band in the corner. This is the Electronics Lab's noise view
  with two optical sources added, and the component is shared.
- **Modulation response.** `|H(f)|` of the linearised laser, with the relaxation peak
  marked and its height printed. The dashed small-signal prediction turns amber past
  10 % modulation depth and disappears past 30 %, which is the guard on screen.
- **Pulse view.** A pulse entering the fibre and the same pulse leaving it, spread by
  `D L Δλ`, with both widths printed. The bandwidth limit follows from the criterion,
  and the criterion is named under the plot.
- **Cavity view.** The Airy transmission against frequency, with the free spectral
  range, the finesse and the linewidth marked. Turning the reflectance moves all
  three, and the same reflectance moves the laser's threshold in the device curves.
- **Spectrum.** The source's spectral width against the fibre's dispersion, and the
  wavelength grid for multiplexing. Drawn on the same axis so a channel spacing and a
  source width are comparable.
- **Equations.** The rate equations printed with the reader's numbers substituted,
  then the steady state solved, then the linearised H(s) with its poles. The Elements
  lab's equations pane is the model.

### 4.3 Numbers

The defaults are chosen so that every quoted number is round enough to remember and
every picture fits a phone. All were computed before they were written here.

- Constants: `h c / q = 1.23984 eV µm`. At 1550 nm a photon carries 0.79990 eV, at
  1310 nm it carries 0.94644 eV, and at 850 nm it carries 1.45864 eV. The optical
  frequency at 1550 nm is 193.41 THz.
- Responsivity at `η = 0.8`: 1.00013 A/W at 1550 nm, 0.84527 A/W at 1310 nm and
  0.54846 A/W at 850 nm. Silicon's 1.12 eV bandgap cuts off at 1107.0 nm, which is why
  a 1550 nm receiver uses InGaAs.
- Detector currents: 1.0 µW at 1550 nm and `η = 0.8` gives 1.0001 µA. Over a
  1.000 GHz band its shot noise is 17.901 nA rms. A 1.000 nA dark current contributes
  566.07 pA over the same band.
- Noise densities: shot noise at 1.000 µA is 0.5661 pA/√Hz. Thermal noise of 1.000 kΩ
  at 300 K is 4.0704 pA/√Hz. The two are equal at 51.704 µA, so a receiver below that
  current is thermally limited.
- Thermal noise over 1.000 GHz: 575.64 nA rms into 50 Ω, 128.72 nA into 1.000 kΩ and
  40.704 nA into 10.00 kΩ. The load resistance buys sensitivity and costs bandwidth,
  which is the transimpedance amplifier's whole reason.
- Sensitivity for `Q = 6`, which is a bit error rate of 9.87e-10: −31.122 dBm with a
  1.000 kΩ load over 1.000 GHz, and −34.617 dBm with 5.000 kΩ. The quantum limit at
  the same rate is −58.923 dBm, so the gap is 27.8 dB.
- The LED: at a carrier lifetime of 5.0 ns the modulation bandwidth is 31.831 MHz. At
  1.0 ns it is 159.15 MHz and at 20.0 ns it is 7.9577 MHz. One pole falls 20 dB a
  decade, and 6.0203 dB an octave when it is measured a hundred corners out.
- Slope efficiency at 1550 nm, where `h ν / q = 0.79990 V`: 0.15998 mW/mA at
  `η_d = 0.2`, 0.31996 mW/mA at 0.4 and 0.47994 mW/mA at 0.6.
- The laser's parameters: `τ_c = 2.00 ns`, `Γ = 0.3`, `g_0 = 2.500e-12 m³/s`,
  `N_tr = 1.000e24 m⁻³`, `V = 1.000e-16 m³` and `β = 0`. The photon lifetime is not
  typed. It is what a 100 µm cleaved chip of index 3.5 gives under §2.8's mirror-loss
  convention, which is `τ_p = 1.9862 ps`. So `N_th = 1.6713e24 m⁻³` and
  `I_th = 13.389 mA`. That keeps the lab to one laser: C5 turns the same chip's facet
  reflectance and reads the same threshold Group D pins.
- The other mirror-loss convention, where a round trip loses the reflectance, halves
  the photon lifetime and puts the threshold at 18.766 mA. `rate.test.js` carries that
  number so the choice stays visible.
- The relaxation oscillation at `I = 2 I_th`, which is 26.777 mA: the photon density
  is 4.9793e20 m⁻³. The frequency is 3.9844 GHz, the damping is 1.7448 per ns and the
  damping ratio is 0.034848. The peak is 23.141 dB high at 3.9795 GHz and the 3 dB
  bandwidth is 6.1855 GHz.
- The same at other currents: 2.8174 GHz at 1.5 `I_th`, 5.6348 GHz at 3 `I_th` and
  7.9688 GHz at 5 `I_th`. The frequency follows `√(I/I_th − 1)` exactly.
- The textbook form at the same four currents: 1.7856 GHz, 2.5252 GHz, 3.5711 GHz and
  5.0503 GHz. The exact form is 1.5779 times each of them, at every current.
- The linearisation's guard, measured against a numerically integrated step at
  `2 I_th`. The overshoot error is 1.0853 % at 1 % modulation depth, 5.2638 % at 5 %,
  10.152 % at 10 %, 26.760 % at 30 % and 45.596 % at 60 %. The warn threshold is 5 %
  and the decline threshold is 30 %.
- The junction both devices are, at 2.5 V through 68 Ω with `I_S = 1 pA` and `n = 2`:
  18.778 mA at a forward voltage of 1.2231 V. At 1.8 V it is 9.0396 mA and at 3.3 V it
  is 30.182 mA. A factor of three in current costs a tenth of a volt.
- The LED at `η_int = 0.2` and 1550 nm: a slope of 0.15998 mW/mA, so 20 mA makes
  3.1996 mW. At 1310 nm the slope is 0.18929 mW/mA and at 850 nm it is 0.29173 mW/mA.
- The laser's spontaneous path at `η_sp = 0.002`: a slope of 0.0015998 mW/mA. The two
  slopes stand in a ratio of 200.00, so the kink at threshold is sharp.
- C5's chip at three facet reflectances: 58.779 per cm and 1.9862 ps at 0.30864,
  115.13 per cm and 1.0141 ps at 0.10, and 5.2680 per cm and 22.162 ps at 0.90. The
  thresholds are 13.389 mA, 18.544 mA and 8.4929 mA. Stretching the same chip to
  300 µm gives 5.9587 ps, a threshold of 9.8034 mA and the 142.76 GHz free spectral
  range F1 draws.
- The fibre: 0.20 dB/km at 1550 nm, 0.35 dB/km at 1310 nm and 2.0 dB/km at 850 nm.
  Over 80 km those are 16.000 dB, 28.000 dB and 160.00 dB, and the first is a power
  ratio of 0.025119.
- Dispersion at `D = 17 ps/(nm km)`: a 1 nm source over 80 km spreads by 1360.0 ps,
  which limits the rate to 0.1838 Gbit/s under `B σ ≤ 0.25`. A 0.1 nm source over the
  same 80 km spreads by 136.00 ps and allows 1.8382 Gbit/s. The bandwidth-distance
  product is 14.706 Gbit/s km per nm.
- `β_2 = −D λ²/(2π c)` is `−21.683 ps²/km` at 1550 nm and `−15.488 ps²/km` at
  1310 nm for the same `D`. At `D = −2 ps/(nm km)` it is `+2.5509 ps²/km`.
- Fibre geometry: `n_1 = 1.4675` and `n_2 = 1.4622` give `NA = 0.12461`, an acceptance
  angle of 7.1582 degrees and `Δ = 0.36 %`. Single-mode operation at 1550 nm needs a
  core diameter under 9.5224 µm. A 50.00 µm core at 850 nm has `V = 23.028` and about
  265 modes.
- The cavity: `n = 3.5` and `L = 300 µm` give a facet reflectance of 0.30864, a free
  spectral range of 142.76 GHz, and 1.14405 nm at 1550 nm. The finesse is 2.5245 and
  the linewidth is 56.549 GHz. The mirror loss is 19.593 per cm.
- Finesse against reflectance: 2.4582 at `R = 0.3`, 29.804 at `R = 0.9` and 312.58 at
  `R = 0.99`. The peak to valley contrast at those three is 5.377 dB, 25.575 dB and
  45.977 dB.
- The link: −3 dBm in, 16.000 dB of fibre over 80 km, 1.00 dB for two connectors,
  0.40 dB for eight splices and 1.00 dB of dispersion penalty. The total is 18.40 dB,
  so −21.400 dBm arrives against a −28 dBm sensitivity. The margin is 6.600 dB.
- The loss-limited reach with 3.00 dB reserved is 98.000 km, and the
  dispersion-limited reach at 10.00 Gbit/s with a 1 nm source is 1.4706 km. Dispersion
  is the binding limit, which is why a fast link uses a narrow source.
- Multiplexing: a 100 GHz grid at 1550 nm is 0.80139 nm wide. The C band from 1530 nm
  to 1565 nm is 4.3821 THz, which holds 43 channels on that grid.

---

## 5. Curriculum: 25 experiments in 6 groups

Format, as the other plans: **the claim** the note makes, what the reader turns, and
what is **measured** against what **formula**. Every quoted number becomes a pinned
test. The order is the progression map's. Each experiment ships with `see`, `try` and
`why` in the three registers, within the `STYLE.md` budgets.

### Group A: Light, and the photodiode (5)

- **A1 · A photon carries `h c / λ`.** At 1550 nm that is 0.79990 eV, at 1310 nm it is
  0.94644 eV and at 850 nm it is 1.45864 eV. A milliwatt at 1550 nm is
  7.8 × 10¹⁵ photons a second. Turn the wavelength and watch the energy fall.
  Measured: the energy at three wavelengths, and the flux.
- **A2 · The photodiode is a circuit element.** A reverse-biased junction with light on
  it carries `R P_opt` whatever the reverse voltage, until the junction runs out of
  bias. The load line crosses the flat part, and the same Newton iteration that solves
  Elements I2 solves this. Measured: the current at four bias voltages, and the
  operating point on the load line.
- **A3 · Responsivity, and where it stops.** `R = η λ / 1.23984` in A/W. At `η = 0.8`
  that is 1.00013 A/W at 1550 nm and 0.54846 A/W at 850 nm. Silicon stops at
  1107.0 nm because its bandgap is 1.12 eV, and the curve falls to zero there.
  Measured: `R` at three wavelengths, and the cut-off from the bandgap.
- **A4 · Dark current, and the diode underneath.** Turn the light off and the junction's
  own reverse current remains. At 1.000 nA it adds nothing to a 1.0 µA photocurrent
  and everything to a 1 nA one. Measured: the total current at four illuminations, and
  the level at which the dark current dominates.
- **A5 · Speed costs area.** The junction capacitance from Electronics C2 into the load
  makes a first-order lag. A larger diode catches more light and is slower, and the
  product of the two is what a designer trades. Measured: the corner frequency at
  three capacitances, and the collected power against area.

### Group B: The receiver (4)

Electronics O3 already teaches shot noise on a junction. This group starts at the
comparison between shot and thermal noise, per Decision 5.

- **B1 · Two noise sources, and which one wins.** Shot noise at 1.000 µA is
  0.5661 pA/√Hz. Thermal noise of 1.000 kΩ at 300 K is 4.0704 pA/√Hz. They are equal
  at 51.704 µA, so a fibre receiver is almost always thermally limited. Measured: both
  densities at four currents, and the crossover.
- **B2 · The load resistance is the whole trade.** Over 1.000 GHz the thermal noise is
  575.64 nA into 50 Ω, 128.72 nA into 1.000 kΩ and 40.704 nA into 10.00 kΩ. A larger
  resistance is quieter and slower. The Applied Analog Lab's transimpedance amplifier
  is the way out, and the term panel names it. Measured: the noise and the bandwidth
  at three resistances.
- **B3 · Sensitivity.** For `Q = 6`, which is a bit error rate of 9.87e-10, a 1.000 kΩ
  receiver over 1.000 GHz hears −31.122 dBm. Raise the resistance to 5.000 kΩ and it
  hears −34.617 dBm. Measured: the sensitivity at two resistances and two bandwidths.
- **B4 · The quantum limit, and the 27.8 dB gap.** An ideal receiver needs 20 photons
  in a one bit, averaging 10 per bit, which at 1550 nm and 1.000 Gbit/s is
  −58.923 dBm. The thermally limited receiver of B3 sits 27.8 dB above it. The
  Communications Lab's channel group is where the Q factor becomes a bit error rate,
  and the Random Signals Lab's estimation group (being built) is where its uncertainty
  is treated. Measured: the quantum limit, and the gap.

### Group C: The LED and the laser as junctions (5)

- **C1 · Both are forward-biased junctions.** Elements I1's exponential law drives both.
  At 2.5 V through 68 Ω the junction carries 18.778 mA at 1.2231 V, and nothing in the
  circuit tells an LED from a laser. That current makes 3.0041 mW as an LED and
  1.7458 mW as a laser. Measured: the solved operating point at three supplies, and the
  two optical powers at each.
- **C2 · The LED's power is linear in current.** `P = η_int (h ν / q) I`, so at
  1550 nm each milliamp buys `0.79990 η_int` milliwatts. At `η_int = 0.2` the slope is
  0.15998 mW/mA and 20 mA makes 3.1996 mW. Double the current and double the light.
  Measured: the power at four currents, and the slope at three efficiencies and three
  wavelengths.
- **C3 · The LED is slow.** One carrier lifetime gives one pole at `1/(2π τ_c)`. At
  5.0 ns that is 31.831 MHz, at 1.0 ns it is 159.15 MHz and at 20.0 ns it is
  7.9577 MHz. Measured: the corner at three lifetimes, and the roll-off's slope in both
  unit systems.
- **C4 · The laser has a threshold.** Below 13.389 mA the output is spontaneous and
  small. Above it the output rises at `η_d h ν / q`, which is 0.31996 mW/mA at
  `η_d = 0.4`. The kink is sharp because the gain is clamped. Measured: the threshold,
  both slopes, and the ratio of 200.00 between them.
- **C5 · Threshold moves with the mirrors.** Lower the facet reflectance and the photon
  lifetime falls, so the threshold rises. At 0.90 the lifetime is 22.162 ps and the
  threshold is 8.4929 mA, and at 0.10 they are 1.0141 ps and 18.544 mA. The same cavity
  sets the free spectral range in Group F. Measured: the threshold at three
  reflectances, the photon lifetime behind each, and the 142.76 GHz a 300 µm chip
  shares with F1.

### Group D: The rate equations (4)

- **D1 · Two equations, and what each term is.** Carriers in from the current, out by
  recombination, out by stimulated emission. Photons in by stimulated emission, out by
  the cavity. Every term is a rate of density, and the pane prints each with the
  reader's numbers. At 26.777 mA the pump delivers 1.6713 × 10³³ per cubic metre a
  second. Measured: each term's value at the steady state, and that each sum is zero to
  its own largest term's last bits.
- **D2 · The steady state, exactly.** Setting both derivatives to zero gives
  `N_th = N_tr + 1/(Γ g_0 τ_p) = 1.6713e24 m⁻³` and `I_th = 13.389 mA`. Above
  threshold the photon density is `Γ τ_p (I − I_th)/(q V)`, which at `2 I_th` is
  4.9793e20 m⁻³. Nothing here is approximated. Measured: both densities and the
  threshold, substituted back into the equations, and the threshold at three
  confinement factors and three transparency densities.
- **D3 · The relaxation oscillation.** Linearise about the steady state and the pair
  becomes `ω_r²/(s² + γ s + ω_r²)`. At `2 I_th` that is 3.9844 GHz with a damping ratio
  of 0.034848, a 23.141 dB peak and a 6.1855 GHz bandwidth. The frequency follows
  `√(I/I_th − 1)`. The textbook form gives 2.5252 GHz at the same bias, and the pane
  prints both. Measured: `f_r` at four currents, both forms, the peak height, and the
  bandwidth.
- **D4 · Where the linearisation stops.** Step the current and compare the measured
  overshoot with the linear prediction. At 5 % modulation depth the error is 5.2638 %,
  at 10 % it is 10.152 % and at 30 % it is 26.760 %. The pane draws the prediction
  without a flag to 5 %, as an estimate to 30 %, and not at all past that. The
  large-signal solution in time is declined, with the reason. Measured: the error at
  five depths, and the guard at both thresholds.

### Group E: The fibre (5)

- **E1 · Attenuation, and the three windows.** 0.20 dB/km at 1550 nm, 0.35 dB/km at
  1310 nm and 2.0 dB/km at 850 nm. Over 80 km those are 16.000 dB, 28.000 dB and
  160.00 dB. The first leaves 2.5119 % of the light and the last leaves 1e-16 of it.
  Measured: the loss and the power ratio at three wavelengths and three lengths.
- **E2 · Dispersion spreads a pulse.** `Δτ = D L Δλ`. A 1 nm source over 80 km of
  `D = 17` fibre spreads by 1360.0 ps. Narrow the source to 0.1 nm and the spread falls
  to 136.00 ps. Measured: the spread at three source widths and two lengths.
- **E3 · The bandwidth-distance product, under a stated criterion.** Under
  `B σ ≤ 0.25` a 1 nm source over 80 km is limited to 0.1838 Gbit/s, and the product
  is 14.706 Gbit/s km per nm. The criterion is on the pane, because another criterion
  gives another number. Measured: the limit at four combinations, and the product.
- **E4 · The core, the cladding, and one mode.** `NA = √(n_1² − n_2²) = 0.12461` for
  `n_1 = 1.4675` and `n_2 = 1.4622`, an acceptance angle of 7.1582 degrees. Single-mode
  operation at 1550 nm needs a core under 9.5224 µm across. A 50.00 µm core at 850 nm
  carries about 265 modes. Measured: `NA`, the angle, the single-mode diameter, and the
  mode count.
- **E5 · The link budget, and which limit binds.** −3 dBm in, 18.40 dB of total loss,
  −21.400 dBm out against a −28 dBm sensitivity, and a 6.600 dB margin. The
  loss-limited reach is 98.000 km and the dispersion-limited reach at 10.00 Gbit/s
  with a 1 nm source is 1.4706 km. Measured: every line item, the margin, and both
  reaches.

### Group F: The cavity, and many colours (2)

- **F1 · The Fabry-Perot cavity, and why it has no transfer function.** With `n = 3.5`
  and `L = 300 µm` the free spectral range is 142.76 GHz, the finesse is 2.5245 and the
  linewidth is 56.549 GHz. Raise the reflectance to 0.99 and the finesse becomes
  312.58. The response is exact at every frequency and has no rational form, for the
  reason the RF Lab's A5 gives about the line. Measured: all three quantities at three
  reflectances, and the refusal.
- **F2 · Many colours down one fibre.** A 100 GHz grid at 1550 nm is 0.80139 nm wide,
  and the C band from 1530 nm to 1565 nm is 4.3821 THz, which holds 43 channels. Each
  channel needs a source narrower than the grid, which is E2's requirement seen from
  the other side. Measured: the grid in nm, the band in THz, and the channel count.

---

## 6. Hand-overs

- **← Electronics Lab** (A2, A4, A5, B1, C1). Its Group C gives the junction's closed
  forms, its I1 gives the exponential law, and its Group O gives the noise densities.
  The photodiode element extends the diode this suite already solves, so no new solver
  is added.
- **← Circuit Lab** (A5, C3, D3). A first-order lag and a second-order H(s) are read
  there. The laser's linearised response crosses as an exact rational H(s), presented
  without qualification per the CORE_SCOPE counter-rule.
- **→ Control Lab** (D3). The relaxation oscillation is a lightly damped second-order
  plant, with a damping ratio of 0.034848 at `2 I_th`. It is exactly the kind of plant
  Control Lab's "Harder plants" group teaches, and the two labs' damping ratios are
  pinned equal. `smallSignal` returns the numerator and the denominator in descending
  powers of s, which is the shape `@ee-labs/systems` takes.
- **→ System Lab** (E5, F2). The optical link budget is the System Lab's waterfall
  with optical units, and `link.js` is shared code rather than a copied sum. The
  waterfall component is shared with the System Lab named as its second user.
- **↔ RF Lab** (F1). Both labs meet a transcendental round-trip factor and both
  decline a rational form. The two experiments cross-reference each other, and the
  refusal messages are checked to name the same reason.
- **← Applied Analog Lab** (B2, B3). Its front-end group owns the transimpedance
  amplifier. Until it exists, Group B models the receiver as a photodiode into a load
  resistance and names the missing amplifier in a term panel.
- **→ the private waveform simulator.** The modulated high-speed link, the eye diagram
  and jitter are out of this repo, by the root README. This plan records the seam and
  does not reopen it.

---

## 7. Testing discipline

- **Unit** (`packages/photonics`): `photon.js` against the four closed forms at three
  wavelengths. `receiver.js` against hand-computed noise sums. `rate.js` against the
  steady state substituted back, and against a numerically integrated step for the
  guard. `fibre.js` against hand-computed losses and spreads. `cavity.js` against the
  Airy form's peaks and its finesse.
- **Invariants** (§2.11), fuzzed across random device parameters, three wavelength
  bands and random fibre lengths. The hostile corners are included: a laser at exactly
  threshold, a photodiode with zero light, a cavity with a reflectance of one, and a
  fibre with zero dispersion.
- **Experiments**: every number in §5 pinned, as every other lab pins its notes. The
  detector pins are 0.79990 eV, 1.00013 A/W, 1107.0 nm, 0.5661 pA/√Hz and 51.704 µA.
  The source pins are 31.831 MHz, 13.389 mA, 0.31996 mW/mA, 3.9844 GHz and 23.141 dB.
  The fibre and cavity pins are 16.000 dB, 1360.0 ps, 14.706 Gbit/s km per nm,
  0.12461, 142.76 GHz and 6.600 dB.
- **The map's promises**: a test walks every experiment's `why` and every
  cross-reference in it. The referenced experiment must exist in the named lab. A
  reference to one that is not built fails the suite. That is what keeps the Applied
  Analog Lab and Communications Lab cross-references accurate.
- **Guards and refusals**: the modulation-depth guard at both sides of both
  thresholds, measured against the integrated step. The large-signal refusal, with its
  message. The cavity's `systems` refusal, with its message checked to match the RF
  Lab's. The bandwidth criterion named on the pane.
- **Cross-lab pins**: the photodiode's shot noise against Electronics O3. The laser's
  damping ratio in Control Lab. The link budget against the System Lab's for the same
  line items. The cavity refusal against the RF Lab's line refusal.
- **Playwright harness**: turning the facet reflectance moves the threshold in one
  pane and the free spectral range in another, and the two agree. The modulation
  response's dashed ghost turns amber past 10 % and disappears past 30 %. No
  horizontal scroll at 390 px.
- **REVIEW_PLAYBOOK audit** before release, all eleven classes, a screenshot pass, and
  the sittings script from `apps/circuit-elements-lab/SITTINGS.md` with three seats.
  One seat sits Group D, because the rate equations are the least circuit-like content
  in the suite.

---

## 8. Integration and the dark launch

The mechanism is the one Power Lab and the Elements lab share, unchanged.

- Deployed **dark** at `/photonics-lab/` from the first vertical slice. Unlisted, and
  not secret.
- `apps/photonics-lab/RELEASE_STATUS` reads `dark`. A test asserts that while it does,
  the splash, the root README and the other labs' LabNav contain no reference to the
  Photonics Lab. Flip the word to `released` and the same test demands the splash
  card, the README row and the nav entries, with counts pinned.
- `packages/photonics` is a new package and is listed in `EE_LABS_MAP.md` §3 by the
  director, per `PROGRAM.md` §5. The waterfall component and the noise view are shared
  surfaces and go through the director with their second users named.
- `deploy.yml` gains one `cp` line, from this lab's `NEEDS.md`.
- The flip is **Reed's action**, after the release gate in §9.

---

## 9. Phasing

Each phase ships green and deployable dark. Groups A, E and F need only what is on the
site today, which is twelve of the twenty-five experiments and three of the six
groups.

1. **Photons and the fibre.** `photon.js`, `fibre.js`, the app shell, the schematic
   with the photodiode symbol, the pulse view, the dark deploy and the
   `RELEASE_STATUS` test. **Groups A and E** (10). Exit: invariants 1, 2, 9 and 10
   green, and every A and E number pinned.
2. **The cavity.** `cavity.js`, the cavity view, the link view's first form.
   **Group F** (2). Exit: invariants 11 and 12 green, and the refusal message checked
   against the RF Lab's.
3. **The rate equations.** `rate.js` and `source.js`, the device curves, the equations
   pane, the modulation response view and the step view. **Groups C and D** (9).
   Built 2026-09-05. Exit met: invariants 4 to 8 green, the guard measured at five
   depths, and the linearised `H(s)` returned in the shape Control Lab takes.
4. **The receiver.** `receiver.js`, the noise view, the sensitivity readout.
   **Group B** (4). Exit: invariant 3 green, and B3's two sensitivities pinned against
   the Electronics Lab's densities.
5. **The link, finished.** The waterfall with optical units, shared with the System
   Lab. The multiplexing view. Exit: the budget's sum equals the System Lab's for the
   same line items.
6. **The release gate**, in order, each blocking the next. The full audit, every
   option, every preset, every claim, fuzzing, both browsers. The student sittings.
   Reed's own pass against the dark deployment. Then the flip.

Phases 1 and 2 depend on nothing unbuilt. Phase 3 depends on nothing unbuilt either,
because the rate equations are this lab's own work. Phase 4 needs the Electronics
Lab's Group O. Phase 5 needs the System Lab's waterfall or a local copy of it, and
the director decides which.

---

## 10. Non-goals (v1, stated so they are decisions rather than omissions)

- **The modulated high-speed link.** The eye diagram, jitter and equalisation are the
  private `waveform-simulator`'s, by the root README and by `EE_LABS_MAP.md` §2. This
  lab stops at the steady-state and small-signal descriptions of each part.
- **The rate equations in large signal.** Declined with the reason `diode.js` gives.
  The steady state is exact and the linearisation is guarded, and between them they
  carry Group D.
- **Nonlinear propagation.** Self-phase modulation, four-wave mixing and solitons need
  the propagation equation solved along the fibre. That is the private simulator's, and
  no closed form replaces it.
- **Higher-order dispersion and polarisation-mode dispersion.** Each changes a number
  and needs data rather than physics the lab can state. The second-order term is a
  toggle, labelled.
- **Optical amplifiers.** The erbium-doped amplifier's gain and noise figure need a
  population model and a set of cross-sections, which are measured data.
- **Coherent detection and phase modulation.** They need the optical phase as a state
  through the link, which is the modulated link this plan excludes.
- **Waveguide modes derived from Maxwell's equations.** The Fields Lab's second half
  owns the wave equation. This lab uses `V`, `NA` and the mode count, and cites that
  lab for where they come from.
- **Photonic integrated circuits, gratings, ring resonators.** Each is a cavity or a
  filter with its own geometry, and one Fabry-Perot is enough to make the point about
  round-trip phase.
- **Detectors past the photodiode.** Photomultipliers, bolometers and image sensors
  are other physics and other courses.
- **Optical power meters and spectrum analysers as instruments.** The Instruments Lab
  covers how an instrument works, and nothing here is loaded from one.
- **A free-form link editor.** Curated links with editable values, as every other lab
  uses curated circuits.

---

## 11. Risks, named

- **The lab is the least circuit-like in the suite.** Two of its six groups are
  differential equations and closed forms rather than netlists. Mitigation: Groups A
  and C are circuits solved by the existing engine, the photodiode and the laser are
  `packages/network` elements, and Group D's equations pane prints the reader's own
  numbers term by term.
- **The rate equations' parameters are unfamiliar.** A confinement factor and a
  transparency density have no analogue in the rest of the suite. Mitigation: every
  parameter is a NumField with units and a chip, D1 shows each term's rate at the
  operating point, and the threshold current is derived from them rather than typed.
- **The modulation guard set at the wrong depth.** A depth is a choice.
  Mitigation: the threshold's number comes from the measured overshoot error in §4.3,
  invariant 8 pins that error at both thresholds, and the threshold moves if the
  measured error at it exceeds 10 %. That rule has already moved one. The draft put the
  warn threshold at 10 % depth, the measured error there is 10.152 %, and the threshold
  is now 5 % where the error is 5.2638 %.
- **Two unbuilt dependencies.** The Electronics Lab's Group O and the Applied Analog
  Lab's front end both feed Group B. Mitigation: §9 puts Group B in phase 4, and
  Decision 5 keeps the group at four experiments that need only the densities.
- **The private simulator's boundary read as a gap.** A reader who wants an eye diagram
  finds none. Mitigation: the boundary is stated in §2.2's table and in §10, in the
  same register the map uses, and no experiment promises what the next one withholds.
- **Numbers that are right for one laser.** Every quoted threshold and frequency is
  for the parameters in §4.3. Mitigation: each pin is a function of those parameters
  and is re-derived in the test, never typed as a constant.
- **A new package for twenty-five experiments.** `packages/photonics` holds five
  modules. Mitigation: three of them are closed forms with no state, the junction work
  stays in `packages/network`, and the link budget is reused from `packages/rf` rather
  than rewritten.
- **Cost.** One new package, one new view, and a curriculum that leans on one lab in
  flight and one that is mapped. Mitigation: phases 1 to 3 depend on nothing unbuilt
  and are twenty-one of the twenty-five experiments, which is a complete course in
  detectors, sources and fibre on its own.
