import React from 'react'
import { Formula } from '@ee-labs/explain'

/** Keep the symbol key beside both the worked lesson and the live state equation. */
export function NotationGuide({ phasor = false }) {
  return (
    <details className="notation-guide">
      <summary>Reading the symbols: states, derivatives{phasor ? ' and phasors' : ''}</summary>
      <p>A state is a stored-energy quantity: capacitor voltage in volts (V), or inductor current in amperes (A). With several storage elements, x is a column of these quantities, in the order shown in the state equation.</p>
      <dl>
        <dt>x(t)</dt><dd>The state at elapsed time t, measured in seconds. Lowercase x is a waveform. x(T) means that waveform evaluated at a particular time T; for a periodic source, T = 1/f is one period.</dd>
        <dt>x(0⁻), x(0⁺)</dt><dd>The values immediately before and after switching at t = 0. The superscripts mean “just before” and “just after,” not negative and positive values. In these experiments capacitor voltage and inductor current are continuous, so x(0⁺) = x(0⁻).</dd>
        <dt>ẋ(t) = dx/dt</dt><dd>The rate of change, or slope, of x(t), not another state. Its units are V/s for capacitor voltage and A/s for inductor current. A positive slope means the state is increasing.</dd>
        <dt>u(t), A, B</dt><dd>u(t) lists the applied source voltages and currents. A multiplies the present states and B multiplies the sources. Add those contributions row by row to obtain each state's slope. The coefficients include the needed units; use seconds, volts and amperes with the printed matrices.</dd>
        <dt>τ (tau)</dt><dd>A stable first-order circuit's time constant in seconds: RC for a simple series RC circuit, L/R for a simple series RL circuit. After one τ, the difference from the final value is about 37% of its starting difference; after five τ, less than 1% remains.</dd>
      </dl>
      <Formula>{String.raw`\dot{x}(t)=A x(t)+B u(t)`}</Formula>
      <p>This equation gives the slope from the present state and input. The initial value x(0⁺) supplies the starting point; solving the equation gives x(t). Each capacitor row also obeys dv/dt = i/C; each inductor row obeys di/dt = v/L. The “element law” column checks the same slope this second way.</p>
      <p>For example, a series resistor R charging a capacitor C from a constant voltage V₁ has x = capacitor voltage, u = V₁, A = −1/(RC), B = 1/(RC), and τ = RC:</p>
      <Formula>{String.raw`\dot{x}(t)=\frac{V_1-x(t)}{\tau},\qquad x(t)=V_1+[x(0^+)-V_1]e^{-t/\tau}`}</Formula>
      <p>With V₁ = 5 V, x(0⁺) = 0 V and τ = 1 ms, the starting slope is 5,000 V/s. At t = τ, x(t) ≈ 3.16 V and the slope is about 1,840 V/s. The voltage rises while its slope shrinks. This exponential formula assumes a constant input and one stable state; two-state circuits can ring and need their coupled equations.</p>
      <p>In the root equation det(sI − A) = 0, s is a possible natural growth or decay rate and I is the identity matrix. A negative real root means decay; for one stable state, s = −1/τ. With two states, α is the decay rate, ω₀ the undamped natural angular frequency, ζ = α/ω₀ the dimensionless damping ratio, Q the quality factor, and ω_d the ringing angular frequency when the roots are complex.</p>
      {phasor ? <>
        <p>A capital X is a phasor: one complex number recording a sinusoid's peak amplitude |X| and phase φ. It is not x(T). Here j² = −1, f is frequency in hertz, ω = 2πf is angular frequency in radians per second, and Im means “take the imaginary part.” This lab uses the sine convention:</p>
        <Formula>{String.raw`X=|X|e^{j\varphi},\qquad x_{\mathrm{ss}}(t)=\operatorname{Im}\{Xe^{j\omega t}\}=|X|\sin(\omega t+\varphi)`}</Formula>
        <p>The subscript ss means sinusoidal steady state. Differentiating the sinusoid corresponds to multiplying its phasor by jω, so the state equation becomes jωX = AX + BU, where U is the source phasor column. Solve this algebraic equation for X, then reconstruct the waveform using the formula above.</p>
        <p>A phasor describes the steady sinusoid. The actual startup also includes a natural response to satisfy x(0⁺). For one stable state driven by a sinusoid:</p>
        <Formula>{String.raw`x(t)=x_{\mathrm{ss}}(t)+[x(0^+)-x_{\mathrm{ss}}(0)]e^{-t/\tau}`}</Formula>
        <p>At t = 0 the two terms add to the initial state; as time passes, the exponential correction decays and the phasor waveform remains.</p>
      </> : null}
    </details>
  )
}
