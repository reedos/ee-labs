# Information Lab: the plan

The smallest lab in track B, and the one that closes it. It starts at the
Communications Lab's uncoded bit error rate curve, draws the Shannon limit on the
same axes, and then measures how close each code gets. Splash glyph `⊞`, directory
`apps/info-lab`, engine in a new package `packages/codes`.

The path, in order. Entropy, and the source coder that reaches it. Channel capacity,
and the limit no code crosses. Block codes and the syndrome. Convolutional codes and
Viterbi's trellis, walked one step at a time. LDPC as belief propagation watched.
Then the coding gain, measured against the curve this lab was handed.

This is a draft (2026-09-05) for Reed to settle. It has two dependencies. The
Communications Lab is planned in the sibling document `COMMUNICATIONS_LAB_PLAN.md`,
and its Group D supplies the uncoded curve. The Random Signals Lab, being built on
`lab/random-lab`, supplies the Q function that curve is made of.

The two rules that govern the other labs govern this one with no exemption. **Every
explanatory sentence is a claim about physics, and a test must measure it.** And
`CORE_SCOPE.md` decides what the engine may state exactly, what it may approximate
behind a guard, and what it declines with a reason. This lab is the easiest of the
twenty-eight on that second rule. Finite fields, trellises and code distances are
exact arithmetic on finite sets. The only estimated object is the simulated bit error
rate, and it arrives from the Communications Lab with its interval attached.

Every number below was computed by a script before it was written. The scripts are
not committed. The references are Cover and Thomas for the information theory and Lin
and Costello for the codes, with Proakis and Sklar for the link the codes run over.

---

## 0. Open decisions

### Decision 1: the name (recommended: Information Lab)

`EE_LABS_MAP.md` §1 calls it that. LabNav short form **"Information"**. The splash
card names the path in one line: "entropy, capacity, and the codes that reach them".
*Coding Lab* names four of the six groups and neither the entropy nor the capacity.
*Error Correction Lab* names the application rather than the subject.

### Decision 2: one lab or a group of the Communications Lab

Recommended: **one lab.** The reason is the interaction model. That lab's model is
Signal Lab's chain, with a waveform in every pane. This lab's objects are finite
alphabets, a parity-check matrix, a trellis and a Tanner graph. None is a waveform,
and drawing them in a chain would misrepresent them. The two labs share exactly one
canvas, the BER plot, and the Communications plan's Decision 3 already gives it a
`limits` prop. The separation costs one cross-lab link, where a twelfth group in a
lab that already has fifty experiments would cost more.

### Decision 3: where the trellis walker lives

The trellis is this lab's own interaction model and no second lab claims it.
`PROGRAM.md` §4's rule then puts it **in the app** rather than in `packages/ui`. The
VLSI Lab and the Computer Lab draw state machine diagrams, which is Logic Lab's
canvas rather than this one. Recommended: **build it in `apps/info-lab`**, against
the prop shape that canvas uses, so promotion is a move rather than a rewrite.

### Decision 4: Reed-Solomon, in or out

Reed-Solomon needs `GF(2^m)` with `m > 1`, polynomial arithmetic over it, and one of
the Berlekamp-Massey or Euclidean decoders. That is the largest single piece of
engine in this plan, and it carries one experiment. Recommended: **build the field
arithmetic and the encoder, and make the decoder a stretch.** C5 then shows the
code's distance and its erasure correction from the field arithmetic alone, which is
exact and cheap, and the pane states what is not shown.

### Decision 5: how much of the Communications Lab this lab assumes

Recommended: **the BER curve and nothing else.** A reader who wants the coding gain
needs `E_b/N_0` and an uncoded curve. That reader does not need the eye diagram, the
constellation or OFDM. Group F reads one function and one canvas, and every other
group stands alone on finite alphabets. This keeps the lab readable before the
Communications Lab is released, which matters because it is fourth in the order.

---

## 1. The progression map

Every idea the lab leans on, the experiment that teaches it, and whether that
experiment exists today. A row marked "being built" is on `lab/random-lab`. A row
marked "planned" is in the sibling plan. A row marked "gap" names the group here
that closes it.

| Idea the lab leans on | Needed by | Taught at | Status |
| --- | --- | --- | --- |
| A source, a chain of blocks, and a spectrum | A1, the app's shape | Signal Lab, all 35 | built |
| Quantisation, bits, and `6.02N + 1.76` dB | A1, A3 | Signal Lab `Nonlinearity`, `4 bits` | built |
| A seeded generator, reproducible per sample | A1, E3, F1 | Signal Lab `signals.js`, then Random Signals | built, extended |
| The Gaussian, and the Q function as its tail | B3, F1, F3 | Random Signals Lab, Gaussian group | being built |
| An estimate with its confidence interval printed | F1, F2 | Random Signals Lab, estimators group | being built |
| The signal-to-noise ratio, and `E_b/N_0` | B1, B3, F | Communications Lab Group D | planned |
| The uncoded BER curve, `Q(√(2γ_b))` | B4, F1, F2, F3 | Communications Lab D3 | planned |
| BPSK, and the soft metric a detector gives | D3, E2, F3 | Communications Lab B1, §2.5 | planned |
| The BER plot with a `limits` prop | B4, F | Communications Lab §4.2 | planned |
| Entropy as a number attached to a source | A | nowhere | **gap, A1** |
| Huffman and arithmetic coding | A2, A5 | nowhere | **gap, A** |
| Channel capacity, and the Shannon limit | B | nowhere | **gap, B** |
| `GF(2)` and `GF(2^m)` arithmetic | C, D, E | nowhere | **gap, C1** |
| The parity-check matrix and the syndrome | C | nowhere | **gap, C** |
| The trellis, and Viterbi's survivors | D | nowhere | **gap, D** |
| Belief propagation on a Tanner graph | E | nowhere | **gap, E** |
| Coding gain, measured rather than quoted | F | nowhere | **gap, F** |

One thing the map shows that this plan does not fix, so that it is a decision rather
than an omission. **Turbo codes and iterative demapping** need a decoder from this
lab and a demapper from the Communications Lab iterating against each other, across
two engines and two apps. Both plans name them as out, and the seam is recorded
rather than reopened. Groups A and C to E stand alone on finite alphabets and need
nothing that is not built. Group B needs `E_b/N_0` as a defined quantity. Group F
needs the Communications Lab's curve, and §9 makes it the last phase for that reason.

---

## 2. The engine: exact arithmetic on finite sets

### 2.1 What exists, and what is missing

Nothing in `packages/dsp` is a code, and nothing needs to be. This lab's engine
shares one thing with the rest of the suite, the seeded generator in `signals.js`
that makes a bit stream reproducible. Everything else is new, and all of it is exact.

| Need | Today | This plan |
| --- | --- | --- |
| Entropy, mutual information, capacity | none | `entropy.js` (§2.2) |
| Huffman and arithmetic coding | none | `source.js` (§2.3) |
| `GF(2)` vectors and matrices | none | `gf2.js` (§2.4) |
| `GF(2^m)` with log and antilog tables | none | `gfm.js` (§2.4) |
| Block codes, syndromes, the standard array | none | `block.js` (§2.5) |
| Cyclic codes from a generator polynomial | none | `block.js` (§2.5) |
| Reed-Solomon encoder, decoder as stretch | none | `rs.js` (§2.5, Decision 4) |
| The convolutional encoder and its trellis | none | `conv.js` (§2.6) |
| Viterbi with every step retained | none | `conv.js` (§2.6) |
| LDPC belief propagation, iterations retained | none | `ldpc.js` (§2.7) |
| The coded BER curve against the uncoded one | none | `gain.js` (§2.8) |

### 2.2 Entropy and capacity

`entropy.js` holds five functions, each a finite sum with no approximation in it. The
entropy `H(p) = −Σ p log₂ p`, the binary entropy `h₂(p)`, the mutual information of a
discrete channel from its transition matrix, the capacity of the binary symmetric and
binary erasure channels, and `C = B log₂(1 + S/N)`. At a signal-to-noise ratio of 10 dB the Gaussian capacity is 3.4594 bit/s/Hz, at
20 dB it is 6.6582, and at 0 dB exactly 1.0000. The binary symmetric channel at a
crossover of 0.1 has `h₂ = 0.468996` and a capacity of 0.531004 bit per use. Its
capacity reaches exactly one half at a crossover of 0.110028.

The Shannon limit on `E_b/N_0` is what the whole lab points at. From
`E_b/N_0 ≥ (2^r − 1)/r` at a spectral efficiency `r`, the minimum is 0.0000 dB at
1 bit/s/Hz, −0.8175 dB at one half, and `ln 2 = −1.5917 dB` as `r` goes to zero.
That last number is the vertical line B3 draws. The binary-input Gaussian channel's
capacity has no elementary closed form, so it is a numerical integral. Under
`CORE_SCOPE` Rule 3 it carries a guard, which is the integral's own convergence, and
the pane prints the value at two grid refinements with the difference between them.

### 2.3 Source coding

`source.js` holds two coders. Both are exact and lossless, both round-trip, and both
are checked against the entropy they are trying to reach.

**Huffman**, the bottom-up merge, returning a code and the length of each codeword.
The reference source is five symbols at 0.4, 0.2, 0.2, 0.1 and 0.1, with entropy
2.121928 bit. Huffman gives lengths of 2, 2, 2, 3 and 3, so the average length is
2.200000 bit and the redundancy is 0.078072 bit. The efficiency is 96.451 % and the
Kraft sum is exactly 1.000000. A fixed-length code needs 3 bit, a saving of 26.67 %.

Two more sources make the bound's edges visible. A dyadic source at 0.5, 0.25, 0.125
and 0.125 has entropy 1.750000 and a Huffman length of exactly 1.750000. A binary
source at `p = 0.9` has entropy 0.468996 against a length of 1 bit, the worst case,
and blocking gives 0.645000 per symbol at blocks of 2, 0.532667 at 3, 0.492550 at 4.

**Arithmetic coding**, one interval narrowed by each symbol, and the shortest binary
fraction inside it. The bound is `−log₂ P(x) + 2` bits for the whole sequence, which
is where it beats Huffman on a skewed source. For the same source 100 symbols cost at
most 48.900 bit against an ideal 46.900, so 0.488996 per symbol. At 1000 symbols the
rate is 0.470996.

### 2.4 Finite fields

`gf2.js` is vectors and matrices over the two-element field, which is addition modulo
two. It holds row reduction, rank, the null space, and the generator matrix in
systematic form. All of it is integer arithmetic with no rounding, so all of it is
exact. `gfm.js` is `GF(2^m)` as log and antilog tables from a primitive polynomial.
`GF(2⁴)` uses `x⁴ + x + 1`, which is `0x13`, and has 15 nonzero elements of order 15.
`GF(2⁸)` uses `x⁸ + x⁴ + x³ + x² + 1`, which is `0x11D`, the byte field Reed-Solomon
codes use. The fuzzer checks the field axioms by enumerating the whole field.

### 2.5 Block codes

`block.js` builds a code from a generator matrix or a parity-check matrix, and
derives what the other side needs. It returns the codeword list for small codes, the
weight distribution, the minimum distance, the syndrome table and the standard array.

The reference code is `(7,4)` Hamming, at rate 0.571429 with minimum distance 3. It
corrects one error and detects two. Its weight distribution is one word of weight 0,
seven of weight 3, seven of weight 4 and one of weight 7. It is perfect, because 16
codewords each covering 8 words fill all 128 words of length 7 exactly, and its
syndrome table has 8 rows with nothing left over.

The family generalises. A Hamming code with `r` parity bits has length `2^r − 1` and
distance 3 always, at a rate rising from 0.3333 at `r = 2` to 0.5714, 0.7333 and
0.9048 at `r = 3`, 4 and 6. Cyclic codes come from a generator polynomial by
polynomial division, and the syndrome is the remainder. Reed-Solomon is `GF(2^m)` and
meets the Singleton bound with equality, so `d = n − k + 1` exactly. `RS(255,223)`
over `GF(2⁸)` has distance 33 and corrects 16 symbol errors at a rate of 0.8745.

### 2.6 The convolutional encoder and the trellis

`conv.js` builds an encoder from a constraint length and generator polynomials in
octal, then expands it into a trellis. The reference code is rate one half at
constraint length 3 with generators 5 and 7. It has 4 states and 8 branches per step,
and §3 prints its whole trellis because a reader can hold eight rows in their head.

Its free distance is 5. The engine computes it by searching for the lowest-weight
path that leaves the all-zero state and returns to it, rather than quoting it, and
the search returns 5. Constraint length 5 with generators 23 and 35 gives 7,
constraint length 7 with 133 and 171 gives 10, and constraint length 9 gives 12.
**Viterbi keeps every step.** The decoder keeps the survivor path, the path
metric and the branch metrics of every state at every step, and returns them as an
array rather than returning only the decoded bits. The trellis walker then scrubs
through the decode the way Elements I2 scrubs through Newton's iterations.

The cost is a count rather than a word. Constraint length 3 needs 8
add-compare-select operations per step, constraint length 7 needs 128, and constraint
length 9 needs 512. The traceback depth rule of thumb is five constraint lengths, 35
steps at `K = 7`, and D5 measures it.

### 2.7 LDPC and belief propagation

`ldpc.js` holds a parity-check matrix, its Tanner graph, and the sum-product decoder.
A regular code with `d_v` ones per column and `d_c` ones per row has rate
`1 − d_v/d_c` when the matrix has full rank, so a `(3,6)` code has rate one half. The
lab's own code is small enough to draw. It is 12 bits with 8 checks, `d_v = 2` and
`d_c = 3`, at rate one third, and every node and edge fits on a phone screen. A
`(3,6)` code of length 1008 is available for the BER experiments, with 504 checks and
3024 edges, so one iteration passes 6048 messages.

**Every iteration is retained**, the way Viterbi's steps are. The view draws the
graph, colours each edge by the sign and magnitude of the message on it, and steps
through the iterations. The syndrome weight is on screen after each one, and the
decode stops when it reaches zero.

The decoder is exact arithmetic on the log-likelihood ratios it is given. What it is
not is optimal, and the pane says so. Belief propagation on a graph with cycles is
not maximum-likelihood decoding, and it can fail to converge. That is a stated
property of the algorithm rather than a numerical guard, and E3 shows a decode that
does not converge.

### 2.8 Coding gain, measured

`gain.js` computes the coded bit error rate from the uncoded one. Every gain in Group
F is then a measured distance between two curves, rather than a decibel figure quoted
from a table.

For a hard-decision block code the coded channel bit error rate is
`p = Q(√(2R γ_b))`, because the code spends `R` of each bit's energy on the message.
The decoded rate follows from the sum over error patterns of weight above `t`. For a
soft-decision convolutional code the bound is `Σ_d B_d Q(√(2R d γ_b))`, with `B_d`
from the code's transfer function. For the reference code those coefficients are
`B_{5+k} = (k + 1)2^k`, giving 1, 4, 12, 32, 80, 192, 448 and 1024 at distances 5
to 12.

Two gains are reported, and keeping them apart is Group F's subject. The **asymptotic
coding gain** is `10 log₁₀(R d)` for soft decisions and `10 log₁₀(R(t + 1))` for hard
ones. The **real coding gain** is the horizontal distance between the two curves at a
stated bit error rate. They are different numbers, and the difference is 0.167 dB for
the `(7,4)` Hamming code at 10⁻⁵ and 1.052 dB for Golay `(23,12)`.

The convolutional bound is an upper bound on the error rate, so the gain read from it
is a lower bound on the gain. The pane says which direction the inequality runs. A
bound presented as a value is the failure `CORE_SCOPE` Rule 3 is written against.

### 2.9 Measures

Six groups of measure, and every experiment reads at least two of them.

- The entropy of a source, the average codeword length, the redundancy, the
  efficiency as a percentage, and the Kraft sum.
- The channel's capacity, in bits per use and in bits per second per hertz.
- The Shannon limit on `E_b/N_0` at the code's own rate.
- The code's length, dimension, rate, minimum distance, correction radius, detection
  radius and weight distribution.
- The syndrome, and the error pattern it names.
- The free distance of a convolutional code, the path metric of every survivor at
  every step, and the add-compare-select count.
- The syndrome weight after each belief-propagation iteration, the coded and uncoded
  bit error rates at the same `E_b/N_0`, and both coding gains.

### 2.10 Invariants, the fuzzer's checklist

Across random messages, error patterns, sources and seeds:

1. **The field is a field.** Every nonzero element of `GF(2^m)` has a unique inverse,
   multiplication is associative and commutative, and the primitive element's powers
   enumerate the nonzero elements exactly once.
2. **The code is linear**, and **distance is the minimum weight.** The sum of two
   codewords is a codeword, and the minimum distance found by enumeration equals the
   smallest nonzero weight in the weight distribution.
3. **The syndrome depends only on the error.** `H(c + e)ᵀ = Heᵀ` for every codeword
   `c` and every error pattern `e`.
4. **Correct t, always.** A decoder corrects every error pattern of weight `t` or
   less, over every codeword, by enumeration rather than by sampling.
5. **Detect d − 1, always.** A decoder gives a nonzero syndrome for every error
   pattern of weight between 1 and `d − 1`, again by enumeration.
6. **And no further.** Some pattern of weight `t + 1` decodes to the wrong codeword,
   and the fuzzer finds one, so the radius is shown to be tight.
7. **Viterbi is exact on a clean channel.** With no errors the decoder returns the
   transmitted path, and every survivor metric on that path is zero.
8. **Viterbi is maximum likelihood.** For short blocks the survivor returned has the
   lowest path metric of all `2^L` paths, checked against exhaustive search.
9. **Belief propagation stops at a codeword.** Whenever it converges, the result
   satisfies every parity check and the printed syndrome weight reached zero.
10. **Source coding round-trips**, and **Huffman sits inside its bounds.** Decoding
    returns the original symbols exactly, `H ≤ L < H + 1` for every source, and the
    Kraft sum is exactly 1.
11. **The gain has the right sign.** The coded curve is below the uncoded one above
    the crossover and above it below, and the crossover printed is the measured one.
12. **Cross-lab.** The uncoded curve equals the Communications Lab's closed form to
    floating point, and the Shannon limit at each code's rate falls to the left of
    every point on that lab's plot.
---

## 3. Models: the code library

Every object below is fixed by name, so a lesson, a test and a view refer to the same
thing. This is the equivalent of the Electronics Lab's element library.

| Object | Definition | Numbers |
| --- | --- | --- |
| Source `S5` | five symbols at 0.4, 0.2, 0.2, 0.1, 0.1 | `H = 2.121928`, Huffman `L = 2.200000` |
| Source `S4d` | dyadic, 0.5, 0.25, 0.125, 0.125 | `H = 1.750000`, Huffman `L = 1.750000` |
| Source `S2` | binary, `p = 0.9` | `H = 0.468996`, Huffman `L = 1` |
| Channel `BSC(p)` | binary symmetric, crossover `p` | `C = 1 − h₂(p)`, 0.531004 at `p = 0.1` |
| Channel `BEC(e)` | binary erasure, erasure `e` | `C = 1 − e` exactly |
| Channel `AWGN` | Gaussian, from the Communications Lab | `C = log₂(1 + S/N)` |
| Code `H74` | `(7,4)` Hamming, `d = 3` | rate 0.571429, weights 1, 7, 7, 1 |
| Code `H15` | `(15,11)` Hamming, `d = 3` | rate 0.733333 |
| Code `G23` | Golay `(23,12)`, `d = 7`, `t = 3` | rate 0.521739, soft gain 5.626 dB |
| Code `RS15` | Reed-Solomon `(15,11)` over `GF(2⁴)` | `d = 5`, `t = 2`, rate 0.733333 |
| Code `K3` | convolutional, `K = 3`, generators 5 and 7 | 4 states, `d_free = 5` |
| Code `K7` | convolutional, `K = 7`, generators 133 and 171 | 64 states, `d_free = 10` |
| Code `L12` | LDPC, 12 bits, 8 checks, `d_v = 2`, `d_c = 3` | rate 0.3333, drawable |
| Code `L1008` | LDPC `(3,6)`, length 1008 | rate 0.5, 3024 edges |

The `K3` trellis in full, because it fits and because the walker view draws it:

| State | Input | Next state | Output |
| --- | --- | --- | --- |
| 00 | 0 | 00 | 00 |
| 00 | 1 | 10 | 11 |
| 01 | 0 | 00 | 11 |
| 01 | 1 | 10 | 00 |
| 10 | 0 | 01 | 01 |
| 10 | 1 | 11 | 10 |
| 11 | 0 | 01 | 10 |
| 11 | 1 | 11 | 01 |

**Preset description.** As Signal Lab: each experiment is a `patch` naming a source,
a channel and a code, with a `note`, a `try`, chips, a `featured` control and a
`terms` list. The schema does not change.

---

## 4. The app

### 4.1 Layout

Signal Lab's shape, unchanged: a sidebar with LabNav, the report link, the experiment
groups, the object pickers with NumFields and chips, and the math panel. The main
area has a topbar of meters and two panes with a pane selector each. Phone-width
first, no horizontal scroll at 390 px, harness-checked. The topbar shows the code's
`(n, k, d)` and rate first, then the experiment's headline numbers, then the channel.
For Group A it shows the entropy, the average length and the efficiency instead.

### 4.2 Views

Two are reused and four are new. Only one of the four is a new interaction model,
which is why this lab is small.

- **BER plot**, reused from the Communications Lab. The uncoded curve, the coded
  curve, the Shannon limit as a vertical line at the code's rate, and the crossover
  marked. This is the `limits` prop that plan's Decision 3 builds in.
- **Spectrum and scope**, reused. Group A's bit stream and Group F's waveform are
  Signal Lab's canvases with no change.
- **Code table**, new. The generator matrix, the parity-check matrix, the codeword
  list for small codes, and the syndrome table. Cells light when the reader changes a
  message or an error pattern, so the syndrome's dependence on the error alone is
  visible rather than asserted.
- **Weight and distance**, new. The weight distribution as a bar chart, with the
  correction and detection radii as two circles around a codeword.
- **Trellis walker**, new, and the lab's own interaction model. States down, time
  across, every branch drawn, the survivor into each state in one colour and the
  discarded branch in another. A scrubber moves through the steps with each state's
  path metric beside it, and at the end the traceback runs backwards.
- **Tanner graph**, new. Variable nodes, check nodes, and each edge coloured by the
  sign and magnitude of its message. A scrubber moves through the iterations, with
  the syndrome weight above the graph.
- **Code tree**, new and small. The Huffman tree, with the probability at each node
  and the codeword at each leaf. The arithmetic coder's interval is a shrinking bar
  on the same pane.

### 4.3 Numbers

The defaults are the objects of §3, chosen so that every one fits on a phone screen.
Their numbers are in that table and are not repeated here. Three choices are worth
stating.

- **The reference source is `S5`**, five symbols at 0.4, 0.2, 0.2, 0.1 and 0.1. It is
  the smallest source whose Huffman code has two lengths and a nonzero redundancy,
  which is what A2 needs. `S4d` and `S2` are the two edges of the bound.
- **The reference code is `H74`**, because it is perfect, its syndrome table is
  complete at 8 rows, and its 16 codewords fit in the code table view. `G23` is the
  longer code that shows a real gain.
- **The reference channel is `BSC(0.1)`** for Groups C to E, and the Communications
  Lab's AWGN for Group F. The first is a count and the second is a curve, and F1 is
  where the two meet.

---

## 5. Curriculum: 25 experiments in 6 groups

Format, as the other plans: **the claim** the note makes, what the reader turns, and
what is **measured** against what **formula**. Every quoted number becomes a pinned
test. Each experiment ships with `see`, `try` and `why` in the three registers,
within the STYLE.md budgets.

### Group A: Entropy and source coding (5)

- **A1 · Entropy is a number a source has.** Five symbols at 0.4, 0.2, 0.2, 0.1 and
  0.1. Measured: `H = 2.121928` bit against `−Σ p log₂ p`. Then the two extremes. A
  uniform five-symbol source has `H = log₂ 5 = 2.321928`, and a source with one
  certain symbol has `H = 0`.
- **A2 · Huffman reaches within one bit.** Build the tree bottom up. Measured: the
  lengths 2, 2, 2, 3 and 3, the average 2.200000 bit, the redundancy 0.078072 bit and
  the efficiency 96.451 %. Formula: `H ≤ L < H + 1`.
- **A3 · When Huffman is exact, and when it is worst.** Two more sources. Measured:
  the dyadic source's `L = H = 1.750000`, and the binary source at `p = 0.9` with
  `H = 0.468996` against `L = 1`. Formula: Huffman is exact when every probability is
  a power of one half.
- **A4 · Blocking recovers the gap.** Code pairs, triples and quadruples of the
  `p = 0.9` source. Measured: 0.645000 bit per symbol at blocks of 2, 0.532667 at 3
  and 0.492550 at 4, against an entropy of 0.468996. The gap falls as `1/n`.
- **A5 · Arithmetic coding needs no blocks.** One interval, narrowed per symbol.
  Measured: 100 symbols of the `p = 0.9` source cost at most 48.900 bit, so 0.488996
  per symbol, and 1000 symbols cost 0.470996. Then the Kraft sum, exactly 1.000000.

### Group B: Capacity and the Shannon limit (4)

- **B1 · Capacity is a rate, not a quality.** Measured: `log₂(1 + S/N)`, which is
  1.0000 bit/s/Hz at 0 dB, 2.3165 at 6 dB, 3.4594 at 10 dB and 6.6582 at 20 dB.
- **B2 · A noisy binary channel still has a capacity.** Measured: `1 − h₂(p)` for the
  binary symmetric channel, 0.988592 at `p = 0.001`, 0.919207 at 0.01 and 0.531004 at
  0.1. It reaches one half at `p = 0.110028` and zero at `p = 0.5`. Then the erasure
  channel, whose capacity is exactly `1 − e`.
- **B3 · The limit on `E_b/N_0`.** Measured: `(2^r − 1)/r`, which is −0.8175 dB at
  half a bit per second per hertz, 0.0000 dB at 1, 1.7609 dB at 2 and 5.7403 dB at 4.
  As the rate goes to zero it approaches `ln 2 = −1.5917 dB`.
- **B4 · The limit drawn on the BER plot.** The Communications Lab's uncoded curve,
  with a vertical line at the limit for its spectral efficiency. Measured: uncoded
  BPSK at 10⁻⁵ sits 9.588 dB to the right of its limit, QPSK 7.827 dB and 16-QAM
  7.695 dB. Every code in the rest of this lab closes part of that gap.

### Group C: Block codes (5)

- **C1 · A parity bit detects one error.** One check over four bits. Measured: every
  single error changes the parity and every double error does not. Then `GF(2)`, where
  addition is exclusive-or and the code is a subspace.
- **C2 · The syndrome names the error.** The `(7,4)` Hamming code. Measured: the eight
  syndromes, one for no error and seven for the single-error patterns, and the reader
  flips a bit and reads the syndrome pointing at it. Formula: `H(c + e)ᵀ = Heᵀ`, so
  the syndrome depends on the error alone.
- **C3 · Distance decides what a code can do.** Measured: the weight distribution of
  the `(7,4)` code, one word of weight 0, seven of weight 3, seven of weight 4 and one
  of weight 7, so `d = 3`. It corrects one error and detects two. Then the
  sphere-packing count. 16 codewords each covering 8 words fill all 128 words exactly.
- **C4 · A cyclic code is polynomial division.** The same `(7,4)` code from the
  generator polynomial `x³ + x + 1`. Measured: the encoder as a shift register, the
  syndrome as the remainder, and the codeword set identical to C2's. Then Golay
  `(23,12)`, with `d = 7` and 3 errors corrected at rate 0.521739.
- **C5 · Bytes instead of bits.** `GF(2⁴)` from `x⁴ + x + 1`. Measured: the 15 nonzero
  elements as powers of the primitive element, each appearing once. Then `RS(15,11)`,
  whose distance is `n − k + 1 = 5` exactly, the Singleton bound met. It corrects 2
  symbol errors or 4 erasures. Decision 4 makes the full decoder a stretch.

### Group D: Convolutional codes and Viterbi (5)

- **D1 · The encoder has memory.** Constraint length 3, generators 5 and 7. Measured:
  the output pair for each of the 8 state and input combinations, which is the table
  in §3, and the encoder's impulse response, which is the generator itself.
- **D2 · The trellis is the encoder unrolled.** Four states down, time across.
  Measured: every path is a codeword and every codeword is a path, by enumeration over
  short blocks.
- **D3 · Viterbi discards half the paths at every step.** Measured: the survivor into
  each state, its path metric, and the branch discarded. The count is 8
  add-compare-select operations per step at `K = 3` and 128 at `K = 7`, against `2^L`
  paths for exhaustive search.
- **D4 · Free distance decides the gain.** Measured: the lowest-weight path that
  leaves the all-zero state and returns, which the engine finds to be 5 for `K = 3`
  and 10 for `K = 7`. Formula: the asymptotic soft coding gain is
  `10 log₁₀(R d_free)`, which is 3.979 dB and 6.990 dB.
- **D5 · Traceback needs depth.** Truncate the traceback and errors appear. Measured:
  the bit error rate against traceback depth at a fixed `E_b/N_0`, and the depth at
  which it stops falling. The rule of thumb is five constraint lengths, which is 35
  steps at `K = 7`.

### Group E: LDPC and belief propagation (3)

- **E1 · The code is a graph.** 12 bits, 8 checks, two checks per bit and three bits
  per check. Measured: the rate from the graph, `1 − d_v/d_c` when the matrix has full
  rank, and the syndrome of a received word read off the check nodes.
- **E2 · Belief propagation passes messages.** Measured: the message on each edge at
  each iteration, the syndrome weight after each, and the iteration at which it
  reaches zero. Cross-reference: the Communications Lab's soft metric, which is where
  the input beliefs come from.
- **E3 · Iterations buy error rate, and then stop.** Measured: the bit error rate
  against the iteration count at a fixed `E_b/N_0`, and the iteration past which it
  stops improving. Then a decode that does not converge, with the pane's statement
  that belief propagation on a graph with cycles is not maximum-likelihood decoding.

### Group F: Coding gain measured (3)

The lab's conclusion, and its only dependency on the Communications Lab. Each
experiment is two curves and the distance between them.

- **F1 · The coded curve, against the uncoded one.** The `(7,4)` Hamming code with
  hard decisions. Measured: the `E_b/N_0` for a bit error rate of 10⁻⁵, 9.174 dB
  against an uncoded 9.588 dB, so a real coding gain of 0.413 dB. Then the asymptotic
  figure, `10 log₁₀(R(t + 1)) = 0.580 dB`, and the 0.167 dB between them.
- **F2 · Below the crossover a code loses.** Measured: the `E_b/N_0` at which the two
  curves meet, 5.862 dB, where both read 2.741 × 10⁻³. Below it the code is worse,
  because spending `R` of each bit's energy costs more than correcting one error in
  seven gains.
- **F3 · Soft decisions are worth 1.585 dB.** The `K3` code, hard and soft. Measured:
  the soft-decision curve reaching 10⁻⁵ at 5.882 dB, a real gain of 3.706 dB against
  an asymptotic 3.979 dB. Then the reason. At rate one half the binary-input Gaussian
  channel reaches capacity at −2.823 dB and the hard-decision channel at −1.238 dB.

---

## 6. Hand-overs

- **← Communications Lab** (B4, F1, F2, F3). The uncoded BER closed form as a
  function, and the BER canvas with its `limits` prop. That plan's Decision 3 and §6
  build both, so this lab imports rather than forks. Tested both ways: the curve drawn
  here equals that lab's closed form to floating point, and the Shannon limit drawn
  there is this lab's `entropy.js`.
- **← Communications Lab, second item** (E2, F3). The soft metric, the per-bit
  log-likelihood ratio from that lab's `detect.js`, which is the input to every soft
  decoder here. Tested: the metric's sign agrees with the hard decision, and its
  magnitude scales with `E_b/N_0` as the closed form says.
- **← Random Signals Lab, and Signal Lab.** The Q function reaches this lab through
  the Communications Lab rather than directly. Signal Lab's `4 bits` preset is A1's
  opening, because a quantiser is a source coder that throws information away, and its
  seeded generator is every random bit stream here.
- **→ Communications Lab.** Nothing, by design. A coded link would put a decoder
  inside that lab's chain, which is the turbo seam both plans decline. The one link
  runs from that lab's BER plot to this lab's limit, and it runs one way.
- **→ VLSI Lab and Computer Lab.** The Viterbi decoder is a datapath with a register
  file and a compare, and D3's operation count is what those labs would budget.

---

## 7. Testing discipline

- **Unit** (`packages/codes`): the field axioms by enumeration over `GF(2⁴)` and
  `GF(2⁸)`. Row reduction against hand-worked matrices. The `(7,4)` code's 16
  codewords, weight distribution and syndrome table against hand values. Huffman
  against the three reference sources. The arithmetic coder against its own decoder on
  10 000 random streams. The trellis against the table in §3. Viterbi against
  exhaustive search for blocks of 8. Every capacity against its closed form.
- **Invariants** (§2.10), fuzzed across messages, error patterns, sources and seeds.
  Invariants 4, 5 and 6 are enumerated rather than sampled for every small code,
  because "always" is the claim and a sample cannot make it.
- **Experiments**: every number in §5 pinned. Among them 2.121928, 2.200000,
  0.468996, 0.492550, 0.531004, 0.110028, −1.5917, 5.7403, 0.413, 0.580, 5.862, 3.706
  and 1.585.
- **The map's promises**: a test walks every `why` and requires each referenced
  experiment to exist in the named lab. Group F's references fail until the
  Communications Lab ships D3, which is why this lab is fourth in the build order.
- **Guards and cross-lab pins**: the capacity integral's convergence guard and the
  convolutional bound's stated direction. Then the uncoded curve against the
  Communications Lab's closed form, and the Shannon limit against every point on that
  lab's plot. There are two guards in the whole lab, and §0 says why.
- **Playwright harness**: the syndrome cell lights when a bit is flipped. The trellis
  survivor changes colour when a branch metric changes. The Tanner edge changes colour
  when the belief flips sign. No horizontal scroll at 390 px.
- **REVIEW_PLAYBOOK audit** before release, all eleven classes, a screenshot pass, and
  the sittings script with three seats. One seat sits Group D.

---

## 8. Integration and the dark launch

The mechanism is the one Power Lab and the Elements lab share, unchanged:

- Deployed **dark** at `/info-lab/` from the first vertical slice. Unlisted, not
  secret.
- `apps/info-lab/RELEASE_STATUS` reads `dark`. A test asserts that while it does, the
  splash, the root README and the other labs' LabNav contain no reference to the
  Information Lab. Flip the word to `released` and the same test demands the splash
  card, the README row and the nav entries, with counts pinned.
- No shared surface changes. The one canvas this lab shares arrives from the
  Communications Lab, which owns it. That is the smallest integration footprint of any
  lab in the map, and the flip is **Reed's action** after the release gate in §9.

---

## 9. Phasing

Each phase ships green and deployable dark. The order is by dependency, and Group F
is last because it is the only group that waits on another lab.

1. **The field and the block codes.** `gf2.js`, `gfm.js`, `block.js`. App shell, the
   code table and the weight view, dark deploy and the `RELEASE_STATUS` test.
   **Group C** (5). Exit: invariants 1 to 7 fuzzed green, every C number pinned, and
   C5 stating what Decision 4 leaves out.
2. **Entropy and source coding.** `entropy.js`, `source.js`, the code tree view.
   **Group A** (5). Exit: invariant 11 green, and A2's three sources pinned.
3. **Capacity, without the plot.** The rest of `entropy.js` and B1 to B3. **Group B**
   (3 of 4). Exit: every capacity pinned and the Shannon limit computed at five rates.
   B4 waits on phase 6.
4. **The trellis.** `conv.js`, the trellis walker view. **Group D** (5). Exit:
   invariants 8 and 9 green, the free distance computed rather than quoted, and D3's
   operation counts pinned.
5. **The graph.** `ldpc.js`, the Tanner graph view. **Group E** (3). Exit: invariant
   10 green, and E3's non-converging decode reproducible from its seed.
6. **The gain.** `gain.js`, the BER plot imported from the Communications Lab, B4 and
   **Group F** (3 plus B4). Exit: invariants 12 and 13 green, the crossover pinned at
   5.862 dB, and both cross-lab tests passing. This phase waits on the Communications
   Lab's Group D.
7. **The release gate**, in order, each blocking the next. The full audit (every
   option, every preset, every claim, fuzzing, both browsers). The student sittings.
   Reed's own pass against the dark deployment. Then the flip.

Phases 1 to 5 are 21 of the 25 experiments and need nothing that is not built today.
That is the argument for building this lab earlier than the map's order suggests.

---

## 10. Non-goals (v1, stated so they are decisions rather than omissions)

- **Turbo codes and iterative demapping.** They need this lab's decoder and the
  Communications Lab's demapper iterating against each other, across two engines. Both
  plans decline them, and the seam is recorded in §1.
- **Polar codes.** A successive-cancellation decoder with its own interaction model.
  Named as the first candidate for a second version.
- **Density evolution and the LDPC threshold.** The regular `(3,6)` ensemble's
  threshold of 1.11 dB over the binary-input Gaussian channel is quoted from
  Richardson and Urbanke in E3's `why` and is not computed here. Computing it needs a
  numerical fixed point over message densities.
- **The Berlekamp-Massey decoder.** Decision 4 makes it a stretch. C5 shows the
  distance and the erasure correction from the field arithmetic alone.
- **Rate-distortion theory, lossy coding, and continuous sources.** The Gaussian
  channel's capacity is used and its derivation is declined, exactly as the
  Electronics Lab uses `H(s)` and declines the transform as a topic.
- **Cryptography, universal coding and network information theory.** Shannon's other
  paper, Lempel-Ziv, and the multiple access channel. The first has no physics, the
  second makes claims about typical files rather than about a stated source, and the
  third is a graduate course no lab in the map assumes.
- **A free-form matrix editor.** Curated codes with editable messages and error
  patterns, as every other lab uses curated circuits.

---

## 11. Risks, named

- **The build order says fourth, and the dependencies say second.** `EE_LABS_MAP.md`
  §4 puts this lab in step 11 with a note that it can slot in earlier. Phases 1 to 5
  say it can, and 21 of the 25 experiments need nothing that is not built. This is
  the first thing the director should decide. Group F waits on the Communications Lab,
  which waits on the Random Signals Lab, and Decision 5 keeps that dependency to one
  function and one canvas.
- **The trellis walker is a new interaction model with one user.** Decision 3 keeps it
  in the app, which is right by `PROGRAM.md` §4 and wrong if the Computer Lab later
  wants it. Mitigation: build it against the Logic Lab's state machine prop shape, so
  promotion is a move rather than a rewrite.
- **Enumeration does not scale.** Invariants 4, 5 and 6 enumerate every error pattern,
  which is fine for `(7,4)` and impossible for `(23,12)` at weight 4. Mitigation: the
  enumerated codes are named in the test, the larger ones are sampled with a stated
  count, and the test reports which it did.
- **A bound read as a value, and a threshold quoted rather than computed.** The
  convolutional gain comes from an upper bound, and the LDPC threshold of 1.11 dB is a
  literature value. Mitigation: §2.8's rule and the pane's statement of the
  inequality, and §10 naming the threshold as quoted with no test pinning it.
- **Numbers that are right for one code.** Every quoted gain is for the codes of §3.
  Mitigation: each pin is a function of `(n, k, d)` and the rate, re-derived in the
  test rather than stored as a constant.
- **Cost.** One new package, four new views and 25 experiments. This is the smallest
  lab in the map by experiment count, and its engine is the easiest to test. Every
  object is a finite set, and every claim about it is a count.
