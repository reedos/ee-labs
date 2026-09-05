# Control Lab II: the plan

The second control course, and track C's other half. Control Lab covers the
classical one: a plant, a controller, a loop, and the margins that say whether it
holds. This lab covers what the second course adds. The state as the loop's memory.
The computer in the feedback path. The saturation that makes a stable design
oscillate. The plant nobody wrote down, fitted from its own step response.

Splash glyph `⟳`, directory `apps/control-lab-ii`, deployed dark at
`/control-lab-ii/`. The engine is `@ee-labs/systems`, extended.

This document follows `PROGRAM.md` §3.1 and the shape of `ELECTRONICS_LAB_PLAN.md`.
§0 is the open decisions. §1 is the progression map against what is built. §2 is the
engine. §3 is the models. §4 is the app. §5 is the curriculum. §6 to §11 are the
hand-overs, the testing, the dark launch, the phasing, the non-goals and the risks.

Every number quoted below was computed by a script before it was written, against
the engine in `packages/systems`. The two rules that govern every other lab govern
this one. Every explanatory sentence is a claim about physics, and a test must
measure it. `CORE_SCOPE.md` decides what the engine states exactly, what it
approximates behind a guard, and what it declines with a reason.

This lab is where the third of those cases earns its keep. A saturation is not a
rational function of s. The describing function of one is an approximation, and the
whole of Group D is built around showing the reader how far off it is.

---

## 0. Open decisions

### Decision 1: the name and the slug

Recommended: **Control Lab II**, directory `control-lab-ii`, LabNav short form
"Control II". `EE_LABS_MAP.md` §1 already names it that, and the course it mirrors
is called that in most catalogues. The alternative, *Modern Control*, dates badly
and excludes the identification and nonlinear groups.

### Decision 2: one lab or two

Recommended: **one codebase, one dark URL**. At 35 experiments this is smaller than
Signal Lab. Groups A and B are the state-space and digital course that most
departments teach as one semester. Groups C and D are the nonlinear half. Group E
stands alone and could move to a later lab. Nothing here needs a split.

### Decision 3: where the phase plane lives

Recommended: **build it in the app, promote it when the Machines Lab claims it.**
`PROGRAM.md` §4 names Machines Lab as the phase plane's second lab, and the rule is
that a new canvas carries the second lab's needs in its props from the start. §4.3
lists those props. The canvas ships as `apps/control-lab-ii/src/components/
PhaseCanvas.jsx` and is listed in `NEEDS.md` as a promotion candidate.

### Decision 4: how much of the Kalman filter to build now

The Random Signals Lab is being built in parallel on `lab/random-lab`, and it owns
the `random` package. Recommended: **build Group F's deterministic half and defer
its statistical half.** The steady-state Kalman gain is the dual of the LQR gain and
needs no new package. The covariance recursion needs a noise model with a variance,
and an ensemble to show that the variance is the one predicted. Group F therefore
ships two experiments now and three when `random` lands. No lesson text in this lab
refers to the Random Signals Lab until that lab is built, and `BACKLOG.md` carries
the dependency.

### Decision 5: whether the saturation belongs to Control Lab

Control Lab's loop has no actuator limit, and adding one there would change a
released lab. Recommended: **the saturation lives here**, and Control Lab is left
alone. Group C's first experiment restates Control Lab's PI loop and then adds the
limit, so a reader arriving from there recognises the picture.

---

## 1. The progression map

Every idea this lab leans on, where the suite already teaches it, and whether that
experiment exists today.

| Idea the lab leans on | Needed by | Taught at | Status |
| --- | --- | --- | --- |
| A plant, a controller, the closed loop, the step | everything | Control Lab, 13 built | built |
| Poles, zeros, the s-plane, stability as the left half | A, C, D | Control Lab and Circuit Lab | built |
| Phase margin, gain margin, the crossover | B, D | Control Lab | built |
| The root locus, and a branch crossing the axis | D2 | Control Lab | built |
| The state as the memory of a first-order circuit | A1 | Elements F4 | built |
| Two states, two initial conditions, one shape | A1, C1 | Elements G6 | built |
| The characteristic equation as `det(sI − A) = 0` | A3 | Elements G1 | built |
| Sampling, aliasing, the Nyquist rate | B1, B2 | Signal Lab's sampling group | built |
| The z-plane, and the unit circle as the frequency axis | B3, B4 | Signal Lab's sampled-filter group | built |
| The bilinear transform from an analog prototype | B5 | Signal Lab, and `bilinear` in `systems` | built |
| Harmonics of a clipped sine | D1 | Signal Lab's nonlinearity group | built |
| A random variable, its variance, and an ensemble | F2, F3, F5 | nowhere yet | **gap, Random Signals Lab** |
| The switched converter as a piecewise-linear system | C, D3 | Power Lab Groups A and B | built |

One row is a gap, and it is the only one. Group F's statistical half waits on the
Random Signals Lab, and Decision 4 says what ships without it. Nothing in any other
group leans on an experiment that is not built.

The order of the groups follows the map. A reader walks Control Lab, then Signal
Lab's sampling group, then this lab from A to F.

---

## 2. The engine: `@ee-labs/systems`, extended

Built and merged. `packages/systems` gains six modules, all additions. No existing
signature changed, and every existing consumer stays green. Circuit Lab, Control Lab
and Signal Lab were run against the extended package with no edits.

### 2.1 Where each object sits in `CORE_SCOPE.md`

| Object | Case | Handling |
| --- | --- | --- |
| A state space with constant real matrices | admitted, exact | Rational in s both ways, no hedge |
| The conversion `tf` to `ss` to `tf` | admitted, exact | Faddeev-LeVerrier, no root finding |
| A plant under a zero-order hold, read at the samples | admitted, exact | One matrix exponential, exact at every instant |
| An emulated controller (`tustin`, `backward`, `forward`) | approximate, guarded | Labelled, with the samples-per-cycle threshold |
| The hold's own response `(1 − e^(−sT))/s` | declined | No finite poles or zeros, so not rational in s |
| The trajectory of a piecewise-linear loop | admitted, exact | Closed form in each region, events by bisection |
| The describing function of a saturation | approximate, guarded | The filter hypothesis, with a measured threshold |
| A smooth nonlinearity in time | declined | No segments, so no closed form to step between |
| An ideal relay in time | declined | It slides on its surface, so the event count is not finite |
| A model fitted to a step | admitted, with its residual | The fit is rational, the claim that it IS the plant is not |

### 2.2 State space, exactly

`ss.js`. The shape matches the `toStateSpace` already in `tf.js`, so the two are one
currency. `A` is an array of rows, `B` and `C` are flat arrays, `D` is a number.
Single input and single output only, because every plant in this suite has one drive
and one measurement.

`toTransferFunction` converts back by Faddeev-LeVerrier. The recurrence produces the
characteristic polynomial and the adjugate's coefficient matrices in one pass, so
the numerator is `C adj_k B` term by term. There is no root finding and no matrix
inverse, so repeated and complex poles take the same path as any other.

`controllability` and `observability` return the matrix, its rank, the singular
values behind that rank, and the condition number. The singular values matter more
than the rank. A plant approaching uncontrollability does not lose a pivot. It loses
a decade of its smallest singular value, and A4 shows that happening.

`placePoles` is Ackermann's formula. `observerGain` is the same routine on the
transpose, which is the duality A6 makes its subject. `lqr` solves the Riccati
equation by Kleinman's iteration and returns the residual on every call. There is no
return shape that omits it.

### 2.3 The sampled loop, exactly and approximately

`discrete.js`. Three objects, in three different cases of `CORE_SCOPE.md`, and
keeping them apart is most of what Group B teaches.

`zoh(ss, Ts)` is exact. The state map is `e^(A T)` and the input map is the integral
of `e^(A tau) B` over one sample. Both come from a single exponential of the
augmented matrix, so there is no quadrature. `discretize(tf, Ts)` goes through the
state space and returns a rational function of z.

`emulate(tf, Ts, method)` is an approximation and is labelled one. Every returned
object carries `approximate: true`, its `method` and its `Ts`. `emulationGuard`
carries the threshold, which is **twenty samples per cycle at the loop's gain
crossover**. That is the number the sampled-filter link already refuses below
(`CORE_SCOPE.md` Rule 2's first precedent), and at that rate the hold alone costs
9.0 degrees of phase.

`zohTransferFunction()` declines, with the reason. The hold's response has no finite
poles or zeros. Its magnitude and its phase at a frequency are exact numbers, and
`zohGain` and `zohPhaseLag` return them. Nothing in the package builds a Padé
version.

### 2.4 The exact trajectory of a piecewise-linear loop

`phase.js`. Inside each region of the nonlinearity the state equation is constant
and affine, so the trajectory has a closed form. The only thing left to compute is
when the state leaves the region, and that is a scalar root found by bisection on
the exact flow. There is no step size, and there is no error that shrinks when the
caller asks for more points.

`pwlTrajectory` returns the trajectory, the states, the nonlinearity's input and
output, and every switching event with its instant. `phaseField`, `switchingLines`
and `equilibria` supply the picture. `lyapunovRate` reports `V` and its rate at any
point, in whichever region that point is in, so a pane can shade where a quadratic
Lyapunov argument holds and where it stops.

Two refusals live in `nonlinear.js`. A smooth nonlinearity has no segments to step
between, so integrating it means choosing a step size and carrying an error that
depends on that choice. It is declined. An ideal relay slides along its switching
surface, so the event count is not finite. It is declined, and a relay with a finite
slope is a saturation with a small limit.

### 2.5 The describing function, and the guard that measures itself

`describing.js`. The describing function of a saturation is a closed form, and so is
every one of its harmonics. Both are checked against a numerical Fourier integral.

The approximation is not in the formula. It is in the hypothesis that the linear
part attenuates the harmonics enough that only the fundamental returns to the
nonlinearity. `describingLimitCycle` measures that on the loop it is given. The
number it computes is the third harmonic arriving back at the nonlinearity, divided
by the fundamental arriving there, and the threshold is five per cent.

That threshold was chosen from a measurement rather than a convention. The method
was fuzzed against the exact simulation over a range of gains and limits. The
amplitude it gets wrong is the same size as this ratio, within a factor of 1.5
either way. So the guard predicts the error it guards against. A five per cent ratio
means a predicted amplitude right to within about five per cent.

### 2.6 Identification, and the residual it cannot hide

`ident.js`. Two stages. The integral method gives a first estimate by linear least
squares, which works on a noisy trace because integrating the model's own equation
twice removes the derivatives of the data. Nelder-Mead then minimises the residual
on the response itself, so the number printed is the smallest residual that model
shape can reach on that data.

Every routine returns `residual` and `relResidual`. There is no code path that
returns a fitted model without them.

### 2.7 Invariants, the fuzzer's checklist

Each is a test in `packages/systems/src`, and each is fuzzed over a seeded range
rather than checked at one point.

1. **The round trip is exact.** `tf` to `ss` to `tf` agrees to 1e-9 relative on
   every coefficient, normalised by its own polynomial's largest, over 400 random
   systems of order 1 to 4 spread across four decades. The frequency response agrees
   to 1e-9 as well, at 41 frequencies each.
2. **The state is a choice.** Any similarity transform leaves H(s) unchanged, while
   changing A by more than a tenth.
3. **Rank is exactly placement.** Over 200 fuzzed systems, `placePoles` succeeds
   when and only when the controllability rank is full. The poles it achieves match
   the poles asked for, within a tolerance that scales with the matrix's own
   conditioning. A rank-deficient plant is declined with its rank in the message.
4. **The optimal loop is stable, and its residual is small.** Over 120 fuzzed
   controllable systems, every LQR gain gives a strictly stable closed loop and a
   relative Riccati residual below 1e-8.
5. **The hold is exact for a first-order plant.** Over 300 fuzzed time constants,
   gains and sample times, the discretised coefficients match the closed form
   `K(1 − α)/(z − α)` with `α = e^(−T/τ)` to 1e-12, and the sampled step matches
   `K(1 − e^(−kT/τ))` to 1e-12.
6. **The discrete loop is the held continuous loop.** Over 120 fuzzed first-order
   loops under proportional control, the discrete closed loop's step and a
   sample-by-sample continuous simulation agree to 1e-10 at every instant.
7. **Two emulation rules preserve stability and one does not.** Over 200 fuzzed
   stable controllers, `tustin` and `backward` always emulate to a stable difference
   equation. `forward` does not, and the case where it fails is pinned.
8. **The trajectory does not depend on the grid.** Refining a piecewise-linear
   trajectory by ten gives ten times as many samples of the same curve, agreeing to
   nine decimals, with the same events at the same instants to eight.
9. **The prediction is compared with the truth.** Over 16 fuzzed gains and limits,
   the describing function's amplitude error divided by the harmonic ratio stays
   between 0.7 and 1.5. The method under-predicts every time.
10. **The residual is the noise.** A first-order step is fitted with noise at 1, 2
    and 5 per cent of the gain. The fitted relative residual lands within ten per
    cent of the noise level. The fitted time constant is unbiased over 40 seeds.

Invariant 8 caught a real defect. The first cut of the region walk read the
destination region rather than the boundary being crossed, which put the wrong sign
on every return into the linear region. The answer then depended on the step size,
which is the one thing an exact integrator must not do.

---

## 3. Models: the plants, the controllers and the nonlinearities

The plants are Control Lab's, so a reader arrives with the pictures already in mind.
Three are added here.

| Plant | H(s) | Defaults | Used by |
| --- | --- | --- | --- |
| First-order lag | `K/(1 + τs)` | K = 1, τ = 1 s | B, E |
| Motor position | `K/(s(1 + τs))` | K = 1, τ = 0.5 s | A |
| Three lags | `K/((1+τ₁s)(1+τ₂s)(1+τ₃s))` | 1, 0.5, 0.25 s | D |
| Twin sections | two identical lags from one drive | τ = 1 s both | A4 |
| Split sections | two lags, one measured | 1 s and 0.2 s | A4 |
| Two lags | `K/((1+0.7s)(1+0.13s))` | K = 1 | E |

The motor is the state-space reference because its two states have names. Position
and speed, with `ẏ = v` and `v̇ = −v/τ + (K/τ)u`. In that basis

```
A = [[0, 1], [0, −2]]      B = [0, 2]      C = [1, 0]      D = 0
```

and `toTransferFunction` returns `2/(s² + 2s)`, which is the motor's own
`1/(s(1 + 0.5s))`.

The controllers are Control Lab's proportional, PI, PID and lead, plus two new ones.
**State feedback** `u = −Kx`, with the gain vector set by a pole pair or by the LQR
weights. **The observer** `x̂' = Ax̂ + Bu + L(y − Cx̂)`, with its own pole pair.

One nonlinearity ships, in two shapes. **Saturation**, slope 1 inside ±δ and flat
outside. **Deadzone**, flat inside ±δ and slope 1 outside. Both are odd, memoryless
and made of three straight segments, which is what makes their trajectories exact.

---

## 4. The app

### 4.1 Layout

Control Lab's, unchanged, so a reader who knows one knows the other. A sidebar of
lessons, then the plant, then the controller. A topbar carrying the loop diagram and
the numbers. Two view panes below it.

Two things are added to the sidebar. A **sampling** section, holding the sample time
and the emulation rule, which appears only in Group B. A **nonlinearity** section
holding the kind and the limit, which appears in Groups C and D.

### 4.2 Views

Six, of which two are new to the suite.

| View | Shows | New? |
| --- | --- | --- |
| Step | The closed loop's response, with the drive beside it | Control Lab's |
| Bode | Magnitude and phase of the open loop | Control Lab's |
| Poles | The s-plane, from `PoleZeroCanvas` in `packages/ui` | shared |
| z-plane | The sampled loop's poles, from `ZPlaneCanvas` | shared |
| Phase | The two-state plane, with the field, the switching lines and the trajectory | **new** |
| Fit | The measured step, the fitted model over it, and the residual below | **new** |

The phase plane is the canvas `PROGRAM.md` §4 assigns to this lab, with the Machines
Lab named as its second. §4.3 lists the props that second lab needs.

### 4.3 The phase canvas, and what the Machines Lab will need

`PhaseCanvas.jsx` takes the state trajectory and draws it. The props below are the
whole interface, and the four marked with an arrow are there for the Machines Lab
rather than for this one.

```
trajectories   [{ x: [[x1, x2], ...], label, colour }]   one or many
field          { arrows: [{ x, y, dx, dy, region }] }    the vector field
lines          [{ a, b, c, label }]                      switching lines, a x + b y = c
equilibria     [{ point, real, label }]                  filled if real, hollow if virtual
levels       → [{ P, values: [v1, v2] }]                 Lyapunov level sets, drawn as ellipses
xLabel, yLabel, xUnit, yUnit                             the axes name their quantities
cursor       → { index }                                 a scrubbed point, shared with the step view
periodic     → boolean                                   wrap the horizontal axis at ±π
onPick       → (x, y) => void                            click to start a trajectory there
```

`periodic` is the one the Machines Lab needs most. A rotor angle lives on a circle,
so its phase plane is a cylinder, and the horizontal axis wraps. This lab never sets
it, and the canvas is written so that the Machines Lab does not have to reopen it.

### 4.4 Numbers on screen

The topbar carries four, and each is a function of the knobs.

- **Verdict**, from `isStable` or `isStableDiscrete`, whichever the mode is.
- **Phase margin** and **gain margin**, from `margins`, as in Control Lab.
- **The guard**, whichever one applies. In Group B it is the samples per cycle at
  crossover against the threshold of twenty. In Group D it is the harmonic ratio
  against the threshold of five per cent. In Group E it is the fit's relative
  residual. A view with no guard shows no guard.

The Fit view prints the residual next to the fitted parameters, always. The Phase
view prints the measured limit-cycle amplitude next to the predicted one, and the
difference between them, always.

---

## 5. Curriculum: 35 experiments in 6 groups

Format, as the other plans. **The claim** the note makes, what the reader turns, and
what is **measured** against what **formula**. Every quoted number is computed from
the knobs in `experiments.test.js` rather than typed in. Each experiment ships with
`see`, `try` and `why` in the three registers, within the `STYLE.md` budgets.

### Group A: The state (7)

The state is what the loop is carrying. Elements F4 already says that a first-order
circuit is three numbers, and Elements G6 already shows two initial conditions
giving the same shape at different sizes. This group gives that idea its algebra.

- **A1 · The state is the memory.** The motor at rest, and the same motor with the
  rotor already turning. Same input, two different outputs, and the difference is
  entirely in `x(0)`. The pane shows the two states as functions of time beside the
  output. Measured: two trajectories from the same input and different `x(0)`, and
  the exact `x(t) = e^(At)x(0)` against the simulation.
- **A2 · The state equation, from the circuit.** The RC of Elements F4 and the RLC
  of Elements G1, written as `ẋ = Ax + Bu`. The capacitor voltage is a state because
  it cannot jump. The inductor current is a state for the same reason. Measured: the
  poles of `det(sI − A)` equal the roots of the circuit's own denominator, and
  `toTransferFunction` returns the H(s) Circuit Lab computes.
- **A3 · Two views, one object.** The motor in the physical basis, and the same
  motor in the controllable canonical form. The A matrices differ. The transfer
  function does not. Measured: `2/(s² + 2s)` from both bases to 1e-9, and that a
  similarity transform changes A by more than a tenth while changing H(s) by
  nothing.
- **A4 · Controllability is a rank.** Two identical lags driven by one input and
  read as their difference. The controllability matrix has rank 1 of 2, and its
  smallest singular value is exactly zero. Detune one lag by 0.1 per cent and the
  rank returns, with a condition number of 4002. At 1 per cent it is 402, and at 10
  per cent it is 42.1. Measured: the rank and the condition at four detunings, and
  the declined placement's message.
- **A5 · Pole placement.** The motor, with the closed-loop pair placed at ωₙ = 4
  rad/s and ζ = 0.7. Ackermann gives `K = [8, 1.8]` exactly, and the closed loop
  overshoots 4.60 per cent. The DC gain of the placed loop is 0.125, so state
  feedback alone does not put the output where the reference asks. Measured: the
  gain, the achieved poles to six figures, the overshoot, and the DC gain.
- **A6 · The observer, and the duality.** The same motor with only its position
  measured. The observer's error poles are placed four times faster than the
  controller's, at −11.2 ± 11.43j, giving `L = [20.4, 215.2]`. The estimate catches a
  wrong initial state in 0.357 s. Measured: the error poles, the gain, the settling,
  and that placing on `(Aᵀ, Cᵀ)` gives the same numbers.
- **A7 · The quadratic trade.** The LQR on the motor, with `Q = diag(1, 0)` and R
  swept. The position gain is exactly `1/√R`, so R = 0.01 gives 10 and R = 100 gives
  0.1. At R = 1 the closed-loop poles are a double root at −√2 and the cost from a
  unit position error is √2. Measured: the gain law, the poles, the cost at three
  weights, and the Riccati residual below 1e-15 every time.

### Group B: The sampled loop (7)

A computer reads the output at intervals and holds its answer between them. Signal
Lab's sampling group already says what sampling does to a signal. This group says
what it does to a loop.

- **B1 · What the loop sees.** The first-order lag with τ = 1 s under proportional
  control, sampled at 0.1 s. The drive is a staircase. The pane draws the continuous
  output, the sample instants on it, and the held drive below. Measured: the
  discrete model's output equals the continuous plant's at every sample instant to
  1e-12.
- **B2 · The hold costs half a sample.** At Ts = 0.1 s the hold delays by 50 ms at
  every frequency. On a loop crossing at 2.828 rad/s that is 9.0 degrees of phase at
  20 samples per cycle, and 36 degrees at 5. Measured: the lag in degrees at four
  rates, against `ωT/2`. The pane states that the hold itself has no transfer
  function in s, and gives the reason.
- **B3 · The plant, sampled exactly.** `K/(1 + τs)` becomes `K(1 − α)/(z − α)` with
  `α = e^(−T/τ)`. At τ = 1 s and Ts = 0.1 s that is `0.0951626/(z − 0.904837)`. The
  z-plane pane draws the pole, and the s-plane pane draws the one it came from.
  Measured: the coefficients against the closed form, and `ln(z)/T` back to −1/τ.
- **B4 · Sampling can break a loop that cannot break.** A first-order plant under
  proportional control is stable at every gain in continuous time. Sampled at 0.1 s
  it goes unstable at Kp = 20.0167, which is `coth(T/2τ)`. Measured: the continuous
  loop stable at Kp = 10⁶, the digital loop stable at 20 and unstable at 20.0167.
- **B5 · Deadbeat, which only a sampled loop can do.** Place the closed-loop pole at
  the origin. That needs Kp = 9.50833, which is `α/(1 − α)`, and the output reaches
  its final value in exactly one sample. It settles 9.516 per cent short, because
  proportional control still leaves an error. Measured: the gain, the first six
  samples, and the steady-state error.
- **B6 · Emulation, and where it stops describing the loop.** A PI designed in s,
  substituted into z by the trapezoid rule, and run against the exactly discretised
  plant. The step disagrees with the continuous design by 0.51 per cent at 400
  samples per cycle, 10.8 per cent at 20, and 49.2 per cent at 4. The disagreement
  is proportional to the sample time, which is what a half-sample delay predicts.
  Measured: the disagreement at seven rates, its proportionality, and the guard's
  verdict at each.
- **B7 · Forward Euler, and the rule that does not hold.** The same lag emulated
  three ways. The trapezoid and backward rules map the left half plane inside the
  unit circle, so a stable controller stays stable. Forward Euler does not. A
  controller with τ = 10 ms emulates to an unstable difference equation for any
  sample time at or above 20 ms, which is `2τ`. Measured: the three verdicts at four
  sample times, and the bound.

### Group C: The phase plane (6)

Two states, two axes, and the whole life of the loop as one curve. The loop is the
first-order plant with a PI controller and a saturating actuator, so the states are
the integral of the error and the plant's output.

- **C1 · Two states, one picture.** The PI loop with the limit far above anything it
  asks for. The trajectory spirals into the resting point at (0.25, 1), and the step
  view shows the same run as a function of time. Measured: the trajectory equals the
  linear closed loop's to nine decimals, and the resting point matches the equations.
- **C2 · The switching lines.** Bring the limit down to 1.5. Two straight lines
  appear where the drive reaches its limit, at `4x₁ − 2x₂ = ±1.5`, and the field
  changes slope as the trajectory crosses one. Measured: the lines against `u(x)`,
  the field against `Ax + b` in each region, and every event landing on a line to
  1e-9.
- **C3 · Windup.** With the limit at 1.5 the peak rises from 1.079 to 1.174, and the
  integrator winds from 0.340 to 0.451. Tighten to 1.2 and the wind reaches 0.642,
  and at 1.05 it reaches 0.848. Measured: the peak and the wind at five limits, and
  the wind rising monotonically.
- **C4 · The rule that is false at the tight end.** Tighter limit, worse overshoot,
  is the obvious rule. At a limit of 1.05 the peak falls back to 1.05 while the wind
  keeps growing. The actuator now sets the approach speed, so the output arrives
  slowly and arrives with little overshoot. Measured: the peak at four limits, rising
  then falling, against the wind rising throughout.
- **C5 · An actuator with nowhere to rest.** The drive needed to hold the output at
  the reference is 1. Set the limit to 0.5 and no state of the loop is a resting
  point. The output stops at 0.5 and the integrator ramps at 0.5 per second, reaching
  10.5 at 20 s and 20.5 at 40 s. Measured: no real equilibrium, the final output at
  `Kδ`, and the wind at two times.
- **C6 · A Lyapunov argument.** For the linear region, `V = xᵀPx` with P from
  `AᵀP + PA = −I` gives `P = [[1.2083, −0.125], [−0.125, 0.2083]]`, whose eigenvalues
  are 1.224 and 0.193. Both are positive, so V is positive away from the origin, and
  `V̇ = −xᵀx` is negative. The pane draws the level sets and shades where the
  argument holds. Measured: P positive definite, `V̇` exactly `−xᵀx` at four points
  inside the region, V falling along the simulated trajectory, and `V̇` no longer
  `−xᵀx` outside.

### Group D: The describing function (5)

A saturation is not a rational function of s and never becomes one. What a
describing function does is replace it by the gain it would have for a pure sine.
This group is built so that the reader sees how far that gets, and how far it is
off.

- **D1 · The gain of a saturation depends on the amplitude.** `N(A) = 1` below the
  limit, falling as `(2/π)(arcsin r + r√(1 − r²))` above it. At A = 2δ it is 0.609,
  at 5δ it is 0.253, and at 20δ it is 0.0636. The third harmonic climbs the other
  way, from 6.5 per cent of the fundamental at 1.2δ to 33.2 per cent at 20δ. Measured:
  N and the harmonic ratio at four amplitudes, against a numerical Fourier integral.
- **D2 · The limit cycle it predicts.** Three lags with a saturating actuator. The
  loop reaches −180 degrees at √14 = 3.7417 rad/s, and its crossing gain is 11.25. At
  Kp = 20 the condition `N(A) = 1/|L|` gives N = 0.5625 and an amplitude of 2.1816.
  Measured: the frequency against `√((τ₁+τ₂+τ₃)/τ₁τ₂τ₃)`, the gain against 11.25, and
  N against `11.25/Kp`.
- **D3 · What the exact simulation says.** The same loop, walked region by region
  with no describing function in it. The measured amplitude is 2.211 at ω = 3.712
  rad/s, so the prediction is 1.33 per cent low in amplitude and 0.81 per cent high
  in frequency. The pane prints all four numbers and the difference. Measured: the
  discrepancy at five gains and limits, from 0.66 per cent at Kp = 15 to 2.27 per
  cent at Kp = 40.
- **D4 · The filter hypothesis, with its threshold.** The discrepancy is not an
  accident. It is the harmonic content the method threw away. At Kp = 20 the third
  harmonic returns at 1.43 per cent of the fundamental, and the amplitude is 1.33 per
  cent wrong. Across the sweep the ratio of those two numbers stays between 0.7 and
  1.5. Measured: that ratio at 16 fuzzed settings, and the threshold of five per cent
  it justifies.
- **D5 · Where the prediction is not usable.** Put a lightly damped resonance at
  three times the crossing frequency. The third harmonic now returns at 67.6 per
  cent of the fundamental, far above the threshold. The pane shows the reason instead
  of an amplitude. Measured: the ratio, the guard failing, and the message naming the
  threshold.

### Group E: Identification (5)

The plant nobody wrote down. A step goes in, a trace comes out, and a model is
fitted to it. The residual is the whole of the honesty in this group.

- **E1 · Fitting a first-order model.** A lag with K = 2.5 and τ = 0.8 s. The fit
  returns both to eight figures, with a relative residual of 3e-14. The pane draws
  the model over the data and the residual below. Measured: the two parameters and
  the residual.
- **E2 · Fitting a second order, and what a wrong order looks like.** A resonant
  plant with ωₙ = 3 rad/s and ζ = 0.35. The second-order fit returns all three
  parameters exactly. The first-order fit returns τ = 0.362 s and a residual of 13.4
  per cent of the gain, because a first-order model has no way to overshoot.
  Measured: both fits, both residuals, and their ratio of 6.4e-9.
- **E3 · Which order the data supports.** The same lag as E1, with noise at 1, 2 and
  5 per cent of the gain. The residual lands on the noise, at 1.03, 2.05 and 5.13 per
  cent. Adding a second pole takes 0.03 per cent off it, because there is nothing
  left for the extra pole to explain. Measured: both residuals at three noise levels,
  and the improvement staying above 0.999.
- **E4 · How much to trust the number.** Forty runs at each noise level. At 2 per
  cent the fitted time constant averages 0.7987 s against a true 0.8, with a spread
  of 0.0054 s. Halve the noise and the spread halves. Measured: the mean and the
  spread at three noise levels, and the proportionality.
- **E5 · Identify, then control.** Two lags at 0.7 s and 0.13 s. The second-order fit
  recovers both poles exactly, at −1.4286 and −7.6923. The first-order fit gives τ =
  0.875 s with a residual of 2.37 per cent, which looks small. Design a PI on each for
  a crossover at 8 rad/s. The design from the first-order fit predicts 92.4 degrees
  of phase margin and no overshoot, and on the real plant it gets 52.0 degrees and
  13.4 per cent. The design from the second-order fit predicts 48.3 degrees and 17.2
  per cent, and gets exactly that. Measured: both fits, both designs, and the four
  margins.

### Group F: The Kalman filter (5, two now)

The observer of Group A chose its gain by placing poles. The Kalman filter chooses
it from how much the measurement and the model are each worth. Decision 4 splits
this group.

Shipping now:

- **F1 · The observer that weighs its measurement.** The same motor and the same
  observer structure as A6, with the gain from a Riccati equation instead of a pole
  pair. The two weights are the trust in the model and the trust in the measurement,
  and their ratio is the only thing the gain depends on. Measured: the gain against
  the dual of A7's LQR, and the error poles it produces.
- **F2 · The filter is the regulator, backwards.** The gain solves the same equation
  as the LQR with A, B, Q and R replaced by their duals. The pane puts the two
  computations side by side. Measured: `L` from the filter equals `Kᵀ` from the
  regulator on the transposed system, to floating point.

Waiting on the Random Signals Lab, per Decision 4 and `BACKLOG.md`:

- **F3 · The covariance recursion.** How the estimate's uncertainty grows between
  measurements and shrinks at each one.
- **F4 · The steady state.** Why the recursion settles, and why a constant gain is
  usually enough.
- **F5 · The ensemble.** Many runs, and the spread of the estimate landing on the
  covariance the recursion predicted.

---

## 6. Hand-overs

- **← Control Lab.** The plants and the controllers are the same registry, and a
  reader arrives with the pictures. A deep link carries `plant` and `ctrl` in the
  grammar Control Lab already emits, so a loop built there opens here with a state
  space attached. Tested both ways.
- **← Signal Lab.** The z-plane and the sampling group are the prerequisite for
  Group B. The z-plane canvas is `packages/ui`'s and is shared, so the two labs draw
  the same picture from the same code.
- **→ Machines Lab.** The phase canvas, with the props of §4.3. The rotor's angle
  needs `periodic`, and that prop exists from the first commit.
- **→ Circuit Lab.** A2's RC and RLC are Circuit Lab's, and the state equation this
  lab writes has the poles Circuit Lab computes. Pinned in both directions.
- **↔ Random Signals Lab.** Group F's second half. The dependency is in
  `BACKLOG.md`, and no lesson text here names that lab until it is built.

---

## 7. Testing discipline

- **Unit** (`packages/systems`): every module against a closed form where one
  exists. The conversion against hand polynomials, the placement against a hand
  characteristic equation, the hold against `e^(−T/τ)`, the describing function
  against a numerical Fourier integral, the fits against the systems they were
  generated from.
- **Invariants** (§2.7), fuzzed. Ten of them, all green.
- **Experiments**: every number in §5 pinned in `experiments.test.js`, computed from
  the knobs. Among them 20.0167, 9.50833, 4.60 per cent, `[8, 1.8]`, `[20.4, 215.2]`,
  √2, 0.904837, 3.7417, 11.25, 0.5625, 2.1816, 2.211, 1.33 per cent, 67.6 per cent,
  13.4 per cent, 0.7987, −1.4286 and 52.0 degrees.
- **Guards**: the samples-per-cycle threshold, the harmonic threshold and the fit's
  residual, each tested at both sides.
- **Refusals**: the hold as a transfer function in s, the smooth nonlinearity, the
  ideal relay, the uncontrollable placement, the unobservable observer, and the plant
  with direct feedthrough. Each message is pinned by a test.
- **Cross-lab pins**: A2's circuit poles against Circuit Lab's, and the deep link
  from Control Lab round-tripping.
- **Playwright harness**, in `scripts/verify.mjs`. The phase canvas redraws when the
  limit moves. The guard banner appears below the threshold and not above. The fit
  view prints a residual for every dataset. No view scrolls sideways at 390 px.
- **`REVIEW_PLAYBOOK.md` audit** before release, all eleven classes, with a
  screenshot pass. Class 4 matters most here, because the phase plane's axes are two
  states and both need a name and a unit.

---

## 8. Integration and the dark launch

The mechanism the other labs share, unchanged.

- Deployed **dark** at `/control-lab-ii/` from the first vertical slice.
- `apps/control-lab-ii/RELEASE_STATUS` reads `dark`. `release.test.js` asserts that
  while it does, `site/index.html`, `README.md` and `packages/ui/src/LabNav.jsx`
  contain no reference to this lab. Flip the word to `released` and the same test
  demands all three.
- `.github/workflows/deploy.yml` needs one line,
  `cp -r apps/control-lab-ii/dist _site/control-lab-ii`. It is the director's, and it
  is recorded in `apps/control-lab-ii/NEEDS.md`.
- `packages/ui/src/progression.test.js` needs this lab's ids and counts. They are in
  `NEEDS.md` for the seams overseer.
- The flip is Reed's, after the gate in §9.

---

## 9. Phasing

Each phase ships green and deployable dark.

1. **The engine.** All six modules, ten invariants fuzzed green, before any UI
   exists. **Done.** Exit met.
2. **The app shell and Group A.** `RELEASE_STATUS`, `release.test.js`, the step and
   poles views, the state pane. Exit: A1 to A7 pinned, the shell at 390 px.
3. **Group B.** The z-plane view, the sampling section, the guard banner. Exit: B1
   to B7 pinned, the guard tested at both sides.
4. **Groups C and D.** The phase canvas with the props of §4.3, the nonlinearity
   section, the prediction pane. Exit: C1 to C6 and D1 to D5 pinned, the discrepancy
   on screen.
5. **Group E.** The fit view. Exit: E1 to E5 pinned, the residual on screen for
   every dataset.
6. **Group F's first half.** Exit: F1 and F2 pinned, F3 to F5 in `BACKLOG.md`.
7. **The release gate.** The full audit, the harness, the sittings, Reed's own pass
   against the dark deployment. Then the flip.

---

## 10. Non-goals

Stated so they are decisions rather than omissions.

- **Multi-input and multi-output.** Every plant in this suite has one drive and one
  measurement. A matrix-valued transfer function is not the currency `CORE_SCOPE.md`
  names, and no experiment here needs one.
- **Optimal control beyond the LQR.** The minimum principle and dynamic programming
  are a mathematics course. The LQR is the case with a closed form.
- **Robust control.** H-infinity and mu-synthesis need a norm this suite does not
  compute and a plant set it does not represent.
- **Model predictive control.** It needs an optimiser in the loop, and its lesson is
  about the optimiser rather than about the plant.
- **Adaptive control.** The DSP Lab's adaptive filter is the part of it with a
  picture, and it lives there.
- **A smooth nonlinearity in time.** Declined at the engine boundary, with the
  reason, and the refusal is tested.
- **The ideal relay.** Declined for its sliding mode. A relay with a finite slope is
  a saturation with a small limit, and that is in.
- **Continuous-time identification from arbitrary inputs.** The step is the
  measurement a reader can make and can see. Frequency-domain identification is the
  Instruments Lab's network analyser.
- **Discrete-time identification.** The same fits in z would need a second set of
  models for one extra lesson.
- **Nonlinear observers.** The extended Kalman filter linearises about a moving
  point, and its guard would be a moving target. Named here, not built.

---

## 11. Risks, named

- **The describing function reads as a defeat.** A whole group whose subject is how
  wrong an approximation is could read as a warning against using it. Mitigation:
  D4's measured relation between the harmonic ratio and the error, which turns the
  guard into a prediction. A reader who learns that the method is right to within the
  harmonic content has learned to use it.
- **The phase plane needs two states and most plants have three.** The three-lag
  plant of Group D has four states with its controller, so its phase plane is a
  projection. Mitigation: `phaseField` declines a loop with more than two states by
  name rather than guessing a projection, and Group C's loop has exactly two.
- **Ackermann's conditioning.** A badly conditioned controllability matrix loses
  digits, and A4 exists to show that happening. Mitigation: the placement invariant's
  tolerance scales with the condition number, and the app prints the condition beside
  the gain.
- **The sample time is a fourth knob.** Group B has a plant, a controller, a gain and
  a sample time, which is one more than Control Lab's reader is used to. Mitigation:
  the sampling section appears only in Group B, and the guard banner names the
  threshold whenever it is crossed.
- **Group F is half a group.** Two experiments now and three later reads as an
  unfinished chapter. Mitigation: F1 and F2 are the deterministic half and stand on
  their own, and the group's heading says what the other three wait for.
- **Numbers that are right for one plant.** Every number in §5 is for the defaults in
  §3. Mitigation: each pin is a function of the knobs and is re-derived in the test,
  never a constant typed in.
- **Cost.** Six engine modules and two new canvases. Mitigation: the engine is built
  and green, the phases are each shippable dark, and Groups A and B alone are a
  complete state-space and digital course.
