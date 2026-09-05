# Energy Lab: the plan

A lab for the sources that power electronics converts. Power Lab starts at a
DC source of twelve volts and asks what a switch can do with it. This lab asks
where those twelve volts came from. The answer is a diode in the sun, and a
diode's worth of chemistry. Neither holds its voltage at any current. Splash
glyph ☀, directory `apps/energy-lab`, and no new package.

Decisions taken before the first line:

- **No engine work.** Everything here is solved by `@ee-labs/network` and
  `@ee-labs/switched` as they stand today. The photovoltaic cell is Circuit
  Elements Lab's I1 with one element moved, and `newtonDC` already solves it.
  The battery is Elements F's RC ladder. The converter is Power Lab's buck.
  Anything the two packages lack goes into `apps/energy-lab/NEEDS.md` as a
  contract, and the lab builds what it can without it. §7 lists what went
  there.
- **Dark launch.** `RELEASE_STATUS` says `dark`. While it does,
  `src/release.test.js` fails if any public surface names the lab.
- **The wind group is not in this plan.** A wind turbine's electrical half is a
  machine, and no lab in the suite teaches machines. `BACKLOG.md` records it
  under "### Energy Lab", where it waits on the Machines Lab.
- **Labelled data is labelled.** One group runs on numbers that are not
  physics. They are a day's irradiance, a day's cell temperature and a day's
  household load, twenty-four hourly figures each. They are named as data on
  screen and in `physics.js`, and no test treats them as a claim about the
  world. What the balance does with them is arithmetic on exact solves, and
  that part is pinned like everything else.

The suite's one rule holds with no exemptions. Every explanatory sentence is a
claim about physics, and a test must measure it. Every number below was printed
by `apps/energy-lab/scripts/numbers.mjs` before it was written down. Running
`npm run numbers --workspace apps/energy-lab` prints them again.

---

## 1. Where this lab sits

| It assumes | From |
| --- | --- |
| The exponential diode, and Newton's method finding its operating point | Elements I1, I2 |
| The load line, and reading a curve against a straight line | Elements I2 |
| Assumed states, for the bypass diode's two positions | Elements I3 |
| The capacitor as a state, and the first-order response | Elements F1, F3 |
| The RC ladder and its two time constants | Elements F |
| Volt-second balance, M = D, and a buck in continuous conduction | Power Lab B1, B2 |

| It gives | To |
| --- | --- |
| A source whose voltage falls with current, for a converter to track | Power Lab Group H, when the loop closes on it |
| A store with a state of charge | this lab's Group E |
| The maximum power point, and a stepper that finds it | Power Lab's buck, driven by duty |

**Progression row.** This lab opens after Elements Group I and after Power
Lab's buck. Both are built. §8 carries the row for `CURRICULUM.md` §1, with the
counts a progression test can check.

---

## 2. The models

### 2.1 The photovoltaic cell

One diode, one current source, two resistors:

    i = I_ph − I_s(e^(v_j/nV_T) − 1) − v_j/R_sh,      v = v_j − i·R_s

That goes in as a netlist, with the fixed node names the brief's §4.1 gives.
Nothing about it is new to the suite. `I_ph` is an `I` element and the junction
is Elements' `exp` diode. `newtonDC` finds the operating point exactly as it
does for I2.

The parameters, and where each comes from:

| Symbol | Default | What it is |
| --- | --- | --- |
| `I_ph` | 5.000 A at 1000 W/m² | the photocurrent at the standard condition |
| `I_s` | 1.000 × 10⁻¹⁰ A at 298.15 K | the junction's saturation current |
| `n` | 1 | ideality factor |
| `R_s` | 0, toggling to 5 mΩ | series resistance, the contacts and the fingers |
| `R_sh` | 10 kΩ, toggling to 5 Ω | shunt resistance, the leakage across the junction |
| `G` | 1000 W/m² | irradiance in the plane of the cell |
| `T` | 298.15 K | cell temperature, which is 25 °C |

At the standard condition that cell gives I_sc = 5.0000 A and V_oc =
0.632944 V. Its maximum power point is 0.552926 V and 4.77793 A, so P_mpp is
2.64184 W. Its fill factor is 0.83478.

**The shunt is not infinite.** A real cell always has a shunt path, and ten
kilohms is about as good as one gets. It is also what makes a long string
solvable. Over the flat part of a twelve-cell string's curve, every junction
carries a few microamps and has a tenth of a microsiemens of conductance.
Newton has almost nothing to stand on there. Elements I5 made the same call for
the same reason, with its ten megohms of reverse leakage.

What it costs is measured rather than assumed. V_oc falls by 0.325 µV and P_mpp
by 0.001157 % against the same cell with the element removed. A6 quotes both.

**The sweeps stop a millionth short of the short circuit.** There a junction's
current is a difference of two numbers near five amps. It carries about
10⁻¹⁵ A of rounding, so no tolerance below that is reachable. The short circuit
itself is solved with the terminal held at zero volts, where every junction
sits at zero and the solve is easy. Every solve asks for a nanovolt rather than
the solver's picovolt. On a 0.63 V cell that is 1.6 parts in 10⁹, far below the
fifth figure any note quotes. With it, every point of every curve converges,
and none takes more than twelve iterations.

### 2.2 The curve, and how it is parameterised

A series string carries one current, and its junctions land where they must.
That is the physics, and it is also the numerics. Held at a terminal voltage,
the split between twelve nearly-open junctions is left to the solver, and
`newtonDC` refuses over about a sixth of the range. Held at a terminal current,
each junction's own current is fixed by its own photocurrent. The same solver
then converges over the whole curve.

So `atI` is the primitive, and `atV` and `atR` bisect it. That costs one scalar
search per point. It buys a curve with no holes in it. It is worth saying on
screen, because it is the same sentence as the physics. Ask a string what
current it is carrying, not what voltage it is at.

A maximum of that curve is found in two steps. A coarse scan says which
bracket of the current holds one. A golden section on the exact solve then
says where in the bracket it is. That second step makes B5's two humps the
model's own, rather than the nearest of 121 samples. On the lower hump the
difference is a tenth of a volt.

### 2.3 The temperature law, stated

The photocurrent is proportional to the irradiance exactly:

    I_ph(G) = (G/G_ref) · I_ph,ref

The saturation current follows the law SPICE uses, with silicon's band gap and
the diffusion exponent:

    I_s(T) = I_s(T_ref) · (T/T_ref)^(XTI/n) · exp( (E_g·q / n·k) · (1/T_ref − 1/T) )
    E_g = 1.12 eV,   XTI = 3

That law is the whole of the temperature story. It doubles `I_s` every
4.7231 K. Because V_oc = n·V_T·ln(I_ph/I_s + 1), it drags V_oc down even while
V_T itself rises. Measured on the standard cell, dV_oc/dT is −1.9006 mV/K over
25 to 45 °C, and −1.9087 mV/K over 25 to 65 °C. The maximum power falls by
0.389 % per kelvin. This lab carries no datasheet temperature coefficient. It
carries this law, labelled, and reports the coefficient the law produces.

### 2.4 Shading, and what the model does not have

A shaded cell in a string is asked to carry more current than its light makes.
Its junction is driven backwards. A real cell then breaks down near −15 V, and
this model has no breakdown. Its only reverse path is the shunt resistance.
With `R_sh` at 5 Ω, a reverse current of 3.27793 A puts −16.390 V across the
shaded cell. That cell turns 78.31 W into heat, which is the hot spot bypass
diodes exist to prevent.

Under Rule 3 of `CORE_SCOPE.md` that number carries a guard, and the guard is
concrete. The model stands in for the real reverse branch only while the shaded
cell's voltage stays above about −15 V. Below that a real cell breaks down and
this one does not. B4's own default is past that bound, by design.
`src/guards.js` holds the sentence that says so, and the panel prints it under
every picture that shows a reverse voltage. The claim a reader takes away is
the size of the heat and its mechanism, not the exact volts.

### 2.5 The tracker

Perturb and observe, as a discrete stepper on the exact P–V curve:

```js
poStep({ v, p, dir }, power, { step, vmin, vmax }) -> { v, p, dir, gained }
```

Move by one step in the direction now held. Solve there. Reverse if the power
fell. Two behaviours follow from that rule, and both are measured. It walks to
the maximum from either side. It also never stops. At the top it crosses the
peak back and forth, one step wide, for ever.

### 2.6 The converter as a resistance knob

An ideal buck in continuous conduction is lossless, so V_in·I_in = V_out·I_out.
The output is D·V_in into R, so I_out = D·V_in/R and I_in = D·I_out. Therefore:

    R_in = V_in / I_in = R / D²

That is why a converter can track. The duty is a resistance knob the source
sees, and the tracker turns it. The array's operating point is the one current
where its falling curve meets the converter's rising demand. Bisection on the
array's current finds it. The converter is then run from that voltage through
`@ee-labs/switched`. One check closes the loop. The switched engine's own
average input current agrees with R/D² to 2 × 10⁻⁷ A on a 4.8 A current, which
is the steady state's own residual rather than a modelling gap.

### 2.7 The battery

Elements F's RC ladder, with one addition that makes the whole thing exact.
Over the band where the open-circuit voltage rises linearly with the state of
charge, OCV(z) = V_0 + k·z and z = q/Q. The charge store is therefore a
capacitor of Q/k farads.

That makes the cell a linear circuit. It is a source of V_0, a capacitor of
Q/k, two parallel RC pairs and a series resistance. `transient` solves it
exactly and `energies` gives the heat exactly. The state of charge is the
integral of the current, because it is a capacitor's charge.

| Symbol | Default | What it is |
| --- | --- | --- |
| `Q` | 7200 C, which is 2.00 Ah | capacity |
| `V_0`, `k` | 3.48 V, 0.72 V | labelled data, a straight-line fit valid for z from 0.1 to 0.9 |
| `C_q` | 10.000 kF | the charge store, Q/k |
| `R_0` | 25 mΩ | the resistance that responds instantly |
| `R_1`, `C_1` | 15 mΩ, 2.000 kF | τ₁ = 30.00 s |
| `R_2`, `C_2` | 10 mΩ, 20.00 kF | τ₂ = 200.0 s |

The fit is the one approximation in the group, and it carries its band. Outside
z from 0.1 to 0.9 a real cell's curve turns over at both ends, and this fit is
wrong there. Every experiment states the band it stays inside. The panel warns
on the crossing rather than refusing, because the circuit is still solvable and
only the fit is wrong.

### 2.8 The day

Three rows of twenty-four numbers: irradiance, cell temperature, household
load. They are data. The array's power at each hour is an exact solve at that
hour's conditions. The bank's loss is i²R at the current the exchange demands.
The hourly step is explicit and labelled. Within an hour every quantity is
held, so an energy is a power times 3600 seconds. The ledger then closes to
floating point, at 3.7 × 10⁻⁹ J on 71 MJ, and a test asserts it.

---

## 3. The app

### 3.1 Layout

The suite's shape, which is Power Lab's. The sidebar carries `LabNav`, the
report link, folding experiment groups, the knobs as `NumField`s with chips,
the labelled toggles, and the math panel. While the lab is dark it passes
`currentLabel="Energy"`. The main area is a topbar of live meters over two
stacked panes with a view selector.

Every topbar meter comes from an exact solve. They are V_oc, I_sc, the
operating point, and P against P_mpp. A fifth is the experiment's own headline.
That is the fill factor for the cell group, the tracked share for the tracking
group, the state of charge for the battery, and the served share for the day.

### 3.2 Views

- **I–V.** The curve, with the load line or the operating point on it. The
  maximum power point is marked. The V_oc·I_sc rectangle is drawn behind the
  knee, so the fill factor is a picture before it is a number. Elements'
  `IVCanvas` is the model.
- **P–V.** The same sweep against power, with the maximum marked. Where there
  is a tracker, its walk is drawn on the curve.
- **String.** A column of cells, each showing its own junction voltage. It is
  the only view that makes shading legible. A cell driven backwards is drawn
  differently, and its dissipation is printed beside it.
- **Scope.** For the battery, the terminal voltage and current against time.
  The two time constants are marked. The CC/CV changeover is named at its
  instant.
- **Ledger.** For the battery and the day. Where the energy went, summing to
  what came in.
- **Day.** Twenty-four hourly bars for array, load and store. The state of
  charge runs over them as a line. Curtailed and unserved hours are shaded.
- **Walk.** The tracker's own numbers, which the P–V picture cannot measure:
  where the walk started, which step turned round, what it settles between,
  and the share of the maximum that leaves. For the converter experiment the
  same pane carries the duty, the resistance it makes, and both input
  currents with the difference between them printed.
- **Hours.** The day as a table, hour by hour. The three data rows are marked
  as data in the column heads, and the solves sit beside them. The hour the
  readout is on is marked, and so is every hour the bus curtailed or could
  not serve.
- **Math.** Every formula a note leans on, evaluated beside what the solve
  measures.

### 3.3 Numbers

Defaults chosen so the lesson is visible on screen:

- **Cell.** As §2.1. One cell, because the first group is about one junction.
- **String.** Twelve cells, giving V_oc = 7.59533 V and P_mpp = 31.702 W.
  Twelve is small enough to draw as a column. It is long enough that one shaded
  cell is a catastrophe.
- **Shading.** Cell 1 of 12 at 30 % of full light. R_sh is 5 Ω on every cell,
  for the reason §2.4 gives.
- **Tracking.** The twelve-cell string into a buck with R = 0.5 Ω, L = 100 µH,
  C = 100 µF and f_s = 100 kHz. Those are Power Lab's own B-group values. The
  duty at the maximum power point is then 0.60004.
- **Battery.** As §2.7. The pulses start at z = 0.5 and the charge at z = 0.2.
- **Day.** Thirty modules of 36 cells. The bank is 14 cells in series by 100 in
  parallel, so 200 Ah at 53.76 V, which is 10.752 kWh. It starts at z = 0.5.

---

## 4. Curriculum: 26 experiments in 5 groups

Each experiment below gives three things. They are the claim its note makes,
what the reader turns, and what is measured against what formula. Every quoted
number was printed by `scripts/numbers.mjs`. Each becomes a pinned `reads` pair
in `experiments.test.js`, computed from the knobs and never typed as a
constant.

### Group A: The cell (8)

- **A1 · A diode in the light.** The cell is I1's circuit with the source
  moved. A current source of 5.000 A sits across an exponential diode. Short
  the terminals and all of it comes out, 5.0000 A. Open them and none does, at
  0.632944 V. Everything between is the diode taking its share. Measured: I_sc
  and V_oc against the closed form V_oc = n·V_T·ln(I_ph/I_s + 1). That form
  gives the same 0.632944 V. It differs from the solve by 0.325 µV, because
  the shunt is not infinite.
- **A2 · The I–V curve, one solve at a time.** Sweep the load and the operating
  point walks the curve. There are 121 points. Each is an exact Newton solve,
  and each takes three to twelve iterations. The knee is the diode's
  exponential turning on. Measured: the curve against its load lines, and the
  point at R = 0.11572 Ω landing on the maximum.
- **A3 · The P–V curve and the maximum power point.** Power is the product of
  the two, so it is zero at both ends. Between them it has one maximum. That
  maximum is at 0.552926 V and 4.77793 A, giving 2.64184 W. Measured: the
  maximum by golden-section search on the exact solve, and both ends at zero.
- **A4 · Fill factor.** The product V_oc·I_sc is 3.16472 W. It is a rectangle
  the cell cannot reach. At V_oc it passes no current, and at I_sc it holds no
  voltage. The fill factor is 2.64184 divided by 3.16472, which is 0.83478.
  Measured: all three, and the identity P_mpp = FF·V_oc·I_sc to floating point.
- **A5 · Series resistance.** Toggle R_s to 5 mΩ. V_oc does not move, because
  at open circuit the series resistance carries nothing. I_sc barely moves,
  from 5.0000 A to 4.9999975 A. The 25.00 mV it drops there is nothing against
  the 0.63 V the junction needs. The knee is where the current and the voltage
  are both large, and that is where it lands. V_mpp falls to 0.531234 V, P_mpp
  to 2.5281 W and FF to 0.79885. At 20 mΩ, FF is 0.69314.
- **A6 · Shunt resistance.** Toggle R_sh to 5 Ω. The loss is now at the other
  end. V_oc falls to 0.632286 V and FF to 0.81635. The curve's flat top
  acquires a slope of −0.200000 S, which is −1/R_sh to six figures. Near the
  short circuit the junction carries nothing, so the shunt is all that is
  across it. At 1 Ω, V_oc is 0.629487 V against the closed form's 0.632944 V.
  Measured: the slope, and V_oc against the solve.
- **A7 · Irradiance.** Halve the light. I_sc halves exactly, from 5.0000 A to
  2.5000 A, because the photocurrent is proportional to the irradiance. V_oc
  falls by only 17.809 mV, which is n·V_T·ln 2, because V_oc is a logarithm of
  the photocurrent. At a tenth of the light V_oc is down 59.162 mV. That is one
  decade, and the diode's 59.159 mV per decade is the number Elements I1
  quotes. Measured: both, against both formulas.
- **A8 · Temperature.** Raise the cell to 65 °C. V_T rises from 25.693 mV to
  29.140 mV, and V_oc falls anyway, from 0.632944 V to 0.556595 V. The reason
  is I_s, which rose from 1.0000 × 10⁻¹⁰ A to 2.5322 × 10⁻⁸ A by §2.3's law.
  Over that span dV_oc/dT is −1.9087 mV/K, and P_mpp falls 0.389 % per kelvin.
  A panel therefore makes less on a hot afternoon than on a cold morning at the
  same light. Measured: I_s against the law, its doubling interval of 4.7231 K,
  both slopes, and I_sc unmoved.

### Group B: Modules, strings and shade (5)

- **B1 · Twelve in series.** One current, twelve junctions. V_oc is 7.59533 V,
  which is 12 × 0.632944 V, and I_sc is unchanged at 5.0000 A. P_mpp is
  31.702 W, twelve times one cell's, and the fill factor is the same 0.83478.
  Measured: each against the single cell's, and the string view showing all
  twelve junction voltages equal.
- **B2 · Three strings in parallel.** One voltage, three currents. I_sc is
  15.000 A, V_oc is 7.59533 V and P_mpp is 95.106 W. The power ratio is 3.0000
  to six figures. It is exact only because the three strings are identical.
  Measured: the ratio, and R_mpp of 0.46290 Ω against 1.3887 Ω for one string.
- **B3 · One shaded cell.** Put cell 1 at 30 % of full light. Its photocurrent
  is 1.500 A, so the string can no longer carry 5 A. I_sc falls to 2.8417 A,
  and P_mpp falls from 30.970 W to 10.306 W. That is a loss of 66.72 % for one
  cell of twelve. The other eleven are untouched and still make their power.
  They cannot deliver it. Measured: the new maximum, the string current, and
  each junction's own voltage.
- **B4 · The hot spot.** Drive the shaded string at 4.77793 A, which is the
  string's own maximum power current at the nominal shunt. The shaded cell
  cannot make it, so it is pushed backwards to −16.390 V. Its reverse current
  of 3.27793 A goes through the 5 Ω shunt and nothing else. It turns 78.31 W
  into heat, which is more than twice what the whole clear string makes. The
  terminal has gone to −10.494 V, so the string is now a load. Measured: the
  reverse voltage, the dissipation and the terminal. Each is printed beside
  §2.4's guard.
- **B5 · The bypass diode.** Put a diode across the shaded cell, anode at its
  bottom. Above the shaded cell's photocurrent it conducts, and the string's
  current goes round. P_mpp rises from 10.3057 W to 26.5964 W, which is
  158.1 % more, and the shaded cell holds −0.3839 V rather than volts. The P–V
  curve now has two maxima, at 5.70504 V with 26.5964 W and at 7.19759 V with
  10.3057 W. The lower one is the string's own maximum with the diode out, to
  six figures. A tracker that only walks uphill can settle on it.

### Group C: Tracking the maximum power point (5)

- **C1 · A resistor cannot follow the sun.** Pick R = 1.3887 Ω, which is
  exactly R_mpp for the string at full light. The load then takes 100 % of
  31.702 W. Halve the light and the same resistor takes 8.6791 W of the
  15.341 W available, which is 56.58 %. At a fifth of the light it takes
  23.67 %. The maximum power point moves and a fixed load does not. Measured:
  each share, and the load line drawn against three curves at once.
- **C2 · Perturb and observe.** The stepper of §2.5, on the exact P–V curve.
  From 2.000 V with a 200 mV step it climbs, reverses after 24 steps, and then
  oscillates. Measured: the trajectory, the reversal step, and the direction
  rule at every step.
- **C3 · The dither is the price.** At the top it never stops. With a 200 mV
  step it settles between 6.4 V and 6.8 V. Its mean power is 31.5358 W of the
  31.7021 W available, which is 99.476 %. The 0.524 % it gives up is not a
  defect to remove. It is what the algorithm pays to know which way is up.
  Measured: the settled mean, the swing, and the period of the oscillation.
- **C4 · Step size, both ways.** A 400 mV step reaches the peak in 13 steps and
  settles 5.216 % under it. A 200 mV step takes 24 steps and gives up 0.524 %.
  A 50 mV step takes 94 steps and gives up 0.041 %. Every tracker in the world
  lives on this trade. Measured: all six numbers, from the same stepper.
- **C5 · The buck is the knob.** Load the string with Power Lab's buck instead
  of a resistor. The converter's input resistance is R/D², so the duty is the
  resistance knob. At D = 0.400 the array sits at 7.3976 V and gives 17.512 W.
  At D = 0.60004 it sits at 6.6351 V and gives 31.702 W, which is the maximum.
  At D = 0.800 it is dragged down to 3.9062 V and 19.531 W. Measured: the
  operating point at each duty, and the tracking duty against the closed form.

### Group D: The battery (5)

- **D1 · The equivalent circuit, and the instant.** Draw 1.000 A from a cell
  resting at z = 0.5 and 3.8400 V. The terminal drops to 3.8150 V in no time at
  all. That step of 25.00 mV is i·R₀. It then keeps falling on the two time
  constants, reaching 3.80113 V at 30.00 s and 3.77370 V at 200.0 s. Those two
  instants are τ₁ and τ₂. Measured: the step against i·R₀, the two values
  against the ladder's own exponentials, and the settled resistance against
  50.00 mΩ.
- **D2 · The state of charge is the integral of the current.** That is not a
  metaphor here. The store is a capacitor of 10.000 kF, and z is its charge
  over Q. After 1200 s at 1.000 A the cell has given up 1200 C of 7200 C, and z
  reads 0.33333. Measured: z against the integral of the current over Q at five
  instants, and the terminal against its own open-circuit voltage less the
  drop.
- **D3 · What the resistance costs.** Over that 1200 s the resistances turn
  56.335 J into heat while 4478.45 J leaves the terminal, so 1.242 % is lost.
  The settled figure i²·(R₀ + R₁ + R₂)·t is 60.00 J, which is more than the
  ledger. The RC pairs take their time constants to reach full resistance.
  Measured: both, and their ratio of 0.93892.
- **D4 · The round trip.** Take 2.000 A out for 15 min, then put 2.000 A back
  in, ending at the z = 0.5 it started from. Out is 6579.71 J and in is
  6910.67 J, so the efficiency is 95.211 %. The 330.95 J difference is the two
  heats of 165.48 J and 160.75 J, which sum to 326.23 J. Measuring it any other
  way overstates the loss. Two runs from the same state are not a cycle,
  because the second starts lower on the open-circuit curve.
- **D5 · Constant current, then constant voltage.** Charge at 2.000 A from
  z = 0.2. The terminal reaches the 4.100 V limit at 1880.01 s, which is
  31.333 min, with z at 0.72222. Bisection on the exact solve finds that
  instant, rather than a search between samples. The source then becomes a
  voltage source at 4.100 V and the current decays. It is 2.0000 A at the
  changeover, 1.0360 A after 300 s, and 70.228 mA after 1800 s, with z at
  0.85562.

### Group E: A day on one bus (3)

- **E1 · The profiles are data.** The three rows of twenty-four numbers appear
  on screen, named as data, with the sentence that says what is physics here
  and what is not. The array's power at each hour is a solve. At hour 12,
  940 W/m² and 43.85 °C give 2476.7 W from 30 modules of 36 cells. Peak load is
  2100 W at hour 18, three hours after the peak of the light. Measured: the
  array's power at each hour, and the two peaks with their hours.
- **E2 · The balance closes.** Over the day the array makes 19.794 kWh and the
  load asks for 19.120 kWh, all of which is served. Another 3.4329 kWh is
  curtailed, because the bank was full from hour 13 to hour 16. The bank turns
  0.056002 kWh into heat. The ledger says array in equals load served plus
  stored plus curtailed, and it closes to 3.7 × 10⁻⁹ J on 71 MJ. Measured: the
  identity, and each term in it.
- **E3 · The store is the constraint.** Halve the bank to 100 Ah. The same day
  curtails 6.8689 kWh and leaves 4.3129 kWh unserved, because the surplus has
  nowhere to go at noon and nothing is left at dusk. Double it to 400 Ah and
  both are zero, and the bank ends at z = 0.5314 against the 0.5 it began at.
  That day nearly repeats. At the default 200 Ah it ends at 0.24344, so that
  one does not. Measured: all six figures, from the same balance.

---

## 5. Hand-overs

- **To Power Lab.** C5's operating point is a `Vin` for `converter('buck', …)`.
  The link carries the array's V_mpp and the duty. Power Lab's Group H, when it
  exists, closes a loop around it.
- **From Elements.** A1's netlist is I1's with the source moved. The note says
  so, with a live cross-reference to I1 and I2.
- **Not offered.** Nothing here goes to `@ee-labs/systems`. The cell is
  exponential and a string is twelve of them, so it is inadmissible under Rule
  1 of `CORE_SCOPE.md`. The small-signal resistance at an operating point would
  be admissible. This lab does not compute one, because no experiment here
  needs it. That is a decision rather than an omission.

---

## 6. Testing discipline

`experiments.test.js` is Circuit Elements Lab's file with this lab's quantity
paths added. It is copied rather than rewritten. It walks every experiment at
its defaults and checks every `reads` pair. It then checks that every
number-with-unit in every sentence is one of those readings or a knob value.
The invariants beyond that:

1. **The two intercepts.** I_sc from the voltage-driven solve equals the
   current-driven curve's limit. V_oc from the current-driven solve at zero
   equals the closed form, to the shunt's stated cost.
2. **Every solve converges.** Fuzzed across the parameter space, no point of
   any curve refuses, and none takes more than twelve iterations.
3. **The maximum is a maximum.** P_mpp is at least the power at 200 other
   points of the same curve, and both ends are zero.
4. **The fill factor identity.** P_mpp = FF·V_oc·I_sc, to floating point.
5. **Series scales voltage, parallel scales current.** N identical cells in
   series give N·V_oc and the same I_sc, exactly.
6. **The converter agrees with itself.** The R/D² operating point's current
   equals the switched steady state's average input current.
7. **The tracker's rule.** Every step of every trajectory obeys the direction
   rule. The settled mean is under P_mpp and above the power at the start.
8. **Charge is conserved.** The state of charge equals the integral of the
   current over Q on every battery run, at every sample.
9. **Energy is conserved.** Terminal energy out plus heat equals the store's
   energy change, on every battery run.
10. **The day's ledger closes**, to floating point, at every bank size.

---

## 7. What went to NEEDS.md

Nothing here was blocked. Two things would have been easier with a change this
lab does not own. Both are written as contracts in `apps/energy-lab/NEEDS.md`,
and neither is required for the lab to ship.

- `newtonDC` takes no starting point. A continuation over a swept parameter is
  therefore impossible, and every point starts from the same guess. A `v0`
  option would fix that. So would the `sourceStepping` the Electronics brief
  already contracts for. Either would make the flat part of a long string
  reachable by the voltage drive too.
- The deploy workflow needs one `cp -r apps/energy-lab/dist _site/energy-lab`
  line. `release.test.js` records the requirement rather than asserting the
  line. The suite is therefore green before the line lands, and pins it after.

---

## 8. Integration, and the dark launch

`RELEASE_STATUS` is one word, and Reed alone changes it. While it says `dark`
the lab is built and served at `/energy-lab/`, and nothing a visitor sees
points at it. That covers `site/index.html`, `README.md` and `LabNav.jsx`. The
page carries no usage counter. `src/release.test.js` is Circuit Elements Lab's
file with this lab's name, and it inverts when the word changes.

The row this lab adds to `CURRICULUM.md` §1, for whoever owns that file:

| Step | Lab | Course it mirrors | Experiments | Status |
| --- | --- | --- | --- | --- |
| 7 | Energy Lab | Photovoltaics, storage, microgrids | 26 | built, dark |

| Group | Teaches | Count |
| --- | --- | --- |
| A · The cell | the light as a current, the curve, the maximum, fill factor, the two parasitics, irradiance, temperature | 8 |
| B · Modules, strings and shade | series, parallel, one shaded cell, the hot spot, the bypass diode | 5 |
| C · Tracking | a fixed load misses, perturb and observe, the dither, step size, the buck as the knob | 5 |
| D · The battery | the ladder, charge as an integral, what the resistance costs, the round trip, CC/CV | 5 |
| E · A day on one bus | the profiles as data, the balance, the store as the constraint | 3 |

One seam is added, and it runs one way today. Energy Lab hands an operating
point to Power Lab's buck. Power Lab hands nothing back until its Group H
closes a loop. The plan says so rather than implying a link that does not
exist.

---

## 9. Phasing, and where each sitting stopped

The lab is built group by group, and a sitting stops at a group boundary
rather than part way through one. A half-built group leaves lessons quoting
numbers no pane shows, which is the one failure the progression test cannot
catch on its own.

| Phase | What lands | State |
| --- | --- | --- |
| 1 | The physics, the analysis and `numbers.mjs` | built, fuzzed green |
| 2 | The plan and the brief | built |
| 3 | The app shell, both panes, the four canvases, the release gate | built, dark |
| 4 | Groups A and B, with the reverse branch's guard on screen | built, pinned |
| 5 | Groups C and D, with the walk pane and the two input currents | built, pinned |
| 6 | Group E, with the hourly table and the profiles named as data | built, pinned |
| 7 | The wind group | not started, waiting on the Machines Lab |

Phase 7 is the only one with a dependency outside this lab, and `BACKLOG.md`
carries it under "### Energy Lab". Everything phases 1 to 6 needed was already
in `packages/network` and `packages/switched`, and neither package was
touched.

---

## 10. Non-goals, stated so they are decisions

- **Wind.** A turbine's electrical half is a machine. `BACKLOG.md` carries it
  under "### Energy Lab", where it waits on the Machines Lab.
- **Spectral response, angle of incidence, soiling.** Each is a correction to
  the photocurrent, and the photocurrent here is a knob. A lab that modelled
  them would be modelling weather rather than circuits.
- **Battery chemistry.** The equivalent circuit is the electrical model, and it
  is the one an engineer designs against. Diffusion, ageing and thermal runaway
  are not circuits.
- **Grid interaction.** Inverters, anti-islanding and power quality belong to
  Power Lab's Groups F and I. The bus here is DC.
- **Optimisation.** The day's balance is a ledger rather than a dispatch
  problem. A lab that solved for the best bank size would be teaching
  operations research.

---

## 11. Risks, named

- **The shading model's reverse branch.** §2.4's guard is the mitigation, and
  it must appear wherever a reverse voltage is printed. Quoted without it, the
  lab would claim a breakdown model it does not have.
- **Cost.** Every curve point is a Newton solve, and every P–V point in a
  tracker run is a bisection over them. The app memoises by terminal voltage.
  The tracker rewards that, because it revisits the same voltages for ever. The
  tests use short runs and coarse scans. If a view ever feels slow, the pane
  says what setting caused it, as Power Lab's affordability gate does.
- **The fit's band.** D1 to D5 stay inside z from 0.1 to 0.9 at their defaults,
  and the knobs can leave it. The panel warns on the crossing rather than
  refusing.
