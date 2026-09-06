// Resolve every git conflict hunk in the given files as the union: HEAD's side
// first, then the other branch's side. Definition lines that both sides changed
// are left for a hand edit afterwards; this only handles the additive hunks.
// Line endings are preserved as found (CRLF or LF).
import { readFileSync, writeFileSync } from 'node:fs'

for (const f of process.argv.slice(2)) {
  const src = readFileSync(f, 'utf8')
  const eol = src.includes('\r\n') ? '\r\n' : '\n'
  const out = []
  let mode = 'plain', ours = [], theirs = [], hunks = 0
  for (const line of src.split(/\r?\n/)) {
    if (mode === 'plain' && line.startsWith('<<<<<<< ')) { mode = 'ours'; ours = []; theirs = []; continue }
    if (mode === 'ours' && line === '=======') { mode = 'theirs'; continue }
    if (mode === 'theirs' && line.startsWith('>>>>>>> ')) {
      out.push(...ours, ...theirs); mode = 'plain'; hunks++; continue
    }
    if (mode === 'ours') ours.push(line)
    else if (mode === 'theirs') theirs.push(line)
    else out.push(line)
  }
  if (mode !== 'plain') throw new Error(`${f}: unterminated conflict hunk`)
  writeFileSync(f, out.join(eol))
  console.log(`${f}: ${hunks} hunk(s) unioned, eol=${JSON.stringify(eol)}`)
}
