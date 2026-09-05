import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

// The dark launch, enforced. Adapted from Circuit Elements Lab, file for file.
//
// RELEASE_STATUS is one word, `dark` or `released`, and Reed alone changes it.
// While it says `dark`, the lab is built and deployed at /random-lab/ but
// nothing a visitor sees may point at it: not the splash page, not the README,
// not the other labs' nav. When it says `released`, the same test inverts and
// demands every link.

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..', '..', '..')
const read = (p) => readFileSync(join(root, p), 'utf8')

const status = read('apps/random-lab/RELEASE_STATUS').trim()

// The surfaces a visitor reaches without knowing the URL.
const PUBLIC = ['site/index.html', 'README.md', 'packages/ui/src/LabNav.jsx']

describe(`release status "${status}"`, () => {
  it('is one of the two words the plan allows', () => {
    expect(['dark', 'released']).toContain(status)
  })

  if (status === 'dark') {
    for (const p of PUBLIC) {
      it(`${p} does not mention the lab`, () => {
        expect(read(p)).not.toMatch(/random-lab|Random Signals Lab/)
      })
    }
  } else {
    for (const p of PUBLIC) {
      it(`${p} links the lab`, () => {
        expect(read(p)).toMatch(/random-lab/)
      })
    }
  }

  // The deploy line is the director's, added at integration from this lab's
  // NEEDS.md. Until it lands the dark URL does not exist, so the need is
  // recorded rather than the workflow edited.
  it('records the deploy line the director adds, in NEEDS.md', () => {
    expect(read('apps/random-lab/NEEDS.md')).toMatch(
      /cp -r apps\/random-lab\/dist _site\/random-lab/,
    )
  })

  it('the deploy workflow ships the build either way, so the dark URL exists to review', () => {
    // The director adds this line at integration (PROGRAM.md §5). Dark means
    // unlinked, not unbuilt: the Elements and Power labs set the convention.
    expect(read('.github/workflows/deploy.yml')).toMatch(/apps\/random-lab\/dist\s+_site\/random-lab/)
  })
})
