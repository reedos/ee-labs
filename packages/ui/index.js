// Shared controls and plot chrome.
//
// The pieces every tool in the suite needs to look and behave alike: typeable
// numeric entry with engineering units, canvas plumbing, and axis drawing that
// scales with the canvas rather than assuming 1080p.

export { default as NumField } from './src/NumField.jsx'
export { useCanvas } from './src/useCanvas.js'
export { default as PoleZeroCanvas } from './src/PoleZeroCanvas.jsx'
export { COLORS, plotScale, plotArea, niceStep, drawFrame } from './src/plot.js'
export { POS_MAX, clamp, toPos, fromPos, snap, near } from './src/scale.js'
export { eng, fmt, parseEng, dbToLin, linToDb, dbToAmp, ampToDb } from './src/units.js'
export { fmtHz, fmtDb } from './src/format.js'
export { buildLink, parseLink, readLocationLink } from './src/deeplink.js'
