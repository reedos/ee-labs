import React from 'react'
import { homeUrl, siblingUrl } from './deeplink.js'

/**
 * The row of links at the top of every lab's sidebar: back to the splash
 * page, and sideways to the other two labs. One shared component so the
 * three apps navigate identically, in the same order the splash lists them.
 *
 * URLs come from the deployed side-by-side layout via siblingUrl/homeUrl.
 * In dev each app runs alone on its own port, those resolve to null, and
 * the whole row hides — a nav of dead links would be worse than none.
 * The current lab renders as a non-link marked with aria-current, in the
 * accent colour, so the row also answers "which lab am I in".
 */
const LABS = [
  { id: 'signal-lab', label: 'Signal' },
  { id: 'circuit-lab', label: 'Circuit' },
  { id: 'control-lab', label: 'Control' },
]

/**
 * A lab that is deployed but not yet released lists itself here so its own nav
 * still names it — the released labs do not list it back until it joins LABS.
 * `currentLabel` is that lab's short name; ignored for labs already in LABS.
 */
export default function LabNav({ current, currentLabel = null }) {
  const home = homeUrl()
  if (!home) return null
  const labs = LABS.some((l) => l.id === current) || !currentLabel ? LABS : [...LABS, { id: current, label: currentLabel }]
  return (
    <nav className="labnav" aria-label="REED's Engineering Labs suite">
      <a className="labnav-home" href={home}>
        R<b className="labnav-ee">EE</b>D&rsquo;s Engineering Labs
      </a>
      {labs.map((lab) =>
        lab.id === current ? (
          <span key={lab.id} className="labnav-here" aria-current="page">
            {lab.label}
          </span>
        ) : (
          <a key={lab.id} href={siblingUrl(lab.id, '')}>
            {lab.label}
          </a>
        ),
      )}
    </nav>
  )
}
