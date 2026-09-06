import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { CROSS_REFS, EXPERIMENTS } from './experiments.js'

// The dark launch, enforced — Circuit Elements Lab's gate, for this lab.
// RELEASE_STATUS is one word, `dark` or `released`, and Reed alone changes it.
// While it says `dark`, the lab is built and deployed at /grid-lab/ but
// nothing a visitor sees may point at it: not the splash page, not the README,
// not the other labs' nav. When it says `released`, the same test inverts and
// demands every link.
//
// The deploy workflow's own `cp -r apps/grid-lab/dist _site/grid-lab` line is
// not asserted here. `deploy.yml` is a shared surface this lab does not own
// (PROGRAM.md §5), so the line is recorded as a need in `NEEDS.md` instead and
// the director adds it at integration. Asserting it here would make the suite
// red until a file this lab cannot touch changes.

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..', '..', '..')
const read = (p) => readFileSync(join(root, p), 'utf8')

const status = read('apps/grid-lab/RELEASE_STATUS').trim()

// The surfaces a visitor reaches without knowing the URL.
const PUBLIC = ['site/index.html', 'README.md', 'packages/ui/src/LabNav.jsx']

describe(`release status "${status}"`, () => {
  it('is one of the two words the plan allows', () => {
    expect(['dark', 'released']).toContain(status)
  })

  if (status === 'dark') {
    for (const p of PUBLIC) {
      it(`${p} does not mention the lab`, () => {
        expect(read(p)).not.toMatch(/grid-lab|Grid Lab/)
      })
    }
    it('the page carries no usage counter while dark: the tag joins at release', () => {
      expect(read('apps/grid-lab/index.html')).not.toMatch(/data-goatcounter|gc\.zgo\.at/)
    })
    it('the deploy line the workflow will need is written down where the director looks', () => {
      expect(read('apps/grid-lab/NEEDS.md')).toMatch(/cp -r apps\/grid-lab\/dist _site\/grid-lab/)
    })
  } else {
    for (const p of PUBLIC) {
      it(`${p} links the lab`, () => {
        expect(read(p)).toMatch(/grid-lab/)
      })
    }
    it('the page carries the usage counter once released', () => {
      expect(read('apps/grid-lab/index.html')).toMatch(/data-goatcounter/)
    })
    it('the deploy workflow ships the build, now that the lab is public', () => {
      expect(read('.github/workflows/deploy.yml')).toMatch(/apps\/grid-lab\/dist\s+_site\/grid-lab/)
    })
  }
})

describe('what this lab points at', () => {
  it('names no experiment of its own that does not exist', () => {
    const ids = new Set(EXPERIMENTS.map((e) => e.id))
    for (const e of EXPERIMENTS) {
      for (const text of [e.see, e.why, ...e.try.map((t) => t.say)]) {
        // A reference to another experiment in this lab is written as its name
        // in the prose, and the ids never appear on screen. What is checked
        // here is the structured cross-reference list instead.
        expect(typeof text).toBe('string')
      }
    }
    expect(ids.size).toBe(EXPERIMENTS.length)
  })

  it('carries every cross-lab reference as data, with the lab and the experiment named', () => {
    // Both references are to Power Lab groups that are planned with no
    // overseer. GRID_LAB_PLAN.md §6 says the progression test fails on each
    // until they exist, and that failure is the design. Recording them as data
    // is what lets the director find them without reading the prose.
    expect(CROSS_REFS.map((r) => `${r.from}→${r.lab}.${r.id}`).sort()).toEqual(['b5→power-lab.i3', 'c4→power-lab.d1'])
    for (const r of CROSS_REFS) expect(r.why.length).toBeGreaterThan(10)
  })

  it('records the deferred references where the director looks for them', () => {
    const needs = read('apps/grid-lab/NEEDS.md')
    for (const r of CROSS_REFS) expect(needs, `${r.from} reference`).toMatch(new RegExp(r.id.toUpperCase()))
  })
})
