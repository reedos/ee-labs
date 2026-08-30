# EE Labs

Interactive tools for the signals half of an electrical engineering curriculum. Each one
shows a signal, what it is made of, and what happens when you put something in the way —
and explains, next to every number, where that number came from.

```
npm install
npm test                 # every package and every app (203 tests)
npm run dev              # Signal Lab, at http://localhost:1421
```

## The tools

| | covers | status |
|---|---|---|
| **[apps/signal-lab](apps/signal-lab/)** | Signals & Systems, DSP, mixed-signal | 23 lessons |
| **[apps/circuit-lab](apps/circuit-lab/)** | circuits, impedance, resonance, active filters | 9 circuits |
| **Control Lab** | feedback, stability, transient response | planned |

A third tool, [`waveform-simulator`](https://github.com/reedos/waveform-simulator), covers
communications and high-speed optical links. It lives outside this repo: it serves
practising engineers rather than students, it is mature, and retrofitting it onto these
packages would be work without a reader to benefit from it.

## Why these boundaries

The split is **not** by curriculum topic. It is by interaction model, because that is what
actually forces a separate codebase.

Signal Lab's model is `sources → chain → time + spectrum`. Anything that fits that shape
belongs in it whichever course teaches it — FIR filters, z-plane views, group delay,
statistics of noise are all extensions, not new apps.

Circuit Lab is a different shape again: a network, not a chain, whose output is H(s)
rather than a waveform. But it is also the bridge. One series RLC is simultaneously a
circuit you could buy the parts for, a filter with a Q, a second-order plant with a
damping ratio, and — through the bilinear transform — the same biquad Signal Lab ships.
Same object, four vocabularies, which is the thing a suite can show and a single app
cannot.

A feedback loop does not fit that shape. It needs a summing junction, a plant and a
controller as distinct roles, and its characteristic plots — Bode, Nyquist, root locus —
describe a loop transfer function whose key readouts are gain and phase margin. Forcing
that into a linear chain would damage both tools, so Control Lab is separate.

## The packages

```
packages/dsp       generation, transforms, filters, the chain
packages/systems   transfer functions: Bode, poles, step response, stability
packages/ui        numeric entry, plot chrome, the shell
packages/explain   the math panel, and the discipline behind it
```

**`@ee-labs/systems`** is the currency the suite trades in. A circuit produces a transfer
function; so does a control loop; a digital filter is one after a change of variable. So
frequency response, root finding, step response and stability are written once, and each
tool describes only its own subject before handing the analysis over. It is what makes
Control Lab cheap to build now that Circuit Lab exists.

**`@ee-labs/dsp`** knows nothing about any application's blocks. `createChain(registry)`
binds the chain machinery to whatever blocks a tool defines and returns the functions
bound to it. `packages/dsp/src/portable.test.js` exercises the whole chain against a
registry invented inside the test — a leaky integrator, a squarer — so an app-specific
assumption creeping back in fails immediately rather than when a second app is written.

**`@ee-labs/ui`** is what makes two tools feel like one suite: typeable numeric entry with
engineering units and preset chips, axis drawing that scales with the canvas instead of
assuming 1080p, and a shell whose page never scrolls so both plots always fit.

**`@ee-labs/explain`** is the least obvious and the most valuable. It carries two rules:

- A two-column *theory vs measured* comparison appears only when the measured side is
  genuinely read off something the tool is showing. Anything else is a derived value with
  no tick, because marking 1 = 1 correct teaches a reader to trust a tick that carries no
  information — including on the rows beside it where it does.
- A claim the current settings make unmeasurable is footnoted with the reason, never
  crossed out. The formula has not stopped being true; this configuration cannot see it.

`@ee-labs/explain/testing` holds every tool to that standard, including `inertRows`, which
perturbs what a panel measures from and fails any check row that does not move.

That discipline is not decoration. It has caught, so far: a square-wave generator putting
17 samples high and 15 low in every period; a pre-roll bug that made a filtered square
miss its own response curve by 10%; thirteen rows that printed one number twice and always
agreed; and four confidently wrong explanations, including the claim that Q = 0.707 does
not overshoot — it overshoots 4.3%, and critical damping is Q = 0.5.

## Working here

npm workspaces, no build step for the packages — apps import their source and Vite handles
it. Tests for a package live beside it; tests for an app's own content live in the app.

```
npm test                                   # everything
npx vitest run packages/dsp                # one package
npm run build --workspace apps/signal-lab
```

Each app also has `npm run verify`, which drives the built app in a real browser: loads
every preset, opens every panel, sweeps parameters, and checks that the numbers on screen
and the canvas pixels both follow. It needs a server (`npm run preview`) and catches the
wiring mistakes unit tests cannot — a prop not passed, a panel fed stale state, a plot that
quietly stopped redrawing.
