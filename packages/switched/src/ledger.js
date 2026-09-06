// Where the watts went, as a table that has to add up.
//
// Every loss in this engine is an integral of the same exact waveform the
// output power is an integral of, so the books are an identity rather than
// an estimate: over a periodic steady state,
//
//     P_in − P_out − Σ conduction losses = 0
//
// to floating point. `residual` is that difference, and a test holds it at
// zero. It is the one number in the ledger that is not a measurement.
//
// Switching loss is the exception, and the ledger keeps it apart rather than
// mixing it in. It is not read off a waveform: the engine's states switch
// instantaneously, and the ½·V·I·(t_r+t_f)·f_s term is a model of what the
// transition costs, charged on top. So it sits in its own row, labelled as a
// model, and efficiency is taken against the source power that carries it.

export const LOSS_ROWS = {
  pass: { label: 'pass element', formula: '(V_{in} - V_{out})\\,I_{out}', model: false },
  switch: { label: 'switch conduction', formula: 'R_{on} I_{Q,rms}^2', model: false },
  diode: { label: 'freewheel path', formula: 'V_f \\langle i_D \\rangle + r_d I_{D,rms}^2', model: false },
  inductor: { label: 'winding', formula: 'R_L I_{L,rms}^2', model: false },
  esr: { label: 'capacitor ESR', formula: '\\mathrm{ESR}\\, I_{C,rms}^2', model: false },
  series: { label: 'source resistance', formula: 'R_s I_{D,rms}^2', model: false },
  diodes: { label: 'rectifier drops', formula: 'n_D V_f \\langle i_D \\rangle', model: false },
  switching: { label: 'switching edges', formula: '\\tfrac{1}{2} V (t_r + t_f) I f_s', model: true },
}

/**
 * The ledger of a solved converter's measures.
 *
 * `rows` are the mechanisms with a watt figure each and the share of the
 * source power they take. `residual` is P_in − P_out − Σ conduction, which
 * the physics makes zero. `Psource` adds the switching model to the input
 * the waveform itself accounts for, and `eta` is measured against it.
 */
export function lossLedger(m) {
  const entries = Object.entries(m.loss || {})
  const rows = entries.map(([key, watts]) => ({
    key,
    watts,
    ...(LOSS_ROWS[key] || { label: key, formula: null, model: false }),
  }))
  const conduction = rows.filter((r) => !r.model).reduce((a, r) => a + r.watts, 0)
  const switching = rows.filter((r) => r.model).reduce((a, r) => a + r.watts, 0)
  const Psource = m.Pin + switching
  for (const r of rows) r.share = Psource > 0 ? r.watts / Psource : 0
  return {
    rows,
    conduction,
    switching,
    Pin: m.Pin,
    Pout: m.Pout,
    Psource,
    // The identity, and the only row in the table that is not measured.
    residual: m.Pin - m.Pout - conduction,
    eta: Psource > 0 ? m.Pout / Psource : 1,
    outShare: Psource > 0 ? m.Pout / Psource : 1,
  }
}

/** The mechanisms a set of knobs has switched on, in the order the table lists them. */
export function activeMechanisms(m, { floor = 1e-15 } = {}) {
  return lossLedger(m).rows.filter((r) => Math.abs(r.watts) > floor).map((r) => r.key)
}
