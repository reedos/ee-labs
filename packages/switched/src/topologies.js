// The three basic converters as switched linear circuits.
//
// State is x = [i_L, v_C]. Each switch position is a state matrix A, a
// constant forcing f = B·u, and a table of the signals a scope might show,
// each a linear form y = c·x + d valid while that position holds. Three
// positions cover every basic converter:
//
//   on    the transistor conducts
//   off   the transistor is open and the inductor current flows in the
//         diode (or the synchronous transistor)
//   dead  the inductor current has reached zero and the diode has blocked;
//         i_L is pinned at zero and only the capacitor evolves (DCM)
//
// Non-idealities are all in the matrices: R_on in series with the switch,
// V_f and r_d in series with the diode, R_L with the inductor, ESR with the
// capacitor. With every one at zero the matrices are the textbook ideal
// converter. The synchronous option replaces the diode with a second R_on
// switch, which removes the dead position (current may go negative).
//
// Output with ESR: the load sees v_out = v_C + ESR·i_C where i_C = i_x − v_out/R
// and i_x is whatever current the topology sends to the output node (i_L for
// the buck always; i_L for boost and buck-boost only while the diode
// conducts). Solving, with α = R/(R+ESR):
//     v_out = α v_C + α·ESR·i_x,   i_C = α i_x − (α/R) v_C.

export const DEFAULTS = {
  Vin: 12,
  D: 5 / 12,
  L: 100e-6,
  C: 100e-6,
  R: 5,
  fs: 100e3,
  Ron: 0,
  Vf: 0,
  rd: 0,
  RL: 0,
  ESR: 0,
  sync: false,
  tr: 0,
  tf: 0,
}

export const KINDS = ['buck', 'boost', 'buckboost']

export function idealM(kind, D) {
  if (kind === 'buck') return D
  if (kind === 'boost') return 1 / (1 - D)
  return D / (1 - D)
}

const lin = (c1, c2, d = 0) => ({ c: [c1, c2], d })

export function converter(kind, params = {}) {
  if (!KINDS.includes(kind)) throw new Error(`unknown converter "${kind}"`)
  const p = { ...DEFAULTS, ...params }
  const { Vin, L, C, R, Ron, Vf, rd, RL, ESR, sync } = p
  const alpha = R / (R + ESR)
  const T = 1 / p.fs
  // Output-node forms when the topology's current i_x reaches the output.
  const outFed = {
    vout: lin(alpha * ESR, alpha),
    iC: lin(alpha, -alpha / R),
  }
  // ...and when it does not (diode blocking): the capacitor alone feeds R.
  const outAlone = {
    vout: lin(0, alpha),
    iC: lin(0, -alpha / R),
  }
  const zero = lin(0, 0)
  const iL = lin(1, 0)
  // Series drop while the freewheeling path conducts.
  const fwR = sync ? Ron : rd
  const fwV = sync ? 0 : Vf

  let on
  let off
  let dead
  if (kind === 'buck') {
    const rOn = Ron + RL + alpha * ESR
    on = {
      A: [
        [-rOn / L, -alpha / L],
        [alpha / C, -alpha / (R * C)],
      ],
      f: [Vin / L, 0],
      signals: {
        ...outFed,
        vsw: lin(-Ron, 0, Vin),
        vL: lin(-rOn, -alpha, Vin),
        iQ: iL,
        iD: zero,
        iin: iL,
      },
    }
    const rOff = fwR + RL + alpha * ESR
    off = {
      A: [
        [-rOff / L, -alpha / L],
        [alpha / C, -alpha / (R * C)],
      ],
      f: [-fwV / L, 0],
      signals: {
        ...outFed,
        vsw: lin(-fwR, 0, -fwV),
        vL: lin(-rOff, -alpha, -fwV),
        iQ: zero,
        iD: iL,
        iin: zero,
      },
    }
    dead = {
      A: [
        [0, 0],
        [0, -alpha / (R * C)],
      ],
      f: [0, 0],
      signals: { ...outAlone, vsw: lin(0, alpha), vL: zero, iQ: zero, iD: zero, iin: zero },
    }
  } else {
    // boost and buck-boost share the "on" position: the inductor charges
    // from V_in through the switch while the capacitor alone feeds the load.
    const rOn = Ron + RL
    on = {
      A: [
        [-rOn / L, 0],
        [0, -alpha / (R * C)],
      ],
      f: [Vin / L, 0],
      signals: {
        ...outAlone,
        vsw: kind === 'boost' ? lin(Ron, 0) : lin(-Ron, 0, Vin),
        vL: lin(-rOn, 0, Vin),
        iQ: iL,
        iD: zero,
        iin: iL,
      },
    }
    // "off": the inductor discharges into the output through the diode. For
    // the boost the source is still in the loop; for the buck-boost it is not,
    // and the output is inverted (v_C here is its magnitude).
    const rOff = fwR + RL + alpha * ESR
    const src = kind === 'boost' ? Vin : 0
    off = {
      A: [
        [-rOff / L, -alpha / L],
        [alpha / C, -alpha / (R * C)],
      ],
      f: [(src - fwV) / L, 0],
      signals: {
        ...outFed,
        vsw:
          kind === 'boost'
            ? lin(alpha * ESR + fwR, alpha, fwV)
            : lin(-(alpha * ESR + fwR), -alpha, -fwV),
        vL: lin(-rOff, -alpha, src - fwV),
        iQ: zero,
        iD: iL,
        iin: kind === 'boost' ? iL : zero,
      },
    }
    dead = {
      A: [
        [0, 0],
        [0, -alpha / (R * C)],
      ],
      f: [0, 0],
      signals: {
        ...outAlone,
        vsw: kind === 'boost' ? lin(0, 0, Vin) : zero,
        vL: zero,
        iQ: zero,
        iD: zero,
        iin: zero,
      },
    }
  }
  for (const s of [on, off, dead]) {
    s.signals.iL = iL
    s.signals.vC = lin(0, 1)
  }
  on.name = 'on'
  off.name = 'off'
  dead.name = 'dead'

  // Voltage the switch blocks while off, for the switching-loss model.
  const blocking = (voutAvg) =>
    kind === 'buck' ? Vin + fwV : kind === 'boost' ? voutAvg + fwV : Vin + voutAvg + fwV

  return {
    kind,
    p,
    T,
    alpha,
    states: { on, off, dead },
    // Whether the freewheeling path can block (diode) or not (sync switch).
    hasDead: !sync,
    blocking,
    inverted: kind === 'buckboost',
    idealM: (D = p.D) => idealM(kind, D),
  }
}

export const SIGNALS = ['iL', 'vC', 'vout', 'vsw', 'vL', 'iC', 'iQ', 'iD', 'iin']

export function evalSignal(state, name, x) {
  const s = state.signals[name]
  let y = s.d
  for (let i = 0; i < s.c.length; i++) y += s.c[i] * x[i]
  return y
}
