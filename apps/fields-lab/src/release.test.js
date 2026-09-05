import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

// The dark launch, enforced — Circuit Elements Lab's file, with the slug
// changed. RELEASE_STATUS is one word — `dark` or `released` — and Reed alone
// changes it. While it says `dark`, the lab is built and deployed at
// /fields-lab/ but nothing a visitor sees may point at it: not the splash
// page, not the README, not the other labs' nav. When it says `released`, the
// same test inverts and demands every link.

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..', '..', '..')
const read = (p) => readFileSync(join(root, p), 'utf8')

const status = read('apps/fields-lab/RELEASE_STATUS').trim()

// The surfaces a visitor reaches without knowing the URL.
const PUBLIC = ['site/index.html', 'README.md', 'packages/ui/src/LabNav.jsx']

describe(`release status "${status}"`, () => {
  it('is one of the two words the plan allows', () => {
    expect(['dark', 'released']).toContain(status)
  })

  if (status === 'dark') {
    for (const p of PUBLIC) {
      it(`${p} does not mention the lab`, () => {
        expect(read(p)).not.toMatch(/fields-lab|Fields Lab/)
      })
    }
  } else {
    for (const p of PUBLIC) {
      it(`${p} links the lab`, () => {
        expect(read(p)).toMatch(/fields-lab/)
      })
    }
  }

  // NEEDS.md §1 carries this line for the director to add at integration.
  // Until it lands, this one assertion is red by design — the same gate every
  // dark lab in this suite passes through before its build is reachable at
  // its own dark URL.
  it('the deploy workflow ships the build either way, so the dark URL exists to review', () => {
    expect(read('.github/workflows/deploy.yml')).toMatch(/apps\/fields-lab\/dist\s+_site\/fields-lab/)
  })
})
