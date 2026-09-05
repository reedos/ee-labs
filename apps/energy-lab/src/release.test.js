import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

// The dark launch, enforced — Circuit Elements Lab's gate, for this lab.
// RELEASE_STATUS is one word — `dark` or `released` — and Reed alone changes
// it. While it says `dark`, the lab is built and deployed at /energy-lab/ but
// nothing a visitor sees may point at it: not the splash page, not the
// README, not the other labs' nav. When it says `released`, the same test
// inverts and demands every link.
//
// The deploy workflow's own `cp -r apps/energy-lab/dist _site/energy-lab`
// line is not asserted here. `deploy.yml` is a shared surface this lab does
// not own (PROGRAM.md §5); the line is recorded as a need in `NEEDS.md`
// instead, and the director adds it at integration. Asserting it here would
// make this suite red until a file this lab cannot touch changes, which is
// the failure ENERGY_LAB_PLAN.md §7 is written to avoid.

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..', '..', '..')
const read = (p) => readFileSync(join(root, p), 'utf8')

const status = read('apps/energy-lab/RELEASE_STATUS').trim()

// The surfaces a visitor reaches without knowing the URL.
const PUBLIC = ['site/index.html', 'README.md', 'packages/ui/src/LabNav.jsx']

describe(`release status "${status}"`, () => {
  it('is one of the two words the plan allows', () => {
    expect(['dark', 'released']).toContain(status)
  })

  if (status === 'dark') {
    for (const p of PUBLIC) {
      it(`${p} does not mention the lab`, () => {
        expect(read(p)).not.toMatch(/energy-lab|Energy Lab/)
      })
    }
    it('the page carries no usage counter while dark: the tag joins at release', () => {
      expect(read('apps/energy-lab/index.html')).not.toMatch(/data-goatcounter|gc\.zgo\.at/)
    })
  } else {
    for (const p of PUBLIC) {
      it(`${p} links the lab`, () => {
        expect(read(p)).toMatch(/energy-lab/)
      })
    }
    it('the page carries the usage counter once released', () => {
      expect(read('apps/energy-lab/index.html')).toMatch(/data-goatcounter/)
    })
    it('the deploy workflow ships the build, now that the lab is public', () => {
      expect(read('.github/workflows/deploy.yml')).toMatch(/apps\/energy-lab\/dist\s+_site\/energy-lab/)
    })
  }
})
