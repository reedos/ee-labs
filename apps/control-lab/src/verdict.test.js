import { describe, it, expect } from 'vitest'
import {
  verdictOf,
  oscillationOf,
  presentMargins,
  steadyErrorOf,
  gainMarginRoom,
  gainMarginWarn,
  MARGINAL_REL,
  verdictBadge,
  bodeMarginNote,
  plantInverted,
  joinParts,
} from './verdict.js'
import { PLANTS, CONTROLLERS, buildLoop, defaultsOf, ctrlDefaultsFor } from './systems.js'
import { margins, isStable, dcGain } from '@ee-labs/systems'

// The one-word judgement, pinned against the loops that shipped wrong: the
// crossing chip that lands poles exactly on the imaginary axis, the plant
// that never settles at all, and the lead whose DC gain is 1 forever.

const GRID = Float64Array.from({ length: 6000 }, (_, i) => Math.pow(10, -4 + 8 * (i / 5999)))

describe('verdictOf', () => {
  it('is stable for an ordinary settling loop', () => {
    const { closed, open } = buildLoop('threePole', { k: 1, t1: 1, t2: 0.5, t3: 0.25 }, 'p', { kp: 4 })
    expect(verdictOf(closed, margins(open, GRID))).toBe('stable')
  })

  it('is marginal — not unstable — for poles exactly on the axis', () => {
    // Kp = 11.25 puts the three-lag loop exactly on the boundary (the
    // lessons.chips.test.js crossing-gain measurement).
    const { closed, open } = buildLoop('threePole', { k: 1, t1: 1, t2: 0.5, t3: 0.25 }, 'p', { kp: 11.25 })
    const marg = margins(open, GRID)
    expect(marg.gainMargin).toBeCloseTo(1, 2)
    expect(verdictOf(closed, marg)).toBe('marginal')
    // isStable() alone calls this the wrong thing — that mismatch is the bug.
    expect(isStable(closed)).toBe(false)
  })

  it('is unstable once a branch is strictly across the axis', () => {
    const { closed, open } = buildLoop('threePole', { k: 1, t1: 1, t2: 0.5, t3: 0.25 }, 'p', { kp: 20 })
    expect(verdictOf(closed, margins(open, GRID))).toBe('unstable')
  })

  it('reads marginal off the gain margin alone when no pole is exactly resolved', () => {
    const { closed } = buildLoop('threePole', { k: 1, t1: 1, t2: 0.5, t3: 0.25 }, 'p', { kp: 11.25 })
    // Even without passing margins, a pole within MARGINAL_REL of the axis
    // (relative to its own scale) reads marginal.
    expect(verdictOf(closed)).toBe('marginal')
    expect(MARGINAL_REL).toBeLessThan(1e-3)
  })

  // The shipped defect: Custom H(s) with b0 = 1 and a2 = a1 = a0 = 0 is
  // P(s) = 1/0. buildLoop refuses (systems.js) rather than hand closeLoop's
  // polyAdd an all-zero denominator to fold into a spurious T(s) = 1 — the
  // old code's "stable, closed loop settles" beside a steady error of
  // "none". 'undefined' is its own verdict, not 'unstable': a closed loop
  // with no characteristic equation has not run away, it has no system to
  // have run away in.
  it('is undefined — not unstable, not stable — for an all-zero plant denominator', () => {
    const { closed, open } = buildLoop('custom', { b2: 0, b1: 0, b0: 1, a2: 0, a1: 0, a0: 0 }, 'p', { kp: 1 })
    expect(verdictOf(closed, margins(open, GRID))).toBe('undefined')
    // Never the manufactured constant loop the old code built.
    expect(dcGain(closed)).not.toBe(1)
  })
})

describe('oscillationOf', () => {
  it('is zero for a stable loop with no complex pair near the axis', () => {
    const { closed } = buildLoop('firstOrder', { k: 1, tau: 1 }, 'p', { kp: 9 })
    expect(oscillationOf(closed)).toBe(0)
  })

  it('reads the rad/s of the pair nearest the axis for a marginal loop', () => {
    const { closed } = buildLoop('threePole', { k: 1, t1: 1, t2: 0.5, t3: 0.25 }, 'p', { kp: 11.25 })
    const w = oscillationOf(closed)
    expect(w).toBeGreaterThan(0)
    expect(w).toBeLessThan(20)
  })
})

describe('presentMargins', () => {
  it('passes an ordinary crossover through unchanged', () => {
    const { open } = buildLoop('threePole', { k: 1, t1: 1, t2: 0.5, t3: 0.25 }, 'p', { kp: 4 })
    const marg = margins(open, GRID)
    const out = presentMargins(marg, open, GRID[0])
    expect(out.gainCrossover).toBe(marg.gainCrossover)
    expect(out.crossoverNote).toBeNull()
  })

  it('erases the DC-noise crossover of a loop with |L(0)| = 1', () => {
    // The bug this guards: a lead whose zero cancels the plant's only pole
    // has |L(0)| = 1 exactly, and margins()'s bisection can hand back a
    // float-noise crossing at nanohertz ("crossover 8.215 nHz, PM 180.0°")
    // instead of recognising there is no real crossover to report.
    const { open } = buildLoop('firstOrder', { k: 1, tau: 1 }, 'lead', { k: 1, z: 1, p: 20 })
    expect(dcGain(open)).toBeCloseTo(1, 9)
    const noisyMarg = { gainCrossover: 8.215e-9, phaseMargin: 180.0, gainMargin: null, gainMarginDb: null, phaseCrossover: null }
    const out = presentMargins(noisyMarg, open, GRID[0])
    expect(out.gainCrossover).toBeNull()
    expect(out.phaseMargin).toBeNull()
    expect(out.crossoverNote).toMatch(/gain is 1 at DC/)
  })

  it('leaves a genuine below-band crossover alone when |L(0)| is not 1', () => {
    const { open } = buildLoop('firstOrder', { k: 5, tau: 1 }, 'p', { kp: 1 })
    const belowBand = { gainCrossover: GRID[0] / 10, phaseMargin: 90, gainMargin: null }
    const out = presentMargins(belowBand, open, GRID[0])
    expect(out.gainCrossover).not.toBeNull()
    expect(out.crossoverNote).toBeNull()
  })
})

describe('gainMarginRoom / gainMarginWarn', () => {
  it('is the raw margin when the boundary sits above the current gain', () => {
    expect(gainMarginRoom(11.2)).toBeCloseTo(11.2, 9)
    expect(gainMarginWarn(11.2)).toBe(false)
    expect(gainMarginRoom(1.2)).toBeCloseTo(1.2, 9)
    expect(gainMarginWarn(1.2)).toBe(true)
  })

  it('is the reciprocal when the boundary sits below the current gain', () => {
    // The unstable plant's own case: Kp = 5 against a boundary at Kp = 1,
    // crossing = current x gainMargin, so gainMargin = 1/5 = 0.20 — the
    // SAFE direction, four gain-halvings from the boundary, not one.
    expect(gainMarginRoom(0.2)).toBeCloseTo(5, 9)
    expect(gainMarginWarn(0.2)).toBe(false)
    // Kp = 1.2 against the same boundary: crossing = 1, gainMargin = 1/1.2.
    // That is close to the boundary — 1.2 gain-halvings away — and must warn.
    expect(gainMarginWarn(1 / 1.2)).toBe(true)
  })

  it('has no opinion without a margin to read', () => {
    expect(gainMarginRoom(null)).toBeNull()
    expect(gainMarginWarn(null)).toBe(false)
  })

  it('is symmetric: a margin and its reciprocal are the same distance from the boundary', () => {
    for (const gm of [0.05, 0.3, 0.9, 1, 1.4, 3, 20]) {
      expect(gainMarginRoom(gm)).toBeCloseTo(gainMarginRoom(1 / gm), 9)
    }
  })

  // The rule, pinned across the picker: 7 plants x 4 controllers, each
  // opened at the gains the picker itself opens with (ctrlDefaultsFor, the
  // same defaults choosePlant/chooseCtrl use). No default combination that
  // settles should show the warn style, and moving a genuinely thin
  // combination toward its own boundary — from either direction — must.
  const GRID = Float64Array.from({ length: 6000 }, (_, i) => Math.pow(10, -4 + 8 * (i / 5999)))
  const plantIds = Object.keys(PLANTS)
  const ctrlIds = Object.keys(CONTROLLERS)

  it('no default plant x controller combination that settles shows a warn-styled gain margin', () => {
    for (const pid of plantIds) {
      for (const cid of ctrlIds) {
        const plantP = defaultsOf(PLANTS[pid])
        const ctrlP = ctrlDefaultsFor(pid, plantP, cid)
        const { open, closed } = buildLoop(pid, plantP, cid, ctrlP)
        const marg = margins(open, GRID)
        const verdict = verdictOf(closed, marg)
        expect(verdict, `${pid} x ${cid} should open stable`).toBe('stable')
        expect(
          gainMarginWarn(marg.gainMargin),
          `${pid} x ${cid}: gain margin ${marg.gainMargin} read as thin at the picker's own defaults`,
        ).toBe(false)
      }
    }
  })

  it('the unstable plant specifically never warns at its own safe default, and does warn near its own boundary', () => {
    for (const cid of ['pi', 'pid']) {
      const plantP = defaultsOf(PLANTS.unstable)
      const ctrlP = ctrlDefaultsFor('unstable', plantP, cid)
      const { open } = buildLoop('unstable', plantP, cid, ctrlP)
      const marg = margins(open, GRID)
      // The defect, measured: -14 dB (0.20x) read as thin under the old
      // "below 2" test because it never accounted for direction. The
      // boundary for Kp = 5, Ki = 0.5 against p = 1 sits at Kp = 1, four
      // gain-halvings below the current gain — the safe side.
      expect(marg.gainMarginDb).toBeLessThan(-10)
      expect(gainMarginWarn(marg.gainMargin)).toBe(false)
    }
    // Nudged toward the SAME boundary from the stable side (Kp = 1.5 of 1,
    // Ki held at the default 0.5), the room shrinks to 1.5x and the warn
    // style must actually fire — the boundary is just as real approached
    // from below the current gain as from above it.
    const plantP = defaultsOf(PLANTS.unstable)
    const { open: nearBoundary } = buildLoop('unstable', plantP, 'pi', { kp: 1.5, ki: 0.5 })
    const nearMarg = margins(nearBoundary, GRID)
    expect(nearMarg.gainMargin).toBeLessThan(1)
    expect(gainMarginWarn(nearMarg.gainMargin)).toBe(true)
  })

  it('an ordinary plant genuinely thin on its gain margin still warns', () => {
    // Three lags under P, nudged to 95% of its own 11.25 boundary.
    const { open } = buildLoop('threePole', { k: 1, t1: 1, t2: 0.5, t3: 0.25 }, 'p', { kp: 0.95 * 11.25 })
    const marg = margins(open, GRID)
    expect(gainMarginWarn(marg.gainMargin)).toBe(true)
  })
})

describe('steadyErrorOf', () => {
  it('says none for an exact integrator loop', () => {
    const { closed } = buildLoop('firstOrder', { k: 1, tau: 1 }, 'pi', { kp: 1, ki: 1 })
    const info = steadyErrorOf(closed, 'stable')
    expect(info.text).toBe('none')
    expect(info.value).toBe(0)
  })

  it('signs a negative steady error and says what it means', () => {
    const { closed } = buildLoop('unstable', { k: 1, p: 1 }, 'p', { kp: 5 })
    const info = steadyErrorOf(closed, 'stable')
    expect(info.value).toBeLessThan(0)
    expect(info.text).toMatch(/^-25\.0%$/)
    expect(info.title).toMatch(/negative steady error/)
  })

  it('refuses a number for a loop with no steady state, and says why', () => {
    const unstable = steadyErrorOf({ b: [1], a: [1, -1] }, 'unstable')
    expect(unstable.text).toBe('—')
    expect(unstable.value).toBeNull()
    expect(unstable.title).toMatch(/runs away/)
    const marginal = steadyErrorOf({ b: [1], a: [1, 0, 1] }, 'marginal')
    expect(marginal.text).toBe('—')
    expect(marginal.title).toMatch(/oscillates forever/)
  })

  // The shipped defect's own wording: the tooltip used to say "an integrator
  // in the loop erases the error exactly" for a plant with no integrator and
  // no denominator at all. An undefined loop gets its own reason, never the
  // "runs away" text an actually-unstable loop earns.
  it('refuses for an undefined loop, and does not borrow the unstable wording', () => {
    const info = steadyErrorOf({ b: [1], a: [0] }, 'undefined')
    expect(info.text).toBe('—')
    expect(info.value).toBeNull()
    expect(info.title).toMatch(/all-zero denominator/)
    expect(info.title).not.toMatch(/runs away/)
  })

  // Round four's own repro: the topbar always read loop.closed (the
  // reference loop) no matter which step the pane below was showing, so with
  // Disturbance picked the two numbers described two different questions.
  // Pinned at plant gain 5 — NOT the 1 that lesson 4 uses, where the
  // reference and disturbance answers happen to coincide (1/(1+L(0)) equals
  // K/(1+L(0)) only when K = 1) and the mismatch has nowhere to show up.
  it('the reference and disturbance readings differ when the plant gain is not 1', () => {
    const loop = buildLoop('firstOrder', { k: 5, tau: 1 }, 'p', { kp: 9 })
    const ref = steadyErrorOf(loop.closed, 'stable', 'ref')
    const dist = steadyErrorOf(loop.disturbance, 'stable', 'dist')
    // L(0) = 45, T(0) = 45/46 -> e_ss = 1/46 = 2.2%.
    expect(ref.text).toBe('2.2%')
    // Gd(0) = 5/46 against a target of 0, not 1 -> e_ss = -5/46 = -10.9%.
    expect(dist.text).toBe('-10.9%')
    expect(ref.value).not.toBeCloseTo(dist.value, 2)
    // The field's magnitude is exactly what the Step pane's own "settles
    // to" shows for the disturbance step: dcGain(loop.disturbance).
    expect(Math.abs(dist.value)).toBeCloseTo(dcGain(loop.disturbance), 6)
  })

  it('says none for a plant-input disturbance an integrator erases exactly', () => {
    const loop = buildLoop('firstOrder', { k: 5, tau: 1 }, 'pi', { kp: 9, ki: 3 })
    const info = steadyErrorOf(loop.disturbance, 'stable', 'dist')
    expect(info.text).toBe('none')
    expect(info.value).toBe(0)
    expect(info.title).toMatch(/erases the disturbance exactly/)
  })
})

describe('verdictBadge', () => {
  it('names the undefined verdict its own way, not as UNSTABLE', () => {
    const badge = verdictBadge('undefined')
    expect(badge.badge).not.toBe('UNSTABLE')
    expect(badge.full).toMatch(/all-zero denominator/)
  })
})

describe('bodeMarginNote', () => {
  it('gives the undefined verdict its own sentence ahead of "phase never reaches"', () => {
    const note = bodeMarginNote('undefined', null)
    expect(joinParts(note.parts)).toMatch(/all-zero denominator/)
    expect(joinParts(note.parts)).not.toMatch(/phase never reaches/)
  })

  // Round three's contradiction: the unstable plant under PI or PID at the
  // default Kp = 5 read "past the boundary, it sits at 0.20x this gain"
  // beside a badge saying stable and closed-loop step that settles. Correct
  // arithmetic, no sentence anywhere saying this plant's failure mode runs
  // the other way, and a first-year reader had no way to resolve it.
  it('reads as a warning for an ordinary plant, and as safe for an inverted one, at the same 0.20x', () => {
    const ordinary = bodeMarginNote('stable', 0.2, false)
    expect(joinParts(ordinary.parts)).toMatch(/past the boundary/)
    const inverted = bodeMarginNote('stable', 0.2, true)
    expect(joinParts(inverted.parts)).toMatch(/safe/)
    expect(joinParts(inverted.parts)).not.toMatch(/past the boundary/)
    // Same measured number either way — only the sentence around it changes.
    expect(joinParts(inverted.parts)).toContain('0.20×')
  })

  it('defaults to the ordinary reading when inverted is left unstated', () => {
    expect(joinParts(bodeMarginNote('stable', 0.2).parts)).toMatch(/past the boundary/)
  })

  it('room to spare (gain margin above 1x) reads the same regardless of inverted', () => {
    expect(joinParts(bodeMarginNote('stable', 5, true).parts)).toMatch(/room for/)
    expect(joinParts(bodeMarginNote('stable', 5, false).parts)).toMatch(/room for/)
  })
})

describe('plantInverted', () => {
  it('is true for the unstable plant alone, at the loop the grading round measured', () => {
    // Unstable plant under PI at the registry's own Kp = 5 default — the
    // exact loop round-three grading read the contradiction on.
    const loop = buildLoop('unstable', { k: 1, p: 1 }, 'pi', ctrlDefaultsFor('unstable', { k: 1, p: 1 }, 'pi'))
    expect(plantInverted(loop)).toBe(true)
  })

  it('is false for every ordinary plant in the catalog', () => {
    for (const id of Object.keys(PLANTS)) {
      if (id === 'unstable') continue
      const plantP = defaultsOf(PLANTS[id])
      const loop = buildLoop(id, plantP, 'p', defaultsOf(CONTROLLERS.p))
      expect(plantInverted(loop), id).toBe(false)
    }
  })

  it('reads the PLANT alone: a controller cannot move it either way', () => {
    const plantP = { k: 1, p: 1 }
    for (const cid of Object.keys(CONTROLLERS)) {
      const loop = buildLoop('unstable', plantP, cid, ctrlDefaultsFor('unstable', plantP, cid))
      expect(plantInverted(loop), cid).toBe(true)
    }
  })
})
