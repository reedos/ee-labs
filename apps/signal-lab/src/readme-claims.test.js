import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { PRESETS } from './presets.js'
import { LESSONS as CIRCUIT_LESSONS } from '../../circuit-lab/src/lessons.js'
import { CIRCUITS, transferOf, defaultsOf } from '../../circuit-lab/src/circuits.js'
import { asDigitalFilter, asControlPlant } from '../../circuit-lab/src/toSignalLab.js'
import { LESSONS as CONTROL_LESSONS } from '../../control-lab/src/lessons.js'
import { PLANTS, CONTROLLERS } from '../../control-lab/src/systems.js'

// The root README and the splash page quote numbers - lesson counts, and two
// pasted hand-over links. Those are exactly the numbers the README itself
// warns about: "the ones that drift when a default changes and nobody
// notices". They drifted (29 lessons when there were 32, an example link
// still carrying the retired noise default), so now they are pinned the way
// every other quoted number in the suite is: by a test that fails with the
// true value in its message when the prose falls behind.

const root = join(__dirname, '..', '..', '..')
const readme = readFileSync(join(root, 'README.md'), 'utf8')
const splash = readFileSync(join(root, 'site', 'index.html'), 'utf8')

describe('the README quotes the tree it describes', () => {
  it('curriculum counts match the arrays that render them', () => {
    expect(readme).toContain(`${PRESETS.length} lessons`)
    expect(readme).toContain(
      `${CIRCUIT_LESSONS.length} lessons, ${Object.keys(CIRCUITS).length} circuits`,
    )
    expect(readme).toContain(
      `${CONTROL_LESSONS.length} lessons, ${Object.keys(PLANTS).length} plants x ${Object.keys(CONTROLLERS).length} controllers`,
    )
  })

  it('the pasted Signal Lab link is what the emitter emits today', () => {
    const p = defaultsOf('rlcSeries')
    const d = asDigitalFilter(transferOf('rlcSeries', p, 'c'), { sampleRate: 192000 })
    expect(readme).toContain(`#${d.link}`)
    // And the numbers quoted in the surrounding prose.
    expect(d.f0).toBeCloseTo(5032.92, 1)
    expect(d.q).toBeCloseTo(3.16228, 4)
  })

  it('the pasted Control Lab link is what the emitter emits today', () => {
    const p = defaultsOf('rlcSeries')
    const d = asControlPlant(transferOf('rlcSeries', p, 'c'))
    expect(readme).toContain(`#${d.link}`)
  })
})

describe('the splash page quotes the tree it describes', () => {
  it('lab-card counts match the arrays that render them', () => {
    expect(splash).toContain(`${PRESETS.length} guided lessons`)
    expect(splash).toContain(
      `${CIRCUIT_LESSONS.length} lessons, ${Object.keys(CIRCUITS).length} circuits`,
    )
    expect(splash).toContain(
      `${CONTROL_LESSONS.length} lessons, ${Object.keys(PLANTS).length} plants`,
    )
  })
})
