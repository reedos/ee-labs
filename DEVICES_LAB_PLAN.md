# Devices Lab: the plan

Track G's first lab: **semiconductor devices**, the course that sits under the
Electronics Lab and explains where its four closed forms come from. Electronics Group C
states the built-in potential, the junction capacitance, the diffusion capacitance and
the temperature law, and says which step is taken on trust. This lab takes those steps.
Splash glyph `⌗`, directory `apps/devices-lab`, engine as an extension of
`packages/network/src/junction.js`.

The path, in order. Carriers, doping and the Fermi level. The junction in depth, from
its charge profile to its I–V law and its breakdown. The MOS capacitor, and the C–V
curve the industry measures. The MOSFET derived from the MOS capacitor. The BJT from
two junctions. The solar cell and the LED. Fabrication as a sequence of cross-sections,
with the numbers each step sets.

This is a draft (2026-09-05) for Reed to settle. §0 lists what needs a decision, and
one of them changes a number the Electronics Lab has already pinned. §1 is the
progression map.

The two rules that govern the other labs govern this one with no exemption. **Every
explanatory sentence is a claim about physics, and a test must measure it.** And
`CORE_SCOPE.md` decides what the engine may state exactly, what it may approximate
behind a guard, and what it declines with a reason. This lab has one labelled model,
the depletion approximation, and everything inside it is exact. Transport beyond it is
declined, with the reason.

---

## 0. Open decisions

### Decision 1: the value of `n_i` (recommended: keep 1.5 × 10¹⁰ cm⁻³, and teach the spread)

`AGENT_BRIEF.md` §3.7 pins `N_I_300 = 1.5e16` m⁻³, and Electronics C1's `V_0` of
752.88 mV follows from it. Computing `n_i` from the band-edge densities gives a
different answer. With Green's 1990 values, `N_c = 2.86 × 10¹⁹ cm⁻³` and
`N_v = 2.66 × 10¹⁹ cm⁻³` at `E_g = 1.12 eV`, the result is 1.079 × 10¹⁰ cm⁻³. The
suite's constant is 1.39 times that, and it corresponds to an `E_g` of 1.103 eV rather
than 1.12 eV.

Both values are in print. Streetman uses 1.5 × 10¹⁰, Pierret and Sze use 1.0 × 10¹⁰.
Changing the constant would move `V_0` by 20.7 mV and would break every Electronics C
pin. The recommendation is to keep 1.5 × 10¹⁰ as the suite's constant, and to make the
spread the content of A2. That experiment computes `n_i` from `N_c`, `N_v` and `E_g`,
prints 1.079 × 10¹⁰ beside the constant, and says which textbook each belongs to.
Reed decides whether that is honest enough or whether the suite should move.

### Decision 2: no new package (recommended: extend `junction.js`, add `mos.js`)

`EE_LABS_MAP.md` §3 lists thirteen packages and no `devices`. The engine this lab needs
is two files of closed forms with no solver in them. The recommendation is that
`junction.js` grows the profile functions and a sibling `mos.js` holds the MOS
capacitor, both inside `packages/network`. The app owns the band diagram and the
cross-sections, which are drawings and not physics.

### Decision 3: `junction.js` is owned by the Electronics Lab's lane 3

`PROGRAM.md` §5 gives `packages/network` to the Electronics overseer. The
recommendation is that this lab writes its additions into `apps/devices-lab/NEEDS.md`
as a contract, and that the director resolves it once. Every existing export keeps its
signature, and the Electronics C tests are the regression.

### Decision 4: the threshold voltage default (recommended: derive 0.322 V, then implant to 0.700 V)

The Electronics Lab's MOSFET uses `V_t = 0.7 V` as a device fact. Deriving it here from
a 10 nm oxide, `N_A = 10¹⁷ cm⁻³` and an n⁺ polysilicon gate gives 321.77 mV. The gap is
not an error in either lab. It is the threshold-adjust implant, and the dose that
closes it is 8.15 × 10¹¹ cm⁻². The recommendation is that C5 derives 0.322 V, adds the
implant, and lands on the Electronics Lab's 0.700 V with the dose printed.

### Decision 5: the 1-D profile canvas adapts the Fields Lab's field map

`PROGRAM.md` §4 lists the field map with the Fields Lab first and the Devices Lab
second. The Fields Lab is being built. The recommendation is to adapt rather than
build, and to send that overseer the props this lab needs now. They are a
one-dimensional mode, a stacked triple of charge density, field and potential on one
axis, and a bias knob that redraws all three. §11 records the risk.

### Decision 6: where this lab sits in a reader's order

`EE_LABS_MAP.md` §4 puts the Devices Lab in step 11 and says it gates nothing. It reads
well before Electronics D and after it. The recommendation is that the splash line
names both entry points, and that the sittings settle which one to recommend.

---

## 1. The progression map

Every idea this lab leans on, the experiment that teaches it, and whether that
experiment exists today. Status words are the backlog's.

| Idea the lab leans on | Needed by | Taught at | Status |
| --- | --- | --- | --- |
| The two laws, nodal analysis, a capacitor as charge over voltage | everything | Elements A to F | built |
| The diode's four models and the tangent `r_d` | B4, B5 | Elements i1 to i3 | built |
| Newton on an exponential, iterations kept | F1 | Elements i2, `pwl.js` | built |
| The Zener as a two-slope element | B6 | Elements i8 | built |
| Shockley's law as a stated fact | B4 | Elements i1 | built |
| `V_0`, `C_j(v)`, `C_d`, `I_S(T)` as closed forms | A, B, E | `ELECTRONICS_LAB_PLAN.md` §2.3, brief §3.7 | planned |
| The junction canvas, depletion region drawn to scale | B2, B3 | `AGENT_BRIEF.md` lane 3 `JunctionCanvas.jsx` | planned |
| The BJT's exponential model and the transistor curves | E | Electronics D1, D2 | planned |
| The MOSFET's square law and its regions | D | Electronics D4 | planned |
| `g_m`, `r_π`, `r_o` at an operating point | D4, E3 | Electronics F | planned |
| `C_π` and `C_μ` traced back to the junction | B3, E4 | Electronics C2, C3, K | planned |
| The photodiode's responsivity and shot noise | F cross-reference | Photonics Lab | waiting |
| A field map over a geometry, as a canvas | the profile view | Fields Lab | **being built** |
| Gauss's law, and the field from a charge distribution | B1, B2 | Fields Lab | being built |
| The photovoltaic cell on a converter | F cross-reference | Energy Lab | being built |
| Carriers, doping and the Fermi level | A | nowhere | **gap, A** |
| Charge, field and potential profiles across a junction | B | nowhere | **gap, B** |
| The MOS capacitor and its C–V curve | C, D | nowhere | **gap, C** |
| Fabrication, as the numbers each step sets | G | nowhere | **gap, G** |

Three things the map shows that this plan does not fix, so that they are decisions and
not omissions. **The Fields Lab is being built**, and the profile view adapts its field
map (Decision 5). Until that canvas has a one-dimensional mode, the profile view runs
against a local stub and no group ships behind it.

**Electronics Group C is planned**, not built, and this lab extends the file that group
creates. Every experiment here that restates an Electronics C number is a
cross-reference rather than a copy. The progression test fails on that reference until
Group C exists. **Gauss's law has no built home.** B1 states it and measures it, and
the Fields Lab is where a reader can later see it derived.

The order of the groups follows the map. Nothing in a group leans on an experiment that
comes later in this lab.

---

## 2. The engine: the depletion approximation, and what is exact inside it

### 2.1 What exists, and what is missing

`junction.js` will hold six functions when Electronics lane 3 lands: `builtIn`,
`depletionWidth`, `junctionCap`, `diffusionCap`, `isAt` and `vbeSlope`. Each is a
scalar closed form. This lab adds the profiles those scalars summarise, and the MOS
capacitor beside them.

| Need | Today | This plan |
| --- | --- | --- |
| The built-in potential and the depletion width | `builtIn`, `depletionWidth` (planned) | reused unchanged |
| Charge, field and potential against position | nothing | `profile()` in `junction.js` (§2.3) |
| The field's peak, and breakdown | nothing | `peakField()`, `breakdown()` (§2.3) |
| Carrier concentrations and the Fermi level | nothing | `carriers.js` (§2.2) |
| The MOS capacitor's regimes and its C–V | nothing | `mos.js` (§2.4, §2.5) |
| The MOSFET's threshold from the process | Electronics' `vt` is a given | `threshold()` in `mos.js` (§2.6) |
| The BJT's `I_S` and `β` from the Gummel numbers | Electronics' `is`, `beta` are given | `gummel()` (§2.7) |
| The solar cell's operating point | nothing | `photovoltaic.js` (§2.8) |

### 2.2 Carriers, and the law of mass action

In equilibrium `n p = n_i²` everywhere, whatever the doping. `carriers.js` returns `n`
and `p` from the net doping by solving the neutrality condition exactly, so it is right
at low doping where `n ≈ N_D` fails. The Fermi level follows from
`E_F − E_i = kT ln(n/n_i)`. At 300 K, `kT/q` is 25.852 mV.

The intrinsic concentration itself comes from
`n_i = √(N_c N_v) exp(−E_g/2kT)`, which gives 1.079 × 10¹⁰ cm⁻³ at Green's band-edge
densities. Decision 1 governs which number the suite uses, and A2 prints both.

### 2.3 The profile, by exact integration

The depletion approximation says two things. Inside the depletion region every mobile
carrier is gone, so the charge density is the dopant charge alone. Outside it the
material is neutral. That is a **labelled model**, and the label is on every pane in
Groups B and C.

Inside the model every result is exact. The charge density is a step, `−q N_A` on the
p side and `+q N_D` on the n side. Poisson's equation integrates once for the field and
twice for the potential, and both integrals are polynomials. So `profile()` returns them
in closed form rather than on a grid, and §4.2's view draws all three on one axis.

Two consequences are the group's content, and both are invariants. Charge neutrality
requires `N_A x_p = N_D x_n`, so the region is ten times wider on the lightly doped side
of a 10¹⁷ to 10¹⁶ junction. The area under the field curve is the junction potential, so
`E_max = 2 V_j / W` exactly for a step junction.

Breakdown is that field reaching a number. Avalanche happens near 3 × 10⁵ V/cm, so a
one-sided junction gives `V_BR = ε_s E_crit²/(2 q N_D)`. That is 291 V at 10¹⁵ cm⁻³,
29.1 V at 10¹⁶ and 2.91 V at 10¹⁷. Zener breakdown needs tunnelling, a field near
10⁶ V/cm, and two heavily doped sides. The critical field is a **material constant
taken as data**, and the pane says so.

### 2.4 The MOS capacitor, and its three regimes

A gate, an oxide and a semiconductor. `mos.js` holds the oxide capacitance
`C_ox = ε_ox/t_ox`, which is 345.313 nF/cm² at 10 nm. The bulk potential is
`φ_F = kT/q · ln(N_A/n_i)`, which is 406.203 mV at `N_A = 10¹⁷ cm⁻³`.

Three regimes, and the gate voltage picks which. **Accumulation** pulls majority
carriers to the surface, and the measured capacitance is `C_ox`. **Depletion** pushes
them away and leaves a depletion layer in series, so the capacitance falls as
`C_ox C_d/(C_ox + C_d)`. **Inversion** begins when the surface potential reaches
`2 φ_F`, after which the depletion layer stops growing at
`W_max = √(4 ε_s φ_F/(q N_A))`, which is 102.498 nm.

Each regime's boundary is a stated condition on the surface potential. Each capacitance
is a closed form. The surface potential itself is the root of a transcendental
relation, found by bisection to floating point. A root-find is not an approximation.

### 2.5 The C–V curve, at two frequencies

The C–V curve is the diagnostic the industry measures, and it has two shapes.

**At high frequency** the inversion layer cannot follow the signal, so the depletion
layer carries the response and the capacitance floors at
`C_min = C_ox C_dmin/(C_ox + C_dmin)`. At the stated process that is 78.1856 nF/cm²,
which is 0.226419 of `C_ox`.

**At low frequency** the inversion layer follows, and the capacitance returns to
`C_ox`. The two curves share the accumulation and depletion branches and part company in
inversion. Which one a measurement shows depends on the sweep rate against the
minority-carrier generation rate, and the pane names that reason without modelling it.

`C_min/C_ox` reads the substrate doping, which is the industry's use of the curve. It
runs from 0.0336 at 10¹⁵ cm⁻³ to 0.4636 at 10¹⁸ cm⁻³, so the inversion is one root-find.

### 2.6 The MOSFET, derived from the MOS capacitor

The threshold voltage is four terms, and each one comes from a section above.

```
V_T = V_FB + 2 φ_F + Q_dep/C_ox
```

with `V_FB = φ_ms` when there is no oxide charge. For an n⁺ polysilicon gate on p-type
silicon, `φ_ms = −(E_g/2 + φ_F)`, which is −966.203 mV. The depletion charge at
threshold is `q N_A W_max`, which is 164.219 nC/cm², and dividing by `C_ox` gives
475.566 mV. So `V_T` is 321.769 mV, and Decision 4 says what happens next.

The square law follows from the gradual-channel argument. The channel charge at a point
is `C_ox(V_GS − V_T − V(y))`, and integrating along the channel gives
`I_D = k_n[V_OV V_DS − V_DS²/2]` in triode and `I_D = ½ k_n V_OV²` in saturation. With
`k' = μ_n C_ox = 172.657 µA/V²` and `W/L = 10`, a 0.5 V overdrive gives 215.82 µA and
`g_m = 863.28 µA/V`. The integration is exact under the gradual-channel model, which is
labelled on the pane.

Two more numbers come from the same file. `γ = √(2 q ε_s N_A)/C_ox` is 0.527624 V^½, so
1 V of source-to-body bias raises `V_T` by 234.75 mV. And
`S = (kT/q) ln10 (1 + C_dmin/C_ox)` is 76.9492 mV per decade. The swing is where the
square law stops, and D5 measures that rather than asserting it.

### 2.7 The BJT from two junctions

Two junctions sharing a base is a transistor when the base is thin. `gummel()` returns
the saturation current and the current gain from the two doping-thickness products.

```
I_S = q A n_i² D_B / (N_B W_B)          β = (D_B N_E W_E) / (D_E N_B W_B)
```

At the process of §4.3 that is 7.4555 × 10⁻¹⁵ A and a `β` of 480. That `β` is the
emitter-injection ceiling, and a real device falls below it through base recombination
(§10). The base transit time `W_B²/(2 D_B)` is 120.88 ps, and it caps `f_T` at
1.3166 GHz.

The Early voltage comes from the collector junction's depletion edge moving into the
base. At `V_CB = 5 V` that edge moves 7.1543 nm per volt, and the base width divided by
that rate gives `V_A = 69.888 V`. Electronics D2 reads `V_A` as a slope on a curve, this
lab computes it from the profile, and E4 compares the two.

### 2.8 The solar cell and the LED

A solar cell is a junction with a photocurrent in parallel. Its I–V law is Shockley's
shifted down by `I_L`. Every quantity has a closed form except the maximum power point.
That point maximises `V(I_L − I_S(e^{V/V_T} − 1))`, and it is found to floating point.

For `I_S = 10⁻¹² A` and `I_L = 35 mA` on a 1 cm² cell, `V_oc = 627.651 mV`,
`V_mp = 547.531 mV`, `I_mp = 33.422 mA` and `P_max = 18.2996 mW`. The fill factor is
0.833019, and the empirical form `(v_oc − ln(v_oc + 0.72))/(v_oc + 1)` gives 0.833107,
so the empirical form is a guarded approximation with its error printed.

An LED is the same junction run the other way, and the photon energy is the band gap.
`E_g/q` sets the forward voltage floor and `hc/E_g` sets the wavelength. Silicon at
1.12 eV emits at 1107 nm and gallium nitride at 3.4 eV at 364.66 nm. Radiative
efficiency is a material fact and is declined (§10).

### 2.9 Transport beyond the depletion approximation, declined

A reader who has seen the profile will ask for the carrier concentrations inside the
depletion region. That needs the drift-diffusion system solved on a mesh, with
generation and recombination. Its answer is a numerical field rather than a formula.
The suite has no way to separate that solver's error from physics. `diode.js` gives the
same reason for declining the exponential diode in time.

So it is declined, with the reason on the pane, and the boundary is content. The pane
names the three things the depletion approximation replaces: the carrier tails at the
edges, the quasi-neutral region's small field, and generation inside the depletion
layer. It states the size of each. The edge tails are a few Debye lengths, and the
Debye length here is 12.9288 nm against a 327.255 nm depletion width, so the model is
good to about 8 %.

### 2.10 Measures

Carrier concentrations, the Fermi level, and `n_i` at any temperature. The built-in
potential, the depletion width and its split, the peak field, and the junction
capacitance. The charge, field and potential at any position. The breakdown voltage and
the field that caused it. `C_ox`, `φ_F`, `W_max`, `C_min`, the surface potential, the
flat-band voltage, the threshold voltage and its four terms, `γ` and `S`. The MOSFET's
drain current, region, `g_m` and `r_o`. The BJT's `I_S`, `β`, `α`, transit time, `f_T`
ceiling and Early voltage. The solar cell's `V_oc`, `I_sc`, maximum power point, fill
factor and efficiency.

### 2.11 Invariants, the fuzzer's checklist

Across random dopings from 10¹⁴ to 10²⁰ cm⁻³, random oxide thicknesses and random bias:

1. **Charge neutrality.** `N_A x_p = N_D x_n` to floating point, at every bias and every
   doping pair.
2. **Gauss's law across the depletion region.** The charge density integrated over the
   whole region is zero, and the field returns to zero at both edges to floating point.
3. **The field's integral is the potential.** The area under `E(x)` equals `V_0 − v` to
   10⁻¹² relative, by quadrature rather than by the formula that produced it. Both
   routes give 46.0118 kV/cm for the peak at zero bias.
4. **`C_j` from the profile equals the closed form.** The depletion charge differentiated
   against voltage equals `ε_s/W` to 10⁻⁶ relative, and `C_j0/√(1 − v/V_0)` to floating
   point.
5. **The law of mass action.** `n p = n_i²` to floating point at every doping, and the
   neutrality solve agrees with `n ≈ N_D` to 10⁻⁶ above 100 `n_i`.
6. **Electronics C is unchanged.** `builtIn`, `junctionCap`, `diffusionCap`, `isAt` and
   `vbeSlope` return exactly what `AGENT_BRIEF.md` §3.7 pins. `V_0` is 752.88 mV and
   `C_j` is 0.7235 pF at −5 V.
7. **The MOS capacitance is monotonic.** `C(V_G)` falls from `C_ox` through depletion to
   `C_min` with no step, and the two frequency curves coincide outside inversion.
8. **`C_min` from the profile equals the closed form.** The series combination from the
   integrated depletion charge equals `C_ox C_dmin/(C_ox + C_dmin)` to 10⁻⁹ relative.
9. **The square law is the integrated channel charge.** `I_D` from the gradual-channel
   integral equals the closed form in triode and in saturation, and the two agree at
   `V_DS = V_OV` in value and in slope.
10. **`g_m` is the derivative.** It equals the central difference of `I_D` against `V_GS`
    to 10⁻⁶ relative, and `2 I_D/V_OV` in saturation to floating point.
11. **The maximum power point is stationary.** `dP/dV` at `V_mp` is below 10⁻¹⁰ of
    `I_sc`, and `P_max` equals `FF · V_oc · I_sc` by construction.
12. **Cross-lab.** The `I_S` from the Gummel numbers, fed to Electronics D2, gives that
    experiment's `V_BE` at 1 mA. The `V_T` derived here, with Decision 4's implant,
    equals the Electronics MOSFET's 0.700 V.

---

## 3. Models: the structure library

There are no netlists in Groups A to D. A structure is a stack of layers with dopings
and thicknesses, and every quantity comes from a closed form over it.

| Structure | Parameters | Toggles, each labelled |
| --- | --- | --- |
| Bulk silicon | `N_A` or `N_D`, `T` | the neutrality solve against `n ≈ N_D`, degenerate doping declined above 10¹⁹ cm⁻³ |
| Step junction | `N_A`, `N_D`, area, `T`, bias | linearly graded profile, so `C_j` follows a cube root rather than a square root |
| MOS capacitor | `N_A`, `t_ox`, gate material, oxide charge `Q_f`, bias | n⁺ poly, p⁺ poly or aluminium gate, high or low frequency, a threshold implant |
| MOSFET | the MOS capacitor plus `W`, `L`, `μ_n` | body bias, channel-length modulation `λ`, subthreshold conduction |
| BJT | `N_E`, `W_E`, `N_B`, `W_B`, `N_C`, area | the Early effect from the profile, high-level injection declined |
| Solar cell | `I_S`, `I_L`, area, series and shunt resistance | one sun to ten suns, a series resistance, a shading fraction |
| LED | band gap, material name | four materials as data, radiative efficiency declined |

Every structure carries its cross-section as a drawing, with layer thicknesses to
scale. Group G walks the fabrication sequence that produces it.

---

## 4. The app

### 4.1 Layout

The Elements lab's shape, unchanged. Sidebar with LabNav, the report link, experiment
groups, a structure picker, doping and thickness NumFields with chips, model and gate
switches, and the math panel. Main: topbar meters, the cross-section always visible, and
one pane below with a pane selector. Phone-width first, no horizontal scroll at 390 px,
harness-checked. The topbar leads with `V_0`, `W` and `E_max` for a junction, or
`C_ox`, `V_T` and `C_min/C_ox` for a MOS capacitor, then the bias and the regime.

### 4.2 Views

Reused, adapted and new, in the terms of `PROGRAM.md` §4.

**Reused unchanged.** `NumField` with unit chips for every doping and thickness, on a
log scale. `LabNav`, `ReportIssue`, `LessonNav` and `TryLine`. `plot.js`, `scale.js`,
`format.js` and `units.js`. `MathPanel` and `packages/explain/testing`. `deeplink.js`
for the hand-overs in §6.

**Adapted, by a prop and not by a copy.**

- **The 1-D profile view** adapts the Fields Lab's field map, which `PROGRAM.md` §4
  names this lab as the second user of. The props are a one-dimensional mode, a stacked
  triple of `ρ(x)`, `E(x)` and `ψ(x)` on one position axis, and a bias knob that redraws
  all three. Decision 5 and §11 carry the dependency.
- **`JunctionCanvas.jsx`** from Electronics lane 3 draws the depletion region to scale.
  It gains a `stack` prop, so the profile triple sits below the same drawing with the
  edges aligned.
- **The Newton view** from Elements i2 is reused unchanged for F1.

**New, in the app, because no second lab needs them.**

- **The band diagram.** Conduction and valence edges, the Fermi level and the intrinsic
  level against position, bent across the junction by the potential the profile
  computed. Bias tilts it, and the barrier height is read off it.
- **The C–V pane.** Capacitance against gate voltage, with both frequency curves, the
  three regimes shaded, and `C_ox`, `C_min` and `C_min/C_ox` beside the plot.
- **The cross-section.** Layers to scale with their dopings and thicknesses. Group G
  adds a step slider that walks the fabrication sequence.
- **The device curves.** `I_D` against `V_DS` at stepped `V_GS`, and the solar cell's
  I–V and P–V pair with the maximum power point marked. Electronics D4 draws the first
  from a model, and this lab draws it from the process.
- **Equations.** Poisson's equation integrated twice, printed as the two polynomials it
  gives, with the constants shown.

### 4.3 Numbers

Defaults chosen so that every quoted number is checkable and the pictures fit a phone.

- **Constants and doped silicon.** `kT/q = 25.852 mV` at 300 K,
  `ε_s = 1.03594 × 10⁻¹⁰ F/m`, `ε_ox = 3.45313 × 10⁻¹¹ F/m` and `E_g = 1.12 eV`.
  `n_i = 1.5 × 10¹⁰ cm⁻³` by Decision 1, against 1.079 × 10¹⁰ from
  `N_c = 2.86 × 10¹⁹` and `N_v = 2.66 × 10¹⁹ cm⁻³`. At `N_D = 10¹⁶ cm⁻³`, `n = 10¹⁶`,
  `p = 2.25 × 10⁴ cm⁻³` and `E_F − E_i = 346.68 meV`. At 10¹⁵ that level is 287.15 meV
  and at 10¹⁷ it is 406.20 meV. `n_i` is 1.08 × 10⁸ cm⁻³ at 250 K and 3.74 × 10¹² cm⁻³
  at 400 K.
- **The junction.** `N_A = 10¹⁷ cm⁻³`, `N_D = 10¹⁶ cm⁻³`, area 10⁻⁴ cm². So
  `V_0 = 752.879 mV`, `W = 327.255 nm` split 297.504 nm into the n side and 29.7504 nm
  into the p side, `E_max = 46.0118 kV/cm`, and `C_j = 31.6554 nF/cm²`.
- **Its bias sweep.** At −10 V, `W = 1236.8 nm` and `E_max = 173.89 kV/cm`. At −5 V,
  904.62 nm and 127.19 kV/cm. At −1 V, 499.34 nm and 70.207 kV/cm. At +0.5 V,
  189.66 nm and 26.666 kV/cm. `C_j/C_j0` matches `1/√(1 − v/V_0)` at every point.
- **Other junctions and breakdown.** One-sided at 10¹⁹ to 10¹⁶ gives 871.93 mV and
  335.96 nm, symmetric at 10¹⁷ gives 812.41 mV and 144.95 nm, and 10¹⁵ gives 574.30 mV
  and 1218.7 nm. Avalanche at 3 × 10⁵ V/cm breaks down at 290.96 V at 10¹⁵ cm⁻³,
  29.096 V at 10¹⁶ and 2.9096 V at 10¹⁷. A 10¹⁹ to 10¹⁸ junction at −3 V reaches
  1059.4 kV/cm in a 75.347 nm layer, which is the Zener regime.
- **The diode's current.** With `μ_p = 450` and `μ_n = 1100 cm²/V·s`, `D_p = 11.633` and
  `D_n = 28.437 cm²/s`. At a 1 µs lifetime, `L_p = 34.108 µm` and `L_n = 53.327 µm`. So
  `I_S = 1.4218 × 10⁻¹⁵ A`, which puts 705.219 mV across the junction at 1 mA. The
  Electronics Lab's `I_S = 10⁻¹⁴ A` puts 654.791 mV. The decade slope is 59.526 mV.
- **The MOS capacitor.** `N_A = 10¹⁷ cm⁻³`, `t_ox = 10 nm`, n⁺ poly gate. So
  `C_ox = 345.313 nF/cm²` or 3.45313 fF/µm², `φ_F = 406.203 mV`, `W_max = 102.498 nm`,
  `C_dmin = 101.070 nF/cm²`, `C_min = 78.1856 nF/cm²` and `C_min/C_ox = 0.226419`. The
  Debye length is 12.9288 nm and `C_FB` is 241.316 nF/cm².
- **The threshold, and the process sweep.** `φ_ms = −966.203 mV`,
  `2 φ_F = 812.406 mV` and `Q_dep/C_ox = 475.566 mV`, so `V_T = 321.769 mV`. An implant
  of 8.1519 × 10¹¹ cm⁻² moves it to 700 mV, and oxide charge of 2.1553 × 10¹¹ cm⁻² is
  worth 100 mV. `γ = 0.527624 V^½` and `S = 76.9492 mV` per decade. At 5 nm of oxide
  `V_T` is 83.986 mV, at 20 nm it is 797.33 mV, and at 50 nm it is 2224 mV.
  `C_min/C_ox` runs 0.033641, 0.091065, 0.226419 and 0.463630 at 10¹⁵ to 10¹⁸ cm⁻³.
- **The MOSFET.** `μ_n = 500 cm²/V·s`, so `k' = 172.657 µA/V²`. At `W/L = 10` and
  `V_OV = 0.5 V`, `I_D = 215.82 µA` and `g_m = 863.28 µA/V`, and `g_m/I_D` is 4.00 per
  volt. At `V_DS = 0.25 V` the device is in triode at 161.87 µA. With `λ = 0.05 V⁻¹`,
  `r_o = 92.669 kΩ`. Velocity saturation begins at 20 kV/cm, which is 2 V of overdrive
  in a 1 µm channel and 0.2 V in a 0.1 µm channel.
- **The BJT.** `N_E = 10¹⁹ cm⁻³` over 0.3 µm, `N_B = 10¹⁷ cm⁻³` over 0.5 µm, area
  10⁻⁴ cm². So `D_B = 10.341` and `D_E = 1.2926 cm²/s`, `I_S = 7.4555 × 10⁻¹⁵ A`,
  `β = 480`, `α = 0.997921`, `τ_B = 120.88 ps` and an `f_T` ceiling of 1.3166 GHz.
  `V_BE` at 1 mA is 662.382 mV. The Gummel numbers are 5.0 × 10¹² and 3.0 × 10¹⁴ cm⁻².
  The Early voltage from the profile is 69.888 V.
- **The solar cell and the LED.** `I_S = 10⁻¹² A`, `I_L = 35 mA` on 1 cm². So
  `V_oc = 627.651 mV`, `V_mp = 547.531 mV`, `I_mp = 33.422 mA`, `P_max = 18.2996 mW`, a
  fill factor of 0.833019 and 18.30 % efficiency at 100 mW/cm². At `I_S = 10⁻¹⁰ A`,
  `V_oc` falls to 508.60 mV and the fill factor to 0.80569. Ten suns raises `V_oc` to
  687.18 mV, and one ohm of series resistance costs 33.422 mV at the maximum power
  point. Emission runs 1107 nm for silicon, 873.13 nm for gallium arsenide, 548.60 nm
  for gallium phosphide and 364.66 nm for gallium nitride.

---

## 5. Curriculum: 30 experiments in 7 groups

Format, as the other plans. **The claim** the note makes, what the reader turns, and
what is **measured** against what **formula**. Every quoted number becomes a pinned
test. Each experiment ships with `see`, `try` and `why` in the Elements lab's three
registers, within the STYLE.md budgets.

### Group A: Carriers and doping (5)

- **A1 · Two carriers, one product.** In equilibrium `n p = n_i²` whatever the doping.
  Add 10¹⁶ cm⁻³ of donors and the electrons rise to 10¹⁶ while the holes fall to
  2.25 × 10⁴ cm⁻³. Measured: both concentrations at three dopings, and the product
  against `n_i²` to floating point.
- **A2 · Where `n_i` comes from, and why books disagree.** `n_i = √(N_c N_v)
  exp(−E_g/2kT)` gives 1.079 × 10¹⁰ cm⁻³ at Green's band-edge densities. The suite pins
  1.5 × 10¹⁰, which is Streetman's, and which corresponds to `E_g = 1.103 eV`. Measured:
  the computed value, the ratio of 1.39, and the implied band gap.
- **A3 · Temperature runs the intrinsic carriers.** `n_i` is 1.08 × 10⁸ cm⁻³ at 250 K
  and 3.74 × 10¹² cm⁻³ at 400 K, a factor of 34 600 over 150 K. A 10¹⁶ cm⁻³ sample
  stays extrinsic across that range, and a 10¹³ cm⁻³ one does not. Measured: `n_i` at
  four temperatures, and the temperature at which each sample goes intrinsic.
- **A4 · The Fermi level as a reading of doping.** `E_F − E_i = kT ln(n/n_i)`, which is
  287.15 meV at 10¹⁵ cm⁻³, 346.68 meV at 10¹⁶ and 406.20 meV at 10¹⁷. One decade of
  doping is 59.5 meV, the same 59.5 mV a decade of diode current costs. Measured: the
  three levels, and the decade step.
- **A5 · The band diagram of one piece of silicon.** Four lines against position, flat
  because nothing is bent yet. Change the doping and `E_F` moves while `E_c`, `E_v` and
  `E_i` stay. Measured: the four energies, and the barrier to the conduction band.

### Group B: The junction in depth (6)

- **B1 · The charge that is left behind.** Inside the depletion region the mobile
  carriers are gone and the dopant charge remains. Neutrality requires
  `N_A x_p = N_D x_n`, so a 10¹⁷ to 10¹⁶ junction is ten times wider on the lightly
  doped side. Measured: `x_n = 297.504 nm`, `x_p = 29.7504 nm`, their ratio of ten, and
  the two charges cancelling to floating point.
- **B2 · Integrate once for the field.** Poisson's equation over the step charge gives
  a triangle. Its peak is `46.0118 kV/cm` at zero bias, and the same number comes from
  `2 V_j/W`. The field is zero at both edges, which is Gauss's law over the whole
  region. Measured: the peak both ways, and the field at the two edges.
- **B3 · Integrate again for the potential.** Two parabolas that meet, and the total
  drop is `V_0 = 752.879 mV`. Reverse bias adds to it, forward bias subtracts, and the
  width follows `√(V_0 − v)`. Measured: `V_0`, the width at −10, −5, −1, 0 and +0.5 V,
  and the area under the field curve against `V_0 − v`.
- **B4 · The exponential, from the barrier.** Lowering the barrier by `v` multiplies the
  carriers that cross it by `e^{v/V_T}`, which is Shockley's law with a reason.
  `I_S = 1.4218 × 10⁻¹⁵ A` for the stated geometry, so 1 mA needs 705.219 mV. The
  Electronics Lab's `10⁻¹⁴ A` needs 654.791 mV. Measured: `I_S` from the diffusion
  lengths, both voltages, and the 59.526 mV decade.
- **B5 · The capacitance is the profile's derivative.** `C_j = ε_s/W`, which is
  31.6554 nF/cm² at zero bias and follows `1/√(1 − v/V_0)`. Taking the derivative of the
  depletion charge numerically gives the same number. Measured: `C_j` at five biases,
  both routes, and the graded junction's cube root beside the step junction's square
  root.
- **B6 · Breakdown is a field reaching a number.** Avalanche at 3 × 10⁵ V/cm gives
  290.96 V at 10¹⁵ cm⁻³ and 2.9096 V at 10¹⁷, so a Zener diode's rating is a doping.
  Below about 6 V the mechanism is tunnelling, which needs 10⁶ V/cm and two heavy
  sides. Measured: the three breakdown voltages, and the peak field of 1059.4 kV/cm in
  the 10¹⁹ to 10¹⁸ junction at −3 V.

### Group C: The MOS capacitor (5)

- **C1 · Three layers, one capacitor.** `C_ox = ε_ox/t_ox` is 345.313 nF/cm² at 10 nm,
  or 3.45313 fF/µm². Halve the oxide and it doubles. Measured: `C_ox` at four
  thicknesses, and the gate charge at 1 V.
- **C2 · Accumulation, depletion, inversion.** Sweep the gate. Negative gate voltage
  pulls holes to the surface and the capacitance reads `C_ox`. Positive voltage pushes
  them away and a depletion layer appears in series. Past a surface potential of
  `2 φ_F = 812.406 mV` the layer stops growing at `W_max = 102.498 nm`. Measured: the
  three regime boundaries, `φ_F`, and `W_max`.
- **C3 · The C–V curve, and what it reads.** At high frequency the capacitance floors
  at `C_min = 78.1856 nF/cm²`, which is 0.226419 of `C_ox`. That ratio runs from
  0.033641 at 10¹⁵ cm⁻³ to 0.463630 at 10¹⁸, so the curve reads the substrate doping.
  Measured: `C_min`, the ratio at four dopings, and the doping recovered from a stated
  ratio.
- **C4 · Two frequencies, two curves.** At low frequency the inversion layer follows
  the signal and the capacitance returns to `C_ox`. The two curves agree outside
  inversion to floating point. Which one appears depends on the sweep rate against the
  generation rate. Measured: both curves, their agreement in depletion, and the factor
  of 4.42 between the two inversion values.
- **C5 · The threshold, in four terms.** `V_T = V_FB + 2 φ_F + Q_dep/C_ox`, which is
  −966.203 + 812.406 + 475.566 mV, or 321.769 mV. The Electronics Lab uses 0.700 V, and
  an implant of 8.1519 × 10¹¹ cm⁻² is the difference. Measured: the four terms, the sum,
  the implant dose, and the 100 mV that 2.1553 × 10¹¹ cm⁻² of oxide charge is worth.

### Group D: The MOSFET (5)

- **D1 · The channel is the inversion layer.** Above threshold the gate holds
  `C_ox(V_GS − V_T)` of electrons at the surface, and a drain voltage drags them along.
  At `V_OV = 0.5 V` that is 172.7 nC/cm². Measured: the channel charge at three
  overdrives, and the current it carries at a stated drift velocity.
- **D2 · The square law, integrated.** Integrating the channel charge along the channel
  gives `I_D = k_n[V_OV V_DS − V_DS²/2]` in triode. With `k' = 172.657 µA/V²` and
  `W/L = 10`, the current at `V_DS = 0.25 V` is 161.87 µA. Measured: the current at four
  drain voltages, and the closed form against the integral to floating point.
- **D3 · Pinch-off and saturation.** At `V_DS = V_OV` the channel charge reaches zero at
  the drain, and past it the current holds at `½ k_n V_OV² = 215.82 µA`. The two
  expressions agree in value and in slope at the boundary. Measured: the saturation
  current, the boundary, and the slope match at 10⁻¹² relative.
- **D4 · `g_m` and the body effect.** `g_m = k_n V_OV = 863.28 µA/V`, which is
  `2 I_D/V_OV`, so `g_m/I_D` is 4.00 per volt. Bias the body 1 V below the source and
  `V_T` rises 234.75 mV, because `γ = 0.527624 V^½`. Measured: `g_m` both ways, its
  agreement with a finite difference, and the threshold shift at three body biases.
- **D5 · Where the square law stops.** Below threshold the current is exponential, not
  quadratic, and it falls 76.9492 mV per decade. Reaching 1 nA from 215.82 µA costs
  410.45 mV of gate voltage. Above threshold, velocity saturation flattens the square
  law past 20 kV/cm, which is 0.2 V of overdrive in a 0.1 µm channel. Measured: the
  swing, the gate voltage for five decades, and the overdrive at two channel lengths.

### Group E: The BJT from two junctions (4)

- **E1 · Two junctions, one thin base.** Two depletion regions in one piece of silicon,
  drawn to scale. The base is 0.5 µm and the collector junction eats 82.238 nm of it at
  `V_CB = 5 V`. Measured: both depletion widths, the neutral base width, and the
  fraction of the base the collector junction has taken.
- **E2 · The Gummel numbers set `I_S` and `β`.** `I_S = q A n_i² D_B/(N_B W_B)` is
  7.4555 × 10⁻¹⁵ A, and `β = D_B N_E W_E/(D_E N_B W_B)` is 480. The two Gummel numbers
  are 5.0 × 10¹² and 3.0 × 10¹⁴ cm⁻². Measured: both, `α = 0.997921`, and `V_BE` of
  662.382 mV at 1 mA.
- **E3 · The base transit time caps the speed.** `τ_B = W_B²/(2 D_B)` is 120.88 ps, so
  `f_T` cannot exceed 1.3166 GHz. Halve the base width and the ceiling quadruples.
  Measured: the transit time at three base widths, and the ceiling each gives.
- **E4 · The Early voltage from the profile.** The collector junction's edge moves
  7.1543 nm per volt into the base, so the base thins and `β` rises. Dividing the base
  width by that rate gives `V_A = 69.888 V`. Electronics D2 reads the same number as a
  slope. Measured: the edge's rate, `V_A` from the profile, and the two routes agreeing
  within the model's stated error.

### Group F: The solar cell and the LED (3)

- **F1 · A junction with a photocurrent.** Shockley's law shifted down by `I_L = 35 mA`
  crosses zero at `V_oc = 627.651 mV`, which is `V_T ln(I_L/I_S)`. The operating point
  under a load is a Newton solve, and Elements i2's view shows the iterations. Measured:
  `V_oc`, `I_sc`, and the operating point at three load resistances.
- **F2 · The maximum power point, and the fill factor.** Power peaks at
  `V_mp = 547.531 mV` and `I_mp = 33.422 mA`, which is 18.2996 mW, or 18.30 % of
  100 mW/cm². The fill factor is 0.833019, and the empirical form gives 0.833107.
  Measured: the point, the fill factor both ways, and the efficiency.
- **F3 · The two things that spoil it.** Raising `I_S` from 10⁻¹² to 10⁻¹⁰ A drops
  `V_oc` to 508.60 mV and the fill factor to 0.80569. One ohm of series resistance costs
  33.422 mV at the maximum power point. Run the same junction backwards and it emits at
  `hc/E_g`, which is 1107 nm for silicon and 364.66 nm for gallium nitride. Measured:
  both losses, and the four emission wavelengths.

### Group G: Fabrication, and the numbers each step sets (2)

- **G1 · A junction, step by step.** Oxidise, mask, implant, drive in, metallise. The
  cross-section is drawn to scale after each step, and each step sets one number the
  earlier groups used. The implant dose sets `N_A`, the drive-in sets the junction
  depth, and the oxide growth sets `t_ox`. Measured: the doping from a stated dose over
  a stated depth, and `V_0` from it.
- **G2 · A MOSFET, step by step.** The same sequence with a gate and two more implants.
  The gate oxide's 10 nm sets `C_ox`, the threshold implant's 8.1519 × 10¹¹ cm⁻² sets
  `V_T`, and the source and drain implants set the channel length. Measured: `C_ox` from
  the oxide step, `V_T` from the implant step, and `I_D` from the finished device.

---

## 6. Hand-overs

- **← Electronics Lab** (planned). Group C of that lab is this lab's entry point, and
  every one of its four closed forms is derived here. B3 links to Electronics C1 for
  `V_0`, B5 to C2 for `C_j`, E3 to C3 for the transit time, and A3 to C4 for the
  temperature law. The links are deep links, and the progression test checks each one.
- **↔ Electronics Lab, the other way.** D2 and D3 give Electronics D4's square law its
  process constants. E2 gives Electronics D1's `I_S` and `β`. C5 gives the Electronics
  MOSFET's `V_t` of 0.700 V with the implant that produces it. Each is a pinned
  cross-lab test, and Decision 4 is what makes the numbers agree.
- **← Fields Lab** (being built). B2 states Gauss's law and measures it, and the Fields
  Lab is where a reader can see it derived. The profile view adapts that lab's field map
  (Decision 5).
- **→ Energy Lab** (being built). F1 and F2 are the photovoltaic cell that lab drives a
  converter with. That lab adds the maximum power point tracker and the shading.
- **→ Photonics Lab** (waiting). F3's emission wavelengths and the LED's forward voltage
  are that lab's source. The link is named and is not built.
- **↔ Circuit Elements Lab.** i1's diode curve is B4's, i8's Zener is B6's, and i2's
  Newton view is reused unchanged in F1.

---

## 7. Testing discipline

- **Unit** (`packages/network`): `profile()` against hand-integrated polynomials at
  three doping pairs. `peakField()` against `2 V_j/W`. `carriers.js` at ten dopings.
  `mos.js` against hand values for `C_ox`, `φ_F`, `W_max`, `C_min` and `V_T`.
  `gummel()` and `photovoltaic.js` against hand values.
- **Regression**: every existing `junction.js` export returns exactly what
  `AGENT_BRIEF.md` §3.7 pins, after this lab's additions. That is invariant 6, and it
  runs first in the file.
- **Invariants** (§2.11), fuzzed across dopings, thicknesses and bias. The hostile
  corners are included. A junction with both sides at 10²⁰ cm⁻³. Forward bias within
  10 mV of `V_0`. An oxide of 2 nm. A body bias of 5 V. A solar cell with `I_L` below
  `I_S`.
- **Experiments**: every number in §5 pinned. The list includes 25.852 mV,
  1.079 × 10¹⁰, 752.879 mV, 327.255 nm, 46.0118 kV/cm and 290.96 V. It includes
  345.313 nF/cm², 406.203 mV, 102.498 nm, 0.226419, 321.769 mV and 76.9492 mV. The rest
  are 8.1519 × 10¹¹ cm⁻², 215.82 µA, 7.4555 × 10⁻¹⁵ A, 480, 69.888 V and 0.833019.
- **The map's promises**: a test walks every experiment's `why` and requires every
  experiment it cross-references to exist in the named lab. A reference to an
  experiment that is not built fails the suite, by design.
- **Guards and refusals**: the degenerate-doping refusal above 10¹⁹ cm⁻³, the
  forward-bias refusal as `v` approaches `V_0`, the empirical fill factor's printed
  error, and the drift-diffusion refusal of §2.9. Each is tested at both sides of its
  threshold. Each refusal message is tested for its reason.
- **Cross-lab pins**: `I_S` and `β` into Electronics D1 and D2. `V_T` into the
  Electronics MOSFET. `V_0`, `C_j` and `C_d` against Electronics C1 to C3. The solar
  cell into an Energy Lab stub.
- **Playwright harness**: the profile triple redraws on the bias knob. The C–V floor
  matches the topbar `C_min`. The band diagram tilts with bias. Nothing scrolls sideways
  at 390 px.
- **REVIEW_PLAYBOOK audit** before release, all eleven classes, a screenshot pass, and
  the sittings script with three seats. One seat sits Group B and one sits Group C,
  because Decision 6 asks which entry point a reader prefers.

---

## 8. Integration and the dark launch

The mechanism Power Lab and the Elements lab share, unchanged.

- Deployed **dark** at `/devices-lab/` from the first vertical slice. Unlisted, not
  secret.
- `apps/devices-lab/RELEASE_STATUS` reads `dark`. A test asserts that while it does, the
  splash, the root README and the other labs' LabNav contain no reference to Devices
  Lab. Flip the word to `released` and the same test demands the splash card, the README
  row and the nav entries, with counts pinned.
- One `cp` line in `deploy.yml`, plus the progression test's ids and counts. Both are
  requested through `NEEDS.md` and added by the director at integration.
- The `junction.js` contract of Decision 3 goes into `NEEDS.md` on the first commit, and
  the director resolves it with the Electronics overseer.
- The flip is **Reed's action**, after the release gate in §9.

---

## 9. Phasing

**Built (2026-09-05).** Phases 1 to 8 are done, on `lab/devices-lab`. All seven
groups ship, 30 experiments, and the app is dark. Phase 9, the release gate, is
what is left, and it is Reed's.

Three things about the phasing turned out differently, and they are recorded
here rather than rewritten above.

- **Phase 2 did not need a stub.** The profile view is `ProfileCanvas.jsx` in
  the app, written against the props the Fields Lab's overseer was sent, so
  Groups B and G ship behind a real canvas rather than behind a stub. It merges
  into that lab's field map at promotion, and `apps/devices-lab/NEEDS.md` §4
  carries the merge.
- **The engine landed as one commit rather than four.** The director's ruling
  gave this lab `packages/network/src/junction.js` and named one file. So the
  MOS capacitor did not get the sibling `mos.js` of Decision 2, and phases 1, 2,
  4, 6 and 7 have no engine work left to separate. Invariants 1 to 12 are fuzzed
  in `junction.devices.test.js`, with invariant 6 first in the file.
- **Five of §4.3's numbers moved when they were computed** rather than rounded.
  `apps/devices-lab/NEEDS.md` §5 lists each one with the reason, and the lessons
  and tests carry the measured values. The three breakdown voltages keep the
  `1/N_A` term the one-sided form drops. The Early voltage is 69.954 V. `n_i` at
  250 and 400 K follows the constant Decision 1 pins. The depletion
  approximation's edge error is 16.4 per cent, from each side's own Debye
  length. And invariant 5's `n ≈ N_D` tolerance is 10⁻⁴ at 100 `n_i` rather than
  10⁻⁶.

Each phase ships green and deployable dark.

1. **Carriers.** `carriers.js`, the app shell, the band diagram, the cross-section, the
   dark deploy and the `RELEASE_STATUS` test. **Group A** (5). Exit: invariant 5 fuzzed
   green, and every A number pinned.
2. **The profile engine.** `profile()`, `peakField()` and `breakdown()` in
   `junction.js`, behind the `NEEDS.md` contract, with the profile view against a local
   stub. No experiments ship here. Exit: invariants 1, 2, 3, 4 and 6 fuzzed green, with
   the Electronics C regression first in the file.
3. **The junction.** **Group B** (6). Exit: every B number pinned, both breakdown
   mechanisms separated, and the forward-bias refusal tested at both sides.
4. **The MOS capacitor.** `mos.js`, the C–V pane. **Group C** (5). Exit: invariants 7
   and 8 green, both frequency curves pinned, and C5's four terms summing to `V_T`.
5. **The MOSFET.** The device-curves view. **Group D** (5). Exit: invariants 9 and 10
   green, and the cross-lab pin into the Electronics MOSFET passing with Decision 4's
   implant.
6. **The BJT.** `gummel()`. **Group E** (4). Exit: `I_S` and `β` pinned, and the
   cross-lab pins into Electronics D1 and D2 passing.
7. **The solar cell and the LED.** `photovoltaic.js`. **Group F** (3). Exit: invariant
   11 green, and the fill factor's two routes agreeing within the printed error.
8. **Fabrication.** The step slider on the cross-section. **Group G** (2). Exit: every
   step's number matching the group that used it earlier.
9. **The release gate**, in order, each blocking the next. The full audit. The sittings,
   which also settle Decision 6. Reed's own pass, then the flip.

Phase 2's profile view is the only piece that waits on another lab, and a local stub
carries it until the Fields Lab canvas lands. Phases 1 and 3 to 8 are a complete
devices course on their own.

---

## 10. Non-goals (v1, stated so they are decisions rather than omissions)

- **Drift-diffusion on a mesh.** Declined in §2.9, with the reason and the size of what
  the depletion approximation leaves out.
- **Recombination and generation as a model.** Shockley–Read–Hall and Auger each need a
  lifetime that is a material fact. The diffusion length uses a stated lifetime.
- **Quantum mechanics.** The band structure, the effective mass and the density of
  states are inputs here. `N_c` and `N_v` are data, and A2 says whose data.
- **Degenerate doping.** Above 10¹⁹ cm⁻³ the Boltzmann approximation fails and
  Fermi–Dirac statistics are needed. The engine declines above that with the reason.
- **Short-channel effects, and high-level injection.** Drain-induced barrier lowering,
  punch-through, hot carriers, the Kirk effect and base pushout each change a number.
  None changes a lesson in this course. D5 and E2 name the two boundaries.
- **Compound semiconductors, and radiative efficiency.** Four materials appear in F3 as
  band gaps and wavelengths. Heterojunctions are a different course, and an LED's
  brightness is a datasheet.
- **Process simulation, and power devices.** Group G walks a curated sequence. Diffusion
  profiles from a real thermal budget need a tool this suite does not have, and the
  thyristor's internal physics is a later lab's if any.
- **A free-form structure editor.** Curated structures with editable dopings and
  thicknesses, as in every other lab.

---

## 11. Risks, named

- **The `n_i` decision moves an Electronics pin.** Decision 1 recommends keeping
  1.5 × 10¹⁰ cm⁻³, and A2 makes the spread the content. If Reed prefers the computed
  value, every Electronics C number moves and that lab's tests move with them.
  Mitigation: the decision is first in §0, invariant 6 is the regression, and A2 is
  written to work either way.
- **`junction.js` is another lab's file.** Decision 3 routes the additions through
  `NEEDS.md`, which costs a round trip with the director. Mitigation: the additions are
  new exports and no existing signature changes, so the Electronics C tests are the
  whole review.
- **The Fields Lab canvas is being built.** The profile view adapts it, and its
  one-dimensional mode does not exist yet. Mitigation: the props are named in Decision 5
  and sent on the first commit, phase 2 runs against a local stub, and no group ships
  behind the stub.
- **The threshold derivation lands on a different number.** 321.769 mV against the
  Electronics Lab's 700 mV is a gap a reader will notice before the implant explains it.
  Mitigation: C5 puts the implant in the same experiment, and the cross-lab pin in
  phase 5 fails if the two labs disagree.
- **The depletion approximation looks like an evasion.** A reader who wants carrier
  profiles inside the region will read §2.9's refusal as a shortcut. Mitigation: the
  pane states the three things the model replaces and the size of each, and the 8 %
  figure from the Debye length is measured rather than asserted.
- **Numbers that are right for one process.** Every quoted number is for the defaults in
  §4.3. Mitigation: each pin is re-derived from the parameters, never a constant.
- **Cost.** Two files of closed forms, one adapted canvas and three new ones. It is the
  smallest engine extension of any proposed lab, and the app carries most of the work.
  Mitigation: every phase ships dark, and phase 1 is a carriers chapter on its own.
