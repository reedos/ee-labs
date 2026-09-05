# Fields Lab: the plan

The two-semester electromagnetics course, as 53 experiments over one engine.
`EE_LABS_MAP.md` §2 track E names it and `PROGRAM.md` §3 says what it delivers.
This document is the first of those deliverables.

The lab's shape follows from one split. Half of electromagnetics is geometries
with closed forms, and half is geometries without them. A coaxial cable's
capacitance is 2 pi eps over ln(b/a), exact, and a rectangular trough with one
side raised has no such expression at all. The suite's discipline handles the
two differently. The closed forms are admitted exactly and never hedged. The
grid solve is an approximation, so it ships with a guard carrying a threshold,
and the guard is the change in the answer between two mesh refinements.

Every number quoted below was computed before it was written, by
`apps/fields-lab/scripts/numbers.mjs`. That script prints one labelled line per
figure and it runs against the engine, not against a table.

---

## 0. Open decisions

Five questions that want an answer from Reed before the second half is built.
Each carries a recommendation, and the lab is built to the recommendation until
Reed says otherwise.

### Decision 1: the field map canvas, and where it lives

`PROGRAM.md` §4 lists "Field map, a scalar or vector field over a geometry" as
new, with the Fields Lab first and the Devices Lab second. It is built in
`apps/fields-lab/src/components/FieldMapCanvas.jsx`, not in `packages/ui`,
because only one lab uses it today.

It carries the Devices Lab's need in its props from the start. The director
sent that need while this plan was being written, and
`/DEVICES_LAB_PLAN.md` Decision 5 states it. It is a one-dimensional profile
mode: a scalar against one spatial axis, with region boundaries marked, and an
optional second scalar on a right axis. The Devices Lab's own use is a stacked
triple of charge density, field and potential over one position axis, with the
depletion edges marked and a bias knob that redraws all three.

Recommended: build it in the app, with `mode: '2d' | 'profile'` in its props
from the first commit, and the profile shape of §4.2. List it in `NEEDS.md` as a
promotion candidate with the second lab's requirement named. The director
promotes it when the Devices Lab claims it.

### Decision 2: the Smith chart

`PROGRAM.md` §4 gives the Smith chart to the RF Lab, with the Fields Lab and the
Instruments Lab second. The RF Lab is not built and is blocked on this lab's own
transmission-line group, so the chart cannot be borrowed.

Recommended: build a minimal chart in `apps/fields-lab/src/components/SmithCanvas.jsx`.
Minimal means the two circle families, one load marker, and the rotation towards
the generator. It does not mean matching networks, admittance overlays or
constant-Q arcs, which are the RF Lab's work. The arithmetic under it is a
bilinear map and it lives in `packages/fields/src/line.js`, so the RF Lab
inherits the mathematics whatever it does with the drawing. `NEEDS.md` records
the chart as a promotion candidate.

### Decision 3: the events package

`EE_LABS_MAP.md` §3 says the lossless line runs on `events`, and §4 says the
Logic Lab builds that package. The Logic Lab is being built in parallel, so
`@ee-labs/events` is not available.

Recommended: implement the bounce diagram with a small self-contained event loop
inside `packages/fields/src/bounce.js`, exact, and record in `NEEDS.md` that it
should later run on `@ee-labs/events`. The loop is about seventy lines and its
shapes are chosen so the swap is a rewrite of thirty of them. Nothing in the app
or the lessons touches the loop directly.

### Decision 4: how much of the second half is one sitting

The transmission-line group is seven experiments and it gates the RF Lab. The
antenna group is five and it gates the System Lab's link budget. Neither gates
the other.

Recommended: phase the lab as three sittings. The first half (groups A to F) is
one. Groups G to J are the second, because the plane wave, reflection and the
line are one argument. Groups K and L are the third. §9 says what shipped.

### Decision 5: which conductivity the lessons use

Copper's conductivity is quoted between 5.80e7 and 5.96e7 siemens per metre
depending on the temper and the temperature. The difference moves a skin depth
by 1.4 per cent.

Recommended: one value, 5.8e7 for annealed copper at 20 degrees, exported as
`SIGMA_CU` and used everywhere. A lesson that quotes a skin depth names the
conductivity it used in the same sentence.

---

## 1. The progression map

`EE_LABS_MAP.md` §2 says the Fields Lab opens after Elements H and Circuit Lab.
Both are built, so this lab has no deferral for a prerequisite. The table below
is each group against what it leans on.

| Group | Leans on | Built? |
| --- | --- | --- |
| A Charge and the field | nothing outside this lab | yes |
| B Capacitance | Elements F, the capacitor as an element | yes |
| C Laplace on a grid | group B, for the closed forms it is checked against | in this lab |
| D Current and resistance | Elements A, Ohm's law | yes |
| E Magnetostatics | Elements F, the inductor as an element | yes |
| F Induction | group E, and Elements F | yes |
| G Maxwell and the plane wave | groups B and E, for eps and mu | in this lab |
| H Reflection | group G | in this lab |
| I Transmission lines | groups B, E and G, and Circuit Lab's phasors | yes |
| J The lossy line | group I, and Circuit Lab's frequency response | yes |
| K Waveguides | groups G and H | in this lab |
| L Antennas | groups E and G | in this lab |

Two facts about that table matter. Nothing in it waits on a lab that is not
built. Every dependency outside this lab is on Elements or Circuit Lab, and both
are released.

**What this lab gates.** The RF Lab waits on group I. The System Lab's link
budget waits on L5. The Devices Lab waits on the field map canvas, not on any
experiment. `BACKLOG.md` carries all three.

**The seam back to Elements.** Elements F introduces the capacitor as an element
with a value in farads. B1 puts a number on that value for the first time, from
the plate area and the gap. The seam runs the other way too. Elements H measures
a series RLC's resonance from L and C, and I2 shows where a cable's L and C come
from.

**The seam to Circuit Lab.** Circuit Lab sweeps a transfer function against
frequency. I5 sweeps a line's input impedance against length at a fixed
frequency, which is the same sweep with a different axis. J1 sweeps a lossy line
against frequency, which is the same axis with a different object.

---

## 2. The engine: geometry, closed forms, and the grid

`packages/fields`, a new workspace named in `EE_LABS_MAP.md` §3. It has no
dependency except `@ee-labs/network`, whose complex arithmetic it reuses rather
than rewriting.

### 2.1 The geometry description

One object shape for every canonical geometry, so a closed form, a grid solve
and a lesson all name the same thing.

```js
{ kind: 'coax', a: 0.45e-3, b: 1.475e-3, epsr: 2.25, mur: 1, sigma: 0, length: 1 }
```

`kind` is one of nine. `describeGeometry` fills the defaults, checks the
orderings, and throws a `FieldsError` naming the field and what it must be. An
inner radius larger than an outer one is not clamped. It is a different object,
and the message says so.

The nine kinds and what each has a closed form for:

| Kind | Dimensions | Capacitance | Inductance | Resistance |
| --- | --- | --- | --- | --- |
| `parallelPlate` | area, gap | yes | | yes |
| `coax` | a, b | yes | yes | yes |
| `spherical` | a, b | yes | | yes |
| `twoWire` | a, d | yes | yes | |
| `wireOverGround` | a, h | yes | yes | |
| `bar` | area, len | | | yes |
| `solenoid` | area, len, turns | | yes | |
| `toroid` | a, b, height, turns | | yes | |
| `loop` | a, wire | | yes | |

A geometry not on this list has no closed form here and is solved on a grid.
That split is the lab's whole structure.

### 2.2 The closed forms, and why they are trusted

`closed.js` holds fifteen expressions. The argument for each is not that it
matches a textbook. It is `closed.test.js`, which integrates the field law over
the same geometry and gets the same number. Coulomb's law summed over a charged
ring does not know what a ring's closed form says.

Three worked figures, all from the numbers script:

- RG-58 coaxial cable, a = 0.45 mm, b = 1.475 mm, epsr = 2.25. Its capacitance
  is 105.4 pF/m and its inductance 237.4 nH/m. The square root of their ratio is
  47.45 ohms and one over the square root of their product is 0.6667 c. The
  second of those is exactly one over the square root of 2.25, and I2 turns on
  that identity.
- A two-wire line, a = 0.4 mm, d = 6 mm. Its capacitance is 10.29 pF/m. The
  wide-spacing form pi eps over ln(d/a), which older books give, returns 10.27
  pF/m. The `acosh` form is exact at every spacing and the logarithm form is its
  limit, so B4 shows both and names the difference.
- A sphere of radius 50 mm inside a shell of 60 mm holds 33.38 pF. Move the
  shell to a kilometre and it holds 5.564 pF, which is the isolated sphere.

One of the fifteen is an approximation, and it carries a guard. The circular
loop's inductance neglects terms of order (r/a) squared, so `inductance` reports
the ratio against a threshold of 0.1 and states what the neglected terms are
worth.

### 2.3 The relaxation solver

`relax.js`. Finite volume on a uniform square mesh, not finite difference, so a
geometry with two dielectrics needs no special case. Around each node sits a cell
of side h. Each face carries a permittivity sampled at its midpoint, and the
equation at the node is that the four face fluxes sum to zero. With one
permittivity that is the five-point Laplacian. With two it is the interface
condition, because the normal component of D is what the sum conserves.

The same operator solves a conduction problem with sigma in place of eps, which
is why capacitance and resistance share one file.

Relaxation is successive over-relaxation in lexicographic order, at the factor
that is optimal for a Dirichlet square. An internal conductor makes it no longer
optimal. It stays a good deal faster than Gauss-Seidel, which is all that is
claimed for it.

A specification is:

```js
{ width, height, n, potential(x, y), epsr(x, y), neumann: { left, right, top, bottom }, outer, tol, maxIter }
```

`potential` returns volts where a conductor sits and null elsewhere. An edge
marked `neumann` is a symmetry plane, so a quarter of a symmetric geometry can be
solved and reported whole.

### 2.4 The mesh guard, which is Rule 3 in this lab

`CORE_SCOPE.md` Rule 3 requires a threshold, a behaviour and a test. The guard
is not the residual and not the iteration count. Both of those measure how well
the solver solved the discrete problem, which is a different question from how
well the discrete problem stands for the continuous one.

`converge(build, { n, threshold, read })` solves at n, 2n and 4n and reports:

- `change`, the relative change between the last two refinements. This is the
  guard's own quantity and it is what `threshold` is compared against.
- `order`, the convergence order the three levels show.
- `richardson`, the value they extrapolate to, and `estimate`, the remaining
  error that implies.
- `staircase`, the fraction of the conductor boundary that cuts across the mesh
  rather than following it.
- `band`, the error this report is willing to defend.
- `says`, one sentence naming both figures, for the panel.

`band` is the number every claim about a grid answer is measured against. It is
Roache's grid convergence index. The safety factor is 1.25 when the boundary
follows the mesh and the observed order is near the scheme's formal second order,
and 3 when it does not. A rectangle earns the first. A circle cut out of a square
mesh earns the second.

The staircase fraction is measured, not assumed. Walk every conductor node that
touches a free node. A node exposed on one side sits on a flat run. A node
exposed on two perpendicular sides is a step. A mesh-aligned rectangle has four
steps however fine the mesh, so its fraction falls as one over n. A circle has
steps all the way round, so its fraction stays where it is when the mesh is
halved.

Three worked cases, all from the numbers script:

| Case | Grid | Reference | Change | Order | Band | True error |
| --- | --- | --- | --- | --- | --- | --- |
| Trough at (25, 75) mm | 43.2018 V | 43.2028 V, Fourier series | 0.00696 % | 1.995 | 0.00291 % | 0.00232 % |
| Square coax, 2 mm in 7 mm | 47.83 pF/m | none | 0.118 % | 1.34 | 0.354 % | unknown |
| Round coax on a square mesh | 44.16 pF/m | 44.41 pF/m, closed form | 0.376 % | 0.79 | 1.54 % | 0.569 % |

The third row is the lesson. A curved boundary on a square mesh converges at
first order and not at second. The guard measures that rather than assuming it,
and the band it defends is wide enough to hold the true error.

### 2.5 Gauss's law as a check on a solved field

Two functions, and they check different things.

`normalIntegral(sol, rect)` walks every face joining a node inside a rectangular
block to a node outside it. `chargeInside(sol, rect)` sums the discrete
operator's residual over the nodes in the block. On a converged solve these agree
to the solver's own residual, because they are the two sides of the discrete
divergence theorem. That is a check on the bookkeeping.

The check on the physics is the flux against the closed form's charge. For the
round coax above, the grid's flux out of a box around the inner conductor is
44.41 pC/m and the closed form puts 44.41 pC/m there. C4 shows both numbers and
names which is which.

### 2.6 The line at one frequency, and the line in time

`CORE_SCOPE.md`'s worked-example table has one row about this lab:

> Transmission-line delay e^(−jβl). No. Transcendental, no finite poles or
> zeros. Refuse at the `systems` boundary.

That row is about `@ee-labs/systems`, whose currency is rational transfer
functions. It is not a refusal to compute the line. A line's response at one
frequency is a closed form in complex arithmetic, exact to the last bit, and
this lab states it without a hedge. What the suite declines is turning a line
into a rational H(s) so a pole-zero view can hold it.

So the line appears in four forms.

| Form | Handling | Where |
| --- | --- | --- |
| Lossless, frequency domain | exact | `lineAt`, `inputImpedance`, `sMatrix` |
| Lossy, frequency domain | exact, gamma complex | the same three functions |
| Lossless in time, resistive ends | exact, a finite event sum | `bounceDiagram` |
| Lossy in time | declined, with the reason | `refuseLossyTime` |

The refusal's reason is that a lossy line has no finite set of arrivals. Every
frequency travels at its own speed, so a step spreads as it goes. The numbers
script measures that on one line: at 10 kHz the phase velocity is 0.533e8 m/s
and at 1 MHz it is 1.976e8 m/s, a difference of 73 per cent. There is no state
to advance and no event to schedule. The frequency-domain response of that same
line is exact at every frequency, and the refusal message says so.

### 2.7 The bounce diagram, and why it is exact

A step launched into a lossless line arrives at the far end one delay later,
unchanged. It reflects into a step of Gamma_L times the amplitude, which arrives
back at the source one delay after that, and reflects again by Gamma_s. Every
wave on the line at any moment is one of this finite family. The voltage at a
point is the sum of the ones that have reached it. Nothing is integrated and
nothing is stepped.

The only approximation available would be stopping the sum early, so the loop
reports the amplitude of the wave it stopped at. At the default tolerance of a
part in a million million, the worked case runs to 32 waves.

One physical case has no steady state. A lossless line between two lossless ends
has reflection coefficients whose product has magnitude one, so it rings for
ever. `bounceDiagram` reports `rings: true` and quotes no final value, rather
than returning a number the sum does not converge to.

### 2.8 The exact round wire, and the approximation it guards

The skin-effect group needs a round wire's resistance against frequency. The
tube formula, one over sigma times 2 pi a delta, is an approximation, and this
lab does not guard an approximation with a rule of thumb.

`wireImpedance` solves the wire exactly. The current density obeys
J'' + J'/r + k^2 J = 0 with k^2 = −j omega mu sigma, and the module integrates it
outward from the axis in complex arithmetic with fourth-order Runge-Kutta. That
direction is the stable one, because the physical solution is the growing one.
Then Z is E_z(a) over the current integral. No Bessel function is tabulated and
none is approximated.

The check that this is right is its two limits. At zero frequency the resistance
ratio is 1 and the internal inductance is mu over 8 pi. That is 50.00 nH/m, and
it is exactly what the coaxial closed form adds when its `internal` option is
set. Against the published Kelvin-function tables the solve gives 1.07816 at
q = 2, 1.67787 at q = 4 and 3.09445 at q = 8. The tables give 1.0779, 1.678 and
3.094.

The tube formula is then guarded against that solve, not against a rule. At 1
MHz a 1 mm copper wire has a ratio of 7.822 and the tube formula is high by 3.27
per cent. At 10 kHz it is wrong by 31.3 per cent, and the guard reports the
radius as 0.756 skin depths against its threshold of 3.

### 2.9 Invariants, the fuzzer's checklist

Ten claims, each fuzzed over random settings inside every knob's range.

1. **Every closed form against an independent numerical integral.** The ring's
   axial field against a 720-charge superposition. The loop's axial field against
   Biot-Savart on a polygon. The parallel plate, coaxial and spherical
   capacitances against the energy in the field they produce.
2. **The relaxation solver against the closed forms, inside its own reported
   band.** For every canonical geometry the grid can mesh, at three mesh levels.
3. **Gauss's law on any solved field.** The flux through a closed contour equals
   the enclosed charge over eps0, to the mesh error the guard reports.
4. **The discrete divergence theorem.** `normalIntegral` times eps0 equals
   `chargeInside`, to the solver's residual.
5. **The R C product.** For every geometry with both a capacitance and a
   resistance, R C equals eps over sigma, and it does not depend on the shape.
6. **Ampere's law against Biot-Savart.** The line integral around a contour
   equals mu0 times the current the contour encloses.
7. **The bounce diagram's steady state equals the direct-current divider.** For
   every resistive pair that has one.
8. **The line's input impedance at every frequency equals the closed form.** A
   quarter wave inverts, a half wave repeats, and an open stub is a short at a
   quarter wave.
9. **Reciprocity of the two-port line.** S21 equals S12 at every frequency, on
   lossy and lossless lines alike.
10. **The refusals fire.** A lossy line in time throws with its reason. Oblique
    incidence onto a conductor throws with its reason. A geometry with no closed
    form throws with its reason.

---

## 3. Models: the geometry library

Fixed names, used in the experiments, the tests and the report link. A lesson
that says "the coax" means `LIB.rg58`.

| Name | Geometry | Why it is in the library |
| --- | --- | --- |
| `plate` | parallelPlate, 100 mm2, 1 mm, air | B1's default, and the only uniform field in the lab |
| `plateFR4` | the same with epsr 3.9 | B1's second knob position |
| `rg58` | coax, a 0.45 mm, b 1.475 mm, epsr 2.25 | B2, D3, I2. A real cable, so its 47.45 ohms can be checked against a datasheet |
| `sphere` | spherical, a 50 mm, b 60 mm | B3 |
| `twinLead` | twoWire, a 0.4 mm, d 6 mm | B4, I2's second line |
| `overGround` | wireOverGround, a 1 mm, h 10 mm | B4's method of images |
| `copperBar` | bar, 1 mm2, 1 m | D1, D2 |
| `solenoid200` | solenoid, 400 turns, 200 mm, 10 mm bore | E3, E4 |
| `toroid` | toroid, a 20 mm, b 30 mm, h 10 mm, 200 turns | E4 |
| `gappedCore` | meanLength 200 mm, area 400 mm2, mur 2000, gap 1 mm | E5, and Power Lab's group D assumption |
| `transformer200to50` | the same core, 200 and 50 turns | E6 |
| `wr90` | guide, a 22.86 mm, b 10.16 mm | K1, K2 |
| `cavity` | wr90 with d 20 mm | K3 |
| `line50` | Z0 50 ohms, vp 2e8, 2 m | I1, I3 to I7 |
| `lossyLine` | R 0.5, L 250 nH, G 1 uS, C 100 pF, 100 m | J1, J2 |

---

## 4. The app

### 4.1 Layout

The suite's shape. A sidebar of experiments grouped by letter, a main pane with
the geometry and its knobs, and a lower pane with the view switch. `LabNav`,
`NumField`, `LessonNav`, `TryLine` and `ReportIssue` come from `packages/ui`
unchanged.

The one new thing is the field map. It replaces the schematic in the top pane
for every experiment in groups A to F, and it draws what the experiment gives it.

### 4.2 The field map canvas

`FieldMapCanvas.jsx`. Props:

```js
{
  mode,        // '2d' or 'profile'
  domain,      // { width, height } in metres
  scalar,      // (x, y) => number, drawn as the colour field
  vector,      // (x, y) => [ex, ey], drawn as arrows and as field lines
  equipotentials, // [{ level, points }] from traceEquipotential or from the grid
  conductors,  // [{ path, potential }] drawn as filled outlines with their volts
  probe,       // { x, y } the cursor, whose readout sits in the header
  units,       // { length: 'mm', scalar: 'V', vector: 'V/m' }
  profile,     // the one-dimensional mode, below
}
```

The profile mode is what makes it promotable, and its shape is the Devices Lab's
requirement rather than this lab's convenience.

```js
profile: {
  axis,        // 'x' or 'y', the spatial axis the curve runs along
  cut,         // the position of the cut in the other coordinate, in metres
  scalar:    { read(t), label, unit },        // the left axis
  secondary: { read(t), label, unit } | null, // the right axis, optional
  regions:   [{ from, to, label, edge }],     // boundaries drawn as marked lines
  stack:     [{ scalar, secondary, regions }] | null, // panels over one position axis
}
```

`regions` is what draws a depletion edge. `secondary` is the second scalar on a
right axis. `stack` is what draws the Devices Lab's triple of charge density,
field and potential over one position axis with the edges aligned. Every panel
in a stack shares the position axis and its ticks, so a bias knob moves all of
them together.

Colour follows `packages/ui`'s palette rules. The scalar field is a diverging
ramp when it has a sign and a sequential one when it does not, and the zero of a
diverging ramp sits at the neutral colour.

### 4.3 Views

| View | Shows | Groups |
| --- | --- | --- |
| Map | the field over the geometry, with equipotentials and field lines | A to F |
| Profile | one cut through the map, as a curve, with regions marked | A to F |
| Numbers | every closed form for this geometry, with its formula | B, D, E |
| Mesh | the three refinements and the guard's verdict | C |
| Flux | the Gauss contour, the flux through it, and the charge inside | A, C |
| Circuit | the magnetic circuit as a circuit, with its reluctances | E |
| Wave | the plane wave in space and time, with its polarisation ellipse | G, H |
| Interface | the incident, reflected and transmitted waves at a boundary | H |
| Bounce | the ladder diagram, with the scope trace beside it | I |
| Line | voltage and current along the line at one instant | I |
| Smith | the chart, with the load and the rotation towards the generator | I |
| Sweep | one quantity against frequency or against length | D, F, I, J, K |
| Guide | the mode chart, and the field across the guide | K |
| Pattern | the radiation pattern in polar form, with the beamwidth marked | L |

### 4.4 Numbers

Every number a lesson quotes is a function of the knobs, and
`experiments.test.js` recomputes it from the engine at the settings the step
names. No number is a constant in a test where the knobs can produce it.

A number a grid produced is quoted to the figures its guard allows, and never to
more. `quoted(report, value)` does that rounding, so a caption cannot over-claim
by formatting.

---

## 5. Curriculum: 53 experiments in 12 groups

Each entry is the experiment's name and the claim its note makes. The claim is
what `experiments.test.js` measures.

### Group A: Charge and the field (5)

- **A1 Two charges push each other apart.** Coulomb's law. Two 1 nC charges 10
  mm apart push with 89.88 microN. The force follows one over the square of the
  distance, so doubling the spacing quarters it.
- **A2 Fields add, one charge at a time.** Superposition. Two opposite 1 nC
  charges 10 mm apart give 677.9 kV/m at the midpoint, which is twice one
  charge's 339.0 kV/m because both point the same way there.
- **A3 The flux out of a closed surface counts the charge inside.** Gauss's law.
  A 2 nC charge placed off centre inside a 50 mm sphere still gives a flux of
  2.000 nC over eps0, to a part in 10^14. Move it outside and the flux is zero.
- **A4 A line and a sheet fall off differently.** A point charge falls as one
  over r squared, a line as one over r, and a sheet not at all. A 1 nC/m line
  gives 1798 V/m at 10 mm. A 1 nC/m2 sheet gives 56.47 V/m at every distance.
- **A5 Equipotentials cross the field at right angles.** The potential of two
  charges, its level curves traced, and the field lines drawn perpendicular to
  them. The traced curve holds its level to a part in a hundred million, and
  halving the step divides that deviation by about sixteen.

### Group B: Capacitance in closed form (5)

- **B1 A parallel plate holds eps A over d.** 100 mm2 at 1 mm holds 0.8854 pF in
  air and 3.453 pF with epsr 3.9. The field is 10.00 kV/m at 10 V, uniform, and
  the only uniform field in this lab.
- **B2 A coaxial cable holds 2 pi eps over ln(b/a).** RG-58 holds 105.4 pF/m.
  The field is largest at the inner conductor, 0.1872 MV/m at 100 V, which is
  where a real cable breaks down.
- **B3 A sphere inside a shell, and a sphere alone.** 50 mm inside 60 mm holds
  33.38 pF. Move the shell to a kilometre and it holds 5.564 pF, which is 4 pi
  eps a and does not need a second conductor.
- **B4 Two wires, and the images inside them.** 10.29 pF/m at a 0.4 mm, d 6 mm.
  The acosh form is exact at every spacing. The ln(d/a) form gives 10.27 pF/m
  here and is its wide-spacing limit.
- **B5 The energy is in the field.** One metre of RG-58 at 100 V stores 0.5272
  microjoule, which is half C V squared. Integrating eps E squared over two gives
  the same number, and the density peaks at 0.3490 J/m3 at the inner conductor.

### Group C: Laplace on a grid (5)

- **C1 Relaxation finds the potential a geometry has no formula for.** A square
  trough with one side at 100 V. Each node becomes the average of its four
  neighbours, over and over. The centre reads 25.000000 V by symmetry, at every
  mesh.
- **C2 The guard is the change between two meshes.** At 20, 40 and 80 cells the
  point (25, 75) mm reads 43.1868, 43.1988 and 43.2018 V. The last halving moved
  it 0.00696 per cent, the order is 1.995, and the band is 0.00291 per cent. The
  Fourier series gives 43.2028 V.
- **C3 A curved boundary converges more slowly.** The same solver on a round
  coax gives 44.16 pF/m against the closed form's 44.41. The order falls to 0.79
  because the circle cuts across the mesh, the guard measures that, and the band
  widens to 1.54 per cent to hold the 0.569 per cent error.
- **C4 Gauss's law checks the solved field.** The flux out of a box around the
  inner conductor is 44.41 pC/m and the closed form puts 44.41 pC/m there. The
  flux and the charge inside agree to the solver's residual.
- **C5 A geometry with no closed form at all.** A square inner conductor inside a
  square shield holds 47.83 pF/m. Nothing to check it against, so the guard is
  the whole warrant. Its change of 0.118 per cent is past the 0.1 per cent
  threshold, so the answer is quoted to two figures.

### Group D: Current and resistance (4)

- **D1 Ohm's law at a point, and Ohm's law at a bar.** J = sigma E is the point
  form. A copper bar 1 m long and 1 mm2 in section has 17.24 milliohms, and the
  two forms give the same current.
- **D2 The resistance of a geometry.** Coaxial leakage through a dielectric of
  1e-12 S/m is 188.9 gigaohms for a metre. The formula is the capacitance's with
  eps replaced by sigma and the result inverted.
- **D3 R times C does not depend on the shape.** For that coax the product is
  19.92 seconds, and it is eps over sigma. The same Laplace solution serves both
  problems, so the geometry cancels.
- **D4 The four-point probe reads two different numbers.** 5 mV at 1 mA with 1
  mm spacing gives 3.142 ohm-cm on a thick block. The same reading on a 1
  micrometre film gives 22.66 ohms per square, and the sheet coefficient pi over
  ln 2 is 4.53236 whatever the spacing.

### Group E: Magnetostatics (6)

- **E1 Biot-Savart, summed over a wire.** A 50 mm loop carrying 3 A gives 37.70
  microtesla at its centre. The polygon of 720 sides gives 37.6994, which is
  0.000635 per cent from the closed form, and the error falls as one over the
  square of the side count.
- **E2 Ampere's law counts the current the same way Gauss counts charge.** The
  line integral around a long wire gives mu0 times 10 A to twelve figures. The
  field is 100.0 microtesla at 20 mm and it falls as one over r.
- **E3 A solenoid is nearly uniform inside and a toroid is exactly closed.** 400
  turns over 200 mm at 2 A gives 5.002 millitesla, which is 0.99504 of the
  infinite solenoid's value. A toroid's field is inside it and falls as one over
  r across the winding.
- **E4 Inductance of the canonical geometries.** RG-58 gives 237.4 nH/m
  externally and 287.4 nH/m with the conductor's own field added. The internal
  part is mu over 8 pi, 50.00 nH/m, whatever the radius. The solenoid gives 315.8
  microhenry.
- **E5 The magnetic circuit, and what a gap does.** A core of mur 2000 with a 1
  mm gap gives 18.29 mH against 201.1 mH ungapped, a factor of 11.00. The gap
  takes 90.95 per cent of the magnetomotive force while filling half a per cent
  of the path. This is the model Power Lab's group D assumes.
- **E6 The transformer, from the reluctance up.** 200 and 50 turns on that core
  give 205.2 mH, 12.82 mH and a mutual 50.27 mH. The coupling coefficient is
  0.9800, which is one minus the leakage fraction, and L1 L2 over M squared is
  1.04123.

### Group F: Induction (4)

- **F1 Faraday, and where 4.44 comes from.** 200 turns of 400 mm2 at 1.2 T and
  50 Hz give 21.33 V rms. The coefficient is 2 pi over root 2, which is 4.44288,
  and the familiar 4.44 is that rounded.
- **F2 A conductor moving across a field.** A 250 mm bar at 3 m/s across 0.4 T
  gives 0.3000 V. Turn the velocity along the field and the emf goes to zero,
  because only the perpendicular part counts.
- **F3 Eddy currents, and why a core is laminated.** A 0.35 mm lamination at 50
  Hz and 1.2 T loses 1.543 kW/m3. Halving the thickness gives 0.3859, a ratio of
  4.000, because the loss follows the square of the thickness.
- **F4 The skin depth.** Copper is 9.346 mm deep at 50 Hz, 66.09 micrometres at
  1 MHz and 2090 nm at 1 GHz. A 1 mm wire at 1 MHz has 7.822 times its
  direct-current resistance. The tube formula is high by 3.27 per cent there and
  wrong by 31.3 per cent at 10 kHz, where its guard refuses it.

### Group G: Maxwell and the plane wave (4)

- **G1 The displacement current closes the set.** Ampere's law without it
  contradicts charge conservation at a charging capacitor. With it the same
  current flows through a surface cutting the wire and one cutting the gap.
- **G2 The plane wave in free space.** E and H are perpendicular, in phase, and
  their ratio is 376.7303 ohms. The wavelength is 299.8 mm at 1 GHz. In a medium
  of epsr 4 the impedance halves to 188.37 ohms and the speed halves.
- **G3 A lossy medium, and the loss tangent.** Seawater at 1 MHz has a loss
  tangent of 887.7. The wave falls by 3.972 nepers per metre, so it penetrates
  25.18 cm, and the intrinsic impedance's angle is 44.97 degrees, which is
  nearly the 45 degrees of a good conductor.
- **G4 Polarisation is the phase between two components.** Equal amplitudes a
  quarter cycle apart give circular. Two to one gives an ellipse of 6.021 dB
  axial ratio. In phase gives a line.

### Group H: Reflection at an interface (3)

- **H1 Normal incidence.** Air into epsr 4 reflects 0.3333 of the field and
  11.11 per cent of the power. The reflected and transmitted power fractions sum
  to 1.00000000000.
- **H2 The standing wave, and what its ratio measures.** That reflection makes a
  standing-wave ratio of 2.000. The first minimum sits where the two waves
  oppose, and its position gives the load's phase.
- **H3 Oblique incidence, Brewster, and total reflection.** Into epsr 4 the
  Brewster angle is 63.4349 degrees, where the parallel polarisation reflects
  1.7e-16 and the perpendicular still reflects 0.6000. Out of epsr 4 the critical
  angle is 30.000 degrees, and past it the magnitude is exactly 1.00000.

### Group I: Transmission lines (7)

- **I1 The telegrapher's equations.** A line is L and C per metre. 50 ohms at
  2e8 m/s is 250.0 nH/m and 100.0 pF/m, and two metres of it delays by 10.00 ns.
- **I2 Where Z0 and vp come from.** The RG-58 geometry of B2 and E4 gives 47.45
  ohms and 0.666667 c. That speed is exactly one over the square root of 2.25,
  which is the seam between this lab's two halves.
- **I3 The reflection coefficient.** 100 ohms on a 50 ohm line gives +0.3333, 25
  ohms gives −0.3333, and an open gives exactly 1.000.
- **I4 The bounce diagram.** 5 V behind 25 ohms into 150 ohms. The first wave is
  3.3333 V, the load reads 5.0000 V after one delay and 4.1667 V after two, and
  the arrivals settle to 4.28571 V. That is exactly the divider 5 times 150 over
  175 with the line taken away.
- **I5 Input impedance against length.** A quarter wave of 50 turns 100 into
  25.0000 ohms. A half wave repeats it at 100.000. An eighth-wave open stub is
  −50.000 ohms of reactance.
- **I6 The quarter-wave transformer.** Matching 50 to 100 needs 70.7107 ohms,
  the geometric mean. It matches two real impedances, and the function declines a
  reactive load with the reason.
- **I7 The Smith chart.** The bilinear map from normalised impedance to
  reflection coefficient. Constant resistance is a circle, constant reactance an
  arc, and moving towards the generator is a clockwise rotation. Half a
  wavelength is one full turn.

### Group J: The lossy line (2)

- **J1 Exact at every frequency.** The lossy line's Z0 is 280.41 ohms at −39.58
  degrees at 10 kHz and 51.221 ohms at −8.783 degrees at 1 MHz. Its attenuation
  is 4.312 dB per 100 m at 1 MHz.
- **J2 In time, declined, with the reason.** The phase velocity is 0.533e8 m/s
  at 10 kHz and 1.976e8 at 1 MHz, a difference of 73.0 per cent. A step's parts
  arrive at different times, so no finite set of arrivals describes it. The panel
  states that and points at J1.

### Group K: Waveguides and the cavity (3)

- **K1 A hollow pipe has a cutoff.** WR-90's TE10 cuts off at 6.5571 GHz and
  TE20 at 13.114 GHz, so exactly one mode propagates over an octave. Below
  cutoff the field decays at 772.3 dB per metre at 5 GHz and carries no power.
- **K2 The guide wavelength, and two velocities.** At 10 GHz the guide wavelength
  is 39.707 mm against 29.979 mm in free space. The phase velocity is 1.3245 c
  and the group velocity 0.75501 c. Their product is c squared to twelve figures,
  and the group velocity is what carries energy.
- **K3 A closed guide is a resonator.** 22.86 by 10.16 by 20 mm resonates at
  9.958328 GHz in TE101. With copper walls its Q is 7824 and its bandwidth 1.273
  MHz. The skin depth there is 662.2 nm.

### Group L: Antennas (5)

- **L1 The Hertzian element radiates as sine squared.** Its directivity is
  exactly 3/2, and the quadrature reproduces 1.50000000000. At a hundredth of a
  wavelength its radiation resistance is 0.07896 ohms.
- **L2 The half-wave dipole.** Its directivity is 1.64092, which is 2.1509 dBi,
  and its half-power beamwidth 78.078 degrees. Its radiation resistance is
  73.0790 ohms. The tables give 73.13 because they round eta over 4 pi to 30.
- **L3 Directivity, gain and efficiency.** Gain is efficiency times directivity.
  A half-wave dipole at 90 per cent efficiency gives 1.6933 dBi, which is 0.4576
  dB below its directivity. A full-wave dipole reaches 2.41100 and a 1.25
  wavelength one 3.28248, which is the maximum for a straight wire.
- **L4 The array factor.** Four elements at half a wavelength give a directivity
  of 4.00000 and a beamwidth of 26.323 degrees. Eight give 8.00000 and 12.803
  degrees. Ninety degrees of progressive phase steers the beam to 60.000 degrees.
  At 1.5 wavelengths of spacing two grating lobes appear.
- **L5 Friis, and the link budget.** 100 mW at 2.4 GHz over 1 km between 12 and
  2 dBi antennas delivers −66.052 dBm. The free-space loss is 100.05 dB and the
  wavelength 12.49 cm. The 12 dBi antenna has an effective aperture of 196.8 cm2.

---

## 6. Hand-overs

Four seams out of this lab, and one in.

**To the RF Lab (group I).** The Smith chart's arithmetic is
`packages/fields/src/line.js`, and its canvas is this app's. `NEEDS.md` lists the
canvas as a promotion candidate. The RF Lab's S-parameters extend `sMatrix`,
which already returns the ABCD matrix it was built from.

**To the System Lab (L5).** `friis` returns the received power, the free-space
loss and the effective aperture, and it carries the far-field guard. A link
budget is a sum of those terms.

**To the Devices Lab (the canvas).** The field map's profile mode, in the shape
`/DEVICES_LAB_PLAN.md` Decision 5 asks for. That lab draws a stacked triple of
charge density, field and potential over one position axis, with the depletion
edges marked. `NEEDS.md` carries the promotion request and names the
requirement.

**To the Power Lab (E5, E6).** Power Lab's group D assumes a magnetic circuit
with a gap. E5 builds that circuit from the geometry and E6 the transformer from
the circuit. The hand-over is a deep link carrying the core's dimensions.

**From Elements and Circuit Lab.** B1 gives Elements F's capacitor a value from
its geometry. E4 does the same for the inductor. I5 is Circuit Lab's frequency
sweep with length on the axis instead.

---

## 7. Testing discipline

Four layers, in the order they run.

**The engine's own tests.** `packages/fields/src/*.test.js`. The ten invariants
of §2.9, each fuzzed over a deterministic pseudo-random sweep of every knob's
range. A closed form is checked against an integral of the field law, never
against another closed form.

**The experiments' numbers.** `apps/fields-lab/src/experiments.test.js`. Every
number in every `see`, `try` and `why` is recomputed from the engine at the
settings the step names. A number a step quotes that the engine does not produce
fails the test.

**The prose.** `apps/fields-lab/src/prose.test.js`, on every name, `see`, `try`,
`why` and term definition, against `packages/prose`. `npm run lint:prose` covers
the plan, the brief and `NEEDS.md`.

**The page.** `apps/fields-lab/scripts/verify.mjs`, written and not run in this
sitting. It loads every experiment, opens every view, moves knobs and reads back
what the panes show. It is the only thing that catches a prop not passed.

**The rule about grid numbers.** A number a grid produced is pinned to the
figures its guard allows and no more. A test that pins a grid answer to six
figures fails on a machine whose default mesh is finer. Such a test pins the mesh
rather than the physics.

---

## 8. Integration and the dark launch

`RELEASE_STATUS` reads `dark`. `release.test.js` is Circuit Elements Lab's file
with the slug changed, and it checks that `site/index.html`, `README.md` and
`packages/ui/src/LabNav.jsx` do not mention this lab while the status is dark.

`NEEDS.md` carries the one line the director adds to `deploy.yml`:

```
cp -r apps/fields-lab/dist _site/fields-lab
```

and the ids and counts for `packages/ui/src/progression.test.js`, which the
seams overseer owns.

---

## 9. Phasing

Three sittings, and this document is updated at each boundary to say what
shipped.

**Sitting 1, the first half.** `packages/fields` complete for groups A to F.
The app, dark, with the field map canvas and 29 experiments. Green.

**Sitting 2, the wave and the line.** Groups G to J, 16 experiments, including
the Smith chart canvas and the bounce diagram.

**Sitting 3, the guide and the antenna.** Groups K and L, 8 experiments.

### 9.1 What shipped

Written at each boundary, and this is the second one.

**Sitting 1 shipped in full.** `packages/fields` is complete for the whole lab
and not only for the first half. Every one of §2.9's ten invariants has a named
test. The wave, the line, the bounce diagram, the waveguide and the antenna are
all in the package with their tests, ahead of the app that will use them. The
app is dark, with 29 experiments in groups A to F, the field map canvas in both
of its modes, and the three registers on every experiment.

Sitting 1 also delivered what it had left implicit. `experiments.test.js`
recomputes every number in every `see`, `try` and `why` from the engine at the
settings the step names. `prose.test.js` measures how those sentences are
written and `terms.test.js` holds a word to being defined where it first does
work. `components/panes.test.js` renders every view every experiment offers, and
`scripts/verify.mjs` is written and not run. Eight faults surfaced in the
writing of them and are fixed. The report names each.

**Sitting 2 shipped in part, and stopped at a group boundary.** Groups G and H
are built, 7 experiments, with the wave and interface panes and 24 new terms.
Their pictures come from the field map's profile mode rather than from a new
canvas. A plane wave against distance, a standing wave in front of a boundary,
and the two Fresnel coefficients against the angle are all one scalar against
one axis with regions marked. That is what the mode takes. The polarisation
ellipse is the one picture it cannot draw, being a path in the transverse plane,
and it has its own small canvas inside the wave pane.

H3 carries the group's refusal. Oblique incidence onto a conducting medium is
declined with its reason, the second medium's conductivity is a toggle that
reaches it, and the third `try` step is that refusal.

**Groups I to L are not built.** The plan for sitting 2 was groups G to J. It
stopped after H because the line is a whole argument and half of one is worse
than none. `BACKLOG.md` carries I, J, K and L with what each needs. Nothing in a
built lesson references them, and the sidebar shows no tab for a group with
nothing in it.

**Revised phasing.** Sitting 3 is groups I and J with the Smith chart and the
bounce diagram, 9 experiments. Sitting 4 is groups K and L, 8 experiments. The
seams both sittings build into are landed and green. The group, lesson and term
files merge from one file per group. `readQuantity` reads the line, the bounce
diagram, the guide and the antenna by name, and the panes they draw in are wired
to their views.

---

## 10. Non-goals

Stated so they are decisions rather than omissions.

- **A three-dimensional field solver.** The grid is two-dimensional. Every
  geometry in the library is either planar or has a closed form. A
  three-dimensional solve needs a different data structure, a different guard
  and a different canvas.
- **The method of moments, and any integral-equation solver.** An antenna's
  current is assumed sinusoidal here, and an undergraduate course assumes the
  same. Solving for the current is a graduate subject and a different engine.
- **Ferromagnetic saturation and hysteresis.** The magnetic circuit takes a
  constant mur. Saturation makes the reluctance a function of the flux, which is
  the Machines Lab's subject.
- **A lossy line in time.** Declined, with a tested reason. §2.6.
- **Oblique incidence onto a conductor.** Declined. The transmitted angle is
  complex and the geometry the lesson would draw does not exist.
- **Matching networks.** The quarter-wave transformer is here because it is a
  line. Stubs, L-networks and the rest are the RF Lab's.
- **Radiation from anything but a straight wire and an array of them.** Horns,
  patches and reflectors are the RF Lab's.

---

## 11. Risks, named

- **The grid solver is slow enough to time out.** Three mesh levels at 240 cells
  is about 30 seconds on this machine for one geometry. The test suite's timeout
  is 90 seconds and a shared runner is slower. Mitigation: the fuzz tests solve
  at 60 and 120 cells, not at 240, and the one 240-cell case is a single test
  that says so itself.
- **The staircase heuristic misreads a geometry.** The safety factor turns on a
  measured fraction with a threshold of 0.02. A geometry that sits near the
  threshold could take the narrow band when it wants the wide one. Mitigation:
  the fuzz test sweeps twelve radius ratios and reports the worst margin, which
  is 0.52 of the band.
- **The bounce diagram's tail.** The loop stops at a part in 10^12 of the first
  wave, or at 400 waves. A reflection product very near one produces 400 waves
  and a truncated sum. Mitigation: `complete` says whether the sum ran out, and
  `rings` catches the exactly-unity case before the loop starts.
- **The Smith chart drawn twice.** This lab's chart and the RF Lab's will differ
  unless the director promotes one. Mitigation: the arithmetic is already in the
  package, so only the drawing can diverge, and `NEEDS.md` names it.
- **Fifty-three experiments in one app.** The sidebar is long. Mitigation: the
  fold pattern `REVIEW_PLAYBOOK.md` §7 describes, with the active item's group
  held open.
