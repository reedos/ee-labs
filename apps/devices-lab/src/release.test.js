import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

// The dark launch, enforced. RELEASE_STATUS is one word — `dark` or
// `released` — and Reed alone changes it. While it says `dark`, the lab is
// built (and, once the director integrates it, deployed at /devices-lab/) but
// nothing outside `apps/devices-lab/` may point at it: not the splash page,
// not the README, not the other labs' nav. When it says `released`, the same
// test inverts and demands every link.
//
// The deploy workflow's one `cp` line is the director's, added at integration
// from this lab's NEEDS.md (PROGRAM.md §5). It is not asserted here, because
// until the director integrates this branch the line does not exist yet, and
// this test must not require an action that is not this overseer's to take.

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..', '..', '..')
const read = (p) => readFileSync(join(root, p), 'utf8')

const status = read('apps/devices-lab/RELEASE_STATUS').trim()

// The surfaces a visitor reaches without knowing the URL.
const PUBLIC = ['site/index.html', 'README.md', 'packages/ui/src/LabNav.jsx']

describe(`release status "${status}"`, () => {
  it('is one of the two words the plan allows', () => {
    expect(['dark', 'released']).toContain(status)
  })

  if (status === 'dark') {
    for (const p of PUBLIC) {
      it(`${p} does not mention the lab`, () => {
        expect(read(p)).not.toMatch(/devices-lab|Devices Lab/)
      })
    }
    it('the page carries no usage counter while dark: the tag joins at release', () => {
      expect(read('apps/devices-lab/index.html')).not.toMatch(/data-goatcounter|gc\.zgo\.at/)
    })
  } else {
    for (const p of PUBLIC) {
      it(`${p} links the lab`, () => {
        expect(read(p)).toMatch(/devices-lab/)
      })
    }
    it('the page carries the usage counter once released', () => {
      expect(read('apps/devices-lab/index.html')).toMatch(/data-goatcounter/)
    })
  }
})
