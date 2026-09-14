import React from 'react'
import { ChipContext } from '@ee-labs/explain'
import { TERMS } from './terms.js'

export const INVERTER_USE = 'Inverters form complementary logic and control signals. Two inverter stages preserve the original polarity while restoring logic levels and driving a signal. Drive capability depends on device sizing and load.'

export function Foundations({ experiment }) {
  const lesson = experiment.foundation
  return <section className="foundations" id="lesson-overview" tabIndex={-1} aria-labelledby="overview-title">
    <h2 id="overview-title">{experiment.shortName}: before the math</h2>
    <ChipContext />
    <p>{TERMS.inverter.def}</p>
    <p>{INVERTER_USE}</p>
    <p>{TERMS.cmos.def}</p>
    <dl>
      <dt>Purpose</dt><dd>{lesson.purpose}</dd>
      <dt>Input</dt><dd>{lesson.input}</dd>
      <dt>Expected output</dt><dd>{lesson.output}</dd>
      <dt>Predict the change</dt><dd>{lesson.prediction}</dd>
      <dt>Design tradeoffs</dt><dd>{lesson.tradeoffs}</dd>
      <dt>Model limits</dt><dd>{lesson.limits}</dd>
    </dl>
  </section>
}

export function playbackMeaning(dc, view) {
  if (dc) return 'Input sweep visits static input voltages. Playback speed changes how fast those points are visited, not a physical input slew rate. This view has no time response.'
  if (view === 'fanout') return 'Fanout sweep probes different loads on the delay curve. It does not change the selected fanout or advance circuit time. Playback speed only changes the probe motion.'
  return 'The time cursor samples the computed response. Playback speed changes viewing speed, not transistor resistance, capacitance or propagation delay.'
}
