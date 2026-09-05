import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { TimingCanvas, StateCanvas } from '@ee-labs/ui'
import { EXPERIMENTS } from './experiments.js'
import { TERMS } from './terms.js'

// The dark launch, enforced. RELEASE_STATUS is one word, `dark` or `released`,
// and Reed alone changes it. While it says `dark`, the lab is built and
// deployed at /computer-lab/ but nothing a visitor sees may point at it: not
// the splash page, not the README, not the other labs' nav. When it says
// `released`, the same test inverts and demands every link.

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..', '..', '..')
const read = (p) => readFileSync(join(root, p), 'utf8')

const status = read('apps/computer-lab/RELEASE_STATUS').trim()

// The surfaces a visitor reaches without knowing the URL.
const PUBLIC = ['site/index.html', 'README.md', 'packages/ui/src/LabNav.jsx']

describe(`release status "${status}"`, () => {
  it('is one of the two words the plan allows', () => {
    expect(['dark', 'released']).toContain(status)
  })

  if (status === 'dark') {
    for (const p of PUBLIC) {
      it(`${p} does not mention the lab`, () => {
        expect(read(p)).not.toMatch(/computer-lab|Computer Lab/)
      })
    }
  } else {
    for (const p of PUBLIC) {
      it(`${p} links the lab`, () => {
        expect(read(p)).toMatch(/computer-lab/)
      })
    }
  }

  it('the deploy workflow ships the build, or NEEDS.md asks the director for the line', () => {
    // `.github/workflows/deploy.yml` is the director's file (PROGRAM.md §5),
    // and this lab may not edit it. Until integration adds the line, the
    // request has to be on the record with the exact text, so that what is
    // missing is written down rather than remembered.
    const line = /apps\/computer-lab\/dist\s+_site\/computer-lab/
    if (line.test(read('.github/workflows/deploy.yml'))) return
    expect(read('apps/computer-lab/NEEDS.md')).toMatch(line)
  })

  it('no lesson references an experiment that is not built, here or in another lab', () => {
    // Two rules, and one test for both. The VLSI Lab, which this lab's model
    // card quotes, is not built, so no sentence may name an experiment in it
    // or in any other unbuilt lab. And a sentence that points at one of this
    // lab's own experiments has to point at one that exists.
    const ids = new Set(EXPERIMENTS.map((e) => e.id.toUpperCase()))
    const prose = [
      ...EXPERIMENTS.flatMap((e) => [e.name, e.see, e.why, ...(e.try || []).map((t) => t.say)]),
      ...Object.values(TERMS).flatMap((t) => [t.name, t.def]),
    ]
    for (const text of prose) {
      expect(text, text.slice(0, 40)).not.toMatch(/\b(?:Electronics|Analog IC|VLSI|Interfaces|Mixed-Signal)\s+[A-O]\d/)
      for (const m of String(text).matchAll(/\b([A-G])(\d)\b/g)) {
        expect(ids.has(m[0]), `"${m[0]}" in "${text.slice(0, 40)}…" is not an experiment this lab has built`).toBe(true)
      }
    }
    expect(prose.length).toBeGreaterThan(EXPERIMENTS.length * 3)
  })

  it('imports the two promoted canvases from @ee-labs/ui rather than a local copy', () => {
    // `TimingCanvas` and `StateCanvas` were the Logic Lab's, copied here until
    // `packages/ui` promoted them (NEEDS.md §3). The copy and the comment that
    // recorded its provenance are gone. The import resolving is what is left
    // to check.
    expect(TimingCanvas).toBeTypeOf('function')
    expect(StateCanvas).toBeTypeOf('function')
  })

  it('adds no file to the events package, which is the Logic Lab’s', () => {
    // The director's ruling: `packages/events` stays generic and stays that
    // lab's. Everything this lab needed went into its own engine directory.
    const engine = read('apps/computer-lab/AGENT_BRIEF.md')
    expect(engine).toMatch(/`packages\/events` is the Logic Lab's, and it stays generic/)
    expect(read('apps/computer-lab/src/engine/cache.js').length).toBeGreaterThan(1000)
    expect(read('apps/computer-lab/src/engine/datapath.js').length).toBeGreaterThan(1000)
  })
})
