# What the Circuit Elements Lab needs from outside its own directory

The lab lives in `apps/circuit-elements-lab/`. It rests on `packages/network`,
`packages/ui`, `packages/explain` and `packages/prose`. Nothing below blocks
the dark launch. Each entry came out of a browser pass and belongs to a file
this lab does not own.

## 1. A prose budget for a plot caption

Owner: the director, in `packages/prose/src/style.js`.

`BUDGETS.caption` is 20 words at an average of 20 a sentence. That is the
budget for a chrome caption, a noun phrase naming a picture. This lab's plot
caption is a different object. It is the canvas read aloud. A screen reader
gets it instead of the picture, and so does a phone too narrow for the pinned
values. It carries a reading for every bright trace with its unit. The
sentence that lists them runs 24 to 31 words, and it cannot come under 20
without dropping a reading.

The lab holds its captions to every other rule of the house style. The measure
is the package's own `violations`. No semicolons (S5), no em dash over budget
(S3), no colon reveal (S4), no banned phrase, at most 50 words, and S2's hard
limit of 30 words in a sentence. The budget object is inline in
`src/captions.test.jsx` and named there.

What is needed is a `plotCaption` budget in `packages/prose`. Four other labs
draw data captions, and all five should measure the same thing from one place.
The director sets the average-sentence figure.

## 2. The prose lint does not see the words a canvas is described in

Owner: the director, in `packages/prose`.

`prose.test.js` measures a lesson's `name`, `see`, `why` and `try[].say`, and
the definitions in `terms.js`. STYLE.md says the standard applies to every
word a reader can see. Three kinds of visible string in this lab fall outside
it. The plot caption, held in this lab now (see 1). The bridge sentence under
each headline. The blurb at the head of each analysis pane.

A browser pass counted em dashes over budget in the bridges of the Equations
and Power panes. It counted semicolons in the Power and State equation blurbs.
No test sees either.

Two of the three are strings in this lab's `App.jsx`, and could be measured
here. This is a NEEDS entry instead because the same gap is in every app's
`prose.test.js`. It should be closed once, in the shape the director wants: a
shared helper that walks an app's chrome strings, or a named budget per kind
as in 1.

## 3. STYLE.md's replacement table is wider than banned.js

Owner: the director, in `packages/prose/src/banned.js`.

STYLE.md's table replaces "the source's decision / the resistor's". The
replacement it gives is "the source sets the voltage. The resistor sets the
current". `BANNED` catches the verb forms, such as `the source decides`, and
not the possessive. A1's note ends "The voltage is the source's decision. The
current is the resistor's." and the lint passes it. The regex wants a second
clause for the possessive. The sentence in this lab wants rewriting once that
clause exists.

Nothing else is outstanding. `.github/workflows/deploy.yml` already carries the
lab's `cp` line. The lab ships unlinked at `/circuit-elements-lab/` for review
while `RELEASE_STATUS` says `dark`.
