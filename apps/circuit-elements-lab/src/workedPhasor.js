import { complex as cx } from '@ee-labs/network'
import { n, par, sum, qty, rect, polar } from './derivationMath.js'

/** The seven offered phasor examples are single-loop RC, RL or RLC circuits. */
export function workedPhasor(exp, x) {
  const w = x.omega, f = w / (2 * Math.PI)
  const source = x.net.elements.find((e) => e.id === exp.phasor.total)
  const amp = source.wave.amp, phase = source.wave.phase || 0
  const V = [amp * Math.cos(phase), amp * Math.sin(phase)]
  const passive = exp.phasor.volts.map((id) => x.net.elements.find((e) => e.id === id))
  const impedances = passive.map((e) => e.type === 'R' ? [e.value, 0] : e.type === 'L' ? [0, w * e.value] : [0, -1 / (w * e.value)])
  const Z = impedances.reduce(cx.cadd, [0, 0]), I = cx.cdiv(V, Z)
  const volts = impedances.map((z) => cx.cmul(z, I))
  const steps = [{ title: 'Write the source as a sinusoid and as a phasor',
    text: 'This lab uses peak amplitudes and the sine convention. A phasor is one complex number containing amplitude and phase. Multiplying it by e^(jωt) rotates its arrow; taking the imaginary part gives the instantaneous sine. j is the imaginary unit, j² = −1. ω is angular frequency; f is cycles per second.',
    latex: [
      `f &= ${qty(f, 'Hz')},\\qquad \\omega=2\\pi f=2\\pi${par(f)}=${qty(w, 'rad/s')}`,
      `T &= \\frac{1}{f}=${qty(1 / f, 's')}`,
      `v_s(t) &= ${n(amp)}\\sin(${n(w)}t+${par(phase)})\\,\\mathrm{V}`,
      `V_s &= ${n(amp)}[\\cos(${n(phase)})+j\\sin(${n(phase)})]=${rect(V)}\\,\\mathrm{V}`,
      `&= ${polar(V)}\\,\\mathrm{V}`,
    ], note: 'The waveform uses radians inside sine; polar phasor angles are shown in degrees. A negative amplitude becomes a positive magnitude with phase shifted by 180°. At zero amplitude, phase has no physical meaning.' }]
  passive.forEach((e, i) => {
    const id = `${e.type}_{${e.id.slice(1)}}`, z = `Z_{${e.id}}`
    steps.push({ title: `Turn ${e.id}'s element law into impedance`,
      text: e.type === 'R' ? 'A resistor obeys v = Ri in time, so the same real multiplier relates its voltage and current phasors.'
        : e.type === 'L' ? 'An inductor obeys v = L·di/dt. Differentiating a sinusoid multiplies its phasor by jω, giving V = jωLI.'
          : 'A capacitor obeys i = C·dv/dt, giving I = jωCV. Rearrange to V/I = 1/(jωC). Since 1/j = −j, its impedance has a negative imaginary part.',
      latex: [
        `${id} &= ${qty(e.value, e.type === 'R' ? '\\Omega' : e.type === 'L' ? 'H' : 'F')}`,
        e.type === 'R' ? `${z} &= ${id}=${rect(impedances[i])}\\,\\Omega`
          : e.type === 'L' ? `${z} &= j\\omega ${id}=j${par(w)}${par(e.value)}=${rect(impedances[i])}\\,\\Omega`
            : `${z} &= \\frac{1}{j\\omega ${id}}=-\\frac{j}{${par(w)}${par(e.value)}}=${rect(impedances[i])}\\,\\Omega`,
      ], note: e.type === 'R' ? 'Voltage and current are in phase in a resistor.' : e.type === 'L' ? 'Inductor voltage leads its current by 90°.' : 'Capacitor voltage lags its current by 90°.' })
  })
  steps.push({ title: 'Add the series impedances using KVL',
    text: 'The same branch current flows through every element in this loop. KVL says the source voltage equals the sum of the element drops. Factor out I to obtain total impedance; add real parts and imaginary parts separately.',
    latex: [
      `V_s &= ${sum(passive.map((e) => `V_{${e.id}}`))}=I\\left(${sum(passive.map((e) => `Z_{${e.id}}`))}\\right)`,
      `Z &= ${sum(impedances.map((z) => `(${rect(z)})`))}=${rect(Z)}\\,\\Omega`,
      `|Z| &= \\sqrt{${par(Z[0])}^2+${par(Z[1])}^2}=${qty(cx.cabs(Z), '\\Omega')}`,
      `\\arg Z &= \\operatorname{atan2}(${n(Z[1])},${n(Z[0])})=${n(cx.carg(Z) * 180 / Math.PI)}^{\\circ}`,
    ], note: 'atan2 uses both components to choose the correct quadrant. Inductive and capacitive imaginary parts oppose one another; at resonance they cancel.' })
  const denom = Z[0] ** 2 + Z[1] ** 2
  steps.push({ title: 'Divide by the complex impedance to find the current',
    text: 'Use I = V_s/Z. Multiply numerator and denominator by the complex conjugate of Z, which reverses its imaginary part. The denominator becomes real, so calculate the real and imaginary current components separately.',
    latex: [
      `I &= \\frac{${rect(V)}}{${rect(Z)}}\\frac{${rect(cx.conj(Z))}}{${rect(cx.conj(Z))}}`,
      `\\Re I &= \\frac{${par(V[0])}${par(Z[0])}+${par(V[1])}${par(Z[1])}}{${par(Z[0])}^2+${par(Z[1])}^2}=${n(I[0])}`,
      `\\Im I &= \\frac{${par(V[1])}${par(Z[0])}-${par(V[0])}${par(Z[1])}}{${n(denom)}}=${n(I[1])}`,
      `|I| &= \\sqrt{${par(I[0])}^2+${par(I[1])}^2}=${qty(cx.cabs(I), 'A')}`,
      `\\arg I &= \\operatorname{atan2}(${n(I[1])},${n(I[0])})`,
      `I &= (${rect(I)})\\,\\mathrm{A}=${polar(I)}\\,\\mathrm{A}`,
    ], note: 'Re and Im mean real and imaginary parts. This I follows the branch direction through the passive elements. The source current under the passive sign convention points the other way and is −I.' })
  passive.forEach((e, i) => {
    const z = impedances[i], v = volts[i]
    steps.push({ title: `Multiply I by ${e.id}'s impedance to get its voltage`,
      text: 'Apply V = ZI. For rectangular complex numbers, (a + jb)(c + jd) = (ac − bd) + j(ad + bc). Then convert the resulting voltage to magnitude and angle.',
      latex: [
        `V_{${e.id}} &= (${rect(z)})(${rect(I)})`,
        `&= [${par(z[0])}${par(I[0])}-${par(z[1])}${par(I[1])}]+j[${par(z[0])}${par(I[1])}+${par(z[1])}${par(I[0])}]`,
        `&= (${rect(v)})\\,\\mathrm{V}`,
        `|V_{${e.id}}| &= \\sqrt{${par(v[0])}^2+${par(v[1])}^2}=${qty(cx.cabs(v), 'V')}`,
        `\\arg V_{${e.id}} &= \\operatorname{atan2}(${n(v[1])},${n(v[0])})`,
        `V_{${e.id}} &= ${polar(v)}\\,\\mathrm{V}`,
      ], note: cx.cabs(v) === 0 ? 'This voltage is zero, so phase is undefined; the displayed zero-angle convention is only a placeholder.' : 'The angle tells where this voltage arrow starts relative to the sine reference at t = 0.' })
  })
  const total = volts.reduce(cx.cadd, [0, 0])
  steps.push({ title: 'Check the phasor sum and the circuit solver',
    text: 'Add the rectangular element voltages. Both real and imaginary components must add to the source phasor. Magnitudes alone do not add, because the voltage arrows point in different directions.',
    latex: [
      `${sum(passive.map((e) => `V_{${e.id}}`))} &= ${sum(volts.map((v) => `(${rect(v)})`))}`,
      `&= ${rect(total)}\\,\\mathrm{V},\\qquad V_s=${rect(V)}\\,\\mathrm{V}`,
      `|\\Sigma V-V_s| &= ${qty(cx.cabs(cx.csub(total, V)), 'V')}`,
      `|I-I_{solver}| &= ${qty(cx.cabs(cx.csub(I, x.ac.i[exp.phasor.current])), 'A')}`,
    ] })
  const waves = [{ id: 's', z: V, unit: 'V', actual: x.sol.volt[source.id], symbol: 'v' },
    ...passive.map((e, i) => ({ id: e.id, z: volts[i], unit: 'V', actual: x.sol.volt[e.id], symbol: 'v' })),
    { id: exp.phasor.current, z: I, unit: 'A', actual: x.sol.i[exp.phasor.current], symbol: 'i' }]
  waves.forEach((q) => {
    const magnitude = cx.cabs(q.z), angle = magnitude === 0 ? 0 : cx.carg(q.z), value = cx.instant(q.z, w, x.cursor)
    steps.push({ title: `Reconstruct the ${q.symbol === 'v' ? 'voltage' : 'current'} waveform for ${q.id === 's' ? source.id : q.id}`,
      text: 'To recover the steady-state value at the cursor, rotate the phasor through ωt and take its imaginary part, equivalently evaluate the sine with its magnitude and phase. The actual transient can differ during startup.',
      latex: [
        `${q.symbol}_{${q.id},ss}(t) &= \\Im\\{(${rect(q.z)})e^{j\\omega t}\\}=${n(magnitude)}\\sin(${n(w)}t+${par(angle)})`,
        `${q.symbol}_{${q.id},ss}(${n(x.cursor)}) &= ${n(magnitude)}\\sin(${par(w)}${par(x.cursor)}+${par(angle)})=${qty(value, q.unit)}`,
        `${q.symbol}_{${q.id},actual}(${n(x.cursor)}) &= ${qty(q.actual, q.unit)}`,
        `\\text{startup difference} &= ${qty(q.actual - value, q.unit)}`,
      ], note: 'The subscript ss means steady state. The State equation walkthrough derives the natural correction that makes the waveform satisfy its initial state.' })
  })
  const S = cx.cscale(cx.cmul(V, cx.conj(I)), 0.5)
  steps.push({ title: 'Use the same phasors to find power',
    text: 'These phasors use peak amplitudes, so complex power delivered into the series load is S = ½V_s I*. The star means complex conjugate. P is average real power in watts; Q is reactive power in var. Using RMS amplitudes instead would remove the factor ½.',
    latex: [
      `S &= \\tfrac12(${rect(V)})(${rect(cx.conj(I))})=${rect(S)}\\,\\mathrm{VA}`,
      `P &= ${qty(S[0], 'W')},\\qquad Q=${qty(S[1], 'var')}`,
      `|S| &= \\sqrt{P^2+Q^2}=${qty(cx.cabs(S), 'VA')}`,
      ...(cx.cabs(S) > 0 ? [`\\mathrm{pf} &= \\frac{P}{|S|}=${n(S[0])}/${n(cx.cabs(S))}=${n(S[0] / cx.cabs(S))}`] : []),
    ], note: cx.cabs(S) === 0 ? 'With zero apparent power, power factor is not defined.' : 'Positive Q means net inductive reactive power; negative Q means net capacitive reactive power.' })
  return { steps, I, V, Z, volts, S }
}
