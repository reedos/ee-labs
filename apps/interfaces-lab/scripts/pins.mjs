import { analyse, DEFAULTS } from '../src/pin.js'
for (const drive of ['push-pull', 'open-drain']) {
  const x = analyse({ ...DEFAULTS, drive })
  console.log(JSON.stringify({ drive, tau: x.rise.segments[0].tau, tr: x.rise.tr, tf: x.fall.tf,
    tpLH: x.rise.tpLH, thresholds: x.thresholds, budget: x.budget, margins: x.margins }, null, 2))
}
