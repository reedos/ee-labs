# Prose rewrite — proposal and status

2026-09-03. The rules are in [STYLE.md](STYLE.md), enforced by
`packages/prose`. Phases 1 to 5 and 9 have shipped. What is left is phases 6 to
8: the three released labs, which another session held while this ran, and the
two plan documents.

## Status, 2026-09-03

| Surface | State |
|---|---|
| `packages/prose` + `npm run lint:prose` | shipped, 10 tests |
| README, CONTRIBUTING, CORE_SCOPE, REVIEW_PLAYBOOK, STYLE.md | rewritten, lint clean |
| `site/index.html` (tagline, three cards, hero captions, triangle, footer, meta) | rewritten |
| Power Lab: 22 notes, try lines, 33 terms, chrome | rewritten, `prose.test.js` green, `verify` green |
| Circuit Elements Lab: 55 lessons (see/try/why), 60 terms, chrome | rewritten, `prose.test.js` green, `verify` green |
| `apps/power-lab/NEEDS.md`, `apps/circuit-elements-lab/SITTINGS.md` | rewritten, lint clean |
| Signal, Circuit, Control labs | **not started** — held by another session |
| `CIRCUIT_ELEMENTS_LAB_PLAN.md`, `POWER_LAB_PLAN.md` | **not started** — 587 lint findings between them |

Every number, unit and significant figure is unchanged. The full suite is green
at 2941 tests, and both dark labs pass `npm run verify` in a real browser.

Three budgets were widened from the first draft, each with the reason recorded
in `packages/prose/src/style.js`: a term definition to 65 words (symbols count
as words in a math-heavy glossary), an experiment name to 10 words (Circuit
Elements Lab states the lesson's claim in the name), and a `try` step to 45
words (the figure that lab's plan already fixed).

---

The suite is written in one voice: dashes that withhold a noun, colons that
reveal, closing lines that restate the point as an epigram, and components that
decide, want and refuse. It is consistent and it is doing damage in three
measurable places: a student reading a note at speed, a stranger deciding on the
splash page whether this is a serious tool, and an agent picking up a plan
document and copying its register into new lessons. This is the plan to remove
it.

---

## 1. What was reviewed

| Surface | Files | Strings | Words |
|---|---|---|---|
| Root documents | 8 `.md` | — | 36,289 |
| On-screen lesson text (5 labs) | `lessons.js`, `experiments.js`, `presets.js`, `terms.js`, captions, headlines | 1,358 | 34,969 |
| On-screen chrome (5 labs + `packages/ui`) | `App.jsx`, components | 286 | ~1,900 |
| Splash page | `site/index.html` | — | 3,125 |
| Code comments | apps + packages | 945 blocks | 35,881 |

Measured with `scan.py` (in the session scratchpad), which extracts prose fields
by name and counts the constructions the rules ban.

| Surface | em dashes /1k words | semicolons /1k | colon reveals /1k |
|---|---|---|---|
| Root documents | 12.5 | 15.3 | 9.0 |
| Code comments | 12.7 | 4.8 | 11.2 |
| Circuit Elements Lab | 15.3 | 6.4 | 9.4 |
| Signal Lab | 19.9 | 7.3 | 11.0 |
| Circuit Lab | 18.4 | 4.5 | 6.2 |
| Control Lab | 17.6 | 6.2 | 9.9 |
| **Power Lab** | **4.9** | 7.4 | 7.4 |

One dash every 50 to 80 words everywhere except Power Lab, which has one every
200. Power Lab is also the only app with a prose test:
`apps/power-lab/src/notes.test.js` caps note length and sentence average. The
mechanism that produced the difference already exists in the repository, in one
app. Section 5 generalises it.

## 2. The ten habits

Each is named so a reviewer can point at it, with a real example.

1. **The aphoristic closer.** A sentence that adds no fact and restates the
   paragraph as a maxim. "The voltage is the source's decision; the current is
   the resistor's." (elements A1)
2. **The dash appositive.** A noun withheld, then supplied after a dash.
   "Voltage is energy per unit of charge — how hard each coulomb is pushed."
3. **The colon reveal.** "The cutoff is not a convention: it is the frequency
   where…" (circuit lab)
4. **Negate, then correct.** "Not a bigger number — a different object." (signal
   lab); "shrunk, not removed" (control lab)
5. **Personification.** Solvers refuse, sources decide, loops fight back, plants
   get shoved, books balance, integrators erase.
6. **Fragments for emphasis.** "One sine, one line." "Same object, four
   vocabularies." "Nothing is free."
7. **Praise of the work, inside the work.** "the thing that makes this subject
   worth loving" (README), "You are it." (CONTRIBUTING), "Signal Lab is already
   the course." (reviews)
8. **Literary headings.** "The 9.5 bar", "Notes that are alive", "Why it works,
   and the working", "In time, as poles, and as math".
9. **Theatrical second person.** "drag a Q slider and the resonance stands up in
   front of you", "Close a loop and pay its bills".
10. **Emphasis by capital.** "THAT is why feedback exists", "A disturbance lands
    on the PLANT".

## 3. What does not change

- Every number, unit and significant figure on screen.
- The rule that every explanatory sentence is a claim a test measures. The
  rewrite keeps each note matched to the same measurement.
- The `see` / `try` / `why` registers, the group intros, the term-on-contact
  glossary, and the order of claims within a note.
- Layout, controls, plots, and the physics.
- Technical vocabulary. Plain does not mean simplified: "conduction angle" and
  "volt-second balance" stay.

## 4. The rules

Fourteen rules in [STYLE.md](STYLE.md), each with a check and a word budget per
field. In short:

- One claim per sentence, 20 words on average, 30 at most.
- No dash for emphasis. Colons introduce a list, a definition or a value.
- No semicolons and no fragments.
- No personification of parts, solvers or loops, and no praise of the work.
- Headings and labels name their content. One name per thing, everywhere.
- Second person only in instructions, and instructions start with the verb.
- Numbers keep their units and significant figures.
- The claim that everything is tested is made in README and CONTRIBUTING only.

## 5. Enforcement

A new workspace, `packages/prose`, with `styleReport()`, a banned-construction
list, `expectPlain()` for app tests, and a markdown pass behind
`npm run lint:prose`. Each app gains `src/prose.test.js`. Exceptions live in one
`prose.allow.json`, and an exception without a stated reason fails.

Without this, the rewrite decays: it is 70,000 words maintained by several agents
who each read the surrounding prose to decide how to write the next line.

## 6. The drafts

The drafts for README, CONTRIBUTING and STYLE.md have been applied and their
copies removed, so there is one version of each. What remains in
`prose-rewrite/` is the record of the decisions:

| File | Covers |
|---|---|
| `splash-copy.md` | header, hero captions, three lab cards, triangle, footer |
| `ui-strings.md` | all 34 chrome strings that change, with file, line and the verify selectors each rename breaks |
| `lessons-samples.md` | twelve worked lesson rewrites, at least two per lab |

## 7. Plan of work

Each phase is one commit per lab, tests green, and the two dark labs are done
first because their text is not live.

| # | Work | Size |
|---|---|---|
| 1 | `packages/prose` and its tests. Rules encoded, no prose changed. `lint:prose` reports the current violation count as the baseline. | half a day |
| 2 | Root documents: README, CONTRIBUTING, CORE_SCOPE, REVIEW_PLAYBOOK. Splash page. These are what a stranger and a new agent read first. | half a day |
| 3 | Chrome strings in all five labs, with the verify selectors updated in the same commits. | half a day |
| 4 | Circuit Elements Lab lesson text: 540 strings, 14,931 words. The largest single body, and dark, so it can absorb a full pass. | 1.5 days |
| 5 | Power Lab lesson text: 166 strings. Already closest to the target. | half a day |
| 6 | Signal Lab: 358 strings, and the highest dash density in the suite. Released, so `npm run verify` gates it. | 1 day |
| 7 | Circuit Lab and Control Lab: 294 strings between them. Released, same gate. | 1 day |
| 8 | Plan documents: headings first, then the prose of `CIRCUIT_ELEMENTS_LAB_PLAN.md` §§0–11 and `POWER_LAB_PLAN.md` §11, and the two review files. | 1 day |
| 9 | Re-run `lint:prose` to zero, re-read every lab's first screen at 1366×768 and 390×844, and re-score the wording rows of the cold-walk rubric. | half a day |

Six and a half days. Phases 2 and 3 alone remove the habits a stranger meets.

## 8. Couplings the rewrite must respect

- **53 exact-name selectors** across the five `verify.mjs` scripts match controls
  by their visible label. Any control rename ships with its selector.
- **27 unit assertions** match on-screen text literally, mostly labels
  (`App.smoke.test.jsx`, `Controls.test.jsx`, `review.test.jsx`). Each is listed
  against its string in `ui-strings.md` where affected.
- **`apps/signal-lab/src/readme-claims.test.js`** pins three count strings and
  two hand-over links in README, and three count strings in the splash page. The
  drafts keep all of them character for character.
- **`apps/power-lab/src/notes.test.js`** already caps note length and sentence
  average. The rewrites stay inside those caps, which §5 then extends to the
  other four labs.
- **Elements lesson tests** require every number in `see`, `try` and `why` to be
  a value the solver produces. The rewrites introduce no new number.
- **Student sittings.** Circuit Elements Lab is dark and waiting on three student
  sittings (`apps/circuit-elements-lab/SITTINGS.md`). Do phase 4 before the
  sittings, or the students score wording that is about to change.

## 9. Decisions taken, all reversible

1. **Scope is user-facing text plus the documents that teach agents how to
   write.** Code comments are not rewritten wholesale. New and touched comments
   follow STYLE.md. The 945 existing blocks are left until their file is opened
   for other reasons.
2. **Commit messages** follow the same rules from the next commit. Git history is
   not rewritten.
3. **The README keeps one first-person sentence** about why the suite exists,
   plainly stated. The paragraph about what makes the subject worth loving goes.
4. **Plan documents keep their structure and their numbers.** Only headings and
   prose change, so the section references other documents make (§11.4.2 and the
   rest) stay valid.
5. **One factual correction** in the README: `waveform-simulator` is now "a
   fourth tool" rather than "a third". The table above it lists three.
