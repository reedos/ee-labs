import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

// The dark launch, enforced — the Fields Lab's file, with the slug changed and
// the deploy assertion left to the director.
//
// RELEASE_STATUS is one word, `dark` or `released`, and Reed alone changes it.
// While it says `dark`, the lab is built and deployed at /rf-lab/ but nothing a
// visitor sees may point at it: not the splash page, not the README, not the
// other labs' nav. When it says `released`, the same test inverts and demands
// every link.
//
// `.github/workflows/deploy.yml` is not asserted over here at all.
// `PROGRAM.md` §5 gives that file to the director, who adds one `cp` line per
// dark lab at integration from the lab's own `NEEDS.md`. This lab's half of
// that hand-over is the line being on file in the exact text the workflow
// takes, and that is what is checked.

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..', '..', '..')
const read = (p) => readFileSync(join(root, p), 'utf8')

const status = read('apps/rf-lab/RELEASE_STATUS').trim()

// The surfaces a visitor reaches without knowing the URL.
const PUBLIC = ['site/index.html', 'README.md', 'packages/ui/src/LabNav.jsx']

describe(`release status "${status}"`, () => {
  it('is one of the two words the plan allows', () => {
    expect(['dark', 'released']).toContain(status)
  })

  if (status === 'dark') {
    for (const p of PUBLIC) {
      it(`${p} does not mention the lab`, () => {
        expect(read(p)).not.toMatch(/rf-lab|RF Lab/)
      })
    }
  } else {
    for (const p of PUBLIC) {
      it(`${p} links the lab`, () => {
        expect(read(p)).toMatch(/rf-lab/)
      })
    }
  }

  const DEPLOY = 'cp -r apps/rf-lab/dist _site/rf-lab'

  it('NEEDS.md carries the deploy line, in the text the workflow takes', () => {
    expect(read('apps/rf-lab/NEEDS.md')).toContain(DEPLOY)
  })
})
