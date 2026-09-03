# Prose style — the rules

The suite's writing standard. It applies to every word a reader can see: on-screen
text in the five labs, the splash page, the root documents, and the plan files.
It does not apply to the physics, the numbers, or the discipline of measuring
every claim. Those do not change.

On acceptance this file moves to the repo root as `STYLE.md`, and
`packages/prose` measures it the way `packages/explain` measures the math panel.

---

## The register

Write the way a good textbook writes a worked example. State the fact, give the
number, name the units. The subject matter carries the interest; the sentence
does not have to.

A reader arrives with a question and about eight seconds of patience. Every
construction that delays the answer costs some of that patience: an appositive
that withholds the noun, a reveal after a colon, a closing line that restates
the point as an epigram.

---

## Rules

Each rule is enforceable, and §Enforcement names the check.

**S1 — One claim per sentence.** If a sentence contains two facts joined by a
dash, a semicolon or "and so", it is two sentences.

**S2 — Sentence length.** Average at most 20 words across a note. No single
sentence over 30 words.

**S3 — No em dash for emphasis or reveal.** Budget: at most one per 150 words,
and only around a genuine parenthetical that a comma cannot hold. Replace the
rest with a full stop, a comma, or parentheses. En dashes in numeric ranges
(5–12 V) are unaffected.

**S4 — A colon introduces a list, a definition, or a value.** Never a reveal.
"Not a convention: it is the frequency where…" becomes "The cutoff is the
frequency where…".

**S5 — No semicolons.** Use two sentences. (Numeric series inside a single
sentence may use commas.)

**S6 — No sentence fragments.** Every sentence has a subject and a finite verb.
"One sine, one line." becomes "One sine wave, one spectrum line."

**S7 — No personification.** Components, solvers and equations do not decide,
want, refuse, know, remember, forgive, admit, or have a right to anything. See
the replacement table below.

**S8 — No evaluative words about the work.** Drop honest, elegant, sharp,
worth loving, ceremony, dust, confidently wrong, the real thing, the bar. A
sentence that praises the suite's rigour belongs in README, once.

**S9 — Headings and labels name their content.** Noun phrases, sentence case, no
wordplay, no promises. "The 9.5 bar" becomes "Target scores and the work to
reach them". "Notes that are alive" becomes "Notes that follow the controls".

**S10 — Second person only in instructions.** "Set R to 100 Ω" is correct. "The
resonance stands up in front of you" is not.

**S11 — One name per thing.** A control, a pane, a quantity and a lab each have
one name, used everywhere: in the label, the note, the tooltip, the docs and the
tests. No elegant variation. The fixed names live in `prose-rewrite/glossary.md`
when this lands.

**S12 — Numbers keep their unit and their significant figures**, and are never
characterised. "3.65 mV of ripple" is correct. "femto-dust" is not.

**S13 — Instructions start with the verb.** "Set f_s to 1 MHz. The ripple falls
to 36.5 µV." Sixteen words or fewer.

**S14 — Claims about testing appear in README and CONTRIBUTING only.** Not in
lesson text, not in headings, not in the splash tagline beyond one sentence.

---

## Replacement table

| Instead of | Write |
|---|---|
| the solver refuses | the circuit has no solution, and the app gives the reason |
| the source's decision / the resistor's | the source sets the voltage. The resistor sets the current |
| that is what "source" means | an ideal source holds its voltage at any current |
| it is renaming zero, not doing anything | V_ref shifts every node voltage by the same amount and changes no current |
| the books balance | the totals agree to within 1 % |
| femto-dust | rounding noise below 1 µV |
| the loop must fight it off | the loop reduces the disturbance |
| pay its bills | measure its margins |
| shove the plant | disturb the plant |
| nothing is free | an integrator costs phase |
| an instrument that forgets to start the lesson | opens without a question loaded |
| wants (of a machine) | requires |
| knows nothing about | does not depend on |
| THAT is why feedback exists | This reduction is the reason for feedback |

---

## Budgets

| Field | Words | Sentence average | Other |
|---|---|---|---|
| `see` | ≤ 70 | ≤ 20 | opens with the quantity on screen |
| `try[].say` (a step) | ≤ 45 | — | verb first, one setting, one reading |
| `try.text` (power's single line) | ≤ 16 | — | as `notes.test.js` already enforces |
| `why` | ≤ 160 | ≤ 22 | may define terms, 34-word sentence cap |
| `note` (power, signal, circuit, control) | ≤ 90, ≤ 70 on a group's first | ≤ 20 | as `notes.test.js` already enforces |
| caption | ≤ 20 | ≤ 20 | names quantity and units |
| term definition | ≤ 65 | ≤ 22 | three or four sentences, numbers over abstraction |
| button, tab, pane title | ≤ 4 words | — | sentence case, noun phrase |
| experiment name | ≤ 10 words | — | states the lesson's claim, sidebar width |
| tooltip | ≤ 15 | ≤ 15 | no dash |
| empty state | ≤ 12 | — | says what to do next |
| README, CONTRIBUTING paragraph | ≤ 90 | ≤ 22 | |

---

## Enforcement

A new workspace, `packages/prose`:

```
packages/prose/src/style.js      styleReport(text) -> counts and violations
packages/prose/src/banned.js     the regex list behind S7, S8, S10
packages/prose/testing.js        expectPlain(text, budget) for app tests
packages/prose/src/lintMd.js     the same rules over *.md
```

- `styleReport` returns `{ words, sentences, avgSentence, maxSentence, emDash,
  semicolon, fragments, banned[] }`. It reuses the sentence splitter already
  written in `apps/power-lab/src/notes.test.js`, which handles decimal points.
- Every app gains `src/prose.test.js`: every `see`, `try`, `why`, `note`,
  caption, term and chrome string against its budget.
- `npm run lint:prose` runs the markdown pass over the root documents and each
  app's `*.md`.
- Exceptions live in one file, `prose.allow.json`, keyed by string, each with a
  one-line reason. An exception without a reason fails the test.

The repository already works on the principle that an unmeasured claim drifts.
The same applies to the words. A hand edit fixes the sentences in front of it,
and nothing fails when the next sentence is written the old way. That is how
34,969 words of lesson text came to share one voice.
