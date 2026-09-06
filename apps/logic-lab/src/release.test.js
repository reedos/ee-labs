import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { EXPERIMENTS } from './experiments.js'
import { TERMS } from './terms.js'

// The dark launch, enforced. RELEASE_STATUS is one word — `dark` or
// `released` — and Reed alone changes it. While it says `dark`, the lab is
// built and deployed at /logic-lab/ but nothing a visitor sees may point at
// it: not the splash page, not the README, not the other labs' nav. When it
// says `released`, the same test inverts and demands every link.

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..', '..', '..')
const read = (p) => readFileSync(join(root, p), 'utf8')

const status = read('apps/logic-lab/RELEASE_STATUS').trim()

// The surfaces a visitor reaches without knowing the URL.
const PUBLIC = ['site/index.html', 'README.md', 'packages/ui/src/LabNav.jsx']

describe(`release status "${status}"`, () => {
  it('is one of the two words the plan allows', () => {
    expect(['dark', 'released']).toContain(status)
  })

  if (status === 'dark') {
    for (const p of PUBLIC) {
      it(`${p} does not mention the lab`, () => {
        expect(read(p)).not.toMatch(/logic-lab|Logic Lab/)
      })
    }
  } else {
    for (const p of PUBLIC) {
      it(`${p} links the lab`, () => {
        expect(read(p)).toMatch(/logic-lab/)
      })
    }
  }

  it('the deploy workflow ships the build, or NEEDS.md asks the director for the line', () => {
    // `.github/workflows/deploy.yml` is the director's file (PROGRAM.md §5),
    // and this lab may not edit it. Until integration adds the line, the
    // request has to be on the record with the exact text, so that what is
    // missing is written down rather than remembered.
    const line = /apps\/logic-lab\/dist\s+_site\/logic-lab/
    if (line.test(read('.github/workflows/deploy.yml'))) return
    expect(read('apps/logic-lab/NEEDS.md')).toMatch(line)
  })

  it('no lesson references an experiment that is not built, here or in another lab', () => {
    // Two rules, and one test for both. Track D opens after Electronics D6,
    // the CMOS inverter, which is not built (LOGIC_LAB_PLAN.md Decision 7), so
    // no sentence may name an Electronics experiment at all. And a sentence
    // that points at one of this lab's own experiments has to point at one
    // that exists, which is what makes an unbuilt group's heading safe to
    // list in the sidebar.
    const ids = new Set(EXPERIMENTS.map((e) => e.id.toUpperCase()))
    const prose = [
      ...EXPERIMENTS.flatMap((e) => [e.name, e.see, e.why, ...(e.try || []).map((t) => t.say)]),
      ...Object.values(TERMS).flatMap((t) => [t.name, t.def]),
    ]
    for (const text of prose) {
      expect(text, text.slice(0, 40)).not.toMatch(/\b(?:Electronics|Analog IC|VLSI|Computer|Interfaces)\s+[A-O]\d/)
      for (const m of String(text).matchAll(/\b([A-H])(\d)\b/g)) {
        expect(ids.has(m[0]), `"${m[0]}" in "${text.slice(0, 40)}…" is not an experiment this lab has built`).toBe(true)
      }
    }
    expect(prose.length).toBeGreaterThan(EXPERIMENTS.length * 3)
  })
})
