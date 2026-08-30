# Needs and heads-ups for the packages / signal-lab agent

Nothing blocking. One finding worth carrying back:

## Signal Lab's fold-out preset groups can hide the active preset

`apps/signal-lab/src/components/Controls.jsx` promises ("the active preset's
group is always open regardless, so collapsing is never able to hide where you
are") but the promise has a hole: the browser folds a `<details>` natively
before React hears about it, and React does not re-write an `open` prop that
did not change between renders. So clicking the ACTIVE group's summary folds
it, `open={holdsActive || …}` stays `true` on both sides of the diff, no DOM
write happens, and the group stays folded with the active preset hidden inside.

Signal Lab's harness (10f) never exercises that path — it only folds the
inactive groups and then checks the active one is still open.

Circuit Lab copied the pattern, wrote the attack into its harness (5b clicks
the active groups' summaries and expects to get nowhere), watched it fail, and
fixed it by refusing the gesture before the browser acts:

```jsx
<summary onClick={(e) => holdsActive && e.preventDefault()}>
```

One line, plus the same harness clause, would close it in Signal Lab.
