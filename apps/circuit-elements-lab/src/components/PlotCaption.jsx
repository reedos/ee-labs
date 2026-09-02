import React from 'react'
import { captionText } from '../captions.js'

/**
 * The sentence under a plot (captions.js): what the picture says, in words,
 * with every number the plot shows set in bold. On a phone this is where the
 * values live — the frame there is too narrow to pin them beside the cursor.
 */
export default function PlotCaption({ parts }) {
  if (!parts || !parts.length) return null
  return (
    <p className="plot-caption" data-role="caption" aria-label={captionText(parts)}>
      {parts.map((p, i) =>
        typeof p === 'string' ? (
          <React.Fragment key={i}>{p}</React.Fragment>
        ) : (
          <b key={i} data-kind={p.kind}>
            {p.print}
          </b>
        ),
      )}
    </p>
  )
}
