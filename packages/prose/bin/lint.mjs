#!/usr/bin/env node
// npm run lint:prose — the markdown pass.
//
// Reads the repo's documentation, splits it into paragraphs, and reports every
// paragraph that breaks a STYLE.md rule. Code fences, tables, headings, links
// and quoted "before" text in the rewrite drafts are skipped, because they are
// either not prose or are the old voice quoted on purpose.
//
// Exit code 1 when anything is reported, so CI can gate on it.

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { violations, BUDGETS } from '../src/style.js'

const ROOT = resolve(process.cwd())
const SKIP_DIRS = new Set(['node_modules', 'dist', '.git', 'shots', 'prose-rewrite'])

// Two documents quote the old voice on purpose: STYLE.md names the constructions
// it bans, and the proposal shows every before/after pair. Linting them reports
// the quotations, not the writing.
const SKIP_FILES = new Set(['STYLE.md', 'PROSE_REWRITE_PROPOSAL.md'])

function docs(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue
    const p = join(dir, name)
    if (statSync(p).isDirectory()) docs(p, out)
    else if (name.endsWith('.md') && !SKIP_FILES.has(name)) out.push(p)
  }
  return out
}

/**
 * Prose paragraphs only: no fences, tables, headings, list-of-links or quotes.
 * A list item is its own unit, bulleted or numbered. Merging a list into one
 * paragraph would report the whole list as a single 188-word sentence.
 */
const ITEM = /^\s*(?:[-*]|\d+\.)\s+/

function paragraphs(src) {
  return src
    .replace(/```[\s\S]*?```/g, '')
    .split(/\n\s*\n/)
    .flatMap((block) =>
      new RegExp(ITEM.source, 'm').test(block)
        ? block.split(/\n(?=\s*(?:[-*]|\d+\.)\s+)/).map((item) => item.replace(ITEM, ''))
        : [block],
    )
    .map((p) => p.split('\n').map((l) => l.trim()).join(' ').trim())
    // Emphasis markers hide a sentence end: "…sidebar.** It opens" has no space
    // between the stop and the capital, so the splitter would run two sentences
    // together and report one 38-word sentence that nobody wrote.
    .map((p) => p.replace(/\*\*?/g, '').replace(/(?<=\w)_(?=\w)/g, '_'))
    .filter((p) => p && !p.startsWith('#') && !p.startsWith('|') && !p.startsWith('>'))
    .filter((p) => !/^\s*\[[^\]]+\]\(/.test(p))
    .filter((p) => !/^[-=_*\s]+$/.test(p))
}

const only = process.argv.slice(2)
const files = (only.length ? only.map((f) => resolve(f)) : docs(ROOT)).filter((f) =>
  f.endsWith('.md'),
)

let hits = 0
for (const file of files) {
  const rel = relative(ROOT, file)
  const found = []
  for (const p of paragraphs(readFileSync(file, 'utf8'))) {
    found.push(...violations(p, BUDGETS.doc, `  ${p.slice(0, 56)}…`))
  }
  if (found.length) {
    console.log(`\n${rel}  (${found.length})`)
    for (const f of found) console.log(`  ${f}`)
    hits += found.length
  }
}

console.log(
  hits ? `\n${hits} prose findings in ${files.length} files. See STYLE.md.` : `\nClean: ${files.length} files.`,
)
process.exit(hits ? 1 : 0)
