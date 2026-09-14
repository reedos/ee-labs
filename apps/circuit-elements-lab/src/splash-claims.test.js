import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { EXPERIMENTS } from './experiments.js'

// The splash card and the README quote a count. Both quotes drifted once, from
// 59 to 89, when the lab grew without either surface changing. Pin them to the
// registry so a quoted number is always the live number.

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..', '..', '..')
const read = (p) => readFileSync(join(root, p), 'utf8')

const count = EXPERIMENTS.length
const groups = new Set(EXPERIMENTS.map((e) => e.group)).size

describe('the public count of Circuit Elements experiments', () => {
  it('on the splash card equals the registry', () => {
    expect(read('site/index.html')).toContain(`${count} experiments, ${groups} groups`)
  })
  it('in the README table equals the registry', () => {
    expect(read('README.md')).toContain(`Live — ${count} experiments`)
  })
})
