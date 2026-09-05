export const meta = {
  name: 'rf-system-photonics',
  description: 'Build the RF Lab (phases 1 to 3), the System Lab (phase 1) and the Photonics Lab (phases 1 to 3), each in Opus sittings and adversarially reviewed',
  phases: [
    { title: 'Build', detail: 'RF first sitting and Photonics first sitting, then RF second, System, Photonics second' },
    { title: 'Review', detail: 'an Opus reviewer per lab, fixing what it finds and committing' },
  ],
}

const RULES = `HOUSE RULES (binding). Reed owns the repo. Read PROGRAM.md, CORE_SCOPE.md, STYLE.md, REVIEW_PLAYBOOK.md before touching a file. Commit by path only (never git add -A, never commit -a). NEVER push. No model names in files. Narrative commit messages in the register of git log. Run tests in the FOREGROUND with the Bash tool's timeout parameter at 600000 ms and pipe through tail -30; never background a run or wait on a monitor. Run SCOPED tests only (the app and package you touch), never the whole suite, and always pass --maxWorkers=4 to vitest because up to a dozen agents share this machine. Every explanatory sentence is a claim about physics with a test that measures it; every number pinned as a function of the knobs, never typed as a constant; prose passes node packages/prose/bin/lint.mjs on every .md you touch. Never edit a shared surface (site/, README.md, packages/ui/src/LabNav.jsx, .github/workflows/deploy.yml, CURRICULUM.md, packages/ui/src/progression.test.js, PROGRAM.md): write what they need into the lab's NEEDS.md. Commit early and after every group, so nothing is lost if you are cut off.`

const SETUP = (branch, from) => `SETUP: you are in your own git worktree created from master, which is behind. First run: (git checkout -b ${branch} ${from} 2>/dev/null || git checkout ${branch}) && npm ci --no-audit --no-fund. Work only in this worktree. If the branch already existed it carries an earlier sitting's partial work, cut off part way: read git log ${from}..${branch} --stat and every file it added before you continue, and finish that work rather than restart it.`
const SETUP2 = (branch) => `SETUP: you are in your own git worktree created from master, which is behind. First run: git checkout ${branch} && (npm ci --no-audit --no-fund || npm install --no-audit --no-fund). Work only in this worktree.`

const DARK = 'The app ships dark: RELEASE_STATUS reads dark, and release.test.js asserts that site/index.html, README.md and packages/ui/src/LabNav.jsx do not mention the lab, and says nothing about deploy.yml (the director adds the cp line you write into NEEDS.md).'

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

const review = (what, branch, base, plan, brief, scope, tests, build, built) => agent(`You are an adversarial REVIEWER in the EE Labs program, checking ${what}, on branch ${branch}. Default to finding fault.
SETUP: you are in your own git worktree created from master. First run: git checkout ${branch} && (npm ci --no-audit --no-fund || npm install --no-audit --no-fund). You may commit fixes by path on this branch. NEVER push.
${RULES}
The builder reported: ${JSON.stringify(built)}.
READ: ${plan} in full, ${brief}, CORE_SCOPE.md, STYLE.md, REVIEW_PLAYBOOK.md, PROGRAM.md section 3 and section 4, and every file the branch added or changed (git diff ${base}...${branch} --stat, then read them). Your scope is ${scope}.
CHECK, and fix what you find: (1) every number a lesson quotes is produced by the engine through a reads pair or claim and pinned as a function of the knobs, not typed as a constant (perturb a default in a scratch test and confirm the pin moves); (2) every experiment of the plan's groups in scope exists with the plan's claim, or the deviation is justified by the engine and recorded; (3) CORE_SCOPE: nothing approximate presented as exact, every guard has a threshold and a test, every refusal a tested message, the engine's invariants fuzzed across the knob space rather than sampled at one point; (4) STYLE: see/try/why within budget, no personification, the prose tests green and the lint clean on every .md; (5) REVIEW_PLAYBOOK classes 1 to 10: sentences follow controls, phase beside magnitude, axes named and united, the feature visible at the defaults; (6) the app builds, RELEASE_STATUS is dark, the release test asserts only the three shared surfaces, and the suite's shell and controls are reused rather than copied; (7) no edit to a shared surface, and no lesson references an experiment that does not exist; (8) the brief's contracts match the code and each names its failing test. Run ${tests} and ${build}. Commit fixes by path with narrative messages. Return the structured verdict; mergeable=true only if green, pinned, lint-clean and faithful after your fixes.`,
  OPTS('review:' + what.split(' ')[0].toLowerCase(), 'Review', VERDICT))

phase('Build')

const rfChain = async () => {
  const r1 = await agent(`You are the OVERSEER and builder of the RF Lab, first sitting: the exact core, the chart, the shell, and Groups A and B.
${SETUP('lab/rf-lab', INTEGRATION)}
${RULES}
READ FIRST, in full: RF_LAB_PLAN.md (every section; its decisions are made, do not reopen them), PROGRAM.md section 3 (what a lab delivers, in order) and section 4 (reuse, adapt or build), EE_LABS_MAP.md section 2 Track A and Track E, CURRICULUM.md section 3 (seams). Then the shape you copy: apps/fields-lab in full (the most recent lab in the suite's shape: App.jsx, experiments, lessons, terms, the tests, release.test.js, RELEASE_STATUS, README.md, AGENT_BRIEF.md, NEEDS.md) and packages/fields/src/line.js and wave.js (the transmission line the plan's Group A leans on). Then packages/ui (Schematic.jsx, PoleZeroCanvas.jsx as the canvas idiom, plot.js, scale.js, format.js, units.js, NumField, LessonNav, deeplink.js) and packages/explain (MathPanel and its testing rules). apps/electronics-lab/AGENT_BRIEF.md is the brief's shape.
DELIVER, in this order, committing by path after each: (1) apps/rf-lab/AGENT_BRIEF.md in the electronics brief's shape: lanes with file ownership, the contracts as code with the failing test named beside each, the library fixtures with fixed names, the lesson schema and quantity paths, the pins per group, the gate; every number computed first by apps/rf-lab/scripts/pins.mjs. (2) packages/rf (name @ee-labs/rf, package.json in the shape of packages/fields), holding the plan's Phase 1 exact core, sparam.js, convert.js, cascade.js and smith.js, each with its test and the plan's invariants fuzzed; run npm install --no-audit --no-fund after creating it so the workspace links, and commit package-lock.json with it. (3) SmithCanvas.jsx in packages/ui, carrying from the start the props the plan names for the Fields and Instruments labs, with its test; record the promotion in NEEDS.md rather than editing PROGRAM.md. (4) The app: apps/rf-lab with the suite's shell, the chart view and the line view. ${DARK} (5) Groups A (5) and B (4) with see, try and why in the three registers, terms on contact, every quoted number resolving through experiments.test.js's reads paths and pinned as a function of the knobs. (6) A report appended to BACKLOG.md under "RF Lab" and apps/rf-lab/NEEDS.md (the deploy cp line, the progression ids and counts, the canvas promotion, what Groups E to H need from the Electronics Lab).
Nothing in a lesson references an experiment that does not exist in your tree. Groups C to H are later sittings'; leave their ids out of the lesson text.
VERIFY: npx vitest run apps/rf-lab packages/rf packages/ui --maxWorkers=4 green; npm run build --workspace apps/rf-lab succeeds; the prose lint is clean on every .md you touched. Return the structured result; ok=true only if all of that holds.`, OPTS('rf:1', 'Build', RESULT))
  if (!r1) { log('RF first sitting: no result'); return { rf1: null, rf: null, sys: null } }
  log(`RF first sitting: ok=${r1.ok}; ${r1.built}`)
  const [rf, sys] = await parallel([
    async () => {
      const r2 = await agent(`You are the OVERSEER and builder of the RF Lab, second sitting: matching and two-ports, Groups C and D. The first sitting reported: ${JSON.stringify(r1)}.
${SETUP2('lab/rf-lab')}
${RULES}
READ FIRST: RF_LAB_PLAN.md in full, apps/rf-lab/AGENT_BRIEF.md and NEEDS.md, the app and package as they stand (git log --stat -12, then every file under apps/rf-lab/src, apps/rf-lab/scripts and packages/rf/src), packages/ui/src/SmithCanvas.jsx and its test.
DELIVER, committing by path after each: (1) match.js in packages/rf, with its test and fuzzed invariants, as the plan's Phase 3 names it; (2) the S-parameter view and the equations pane in the app; (3) Groups C (5) and D (5) with see, try and why, terms on contact, every number computed by scripts/pins.mjs first and pinned as a function of the knobs; (4) the brief's pins section, NEEDS.md and the BACKLOG.md "RF Lab" report updated with counts, and Groups E to H recorded as deferred with the Electronics Lab groups they wait on. Fix anything the first sitting left wrong that you find on the way, and say so. ${DARK}
VERIFY: npx vitest run apps/rf-lab packages/rf packages/ui --maxWorkers=4 green; npm run build --workspace apps/rf-lab succeeds; the prose lint clean on every .md you touched. Return the structured result.`, OPTS('rf:2', 'Build', RESULT))
      if (!r2) { log('RF second sitting: no result'); return null }
      log(`RF second sitting: ok=${r2.ok}; ${r2.built}`)
      return review('RF Lab, Groups A to D', r2.branch, INTEGRATION, 'RF_LAB_PLAN.md', 'apps/rf-lab/AGENT_BRIEF.md', 'apps/rf-lab, packages/rf and packages/ui/src/SmithCanvas.jsx', 'npx vitest run apps/rf-lab packages/rf packages/ui --maxWorkers=4', 'npm run build --workspace apps/rf-lab', r2)
    },
    async () => {
      const s = await agent(`You are the OVERSEER and builder of the System Lab, first sitting: the chain as a budget, Group A. Its Phases 2 to 6 wait on the RF Lab's noise and linearity phases, which wait on the Electronics Lab; build Phase 1 whole and record the rest as deferred with each dependency named.
${SETUP('lab/system-lab', r1.branch)} (You branch from the RF Lab's branch so that packages/rf exists once; do not change its existing files, add new files only.)
${RULES}
READ FIRST, in full: SYSTEM_LAB_PLAN.md, PROGRAM.md section 3 and section 4, apps/signal-lab (the chain this lab's interaction model is: App.jsx, the chain and its sources, experiments and tests), packages/dsp/index.js, packages/rf as it stands on this branch, apps/fields-lab as the shape to copy, apps/electronics-lab/AGENT_BRIEF.md as the brief's shape.
DELIVER, committing by path after each: (1) apps/system-lab/AGENT_BRIEF.md, with apps/system-lab/scripts/pins.mjs computing every number first; (2) the block record and the level walk, and whatever else Phase 1 names, as NEW files in packages/rf with tests and fuzzed invariants; (3) the app with the suite's shell, the flow view and the table. ${DARK} (4) Group A (4) with see, try and why, terms on contact, pins as functions of the knobs; (5) the BACKLOG.md "System Lab" report and apps/system-lab/NEEDS.md (the deploy cp line, the progression ids and counts, what Phases 2 to 6 need and from whom).
VERIFY: npx vitest run apps/system-lab packages/rf --maxWorkers=4 green; npm run build --workspace apps/system-lab succeeds; the prose lint clean on every .md you touched. Return the structured result.`, OPTS('system:1', 'Build', RESULT))
      if (!s) { log('System sitting: no result'); return null }
      log(`System sitting: ok=${s.ok}; ${s.built}`)
      return review('System Lab, Group A', s.branch, r1.branch, 'SYSTEM_LAB_PLAN.md', 'apps/system-lab/AGENT_BRIEF.md', 'apps/system-lab and the new files in packages/rf the builder named (the RF Lab\'s own files are not yours)', 'npx vitest run apps/system-lab packages/rf --maxWorkers=4', 'npm run build --workspace apps/system-lab', s)
    },
  ])
  return { rf1: r1, rf, sys }
}

const phChain = async () => {
  const p1 = await agent(`You are the OVERSEER and builder of the Photonics Lab, first sitting: photons, the fibre, the cavity, and Groups A, E and F.
${SETUP('lab/photonics-lab', INTEGRATION)}
${RULES}
READ FIRST, in full: PHOTONICS_LAB_PLAN.md (its decisions are made, do not reopen them), PROGRAM.md section 3 and section 4, apps/fields-lab (the shape to copy) and packages/fields/src (wave.js, waveguide.js, geometry.js: reuse what the plan says to reuse), apps/devices-lab/src (its junction models and groups, since Group C treats the LED and the laser as junctions; note what you will need next sitting), packages/ui and packages/explain as apps/electronics-lab/AGENT_BRIEF.md's tables list them, and that brief as the shape of yours.
DELIVER, committing by path after each: (1) apps/photonics-lab/AGENT_BRIEF.md with apps/photonics-lab/scripts/pins.mjs computing every number first; (2) packages/photonics (name @ee-labs/photonics, package.json in the shape of packages/fields) with photon.js, fibre.js and cavity.js as the plan's Phases 1 and 2 name them, tests and fuzzed invariants; run npm install --no-audit --no-fund after creating it and commit package-lock.json with it; (3) the app with the suite's shell, the schematic, the link view's first form and the cavity view. ${DARK} (4) Groups A (5), E (5) and F (2) with see, try and why, terms on contact, pins as functions of the knobs; (5) the BACKLOG.md "Photonics Lab" report and apps/photonics-lab/NEEDS.md (the deploy cp line, the progression ids and counts, what Group B needs from the Electronics Lab's Group O, what the System Lab's waterfall must carry).
Groups B, C and D are not this sitting's; no lesson references them.
VERIFY: npx vitest run apps/photonics-lab packages/photonics --maxWorkers=4 green; npm run build --workspace apps/photonics-lab succeeds; the prose lint clean on every .md you touched. Return the structured result.`, OPTS('photonics:1', 'Build', RESULT))
  if (!p1) { log('Photonics first sitting: no result'); return null }
  log(`Photonics first sitting: ok=${p1.ok}; ${p1.built}`)
  const p2 = await agent(`You are the OVERSEER and builder of the Photonics Lab, second sitting: the rate equations, Groups C and D. Group B, the receiver, waits on the Electronics Lab's Group O; leave it deferred and say so. The first sitting reported: ${JSON.stringify(p1)}.
${SETUP2('lab/photonics-lab')}
${RULES}
READ FIRST: PHOTONICS_LAB_PLAN.md in full, apps/photonics-lab/AGENT_BRIEF.md and NEEDS.md, the app and package as they stand (git log --stat -12, then every file under apps/photonics-lab/src, apps/photonics-lab/scripts and packages/photonics/src), apps/devices-lab/src's junction models.
DELIVER, committing by path after each: (1) rate.js in packages/photonics with its test and fuzzed invariants, as the plan's Phase 3 names it; (2) the device curves and the modulation response view; (3) Groups C (5) and D (4) with see, try and why, terms on contact, every number computed by scripts/pins.mjs first and pinned as a function of the knobs; (4) the brief's pins section, NEEDS.md and the BACKLOG.md "Photonics Lab" report updated with counts. Fix anything the first sitting left wrong that you find on the way, and say so. ${DARK}
VERIFY: npx vitest run apps/photonics-lab packages/photonics --maxWorkers=4 green; npm run build --workspace apps/photonics-lab succeeds; the prose lint clean on every .md you touched. Return the structured result.`, OPTS('photonics:2', 'Build', RESULT))
  if (!p2) { log('Photonics second sitting: no result'); return null }
  log(`Photonics second sitting: ok=${p2.ok}; ${p2.built}`)
  return review('Photonics Lab, Groups A, C, D, E and F', p2.branch, INTEGRATION, 'PHOTONICS_LAB_PLAN.md', 'apps/photonics-lab/AGENT_BRIEF.md', 'apps/photonics-lab and packages/photonics', 'npx vitest run apps/photonics-lab packages/photonics --maxWorkers=4', 'npm run build --workspace apps/photonics-lab', p2)
}

const [rf, ph] = await parallel([rfChain, phChain])
const verdicts = [rf && rf.rf, rf && rf.sys, ph].filter(Boolean)
log(`${verdicts.filter(v => v.mergeable).length} of ${verdicts.length} reviewed labs mergeable`)
return { rf, photonics: ph }