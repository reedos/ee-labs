import { describe, it, expect } from 'vitest'
import { renderToString } from 'react-dom/server'
import React from 'react'
import LessonNav from './LessonNav.jsx'
import TryLine from './TryLine.jsx'

const html = (el) => renderToString(el).replace(/<!--\s*-->/g, '')

describe('LessonNav', () => {
  it('counts from one and names the noun', () => {
    const h = html(<LessonNav index={0} total={15} noun="lesson" />)
    expect(h).toContain('1 of 15')
    expect(h).toContain('Previous lesson')
    expect(h).toContain('Next lesson')
  })

  it('disables the step that has nowhere to go', () => {
    const first = html(<LessonNav index={0} total={3} />)
    const last = html(<LessonNav index={2} total={3} />)
    expect(first).toMatch(/Previous lesson[^>]*disabled|disabled[^>]*Previous lesson/)
    expect(first).not.toMatch(/Next lesson[^>]*disabled|disabled[^>]*Next lesson/)
    expect(last).toMatch(/Next lesson[^>]*disabled|disabled[^>]*Next lesson/)
  })

  it('offers reset only once the note has retired', () => {
    expect(html(<LessonNav index={1} total={3} />)).not.toContain('reset')
    expect(html(<LessonNav index={1} total={3} dirty />)).toContain('reset')
  })

  it('renders nothing without a position', () => {
    expect(html(<LessonNav index={null} total={3} />)).toBe('')
  })
})

describe('TryLine', () => {
  it('renders the imperative apart from the note, with its chips', () => {
    const h = html(<TryLine text="Drag R from 20 Ω to 200 Ω. Q should halve." chips={[{ label: '20 Ω' }, { label: '200 Ω' }]} />)
    expect(h).toContain('class="try-line"')
    expect(h).toContain('Drag R from 20 Ω to 200 Ω.')
    expect(h).toContain('>20 Ω<')
    expect(h).toContain('>200 Ω<')
  })

  it('marks the active chip', () => {
    const h = html(<TryLine text="x" chips={[{ label: 'a' }, { label: 'b' }]} activeChip="b" />)
    expect(h).toMatch(/chip is-on[^>]*>b</)
    expect(h).not.toMatch(/chip is-on[^>]*>a</)
  })

  it('costs no layout when the lesson has no try', () => {
    expect(html(<TryLine />)).toBe('')
  })
})
