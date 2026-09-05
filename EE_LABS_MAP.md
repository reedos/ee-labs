# EE Labs, all of it: the map

Reed's aim (2026-09-05) widens from analog to the whole of electrical engineering.
This document is the map of that. Every discipline a strong department teaches
appears as a lab in this suite, with what it covers, the engine it needs, where
`CORE_SCOPE.md` admits, guards or declines its objects, and what it depends on. It
is an outline, like `ANALOG_ROADMAP.md`. A lab gets a plan file when the labs it
depends on are built enough to know what they hand over.

The suite's rules hold in every lab. Every explanatory sentence is a claim about
physics with a test behind it. Every object is admitted exactly, approximated behind
a guard, or declined with a reason. Nothing is installed, and nothing is loaded from
an instrument. A lab is a model a reader can trust without owning a bench.

The map is arranged as seven tracks, the way a department is arranged as groups.
Each track is a sequence a student can walk, and the tracks join at named seams. §1
is the whole map on one table. §2 walks each track. §3 is the engine roadmap. §4 is
the order to build in. §5 is what is out, and why.

---

## 1. The map

Status. **Built** is on the deployed site. **Planned** has a plan file. **Mapped**
has a section in `ANALOG_ROADMAP.md`. **Proposed** is named here for the first time.

| Track | Lab | Mirrors | Size | Interaction model | Status |
| --- | --- | --- | --- | --- | --- |
| A · Circuits and analog | Circuit Elements Lab | Circuits I | 55 | netlist, schematic, meters | built |
| A | Circuit Lab | Circuits II, frequency domain | 15 | circuit to H(s) | built |
| A | Electronics Lab | Electronics I and II | 77 | netlist, operating point, small signal | planned |
| A | Applied Analog Lab | board-level design | ~45 | tier 1's, plus a specification pane | mapped |
| A | Analog IC Lab | analog IC design | ~45 | tier 1's | mapped |
| A | Mixed-Signal Lab | sampled circuits, converters, clocks | ~40 | clock phases, sampled output | mapped |
| A | RF Lab | the radio front end | ~35 | Smith chart, S-parameters | mapped |
| A | System Lab | the signal chain and its budgets | ~25 | Signal Lab's chain | mapped |
| B · Signals and information | Signal Lab | Signals and Systems, DSP | 35 | sources, chain, time and spectrum | built |
| B | DSP Lab | DSP II: multirate, adaptive, fixed point, design | ~40 | Signal Lab's chain | proposed |
| B | Random Signals Lab | probability and random processes for EE | ~30 | ensembles and estimators over the chain | proposed |
| B | Communications Lab | analog and digital communications | ~50 | chain, constellation, eye, BER | proposed |
| B | Information Lab | information theory and coding | ~25 | source, code, channel, decoder | proposed |
| C · Control and machines | Control Lab | Control I | 13 | plant and controller, loop views | built |
| C | Control Lab II | state space, digital, nonlinear, identification | ~35 | Control Lab's, plus state and phase plane | proposed |
| C | Machines Lab | electric machines and drives | ~35 | the machine as a circuit and a rotor | proposed |
| D · Digital and computers | Logic Lab | digital logic | ~45 | gates, timing diagram, state machine | proposed |
| D | VLSI Lab | digital IC design | ~30 | gates as transistors, delay, power | proposed |
| D | Computer Lab | computer organisation | ~30 | datapath, pipeline, memory hierarchy | proposed |
| D | Interfaces Lab | embedded interfaces and buses | ~30 | timing diagram, protocol, the pin | proposed |
| E · Fields and waves | Fields Lab | electromagnetics I and II | ~50 | geometry, field map, the line | proposed |
| E | Photonics Lab | fibre, lasers, detectors | ~25 | the optical link | proposed |
| E | Signal Integrity | high-speed digital and optical links | private | the private waveform simulator | out of this repo |
| F · Energy and power | Power Lab | power electronics | 22 of 54 | switch states, scrub, steady state | built in part |
| F | Grid Lab | power systems | ~40 | one-line diagram, power flow | proposed |
| F | Energy Lab | photovoltaics, batteries, wind, the microgrid | ~25 | source models into Power Lab's converters | proposed |
| G · Devices and instruments | Devices Lab | semiconductor devices | ~30 | the one-dimensional structure and its curves | proposed |
| G | Instruments Lab | measurement | ~25 | the instrument as a circuit | proposed |

Twenty-eight labs. Six are built or partly built, one is planned, six are mapped,
fourteen are proposed here, and one lives elsewhere. Around 900 experiments when
complete.

---

## 2. Track by track

Each lab below has the same four lines. **Covers** is the syllabus. **Engine** is
what runs it. **Scope** is where CORE_SCOPE admits, guards or declines. **Opens
after** is the seam.

### Track A: Circuits and analog

Mapped in full in `ANALOG_ROADMAP.md` and `CURRICULUM.md`, and not repeated here.
Four seams join it to the other tracks:

- The CMOS inverter (Electronics D6) opens track D.
- Noise (Electronics O) opens the Random Signals Lab.
- The RF Lab shares the Smith chart with the Fields Lab.
- The Mixed-Signal Lab hands its converters to the Communications Lab and the
  Interfaces Lab.

### Track B: Signals and information

**Signal Lab** is built and is the root of the track. Its chain model, sources into a
cascade of blocks into time and spectrum views, carries three of the four labs below
without a new interaction model.

**DSP Lab.** The second DSP course, on the chain that exists.

- Covers: multirate (decimation, interpolation, polyphase, the noble identities).
  Filter design to a specification (windowed FIR, Parks–McClellan, IIR by bilinear
  from an analog prototype). Adaptive filters (LMS, RLS, the echo canceller,
  convergence against step size). Spectral estimation (periodogram variance, Welch,
  the AR model). Fixed-point effects (quantised coefficients moving poles, limit
  cycles, overflow). The FFT itself, the butterfly and its cost.
- Engine: `dsp` gains multirate blocks, an adaptive block whose weights are state,
  and a fixed-point mode.
- Scope: the quantised filter is exactly rational and admitted. The adaptive filter
  is time-varying and is shown as the sequence of filters it is, with no H(z)
  claimed.
- Opens after: Signal Lab's sampling and FIR groups.

**Random Signals Lab.** The probability course an EE takes, with the chain as the
laboratory.

- Covers: a random variable as a seeded source, its histogram converging on its
  density at `1/√N`. Expectation, variance, the Gaussian and why it appears.
  Autocorrelation and the power spectral density as a pair. White noise through a
  filter, the output spectrum as `|H|² S`, and the `kT/C` pin from Electronics O2.
  Estimation: the sample mean and its variance, the matched filter as the best
  detector, the Wiener filter, and the Kalman filter as the door to Control Lab II.
- Engine: a `random` package of seeded generators, ensemble runs, and estimators
  with their variance printed.
- Scope: every closed form (the Q function, `|H|² S`, the matched filter's SNR) is
  exact and pinned. Every estimate carries its confidence interval as the guard.
- Opens after: Electronics O1 (a density, not a spectrum) and Signal Lab's filters.

**Communications Lab.** The largest proposed lab, and the one most students ask for.

- Covers: analog modulation (AM, DSB, SSB, FM, PM), from Signal Lab's AM preset.
  Digital modulation (ASK, PSK, FSK, QAM), the constellation, Gray mapping. The
  pulse: Nyquist's criterion, the raised cosine, the eye diagram, intersymbol
  interference. The channel: AWGN, the matched filter, bit error rate against
  `E_b/N_0` with the Q function beside the Monte Carlo count. Synchronisation: the
  Costas loop and the early-late gate. Multicarrier: OFDM, the cyclic prefix, the
  peak-to-average ratio. Multipath, fading, and equalisation from the DSP Lab's
  adaptive filter. The link budget from the System Lab.
- Engine: a `comms` package on the chain, with mappers, pulse shapers, channels,
  detectors and a BER counter.
- Scope: the BER closed forms are exact, and the Monte Carlo estimate carries its
  confidence interval as the guard. OFDM under a cyclic prefix is exact. A fading
  channel is a labelled statistical model.
- Opens after: Random Signals, and Signal Lab's nonlinearity group.

**Information Lab.** Information theory and coding, on finite alphabets.

- Covers: entropy as the limit of compression, and the source coder (Huffman,
  arithmetic) reaching it. Channel capacity, and the Shannon limit drawn on the
  Communications Lab's BER plot as the line no code crosses. Codes: Hamming and the
  syndrome, convolutional codes and Viterbi's trellis walked step by step, LDPC as
  belief propagation watched, and the coding gain measured against the uncoded
  curve.
- Engine: a `codes` package of exact combinatorics, a trellis walker, and a decoder
  with its iterations kept.
- Scope: exact arithmetic throughout. The only guarded object is the simulated BER,
  as above.
- Opens after: the Communications Lab's channel group.

### Track C: Control and machines

**Control Lab** is built and covers the classical course.

**Control Lab II.** The second control course.

- Covers: state space, with the state as the memory and the state equation from the
  circuit (Elements F4 already writes it). Controllability and observability as rank.
  Pole placement, the observer, LQR as the quadratic trade. The transfer function and
  the state space as one object, converted exactly. Digital control: the sampled
  loop, the zero-order hold's half-sample delay, the z-plane, emulation against
  direct design. Nonlinear: the phase plane, the describing function of a
  saturation and the limit cycle it predicts, and one Lyapunov argument. System
  identification: a step response fitted to a model, with the residual printed. The
  Kalman filter from Random Signals.
- Engine: `systems` gains state-space forms (partly there in `toStateSpace`), the
  discrete-time loop, and a phase-plane integrator for PWL cases.
- Scope: state space and the sampled loop are exact. The describing function is an
  approximation with the filter hypothesis as its stated guard. A smooth
  nonlinearity in time is declined, as everywhere else.
- Opens after: Control Lab and Signal Lab's sampling group.

**Machines Lab.** The machine as a circuit and a rotor.

- Covers: the DC machine, back-EMF, torque, the torque-speed line, the armature as
  an RL with a mechanical state. The transformer as a machine that does not turn.
  Induction: the rotating field from three phases, slip, the equivalent circuit,
  the torque curve and its breakdown point. Synchronous and permanent-magnet
  machines, the dq transform, field-oriented control as a Control Lab loop. Drives
  from Power Lab's Group L. Losses, efficiency and the thermal limit.
- Engine: a `machines` package of equivalent circuits with one or two mechanical
  states. The network engine's dynamics solve them with the rotor as a state. The
  dq transform is an exact change of variables.
- Scope: the equivalent circuits are exact for the models they are. Magnetic
  saturation is a labelled toggle, as in Power Lab. The steady-state torque curves
  are closed forms.
- Opens after: Elements H (phasors) and Power Lab's inverters. Its loops hand to
  Control Lab.

### Track D: Digital and computers

**Logic Lab.** Digital logic, on a discrete-event engine.

- Covers: gates, truth tables, Boolean algebra, Karnaugh maps and minimisation, the
  multiplexer, the decoder, the adder and its carry. Timing: propagation delay, the
  glitch and the hazard, and why a synchronous design tolerates them. Sequential: the
  latch, the flip-flop, setup and hold, the register, the counter, and the finite
  state machine designed from a specification. The clock: skew, the critical path,
  the maximum frequency. Metastability from the Analog IC Lab's latch, as a rate.
- Engine: an `events` package, a discrete-event simulator with exact delays. It is
  the switched engine's event idea with no continuous state between events. Every
  waveform is exact, and a race is shown as the order of events it is.
- Scope: exact, because a gate with a delay is exact. The metastability rate is a
  labelled statistical model.
- Opens after: Electronics D6, the CMOS inverter.

**VLSI Lab.** The gate as transistors.

- Covers: logical effort and sizing. Elmore delay. Power: dynamic `CV²f`,
  short-circuit, and leakage from the Analog IC Lab's subthreshold model. Clock
  distribution and skew. Memory: the SRAM cell's static noise margin as a transfer
  characteristic, DRAM's charge on a capacitor and its refresh.
- Engine: the network engine for transistor-level cells, and the events engine for
  the gate level. A bridge extracts a gate's delay from its transistor circuit,
  exactly under the PWL model.
- Scope: the PWL transistor is exact. Elmore is a bound and is labelled one. The
  square-law delay is a quasi-static sweep with the Electronics Lab's guard.
- Opens after: Logic Lab and the Analog IC Lab's device group.

**Computer Lab.** Computer organisation, with every wire lit.

- Covers: the datapath (registers, the ALU, the register file), the single-cycle
  machine executing one instruction per clock. Control: the instruction decoder as
  the Logic Lab's state machine. Pipelining: hazards, forwarding, stalls, throughput
  against latency. Memory hierarchy: the cache as a lookup, hit rates from an
  address trace, the miss penalty. The bus and the interrupt.
- Engine: the events engine driving a curated datapath, and a trace-driven cache
  model.
- Scope: exact, since every object is a finite-state machine and a hit rate from a
  given trace is a count.
- Opens after: Logic Lab.

**Interfaces Lab.** Where a microcontroller meets the analog world.

- Covers: UART, SPI and I²C as timing diagrams with the setup, hold and rise times of
  real pins. CAN and USB at the physical layer. The GPIO pin's output stage
  (Electronics D5's switch) driving a load, and its input threshold (D6's noise
  margins). PWM as a DAC through Circuit Lab's RC. Sampling in software: the ADC's
  conversion time, aliasing from Signal Lab, the timer interrupt's jitter. Debouncing
  a switch.
- Engine: the events engine for the protocols and the network engine for the pins.
- Scope: exact, with the pin's transition modelled as PWL.
- Opens after: Logic Lab, Signal Lab's sampling group, and Electronics D. The
  Mixed-Signal Lab's converters are this lab's ADC.

### Track E: Fields and waves

**Fields Lab.** The two-semester electromagnetics course.

- Covers, first half: Coulomb, Gauss, potential, the capacitance of the canonical
  geometries in closed form (parallel plate, coaxial, spherical), the method of
  images, and Laplace's equation on a grid for the rest. Current and conductors,
  the resistance of a geometry, the four-point probe. Biot–Savart, Ampère, the
  inductance of the canonical geometries, the magnetic circuit Power Lab's Group D
  assumes, and the transformer from first principles. Faraday, the moving conductor,
  eddy currents, the skin depth.
- Covers, second half: Maxwell's equations and the plane wave, polarisation,
  reflection at an interface, the standing wave. Transmission lines: the
  telegrapher's equations, the characteristic impedance, reflection, the bounce
  diagram, and the Smith chart shared with the RF Lab. Waveguides and the cavity.
  Antennas: the dipole's pattern in closed form, gain, the array factor, and the
  Friis equation the System Lab budgets with.
- Engine: a `fields` package with the closed forms and a relaxation solver with its
  convergence estimate. The lossless line runs on the events engine.
- Scope: the closed forms are exact. The grid solver is an approximation whose guard
  is the change between two mesh refinements. The lossless bounce diagram with
  resistive ends is exact. A lossy line in time is declined with the reason
  (dispersion has no finite state), and its frequency-domain response is exact at
  every frequency.
- Opens after: Elements H and Circuit Lab. Its transmission-line group is the RF
  Lab's prerequisite.

**Photonics Lab.** The optical link the private simulator assumes.

- Covers: the photodiode's responsivity and its shot noise (Electronics O3), the
  transimpedance amplifier (Applied Analog), the LED and the laser as junctions with
  a threshold. The laser's rate equations, solved for their steady state exactly and
  for the relaxation oscillation as a labelled linearisation. Fibre: attenuation,
  dispersion, pulse spreading, the bandwidth-distance product. The Fabry–Pérot
  cavity as a transfer function. Wavelength multiplexing.
- Engine: closed forms and the network engine.
- Scope: admitted where rational. The rate equations are guarded by their
  linearisation's stated range. The modulated link is handed to the private tool.
- Opens after: Electronics O and Applied Analog.

**Signal Integrity.** High-speed serial and optical links, eye diagrams, jitter and
equalisation are the private `waveform-simulator`, as the README says. This map
records the seam and does not reopen it.

### Track F: Energy and power

**Power Lab** is built in part and planned in full.

**Grid Lab.** Power systems, a different subject from power electronics.

- Covers: per-unit. Three-phase from the circuits side, balanced and unbalanced,
  symmetrical components. The transformer and the line as π models. Power flow as
  the nonlinear problem, solved by Newton on the companion machinery the
  Electronics Lab builds, with the iterations shown as Elements I2 shows them. The
  DC power flow as the labelled approximation. Faults: three-phase and
  single-line-to-ground by symmetrical components, the fault current, the breaker.
  Protection: overcurrent, distance, the relay's characteristic. The synchronous
  generator on the grid, the swing equation, transient stability and the equal-area
  criterion. Economic dispatch.
- Engine: the network engine's phasor solve and Newton. A `grid` package adds
  per-unit, sequence networks and the swing equation as one mechanical state.
- Scope: the phasor network is exact. The power flow is exact at convergence with
  the residual printed. The DC power flow is guarded by the angle it assumes small.
  The swing equation's equal-area answer is exact, and its time solution runs under
  a labelled integrator.
- Opens after: Elements H and the Machines Lab's synchronous machine.

**Energy Lab.** The sources Power Lab converts.

- Covers: the photovoltaic cell as Elements I1's diode with a current source, its
  I–V and P–V curves exactly by Newton, the maximum power point, and the MPPT
  algorithm driving a Power Lab converter. Shading and the bypass diode. The battery
  as an equivalent circuit (Elements F), its state of charge, its internal resistance
  and the energy lost to it, charging profiles. Wind as a Machines Lab generator
  behind a turbine's power curve. The microgrid: sources, storage and loads on one
  bus with Power Lab's inverters, and the energy balance over a day.
- Engine: the network engine and Power Lab's.
- Scope: the PV curve and the battery circuit are exact for their models. The
  turbine's power curve and the daily profiles are labelled data.
- Opens after: Elements I and Power Lab's buck.

### Track G: Devices and instruments

**Devices Lab.** Semiconductor devices, kept to the closed forms the depletion
approximation gives.

- Covers: carriers, doping, the Fermi level and the band diagram drawn. The pn
  junction in depth, from Electronics C: the depletion width, the field and
  potential profiles, the I–V law's derivation, breakdown. The MOS capacitor:
  accumulation, depletion, inversion, the C–V curve as the industry's diagnostic.
  The MOSFET derived from the MOS capacitor, the threshold, the square law and where
  it fails. The BJT from two junctions. The solar cell and the LED. Fabrication as a
  sequence of drawn cross-sections, with the numbers each step sets.
- Engine: `junction.js` extended to profiles and the MOS capacitor.
- Scope: the depletion approximation is a labelled model, every result within it is
  exact, and transport beyond it is declined.
- Opens after: Electronics C, and it reads well beside Electronics D.

**Instruments Lab.** How instruments work, as circuits the suite can solve.

- Covers: the oscilloscope's input as an RC, the 10× probe and its compensation as
  an exact divider that is flat only when two time constants match, probe loading,
  the sampling scope's aliasing. The multimeter: the shunt, the divider, burden
  voltage, four-wire measurement. The spectrum analyser as a swept filter, its
  resolution bandwidth against Signal Lab's window. The network analyser as
  S-parameters from the RF Lab. The lock-in amplifier from Applied Analog.
  Uncertainty: resolution, accuracy, propagation of errors, the instrument's own
  noise floor.
- Engine: the network engine.
- Scope: everything is a circuit and is exact. No measurement is loaded from a real
  instrument (Reed, 2026-09-05).
- Opens after: Circuit Lab, and it is useful beside every lab after it.

---

## 3. The engine roadmap

The suite has six packages today. The map needs seven more, and most labs need
none of them.

| Package | Provides | First lab | CORE_SCOPE stance |
| --- | --- | --- | --- |
| `network` extended | transistors, Newton over a companion, small signal, `transferOf`, loop gain, noise | Electronics | admitted at the point, labelled |
| `events` | discrete events with exact delays, no continuous state | Logic Lab | exact |
| `comms` | mappers, pulse shapers, channels, detectors, a BER counter, on the `dsp` chain | Communications | closed forms exact, estimates with intervals |
| `random` | seeded generators, ensembles, estimators with variance | Random Signals | estimates with intervals |
| `codes` | finite-field arithmetic, the trellis, iterative decoders | Information | exact |
| `machines` | equivalent circuits with mechanical states, the dq transform | Machines | exact for the model, saturation labelled |
| `fields` | closed-form geometries, a relaxation solver with convergence, the lossless line on `events` | Fields | closed forms exact, grid guarded |
| `grid` | per-unit, sequence networks, power flow on `network`'s Newton, the swing equation | Grid | exact at convergence, DC flow guarded |
| `rf` | S-parameters, the Smith chart, the line per frequency | RF | exact per frequency |
| `switched` extended | charge conservation at a switch event, exact H(z) of an SC network | Mixed-Signal | exact |
| `systems` extended | state space, the discrete loop, the describing function | Control Lab II | exact, describing function guarded |
| `dsp` extended | multirate, adaptive, fixed point, a quantiser | DSP Lab | exact, adaptive shown as a sequence |

The `events` package unlocks the most. Logic, VLSI, Computer, Interfaces and the
Fields Lab's transmission line all run on it, and it is the simplest engine in the
map. Every waveform it produces is exact, because a delay is exact.

---

## 4. The order to build in

Ordered by what each lab unlocks, what it leans on, and how much of the engine
already exists. Each step ships dark and is released on Reed's word, as today.

1. **Electronics Lab** (planned, brief written). The root of track A, and the
   companion Newton that the Grid Lab reuses.
2. **The two seams and the progression test**, from `CURRICULUM.md`. Small, and they
   make every later cross-reference checkable.
3. **Logic Lab**, on the new `events` package. The largest audience of any proposed
   lab, the simplest engine, and the root of track D.
4. **Random Signals Lab**, then **Communications Lab**. Track B's second half, on the
   chain that exists. Communications is the most requested lab and the largest.
5. **Applied Analog Lab** and **Analog IC Lab**, once Electronics L and M are built.
6. **Control Lab II** and **Machines Lab**. Track C's second half.
7. **Fields Lab**. A new solver and a two-semester course. Its transmission-line
   group gates the RF Lab.
8. **Grid Lab** and **Energy Lab**. Track F's remainder, on Power Lab and Machines.
9. **Mixed-Signal Lab**, **VLSI Lab**, **Interfaces Lab**, **Computer Lab**. The labs
   that join tracks A and D.
10. **RF Lab**, **Photonics Lab**, **System Lab**. The top of track A.
11. **DSP Lab**, **Information Lab**, **Devices Lab**, **Instruments Lab**. Each can
    slot in earlier if someone wants it, since none gates another.

A degree walks the tracks in parallel. A first year is Elements, Circuit Lab, Signal
Lab's first two groups and the Logic Lab. A second year is Electronics, Signal Lab,
Control Lab, Random Signals and the Fields Lab's first half. A third year is the
track-specific labs. A fourth year is the top of each track and the System Lab.
`CURRICULUM.md` is the analog walk in detail, and each track's walk is written the
same way when its labs are planned.

---

## 5. Out, and why

- **Machine learning.** Not physics, and no exact form. The adaptive filter and the
  Kalman filter are the parts of it that are, and they are in.
- **Networks and protocols above the physical layer.** Queuing theory's closed forms
  are exact, but the subject is computer science, and the Interfaces Lab stops at
  the pin.
- **HDL, compilers, toolchains.** The Logic Lab uses curated designs, as every lab
  uses curated circuits. A free-form editor is the day a lab needs one.
- **Full-wave electromagnetic simulation, layout extraction, process design kits.**
  No form the suite could state, and no lesson that survives without the tool.
- **Materials, quantum devices, MEMS fabrication.** Neighbouring disciplines with
  their own physics.
- **The bench as a data source.** Every lab is a model, and its claims are checked by
  its tests. The Instruments Lab teaches how a bench works. It does not connect to
  one.
- **High-speed and optical links.** The private simulator's, by the README.

Everything else a department teaches has a row in §1.
