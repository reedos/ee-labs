// Two-level minimisation, exactly: the prime implicants, the minimum cover,
// and the netlist that cover builds.
//
// This is combinatorics on finite sets, so every answer here is exact and
// none of it is a search that stops early. Quine–McCluskey finds every prime
// implicant, and the cover is chosen by taking the essential primes and then
// solving the rest exhaustively. Both cost more than a heuristic and both are
// affordable at the four and five variables a Karnaugh map holds.
//
// A cube is `{ mask, bits }`. `mask` has a 1 where the variable appears and
// `bits` says whether it appears true or complemented. So for a, b, c, d with
// a as the high bit, the cube a·d̄ is mask 0b1001, bits 0b1000.

/** The Gray-code order a Karnaugh map's rows and columns use, for `n` bits. */
export function grayOrder(n) {
  return Array.from({ length: 2 ** n }, (_, i) => i ^ (i >> 1))
}

/** The minterms a cube covers. */
export function cubeMinterms(cube, n) {
  const free = []
  for (let k = 0; k < n; k++) if (!((cube.mask >> k) & 1)) free.push(k)
  const out = []
  for (let i = 0; i < 2 ** free.length; i++) {
    let m = cube.bits
    free.forEach((k, j) => {
      if ((i >> j) & 1) m |= 1 << k
    })
    out.push(m)
  }
  return out.sort((a, b) => a - b)
}

/** How many literals a cube writes: one per variable it names. */
export const literals = (cube, n) => {
  let c = 0
  for (let k = 0; k < n; k++) if ((cube.mask >> k) & 1) c++
  return c
}

const key = (c) => `${c.mask}:${c.bits & c.mask}`

/**
 * Every prime implicant of `minterms` over `n` variables, treating `dontCare`
 * as free to cover. Quine–McCluskey: combine cubes that differ in one
 * variable, and a cube that never combines is prime.
 */
export function primeImplicants(minterms, n, dontCare = []) {
  const all = [...new Set([...minterms, ...dontCare])].sort((a, b) => a - b)
  const full = (1 << n) - 1
  let level = all.map((m) => ({ mask: full, bits: m }))
  const primes = new Map()
  const seen = new Set(level.map(key))
  while (level.length) {
    const used = new Array(level.length).fill(false)
    const next = new Map()
    for (let i = 0; i < level.length; i++) {
      for (let j = i + 1; j < level.length; j++) {
        const a = level[i]
        const b = level[j]
        if (a.mask !== b.mask) continue
        const diff = (a.bits ^ b.bits) & a.mask
        if (diff === 0 || (diff & (diff - 1)) !== 0) continue
        used[i] = true
        used[j] = true
        const c = { mask: a.mask & ~diff, bits: a.bits & ~diff }
        next.set(key(c), c)
      }
    }
    level.forEach((c, i) => {
      if (!used[i]) primes.set(key(c), c)
    })
    level = [...next.values()].filter((c) => !seen.has(key(c)))
    for (const c of level) seen.add(key(c))
  }
  return [...primes.values()].sort((a, b) => literals(a, n) - literals(b, n) || a.bits - b.bits)
}

/**
 * A minimum cover of `minterms` by `primes`: fewest cubes, and among those the
 * fewest literals. The essential primes go in first, then the remaining
 * minterms are covered by exhaustive search over the primes that are left.
 *
 * @returns {{ cover: Cube[], essential: Cube[], literals: number, cubes: number }}
 */
export function minimalCover(minterms, primes, n) {
  const need = [...new Set(minterms)].sort((a, b) => a - b)
  const covers = primes.map((p) => new Set(cubeMinterms(p, n)))
  const essential = []
  const done = new Set()
  for (const m of need) {
    const hit = primes.filter((_, i) => covers[i].has(m))
    if (hit.length === 1 && !essential.includes(hit[0])) {
      essential.push(hit[0])
      for (const x of cubeMinterms(hit[0], n)) done.add(x)
    }
  }
  const rest = need.filter((m) => !done.has(m))
  if (!rest.length) return { cover: essential, essential, literals: essential.reduce((s, c) => s + literals(c, n), 0), cubes: essential.length }
  // Fewest cubes first, then fewest literals among the covers of that size.
  // Every subset of that size is enumerated, so "minimum" means minimum and
  // not "the best this search found before it gave up".
  const spare = primes.filter((p) => !essential.includes(p))
  let best = null
  for (let size = 1; size <= spare.length && !best; size++) {
    const walk = (start, chosen) => {
      if (chosen.length === size) {
        const got = new Set(chosen.flatMap((c) => cubeMinterms(c, n)))
        if (!rest.every((m) => got.has(m))) return
        const lit = chosen.reduce((s, c) => s + literals(c, n), 0)
        if (!best || lit < best.lit) best = { chosen: [...chosen], lit }
        return
      }
      for (let i = start; i < spare.length; i++) walk(i + 1, [...chosen, spare[i]])
    }
    walk(0, [])
  }
  const cover = [...essential, ...(best ? best.chosen : [])]
  return { cover, essential, literals: cover.reduce((s, c) => s + literals(c, n), 0), cubes: cover.length }
}

/**
 * The sum-of-products a cover writes, with `names[0]` as the high bit and a
 * complement written as a prime: `ab + a'c`. One notation everywhere, in the
 * expression, in the lesson and in the test.
 */
export function expressionOf(cover, names) {
  const n = names.length
  if (!cover.length) return '0'
  return cover
    .map((c) => {
      const parts = []
      for (let k = n - 1; k >= 0; k--) if ((c.mask >> k) & 1) parts.push(names[n - 1 - k] + (((c.bits >> k) & 1) ? '' : "'"))
      return parts.length ? parts.join('') : '1'
    })
    .join(' + ')
}

/**
 * `ins` gathered into one signal named `id` by gates of kind `kind`, in as few
 * levels as the library's fan-in allows.
 *
 * A cell has a largest fan-in, so a term of six literals is two levels of gate
 * and not one. The tree is balanced, and each level's cost is the library's own
 * delay for the fan-in it used. Gates are appended to `gates` and the id of the
 * signal that carries the result is returned.
 */
export function treeOf(kind, ins, id, gates, max = 4) {
  let level = ins
  let depth = 0
  while (level.length > 1) {
    depth++
    if (level.length <= max) {
      gates.push({ id, kind, in: level })
      return id
    }
    const groups = Math.ceil(level.length / max)
    const per = Math.ceil(level.length / groups)
    const next = []
    for (let g = 0; g * per < level.length; g++) {
      const slice = level.slice(g * per, (g + 1) * per)
      if (slice.length === 1) {
        next.push(slice[0])
        continue
      }
      const name = `${id}_${depth}_${g + 1}`
      gates.push({ id: name, kind, in: slice })
      next.push(name)
    }
    level = next
  }
  return level[0]
}

/**
 * The two-level AND-OR netlist a cover builds: one inverter per complemented
 * variable, one AND per cube, one OR over them.
 *
 * A cube of one literal needs no AND, and a cover of one cube needs no OR, so
 * the gate count this returns is the gate count a reader would draw. A cube or
 * a cover wider than the library's largest cell becomes a tree of them, which
 * is a second level of gate and a second helping of delay.
 */
export function netFromCover(cover, names, opts = {}) {
  const n = names.length
  const out = opts.output || 'y'
  const values = opts.values || names.map(() => 0)
  const sources = names.map((s, i) => ({ id: s, kind: 'input', value: values[i] }))
  const gates = []
  const inverted = new Set()
  for (const c of cover) for (let k = 0; k < n; k++) if (((c.mask >> k) & 1) && !((c.bits >> k) & 1)) inverted.add(names[n - 1 - k])
  for (const s of [...inverted].sort()) gates.push({ id: `n_${s}`, kind: 'not', in: [s] })
  const terms = []
  cover.forEach((c, i) => {
    const ins = []
    for (let k = n - 1; k >= 0; k--) {
      if (!((c.mask >> k) & 1)) continue
      const s = names[n - 1 - k]
      ins.push(((c.bits >> k) & 1) ? s : `n_${s}`)
    }
    terms.push(treeOf('and', ins, `p${i + 1}`, gates))
  })
  if (terms.length === 1) gates.push({ id: out, kind: 'buf', in: [terms[0]] })
  else treeOf('or', terms, out, gates)
  return { name: opts.name || 'a cover', sources, gates, outputs: [out] }
}
