import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

// The dark launch, enforced. RELEASE_STATUS is one word — `dark` or
// `released` — and Reed alone changes it. While it says `dark`, the lab is
// built and deployed at /instruments-lab/ but nothing a visitor sees may
// point at it: not the splash page, not the README, not the other labs' nav.
// When it says `released`, the same test inverts and demands every link.

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..', '..', '..')
const read = (p) => readFileSync(join(root, p), 'utf8')

const status = read('apps/instruments-lab/RELEASE_STATUS').trim()

// The surfaces a visitor reaches without knowing the URL.
const PUBLIC = ['site/index.html', 'README.md', 'packages/ui/src/LabNav.jsx']

describe(`release status "${status}"`, () => {
  it('is one of the two words the plan allows', () => {
    expect(['dark', 'released']).toContain(status)
  })

  if (status === 'dark') {
    for (const p of PUBLIC) {
      it(`${p} does not mention the lab`, () => {
        expect(read(p)).not.toMatch(/instruments-lab|Instruments Lab/)
      })
    }
  } else {
    for (const p of PUBLIC) {
      it(`${p} links the lab`, () => {
        expect(read(p)).toMatch(/instruments-lab/)
      })
    }
  }

  // The deploy workflow is the director's file (PROGRAM.md §5), so this lab
  // cannot add its own cp line. Until the director takes it from NEEDS.md, the
  // request is what this test checks; after integration the workflow itself is.
  it('the deploy line exists, in the workflow or in the request that will put it there', () => {
    const LINE = /cp -r apps\/instruments-lab\/dist _site\/instruments-lab/
    const shipped = LINE.test(read('.github/workflows/deploy.yml'))
    const asked = LINE.test(read('apps/instruments-lab/NEEDS.md'))
    expect(shipped || asked, 'neither deploy.yml nor NEEDS.md carries the cp line').toBe(true)
  })
})
