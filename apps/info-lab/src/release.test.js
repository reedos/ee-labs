import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { EXPERIMENTS } from './experiments.js'
import { TERMS } from './terms.js'

// The dark launch, enforced. RELEASE_STATUS is one word — `dark` or
// `released` — and Reed alone changes it. While it says `dark`, the lab is
// built and deployed at /info-lab/ but nothing a visitor sees may point at it:
// not the splash page, not the README, not the other labs' nav. When it says
// `released`, the same test inverts and demands every link.

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..', '..', '..')
const read = (p) => readFileSync(join(root, p), 'utf8')

const status = read('apps/info-lab/RELEASE_STATUS').trim()

// The surfaces a visitor reaches without knowing the URL.
const PUBLIC = ['site/index.html', 'README.md', 'packages/ui/src/LabNav.jsx']

describe(`release status "${status}"`, () => {
  it('is one of the two words the plan allows', () => {
    expect(['dark', 'released']).toContain(status)
  })

  if (status === 'dark') {
    for (const p of PUBLIC) {
      it(`${p} does not mention the lab`, () => {
        expect(read(p)).not.toMatch(/info-lab|Information Lab/)
      })
    }
  } else {
    for (const p of PUBLIC) {
      it(`${p} links the lab`, () => {
        expect(read(p)).toMatch(/info-lab/)
      })
    }
  }

  it('the deploy workflow ships the build, or NEEDS.md asks the director for the line', () => {
    // `.github/workflows/deploy.yml` is the director's file (PROGRAM.md §5),
    // and this lab may not edit it. Until integration adds the line, the
    // request has to be on the record with the exact text, so that what is
    // missing is written down rather than remembered.
    const line = /apps\/info-lab\/dist\s+_site\/info-lab/
    if (line.test(read('.github/workflows/deploy.yml'))) return
    expect(read('apps/info-lab/NEEDS.md')).toMatch(line)
  })

  it('no lesson references an experiment that is not built, here or in another lab', () => {
    // Group F and B4 wait on the Communications Lab (BACKLOG.md), so no
    // sentence may point at them, and no sentence may name an experiment of a
    // lab that has not shipped. A reference to F1 or to Communications D3 is
    // exactly the failure this test exists to catch.
    const ids = new Set(EXPERIMENTS.map((e) => e.id.toUpperCase()))
    const prose = [
      ...EXPERIMENTS.flatMap((e) => [e.name, e.see, e.why, ...(e.try || []).map((t) => t.say)]),
      ...Object.values(TERMS).flatMap((t) => [t.name, t.def]),
    ]
    for (const text of prose) {
      expect(text, text.slice(0, 40)).not.toMatch(/\b(?:Communications|Random Signals|Signal|DSP|Electronics)\s+[A-H]\d/)
      for (const m of String(text).matchAll(/\b([A-F])(\d)\b/g)) {
        expect(ids.has(m[0]), `"${m[0]}" in "${text.slice(0, 40)}…" is not an experiment this lab has built`).toBe(true)
      }
    }
    expect(prose.length).toBeGreaterThan(EXPERIMENTS.length * 3)
  })

  it('claims nothing about testing in a lesson, which is README and CONTRIBUTING territory', () => {
    // STYLE.md S14. The engine's own tests are named in the brief and in the
    // package, and a student's screen does not talk about them.
    for (const e of EXPERIMENTS) {
      for (const text of [e.see, e.why, ...(e.try || []).map((t) => t.say)]) {
        expect(text, `${e.id}`).not.toMatch(/\b(test|tests|tested|fuzz|vitest|suite)\b/i)
      }
    }
  })
})
