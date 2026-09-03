# Reporting something

**If you are looking at the thing right now, use the "Something wrong or
unclear?" link in the lab's sidebar.** It opens an issue with your exact setup
already filled in: sources, blocks, rate, frame, and the rest. You then only have
to write what you noticed. That attached setup is usually what decides whether a
report can be chased down, and it is tedious to reconstruct by hand.

There are deliberately no issue templates in this repository. GitHub shows a
"choose a template" screen whenever a repository has any, and that screen discards
the setup the sidebar link had already filled in.

## Three kinds of report

**Something looks wrong.** A number, a plot, or a sentence that appears to be
incorrect. Say what you expected instead and why: a worked number, a textbook
result, or "the curve should not have a corner there". A hunch is worth sending.
Several real defects here were found by someone reporting that a picture looked
wrong before anyone could say why.

**Something was confusing.** A control that did not do what its label implied, an
axis that was easy to misread, or a note that assumed a step. "I expected 3 to
give me the 3rd harmonic" is a complete and useful report.

**Something needed an explanation it did not get.** The explanation is the
product here. A plot nobody can follow has failed at its job, however exact its
arithmetic. "Why does the ripple appear when I lower the rate?" is the right
thing to send.

The second and third kinds are the more useful in practice. The physics in this
suite is checked by tests. The naming, the layout and the prose are not checked
that way and largely cannot be, so reports are the only signal there is.

## If you are not in front of it

Open an issue anyway and say what you remember: which lab, which experiment, what
you expected, and what you got. An imprecise report is better than a missing one.

## Changing the code

One rule governs the content: **every explanatory sentence is a claim about
physics, and a test must measure it.** A note that quotes a frequency is pinned
by a test that fails when the number drifts. If you add an explanation, add the
measurement that would catch it going wrong. Do not restate the formula that
produced a number as though it were independent evidence of that number.

A second rule governs the words: **on-screen text and documentation follow
[STYLE.md](STYLE.md)**, and `npm run lint:prose` checks them. One claim per
sentence, no dash used for emphasis, no personification of components or
solvers, and labels that name what they label.

```
npm install
npm test        # the whole suite
npm run dev     # Signal Lab, or run one workspace directly
npm run build
```

Tests gate the deploy, so a red suite blocks a release rather than shipping a
broken lesson.
