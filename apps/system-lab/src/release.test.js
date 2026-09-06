import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

// The dark launch, enforced. `RELEASE_STATUS` is one word, `dark` or
// `released`, and Reed alone changes it. While it says `dark`, the lab is built
// and deployed at /system-lab/ but nothing a visitor sees may point at it: not
// the splash page, not the root README, not the other labs' nav. When it says
// `released`, the same test inverts and demands every link.
//
// `PROGRAM.md` §5 gives `.github/workflows/deploy.yml` to the director, who
// adds one `cp` line per dark lab at integration, taken from that lab's
// `NEEDS.md`. So this file says nothing about the workflow. It holds this lab's
// own half of the hand-over, which is that the line is on file in the exact
// text the workflow takes.

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..', '..', '..')
const read = (p) => readFileSync(join(root, p), 'utf8')

const status = read('apps/system-lab/RELEASE_STATUS').trim()

/** The surfaces a visitor reaches without knowing the URL. */
const PUBLIC = ['site/index.html', 'README.md', 'packages/ui/src/LabNav.jsx']

/** The line `apps/system-lab/NEEDS.md` offers the director for the workflow. */
const DEPLOY = 'cp -r apps/system-lab/dist _site/system-lab'

describe(`release status "${status}"`, () => {
  it('is one of the two words the plan allows', () => {
    expect(['dark', 'released']).toContain(status)
  })

  if (status === 'dark') {
    for (const p of PUBLIC) {
      it(`${p} does not mention the lab`, () => {
        expect(read(p)).not.toMatch(/system-lab|System Lab/)
      })
    }
  } else {
    for (const p of PUBLIC) {
      it(`${p} links the lab`, () => {
        expect(read(p)).toMatch(/system-lab/)
      })
    }
  }

  it('NEEDS.md carries the deploy line, in the text the workflow takes', () => {
    expect(read('apps/system-lab/NEEDS.md')).toContain(DEPLOY)
  })
})
