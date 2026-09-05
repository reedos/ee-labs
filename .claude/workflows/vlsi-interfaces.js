export const meta = {
  name: 'vlsi-interfaces',
  description: 'Build the VLSI Lab and the Interfaces Lab, each in two Opus sittings on its own branch, each adversarially reviewed',
  phases: [
    { title: 'Build', detail: 'the transistor-level half first, then the half on the events package' },
    { title: 'Review', detail: 'an Opus reviewer per lab, fixing what it finds and committing' },
  ],
}

const RULES = `HOUSE RULES (binding). Reed owns the repo. Read PROGRAM.md, CORE_SCOPE.md, STYLE.md, REVIEW_PLAYBOOK.md before touching a file. Commit by path only (never git add -A, never commit -a). NEVER push. No model names in files. Narrative commit messages in the register of git log. Run tests in the FOREGROUND with the Bash tool's timeout parameter at 600000 ms and pipe through tail -30; never background a run or wait on a monitor. Run SCOPED tests only (the app and package you touch), never the whole suite, and always pass --maxWorkers=4 to vitest because up to a dozen agents share this machine. Every explanatory sentence is a claim about physics with a test that measures it; every number pinned as a function of the knobs, never typed as a constant; prose passes node packages/prose/bin/lint.mjs on every .md you touch. Never edit a shared surface (site/, README.md, packages/ui/src/LabNav.jsx, .github/workflows/deploy.yml, CURRICULUM.md, packages/ui/src/progression.test.js, PROGRAM.md): write what they need into the lab's NEEDS.md. Commit early and after every group, so nothing is lost if you are cut off.`

const SETUP = (branch, from) => `SETUP: you are in your own git worktree created from master, which is behind. First run: (git checkout -b ${branch} ${from} 2>/dev/null || git checkout ${branch}) && npm ci --no-audit --no-fund. Work only in this worktree. If the branch already existed it carries an earlier sitting's partial work, cut off part way: read git log ${from}..${branch} --stat and every file it added before you continue, and finish that work rather than restart it.`
const SETUP2 = (branch) => `SETUP: you are in your own git worktree created from master, which is behind. First run: git checkout --ignore-other-worktrees ${branch} && (npm ci --no-audit --no-fund || npm install --no-audit --no-fund). Work only in this worktree.`

const DARK = 'The app ships dark: RELEASE_STATUS reads dark, and release.test.js asserts that site/index.html, README.md and packages/ui/src/LabNav.jsx do not mention the lab, and says nothing about deploy.yml (the director adds the cp line you write into NEEDS.md).'

const NETWORK = 'packages/network is owned by the Electronics overseer: add NEW files there only where the plan says the engine lives there, never change an existing file, and prefer a module inside your app or a new package when the plan allows it. packages/events is the Logic Lab\'s: use it, do not change it; a missing property goes into NEEDS.md.'

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
    mergeable: { type: 'boolean', description: 'true only if the lab is green, pinned, lint-clean and faithful to the plan after fixes' },
  },
  required: ['branch', 'issuesFound', 'issuesFixed', 'issuesOpen', 'fixCommits', 'testSummary', 'mergeable'],
}

const INTEGRATION = 'claude/advanced-analog-labs-5eh3qd'
const OPTS = (label, phaseName, schema) => ({ label, phase: phaseName, model: 'opus', effort: 'high', isolation: 'worktree', agentType: 'general-purpose', schema })

const LABS = [
  {
    key: 'vlsi', slug: 'vlsi-lab', name: 'VLSI Lab', plan: 'VLSI_LAB_PLAN.md',
    read: 'apps/logic-lab in full (the shape to copy, and the gates and timing this lab bridges to), packages/events/index.js and src, packages/network/src (the MOSFET model, the companion Newton, the transient the plan names), apps/electronics-lab/src/groups/a.js and c.js (the idiom of an experiment record over network), packages/ui/src/TimingCanvas.jsx and StateCanvas.jsx (promoted canvases with their props), and packages/ui/src/Schematic.jsx\'s Transistor component',
    first: 'the transistor-level half, Phases 1 and 2: the bridge without events (extractGate against the transient, Group A, 5, from Electronics D6), then the library and its efforts (the six gates, the quasi-static sweep, Group B, 4, and Group C, 5)',
    second: 'Phases 3 to 6: wires (elmore, wireOf, the wire view, Group D, 4), power (the power view, the short-circuit integral, the leakage model, Group E, 5), the clock on events (Group F, 3), and memory (the butterfly view, the SRAM and DRAM cells, Group G, 4)',
    firstGroups: 'A, B and C', secondGroups: 'D, E, F and G', allGroups: 'A to G',
    tests: 'npx vitest run apps/vlsi-lab --maxWorkers=4', build: 'npm run build --workspace apps/vlsi-lab',
  },
  {
    key: 'interfaces', slug: 'interfaces-lab', name: 'Interfaces Lab', plan: 'INTERFACES_LAB_PLAN.md',
    read: 'apps/logic-lab in full (the shape to copy, and the frames and timing this lab bridges to), packages/events/index.js and src, packages/network/src (the pin\'s drivers and the RC the plan names), apps/computer-lab/src (the second claimant of the timing canvas), packages/ui/src/TimingCanvas.jsx (promoted, with its props), apps/electronics-lab/src/groups/a.js (the idiom of an experiment record over network), and apps/comms-lab/src for the eye and the sampler idiom the analog side reuses',
    first: 'Phases 1 and 2: the pin without events (pinDrive, the pin view, the scope, Group A, 5, from Electronics D5 and D6), then the analog side (the ripple expression, the cascade, the sampler\'s budget, Group F, 5)',
    second: 'Phases 3 to 6: the frame on events (Group B, 4), the two-wire bus (the multi-driver net, the pull-up window view, Group C, 5), the other two buses (the trace-delay model, the differential receiver, Groups D, 3, and E, 4), and time and the switch (the timer, the jitter model, the bounce pattern, Group G, 4)',
    firstGroups: 'A and F', secondGroups: 'B, C, D, E and G', allGroups: 'A to G',
    tests: 'npx vitest run apps/interfaces-lab --maxWorkers=4', build: 'npm run build --workspace apps/interfaces-lab',
  },
]

phase('Build')
const results = await pipeline(
  LABS,
  (lab) => agent(`You are the OVERSEER and builder of the ${lab.name}, first sitting: ${lab.first}.
${SETUP('lab/' + lab.slug, INTEGRATION)}
${RULES}
${NETWORK}
READ FIRST, in full: ${lab.plan} (its decisions are made, do not reopen them), PROGRAM.md section 3 and section 4, EE_LABS_MAP.md section 2 Track D, then ${lab.read}, then packages/ui and packages/explain as apps/electronics-lab/AGENT_BRIEF.md's tables list them, and that brief as the shape of yours.
DELIVER, in this order, committing by path after each: (1) apps/${lab.slug}/AGENT_BRIEF.md in the electronics brief's shape (lanes with file ownership, contracts as code with the failing test named beside each, the library fixtures with fixed names, the lesson schema and quantity paths, the pins per group, the gate), every number computed first by apps/${lab.slug}/scripts/pins.mjs; (2) the engine the plan's first phases name, where the plan says it lives, with tests and fuzzed invariants; (3) the app with the suite's shell and the views those phases name. ${DARK} (4) Groups ${lab.firstGroups} with see, try and why in the three registers, terms on contact, every quoted number resolving through experiments.test.js's reads paths and pinned as a function of the knobs; (5) a report appended to BACKLOG.md under "${lab.name}" and apps/${lab.slug}/NEEDS.md (the deploy cp line, the progression ids and counts, anything needed from the Logic, Electronics or Computer labs).
Groups ${lab.secondGroups} are the second sitting's; no lesson references them. Nothing in a lesson references an experiment that does not exist in your tree.
VERIFY: ${lab.tests} green (add the package you touched to the command); ${lab.build} succeeds; the prose lint clean on every .md you touched. Return the structured result; ok=true only if all of that holds.`,
    OPTS(lab.key + ':1', 'Build', RESULT)),
  (r1, lab) => {
    if (!r1) { log(`${lab.name} first sitting: no result`); return null }
    log(`${lab.name} first sitting: ok=${r1.ok}; ${r1.built}`)
    return agent(`You are the OVERSEER and builder of the ${lab.name}, second sitting: ${lab.second}. The first sitting reported: ${JSON.stringify(r1)}.
${SETUP2(r1.branch)}
${RULES}
${NETWORK}
READ FIRST: ${lab.plan} in full, apps/${lab.slug}/AGENT_BRIEF.md and NEEDS.md, the app and engine as they stand (git log --stat -15, then every file the first sitting added), packages/events/index.js and src (the clock, the frame, the events your groups run on), and ${lab.read}.
DELIVER, committing by path after each: the engine the plan's later phases name, with tests and fuzzed invariants; the views those phases name; Groups ${lab.secondGroups} with see, try and why, terms on contact, every number computed by scripts/pins.mjs first and pinned as a function of the knobs; the brief's pins section, NEEDS.md and the BACKLOG.md "${lab.name}" report updated with counts. Fix anything the first sitting left wrong that you find on the way, and say so. ${DARK}
VERIFY: ${lab.tests} green (add the package you touched); ${lab.build} succeeds; the prose lint clean on every .md you touched. Return the structured result.`,
      OPTS(lab.key + ':2', 'Build', RESULT))
  },
  (r2, lab) => {
    if (!r2) { log(`${lab.name} second sitting: no result`); return null }
    log(`${lab.name} second sitting: ok=${r2.ok}; ${r2.built}`)
    return agent(`You are an adversarial REVIEWER in the EE Labs program, checking the ${lab.name}, Groups ${lab.allGroups}, on branch ${r2.branch}. Default to finding fault.
SETUP: you are in your own git worktree created from master. First run: git checkout --ignore-other-worktrees ${r2.branch} && (npm ci --no-audit --no-fund || npm install --no-audit --no-fund). You may commit fixes by path on this branch. NEVER push.
${RULES}
The builder reported: ${JSON.stringify(r2)}.
READ: ${lab.plan} in full, apps/${lab.slug}/AGENT_BRIEF.md, CORE_SCOPE.md, STYLE.md, REVIEW_PLAYBOOK.md, PROGRAM.md section 3 and section 4, and every file the branch added or changed (git diff ${INTEGRATION}...${r2.branch} --stat, then read them).
CHECK, and fix what you find: (1) every number a lesson quotes is produced by the engine through a reads pair or claim and pinned as a function of the knobs, not typed as a constant (perturb a default in a scratch test and confirm the pin moves); (2) every experiment of the plan's groups exists with the plan's claim, or the deviation is justified by the engine and recorded; (3) CORE_SCOPE: nothing approximate presented as exact, every guard has a threshold and a test, every refusal a tested message, the engine's invariants fuzzed across the knob space rather than sampled at one point; (4) STYLE: see/try/why within budget, no personification, the prose tests green and the lint clean on every .md; (5) REVIEW_PLAYBOOK classes 1 to 10: sentences follow controls, phase beside magnitude, axes named and united, the feature visible at the defaults; (6) the app builds, RELEASE_STATUS is dark, the release test asserts only the three shared surfaces, the suite's shell and the promoted canvases are reused rather than copied; (7) no edit to a shared surface, none to an existing file of packages/network or packages/events, and no lesson references an experiment that does not exist; (8) the brief's contracts match the code and each names its failing test. Run ${lab.tests} (with the packages the builder touched) and ${lab.build}. Commit fixes by path with narrative messages. Return the structured verdict; mergeable=true only if green, pinned, lint-clean and faithful after your fixes.`,
      OPTS('review:' + lab.key, 'Review', VERDICT))
  },
)

const verdicts = results.filter(Boolean)
log(`${verdicts.filter(v => v.mergeable).length} of ${LABS.length} labs mergeable`)
return { verdicts }
