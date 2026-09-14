import React, { useState } from 'react'

export function gradeAnswer(text, target) {
  if (!text.trim() || !Number.isFinite(Number(text))) return 'invalid'
  return Math.abs(Number(text) - target) <= Math.max(Math.abs(target) * 0.02, 1e-12) ? 'correct' : 'incorrect'
}

/** Practice uses the independently derived theory column, not the measured result. */
export default function Practice({ entry }) {
  const row = entry?.blocks.filter(b => b.kind === 'check').flatMap(b => b.rows)
    .find(r => !r.unchecked && Number.isFinite(r.predicted) && Number.isFinite(r.measured))
  const [answer, setAnswer] = useState('')
  const [status, setStatus] = useState(null)
  const [hint, setHint] = useState(false)
  const [reveal, setReveal] = useState(false)
  if (!row) return <p>At these settings the model has no comparable numerical prediction. Use the worked math to identify which assumption prevents the comparison.</p>
  return <section className="lesson-practice">
    <h3>Predict, then check</h3>
    <p>Using the current settings, calculate <b>{row.label}</b> before opening Worked math.</p>
    <form onSubmit={e => { e.preventDefault(); setStatus(gradeAnswer(answer, row.predicted)); setReveal(false) }}>
      <label>Your prediction {row.unit ? `(${row.unit})` : '(dimensionless)'}<input aria-label="Your prediction" value={answer} onChange={e => { setAnswer(e.target.value); setStatus(null); setReveal(false) }} placeholder="Scientific notation is accepted" /></label>
      <button type="submit">Check answer</button>
      <button type="button" aria-expanded={hint} onClick={() => setHint(!hint)}>Hint</button>
    </form>
    {hint && <p>Identify the formula for {row.label} in Worked math. Substitute the current settings in base units, keeping reference signs. Round only at the end.</p>}
    <p role="status">{status === 'invalid' ? 'Enter a finite number, for example 1.2e-3.' : status === 'correct' ? 'Correct within 2%. Compare your prediction with the measured column in Worked math and explain any model approximation.' : status === 'incorrect' ? 'Not yet. Check units, the reference sign and whether this quantity uses a linear or logarithmic scale. You can use the hint or reveal the prediction.' : ''}</p>
    {status === 'incorrect' && <button type="button" onClick={() => setReveal(true)}>Show prediction</button>}
    {reveal && <p>The theory predicts {Number(row.predicted.toPrecision(6))} {row.unit}. Follow the formula and the measured comparison in Worked math to review the calculation.</p>}
  </section>
}
