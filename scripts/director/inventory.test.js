import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { inventory, summarize } from './inventory.mjs'
import { LABS } from '../assemble-site.mjs'

describe('program inventory', () => {
  it('counts actual records and preserves their group names', () => {
    expect(summarize('example', [
      { id: 'a1', group: 'A' }, { id: 'a2', group: 'A' }, { id: 'b1', group: 'B' },
    ])).toEqual({ slug: 'example', count: 3, groups: ['A', 'B'], ids: ['a1', 'a2', 'b1'] })
  })
  it('supports legacy named lessons', () => {
    expect(summarize('legacy', [{ name: 'First lesson' }]).ids).toEqual(['First lesson'])
  })
  it.each([undefined, [], [{}], [{ id: ' ' }], [{ id: 'a1' }, { id: 'a1' }]])(
    'rejects missing or ambiguous curriculum records: %j', (records) => {
      expect(() => summarize('invalid', records)).toThrow('invalid:')
    },
  )

  it('keeps one current ledger row per app with the executable count and a real plan', async () => {
    const root = new URL('../../', import.meta.url)
    const doc = readFileSync(new URL('BACKLOG.md', root), 'utf8')
    const section = doc.split('## 1. The ledger')[1].split('### Current assignments')[0]
    const rows = section.split('\n').filter((line) => /^\| `[a-z][a-z-]+` \|/.test(line))
      .map((line) => line.split('|').slice(1, -1).map((cell) => cell.trim()))
    const actual = await inventory(fileURLToPath(root))
    expect([...LABS].sort(), 'local sibling-path assembly must include every app').toEqual(actual.map(({ slug }) => slug).sort())
    const bySlug = new Map(actual.map((row) => [row.slug, row]))
    const slugs = rows.map(([slug]) => slug.replaceAll('`', ''))
    expect(rows.length).toBeGreaterThan(0)
    expect(new Set(slugs).size).toBe(rows.length)
    for (const [slugCell, count, , , , plan] of rows) {
      const slug = slugCell.replaceAll('`', '')
      expect(Number(count), slug).toBe(bySlug.get(slug)?.count ?? 0)
      expect(existsSync(new URL(plan.replaceAll('`', ''), root)), `${slug} plan`).toBe(true)
    }
    for (const { slug } of actual) expect(slugs, `${slug} missing from ledger`).toContain(slug)
  }, 60000)
})
