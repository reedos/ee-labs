# Information Lab: build brief

You are one of up to eight agents building this lab in parallel. The plan is
`/INFORMATION_LAB_PLAN.md`, and this brief turns it into lanes an agent can take
without colliding with another. Read the plan's §2 (engine) and §5 (curriculum)
for your lane before writing a line. Reed reviews everything.

## Boundaries: read first

- **One lane per agent, one worktree per agent.** Work in your own worktree on
  the lab's branch, and run `npm install` inside it so `@ee-labs/*` resolves
  there rather than in the shared checkout.
- **Edit only the files your lane owns** (§1). Everything else is read only. If
  you need a change outside your lane, write it into `apps/info-lab/NEEDS.md`
  under your lane's heading and continue with what you can do. The owning lane
  picks it up.
- **Stage by path.** `git add packages/codes/src/conv.js`, never `git add -A`,
  and never `commit -a`. Workers do not commit at all. The overseer commits.
- **Nothing is pushed by a lane.** The overseer merges, and the director
  integrates.
- **Preview port.** Lane number plus 4320, so lane 3 previews on 4323.

## The house discipline (non-negotiable)

Read `/CORE_SCOPE.md`, `/STYLE.md` and `/REVIEW_PLAYBOOK.md` first. Then the
rule every lab obeys: **every explanatory sentence is a claim about physics, and
a test must measure it.** A lesson quotes no number the engine does not produce.
A prediction follows every control that can change it. A claim the settings
cannot show is footnoted, never crossed out. On-screen text passes
`npm run lint:prose`.

This lab is the easiest in the map on `CORE_SCOPE.md`. Finite fields, trellises
and code distances are exact arithmetic on finite sets, so almost every number
here is stated without a hedge. Two objects are not exact, and both carry their
guard. The binary-input Gaussian capacity is a numerical integral, and
`biAwgnCapacity` returns the difference between two grid refinements beside its
value. A union bound on an error rate is a bound, and the pane that prints one
states which way the inequality runs.

Commit messages are narrative: what changed, why, and what fell out. Read
`git log` for the register. Never put a model name in a commit or a file.

## 1. The lanes

| Lane | Work | Owns | Starts | Exit |
| --- | --- | --- | --- | --- |
| 1 | The engine | `packages/codes/**` | now | invariants 1 to 10 fuzzed green (§3.9) |
| 2 | The app shell | `apps/info-lab/` except the group and lesson files, plus `RELEASE_STATUS`, `release.test.js`, `terms/` | now, against lane 1 | the shell loads one experiment at 390 px, the release test passes dark |
| 3 | Group C, block codes | `src/groups/c.js`, `src/lessons/c.js`, `components/CodeTable.jsx`, `components/WeightCanvas.jsx` | after lane 1's `block.js` | C1 to C5 pinned |
| 4 | Group A, entropy and source coding | `src/groups/a.js`, `src/lessons/a.js`, `components/TreeCanvas.jsx` | after lane 1's `source.js` | A1 to A5 pinned |
| 5 | Group B, capacity | `src/groups/b.js`, `src/lessons/b.js`, `components/CurveCanvas.jsx` | after lane 1's `entropy.js` | B1 to B3 pinned, B4 deferred |
| 6 | Group D, the trellis | `src/groups/d.js`, `src/lessons/d.js`, `components/TrellisCanvas.jsx` | after lane 1's `conv.js` | D1 to D5 pinned, the walker scrubs |
| 7 | Group E, the graph | `src/groups/e.js`, `src/lessons/e.js`, `components/TannerCanvas.jsx` | after lane 1's `ldpc.js` | E1 to E3 pinned |
| 8 | Group F and B4, the gain | `src/groups/f.js`, `src/lessons/f.js`, `packages/codes/src/gain.js` | **blocked** | see the gate |

**The gate.** Lane 8 waits on the Communications Lab. It needs two things from
that lab, and neither exists on the integration branch today. The first is the
uncoded bit error rate as a function. The second is the BER canvas with the
`limits` prop that plan's Decision 3 builds. Until `packages/comms` lands on
`claude/advanced-analog-labs-5eh3qd`, Group F and B4 stay in `BACKLOG.md` with
the dependency named, and no lesson in Groups A to E may reference them. The
release test enforces the last part.

**Shared seams, landed first.** Lane 1's first commit lands `gf2.js`, `gfm.js`
and `block.js`, because lanes 3 and 7 both read them. Lane 2's first commit
lands the shell and the `RELEASE_STATUS` test. Every other lane starts from
those two.

## 2. The app skeleton (lane 2)

Copy Circuit Elements Lab's shape, file for file, and delete what it does not
need. The Logic Lab is the nearer model for the group split:

```
apps/info-lab/
  index.html  package.json  vite.config.js  RELEASE_STATUS (dark)
  AGENT_BRIEF.md  NEEDS.md
  src/App.jsx  main.jsx  styles.css
  src/experiments.js      merges groups/*.js in plan order, no prose
  src/lessons.js          merges lessons/*.js, and readQuantity
  src/analysis.js         one call per experiment into @ee-labs/codes
  src/groups/{a,b,c,d,e}.js    one file per group, owned by that group's lane
  src/lessons/{a,b,c,d,e}.js   the see / try / why registers, same owner
  src/terms.js  src/terms/*.js      definitions on contact, one registry
  src/format.js  src/report.js
  src/experiments.test.js  prose.test.js  release.test.js  terms.test.js
  src/components/  CodeTable, WeightCanvas, TrellisCanvas, TannerCanvas,
                   TreeCanvas, CurveCanvas, panes.jsx
```

`experiments.test.js` is the Logic Lab's file with this lab's quantity paths.
Copy it, do not rewrite it.

## 3. Contracts

Every signature below is a promise between lanes. A lane may add to a return
shape, never rename or remove. Each contract names the test that measures it.

### 3.1 The field and the matrices (`gf2.js`, `gfm.js`)

```js
// GF(2). A vector is an array of 0 and 1, most significant first.
rref(M) -> { rows, pivots, rank }
nullSpace(M) -> vectors x with M xᵀ = 0
patternsOfWeight(n, w) -> every vector of n bits of weight w
weight(v), addVec(a, b), matVec(M, v), vecMat(v, M), valueOf(v), bitsOf(value, n)

// GF(2^m) as log and antilog tables from a primitive polynomial.
field(m, poly = PRIMITIVE[m]) -> { m, size, order, exp, log, add, mul, div, inv, pow }
GF16   // m = 4, x⁴ + x + 1, 0x13
GF256  // m = 8, x⁸ + x⁴ + x³ + x² + 1, 0x11D
```

Test: `fields.test.js`. The field axioms are enumerated over the whole of
GF(2⁴), and sampled over GF(2⁸) at 20 000 triples with the count stated.

### 3.2 Block codes (`block.js`)

```js
hammingCode(r)        // the cyclic code of a primitive polynomial of degree r
cyclicCode(n, g)      // g is a bit array, highest power first
golayCode()           // (23,12), d = 7
parityCheckCode(k)    // (k+1, k), d = 2
repetitionCode(n)     // (n,1), d = n
codeFromGenerator(G, meta) / codeFromParity(H, meta)
  -> { name, n, k, rate, G, H, systematic }

encode(code, message) -> codeword
syndromeOf(code, word) -> the syndrome, which is zero on the codewords
syndromeTable(code) -> { table: Map, ties, complete, cosets }
decode(code, received, table) -> { word, error, message, syndrome, corrected, weight }
minimumDistance(code) -> { d, method: 'weights' | 'columns', bound, weights }
spherePacking(code, d) -> { t, sphere, covered, total, perfect, spare }
standardArray(code) -> rows of { syndrome, leader, weight, words }
describe(code) -> everything a pane draws, computed once
```

`minimumDistance` enumerates up to 2^16 codewords and refuses past that, where
it falls back to searching the columns of H for the smallest dependency. It
returns which of the two it did, and `bound: true` when the answer is a bound.

Test: `block.test.js`. The (7,4) code's 16 codewords, its weight distribution
1, 7, 7, 1, its eight syndromes and its sphere packing 16 × 8 = 128 are checked
against hand values. Golay's weight distribution is checked entry by entry.

### 3.3 Reed-Solomon (`rs.js`)

```js
rsCode(m, n, k) -> { f, n, k, d: n − k + 1, t, erasures: n − k, rate, gen }
rsEncode(code, message) -> systematic codeword
rsSyndromes(code, received) -> the word at each root of the generator
rsErasureDecode(code, received, positions) -> { word, values, positions, filled }
RS_DECODER_STATUS   // what this version builds, and what it leaves out
```

The error decoder is out of this version (plan Decision 4). C5's pane prints
`RS_DECODER_STATUS.missing` beside the parameters, so the reader is told.

Test: `block.test.js`. Every pattern of four erasures over 200 random codewords
is filled, and a fifth is refused by name.

### 3.4 Entropy and capacity (`entropy.js`)

```js
entropy(probs), binaryEntropy(p), maxEntropy(m)
mutualInformation(px, P) -> { I, hy, hyx, py }
capacityBSC(p), capacityBEC(e), capacityAWGN(snr), capacityAWGNDb(db)
crossoverForCapacity(c)      // 0.110028 at c = 0.5
shannonLimit(r), shannonLimitDb(r), SHANNON_FLOOR_DB   // −1.5917
biAwgnCapacity(esN0Db, opts) -> { capacity, coarse, delta, converged, tolerance }
esN0ForBiAwgnCapacity(c), esN0ForBscCapacity(c)
```

Test: `source.test.js`. Every capacity is checked against its own closed form,
and the mutual information at the uniform input equals the capacity of both
binary channels.

### 3.5 Source coding (`source.js`)

```js
huffman(probs) -> { lengths, words, tree, entropy, meanLength, redundancy,
                    efficiency, kraft, fixed }
huffmanEncode(symbols, code) / huffmanDecode(bits, code)
blockedHuffman(probs, n) -> the same, per symbol of the original source
arithmeticEncode(symbols, counts) -> { bits, length, bound, ideal, low, high,
                                       denominator, perSymbol }
arithmeticDecode(bits, counts, n) -> symbols
typicalSequence(counts, n)   // exactly n·p of each symbol
```

Huffman breaks a tie in favour of the older node, and a leaf is older than any
join. That choice gives the reference source lengths 2, 2, 2, 3, 3 rather than
1, 3, 3, 3, 3. Both codes have the same average length. The arithmetic coder
works in BigInt, because a hundred symbols of a skewed source narrow the
interval below what a double holds.

Test: `source.test.js`. The three reference sources, and the arithmetic coder
against its own decoder on 10 000 random streams.

### 3.6 The trellis (`conv.js`)

```js
encoder({ K, gens }) -> { K, gens, states, memory, rate, n, acs, next, output, table }
convEncode(enc, bits, { terminate })  -> { bits, path, input, state, steps }
trellis(enc, steps)
viterbi(enc, received, { soft, terminated, depth })
  -> { bits, steps, metric, endState, path, acs, comparisons }
freeDistance(enc)          // a shortest-path search, not a table lookup
weightSpectrum(enc, maxWeight) -> { a, b }
softAsymptoticGain(rate, dFree), tracebackRule(enc)
CONV_CODES = { K3, K5, K7, K9 }
```

**Viterbi keeps every step.** `steps[i].states[s]` is
`{ metric, from, bit, branches }`, and `branches` holds both branches into that
state with `{ from, bit, out, branch, total, survivor }`. The trellis walker
draws that array and nothing else.

Test: `conv.test.js`. The `K3` table is compared row for row with the plan's
§3. The free distance is 5, 7, 10 and 12 by search, and the enumeration over
every message of eight bits agrees. `viterbi` agrees with an exhaustive search
over all 256 messages, hard and soft.

### 3.7 The graph (`ldpc.js`)

```js
tannerGraph(H) -> { n, m, edges, vars, checks, dv, dc, regular, degreeV, degreeC }
rateOf(H) -> { n, m, rank, rate, designRate, dependent }
sumProduct(H, llr, { maxIter, stopEarly })
  -> { bits, converged, iteration, iterations, syndromeWeights, posterior }
L12()      // 12 bits, 8 checks, d_v = 2, d_c = 3, girth 6
L102()     // 102 bits, 51 checks, d_v = 3, d_c = 6, no four-cycle
arrayLdpc({ p, dv, dc }), fourCycles(H)
```

**Every iteration is retained.** `iterations[i]` holds `toCheck` and `toVar`,
one number per edge in each direction, with the posterior, the hard bits and the
syndrome weight after that iteration.

One correction to the plan's §3 table, which the director settles. The plan
gives `L12` the rate one third. Two checks per bit makes every column of `H`
even, so its eight rows sum to zero and its rank is 7 rather than 8. The design
rate is one third and the true rate is five twelfths, and E1 measures both. No
`d_v = 2` code can have all its rows independent.

Test: `ldpc.test.js` and `invariants.test.js`. Over 300 channels, a decode that
reports convergence satisfies every check, and some decodes do not converge.

### 3.8 The channel (`channel.js`)

```js
modulate(bits)      // 0 is +1, 1 is −1
gaussian(bits, { ebN0Db, rate, seed }) -> { y, llr, hard, sigma, es, esN0Db, flips }
symmetric(bits, { p, seed }) -> { bits, flips, p, llr }
esN0Db(ebN0Db, rate), sigmaFor(es), crossoverFor(es)
bitStream(n, seed), symbolStream(n, probs, seed), errorCount(a, b)
```

Two conventions hold everywhere. Bit 0 is sent as +1, and a log-likelihood ratio
is `log P(bit = 0 | y) / P(bit = 1 | y)`, so a positive belief argues for a 0.
The Communications Lab's `detect.js` is expected to use the same pair, and
`NEEDS.md` §3 writes the contract down for the director.

### 3.9 The invariants, and which are enumerated

`packages/codes/src/invariants.test.js` walks the plan's §2.10 list. Invariants
4, 5 and 6 are enumerated for the parity check, both Hamming codes, the
repetition code and the LDPC code. Golay samples 12 codewords and 400 patterns
per weight, and the count is written in the test beside the reason. Invariants
11 and 12 belong to lane 8 and are not written yet.

## 4. The lesson schema, and the quantity paths

An experiment is `{ id, group, name, terms, params, code, source, channel,
wants, view, views }`, and its lesson is `see`, `try` and `why` merged onto it
at load. Copy the Logic Lab's `lessons.js` header comment and its three
registers. Budgets are STYLE.md's: `see` at most 70 words, a `try` step at most
45, `why` at most 160.

A `reads` pair names a quantity path and the value the sentence quotes.
`experiments.test.js` resolves every path against the analysis and fails on one
it cannot resolve. The paths:

```
H  Hmax  L  redundancy  efficiency  kraft  fixed  saving   the source and its code
length.<s>  word.<s>                                       one codeword of the source code
blocked.<n>                                                bits per symbol at that block size
arith.<bits|bound|ideal|per>                               the arithmetic coder
C  Cdesign  capacity.<bsc|bec|awgn>  limitdb  floordb      capacity and the limits
crossover.<half>                                           the crossover at a stated capacity
n  k  rate  d  t  detect  weights.<w>  cosets              the code and its distance
syndrome  syndrome.<value>  error.<position>               the syndrome and what it names
covered  total  perfect  spare                             sphere packing
states  branches  acs  dfree  gain.<soft|hard>             the convolutional code
metric  errors  flips  depth.<d>                           a decode and what it cost
edges  checks  girth  rank  dependent                      the Tanner graph
iterations  weight.<i>  converged                          belief propagation
```

## 5. The code library

Every object is fixed by name (plan §3), so a lesson, a test and a view refer to
the same thing. The engine builds each from its own construction rather than
from a stored matrix.

```js
export const CODES = {
  P54: parityCheckCode(4),      // (5,4), d = 2
  H74: hammingCode(3),          // (7,4), d = 3, rate 0.571429, perfect
  H15: hammingCode(4),          // (15,11), d = 3, rate 0.733333
  G23: golayCode(),             // (23,12), d = 7, rate 0.521739, perfect
  R5:  repetitionCode(5),       // (5,1), d = 5
  L12: codeFromParity(L12()),   // (12,5), d = 4
}
export const SOURCES = {
  S5:  [0.4, 0.2, 0.2, 0.1, 0.1],   // H = 2.121928, L = 2.200000
  S4d: [0.5, 0.25, 0.125, 0.125],   // H = L = 1.750000
  S2:  [0.9, 0.1],                  // H = 0.468996, L = 1
  S5u: [0.2, 0.2, 0.2, 0.2, 0.2],   // H = 2.321928
}
```

The `K3` code is `encoder(CONV_CODES.K3)`, and its whole trellis is the eight
rows of the plan's §3. `RS15` is `rsCode(4, 15, 11)` over GF(2⁴).

## 6. What each lane pins

Every number in the plan's §5 for your group becomes a `reads` pair checked in
`experiments.test.js`. Each pin is computed in the test from the code's own
parameters, never typed in as a constant.

| Lane | Pins |
| --- | --- |
| 3, Group C | Every single error corrected and every double detected on the parity check. The eight syndromes of the (7,4) code. Weights 1, 7, 7, 1 and 128 of 128 words covered. The family's rates 0.3333, 0.5714, 0.7333 and 0.9048. Golay's `d = 7` at rate 0.521739. `RS(15,11)` with `d = 5` and four erasures filled |
| 4, Group A | `H = 2.121928` and `2.321928`. Lengths 2, 2, 2, 3, 3, average 2.200000, redundancy 0.078072, efficiency 96.451 %, Kraft 1.000000. The dyadic source at 1.750000. 0.645000, 0.532667 and 0.492550 by blocking. 48.900 bit for 100 symbols, and 0.470996 per symbol at 1000 |
| 5, Group B | 1.0000, 2.3165, 3.4594 and 6.6582 bit/s/Hz. 0.988592, 0.919207 and 0.531004 on the binary symmetric channel, and 0.110028 where it reaches one half. −0.8175, 0.0000, 1.7609 and 5.7403 dB, with the floor at −1.5917 dB |
| 6, Group D | The eight trellis rows. Free distance 5, 7, 10 and 12. Eight add-compare-select operations a step at `K = 3` and 128 at `K = 7`. Gains 3.979 dB and 6.990 dB. The traceback depth where the error count stops falling, against the rule of thumb of 15 steps |
| 7, Group E | 12 bits, 8 checks, 24 edges, girth 6. Design rate one third against a true rate of five twelfths, from a rank of 7. Syndrome weight 2 after one flip. The iteration the syndrome reaches zero at, and a seed whose decode never does |

## 7. Verify before handing the lane back

```
npx vitest run packages/codes apps/info-lab      # this lab, scoped
npm run lint:prose                               # every word a reader sees
npm run build --workspace apps/info-lab
```

Screenshot every view at 390 px and at 1280 × 900, and read the screenshots as a
student would, per `/REVIEW_PLAYBOOK.md` §11. There is no Playwright harness in
this lab yet, so the screenshot pass is the only thing that catches a pane fed
stale state. `NEEDS.md` §5 asks the director for the harness.

## 8. Gotchas this lab has already paid for

- **A tie in Huffman's queue changes the lengths and not the average.** The
  reference source gives 2, 2, 2, 3, 3 with the tie going to the leaf, and
  1, 3, 3, 3, 3 with it going to the join. Both average 2.2 bit.
- **The arithmetic coder needs exact integers.** A hundred symbols at `p = 0.9`
  narrow the interval to 2⁻⁴⁷, and a coder in doubles round-trips wrongly on
  exactly the sequences the lesson is about.
- **A `d_v = 2` graph cannot have independent rows.** See §3.7. Print the
  measured rate, and name the design rate as the promise it is.
- **The union bound is a bound.** A gain read off it is a lower bound on the
  gain. Lane 8 states the direction in the pane.
- **A test that fails may be the test.** Decide which, and say which in the
  commit.
- **The dark launch is enforced by a test.** While `RELEASE_STATUS` says `dark`,
  nothing outside `apps/info-lab/` may mention the lab, and `release.test.js`
  fails when anything does.
