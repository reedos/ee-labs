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

  // The deploy line is the director's, not this lab's. `PROGRAM.md` §5 gives
  // `.github/workflows/deploy.yml` to the director, who adds one `cp` per dark
  // lab at integration, taken from that lab's `NEEDS.md`. So the assertion here
  // is over this lab's own half of the hand-over: the line is on file, in the
  // exact text the workflow takes, and the workflow ships this build at that
  // path or at none.
  const DEPLOY = 'cp -r apps/fields-lab/dist _site/fields-lab'

  it('NEEDS.md carries the deploy line, in the text the workflow takes', () => {
    expect(read('apps/fields-lab/NEEDS.md')).toContain(DEPLOY)
  })

  it('the deploy workflow ships this build at the dark URL, or does not ship it yet', () => {
    const named = read('.github/workflows/deploy.yml')
      .split('\n')
      .filter((l) => l.includes('fields-lab'))
      .map((l) => l.trim())
    for (const line of named) expect(line).toBe(DEPLOY)
  })
})
