import { expect, it } from 'vitest'
import { gradeAnswer } from './components/Practice.jsx'

it('accepts signed scientific notation and rejects missing, nonfinite and wrong-sign answers', () => {
  expect(gradeAnswer('-1.01e-3', -0.001)).toBe('correct')
  expect(gradeAnswer('1e-3', -0.001)).toBe('incorrect')
  for (const input of ['', ' ', 'abc', 'Infinity', '1e400']) expect(gradeAnswer(input, 0)).toBe('invalid')
  expect(gradeAnswer('0', 0)).toBe('correct')
  expect(gradeAnswer('1e-5', 0)).toBe('incorrect')
})
