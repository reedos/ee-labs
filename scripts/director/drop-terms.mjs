// Remove named term entries from a lane's *.terms.js: the multi-line
// "  key: { ... }," block in TERMS_X and the one-line "  key: /.../," in
// MATCH_X. Used when two lanes defined the same term and the earlier group
// introduces it. Preserves the file's line ending.
import { readFileSync, writeFileSync } from 'node:fs'

const [file, ...keys] = process.argv.slice(2)
const raw = readFileSync(file, 'utf8')
const eol = raw.includes('\r\n') ? '\r\n' : '\n'
const lines = raw.split(/\r?\n/)
const out = []
let skipping = null, removed = {}
for (const line of lines) {
  if (skipping) {
    if (line === '  },') { skipping = null }
    continue
  }
  const block = keys.find((k) => line === `  ${k}: {`)
  if (block) { skipping = block; removed[block] = (removed[block] || 0) + 1; continue }
  const one = keys.find((k) => line.startsWith(`  ${k}: /`))
  if (one) { removed[one] = (removed[one] || 0) + 1; continue }
  out.push(line)
}
if (skipping) throw new Error(`unterminated block for ${skipping}`)
for (const k of keys) if ((removed[k] || 0) !== 2) throw new Error(`${k}: expected a block and a pattern, removed ${removed[k] || 0}`)
writeFileSync(file, out.join(eol))
console.log(`${file}: dropped ${keys.join(', ')} (${lines.length - out.length} lines)`)
