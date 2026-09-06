import { it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8')
it('keeps this bounded deliverable dark', () => {
  expect(read('../RELEASE_STATUS').trim()).toBe('dark')
  for (const path of ['../../../site/index.html', '../../../README.md', '../../../packages/ui/src/LabNav.jsx']) {
    expect(read(path)).not.toMatch(/vlsi-lab|VLSI Lab/)
  }
  expect(read('../index.html')).not.toMatch(/data-goatcounter|gc\.zgo\.at/)
})
