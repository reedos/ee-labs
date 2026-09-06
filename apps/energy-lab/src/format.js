// Numbers as a reader should see them, on top of @ee-labs/ui's `fmt`.
//
// This lab holds microamps and kilojoules in the same panel, so the shared
// engineering formatter already does the heavy lifting; what is added here is
// the same relative-dust guard Power Lab found necessary, and a couple of
// axis helpers the canvases share.

import { fmt, niceStep } from '@ee-labs/ui'

/** Below a billionth of `scale`, a value is the arithmetic's own residue. */
export function nz(value, scale) {
  if (!Number.isFinite(value)) return value
  const s = Math.abs(scale)
  return s > 0 && Math.abs(value) < 1e-9 * s ? 0 : value
}

/** `fmt`, with dust relative to `scale` snapped to zero first. */
export function fmtz(value, unit, sig, scale) {
  return fmt(nz(value, scale), unit, sig)
}

/** A round tick step for an axis spanning `range`, aiming for about `target` ticks. */
export { niceStep }
