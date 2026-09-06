/** Describe the questions each method can answer for this particular circuit. */
export function solutionRoutes(exp, x) {
  const elements = x.net.elements
  const storage = elements.filter((e) => e.type === 'C' || e.type === 'L')
  const states = storage.map((e) => `${e.id} ${e.type === 'C' ? 'voltage' : 'current'}`).join(' and ')
  const dynamic = exp.views.includes('scope')
  const stateView = exp.views.includes('state')
  const phasorView = exp.views.includes('phasor')
  const diode = elements.some((e) => e.type === 'D')
  const sources = elements.filter((e) => e.type === 'V' || e.type === 'I')
  const nonSinusoidal = sources.some((e) => e.wave && ['step', 'square', 'triangle', 'ramp'].includes(e.wave.kind))
  const intro = dynamic
    ? `This experiment follows ${states || 'the circuit response'} over time. The routes share KCL, KVL and the element laws, but answer different questions.`
    : 'This experiment asks for a DC operating point: the voltages and currents that satisfy the circuit laws together.'
  const routes = [
    { id: 'equations', label: 'Circuit equations', view: 'equations',
      bestFor: dynamic ? 'Checking branch voltages, current directions and KCL at one instant.' : 'A direct DC solution with visible current paths and sign conventions.',
      tradeoff: dynamic && storage.length
        ? `The snapshot needs known ${states}; it cannot determine startup by itself.`
        : diode ? 'The diode state or nonlinear curve must be solved too; linear algebra alone may not suffice.'
          : 'Each additional node or branch can add algebra; circuit structure may offer a shorter equivalent-circuit solution.',
      description: dynamic
        ? `Find every voltage and current at the cursor. Supply the source values${storage.length ? ` and ${states}` : ''} at that instant, then solve KCL and the voltage constraints.`
        : `Solve KCL, KVL and the element laws for the DC voltages and currents.${diode ? ' The diode model must also be satisfied; its conducting state or curve is part of the solution.' : ''}`,
    },
    { id: 'state', label: 'State equations', view: stateView ? 'state' : dynamic ? 'scope' : null,
      bestFor: storage.length && dynamic
        ? phasorView ? 'Startup and the effect of initial energy before the steady sinusoid remains.' : `Following ${states} through charging, switching or ringing.`
        : dynamic ? 'Viewing the sequence of instantaneous circuit solutions in Scope.' : 'Time evolution when storage matters; unnecessary for this DC calculation.',
      tradeoff: storage.length && dynamic
        ? diode ? 'Requires initial conditions and different equations as diode conduction changes.' : 'Requires initial conditions and differential equations; other branch quantities must be reconstructed from the states.'
        : 'There is no separate evolving state to solve in this example; use its circuit equations directly.',
      action: stateView ? 'Open State equation' : dynamic ? 'Open time response' : null,
      description: stateView
        ? `Find ${states} as functions of time from the source waveform and initial conditions. This includes startup. Use those states in the circuit equations to recover the other quantities.`
        : dynamic
          ? storage.length ? `Time-domain analysis follows ${states} from the initial conditions.${diode ? ' Diode conduction changes the equations during the waveform.' : ''} This experiment shows that evolution in Scope; a separate State equation view is not offered.`
            : 'There are no capacitor or inductor states here. Solve the circuit at each instantaneous source value; Scope shows those solutions over time. No stored initial state is needed.'
          : storage.length
            ? 'At DC equilibrium the state derivatives are zero. Capacitors are open and inductors are shorted; this experiment uses those conditions directly in its circuit equations.'
            : 'There are no capacitor or inductor states in this circuit. No time-evolution equation or initial condition is needed for this DC solution.',
    },
    { id: 'phasor', label: 'Phasors', view: phasorView ? 'phasor' : null,
      bestFor: phasorView
        ? storage.some((e) => e.type === 'L') && storage.some((e) => e.type === 'C')
          ? 'Finding resonance, phase shifts and steady-state power through complex algebra.'
          : 'Finding steady-state amplitudes, phase shifts and power without integrating in time.'
        : 'Single-frequency sinusoidal steady state in a linear circuit; not the complete problem posed here.',
      tradeoff: phasorView
        ? 'Omits startup and requires complex arithmetic. Initial conditions need a separate natural-response calculation.'
        : diode ? 'Nonlinear conduction can generate harmonics; one phasor cannot capture the full waveform.'
          : dynamic ? 'One phasor cannot describe the full source waveform or its transient response.'
            : 'Adds complex-number machinery without helping this DC operating-point calculation.',
      description: phasorView
        ? 'Find the steady sinusoid’s amplitude and phase at the drive frequency using complex impedances. This needs the circuit and source phasor, but does not include the startup response set by initial conditions.'
        : diode
          ? 'A single-frequency phasor solve cannot describe the full diode response: nonlinear conduction can change the waveform and generate harmonics. Use the circuit equations and, for a waveform, time-domain analysis.'
          : dynamic && nonSinusoidal
            ? 'This source is a step, ramp or nonsinusoidal waveform. One phasor cannot describe the complete response. Use the time-domain route; for a linear circuit, frequency components can be analyzed separately.'
            : 'This experiment does not ask for a sinusoidal steady-state response. Use the DC circuit equations here; there is no separate phasor solution to compare.',
    },
  ]
  const connection = phasorView
    ? 'How they meet: the state solution includes forced + natural response. Phasors give the forced steady sinusoid. If the natural response decays, the two waveforms approach one another. At any chosen instant, use the corresponding states in the circuit equations; those voltages and currents must agree.'
    : dynamic
      ? storage.length ? 'How they meet: the time-domain route supplies the stored state at the cursor; the circuit equations use it to solve that instant’s voltages and currents. The snapshot equations alone do not determine the earlier history or startup.'
        : 'How they meet: Scope repeats the circuit solution as the source changes. With no energy-storage state in this model, the instantaneous source values are enough to determine each point of the waveform.'
      : 'How they meet: the readings, power and other available views are consequences or checks of this same DC operating point, rather than separate time-domain or phasor solutions.'
  const guidance = !x.sol
    ? 'At these settings the circuit has no reported solution. Start with Circuit equations to inspect the constraints; changing methods cannot make contradictory ideal assumptions consistent.'
    : phasorView
      ? 'Choose State equations for startup, Phasors for the steady sinusoid, or Circuit equations for a snapshot with known states.'
      : dynamic ? 'Start with the time-domain route for a waveform, or Circuit equations to work through the current snapshot.'
        : 'Start with Circuit equations to work through this operating point.'
  return { intro, routes, connection, guidance }
}
