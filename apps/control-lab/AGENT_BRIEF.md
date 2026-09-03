# Control Lab — agent brief

You are one of three agents working this repo in parallel. **Your territory is
`apps/control-lab/` only.** Another agent owns `apps/circuit-lab/`. A third owns
`apps/signal-lab/` and the shared `packages/*`. Reed reviews everything.

## Boundaries — read first

- Edit only inside `apps/control-lab/`. Treat `packages/*` and the other two
  apps as **read-only**: read them for patterns as much as you like, change
  nothing. If you genuinely need a package change, write the need into
  `apps/control-lab/NEEDS.md`, commit it, and continue with what you can do —
  the packages agent will pick it up.
- **Run in your own clone, not the shared checkout.** If your working
  directory is `~/projects/ee-labs` itself, STOP and move:

  ```
  git clone ~/projects/ee-labs ~/projects/ee-labs-control-lab
  cd ~/projects/ee-labs-control-lab
  git remote set-url origin https://github.com/reedos/ee-labs.git
  git config user.name "Reed" && git config user.email "48570578+reedos@users.noreply.github.com"
  npm ci
  ```

  Three agents in one tree have already crossed streams once: a `git add -A`
  from one swept another's half-finished files into an unrelated commit.
  Also, `npm run build` builds ALL THREE apps' dist folders, in a shared
  tree that clobbers another agent's preview mid-harness.
- **Stage by path, never `git add -A` and never `commit -a`**, even in your
  own clone, the habit is the protection: `git add apps/control-lab`.
- Work directly on `master`. **`git pull --rebase` before every push.** Never
  rewrite pushed history. Commits already use the right author (repo-local
  config). Every push triggers CI and a live deploy to
  https://reedos.github.io/ee-labs/, so push only when everything below is
  green.

## The house discipline (non-negotiable)

**First: read `/CORE_SCOPE.md`.** It governs `@ee-labs/systems` and every bridge
between apps: exact rational transfer functions only in the core. A refused
bridge is a finished feature. No approximation without a tested guard. And
exact mappings are never hedged. If a task conflicts with it, stop and flag
rather than working around it.

Every explanatory sentence in a lesson note, hint, or math panel is a **claim
about physics, and a test must measure it**, never restate the formula that
produced it. Rules of thumb are stated as rules of thumb WITH their
preconditions (see how ζ ≈ PM/100 is handled). Where a claim is unmeasurable
at the current settings, footnote the reason. Never show ✗ against correct
physics. Predictions must follow the controls the user can reach. When one of
YOUR tests fails, first decide whether the app or the test is wrong, several
times it was the test, and saying so plainly in the commit matters.

Commit messages here are narrative: what changed, why, and what bugs fell out.
Read `git log` for the register.

## Verify before every push

```
npx vitest run                    # the WHOLE monorepo, from the repo root
npm run build                     # all three apps must build
npx vite preview --outDir apps/control-lab/dist --port 4400 --strictPort &
cd apps/control-lab && APP_URL=http://localhost:4400 node scripts/verify.mjs
```

The Playwright harness is the only thing that catches wiring bugs. Extend it
for everything you add. **Use port 4400**, other agents use other ports.

Gotchas that have burned us:
- Engineering-notation fields read a bare number in the displayed SI prefix:
  with "200 m" showing, typing 20 means 0.02. The harness's `absolute()`
  helper exists precisely for this, use it for every setField.
- The overshoot readout only exists when the closed loop IS second order
  (plant+P yes, plant+PID no, order three). Read the phase margin instead
  for cascaded claims. A harness once assumed otherwise and was wrong.
- If your shell mangles backslashes/newlines in heredocs, write files with
  your editor tools, never via `cat <<EOF`, this corrupted TeX repeatedly.
- No formatters/linters. Match surrounding style. Comments are explanatory.
- Layout hard rule: at 16:9 the page never scrolls and both plots stay fully
  visible, checked at 1080p and 4K in the harness. Keep it green.

## The review playbook

Before the worklist, read `REVIEW_PLAYBOOK.md` at the repo root: eleven
classes of defect Reed personally caught in Signal Lab, generalized into an
audit checklist. Your adversarial-audit item below MEANS working through that
checklist against your app. Items 1–6 (sentences frozen while controls move;
lead with the base rule. Phase beside magnitude. Axes named/united/adaptive;
can the feature be SEEN; rendering honesty) apply to you verbatim.

## Worklist, in order

1. **Fold the lesson list.** "Try this" is a button wall. Collapse it to group
   headers exactly like Signal Lab's preset groups (pattern:
   `details.preset-group` in `apps/signal-lab/src/components/Controls.jsx` +
   styles. The active lesson's group must be impossible to fold away). Update
   the harness, folded buttons aren't clickable, so lesson clicks must unfold
   first (see signal-lab's `loadPreset`).

2. **The loop as a diagram.** Build the classic feedback block diagram as an
   on-demand overlay, modeled on
   `apps/signal-lab/src/components/FlowDiagram.jsx` (SVG, backdrop, Escape
   closes, boxes clickable to reveal sidebar cards): r → ⊕(+/−) → C(s) → ⊕
   (disturbance d enters HERE, at the plant input) → P(s) → y, with the
   feedback wire from y back to the first junction carrying the minus sign.
   Show C and P with their current parameter summaries. This picture is the
   subject's central diagram and the app doesn't draw it yet. Wire the
   disturbance entry point to the existing Reference/Disturbance step toggle
   so the diagram explains what that toggle injects and where.

3. **Phase language audit.** Wherever margins or controller hints discuss
   gain, make the phase story explicit and led-by-the-rule: each pole costs up
   to 90° of lag (45° at its corner), an integrator is a flat −90°, derivative
   and lead ADD phase. Prove every printed number with a test via
   `bode()`/`margins()` before printing it.

4. **Adversarial audit of all lessons.** Load each lesson in the browser,
   drag the gains it points at, and check every sentence of every note against
   the screen. Fix what's wrong. Each fix gets a test that would have caught
   it.

5. **(Stretch) Sensitivity.** S = 1/(1+L) and T = L/(1+L) with S + T = 1 —
   a math-panel treatment (or a plot if it fits the layout budget) of why the
   loop cannot reject disturbances and follow references arbitrarily well at
   the same frequency. `errorLoop`/`closeLoop` in `@ee-labs/systems` already
   compute both. Claims measured, as always.

Do not start item 5 unless 1–4 are green and pushed.
