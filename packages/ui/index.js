// Shared controls and plot chrome.
//
// The pieces every tool in the suite needs to look and behave alike: typeable
// numeric entry with engineering units, canvas plumbing, and axis drawing that
// scales with the canvas rather than assuming 1080p.

export { default as NumField } from './src/NumField.jsx'
export { useCanvas } from './src/useCanvas.js'
export { default as PoleZeroCanvas } from './src/PoleZeroCanvas.jsx'
export { default as ZPlaneCanvas } from './src/ZPlaneCanvas.jsx'
export { default as TimingCanvas, rowsOf, heightOf, geometryOf, busAt } from './src/TimingCanvas.jsx'
export { default as StateCanvas, layoutOf, sceneOf } from './src/StateCanvas.jsx'
export { COLORS, plotScale, plotArea, niceStep, drawFrame } from './src/plot.js'
export { niceBounds, traceExtent, scopeRange, anchoredRange } from './src/anchor.js'
export { POS_MAX, clamp, toPos, fromPos, snap, near } from './src/scale.js'
export { eng, fmt, parseEng, dbToLin, linToDb, dbToAmp, ampToDb } from './src/units.js'
export { fmtHz, fmtDb, fmtNum } from './src/format.js'
export { buildLink, parseLink, readLocationLink, siblingUrl, homeUrl } from './src/deeplink.js'
export { buildCircuitLink, parseCircuitLink, readCircuitLink, labUrl } from './src/circuitLink.js'
export { default as LabNav } from './src/LabNav.jsx'
export { default as Schematic } from './src/Schematic.jsx'
export { default as OneLineCanvas, branchGeometry, balanceRows, tintOf } from './src/OneLineCanvas.jsx'
export * as schematicGeometry from './src/schematicGeometry.js'
export { default as ReportIssue, reportUrl, issueBody } from './src/ReportIssue.jsx'
export { track, handOverEvent, arrivalEvent, GOATCOUNTER_ENDPOINT } from './src/analytics.js'
export { default as LessonNav } from './src/LessonNav.jsx'
export { default as TryLine } from './src/TryLine.jsx'
