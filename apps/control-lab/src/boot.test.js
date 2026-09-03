import { describe, it, expect } from 'vitest'
import { initialState, OPENING_LESSON } from './boot.js'
import { LESSONS, applyLesson } from './lessons.js'
import { stateFromLink } from './fromLink.js'
import { parseLink } from '@ee-labs/ui'

// What a bare visit opens on — the student review: a working motor under P
// with Try this folded shut was "a solved homework problem", not a course.

describe('the page opens on a lesson', () => {
  it('a bare visit loads the first lesson exactly as clicking it would', () => {
    const s = initialState(null, '')
    const first = LESSONS[0]
    expect(first.name).toBe(OPENING_LESSON)
    expect(s.lesson).toBe(first.name)
    expect(s).toMatchObject(applyLesson(first))
    // The picture the review asked for: a dashed 1.0 the loop reaches 0.9 of.
    expect(s.plantId).toBe('firstOrder')
    expect(s.ctrlId).toBe('p')
    expect(s.ctrlP.kp).toBe(9)
    expect(s.view).toBe('step')
  })

  it('a link keeps its own behaviour: the linked loop, no lesson', () => {
    const { state } = stateFromLink(parseLink('plant=motor:2:0.5&ctrl=pi:3:1').patch)
    const s = initialState(state, '#plant=motor:2:0.5&ctrl=pi:3:1')
    expect(s.lesson).toBeNull()
    expect(s.plantId).toBe('motor')
    expect(s.plantP).toEqual({ k: 2, tau: 0.5 })
    expect(s.ctrlId).toBe('pi')
    expect(s.ctrlP).toEqual({ kp: 3, ki: 1 })
  })

  it('a hash that carried nothing usable keeps the old default, not a lesson', () => {
    const s = initialState(null, '#nonsense=1')
    expect(s.lesson).toBeNull()
    expect(s.plantId).toBe('motor')
    expect(s.ctrlId).toBe('p')
  })
})
