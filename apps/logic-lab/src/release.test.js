import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

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

  it('no lesson references an experiment in a lab that is not built', () => {
    // Track D opens after Electronics D6, the CMOS inverter, which is not
    // built (LOGIC_LAB_PLAN.md Decision 7). A reference to it fails here by
    // design, and the backlog carries the deferral.
    const prose = ['src/lessons/a.js', 'src/lessons/b.js', 'src/lessons/c.js', 'src/lessons/d.js', 'src/terms.js'].map((p) => read(`apps/logic-lab/${p}`)).join('\n')
    expect(prose).not.toMatch(/\bD6\b(?!\s*·)/)
    expect(prose).not.toMatch(/Electronics [A-O]\d/)
    // Nor an experiment of this lab's own groups E to H, which are specified
    // and not built.
    expect(prose).not.toMatch(/\b[EFGH][1-9]\b/)
  })
})
