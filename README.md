# REED's Engineering Labs

**Live at [reedos.github.io/ee-labs](https://reedos.github.io/ee-labs/).** Nothing to install. MIT licensed.

Interactive tools for an electrical engineering curriculum, from circuits built out of
their elements to the signals half.
Each one shows a signal, the parts it is made of, and what a circuit or a filter
does to it. Beside every number it shows where that number came from.

The tools are aimed at undergraduate coursework. A textbook gives equations, a
worked example, and a static figure. These give the same content with the
controls attached, so a parameter can be changed and every view updates at once.
Change Q in the series RLC and the resonance moves in the frequency response, on
the z-plane, and in the ringing of the step response together. One RLC network
is algebra, a set of components, and a curve, and the suite shows the three as
the same object.

```
npm install
npm test                 # every package and every app, one run
npm run dev              # Signal Lab, at http://localhost:1421
```

## The tools

| | covers | status |
|---|---|---|
| **[apps/circuit-elements-lab](apps/circuit-elements-lab/)** | circuit laws, network theorems, op-amps, diodes, transients, state equations, phasors | **[Live — 58 experiments](https://reedos.github.io/ee-labs/circuit-elements-lab/)** |
| **[apps/signal-lab](apps/signal-lab/)** | Signals & Systems, DSP, mixed-signal | 35 experiments |
| **[apps/circuit-lab](apps/circuit-lab/)** | circuits, impedance, resonance, active filters, tolerance | 16 experiments, 10 circuits |
| **[apps/control-lab](apps/control-lab/)** | feedback, margins, transient response, disturbance rejection | 13 experiments, 7 plants x 4 controllers |

[**Open Circuit Elements Lab**](https://reedos.github.io/ee-labs/circuit-elements-lab/)
to work from Kirchhoff's laws through RC, RL and RLC circuits. Each experiment
explains which solution routes apply, with advantages and tradeoffs. Worked
LaTeX derivations show the substitutions and steps for circuit equations, state
equations and phasors wherever supported. Notation guides define the symbols;
the route notes distinguish an instantaneous circuit solution, time evolution
with initial conditions, and sinusoidal steady state.

A separate tool, `waveform-simulator`, covers communications and high-speed optical
links. It is in a separate private repository. It serves practising engineers
rather than students, it is already mature, and porting it onto these packages
would take work that no reader of this repository would benefit from.

## The experiments

Each tool opens with a grouped **Try this** list. An entry loads a setup and asks
a question. Every claim its note makes is rendered on screen and measured by a
test. A note whose number drifts fails the suite instead of misleading a reader
who has no way to check it.

## The bridges

Circuit Lab has a **The same filter, sampled** panel. Load the series RLC and the
panel reports a low-pass biquad at 5.033 kHz with a Q of 3.162, and gives a link:

    #rate=192000&src=square:1000:0.8&b=lowpass:5032.92:3.16228&zoom=40263.4

Paste that after Signal Lab's URL to load the same filter there. It arrives with
a square wave running through it and the spectrum zoomed, so the corner is on
screen. The resonance and the Q are the ones the circuit has, not an
approximation of them.

The tests check the crossing. They take a circuit, build the link, parse it back,
and design the biquad Signal Lab would design. The two responses must agree at
the corner and stay close either side of it. They are not identical, and the
tests record why. Signal Lab designs an RBJ cookbook section directly in the
digital domain from (mode, f₀, Q). It is not the bilinear transform of that
particular network. The two agree on what a second-order section with that
resonance and that Q is.

The panel maps in two tiers. A circuit that is exactly a named shape hands over
as (mode, f₀, Q), so the knobs mean something on arrival. Anything else that is
rational of order ≤ 2 hands over as raw coefficients and migrates just as
exactly. That covers a first-order RC and a two-pole network with no standard
name. Two cases are refused with a stated reason. The op-amp integrator's pole at
the origin is one, because a sampled copy of it would only count upwards. A
sample rate leaving fewer than twenty samples per cycle at the corner is the
other, and it warns before the link is cut.

The same panel offers a third destination. The RLC is also a plant to control:

    #plant=secondOrder:1:31622.8:0.158114&ctrl=p:1

Open that in Control Lab and the question changes. It is no longer what the
circuit does to a signal, but how much gain a loop can close around it before it
oscillates. This hand-over is two-tier as well: a named plant when one fits
exactly, and the raw six-coefficient `custom` plant otherwise. Measured across R
or L, the numerator carries zeros that no named plant has, so those outputs cross
as the exact polynomials instead. A plant that was nearly right would produce
margins that are wrong without saying so. The raw tier exists for that reason,
rather than a nearest named fit.

## Why these boundaries

The split is not by curriculum topic. It is by interaction model, because that is
what forces a separate codebase.

Signal Lab's model is `sources → chain → time + spectrum`. Anything that fits
that shape belongs in it, whichever course teaches it. FIR filters, z-plane
views, group delay and noise statistics are all extensions of it rather than new
apps.

Circuit Lab's model is a network rather than a chain, and its output is H(s)
rather than a waveform. It is also the bridge between the three. One series RLC
is a circuit with buyable parts, a filter with a Q, a second-order plant with a
damping ratio, and the biquad Signal Lab ships.

A feedback loop fits neither model, which is why Control Lab is its own app. It
needs a plant and a controller as distinct roles. Its plots (Bode with margins,
Nyquist, root locus) describe a loop transfer function, and their readouts
measure distance from the point −1.

The other boundary is mathematical, and [CORE_SCOPE.md](CORE_SCOPE.md) governs
it. The shared core trades only in exact rational transfer functions. Every
bridge either maps exactly, guards a stated approximation, or refuses with a
tested reason. Per app, today:

- **Circuit Elements Lab.** Admissible: every DC and AC network the schematic can
  draw, solved by modified nodal analysis, and the first-order and second-order
  transients, solved by the exact propagator rather than stepped. Guarded: the
  diode's four models, each stating where it holds. Refused: the circuits a first
  course calls ill-posed, with the reason on the panel. A loop of sources that
  disagree, a cut-set of current sources, an ideal op-amp with no feedback, and the
  exponential diode in the time domain. Live at
  [circuit-elements-lab/](https://reedos.github.io/ee-labs/circuit-elements-lab/).
- **Signal Lab.** Admissible: every block. Biquads, cascades, FIRs and combs are
  exact rational H(z), and the nonlinear blocks report that they have no H at
  all. Guarded: the sampled view of a continuous circuit. The bilinear transform
  is exact at the pre-warped corner and drifts away from it, and the
  twenty-samples-per-cycle warning is the guard on that drift. Refused: none. The
  raw-coefficient biquad accepts anything rational of order ≤ 2, and reports
  UNSTABLE rather than diverging when given poles outside the unit circle.
- **Circuit Lab.** Admissible: every circuit, as exact rational H(s) derived on
  the panel. Guarded: hand-over coefficients that would exceed the receiving
  knobs warn before the link is cut. Refused: the op-amp integrator's hand-over
  to Signal Lab, for unbounded DC gain, with the reason on the panel and under
  test.
- **Control Lab.** Admissible: every plant and controller, and any circuit
  arriving as one, exactly, since no transform is involved. Guarded: ζ ≈ PM/100
  is labelled a rule of thumb and states its preconditions. Refused: a margin
  that does not exist is shown as a dash with the reason, such as "gain never
  reaches 1", and is never estimated.

## The packages

```
packages/dsp       generation, transforms, filters, the chain
packages/systems   transfer functions: Bode, poles, step response, stability
packages/ui        numeric entry, plot chrome, the shell
packages/explain   the math panel and the rules it follows
```

**`@ee-labs/systems`** holds what the three tools share. A circuit produces a
transfer function, a control loop produces a transfer function, and a digital
filter is one after a change of variable. Frequency response, root finding, step
response and stability are therefore written once, and each tool describes its
own subject before handing the analysis over. It is why Control Lab was cheap to
build after Circuit Lab.

**`@ee-labs/dsp`** does not depend on any application's block set.
`createChain(registry)` binds the chain machinery to whatever blocks a tool
defines, and returns the functions bound to it. `packages/dsp/src/portable.test.js`
runs the whole chain against a registry invented inside the test: a leaky
integrator and a squarer. An app-specific assumption therefore fails at once,
rather than when a second app is written.

**`@ee-labs/ui`** is what makes the tools behave alike. It holds typeable numeric
entry with engineering units and preset chips, and axis drawing that scales with
the canvas instead of assuming 1080p. Its shell does not scroll the page, so both
plots stay on screen.

**`@ee-labs/explain`** carries the math panel and two rules:

- A two-column *theory vs measured* comparison appears only when the measured
  side is read off something the tool is showing. Anything else is a derived
  value and gets no tick. A tick on 1 = 1 teaches a reader to discount the ticks
  beside it that do carry information.
- A claim the current settings cannot measure is footnoted with the reason, and
  is never crossed out. The formula still holds. This configuration cannot show
  it.

`@ee-labs/explain/testing` holds every tool to those rules. It includes
`inertRows`, which perturbs what a panel measures from and fails any check row
that does not move.

## Working here

npm workspaces, and no build step for the packages: apps import their source and
Vite handles it. Tests for a package live beside it, and tests for an app's own
content live in the app.

```
npm test                                   # everything
npx vitest run packages/dsp                # one package
npm run build --workspace apps/signal-lab
```

Each app also has `npm run verify`, which drives the built app in a real browser.
It loads every preset, opens every panel, sweeps parameters, and checks that the
on-screen numbers and the canvas pixels both follow. It needs a server
(`npm run preview`). It catches the wiring mistakes unit tests cannot: a prop not
passed, a panel fed stale state, a plot that has stopped redrawing.
