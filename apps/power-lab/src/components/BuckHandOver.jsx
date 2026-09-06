import React from 'react'
import { fmtHz } from '@ee-labs/ui'
import { buckHandOverLink } from '../handover.js'

/**
 * → Control Lab: the buck's averaged small-signal plant, as a labelled
 * `custom` H(s) (CORE_SCOPE.md's own worked example — admitted, not a fake
 * identity, with the fs/5 guard the core scope specifies). Modelled on
 * apps/circuit-lab/src/components/HandOver.jsx: the explanation and the
 * guard are content and always render; only the outbound link depends on
 * the deployed layout, and is absent rather than a dead paste-fallback when
 * it does not resolve (packages/ui's own siblingUrl, which now recognises
 * power-lab as a link source — see handover.js).
 *
 * Rendered inside a closed `<details>` in App.jsx, so it costs nothing to
 * the fold budget the rest of the sidebar is held to.
 */
export default function BuckHandOver({ x }) {
  const { plant, url } = buckHandOverLink(x.p)
  return (
    <div className="handover" data-role="buck-handover">
      <h3 className="handover-dest">→ Control Lab · the buck, averaged</h3>
      {plant.refused ? (
        <p className="hint warn" data-role="handover-refused">
          Declined. The LC corner, {fmtHz(plant.f0)}Hz, already sits at or past the f_s/5 guard,{' '}
          {fmtHz(plant.fsGuard)}Hz. The averaging this plant depends on has nothing left to be slow
          compared to. Raise f_s, or L·C, before handing it over.
        </p>
      ) : (
        <>
          <p className="hint">
            The same L, C and R are a second-order plant, G_vd(s) = V_in / (1 + s/(Qω₀) + s²/ω₀²),
            linearised about this operating point. Q is {plant.Q.toFixed(3)}, ω₀/2π is{' '}
            {fmtHz(plant.f0)}Hz. It crosses as the raw coefficients Control Lab's custom plant
            reduces to: exact for the averaged model, not for the switching itself.
          </p>
          <p className="hint warn" data-role="handover-guard">
            Valid only while a loop closed around it keeps its crossover below f_s/5 ={' '}
            {fmtHz(plant.fsGuard)}Hz. The LC corner alone already sits at {fmtHz(plant.f0)}Hz.
          </p>
          {url ? (
            <a className="preset handover-copy" href={url} target="_blank" rel="noopener" data-role="handover-link">
              Open in Control Lab →
            </a>
          ) : null}
        </>
      )}
    </div>
  )
}
