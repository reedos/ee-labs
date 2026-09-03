import { describe, it } from 'vitest'
import { LESSONS } from './lessons.js'
import { expectPlain } from '@ee-labs/prose/testing'

// The house style, measured (STYLE.md).
//
// lessons.test.js measures what a note CLAIMS, against the circuit it loads.
// This file measures how the claim is written: one claim a sentence, no dash
// for emphasis, no colon reveal, no capitals doing the work of word order.

describe('every lesson reads plainly', () => {
  for (const l of LESSONS) {
    it(l.name, () => {
      expectPlain(l.note, 'note', `${l.name} note`)
      if (l.try) expectPlain(typeof l.try === 'string' ? l.try : l.try.text, 'try', `${l.name} try`)
      expectPlain(l.name, 'title', `${l.name} name`)
    })
  }
})
