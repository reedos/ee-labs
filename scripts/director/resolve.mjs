// Resolve git conflict hunks per a spec: { "<file>": [choice, ...] } where a
// choice is "ours" | "theirs" | "both" | "theirs-then-ours" | {"text": "..."}
// (text replaces the hunk, LF-separated). One choice per hunk, in order.
// Preserves each file's line ending.
import { readFileSync, writeFileSync } from 'node:fs'

const spec = JSON.parse(readFileSync(process.argv[2], 'utf8'))
for (const [f, choices] of Object.entries(spec)) {
  const raw = readFileSync(f, 'utf8')
  const eol = raw.includes('\r\n') ? '\r\n' : '\n'
  const out = []
  let mode = 'plain', ours = [], theirs = [], n = 0
  for (const line of raw.split(/\r?\n/)) {
    if (mode === 'plain' && line.startsWith('<<<<<<< ')) { mode = 'ours'; ours = []; theirs = []; continue }
    if (mode === 'ours' && line === '=======') { mode = 'theirs'; continue }
    if (mode === 'theirs' && line.startsWith('>>>>>>> ')) {
      const c = choices[n++]
      if (c === undefined) throw new Error(`${f}: no choice for hunk ${n}`)
      if (c === 'ours') out.push(...ours)
      else if (c === 'theirs') out.push(...theirs)
      else if (c === 'both') out.push(...ours, ...theirs)
      else if (c === 'theirs-then-ours') out.push(...theirs, ...ours)
      else if (c && typeof c.text === 'string') out.push(...c.text.split('\n'))
      else if (c && typeof c.drop_ours_tail === 'number') out.push(...ours.slice(0, ours.length - c.drop_ours_tail), ...theirs)
      else throw new Error(`${f}: bad choice for hunk ${n}`)
      mode = 'plain'; continue
    }
    if (mode === 'ours') ours.push(line)
    else if (mode === 'theirs') theirs.push(line)
    else out.push(line)
  }
  if (mode !== 'plain') throw new Error(`${f}: unterminated hunk`)
  if (n !== choices.length) throw new Error(`${f}: ${n} hunks but ${choices.length} choices`)
  writeFileSync(f, out.join(eol))
  console.log(`${f}: ${n} hunk(s) resolved`)
}
