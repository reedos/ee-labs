# Circuit Lab — agent brief

You are one of three agents working this repo in parallel. **Your territory is
`apps/circuit-lab/` only.** Another agent owns `apps/control-lab/`; a third owns
`apps/signal-lab/` and the shared `packages/*`. Reed reviews everything.

## Boundaries — read first

- Edit only inside `apps/circuit-lab/`. Treat `packages/*` and the other two
  apps as **read-only**: read them for patterns as much as you like, change
  nothing. If you genuinely need a package change, write the need into
  `apps/circuit-lab/NEEDS.md`, commit it, and continue with what you can do —
  the packages agent will pick it up.
- Work directly on `master`. **`git pull --rebase` before every push.** Never
  rewrite pushed history. Commits already use the right author (repo-local
  config). Every push triggers CI and a live deploy to
  https://reedos.github.io/ee-labs/ — so push only when everything below is
  green.

## The house discipline (non-negotiable)

Every explanatory sentence in a lesson note, hint, or math panel is a **claim
about physics, and a test must measure it** — never restate the formula that
produced it. Where a claim is unmeasurable at the current settings, the row
footnotes the reason; it never shows ✗ against correct physics. Predictions
must **follow the controls the user can reach**: if a select or slider changes
the fact, the sentence and the check change with it. Nine confidently wrong
explanations have been caught by this discipline so far. When one of YOUR tests
fails, first decide whether the app or the test is wrong — several times it was
the test, and saying so plainly in the commit matters.

Commit messages here are narrative: what changed, why, and what bugs fell out.
Read `git log` for the register.

## Verify before every push

```
npx vitest run                    # the WHOLE monorepo, from the repo root
npm run build                     # all three apps must build
npx vite preview --outDir apps/circuit-lab/dist --port 4300 --strictPort &
cd apps/circuit-lab && APP_URL=http://localhost:4300 node scripts/verify.mjs
```

The Playwright harness is the only thing that catches wiring bugs. Extend it
for everything you add. **Use port 4300** — other agents use other ports.

Gotchas that have burned us:
- Engineering-notation fields read a bare number in the displayed SI prefix:
  with "1 kΩ" showing, typing 1000 means 1 MΩ. Harness code must type explicit
  prefixes ("4.7k", "100n").
- If your shell mangles backslashes/newlines in heredocs, write files with your
  editor tools, never via `cat <<EOF` — this corrupted TeX strings repeatedly.
  A test (`no formula contains a macro name that lost its backslash` in
  signal-lab) shows the guard pattern; add the same guard here if you write TeX.
- No formatters/linters exist. Match surrounding style. Comment density is high
  and explanatory on purpose.
- Layout hard rule: at 16:9 the page never scrolls and both plots stay fully
  visible. The harness checks it at 1080p and 4K; keep those checks passing.

## Worklist, in order

1. **Fold the sidebar lists.** "Try this" and "Circuits" are long button walls;
   collapse them to group headers exactly like Signal Lab's preset groups
   (pattern: `details.preset-group` in
   `apps/signal-lab/src/components/Controls.jsx` + its styles; the active
   item's group must be impossible to fold away). Update the harness the same
   way signal-lab's was — folded buttons aren't clickable, so its `pick()`
   must unfold first.

2. **Phase, wherever magnitude is discussed.** Circuit hints and panels talk
   slope but rarely phase. Add it with the same lead-with-the-rule shape Reed
   asked for in Signal Lab: "a 1st-order corner costs 45° at the corner and
   90° beyond; this circuit is order N so …". The −45°-per-order-at-corner
   figure is exact — prove it with tests via `bode()`/`phaseAt` from
   `@ee-labs/systems` before printing it anywhere.

3. **Slope wording audit.** Find every dB/octave claim; make each lead with
   the 1st-order rule (6 dB/octave = 20 dB/decade), then multiply by the
   circuit's actual order, and state BOTH units.

4. **Adversarial audit of all lessons.** Load every lesson in the browser the
   way Reed does: change the components it points at, check every sentence of
   every note against what the screen then shows. File and fix anything wrong;
   each fix gets a test that would have caught it.

5. **(Stretch) One new circuit** done completely: twin-T notch or an RC
   band-pass (two corners). Complete = schematic drawn, H(s) derived in the
   panel with the derivation note, metrics, tests for the pole/zero positions,
   a lesson, harness coverage, and hand-over behaviour decided honestly
   (decline if Signal Lab / Control Lab cannot express it exactly).

Do not start item 5 unless 1–4 are green and pushed.
