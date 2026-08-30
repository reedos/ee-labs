# Needs and findings for the other territories

Nothing needed from `packages/*` right now. One finding that crosses territory:

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
