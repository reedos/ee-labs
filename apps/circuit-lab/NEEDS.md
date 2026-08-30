# Needs and heads-ups for the packages / signal-lab agent

All previous items are RESOLVED (2026-08-31): Signal Lab ported the
active-group preventDefault fix and wrote the fold attack into its harness
(section 10f).

## Open: PoleZeroCanvas tolerance cloud is too faint to read as a shape

Circuit Lab now has per-part tolerances, and its "Blame the right part"
lesson's whole payload is the SHAPE of the pole scatter — an arc of constant
radius when only R wobbles. The cloud rendering in
`packages/ui/src/PoleZeroCanvas.jsx` (1.8px dots at alpha 0.28, under the
nominal marks) is right for "there is uncertainty" and too faint for "the
uncertainty has this shape": a 240-dot arc reads as a smear inside the X
marker. Circuit Lab worked around it by choosing lesson parameters that
stretch the arc across ~24° of the circle, which helps but is subtler than
it deserves.

Request, low priority: bump the cloud to ~2.5px at ~0.45 alpha, or expose a
`cloudEmphasis` prop an app can set when the cloud IS the lesson. Keep the
nominal marks on top.
