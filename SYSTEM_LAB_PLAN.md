# System Lab: the plan

Tier 6 of `ANALOG_ROADMAP.md`, and the last lab of track A in `EE_LABS_MAP.md`. The
whole chain from antenna or sensor to bits, and the budgets that decide whether it
works. Splash glyph `⇥`, directory `apps/system-lab`, engine as `budget.js` in
`packages/rf` over Signal Lab's chain model.

The path, in order. The chain as a list of blocks with four numbers each. The noise
budget, and why the first stage decides it. The linearity budget, and why the last
stage decides that one. Dynamic range as the gap between the two. The link budget,
from transmitted power to received bits. Power and area as the budgets nobody teaches
and everybody has.

This is a draft (2026-09-05) for Reed to settle. This lab is what a lead engineer
does that a block designer does not. `ANALOG_ROADMAP.md` §7 states its whole engine
cost in one line, that its objects are budgets over exact block models, all admitted.
§2 makes that line concrete. §2.2 states the guard each budget's assumptions carry,
because an admitted object with an unstated assumption is still a trap.

The two rules that govern the other labs govern this one with no exemption. **Every
explanatory sentence is a claim about physics, and a test must measure it.** And
`CORE_SCOPE.md` decides what the engine may state exactly, what it may approximate
behind a guard, and what it declines with a reason. Here the interesting cases are
not refusals of objects. They are guards on formulas that are exact arithmetic over
assumptions a reader can break.

---

## 0. Open decisions

### Decision 1: the name (recommended: System Lab)

`ANALOG_ROADMAP.md` §7 and `EE_LABS_MAP.md` §1 both call tier 6 the System Lab, and
its row reads "the signal chain and its budgets". LabNav short form **"System"**. The
splash card names the path in one line: "the chain, the noise budget, the linearity
budget, dynamic range, the link budget".

Alternatives considered. *Receiver Lab* names one chain and excludes the sensor front
end and the transmitter. *Budget Lab* names the method rather than the subject.
*Architecture Lab* promises a design task the suite has not yet prototyped, which is
the Applied Analog Lab's specification pane.

### Decision 2: whether this lab is a lab or a pane in the RF Lab

Twenty-five experiments and a distinct interaction model argue for a lab. The
interaction model is a **table with a chain above it**, where every row is a block and
every column is a budget, and turning one knob moves a column. That is not the RF
Lab's Smith chart and not Signal Lab's spectrum.

Recommended: **a lab of its own, sharing the RF Lab's `budget.js` and Signal Lab's
chain**. The alternative is a budget pane inside the RF Lab. That would put a systems
course inside a circuits course. It would also make the RF Lab's sidebar the longest
in the suite after the Electronics Lab's.

### Decision 3: where the budget arithmetic lives

The RF Lab's plan recommends `packages/rf/src/budget.js`, with this lab named as its
second user. Recommended: **accept that**, and write this lab's needs into
`apps/system-lab/NEEDS.md` for the RF overseer to land. The formulas are the same
formulas, and two copies would drift.

The consequence is a build-order dependency. This lab cannot ship its Groups B and C
before the RF Lab's Phase 5. §9 phases around it, and Group A ships first because it
needs only Signal Lab's chain.

### Decision 4: whether a block is a circuit or a record

A block in this lab has four numbers: gain, noise figure, input IP3 and DC power. It
could be a record typed in, or it could be a circuit the suite solves. Recommended:
**both, with the record as the default and the circuit as a link**.

The default is the record, because a budget is a design exercise before any circuit
exists. Where a built lab has the circuit, the block carries a deep link to it. The
LNA links to the RF Lab's Group E and F. The mixer links to its Group G. The IF
amplifier links to the Electronics Lab's Group H. A block whose numbers came from a
solved circuit is marked as such, and a test pins the two against each other.

### Decision 5: how far the link budget goes

A link budget can stop at the received power, or it can go on to `E_b/N_0` and a bit
error rate. The bit error rate is the Communications Lab's, and it is not built.
Recommended: **stop at `E_b/N_0` and the margin against a stated requirement**. The
required `E_b/N_0` is a number in a term panel, cited to the Communications Lab as
the place it is derived.

That keeps every claim in this lab measurable here. The moment the Communications Lab
ships, Group E gains one link and no new content.

---

## 1. The progression map

This lab sits at the top of two tracks. It leans on more built work than any other
proposed lab, and on one lab that is not started. This section lists every idea the
lab uses, the experiment or group that teaches it, and whether that experiment exists
today.

| Idea the lab leans on | Needed by | Taught at | Status |
| --- | --- | --- | --- |
| Sources into a cascade of blocks, time and spectrum views | A, and the whole app | Signal Lab, and `packages/dsp` `chain.js` | built |
| Decibels, power ratios, the spectrum | A1, A2 | Signal Lab, Signals and Fourier group | built |
| Two tones through one nonlinearity, the products named | C1, C2 | Signal Lab, Nonlinearity group | built |
| Quantisation, bits, the 6.02N + 1.76 law | D4, F2 | Signal Lab, Nonlinearity group, "4 bits" | built |
| Filters, their order and their shape | A3, D3 | Signal Lab Filters group, Circuit Lab | built |
| Gain, `R_in`, `R_out`, loading between stages | A2 | Electronics Lab Group G | being built, `lab/electronics-lab` |
| Thermal and shot noise as densities, `kT/C` | B1, B2 | Electronics Lab Group O | being built, `lab/electronics-lab` |
| Harmonic distortion, THD, the clipping ceiling | C1, C5 | Electronics Lab H7, M6 | being built, `lab/electronics-lab` |
| Efficiency as a ceiling on a linear stage | F1 | Electronics Lab M6, Power Lab Group A | being built and built |
| Noise as a random process, the confidence interval | B5 cites it | Random Signals Lab, estimation group | being built, `lab/random-lab` |
| Antenna gain, the Friis equation, free-space loss | E1, E2 | Fields Lab, antenna group | being built, `lab/fields-lab` |
| Noise figure, Friis's cascade, IP3 from two tones | B, C | RF Lab Groups F and G | planned here, `RF_LAB_PLAN.md` |
| The mixer, the image, phase noise | D5, and the chain's blocks | RF Lab Groups G and H | planned here, `RF_LAB_PLAN.md` |
| The converter's dynamic errors and its jitter | D4 | Mixed-Signal Lab, converters group | mapped only, not started |
| Bit error rate against `E_b/N_0`, the Q function | E4 cites it | Communications Lab, channel group | proposed only, not started |

Three things the map shows that this plan does not fix, so that they are decisions
and not omissions. **The bit error rate** is the Communications Lab's, and Decision 5
stops this lab at `E_b/N_0`. **The converter** is the Mixed-Signal Lab's, and D4 uses
the ideal `6.02N + 1.76` law with jitter as a stated extra term. **Antenna gain** is
the Fields Lab's, and Group E takes it as a number in a term panel until that lab
ships.

The order of the groups follows the map. Group A needs only Signal Lab, which is
built and released. Groups B to D need the RF Lab's `budget.js`. Group E needs a
number from the Fields Lab and nothing more. Group F needs the Electronics Lab's
efficiency ceiling.

---

## 2. The engine: budgets over exact block models

### 2.1 What exists, and what is missing

`packages/dsp`'s `chain.js` already holds the interaction model. `createChain` binds a
block registry and returns `applyChain`, `renderChain` and `runChain`, and `runChain`
returns the buffer after every stage, which is what a flow strip draws. Signal Lab has
proved it over 35 experiments. What is missing is the budget arithmetic and the block
record it runs on, and nothing else is built.

| Need | Today | This plan |
| --- | --- | --- |
| A block with gain, NF, IIP3 and power | a DSP block with parameters | the block record (§2.3) |
| Cascaded noise figure | nothing | `cascadeNF` in `packages/rf/src/budget.js` |
| Cascaded input IP3 | nothing | `cascadeIIP3`, same module |
| Cumulative gain and level at every node | `runChain` gives waveforms | `levels`, the same walk in decibels |
| Noise floor, sensitivity, dynamic range | nothing | `dynamicRange`, same module |
| Free-space loss and the link budget | nothing | `link.js` in `packages/rf` |
| The chain's own two-tone check | Signal Lab shows the products | `linearity.js` from the RF Lab, reused |
| A table view whose columns are budgets | nothing | the app's one new canvas (§4.2) |

### 2.2 The scope stance, budget by budget

Every object in this lab is arithmetic over numbers the other labs produce exactly.
`CORE_SCOPE.md` therefore admits all of them. The interesting question is different,
and this table answers it. Each budget is exact **given an assumption**, and the guard
is what the app does when the reader breaks that assumption.

| Budget | Stance | The assumption | The guard |
| --- | --- | --- | --- |
| Cumulative gain and level | admitted, exact | every interface is matched, so gain is available gain | mismatch loss is computed from the two `Γ` values and shown as a separate column when either is non-zero |
| Cascaded noise figure (Friis) | admitted, exact | available gain between matched stages, and one noise temperature of 290 K | the pane warns when any interface `|Γ| > 0.33`, which is VSWR 2.000, and prints the mismatch term |
| Noise figure of a passive block | admitted, exact | the block is at the reference temperature | the physical temperature is a knob, and NF is recomputed from it rather than fixed at the loss |
| Cascaded input IP3 | guarded | the third-order products from each stage add in voltage with aligned phase | the pane states the worst case, and offers the power-addition and random-phase cases as two other columns with their own totals |
| IP3 of one block from two tones | guarded | third-order extrapolation from a drive well below compression | the RF Lab's guard, warn within 10 dB of P1dB and decline within 3 dB |
| Noise floor and sensitivity | admitted, exact | the noise bandwidth equals the stated bandwidth | the noise bandwidth of a first-order stage is `(π/2) f_c`, and the pane uses the shape's own factor rather than `f_c` |
| Spurious-free dynamic range | admitted, exact for the model | one third-order product limits, and it rises at three times the fundamental's slope | the drive guard above, and the pane refuses to extend the two lines past the compression point |
| The 1 dB compression point | guarded | the cubic model relates it to IIP3 at 9.636 dB below | the offset is a property of the model, is printed as such, and is measured rather than assumed where a circuit exists |
| Free-space loss | admitted, exact | free space, far field, polarisation aligned | the far-field distance `2D²/λ` is computed and the pane warns below it |
| The link budget | admitted, exact | every loss is stated and none is forgotten | the pane lists the losses it does not model (rain, multipath, pointing) as named line items set to zero, so a zero is a decision |
| `E_b/N_0` from `C/N_0` | admitted, exact | the bit rate is the information rate, not the symbol rate | both are knobs, and the ratio between them is on screen |
| The ADC's `6.02N + 1.76` | admitted, exact for the ideal converter | a full-scale sine, uniform quantisation, and no jitter | the jitter term `−20 log(2π f_in t_j)` is a second column, and the pane names which term dominates |
| Power and efficiency totals | admitted, exact | every block's DC power is stated | a block with no stated power is shown as unknown rather than as zero |
| The whole chain simulated in time | admitted, exact | the block models are the ones the chain holds | Signal Lab's own guards, which `chain.js` already carries |

Two entries deserve emphasis, because they are the ones a reader will take on trust
elsewhere. **Cascaded IP3** is the worst case and not the answer, and this lab shows
all three addition rules side by side. **The link budget's zeros** are decisions, and
the pane lists what it does not model so that nothing leaves by being forgotten.

### 2.3 The block record

A block is `{ id, name, gainDb, nfDb, iip3Dbm, powerMw, z_in, z_out, kind }`. Passive
blocks carry `gainDb` negative and `nfDb` equal to its magnitude, computed rather than
typed. `iip3Dbm` may be `Infinity`, which is what a passive block has and what the
cascade arithmetic handles without a special case.

`kind` names the block's physical type, and the app uses it to offer a deep link. A
block of kind `lna` links to the RF Lab's Group F, and `mixer` to its Group G. A
`filter` links to Circuit Lab, an `amp` to the Electronics Lab's Group H, and an
`adc` to Signal Lab's "4 bits" preset. A block whose numbers came from a solved
circuit carries that circuit's identifier and its operating point.

The record is deliberately four numbers rather than a circuit. That is what a systems
engineer writes down first, and the lab's claim is that four numbers per block predict
the chain's behaviour. Every experiment in Groups B to D checks that claim against a
simulation or a closed form.

### 2.4 The cascade walk

`cascadeNF(blocks)` walks the list once, accumulating `F` and `G`. At every step it
records the cumulative gain, the cumulative noise figure and the share of the excess
noise that the block just added. The share is `(F_k − 1)/G_{k−1}` divided by the total
excess, and it is what makes the budget a design tool rather than a total.

`cascadeIIP3(blocks)` walks the same list accumulating `1/IIP3`. It records each
block's share the same way. The two walks are one function with two accumulators, and
the app's table is that function's output transposed.

`levels(blocks, pin)` walks the list a third time in decibels. It gives the signal
level, the noise level and the signal-to-noise ratio at every node. This column makes
an overload visible. A level that crosses a block's own compression point is marked,
and the block that clips first is named.

### 2.5 Noise floor, sensitivity and dynamic range

The floor is `−174 dBm/Hz + NF + 10 log B`, and the constant is computed rather than
memorised. At 290 K, `k T_0` is `−173.975 dBm/Hz`, which the app prints to four
figures and rounds to `−174` only in prose.

Sensitivity is the floor plus the required signal-to-noise ratio. Spurious-free
dynamic range is `(2/3)(IIP3 − floor)`, the level at which the third-order product
rises to the floor, and it follows from the two slopes rather than being asserted. The
linear dynamic range is `P1dB − floor`, a different and usually larger number, and the
lab shows both because designers quote both.

`dynamicRange(blocks, B, snrReq)` returns all four numbers with the bandwidth stated
beside each. A number without its bandwidth is meaningless here, so the record carries
it and the view prints it.

### 2.6 The link budget

`link.js` computes free-space loss as `20 log(4π d / λ)` and the received power as
`P_t + G_t + G_r − L_fs − L_other`. Each term is a named line item, and the sum is the
only arithmetic. The far-field distance `2D²/λ` is computed from a stated aperture
size, and the pane warns when the link is shorter than it.

The Friis transmission equation is the Fields Lab's, derived there from the antenna's
pattern. This lab uses it, cites it, and does not re-derive it. Until that lab's
antenna group ships, `G_t` and `G_r` are numbers in a term panel with the derivation
named as not yet built.

`C/N_0` is the received power minus `−174 dBm/Hz + NF`. `E_b/N_0` is `C/N_0` minus
`10 log R_b`. The margin is `E_b/N_0` minus the requirement, and the requirement is a
number from the Communications Lab, cited and not derived here.

### 2.7 The chain, simulated

Every budget in Groups B to D is checked against a simulation of the same chain, run
through `packages/dsp`'s `runChain`. A noise budget's answer is checked against the
output noise of a chain driven by the RF Lab's noise sources. A linearity budget's
answer is checked against the two-tone products the FFT reads at the output.

The simulation is not an alternative model. It is the same block models driven with
signals, and the agreement between the two is the lab's central invariant. Where they
disagree, the assumption in §2.2 has been broken, and the experiment that breaks it is
the one that teaches the guard.

### 2.8 Measures

Cumulative gain in dB at every node. Cumulative noise figure in dB, and each block's
share of the excess as a percentage. Cumulative input IP3 in dBm, and each block's
share. Signal level, noise level and signal-to-noise ratio in dBm and dB at every
node. The noise floor for a stated bandwidth. Sensitivity for a stated required
signal-to-noise ratio. Spurious-free and linear dynamic range. Total DC power in mW
and each block's share. Received power, `C/N_0`, `E_b/N_0` and the margin.

### 2.9 Invariants, the fuzzer's checklist

Across random chains of two to eight blocks with random gains, noise figures, input
IP3s and powers:

1. **Order matters, and the total does not depend on how it is computed.** Cascading
   blocks one at a time and cascading the whole list give the same `F` and the same
   `IIP3` to floating point.
2. **Associativity.** Cascading `[A, B, C]` equals cascading `[A, cascade(B, C)]` for
   both budgets, to floating point.
3. **Shares close.** Every block's noise share sums to 100 % to `1e-12`, and so does
   every block's IP3 share and every block's power share.
4. **A passive block's noise figure is its loss.** For every negative gain, the
   computed noise figure equals the magnitude of the gain to floating point, at the
   reference temperature.
5. **Friis agrees with the simulation.** The cascaded noise figure equals the output
   noise density from an explicitly built chain with the RF Lab's noise sources,
   divided by the input density and the gain, to `1e-9` relative.
6. **The IP3 budget agrees with the two tones.** The cascaded input IP3 equals what
   `linearity.js` reads from the FFT at the chain's output, within the aligned-phase
   assumption's stated bound, for chains of cubic blocks with matched phase.
7. **The three addition rules bracket.** The power-addition total lies between the
   random-phase total and the aligned-phase total, for every chain.
8. **Dynamic range closes.** `SFDR = (2/3)(IIP3 − floor)` equals the drive level at
   which the simulated third-order product reaches the simulated noise floor, to
   0.1 dB.
9. **Levels are consistent.** The signal level at node k equals the input level plus
   the cumulative gain, and the noise level equals the floor plus the cumulative gain
   plus the cumulative noise figure, to floating point.
10. **The link budget is a sum.** The received power equals the sum of its line items
    to floating point, and removing a line item changes the total by exactly that
    item.
11. **Free-space loss is reciprocal.** Swapping the transmitter and the receiver gives
    the same received power for the same gains, and doubling the distance costs
    exactly 6.0206 dB.
12. **Cross-lab.** A block whose numbers came from a solved circuit gives the same
    cascade result as the circuit does when the chain is simulated. The chain's
    quantiser block agrees with Signal Lab's "4 bits" preset at the same bit depth.

---

## 3. Models: the block library

Everything Signal Lab's block registry holds stays, and this lab reads it through
`createChain`. These blocks are added, and each is a record with the four numbers plus
whatever its own physics needs.

| Block | Ideal law | Non-ideality toggles (each labelled) |
| --- | --- | --- |
| Amplifier | gain in dB, flat over the band | noise figure, input IP3, 1 dB compression, DC power, input and output `Γ` |
| Passive loss | gain in dB, negative | physical temperature, which sets the noise figure. Input and output `Γ` |
| Filter | a shape from Circuit Lab, with its noise bandwidth computed from it | insertion loss, and the shape factor that sets the noise bandwidth |
| Mixer | conversion gain, and the frequency arithmetic | noise figure, input IP3, LO leakage, image rejection, LO phase noise |
| Detector or sensor | a responsivity in A/W or V/unit | its own noise density, and a stated bandwidth |
| Quantiser | `6.02N + 1.76` over the Nyquist band | jitter as `−20 log(2π f_in t_j)`, and an oversampling ratio giving processing gain |
| Antenna | gain in dBi, and a noise temperature | the aperture size, which sets the far-field distance |
| Channel | free-space loss from distance and frequency | named extra losses, each a line item that defaults to zero and says so |

**Chain description.** A chain is a list of block records with a source at the front,
drawn as a flow strip above the table. `packages/ui`'s existing plot and format
helpers draw it, and the schematic renderer is not used, because a block is not a
circuit here. A block that links to a circuit shows the link's glyph.

---

## 4. The app

### 4.1 Layout

Signal Lab's shape, adapted. Sidebar with LabNav, the report link, the experiment
groups, the chain picker, per-block NumFields with chips, and the math panel. Main
area with topbar meters, the chain's flow strip always visible, and the budget table
below it with a view selector. Phone-width first, with no horizontal scroll at 390 px,
harness-checked.

The topbar shows the four totals first. Cumulative gain, cascaded noise figure,
cascaded input IP3 and total DC power. Then the experiment's own headline number,
which is usually sensitivity, dynamic range or margin. The bandwidth sits beside them,
because three of those four are meaningless without it.

### 4.2 Views

- **Budget table.** New, and the lab's signature view. Rows are blocks and columns are
  budgets, with each cell showing the cumulative value and, on a toggle, that block's
  share. It goes into the app rather than `packages/ui` in v1, because no second lab
  has claimed it. The Applied Analog Lab's specification pane is the nearest relative,
  and if that lab claims this table, the director promotes it under `PROGRAM.md` §5.
- **The chain's flow strip.** Adapted from Signal Lab's, which already draws a source
  into a cascade. The addition is a level axis under the strip, so the signal and the
  noise are drawn as two lines that converge or diverge along the chain.
- **The cascade plot.** Cumulative gain, noise figure and input IP3 against block
  index, on one axis each. The block that dominates each budget is marked, and the
  marks move when a knob turns.
- **The two-slope plot.** Output power against input power, the fundamental at slope 1
  and the third-order product at slope 3, with the noise floor as a horizontal line.
  Spurious-free dynamic range is the gap that the three lines enclose, drawn rather
  than stated. This is the RF Lab's IP3 plot with the floor added, and the two labs
  share the component.
- **Spectrum.** The chain's output from `packages/dsp`'s FFT, with the wanted signal,
  the products and the noise floor marked. This is where a budget's prediction and the
  simulation are compared on one picture.
- **Link budget waterfall.** Each line item as a bar from the running total, from
  transmitted power down to received power, with the floor and the margin at the end.
  A line item set to zero is drawn as a zero-height bar with its name, so nothing
  vanishes.
- **Power pie.** Each block's DC power as a share, with the total in the centre and
  the efficiency of the whole chain beside it.
- **Equations.** The cascade formula with the actual numbers substituted, term by
  term, in the way the Elements lab prints its MNA rows.

### 4.3 Numbers

The defaults are chosen so that every quoted number is round enough to remember and
every picture fits a phone. All were computed before they were written here.

- The reference chain, six blocks. A preselect filter at −2.0 dB and 2.0 dB noise
  figure. An LNA at +15.0 dB, 1.5 dB and −5 dBm input IP3, drawing 33 mW. An image
  filter at −2.0 dB and 2.0 dB. A mixer at +8.0 dB, 8.0 dB and +5 dBm, drawing 45 mW.
  An IF filter at −3.0 dB and 3.0 dB. An IF amplifier at +22.0 dB, 10.0 dB and
  +20 dBm, drawing 60 mW.
- Its totals: gain 38.000 dB, noise figure 4.6663 dB, input IP3 −8.0444 dBm. Output
  IP3 is +29.956 dBm. DC power is 138 mW.
- Its noise shares: the preselect filter 30.33 %, the LNA 33.91 %, the image filter
  1.52 %. Then the mixer 21.87 %, the IF filter 0.65 % and the IF amplifier 11.72 %.
- Its IP3 shares: the mixer 62.45 %, the LNA 31.30 % and the IF amplifier 6.25 %. The
  three passive blocks contribute nothing, because their input IP3 is infinite.
- Its power shares: the IF amplifier 43.48 %, the mixer 32.61 % and the LNA 23.91 %.
  The three budgets are dominated by three different blocks, which is the lab's
  central lesson.
- Node by node, the cumulative gain runs −2.000, 13.000, 11.000, 19.000, 16.000 and
  38.000 dB. The cumulative noise figure runs 2.0000, 3.5000, 3.5565, 4.2972, 4.3174
  and 4.6663 dB.
- Moving the LNA in front of the preselect filter takes the noise figure from
  4.6663 dB to 3.2648 dB. That is a gain of 1.4015 dB. The input IP3 goes from
  −8.0444 dBm to −8.7746 dBm, a loss of 0.7301 dB.
- Raising the LNA's gain from 15.0 dB to 25.0 dB takes the noise figure to 3.6318 dB,
  which is 1.0345 dB better. The input IP3 goes to −16.607 dBm, 8.563 dB worse.
- Noise floor: `k T_0 = −173.975 dBm/Hz` at 290 K. Over 200 kHz that is
  −120.965 dBm, and with the chain's 4.6663 dB it is −116.299 dBm. Over 20.00 MHz it
  is −100.965 dBm and −96.299 dBm.
- Sensitivity at a required 10 dB of signal-to-noise ratio: −106.299 dBm over
  200 kHz, and −86.299 dBm over 20.00 MHz.
- Dynamic range over 200 kHz: spurious-free 72.170 dB, and linear 98.618 dB against
  an input 1 dB compression point of −17.680 dBm. Over 20.00 MHz they are 58.836 dB
  and 78.618 dB.
- The link at 2.400 GHz over 100 m: wavelength 12.491 cm, free-space loss 80.052 dB.
  From +20 dBm and two 2 dBi antennas the received power is −56.052 dBm. The floor
  over 20.00 MHz at 6 dB noise figure is −94.990 dBm. The signal-to-noise ratio is
  38.938 dB, and the margin over a required 20 dB is 18.938 dB.
- The same link at 1.000 km: free-space loss 100.052 dB, received power −76.052 dBm,
  signal-to-noise ratio 18.938 dB, and a margin of −1.062 dB. Ten times the distance
  costs exactly 20.000 dB.
- A 900 MHz link over 10.00 km with +30 dBm, 8 dBi and 2 dBi: free-space loss
  111.533 dB. The received power is −71.533 dBm. The margin is 29.457 dB over 200 kHz
  at 8 dB noise figure.
- A 12.00 GHz downlink from 35786 km with +50 dBm, 34 dBi and 41 dBi: free-space loss
  205.106 dB. The received power is −80.106 dBm. Against a required 10 dB over
  27.00 MHz at 2 dB noise figure the margin is 7.581 dB.
- `E_b/N_0` from the 100 m link: `C/N_0` is 111.950 dB-Hz. That is 51.950 dB at
  1.000 Mbit/s, 41.950 dB at 10.00 Mbit/s and 34.626 dB at 54.00 Mbit/s. Shannon's
  limit at that signal-to-noise ratio over 20.00 MHz is 258.72 Mbit/s.
- The converter: 8 bits give 49.920 dB and 10 bits give 61.960 dB. 12 bits give
  74.000 dB and 14 bits give 86.040 dB over the Nyquist band. At 100.0 MHz sampling
  with a 20.00 MHz band the oversampling ratio is 2.5000 and the processing gain is
  3.9794 dB.
- A 1.000 V peak full scale into 50 Ω is +10.000 dBm. A 12 bit converter's in-band
  noise floor then sits at −67.979 dBm.
- Reciprocal mixing: a local oscillator at −117.0 dBc/Hz spreads a blocker across a
  200 kHz channel at −63.990 dBc. A blocker at −30 dBm therefore leaves −93.990 dBm
  in the channel, which is above the −116.299 dBm floor.

---

## 5. Curriculum: 25 experiments in 6 groups

Format, as the other plans: **the claim** the note makes, what the reader turns, and
what is **measured** against what **formula**. Every quoted number becomes a pinned
test. The order is the progression map's. Each experiment ships with `see`, `try` and
`why` in the three registers, within the `STYLE.md` budgets.

### Group A: The chain as a budget (4)

Signal Lab already draws a source into a cascade of blocks. This group adds four
numbers to each block and one table below the strip, and nothing else.

- **A1 · Four numbers describe a block.** Gain, noise figure, input IP3 and DC power.
  An amplifier at +15.0 dB, 1.5 dB and −5 dBm is not a circuit yet, and the claim is
  that these four numbers predict what the chain does. Turn each and watch one column
  of the table move. Measured: each total against its formula, with one block.
- **A2 · Gain in decibels adds.** The reference chain's cumulative gain runs −2.000,
  13.000, 11.000, 19.000, 16.000 and 38.000 dB. Multiply the six power ratios instead
  and get the same 6310 to one. Bypass a block and the column shifts by exactly that
  block's gain. Measured: the six cumulative values, and the product.
- **A3 · A passive block is not free.** A filter at −2.0 dB has a noise figure of
  2.0 dB, at the reference temperature, because its output noise is thermal whatever
  its input was. Cool it and the noise figure falls. Measured: the noise figure
  against the loss at 290 K, and at two other temperatures.
- **A4 · Where the signal is, at every node.** Feed −80 dBm in and read the level after
  each block. The signal and the noise are two lines under the flow strip, and their
  gap is the signal-to-noise ratio. It never improves along the chain. Measured: both
  levels at all six nodes, and the ratio.

### Group B: The noise budget (5)

- **B1 · The floor is `kTB`.** At 290 K, `k T_0` is −173.975 dBm/Hz. Over 200 kHz that
  is −120.965 dBm, and over 20.00 MHz it is −100.965 dBm. Widening the bandwidth by
  ten costs exactly 10.000 dB. Measured: the constant, and the floor at three
  bandwidths.
- **B2 · Friis, and the first stage.** The reference chain has a noise figure of
  4.6663 dB. The preselect filter contributes 30.33 %, the LNA 33.91 % and the mixer
  21.87 %. Raise the LNA's gain and the shares behind it shrink. Measured: the total,
  the six shares, and their sum of 100 %.
- **B3 · Move the LNA and buy 1.4 dB.** Put the LNA in front of the preselect filter
  and the noise figure falls from 4.6663 dB to 3.2648 dB. The input IP3 falls too,
  from −8.0444 dBm to −8.7746 dBm. Measured: both budgets in both orders, and the two
  differences.
- **B4 · More gain is not always the answer.** Take the LNA from 15.0 dB to 25.0 dB.
  The noise figure improves by 1.0345 dB and the input IP3 worsens by 8.563 dB. The
  two budgets pull in opposite directions, and B4 is where a reader first sees that.
  Measured: both totals at four LNA gains.
- **B5 · Sensitivity.** The floor plus the required signal-to-noise ratio. At 10 dB
  over 200 kHz the chain hears −106.299 dBm. Over 20.00 MHz it hears −86.299 dBm, and
  the 20.000 dB difference is bandwidth alone. The Random Signals Lab's estimation
  group (being built) is where the required ratio's own uncertainty is treated.
  Measured: sensitivity at three bandwidths and two required ratios.

### Group C: The linearity budget (5)

- **C1 · The products the chain makes.** Signal Lab's Nonlinearity group showed two
  tones making four new lines. Here the third-order pair at `2f_1 − f_2` and
  `2f_2 − f_1` is the one that matters, because it lands in the channel. Measured: the
  four product frequencies, and which two lie in band.
- **C2 · IP3 as one number.** The gap between a fundamental and its third-order
  product falls 2 dB for every 1 dB of drive, so the two lines meet at a level that
  does not depend on the drive. `OIP3 = P_out + Δ/2`. Measured: the extracted IP3 at
  four drive levels against the closed form.
- **C3 · Cascading IP3, and the last stage.** The chain's input IP3 is −8.0444 dBm.
  The mixer contributes 62.45 %, the LNA 31.30 % and the IF amplifier 6.25 %. The
  passive blocks contribute nothing. Measured: the total, the three shares, and their
  sum.
- **C4 · Three ways to add the products.** Aligned phase gives −8.0444 dBm, power
  addition gives a higher number, and random phase gives higher still. The budget
  quotes the worst case, and the pane shows all three. Measured: all three totals, and
  that the power sum lies between the other two.
- **C5 · Compression, and where the budget stops.** The chain's input 1 dB compression
  point is −17.680 dBm under the cubic model, 9.636 dB below its input IP3. Drive
  harder and the extrapolation stops describing the chain. The guard warns 10 dB below
  compression and declines 3 dB below it. Measured: the offset, and the guard at both
  thresholds.

### Group D: Dynamic range (4)

- **D1 · The two lines and the floor.** The fundamental rises at slope 1, the
  third-order product at slope 3, and the noise floor is flat. Spurious-free dynamic
  range is where the product line crosses the floor, `(2/3)(IIP3 − floor)`. Measured:
  the crossing, against the formula.
- **D2 · Two dynamic ranges, both quoted.** Over 200 kHz the chain has 72.170 dB of
  spurious-free range and 98.618 dB of linear range. Over 20.00 MHz they are
  58.836 dB and 78.618 dB. The two answer different questions and a datasheet gives
  both. Measured: all four numbers.
- **D3 · Widening the channel costs both ends.** Take the bandwidth from 200 kHz to
  20.00 MHz. The floor rises 20.000 dB, sensitivity worsens by 20.000 dB and
  spurious-free range falls by 13.334 dB, which is two thirds of 20. Measured: all
  three changes, and the two-thirds ratio.
- **D4 · The converter at the end.** A 12 bit converter gives 74.000 dB over the
  Nyquist band, and at 100.0 MHz sampling into a 20.00 MHz band the oversampling gain
  adds 3.9794 dB. Against a +10.000 dBm full scale its in-band floor sits at
  −67.979 dBm. Measured: the ideal ratio, the processing gain and the floor.

### Group E: The link budget (4)

- **E1 · Free space costs `20 log(4π d/λ)`.** At 2.400 GHz over 100 m the loss is
  80.052 dB. Ten times the distance costs 20.000 dB more, and twice the distance costs
  6.0206 dB. Measured: the loss at four distances, and the two ratios.
- **E2 · The whole link, as a sum.** +20 dBm, two 2 dBi antennas and 80.052 dB of loss
  give −56.052 dBm at the receiver. Against a −94.990 dBm floor the signal-to-noise
  ratio is 38.938 dB, and the margin over a required 20 dB is 18.938 dB. Measured:
  every line item, and the sum.
- **E3 · The link that does not close.** Move the same link to 1.000 km. The received
  power is −76.052 dBm, the signal-to-noise ratio is 18.938 dB, and the margin is
  −1.062 dB. Turn the transmitted power, the antenna gain or the bandwidth until it
  closes, and read which is cheapest. Measured: the margin, and the three ways to
  recover it.
- **E4 · From power to bits.** `C/N_0` is 111.950 dB-Hz for the 100 m link. At
  1.000 Mbit/s that is 51.950 dB of `E_b/N_0`, and at 54.00 Mbit/s it is 34.626 dB.
  Shannon's limit over the same 20.00 MHz is 258.72 Mbit/s. The bit error rate is the
  Communications Lab's, and the term panel says so. Measured: `C/N_0`, three
  `E_b/N_0` values and the capacity.

### Group F: Power and the whole system (3)

- **F1 · The power budget.** The reference chain draws 138 mW, of which the IF
  amplifier is 43.48 %, the mixer 32.61 % and the LNA 23.91 %. The three budgets are
  dominated by three different blocks. Measured: the total, the three shares, and the
  block that dominates each of the three budgets.
- **F2 · Reciprocal mixing, a budget item nobody lists.** A local oscillator at
  −117.0 dBc/Hz spreads a blocker across a 200 kHz channel at −63.990 dBc. A blocker
  at −30 dBm leaves −93.990 dBm in band, which is 22.309 dB above the chain's floor.
  The RF Lab's Group H is where that number comes from. Measured: the leakage, and the
  margin against the floor.
- **F3 · The design, done once.** Given a sensitivity, a dynamic range and a power
  target, choose the gain, noise figure and IP3 of three blocks. The table shows the
  three margins, and every setting that meets all three is a valid answer. Measured:
  the three margins for the reader's choice, and that at least one valid answer
  exists.

---

## 6. Hand-overs

- **← RF Lab** (B, C, D, F2). `budget.js` and `linearity.js` are shared code rather
  than copied formulas, per Decision 3. The two labs' cascaded noise figure and
  cascaded IP3 are pinned equal on the same chain. Phase noise for F2 comes from the
  RF Lab's Leeson pane with its label intact.
- **← Signal Lab** (A, C1, D4). `createChain` from `packages/dsp` is the interaction
  model, unchanged. The Nonlinearity group's two-tone preset is C1's starting picture,
  and its "4 bits" preset is D4's converter, both cited by name.
- **← Fields Lab** (E1, E2). Antenna gain and the Friis equation are derived in its
  antenna group. This lab uses them and cites them. Until that group ships, both gains
  are numbers in a term panel with the derivation named as not yet built.
- **← Electronics Lab** (A1, C5, F1). Group G's port measurements are where a block's
  `R_in` and `R_out` come from. Group O is where noise density comes from. M6's
  efficiency ceiling is F1's argument seen from one stage.
- **→ Communications Lab** (E4). `E_b/N_0` and the margin are exactly what its channel
  group starts from. The link is one deep link when that lab ships, and no new content
  here.
- **→ Applied Analog Lab.** Its specification pane and this lab's budget table are the
  same idea at two scales. If that lab claims the table, the director promotes it to
  `packages/ui` under `PROGRAM.md` §5, and this plan's §4.2 names that as the trigger.

---

## 7. Testing discipline

- **Unit** (`packages/rf/src/budget.js` and `link.js`): `cascadeNF` and `cascadeIIP3`
  against hand-computed three-stage chains. `levels` against a hand walk. The passive
  block's noise figure against its loss at three temperatures. `dynamicRange` against
  the two-slope geometry. `link.js` against four hand-computed budgets.
- **Invariants** (§2.9), fuzzed across random chains of two to eight blocks. The
  hostile corners are included: a block with infinite input IP3, a block with zero
  gain, a chain of only passive blocks, and a chain whose last block dominates every
  budget.
- **Experiments**: every number in §5 pinned, as every other lab pins its notes. The
  cascade pins are 38.000 dB, 4.6663 dB, −8.0444 dBm, 30.33 %, 33.91 % and 62.45 %.
  The dynamic-range pins are −173.975 dBm/Hz, −116.299 dBm, −106.299 dBm, 72.170 dB
  and 98.618 dB. The link pins are 80.052 dB, −56.052 dBm, 18.938 dB, 205.106 dB and
  111.950 dB-Hz.
- **Budget against simulation**: every experiment in Groups B, C and D that quotes a
  budget also runs the same chain through `runChain` and compares. The agreement is
  invariants 5, 6 and 8, and the experiment fails when they disagree beyond the stated
  bound.
- **The map's promises**: a test walks every experiment's `why` and every
  cross-reference in it. The referenced experiment must exist in the named lab. A
  reference to one that is not built fails the suite. That is what keeps the Fields
  Lab and Communications Lab cross-references accurate.
- **Guards**: every guard in §2.2 tested at both sides of its threshold. The mismatch
  warning at VSWR 2.000. The IP3 drive guard. The far-field warning. The named zero
  line items in the link budget, which must appear in the waterfall.
- **Cross-lab pins**: the same chain's budget computed here and in the RF Lab. The
  quantiser against Signal Lab's "4 bits". A block whose numbers came from an
  Electronics Lab circuit against that circuit's own measures.
- **Playwright harness**: turning one block's noise figure moves one column and no
  other. The dominating block's mark moves when a knob crosses over. The waterfall's
  zero bars are visible. No horizontal scroll at 390 px, which the budget table makes
  the hardest test in the suite.
- **REVIEW_PLAYBOOK audit** before release, all eleven classes, a screenshot pass, and
  the sittings script from `apps/circuit-elements-lab/SITTINGS.md` with three seats.
  One seat sits Group A, because a reader arriving from Signal Lab meets the table
  first.

---

## 8. Integration and the dark launch

The mechanism is the one Power Lab and the Elements lab share, unchanged.

- Deployed **dark** at `/system-lab/` from the first vertical slice. Unlisted, and not
  secret.
- `apps/system-lab/RELEASE_STATUS` reads `dark`. A test asserts that while it does,
  the splash, the root README and the other labs' LabNav contain no reference to the
  System Lab. Flip the word to `released` and the same test demands the splash card,
  the README row and the nav entries, with counts pinned.
- `budget.js` and `link.js` land in `packages/rf`, which the RF Lab's overseer owns.
  This lab's requests go through `apps/system-lab/NEEDS.md`, per `PROGRAM.md` §5.
- `deploy.yml` gains one `cp` line, from this lab's `NEEDS.md`.
- The flip is **Reed's action**, after the release gate in §9.

---

## 9. Phasing

Each phase ships green and deployable dark. Group A needs only Signal Lab, which is
built and released, so the lab has a shippable first slice with no dependency at all.

1. **The chain and the table.** The block record, `levels`, the app shell, the flow
   strip adapted from Signal Lab's, the budget table, the dark deploy and the
   `RELEASE_STATUS` test. **Group A** (4). Exit: invariants 1, 2, 3 and 9 green, and
   every A number pinned.
2. **Noise.** `cascadeNF` in `packages/rf`, the cascade plot, the noise floor readout.
   **Group B** (5). Exit: invariants 4 and 5 green, B2's six shares pinned, and the
   budget checked against a simulated chain.
3. **Linearity.** `cascadeIIP3`, the two-slope plot, the spectrum view, the three
   addition rules. **Group C** (5). Exit: invariants 6 and 7 green, and C5's guard
   tested at both thresholds.
4. **Dynamic range.** `dynamicRange`, the floor on the two-slope plot, the converter
   block. **Group D** (4). Exit: invariant 8 green, and D3's two-thirds ratio pinned.
5. **The link.** `link.js`, the waterfall view, the antenna and channel blocks.
   **Group E** (4). Exit: invariants 10 and 11 green, and all four worked links
   pinned.
6. **Power and the design task.** The power pie, F3's three margins, the reciprocal
   mixing item. **Group F** (3). Exit: F1's shares pinned, and F3 verified to have at
   least one valid answer inside the knob ranges.
7. **The release gate**, in order, each blocking the next. The full audit, every
   option, every preset, every claim, fuzzing, both browsers. The student sittings.
   Reed's own pass against the dark deployment. Then the flip.

Phase 1 depends on nothing unbuilt. Phases 2 to 4 need the RF Lab's Phase 5 and 6, so
the two labs are built in step and the director sequences them. Phase 5 needs a number
from the Fields Lab and nothing more.

---

## 10. Non-goals (v1, stated so they are decisions rather than omissions)

- **Bit error rate and modulation.** The Communications Lab's. Decision 5 stops this
  lab at `E_b/N_0` and the margin.
- **The converter as a circuit.** The Mixed-Signal Lab's. D4 uses the ideal
  `6.02N + 1.76` law with jitter as a stated second term, and says which lab derives
  the rest.
- **Propagation models.** Rain fade, multipath, diffraction and terrain are named line
  items set to zero. Each is a subject with its own data, and data is not physics this
  lab can state.
- **Automatic gain control as a loop.** The loop is Control Lab's and the detector is
  the Electronics Lab's. This lab shows the level at every node and marks the block
  that clips, which is the budget question.
- **Frequency planning and spur tables.** Choosing local oscillator frequencies to
  avoid spurs is a combinatorial search, and the search is not a lesson. G2 in the RF
  Lab shows the image, and that is the case a course teaches.
- **Optimisation.** F3 states a target and reads three margins. It does not solve for
  the block parameters, because a solver would hide the trade the experiment is about.
- **Thermal and mechanical budgets.** Real systems have both. Neither has an exact
  form the suite could state without datasheet data.
- **Cost and area.** The same reason.
- **Transmitters.** The chain here is a receiver, plus one link. A transmitter's
  budgets are the same arithmetic with the power amplifier's back-off in place of the
  noise figure, and it is one group if a reader wants it.
- **A free-form chain editor.** Curated chains with editable block records, as every
  other lab uses curated circuits.

---

## 11. Risks, named

- **The table is the hardest thing in the suite to fit on a phone.** Six rows by six
  columns at 390 px with no horizontal scroll. Mitigation: the table transposes below
  a breakpoint, one block per card with its six budgets stacked, and the harness tests
  both orientations from the first commit.
- **The lab reads as arithmetic rather than as physics.** Every number here is a sum
  or a ratio. Mitigation: every experiment in Groups B, C and D checks its budget
  against a simulation of the same chain, and the simulation is on screen beside the
  number.
- **A dependency on a package another overseer owns.** Decision 3 puts `budget.js` in
  `packages/rf`. Mitigation: `NEEDS.md` is the channel, `PROGRAM.md` §5 is the rule,
  and the two labs' phases are sequenced by the director rather than negotiated
  between overseers.
- **The cascaded IP3 formula quoted as the answer.** It is the worst case.
  Mitigation: C4 is an experiment rather than a footnote, all three addition rules are
  columns, and invariant 7 requires the power sum to lie between the other two.
- **Numbers that are right for one chain.** Every quoted total is for the reference
  chain in §4.3. Mitigation: each pin is a function of the six block records and is
  re-derived in the test, never typed as a constant.
- **The link budget's zeros read as completeness.** A reader may take a zero line item
  for a modelled one. Mitigation: the waterfall draws a zero-height bar with its name,
  and the pane lists what the model does not include as content rather than as a
  caveat.
- **Two labs finish together or neither does.** This lab and the RF Lab share code and
  share pins. Mitigation: Phase 1 here needs nothing from there, and the shared pins
  are written as tests in `packages/rf` so that either lab's build catches a drift.
- **Cost.** Two new modules in an existing package, one new canvas, and 25
  experiments. The smallest engine cost of any proposed lab, which is what
  `ANALOG_ROADMAP.md` §7 predicted. The risk is scheduling rather than size.
