import { describe, it, expect } from 'vitest'
import { bode, errorLoop, magnitudeAt, margins, phaseAt, series, closeLoop, isStable } from '@ee-labs/systems'
import { checkFailures, texFailures, valueRowsPretendingToCheck, rowsOf, inertRows } from '@ee-labs/explain/testing'
import { PLANTS, CONTROLLERS, buildLoop, defaultsOf } from './systems.js'
import { loopMath } from './math.js'

// The phase rules the app prints, measured.
//
// The hints and the math panel now lead with three rules — each pole costs up
// to 90° of lag and has spent 45° at its corner, an integrator is a flat −90°
// everywhere, zeros add phase on the same schedule — and every number in that
// sentence is a claim about physics. These tests read each one off bode() and
// margins() rather than trusting the prose, because the prose is exactly what
// drifts when a definition changes and nobody notices.

const logspace = (lo, hi, n) =>
  Float64Array.from(
    { length: n },
    (_, i) => Math.pow(10, Math.log10(lo) + ((Math.log10(hi) - Math.log10(lo)) * i) / (n - 1)),
  )
const deg = (r) => (r * 180) / Math.PI
const phaseDegOn = (tf, freqs) => Array.from(bode(tf, freqs).phase, deg)

describe('the phase rules the hints print', () => {
  it('a first-order lag spends 45° at its corner and never the full 90°', () => {
    const tau = 0.7
    const p = PLANTS.firstOrder.tf({ k: 3, tau })
    const corner = 1 / (2 * Math.PI * tau)
    // An odd, log-symmetric grid puts the corner exactly on the middle point.
    const grid = logspace(corner / 1000, corner * 1000, 2001)
    const ph = phaseDegOn(p, grid)
    expect(ph[1000], '45° of lag at ω = 1/τ').toBeCloseTo(-45, 6)
    expect(Math.min(...ph), 'one pole never costs the full 90°').toBeGreaterThan(-90)
    // ...so the hint's stability claim follows: even a million of gain finds
    // no −180° to cross, and the closed loop stays stable.
    const L = series({ b: [1e6], a: [1] }, p)
    expect(margins(L, grid).gainMargin, 'no phase crossover exists').toBeNull()
    expect(isStable(closeLoop(L))).toBe(true)
  })

  it('the motor holds between −90° and −180°, approaching but never arriving', () => {
    const p = PLANTS.motor.tf(defaultsOf(PLANTS.motor))
    const grid = logspace(1e-6, 1e6, 4000)
    const ph = phaseDegOn(p, grid)
    expect(Math.max(...ph), "the integrator's floor").toBeLessThan(-89.99)
    expect(Math.min(...ph), 'the lag never adds its full 90°').toBeGreaterThan(-180)
    // Proportional gain moves none of that phase: at any gain the sliders
    // allow there is no phase crossover and no way to go unstable.
    for (const kp of [0.001, 1, 1000]) {
      const L = series(CONTROLLERS.p.tf({ kp }), p)
      expect(margins(L, grid).gainMargin, `Kp ${kp}`).toBeNull()
      expect(isStable(closeLoop(L)), `Kp ${kp}`).toBe(true)
    }
  })

  it("the integrator's −90° really is flat across every frequency", () => {
    const grid = logspace(1e-9, 1e9, 2000)
    for (const v of phaseDegOn({ b: [1], a: [1, 0] }, grid)) expect(v).toBeCloseTo(-90, 9)
    // The panel reads the claim off the live controller far below its corner;
    // that read must hold even at the worst corner the sliders can build.
    expect(deg(phaseAt(CONTROLLERS.pi.tf({ kp: 1000, ki: 0.001 }), 1e-12))).toBeCloseTo(-90, 1)
    expect(deg(phaseAt(CONTROLLERS.pid.tf({ kp: 1000, ki: 0.001, kd: 100 }), 1e-12))).toBeCloseTo(-90, 1)
  })

  it("derivative action climbs from the integrator's −90° to +90°", () => {
    const c = CONTROLLERS.pid.tf(defaultsOf(CONTROLLERS.pid))
    const grid = logspace(1e-6, 1e8, 3000)
    const ph = phaseDegOn(c, grid)
    expect(ph[0]).toBeCloseTo(-90, 1)
    expect(ph[ph.length - 1], 'up to +90, as printed').toBeCloseTo(90, 1)
  })

  it('lead adds phase between z and p, peaking at their geometric mean', () => {
    const z = 2
    const p = 180
    const c = CONTROLLERS.lead.tf({ k: 1, z, p })
    const geo = Math.sqrt(z * p) / (2 * Math.PI)
    const grid = logspace(geo / 1e5, geo * 1e5, 4001)
    const ph = phaseDegOn(c, grid)
    const peakAt = grid[ph.indexOf(Math.max(...ph))]
    expect(peakAt / geo, 'peak at √(z·p)').toBeCloseTo(1, 1)
    expect(Math.max(...ph)).toBeGreaterThan(45)
    // ...and far outside the band it gives every degree back.
    expect(ph[0]).toBeCloseTo(0, 0)
    expect(ph[ph.length - 1]).toBeCloseTo(0, 0)
  })

  it('a second-order pair falls through −90° at ωₙ, 180° in total, faster when light', () => {
    const at = (zeta) => {
      const wn = 40
      const f0 = wn / (2 * Math.PI)
      const grid = logspace(f0 / 100, f0 * 100, 2001)
      return phaseDegOn(PLANTS.secondOrder.tf({ k: 1, wn, zeta }), grid)
    }
    const light = at(0.05)
    const heavy = at(1)
    expect(light[1000], '−90° at ωₙ regardless of damping').toBeCloseTo(-90, 4)
    expect(heavy[1000]).toBeCloseTo(-90, 4)
    expect(light[2000], 'the pair spends 180° in total').toBeCloseTo(-180, 0)
    // "the lighter the damping, the more abruptly": the slope at ωₙ.
    const slope = (ph) => Math.abs(ph[1001] - ph[999])
    expect(slope(light)).toBeGreaterThan(slope(heavy))
  })
})

describe('the phase margin stays on the circle', () => {
  const GRID = logspace(1e-6, 1e6, 6000)

  it('the unstable plant under Kp 5 reads 78.5°, not 438.5°', () => {
    // bode() anchors this plant at +180° (negative DC gain), so the raw
    // 180 + ∠L was a full turn high — 438.5°, printed verbatim in the topbar
    // until a test pinned it. The fold now lives in margins() itself: the
    // NEEDS.md handshake worked as designed — the pinned raw value flagged
    // the app-local workaround as dead code, and that workaround is gone.
    const L = series(CONTROLLERS.p.tf({ kp: 5 }), PLANTS.unstable.tf({ k: 1, p: 1 }))
    expect(margins(L, GRID).phaseMargin).toBeCloseTo(78.5, 0)
  })

  it('no default pairing shows a margin outside (−180°, 180°]', () => {
    for (const plantId of Object.keys(PLANTS)) {
      for (const ctrlId of Object.keys(CONTROLLERS)) {
        const loop = buildLoop(plantId, defaultsOf(PLANTS[plantId]), ctrlId, defaultsOf(CONTROLLERS[ctrlId]))
        const pm = margins(loop.open, GRID).phaseMargin
        if (pm != null) {
          expect(Math.abs(pm) <= 180, `${plantId} + ${ctrlId}: ${pm}`).toBe(true)
        }
      }
    }
  })
})

describe("the math panel's phase accounting", () => {
  const GRID = logspace(1e-6, 1e6, 6000)
  const entryFor = (plantId, ctrlId, plantOver = {}, ctrlOver = {}) => {
    const plantP = { ...defaultsOf(PLANTS[plantId]), ...plantOver }
    const ctrlP = { ...defaultsOf(CONTROLLERS[ctrlId]), ...ctrlOver }
    const loop = buildLoop(plantId, plantP, ctrlId, ctrlP)
    // margins() folds onto the circle at the source now, so unstable + PI
    // reads PM ≈ 0.0002° and rightly triggers the near-boundary footnote —
    // the case that once slipped past as 360.0002°.
    const marg = margins(loop.open, GRID)
    return loopMath(plantId, plantP, ctrlId, ctrlP, loop, marg, GRID)
  }

  // The regression checkFailures/valueRowsPretendingToCheck cannot see: both
  // only ever inspect CHECK rows (a predicted-vs-measured pair). The math
  // panel's own phase-accounting row is a plain VALUES row that quotes an
  // angle and carries a note claiming to BE the phase margin — so a copy
  // that drifts 360° from the topbar's own margin (the shipped defect: the
  // unstable plant's row read 447.134° beside a topbar reading 87.1°, under
  // every controller) ticks nothing and fails no existing check. Local to
  // this app because the shared guards live in packages/explain/testing.js,
  // out of this agent's territory — this closes the hole here instead of
  // there.
  function offCircleValueRows(entry, label = '') {
    const out = []
    for (const r of rowsOf(entry, 'values')) {
      if (r.unit !== '°' || r.note !== 'the phase margin' || !Number.isFinite(r.value)) continue
      if (Math.abs(r.value) > 180 + 1e-6) {
        out.push(`${label} / ${r.label}: ${r.value}° is off the circle`)
      }
    }
    return out
  }

  it('every check row agrees for every plant against every controller, and no value row claiming to be the phase margin sits off the circle', () => {
    for (const plantId of Object.keys(PLANTS)) {
      for (const ctrlId of Object.keys(CONTROLLERS)) {
        const label = `${plantId} + ${ctrlId}`
        const entry = entryFor(plantId, ctrlId)
        expect(entry, label).toBeTruthy()
        expect(checkFailures(entry, label)).toEqual([])
        expect(texFailures(entry, label)).toEqual([])
        expect(valueRowsPretendingToCheck(entry, label)).toEqual([])
        expect(offCircleValueRows(entry, label)).toEqual([])
      }
    }
  })

  it('the phase-accounting row folds the same way the topbar does, under every controller — the 360° regression', () => {
    // The unstable plant's own repro (438.5° before margins() itself was
    // fixed) reproduced one panel over: 180° + the raw accounting total read
    // 447.134° while the topbar read 87.1° at Kp = 20. Swept across every
    // controller and a spread of gains, both rows must now agree.
    for (const ctrlId of Object.keys(CONTROLLERS)) {
      for (const kpLike of [0.2, 5, 20, 80]) {
        const over = ctrlId === 'lead' ? { k: kpLike } : { kp: kpLike }
        const entry = entryFor('unstable', ctrlId, {}, over)
        const label = `unstable + ${ctrlId} @ ${kpLike}`
        expect(entry, label).toBeTruthy()
        const values = rowsOf(entry, 'values')
        const topbarPM = values.find((r) => r.label === 'phase margin')
        const panelPM = values.find((r) => r.note === 'the phase margin' && r.label !== 'phase margin')
        // The accounting row is offered exactly where a crossover exists —
        // where the topbar's own phase-margin row carries a finite value.
        const hasCrossover = Number.isFinite(topbarPM?.value)
        expect(!!panelPM, `${label}: accounting row present iff a crossover exists`).toBe(hasCrossover)
        if (hasCrossover) {
          expect(panelPM.value, label).toBeCloseTo(topbarPM.value, 6)
          expect(Math.abs(panelPM.value) <= 180, `${label}: ${panelPM.value}°`).toBe(true)
        }
      }
    }
  })

  it('the accounting rows exist where they can be measured', () => {
    // A loop with a crossover carries the ∠C + ∠P = ∠L row; a controller with
    // an integrator carries the flat −90° row. Their absence would not fail a
    // check, so their presence is pinned here.
    const rows = rowsOf(entryFor('motor', 'pi'), 'check').map((r) => r.label)
    expect(rows.some((l) => l.includes('∠C + ∠P'))).toBe(true)
    expect(rows.some((l) => l.includes('−90°'))).toBe(true)
    // Proportional on the first-order lag: crossover yes (once the gain is
    // high enough that |L| actually reaches 1 — at Kp = 1 it never does, and
    // the row is rightly absent), integrator no.
    const rowsP = rowsOf(entryFor('firstOrder', 'p', {}, { kp: 9 }), 'check').map((r) => r.label)
    expect(rowsP.some((l) => l.includes('∠C + ∠P'))).toBe(true)
    expect(rowsP.some((l) => l.includes('−90°'))).toBe(false)
  })

  it('no accounting row is inert — each one actually reads the loop', () => {
    const build = ({ tau, ki }) => entryFor('motor', 'pi', { tau }, { ki })
    expect(inertRows(build, { tau: 0.5, ki: 1 }, { tau: 1.7, ki: 3 }, 'motor + pi')).toEqual([])
  })

  it('frequencies come in both unit systems: each Hz value has its rad/s twin', () => {
    const values = rowsOf(entryFor('motor', 'p'), 'values')
    const hz = values.find((r) => r.label === 'crossover frequency')
    const rad = values.find((r) => r.unit === 'rad/s' && r.label.includes('textbook'))
    expect(hz).toBeTruthy()
    expect(rad).toBeTruthy()
    expect(rad.value).toBeCloseTo(2 * Math.PI * hz.value, 9)
    // ωₙ printed against a Hz value was a quiet unit mismatch; now each
    // symbol carries its own system and the twin sits beside it.
    const wn = values.find((r) => r.label === 'ωₙ')
    const fn = values.find((r) => r.label.startsWith('fₙ'))
    expect(wn.unit).toBe('rad/s')
    expect(wn.value).toBeCloseTo(2 * Math.PI * fn.value, 9)
  })

  it('the one-multiplication theorem: three vocabularies printed, this dialect measured', () => {
    // Reed's convolution-review rule, generalized: print the load-bearing
    // theorem in the local vocabulary, cross-referenced to the siblings, and
    // measure it before printing. The sweep above verifies the row agrees
    // for every pairing; this pins that it EXISTS and says all three names.
    const entry = entryFor('motor', 'pi')
    const texts = entry.blocks
      .filter((b) => b.kind === 'text')
      .map((b) => b.text)
      .join(' ')
    expect(texts).toContain('Y(z) = X(z)·H(z)')
    expect(texts).toContain('Y(s) = X(s)·H(s)')
    expect(texts).toContain('L = C·P')
    const rows = rowsOf(entry, 'check').map((r) => r.label)
    expect(rows.some((l) => l.includes('|C|·|P|'))).toBe(true)
    // The probe falls back mid-sweep where no crossover exists, so the
    // multiplication is measured on every loop, not just the lively ones.
    const rowsNoXover = rowsOf(entryFor('firstOrder', 'p'), 'check').map((r) => r.label)
    expect(rowsNoXover.some((l) => l.includes('|C|·|P|'))).toBe(true)
  })

  it('the sensitivity row appears exactly where a crossover exists', () => {
    const has = (entry) =>
      rowsOf(entry, 'check').some((r) => r.label.includes('price at the crossover'))
    expect(has(entryFor('motor', 'p'))).toBe(true)
    // firstOrder at Kp 1 never reaches |L| = 1: no crossover, no price row.
    expect(has(entryFor('firstOrder', 'p'))).toBe(false)
  })

  // The shipped defect: Custom H(s) with b0 = 1 and a2 = a1 = a0 = 0 is
  // P(s) = 1/0, undefined at every s. The old panel still printed "steady
  // state error" theory 0.0000 against measured 0.0000 and marked it with a
  // tick — a confident wrong number, because it never asked buildLoop
  // whether it had a system to describe. It must refuse instead: no check
  // row (nothing to tick), no value row (nothing measured), one sentence
  // naming why.
  it('an undefined plant refuses instead of ticking a division by zero', () => {
    const entry = entryFor('custom', 'p', { b2: 0, b1: 0, b0: 1, a2: 0, a1: 0, a0: 0 })
    expect(entry).toBeTruthy()
    expect(rowsOf(entry, 'check')).toEqual([])
    expect(rowsOf(entry, 'values')).toEqual([])
    const texts = entry.blocks.filter((b) => b.kind === 'text').map((b) => b.text)
    expect(texts).toEqual([
      'This H(s) has an all-zero denominator — not a system yet. Give a₂, a₁ or a₀ a value.',
    ])
  })

  // Round three: the unstable plant under PI/PID at Kp = 5 read "past the
  // boundary, it sits at 0.20x this gain" beside a badge saying stable, with
  // nothing on screen resolving the two. The Math tab now states the plant's
  // own inverted failure mode plainly, and the gain-margin row's own note
  // says the same thing right beside the number.
  it("names the plant's inverted failure mode on the Math tab, and only there", () => {
    const entry = entryFor('unstable', 'pi', {}, { kp: 5 })
    const texts = entry.blocks.filter((b) => b.kind === 'text').map((b) => b.text).join(' ')
    expect(texts).toMatch(/right half plane/)
    expect(texts).toMatch(/too little gain/)
    const gmRow = rowsOf(entry, 'values').find((r) => r.label === 'gain margin')
    expect(gmRow).toBeTruthy()
    expect(gmRow.value).toBeLessThan(1)
    expect(gmRow.note).toMatch(/safe/)

    // An ordinary plant never gets this paragraph or this row note, at any
    // gain — the explanation is structural to the PLANT, not to a thin
    // margin, and must not bleed into a loop that fails the ordinary way.
    const ordinary = entryFor('motor', 'pi', {}, { kp: 5 })
    const ordinaryTexts = ordinary.blocks.filter((b) => b.kind === 'text').map((b) => b.text).join(' ')
    expect(ordinaryTexts).not.toMatch(/too little gain/)
    const ordinaryGm = rowsOf(ordinary, 'values').find((r) => r.label === 'gain margin')
    if (ordinaryGm) expect(ordinaryGm.note).not.toMatch(/safe/)
  })
})

describe('the two doors: what the S and T prose claims', () => {
  const GRID = logspace(1e-5, 1e5, 4000)
  const doors = (loop) => ({
    S: errorLoop(loop.open),
    T: loop.closed,
  })

  it('no frequency has both |S| and |T| below ½, for any default pairing', () => {
    for (const plantId of Object.keys(PLANTS)) {
      for (const ctrlId of Object.keys(CONTROLLERS)) {
        const loop = buildLoop(plantId, defaultsOf(PLANTS[plantId]), ctrlId, defaultsOf(CONTROLLERS[ctrlId]))
        const { S, T } = doors(loop)
        const sMag = bode(S, GRID).mag
        const tMag = bode(T, GRID).mag
        for (let i = 0; i < GRID.length; i += 37) {
          expect(
            Math.max(sMag[i], tMag[i]),
            `${plantId} + ${ctrlId} at ${GRID[i]} Hz`,
          ).toBeGreaterThanOrEqual(0.5)
        }
      }
    }
  })

  it('at the crossover neither door is small, and a thin margin makes both exceed one', () => {
    // Three lags at Kp 4: PM ≈ 39°, so 1/(2·sin(19.6°)) ≈ 1.5 — both doors
    // wide open at once, exactly as the panel's paragraph says.
    const loop = buildLoop('threePole', defaultsOf(PLANTS.threePole), 'p', { kp: 4 })
    const m = margins(loop.open, GRID)
    const { S, T } = doors(loop)
    const sAt = magnitudeAt(S, m.gainCrossover)
    const tAt = magnitudeAt(T, m.gainCrossover)
    expect(sAt).toBeGreaterThan(1)
    expect(tAt).toBeGreaterThan(1)
    expect(sAt, '|T| = |L|·|S| and |L| = 1 there').toBeCloseTo(tAt, 2)
    expect(sAt, 'the price the margin sets').toBeCloseTo(
      1 / (2 * Math.sin((m.phaseMargin * Math.PI) / 360)),
      1,
    )
  })

  it('below the crossover an integrator holds S near zero — r followed, d erased, together', () => {
    const loop = buildLoop('motor', defaultsOf(PLANTS.motor), 'pi', { kp: 2, ki: 2 })
    const m = margins(loop.open, GRID)
    const { S, T } = doors(loop)
    const low = m.gainCrossover / 50
    expect(magnitudeAt(S, low)).toBeLessThan(0.05)
    expect(magnitudeAt(T, low)).toBeCloseTo(1, 1)
  })

  it('driving the loop toward its margin raises the sensitivity peak', () => {
    const peakOf = (kp) => {
      const loop = buildLoop('threePole', defaultsOf(PLANTS.threePole), 'p', { kp })
      return Math.max(...bode(errorLoop(loop.open), GRID).mag)
    }
    // Kp 9 sits just under the 11.2× gain margin: the waterbed bill.
    expect(peakOf(9)).toBeGreaterThan(2)
    expect(peakOf(9)).toBeGreaterThan(peakOf(1))
  })
})
