import React, { useMemo } from 'react'
import { workedState } from '../workedState.js'
import { workedPhasor } from '../workedPhasor.js'
import { WorkedDerivation } from './WorkedDerivation.jsx'

export function WorkedState({ x }) {
  const work = useMemo(() => workedState(x), [x])
  return <WorkedDerivation role="worked-state" title="Work through the state equation" intro="From the capacitor and inductor laws to the slopes, roots and time response of this circuit." steps={work.steps} />
}
export function WorkedPhasor({ exp, x }) {
  const work = useMemo(() => workedPhasor(exp, x), [exp, x])
  return <WorkedDerivation role="worked-phasor" title="Work through the phasors" intro="From the source sinusoid to impedances, current, voltage arrows and the waveforms they draw." steps={work.steps} />
}
