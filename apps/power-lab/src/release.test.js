import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

// The dark launch, enforced — the Circuit Elements Lab's gate, for this lab.
// RELEASE_STATUS is one word — `dark` or `released` — and Reed alone changes
// it. While it says `dark`, the lab is built and deployed at /power-lab/ but
// nothing a visitor sees may point at it: not the splash page, not the
// README, not the other labs' nav. When it says `released`, the same test
// inverts and demands every link.

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..', '..', '..')
const read = (p) => readFileSync(join(root, p), 'utf8')

const status = read('apps/power-lab/RELEASE_STATUS').trim()

// The surfaces a visitor reaches without knowing the URL.
const PUBLIC = ['site/index.html', 'README.md', 'packages/ui/src/LabNav.jsx']

describe(`release status "${status}"`, () => {
  it('is one of the two words the plan allows', () => {
    expect(['dark', 'released']).toContain(status)
  })

  if (status === 'dark') {
    for (const p of PUBLIC) {
      it(`${p} does not mention the lab`, () => {
        expect(read(p)).not.toMatch(/power-lab|Power Lab/)
      })
    }
    it('the page carries no usage counter while dark: the tag joins at release', () => {
      expect(read('apps/power-lab/index.html')).not.toMatch(/data-goatcounter|gc\.zgo\.at/)
    })
  } else {
    for (const p of PUBLIC) {
      it(`${p} links the lab`, () => {
        expect(read(p)).toMatch(/power-lab/)
      })
    }
    it('the page carries the usage counter once released', () => {
      expect(read('apps/power-lab/index.html')).toMatch(/data-goatcounter/)
    })
  }

  it('the deploy workflow ships the build either way, so the dark URL exists to review', () => {
    expect(read('.github/workflows/deploy.yml')).toMatch(/apps\/power-lab\/dist\s+_site\/power-lab/)
  })
})
