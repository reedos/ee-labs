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

export default function LabNav({ current }) {
  const home = homeUrl()
  if (!home) return null
  return (
    <nav className="labnav" aria-label="Reed's Labs suite">
      <a className="labnav-home" href={home}>
        R<b className="labnav-ee">ee</b>d&rsquo;s Labs
      </a>
      {LABS.map((lab) =>
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
