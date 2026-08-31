# REED's Engineering Labs

**Live at [reedos.github.io/ee-labs](https://reedos.github.io/ee-labs/)** — nothing to install. MIT licensed.

Interactive tools for the signals half of an electrical engineering curriculum. Each one
shows a signal, what it is made of, and what happens when you put something in the way —
and explains, next to every number, where that number came from.

```
npm install
npm test                 # every package and every app, one run (500+ tests)
npm run dev              # Signal Lab, at http://localhost:1421
```

## The tools

| | covers | status |
|---|---|---|
| **[apps/signal-lab](apps/signal-lab/)** | Signals & Systems, DSP, mixed-signal | 33 experiments |
| **[apps/circuit-lab](apps/circuit-lab/)** | circuits, impedance, resonance, active filters, tolerance | 15 experiments, 10 circuits |
| **[apps/control-lab](apps/control-lab/)** | feedback, margins, transient response, disturbance rejection | 13 experiments, 7 plants x 4 controllers |

A third tool, `waveform-simulator`, covers communications and high-speed optical links.
It lives outside this repo, in a private one: it serves practising engineers rather than
students, it is mature, and retrofitting it onto these packages would be work without a
reader to benefit from it.

## The experiments

Each tool opens with a grouped **Try this** list. Every entry is an experiment, not a
lesson plan: it loads a setup and poses a question, and every claim its note makes is
rendered and measured by a test — including
the numbers quoted in prose, which are the ones that drift when a default changes and
nobody notices.

That is not a style preference. It has caught nine confidently wrong explanations so
far. A Control Lab note promised a step overshooting "about 45%" and the setup it loaded
overshot 57%; a Circuit Lab note claimed ±5% parts move f₀ by "about half the part
tolerance", and its own test measured 4.3% — the square root halves each PART'S error,
but two parts contribute, and the note now says what is true.

## The bridges

Circuit Lab has a **The same filter, sampled** panel. Load the series RLC, and it says the
circuit is a low-pass biquad at 5.033 kHz with a Q of 3.162 — then gives you a link:

    #rate=192000&src=square:1000:0.8&b=lowpass:5032.92:3.16228&zoom=40263.4

Paste that after Signal Lab's URL and the same filter is loaded there, with a square wave
running through it and the spectrum zoomed so the corner is on screen when you arrive. Not
a similar filter: the same resonance and the same Q, carried across.

That is the argument for a suite rather than three separate tools, made checkable instead
of asserted. It is checked, too — the tests take a circuit, build the link, parse it back,
design the biquad Signal Lab would design, and require the two responses to agree: exactly
at the corner, and within 1% two octaves either side. They are not identical, and the
tests say why. Signal Lab designs an RBJ cookbook section directly in the digital domain
from (mode, f₀, Q); it is not the bilinear transform of that particular network. The two
agree on what a second-order section with that resonance and Q *means*.

The panel maps in two tiers. A circuit that is exactly a named shape hands over as
(mode, f₀, Q), so the knobs on arrival mean something; anything else that is rational of
order ≤ 2 — a first-order RC, a shapeless two-pole — hands over as raw coefficients and
migrates just as exactly. What remains refused is refused for stated reasons: the op-amp
integrator's pole at the origin (a sampled copy would just count), and a sample rate
leaving fewer than twenty samples per cycle at the corner warns before the link is cut.

The same panel offers the third corner. That RLC is also **something to control**:

    #plant=secondOrder:1:31622.8:0.158114&ctrl=p:1

Open that in Control Lab and the question changes from what the circuit does to a signal
into how much gain you can close around it before it sings. Same network, three subjects.
This hand-over is two-tier like the other: a named plant when one fits exactly, and the
raw six-coefficient `custom` plant otherwise — measured across R or L the numerator
carries zeros no named plant has, so those outputs cross as the exact polynomials
instead. Nothing is approximated either way: a plant that was nearly right would
produce margins that are confidently wrong, which is why the raw tier exists rather
than a nearest named fit.

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

A feedback loop does not fit that shape either, which is why Control Lab is its own app.
It needs a plant and a controller as distinct roles, and its characteristic plots — Bode
with margins, Nyquist, root locus — all describe a *loop* transfer function whose key
readouts are how far it sits from the single point −1.

The other boundary is mathematical, and it is governed by [CORE_SCOPE.md](CORE_SCOPE.md):
the shared core trades **only in exact rational transfer functions**, and every bridge
either maps exactly, guards its stated approximation, or refuses with a tested reason.
Per app, today:

- **Signal Lab** — admissible: every block (biquads, cascades, FIRs, combs are exact
  rational H(z); the nonlinear blocks are honest about having no H at all). Guarded
  approximation: the sampled view of a continuous circuit — the bilinear transform is
  exact at the pre-warped corner and drifts away from it, and the
  twenty-samples-per-cycle warning is the guard on that drift. Refused: none — the raw-coefficient
  biquad receives anything rational of order ≤ 2, and says UNSTABLE rather than
  diverging when handed poles outside the circle.
- **Circuit Lab** — admissible: every circuit (exact rational H(s), derived on the
  panel). Guarded: hand-over coefficients that would exceed the receiving knobs warn
  before the link is cut. Refused: the op-amp integrator's hand-over to Signal Lab
  (unbounded DC gain — a sampled copy would just count), with the reason on the panel
  and under test.
- **Control Lab** — admissible: every plant and controller, and any circuit arriving
  as one (exact — no transform is involved). Guarded: ζ ≈ PM/100 is quoted as a rule
  of thumb with its preconditions. Refused: margins that do not exist are shown as
  "—" with the reason ("gain never reaches 1"), never invented.

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
