// Rewrite the progression-test entry in NEEDS.md as two list items: the count
// with every id span, in sentences short enough for the prose lint, and the
// group names in order. Args: the built group letters in order.
import { readFileSync, writeFileSync } from 'node:fs'
const NAMES = {
  A: 'the op-amp as a user meets it', C: 'inside the junction', D: 'the transistor as a controlled source',
  E: 'signal and bias take different paths', F: 'small signals, the tangent at the point', G: 'ports, and what loads them',
  H: 'single-stage amplifiers', I: 'mirrors, active loads, and stacking', J: 'the differential pair', K: 'frequency response',
  L: 'feedback', M: 'inside the op-amp', N: 'oscillators', O: 'noise',
}
const COUNTS = { A: 6, C: 4, D: 7, E: 6, F: 6, G: 2, H: 7, I: 5, J: 5, K: 6, L: 6, M: 6, N: 4, O: 5 }
const letters = process.argv.slice(2)
const total = letters.reduce((n, l) => n + COUNTS[l], 0)
const span = (l) => { const k = l.toLowerCase(); return COUNTS[l] === 2 ? `\`${k}1\` and \`${k}2\`` : `\`${k}1\` to \`${k}${COUNTS[l]}\`` }
const list = (items) => (items.length > 1 ? `${items.slice(0, -1).join(', ')} and ${items.at(-1)}` : items[0])
const wrap = (text, indent) => {
  const words = text.split(' '), lines = []; let line = ''
  for (const w of words) { if ((line + ' ' + w).trim().length > 80) { lines.push(line); line = indent + w } else line = (line ? line + ' ' : '') + w }
  lines.push(line); return lines.join('\n')
}
// Six spans a sentence keeps each under the 34-word cap.
const sentences = []
for (let i = 0; i < letters.length; i += 6) {
  const chunk = letters.slice(i, i + 6).map(span)
  sentences.push((i === 0 ? 'Ids ' : 'Then ') + list(chunk) + '.')
}
const item1 = wrap(`- **${total} experiments in ${letters.length} groups.** ${sentences.join(' ')}`, '  ')
const item2 = wrap(`- The groups in order are ${letters.map((l) => `${l}, "${NAMES[l]}"`).join('. ')}.`, '  ')
const f = 'apps/electronics-lab/NEEDS.md'
const raw = readFileSync(f, 'utf8'); const eol = raw.includes('\r\n') ? '\r\n' : '\n'
const s = raw.split(/\r?\n/).join('\n')
const start = s.search(/- \*\*\d+ experiments in \d+ groups\.\*\*/)
const end = s.indexOf('- No cross-lab reference by id')
if (!(start > 0 && end > start)) throw new Error('entry not found')
writeFileSync(f, (s.slice(0, start) + item1 + '\n' + item2 + '\n' + s.slice(end)).split('\n').join(eol))
console.log(item1 + '\n' + item2)
