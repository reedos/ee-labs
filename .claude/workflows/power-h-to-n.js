export const meta = {
  name: 'power-h-to-n',
  description: 'Build Power Lab Groups H to N in three Opus lanes on packages/switched and apps/power-lab, each adversarially reviewed',
  phases: [
    { title: 'Lanes', detail: 'H+I, J+K, L+M+N, each on its own branch' },
    { title: 'Review', detail: 'an Opus reviewer per lane, fixing what it finds and committing' },
  ],
}

const RULES = `HOUSE RULES (binding). Reed owns the repo. Read PROGRAM.md, CORE_SCOPE.md, STYLE.md, REVIEW_PLAYBOOK.md before touching a file. Commit by path only (never git add -A, never commit -a). NEVER push. No model names in files. Narrative commit messages in the register of git log. Run tests in the FOREGROUND with the Bash tool's timeout parameter at 600000 ms and pipe through tail -30; never background a run or wait on a monitor. Run SCOPED tests only (the app and package you touch), never the whole suite, and always pass --maxWorkers=4 to vitest because up to a dozen agents share this machine. Every explanatory sentence is a claim about physics with a test that measures it; every number pinned as a function of the knobs, never typed as a constant; prose passes node packages/prose/bin/lint.mjs on every .md you touch. Never edit a shared surface (site/, README.md, packages/ui/src/LabNav.jsx, .github/workflows/deploy.yml, CURRICULUM.md, packages/ui/src/progression.test.js): write what they need into the lab's NEEDS.md. Commit early and after every group, so nothing is lost if you are cut off.`

const SETUP = (branch, from) => `SETUP: you are in your own git worktree created from master, which is behind. First run: (git checkout -b ${branch} ${from} 2>/dev/null || git checkout ${branch}) && npm ci --no-audit --no-fund. Work only in this worktree. If the branch already existed it carries an earlier sitting's partial work, cut off part way: read git log ${from}..${branch} --stat and every file it added before you continue, and finish that work rather than restart it.`

const RESULT = {
  type: 'object',
  properties: {
    branch: { type: 'string' },
    commits: { type: 'array', items: { type: 'string' } },
    built: { type: 'string', description: 'what was built, with counts' },
    testSummary: { type: 'string', description: 'the vitest summary lines, verbatim' },
    lintClean: { type: 'boolean' },
    deferred: { type: 'array', items: { type: 'string' } },
    needs: { type: 'array', items: { type: 'string' } },
    ok: { type: 'boolean', description: 'true only if every scoped test passed and everything asked for is committed' },
  },
  required: ['branch', 'commits', 'built', 'testSummary', 'lintClean', 'deferred', 'needs', 'ok'],
}

const VERDICT = {
  type: 'object',
  properties: {
    branch: { type: 'string' },
    issuesFound: { type: 'array', items: { type: 'string' } },
    issuesFixed: { type: 'array', items: { type: 'string' } },
    issuesOpen: { type: 'array', items: { type: 'string' } },
    fixCommits: { type: 'array', items: { type: 'string' } },
    testSummary: { type: 'string' },
    mergeable: { type: 'boolean', description: 'true only if the lane is green, pinned, lint-clean and faithful to the plan after fixes' },
  },
  required: ['branch', 'issuesFound', 'issuesFixed', 'issuesOpen', 'fixCommits', 'testSummary', 'mergeable'],
}

const INTEGRATION = 'claude/advanced-analog-labs-5eh3qd'

const LANES = [
  { key: 'hi', KEY: 'HI', groups: 'H and I', names: 'H, closing the loop (3 experiments), and I, three-phase out (3 experiments)', engine: 'a loop module for H that closes the Control Lab bridge of section 1.5 around the averaged converter and checks it against the exact engine, and a three-phase inverter module for I built on clocked.js and inverter.js, three legs of F\'s PWM', modules: 'loop.js and threePhase.js (or the names section 1 and section 2 give them)', extra: '' },
  { key: 'jk', KEY: 'JK', groups: 'J and K', names: 'J, isolated DC-DC, the half-bridge\'s siblings (3 experiments), and K, resonant conversion (3 experiments)', engine: 'the forward, push-pull and full-bridge converters as converter-shaped state machines beside isolated.js\'s flyback and half-bridge, and the resonant converters as LTI tanks per segment with the output rectifier\'s diode events from rectifier.js', modules: 'isolated.js (you may extend it; no other lane touches it) and resonant.js', extra: ' D5, the leakage spike, stays deferred unless the clamp state J\'s forward converter needs makes it fall out for free; if you build it, register it in the D block with one line and say so.' },
  { key: 'lmn', KEY: 'LMN', groups: 'L, M and N', names: 'L, motor drives (3 experiments), M, EMI (3 experiments), and N, thermal (3 experiments)', engine: 'a drive module for L with a slow mechanical state stepped between switching periods, reusing @ee-labs/machines for the machine (dcOf, imOf, pmsmOf, MECH, integrate) rather than rewriting it; an EMI module for M using @ee-labs/dsp\'s FFT and the Circuit Lab\'s filter forms for the spectrum, the filter and the mask; a thermal module for N, RC networks with degrees Celsius on them, solved with the propagator', modules: 'drive.js, emi.js and thermal.js', extra: '' },
]

phase('Lanes')
const results = await pipeline(
  LANES,
  (lane) => agent(`You are the OVERSEER and builder of one lane of the Power Lab: Groups ${lane.groups}, ${lane.names}. The lab carries Groups A to G (34 experiments, dark); you add yours in the same bar.
${SETUP('lab/power-' + lane.key, INTEGRATION)}
${RULES}
READ FIRST, in full: POWER_LAB_PLAN.md section 1 to section 3 (engine, models, app), section 4 for your groups, section 5 to section 8 (hand-overs, testing, integration, phasing) and section 11 (the bar every group built after 2026-09-02 inherits; it is binding). apps/power-lab/AGENT_BRIEF_DFG.md in full: it is the shape of the brief you write and the idiom of contracts as code with the failing test named beside each. apps/power-lab/NEEDS.md. apps/power-lab/src in full: experiments.js, analysis.js, math.js, terms.js, marks.js, report.js, App.jsx, components/, and every test (experiments, pins, path, notes, knobs, sweeps, review, transient, prose, styles, release) so you know what the walking tests demand of a new experiment. apps/power-lab/scripts/pins-dfg.mjs and verify.mjs. packages/switched in full (index.js and src/). For Group L also packages/machines/index.js; for M also packages/dsp/index.js; for N also packages/network's RC forms.
YOUR LANE: ${lane.names}. The engine work is ${lane.engine}, in ${lane.modules} under packages/switched/src, each with its own test file and its invariants fuzzed as section 1.7 and section 6 demand, exported by one line each in packages/switched/index.js. Existing signatures stand. Three lanes work at once: hi owns loop.js and threePhase.js, jk owns isolated.js and resonant.js, lmn owns drive.js, emi.js and thermal.js. Do not edit steady.js, propagator.js, events.js, clocked.js, inverter.js, magnetics.js, saturating.js, ledger.js, rectifier.js, transient.js, formulas.js or topologies.js except to add a row to a table keyed by name, one row per line, appended at the end.${lane.extra}
DELIVER, in this order, committing by path after each: (1) apps/power-lab/AGENT_BRIEF_${lane.KEY}.md, the brief in the DFG shape, with apps/power-lab/scripts/pins-${lane.key}.mjs computing every number the brief and the notes quote before a word is written; (2) the engine modules, fuzzed green; (3) the experiments of your groups in a new file apps/power-lab/src/groups/${lane.key}.js (the experiment records, the group intros, and any traces, views, sweeps, math entries and terms your groups add, exported as named tables), registered in experiments.js, math.js, terms.js and analysis.js by ONE line per table, appended at the end of each table so the director can merge three lanes by union; (4) any view component only your groups need, in components/; (5) tests: a new apps/power-lab/src/${lane.key}.test.js pinning every claim and every note number as a function of the knobs (perturb a knob and the pin moves), the triple agreement section 6 asks for wherever each model claims validity, and whatever rows the walking tests (pins, path, notes, knobs, sweeps, review) need to cover your experiments; (6) a section appended to apps/power-lab/NEEDS.md and a report appended to BACKLOG.md under the heading "Power Lab, Groups ${lane.groups}" (what is built with counts, what is deferred and why, what was needed, and the section 8 phasing note for your groups, which the director moves into the plan).
Every lesson has see, try and why in the registers and budgets the existing groups use; terms are defined on contact; nothing references an experiment that does not exist in your tree; each new topology's drawing follows the existing drawings' idiom; the feature each note names is visible at the defaults; the scrub, the scope and the steady-state views work for your topologies as they do for the buck.
VERIFY before you report: npx vitest run apps/power-lab packages/switched --maxWorkers=4 green with Groups A to G untouched and still green; npm run build --workspace apps/power-lab succeeds; node packages/prose/bin/lint.mjs on the brief, NEEDS.md and BACKLOG.md is clean. Return the structured result with ok=true only if all of that holds; list every deviation from the plan's numbers with the engine's value and why.`,
    { label: 'lane:' + lane.key, phase: 'Lanes', model: 'opus', effort: 'high', isolation: 'worktree', agentType: 'general-purpose', schema: RESULT }),
  (built, lane) => {
    if (!built) { log(`lane ${lane.key}: no result`); return null }
    log(`lane ${lane.key}: ok=${built.ok}; ${built.built}`)
    return agent(`You are an adversarial REVIEWER in the EE Labs program, checking one lane of the Power Lab: Groups ${lane.groups}, on branch ${built.branch}. Default to finding fault.
SETUP: you are in your own git worktree created from master. First run: git checkout --ignore-other-worktrees ${built.branch} && npm ci --no-audit --no-fund. You may commit fixes by path on this branch. NEVER push.
${RULES}
The builder reported: ${JSON.stringify(built)}.
READ: POWER_LAB_PLAN.md section 1, section 2, section 4 for Groups ${lane.groups}, section 6 and section 11 in full, apps/power-lab/AGENT_BRIEF_DFG.md and the lane's own brief, CORE_SCOPE.md, STYLE.md, REVIEW_PLAYBOOK.md, and every file the lane added or changed (git diff ${INTEGRATION}...${built.branch} --stat, then read them).
CHECK, and fix what you find: (1) every number a note quotes is produced by the engine and pinned as a function of the knobs, not typed as a constant (perturb a default in a scratch test and confirm the pin moves); (2) every experiment of the plan's groups exists with the plan's claim, or the deviation is justified by the engine and recorded; (3) the engine modules are exact piecewise-LTI in the plan's sense, with events bisected on the exact solution, invariants fuzzed across the knob space including the hostile corners, and no generic ODE stepping where a propagator exists; (4) CORE_SCOPE: nothing approximate is presented as exact, every guard has a threshold and a test, every refusal has a tested message; (5) STYLE and section 11: the notes within budget, no personification, prose.test.js green, the feature visible at the defaults, axes named and united, the scrub and the scope in step; (6) the walking tests cover the new experiments rather than skipping them; (7) no edit outside the lane's ownership, none to a shared surface, and Groups A to G untouched. Run npx vitest run apps/power-lab packages/switched --maxWorkers=4 and npm run build --workspace apps/power-lab. Commit fixes by path with narrative messages. Return the structured verdict; mergeable=true only if green, pinned, lint-clean and faithful after your fixes.`,
      { label: 'review:' + lane.key, phase: 'Review', model: 'opus', effort: 'high', isolation: 'worktree', agentType: 'general-purpose', schema: VERDICT })
  },
)

const verdicts = results.filter(Boolean)
log(`${verdicts.filter(v => v.mergeable).length} of ${LANES.length} lanes mergeable`)
return { verdicts }