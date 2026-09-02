import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

// The stylesheet's one collision with the shared one, pinned.
//
// packages/ui owns `.num` for the NumField knob, where it is a block with a
// bottom margin. This app also puts `num` on table cells that hold numbers, so
// without a reset every cell in a row stacks vertically down the first column
// and the other columns render empty. A render test cannot see it and neither
// can `vite build`; it reached a screenshot once, hence this file.

const here = dirname(fileURLToPath(import.meta.url))
const read = (p) => readFileSync(join(here, p), 'utf8')
const styles = read('styles.css')
const base = read('../../../packages/ui/src/base.css')

/** The declarations of the rule with this selector, crudely parsed. */
function ruleFor(css, selector) {
  const body = css.replace(/\/\*[\s\S]*?\*\//g, '')
  const tidy = (s) => s.trim().replace(/\s*,\s*/g, ', ').replace(/\s+/g, ' ')
  for (const m of body.matchAll(/([^{}]+)\{([^}]*)\}/g)) {
    if (tidy(m[1]) === tidy(selector)) return m[2]
  }
  return null
}

describe('the stylesheet', () => {
  it('resets the shared .num block rule on the table cells that borrow the name', () => {
    // The rule this exists to defend against, in the shared stylesheet.
    const shared = ruleFor(base, '.num')
    expect(shared, 'packages/ui defines .num').toBeTruthy()
    expect(shared).toMatch(/display:\s*block/)

    const local = ruleFor(styles, '.table td.num, .table th.num')
    expect(local, 'this app redefines .num inside tables').toBeTruthy()
    expect(local, 'display reset').toMatch(/display:\s*table-cell/)
    expect(local, 'margin reset').toMatch(/margin:\s*0/)
    // Headings share the alignment of the columns they name, whatever it is.
    const cells = ruleFor(styles, '.table th, .table td')
    const align = (rule) => (rule.match(/text-align:\s*(\w+)/) || [])[1]
    expect(align(local), 'headings and cells agree').toBe(align(cells))
  })

  it('uses the num class only on table cells, which is what the reset assumes', () => {
    for (const file of ['components/panes.jsx', 'App.jsx']) {
      const src = read(file)
      for (const m of src.matchAll(/<(\w+)[^>]*className="num"/g)) {
        expect(['td', 'th'], `${file}: <${m[1]} className="num">`).toContain(m[1])
      }
    }
  })

  it('gives every numeric column a heading on the same class as its cells', () => {
    // A heading that is not `num` sits left of a column of right-aligned
    // numbers, which is what this exists to prevent.
    const src = read('components/panes.jsx')
    for (const block of src.matchAll(/<thead>([\s\S]*?)<\/thead>/g)) {
      const heads = [...block[1].matchAll(/<th([^>]*)>/g)].map((m) => m[1])
      // The first column names the row; the rest carry numbers.
      expect(heads.length).toBeGreaterThan(1)
      for (const attrs of heads.slice(1)) expect(attrs, `header ${attrs}`).toMatch(/className="num"/)
    }
  })
})
