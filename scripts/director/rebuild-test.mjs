// Rebuild apps/electronics-lab/src/experiments.test.js from the two lanes'
// intact versions: the D and E lane's whole file, then the F and G lane's
// blocks from their leading comment to the end, with F's import added.
// Usage: node rebuild-test.mjs <baseBranch> <addBranch> <marker> <importLine>
import { execFileSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'

const [baseBranch, addBranch, marker, importLine] = process.argv.slice(2)
const path = 'apps/electronics-lab/src/experiments.test.js'
const show = (ref) => execFileSync('git', ['show', `${ref}:${path}`], { encoding: 'utf8' }).replace(/\r\n/g, '\n')

let base = show(baseBranch).replace(/\s+$/, '') + '\n'
const add = show(addBranch)
const at = add.indexOf(marker)
if (at < 0) throw new Error(`marker not found in ${addBranch}: ${marker}`)
const tail = add.slice(at).replace(/\s+$/, '') + '\n'

// The new import goes after the last existing import line.
const lines = base.split('\n')
let lastImport = -1
lines.forEach((l, i) => { if (l.startsWith('import ')) lastImport = i })
if (lastImport < 0) throw new Error('no imports in base')
if (!lines.includes(importLine)) lines.splice(lastImport + 1, 0, importLine)
base = lines.join('\n')

writeFileSync(path, base + '\n' + tail)
const n = (base + '\n' + tail).split('\n').length
console.log(`wrote ${path}: ${n} lines; describes:`, (base + tail).split('\n').filter((l) => l.startsWith('describe(')).map((l) => l.slice(10, 40)).join(' | '))
