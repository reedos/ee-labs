// The textbook closed forms the lab quotes beside the exact numbers.
//
// Every one of these assumes a ripple-free output (the "small ripple
// approximation") and ideal parts; the engine does not, which is the point of
// showing both. The experiments' notes say how far apart they land.

export function conversionRatio(kind, D) {
  if (kind === 'buck') return D
  if (kind === 'boost') return 1 / (1 - D)
  return D / (1 - D)
}

// Peak-to-peak inductor current ripple in CCM.
export function inductorRipple(kind, { Vin, D, L, fs }) {
  const Vo = Vin * conversionRatio(kind, D)
  if (kind === 'buck') return (Vo * (1 - D)) / (L * fs)
  return (Vin * D) / (L * fs)
}

// Peak-to-peak output voltage ripple in CCM, ESR-free.
export function outputRipple(kind, { Vin, D, L, C, R, fs }) {
  if (kind === 'buck') return inductorRipple(kind, { Vin, D, L, fs }) / (8 * fs * C)
  const Vo = Vin * conversionRatio(kind, D)
  return (Vo * D) / (R * C * fs)
}

/**
 * The CCM ratio with the inductor's winding resistance in it, as a function of
 * r = R_L/R. Volt-second balance carries the drop and charge balance sets the
 * inductor current from the load current, which for the boost and the
 * buck-boost is the load current divided by D′ — so the winding sees a current
 * that grows without bound as D → 1 while the ideal formula says the voltage
 * does too. Each reduces to the ideal ratio at r = 0.
 */
export function ratioWithRL(kind, D, r) {
  const Dp = 1 - D
  if (kind === 'buck') return D / (1 + r)
  if (kind === 'boost') return Dp / (Dp * Dp + r)
  return (D * Dp) / (Dp * Dp + r)
}

/**
 * Where the boost's real ratio turns around, and how high it gets:
 * dM/dD′ = 0 at D′ = √r, giving M = ½√(R/R_L). Past it, more duty buys less
 * voltage — the ideal 1/(1−D) has no such point.
 */
export function boostPeak(r) {
  const Dp = Math.sqrt(r)
  return { Dprime: Dp, D: 1 - Dp, M: 1 / (2 * Dp) }
}

// Dimensionless conduction parameter K = 2 L f_s / R and its boundary value.
export function K({ L, fs, R }) {
  return (2 * L * fs) / R
}

export function Kcrit(kind, D) {
  if (kind === 'buck') return 1 - D
  if (kind === 'boost') return D * (1 - D) ** 2
  return (1 - D) ** 2
}

// Load resistance at the CCM/DCM boundary for these L, f_s, D.
export function Rcrit(kind, { L, fs, D }) {
  return (2 * L * fs) / Kcrit(kind, D)
}

// Conversion ratio in DCM (K < K_crit).
export function dcmRatio(kind, D, k) {
  if (kind === 'buck') return 2 / (1 + Math.sqrt(1 + (4 * k) / (D * D)))
  if (kind === 'boost') return (1 + Math.sqrt(1 + (4 * D * D) / k)) / 2
  return D / Math.sqrt(k)
}

// Ratio the textbook predicts for either mode.
export function predictedRatio(kind, { D, L, fs, R }) {
  const k = K({ L, fs, R })
  return k >= Kcrit(kind, D) ? conversionRatio(kind, D) : dcmRatio(kind, D, k)
}

// Series pass element: it drops the difference and eats the product.
export function linearRegulator({ Vin, Vo, R }) {
  const Io = Vo / R
  return { Io, Pout: Vo * Io, Pdiss: (Vin - Vo) * Io, Pin: Vin * Io, eta: Vo / Vin }
}

/**
 * The RMS current the output capacitor carries, in CCM with a flat load.
 *
 * The buck's capacitor sees the inductor's triangle and nothing else, so its
 * RMS is the triangle's, ΔI/√12. The boost and the buck-boost hand their
 * capacitor the whole load current for the D of each period the diode is
 * off, and the inductor's ripple for the rest, so its RMS is larger by the
 * ratio of the two currents rather than by a correction. That gap is why the
 * same load and the same ripple specification buy very different capacitors.
 */
export function capacitorRms(kind, { D, Iout, dI }) {
  if (kind === 'buck') return Math.abs(dI) / Math.sqrt(12)
  const Dp = 1 - D
  return Math.sqrt((D * Iout * Iout) / Dp + (Dp * dI * dI) / 12)
}

/**
 * The switching frequency at which the edges cost what conduction costs.
 *
 * Conduction takes I²·R_on and does not follow f_s. Each edge costs
 * ½·V·I·t_sw and is charged twice a period, so the switching loss is
 * V·I·t_sw·f_s for a current that barely ripples. The two are equal at
 * f* = R_on·I/(V·t_sw).
 */
export function switchingCrossover({ Ron, Iout, Vblk, tsw }) {
  if (!(tsw > 0) || !(Vblk > 0)) return Infinity
  return (Ron * Iout) / (Vblk * tsw)
}

/**
 * The load at which a converter's efficiency peaks: where the loss that does
 * not follow the load equals the loss that follows its square.
 *
 * In CCM the RMS current is √(I_out² + ΔI²/12), so the resistive loss splits
 * into an I_out² term and a ripple term no load can move. They are equal at
 * I_out = ΔI/√12, and a loss merely proportional to I_out (a diode drop, the
 * switching edges) does not move the peak. With ΔI = V_out(1 − D)/(L·f_s)
 * that current is V_out(1 − D)/(√12·L·f_s), so the load resistance at the
 * peak is √12·L·f_s/(1 − D). It carries no V_out at all, and it is √3 times
 * the load at the CCM boundary.
 */
export function peakEfficiencyLoad({ L, fs, D }) {
  return (Math.sqrt(12) * L * fs) / (1 - D)
}

// A switch chopping V_in into a bare resistor at duty D: the average scales
// with D but the power (and the RMS) do not — the load sees full V_in for a
// fraction D of the time.
export function chopper({ Vin, D, R }) {
  return {
    avg: D * Vin,
    rms: Math.sqrt(D) * Vin,
    P: (D * Vin * Vin) / R,
    Pavg: ((D * Vin) ** 2) / R,
  }
}
