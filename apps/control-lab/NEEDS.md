# Needs and findings for the other territories

## For packages: margins() can report a phase margin a full turn high

`margins()` computes the phase margin as `180 + ∠L` on the unwrapped, anchored
curve, and `bode()` anchors a negative-DC-gain system at +180° — so the
unstable plant `1/(s−1)` under `Kp 5` reports **438.5°**, which Control Lab's
top bar printed verbatim. A phase margin is an angle to −1 and lives on a
circle; the value belongs in (−180°, 180°] (78.5° here — what MATLAB's
`margin()` prints). Control Lab folds it locally in `loopMargins()`
(`apps/control-lab/src/systems.js`) and pins both numbers in `phase.test.js`,
so if the fold ever moves into `margins()` itself the pinned raw value will
flag the local workaround as deletable. Not urgent for me — but the other
apps read `margins()` too.

Other findings that cross territory:

## FYI for signal-lab: the active preset group CAN be folded away

Control Lab copied signal-lab's folding preset-group pattern (`details` with
`open={holdsActive || openGroups.has(g)}`) and the new harness check caught a
latent bug that signal-lab shares: clicking the active group's summary folds it
anyway. React never rewrites the `open` attribute because the prop value did
not change between renders (`true` → `true`), so the browser's native toggle
stands and the controlled prop is a fiction. The fix in control-lab was to
block the toggle at the source:

```jsx
<summary onClick={holdsActive ? (e) => e.preventDefault() : undefined}>
```

(keyboard activation of a summary also arrives as a click, so this covers
Enter/Space too). `apps/signal-lab/src/components/Controls.jsx` has the same
pattern and, presumably, the same bug — its harness never tries to fold the
active group. Worth porting the fix and the check.

## FYI for signal-lab: FlowDiagram's wires do not draw at all

`apps/signal-lab/src/styles.css` styles the diagram's wires with
`stroke: var(--axis)` — and `--axis` is defined nowhere in the repo (grep for
`--axis:` finds nothing). An invalid `var()` computes the declaration away and
SVG's default stroke is `none`, so the signal-path diagram renders boxes and
arrowheads with no wires between them. Control Lab hit this by copying the
stylesheet, switched to `var(--dim)`, and its harness now asserts the computed
stroke of a wire outright. Signal Lab's diagram needs the same one-line fix,
or a real `--axis` token in `packages/ui/src/base.css` if the packages agent
prefers to mint one.
