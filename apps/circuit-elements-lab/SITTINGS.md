# Student sittings

The last half point of the lab's 9.5 is not the lab's to award itself. Three
people new to circuits sit with three experiments each, on Reed's phone and on
a laptop, and three numbers come out of every sitting. Those numbers are the
last checks of the rubric (`CIRCUIT_ELEMENTS_LAB_PLAN.md`, Step 9). Whatever
a student stumbles on becomes a fix with a test, and that sitting is repeated
once.

Status: no sittings yet — the 9.5 is not claimed for any group.

The status line above is computed — `src/sittings.js statusLine()` from
`sittings.json` — and `src/sittings.test.js` fails when this file says
anything else. The document cannot get ahead of the record.

## The script

Read as written, nothing added. The student has never seen the lab.

1. Open it. Do not explain anything.
2. Do what the lesson says. Say nothing until they ask.
3. Ask: tell me in one sentence what it showed you.
4. Ask: from 1 to 5, how clear was it?

Start the clock when the experiment is on screen; stop it at their first
act — a knob moved, the cursor dragged (F3's first step), the meters
switched. Write their sentence down word for word before deciding whether it
matches.

## The seats

Each person sits three experiments: a first look, a method, a dynamic. Nine
sittings in all; at least three on the phone.

| Seat | 1st          | 2nd                    | 3rd                   |
| ---- | ------------ | ---------------------- | --------------------- |
| 1    | A1 (`a1`)    | C2 parallel (`c2`)     | F3 time constant (`f3`) |
| 2    | A1 (`a1`)    | D5 Thévenin (`d5`)     | G4 ringing (`g4`)     |
| 3    | A1 (`a1`)    | C2 parallel (`c2`)     | G4 ringing (`g4`)     |

## What counts

- **First knob ≤ 10 s**, in every sitting. Over on any sitting blocks the 9.5
  for that experiment's group.
- **Recall matches `see`** for at least 8 of the 9. Their one sentence matches
  when it states the claim the experiment's `see` sentence (the note at the
  top of the lesson) makes — in their words, not the lab's. "The source stays
  at 12 no matter what the resistor does" matches A1; "you turn the knob and
  the number changes" does not. One miss is allowed; a second blocks the group
  it happened in.
- **Clarity ≥ 4.5** as the mean of the 1–5 ratings, per experiment. Under it
  blocks that experiment's group.

Below target anywhere: fix what they stumbled on, add the test that would
have caught it, and repeat that one sitting with a new person.

## Recording a sitting

Append one object to the `sittings` list in `sittings.json`:

```json
{
  "who": "P1",
  "date": "2026-09-06",
  "device": "phone",
  "experiment": "a1",
  "firstKnobSeconds": 6,
  "recall": "The battery stays at 12 whatever you do to the resistor; the current is what changes.",
  "recallMatches": true,
  "clarity": 5,
  "stumbled": "Looked for the knob under the drawing before finding it in the sidebar."
}
```

`who` is a label, never a name. `device` is `phone` or `laptop`. `stumbled`
is optional and is the most useful field: it is the list of the next fixes.
Then run the tests — they check every field, that the experiment is in the
course, and that the status line above matches the record — and update the
status line to what the test prints.
