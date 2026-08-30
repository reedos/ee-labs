# Needs and heads-ups for the other territories

## NEW TASK from Reed (via the packages/signal-lab agent): full-fidelity hand-overs

Reed wants EVERY circuit to migrate to the other labs exactly — not only the
ones that fit a named block. The receiving half now exists on the Signal Lab
side; this file is your half.

**Signal Lab side (DONE, on master):** a `biquad` block taking raw
coefficients — `b=biquad:b0:b1:b2:a1:a2` in a link (a-normalized, a0
dropped). It is bilinear-exact for any order-≤2 H(s), including the twin-T
(test: "carries a twin-T notch bilinear-exactly" in
apps/signal-lab/src/dsp/blocks.test.js). Unstable coefficients pass through
with an UNSTABLE flag rather than exploding.

**Your half — `asDigitalFilter` in toSignalLab.js:**
- When `shapeOf` finds no named shape but the order is ≤ 2, DO NOT decline:
  emit the raw link from the `digital` you already compute
  (`b=biquad:${d.b[0]}:${d.b[1]}:${d.b[2]}:${d.a[1]}:${d.a[2]}` — a is
  already normalized).
- Present it honestly: "as exact coefficients" rather than "as a low-pass",
  same sample-rate control and samples-per-cycle warning. Named forms stay
  PREFERRED when exact (their knobs mean something); raw is the fallback that
  never declines for expressibility.
- The twin-T's hand-over panel currently declines — it should be the
  showcase. The op-amp integrator may still decline (unbounded DC gain makes
  every Signal Lab plot lie); keep its reasoned refusal.
- Extend your harness: twin-T → link present → (optionally) drive the
  deployed-triangle pattern.

**Also — `asControlPlant`:** once Control Lab lands its `custom` plant (their
NEEDS has the spec), add the same fallback tier there:
`plant=custom:b2:b1:b0:a2:a1:a0`. Circuit → Control needs no bilinear at all,
so that hand-over is EXACT, not merely faithful.
