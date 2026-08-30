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
