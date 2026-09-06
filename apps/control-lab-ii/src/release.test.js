import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

// The dark launch, enforced. Circuit Elements Lab's release test with the slug
// changed, which is what the brief asks for.
//
// RELEASE_STATUS is one word, `dark` or `released`, and Reed alone changes it.
// While it says `dark` the lab is built and deployed at /control-lab-ii/ and
// nothing a visitor sees may point at it: not the splash page, not the README,
// not the other labs' nav. Flip the word and the same test inverts and demands
// every link.
//
// One check from Elements' copy is not here. Its last case asserts the deploy
// workflow's `cp` line, and that file is the director's rather than this lab's
// (PROGRAM.md section 5). The line is requested in apps/control-lab-ii/NEEDS.md
// and the assertion belongs in this file the moment it lands.

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..', '..', '..')
const read = (p) => readFileSync(join(root, p), 'utf8')

const status = read('apps/control-lab-ii/RELEASE_STATUS').trim()

// The surfaces a visitor reaches without knowing the URL.
const PUBLIC = ['site/index.html', 'README.md', 'packages/ui/src/LabNav.jsx']
const MENTION = /control-lab-ii|Control Lab II/

describe(`release status "${status}"`, () => {
  it('is one of the two words the plan allows', () => {
    expect(['dark', 'released']).toContain(status)
  })

  if (status === 'dark') {
    for (const p of PUBLIC) {
      it(`${p} does not mention the lab`, () => {
        expect(read(p)).not.toMatch(MENTION)
      })
    }
  } else {
    for (const p of PUBLIC) {
      it(`${p} links the lab`, () => {
        expect(read(p)).toMatch(/control-lab-ii/)
      })
    }
  }

  it('the lab asks for its deploy line rather than editing the workflow itself', () => {
    // The one shared surface this lab needs, recorded where the director reads
    // it. A dark lab with no deploy line has no URL to review, so the request
    // is as load-bearing as the build.
    expect(read('apps/control-lab-ii/NEEDS.md')).toMatch(
      /cp -r apps\/control-lab-ii\/dist _site\/control-lab-ii/,
    )
  })
})
