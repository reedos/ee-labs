import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { EXPERIMENTS as ELEMENTS, GROUPS as ELEMENT_GROUPS } from '../../../apps/circuit-elements-lab/src/experiments.js'
import { LESSONS as FREQUENCY, LESSON_GROUPS as FREQUENCY_GROUPS } from '../../../apps/circuit-lab/src/lessons.js'
import { PHASOR_LESSONS } from '../../../apps/circuit-lab/src/phasorCourse.js'
import { PRESETS as SIGNAL, PRESET_GROUPS as SIGNAL_GROUPS } from '../../../apps/signal-lab/src/presets.js'
import { LESSONS as CONTROL, LESSON_GROUPS as CONTROL_GROUPS } from '../../../apps/control-lab/src/lessons.js'
import { EXPERIMENTS as POWER } from '../../../apps/power-lab/src/experiments.js'
import { EXPERIMENTS as ELECTRONICS } from '../../../apps/electronics-lab/src/experiments.js'

// The progression test (CURRICULUM.md §6).
//
// The Elements lab already refuses to let one of its notes point at an
// experiment that does not exist. This file is that rule applied across the
// seams: CURRICULUM.md is the one document that speaks for all six labs at
// once, and nothing else checks that what it says about them is true.
//
// It measures three things:
//
//   the ids     every experiment the document quotes for a built lab is in
//               that lab's experiment, lesson or preset list,
//   the counts  every number in §1 and §2 is the length of the list it
//               describes, group by group as well as in total,
//   the plans   every row marked planned names a plan file that exists and
//               that specifies the experiments the row promises.
//
// It lives here rather than in an app because it is the only test that reads
// every lab. Another lab adds its ids to the document and this test picks them
// up; a lab that wants a new row writes it into its own NEEDS.md, because this
// file belongs to the seams (PROGRAM.md §5).
//
// Every failure names the offending id or count. A document that cannot say
// which line is wrong is no better than no document.

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
const DOC = readFileSync(join(ROOT, 'CURRICULUM.md'), 'utf8')
const CIRCUIT = [...PHASOR_LESSONS.map(l => ({ ...l, group: 'Phasor analysis' })), ...FREQUENCY]
const CIRCUIT_GROUPS = ['Phasor analysis', ...FREQUENCY_GROUPS]

// ------------------------------------------------------------ the labs

/**
 * What each lab is, as the document names it.
 *
 * `list` is the lab's own record — experiments, lessons or presets, whichever
 * it keeps — and `groups` the group names it uses. `membersOf` counts what the
 * document's group cell names, which is an exact group name everywhere except
 * Power Lab: its tabs carry short names ("The buck") while the document and
 * the ids carry letters (B · The buck, b1 to b8), so there the letter joins
 * them. The Electronics Lab is joined the same way, because the document
 * shortens its group names. `plan` is where a row marked planned must be specified.
 */
const LABS = {
  'Circuit Elements Lab': {
    list: ELEMENTS,
    groups: ELEMENT_GROUPS,
    ids: ELEMENTS.map((e) => e.id),
  },
  'Circuit Lab': { list: CIRCUIT, groups: CIRCUIT_GROUPS, ids: [] },
  'Electronics Lab': {
    list: ELECTRONICS,
    groups: null,
    ids: ELECTRONICS.map((e) => e.id),
    plan: 'ELECTRONICS_LAB_PLAN.md',
    membersOf: (cell) => ELECTRONICS.filter((e) => letters(cell).includes(e.id[0].toUpperCase())).length,
  },
  'Signal Lab': { list: SIGNAL, groups: SIGNAL_GROUPS, ids: [] },
  'Control Lab': { list: CONTROL, groups: CONTROL_GROUPS, ids: [] },
  'Power Lab': {
    list: POWER,
    groups: null,
    ids: POWER.map((e) => e.id),
    plan: 'POWER_LAB_PLAN.md',
    membersOf: (cell) => POWER.filter((e) => letters(cell).includes(e.id[0].toUpperCase())).length,
  },
}

/** The short name the prose uses for a lab whose experiments have ids. */
const ID_LABS = {
  Elements: 'Circuit Elements Lab',
  Electronics: 'Electronics Lab',
  Power: 'Power Lab',
}

/** The group letters a group cell covers: "B · The buck" is B, "F to N" is F…N. */
function letters(cell) {
  const m = /^([A-Z])(?:\s+to\s+([A-Z]))?\b/.exec(cell.trim())
  if (!m) return []
  const from = m[1].charCodeAt(0)
  const to = (m[2] || m[1]).charCodeAt(0)
  return Array.from({ length: to - from + 1 }, (_, k) => String.fromCharCode(from + k))
}

/** How many built items the document's group cell names. */
function membersOf(labName, cell) {
  const lab = LABS[labName]
  if (lab.membersOf) return lab.membersOf(cell)
  return lab.list.filter((e) => e.group === cell).length
}

// ------------------------------------------------------------ the document

/** The document's numbered sections, keyed by their number. */
function sections(text) {
  const out = {}
  let key = null
  for (const line of text.split('\n')) {
    const m = /^## (\d+)\./.exec(line)
    if (m) {
      key = m[1]
      out[key] = []
      continue
    }
    if (key) out[key].push(line)
  }
  return Object.fromEntries(Object.entries(out).map(([k, v]) => [k, v.join('\n')]))
}

const SECTION = sections(DOC)

const isRow = (line) => line.trim().startsWith('|') && !/^\|[\s|:-]+\|$/.test(line.trim())
const cells = (line) => line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((s) => s.trim())

/**
 * A count cell. "58" is fifty-eight built of fifty-eight; "22 of 54" is
 * twenty-two built of fifty-four; a planned lab has none built at all.
 */
function counts(cell, status) {
  const m = /^(\d+)(?:\s+of\s+(\d+))?$/.exec(cell.trim())
  if (!m) return null
  const total = m[2] ? +m[2] : +m[1]
  const built = /planned/.test(status) && !/built/.test(status) ? 0 : +m[1]
  return { built, total }
}

/** §1's table: one row per lab, in course order. */
const ORDER = SECTION['1']
  .split('\n')
  .filter(isRow)
  .map(cells)
  .filter((c) => c[0] !== 'Step' && /^\d+$/.test(c[0]))
  .map(([step, lab, course, count, status]) => ({ step: +step, lab, course, ...counts(count, status), status }))

/** §2's tables: one section per lab, each a list of group rows. */
function paths(text) {
  const out = []
  let here = null
  for (const line of text.split('\n')) {
    const head = /^### Step (\d+): (.+?) \((\d+(?:\s+of\s+\d+)?)(?:,\s*(.+?))?\)\s*$/.exec(line)
    if (head) {
      here = { step: +head[1], lab: head[2], ...counts(head[3], head[4] || ''), status: head[4] || '', rows: [] }
      out.push(here)
      continue
    }
    if (!here || !isRow(line)) continue
    const c = cells(line)
    if (c[0] === 'Group') continue
    const status = c.find((s, k) => k > 2 && /^(built|planned)$/.test(s)) || ''
    here.rows.push({ group: c[0], teaches: c[1], count: +c[2], status })
  }
  return out
}

const PATH = paths(SECTION['2'])

// ------------------------------------------------------------ 1. the ids

/**
 * Every experiment id the document quotes, with the lab it belongs to.
 *
 * Attribution is by reading, not by guessing. Inside one block — a paragraph,
 * or a single table row — the last lab named that has ids owns every id after
 * it, which is how the seam paragraphs read: "Elements G1 finds the roots…
 * Elements H6 reads H(jω)… G1's roots are H6's poles". Circuit Lab, Signal Lab
 * and Control Lab number nothing, so naming one of them never takes an id off
 * the lab that does.
 *
 * An id in a block that has named no such lab is a failure, not a guess.
 */
function quoted(text) {
  const found = []
  const blocks = text
    .split(/\n\s*\n/)
    .flatMap((b) => (b.split('\n').every((l) => !l.trim() || isRow(l) || /^\|[\s|:-]+\|$/.test(l.trim())) ? b.split('\n') : [b]))
  for (const block of blocks) {
    let lab = null
    const token = /\b(Elements|Electronics|Power)\b|\b([A-O]\d+)\b/g
    let m
    while ((m = token.exec(block))) {
      if (m[1]) lab = ID_LABS[m[1]]
      else found.push({ id: m[2], lab, where: block.trim().slice(0, 80) })
    }
  }
  return found
}

// §4 is the list of subjects no lab teaches, and its "recommended home" column
// names where each would go. Those ids are proposals by definition, so they
// are read the other way round: an id there must NOT be built yet, or the
// subject has a home and the row is stale.
const CLAIMED = ['1', '2', '3', '5'].flatMap((k) => quoted(SECTION[k]))
const PROPOSED = quoted(SECTION['4'])

describe('every experiment CURRICULUM.md quotes exists', () => {
  it('names the lab for every id it quotes', () => {
    for (const q of [...CLAIMED, ...PROPOSED]) {
      expect(q.lab, `${q.id} is quoted with no lab named before it: "${q.where}"`).toBeTruthy()
    }
  })

  it('really did find the ids: a parser that found none would pass everything below', () => {
    for (const lab of Object.values(ID_LABS)) {
      const all = [...CLAIMED, ...PROPOSED].filter((q) => q.lab === lab)
      expect(all.length, `no id quoted for ${lab} anywhere in the document`).toBeGreaterThan(0)
    }
    // The two seams this document exists for, read back out of it.
    expect(CLAIMED.map((q) => `${q.lab} ${q.id}`)).toContain('Circuit Elements Lab H7')
    expect(CLAIMED.map((q) => `${q.lab} ${q.id}`)).toContain('Circuit Elements Lab G1')
  })

  it.each(Object.values(ID_LABS))('%s: every id it quotes is built, or specified in its plan', (lab) => {
    const built = new Set(LABS[lab].ids)
    for (const q of CLAIMED.filter((r) => r.lab === lab)) {
      if (built.has(q.id.toLowerCase())) continue
      const plan = LABS[lab].plan
      expect(plan, `${lab} ${q.id} is not built and ${lab} has no plan file: "${q.where}"`).toBeTruthy()
      const text = readFileSync(join(ROOT, plan), 'utf8')
      expect(
        new RegExp(`\\b${q.id}\\b`).test(text),
        `${lab} ${q.id} is neither built nor in ${plan}: "${q.where}"`,
      ).toBe(true)
    }
  })

  it('§4 recommends homes for subjects that really have none', () => {
    for (const q of PROPOSED) {
      const built = new Set(LABS[q.lab].ids)
      expect(
        built.has(q.id.toLowerCase()),
        `${q.lab} ${q.id} is built, so §4 no longer describes a subject with no home: "${q.where}"`,
      ).toBe(false)
    }
  })
})

// ------------------------------------------------------------ 2. the counts

describe('every count in CURRICULUM.md is a list length', () => {
  it('§1 lists the six labs in course order', () => {
    expect(ORDER.map((r) => r.step)).toEqual([1, 2, 3, 4, 5, 6])
    expect(ORDER.map((r) => r.lab)).toEqual(Object.keys(LABS))
  })

  it.each(ORDER)('§1: $lab counts $built of $total', (row) => {
    const lab = LABS[row.lab]
    if (!lab.list) {
      expect(row.built, `${row.lab} is planned, so nothing of it is built`).toBe(0)
      return
    }
    expect(lab.list.length, `${row.lab}: §1 says ${row.built} built, the lab has ${lab.list.length}`).toBe(row.built)
  })

  it('§2 carries the same six labs, with §1’s numbers', () => {
    expect(PATH.map((s) => s.lab)).toEqual(ORDER.map((r) => r.lab))
    for (const s of PATH) {
      const row = ORDER.find((r) => r.lab === s.lab)
      expect(s.total, `${s.lab}: §2 says ${s.total}, §1 says ${row.total}`).toBe(row.total)
      expect(s.built, `${s.lab}: §2 says ${s.built} built, §1 says ${row.built}`).toBe(row.built)
    }
  })

  it.each(PATH)('§2: $lab’s groups add up', (section) => {
    const sum = section.rows.reduce((a, r) => a + r.count, 0)
    expect(sum, `${section.lab}: the groups add to ${sum}, the heading says ${section.total}`).toBe(section.total)
    const builtRows = section.rows.filter((r) => r.status !== 'planned' && !/planned/.test(section.status))
    const builtSum = builtRows.reduce((a, r) => a + r.count, 0)
    expect(builtSum, `${section.lab}: the built groups add to ${builtSum}, the heading says ${section.built}`).toBe(
      section.built,
    )
  })

  it.each(PATH.filter((s) => LABS[s.lab].list))('§2: every group of $lab is the length of its own list', (section) => {
    const lab = LABS[section.lab]
    for (const row of section.rows) {
      if (row.status === 'planned') continue
      if (lab.groups) {
        expect(lab.groups, `${section.lab}: no group is called "${row.group}"`).toContain(row.group)
      }
      const n = membersOf(section.lab, row.group)
      expect(n, `${section.lab} ${row.group}: the document says ${row.count}, the lab has ${n}`).toBe(row.count)
    }
    // And no group of the lab is missing from the document.
    if (lab.groups) {
      const named = section.rows.map((r) => r.group)
      for (const g of lab.groups) expect(named, `${section.lab}: "${g}" is in the lab and not in the document`).toContain(g)
    }
  })
})

// ------------------------------------------------------------ 3. the plans

describe('every planned row names a plan file that specifies it', () => {
  const planned = PATH.flatMap((s) =>
    s.rows
      .filter((r) => r.status === 'planned' || /planned/.test(s.status))
      .map((r) => ({ lab: s.lab, ...r })),
  )

  it('there are planned rows to check', () => {
    expect(planned.length).toBeGreaterThan(0)
    expect(new Set(planned.map((r) => r.lab))).toEqual(new Set(['Electronics Lab', 'Power Lab']))
  })

  it.each(planned)('$lab, $group', (row) => {
    const plan = LABS[row.lab].plan
    expect(plan, `${row.lab} has a planned row and no plan file`).toBeTruthy()
    expect(existsSync(join(ROOT, plan)), `${row.lab} names ${plan}, which does not exist`).toBe(true)
    const text = readFileSync(join(ROOT, plan), 'utf8')
    // The row promises a group of N experiments. The plan must specify them:
    // the first of the group, and the last the count reaches. A span row
    // ("F to N") is checked at both ends of the span instead.
    const span = letters(row.group)
    expect(span.length, `${row.lab} "${row.group}": no group letter to look for`).toBeGreaterThan(0)
    const wanted = span.length > 1 ? [`${span[0]}1`, `${span[span.length - 1]}1`] : [`${span[0]}1`, `${span[0]}${row.count}`]
    for (const id of wanted) {
      expect(new RegExp(`\\b${id}\\b`).test(text), `${row.lab} "${row.group}": ${plan} does not specify ${id}`).toBe(true)
    }
  })

  it('a plan file the document itself names is the one this test reads', () => {
    // §2's Electronics section points at its own plan in prose. Where the
    // document names a file, the map above must not name a different one, or
    // this test would be reading a plan the reader never sees.
    const named = /`([A-Z_]+\.md)` §1 carries this lab['’]s own map/.exec(SECTION['2'])
    expect(named, 'the Electronics section no longer names its plan file').toBeTruthy()
    expect(named[1]).toBe(LABS['Electronics Lab'].plan)
  })
})
