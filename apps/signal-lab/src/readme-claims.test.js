import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { PRESETS, PRESET_GROUPS } from './presets.js'
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
  it('experiment counts match the arrays that render them', () => {
    // "Experiments", not "guided lessons" - reader feedback: "guided" set
    // the expectation of a formal lesson plan, which these are not. Each
    // entry is a configured setup plus a question plus a tested note.
    expect(readme).toContain(`${PRESETS.length} experiments`)
    expect(readme).toContain(
      `${CIRCUIT_LESSONS.length} frequency-response lessons`,
    )
    expect(readme).toContain(
      `${CONTROL_LESSONS.length} experiments, ${Object.keys(PLANTS).length} plants x ${Object.keys(CONTROLLERS).length} controllers`,
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

describe("this app's README lists the experiments it ships", () => {
  // The "Where to start" tables drifted ten presets and one whole group
  // behind the sidebar before anything noticed — the same class of rot the
  // root-README counts are pinned against. So the tables are now pinned to
  // the PRESETS array: every preset gets a row, every row names a real
  // preset, and the rows come in the sidebar's own group order.
  const appReadme = readFileSync(join(__dirname, '..', 'README.md'), 'utf8')
  const section = appReadme.split('## Where to start')[1].split('\n## ')[0]

  const rowNames = section
    .split('\n')
    .filter((l) => l.startsWith('| ') && !l.startsWith('| |') && !l.startsWith('|--'))
    .map((l) => l.split('|')[1].trim())

  it('has exactly one row per preset, in sidebar order', () => {
    const want = PRESET_GROUPS.flatMap((g) =>
      PRESETS.filter((p) => p.group === g).map((p) => p.name),
    )
    expect(rowNames).toEqual(want)
  })

  it('names every group with its sidebar title', () => {
    for (const g of PRESET_GROUPS) {
      expect(section, g).toContain(`**${g}**`)
    }
  })
})

describe('the splash page quotes the tree it describes', () => {
  it('lab-card counts match the arrays that render them', () => {
    expect(splash).toContain(`${PRESETS.length} experiments`)
    expect(splash).toContain(
      `${CIRCUIT_LESSONS.length} frequency-response lessons`,
    )
    expect(splash).toContain(
      `${CONTROL_LESSONS.length} experiments, ${Object.keys(PLANTS).length} plants`,
    )
  })
})
