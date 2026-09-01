# Reporting something

**If you are looking at the thing right now, use the "Something wrong or unclear?" link in the lab's sidebar.** It opens an issue with your exact setup already filled in — sources, blocks, rate, frame, the lot — so you only write what you noticed. That attached setup is what decides whether something can be chased down, and it is tedious to reconstruct by hand.

There are deliberately no issue templates here, and that is not an oversight. GitHub shows a "choose a template" screen whenever a repository has any, and that screen throws away the setup the sidebar link had already filled in for you — so the templates cost more than they were worth.

## Three kinds of report, all of them welcome

**Something looks wrong.** A number, a plot, or a sentence that appears to be incorrect. Say what you expected instead and why — a worked number, a textbook result, or just "the curve should not have a corner there". A hunch is worth sending: several real defects here were found by someone saying a picture felt off before anyone could say why.

**Something was confusing.** A control that did not do what its label implied, an axis you misread, a note that assumed a step. "I expected 3 to give me the 3rd harmonic" is a complete and useful report.

**Something needed an explanation it did not get.** This is not a lesser category. The whole product here is the explanation — a plot nobody can follow has failed at the job it exists to do, however exact its arithmetic. "Why does the ripple appear when I lower the rate?" is exactly the right thing to send.

The second and third are, in practice, the higher-yield reports. The physics in this suite is checked exhaustively by tests; the naming, the layout and the prose have no such harness and cannot easily have one. You are it.

## If you are not in front of it

Open an issue anyway and say what you can remember: which lab, which experiment, what you expected, what you got. An imprecise report is far better than a missing one.

## Changing the code

Everything here runs on one rule: **every explanatory sentence is a claim about physics, and a test must measure it.** A note that quotes a frequency is pinned by a test that fails when the number drifts. If you add an explanation, add the measurement that would catch it going wrong — and never restate the formula that produced the number as though it were independent evidence.

```
npm install
npm test        # the whole suite
npm run dev     # Signal Lab, or run one workspace directly
npm run build
```

Tests gate the deploy, so a red suite is a blocked release rather than a broken lesson on the live site.
