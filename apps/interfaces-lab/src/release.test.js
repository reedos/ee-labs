import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const root = new URL('../../../', import.meta.url)
const read = (path) => readFileSync(new URL(path, root), 'utf8')

describe('Interfaces Lab dark release guard', () => {
  it('remains dark for this bounded deliverable', () => {
    expect(read('apps/interfaces-lab/RELEASE_STATUS').trim()).toBe('dark')
  })
  for (const path of ['site/index.html', 'README.md', 'packages/ui/src/LabNav.jsx'])
    it(`${path} does not advertise Interfaces Lab`, () => {
      expect(read(path)).not.toMatch(/interfaces-lab|Interfaces Lab/)
    })
  it('does not load usage tracking while dark', () => {
    expect(read('apps/interfaces-lab/index.html')).not.toMatch(/data-goatcounter|gc\.zgo\.at/)
  })
})
