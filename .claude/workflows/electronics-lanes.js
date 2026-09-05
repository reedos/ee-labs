export const meta = {
  name: 'electronics-lanes',
  description: 'Build Electronics Lab groups in Opus lanes off the integration branch, each adversarially reviewed',
  phases: [
    { title: 'Lanes', detail: 'one Opus lane per pair of groups, on its own branch' },
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

const ALL = {
  de: { key: 'de', groups: 'D and E', letters: ['d', 'e'], counts: '7 and 6', topic: 'the transistor as a controlled source (D1 two junctions, D2 BJT curves, D3 three regions, D4 MOSFET curves, D5 the switch, D6 the CMOS inverter, D7 the load line) and signal and bias take different paths (E1 coupling capacitor, E2 fixed bias, E3 degeneration, E4 temperature, E5 MOSFET bias, E6 current-source bias)' },
  fg: { key: 'fg', groups: 'F and G', letters: ['f', 'g'], counts: '6 and 2', topic: 'small signals (F1 the tangent again, F2 DC plus AC, F3 gm is the slope, F4 the hybrid-pi printed, F5 how small is small, F6 the MOSFET model) and ports (G1 a port with a dependent source inside, G2 the amplifier as a two-port and loading)' },
  hi: { key: 'hi', groups: 'H and I', letters: ['h', 'i'], counts: '7 and 5', topic: 'single-stage amplifiers (H1 CE, H2 degeneration, H3 emitter follower, H4 common base, H5 common source, H6 source follower and common gate, H7 swing and clipping) and mirrors and stacking (I1 mirror, I2 Widlar, I3 active load, I4 cascode, I5 two stages and loading)' },
  jk: { key: 'jk', groups: 'J and K', letters: ['j', 'k'], counts: '5 and 6', topic: 'the differential pair (J1 steering, J2 half-circuit, J3 CMRR, J4 mismatch and offset, J5 active-loaded pair) and frequency response (K1 the device capacitors and fT, K2 the low end, K3 Miller, K4 OCTC, K5 no Miller, K6 the cascode bandwidth)' },
  lm: { key: 'lm', groups: 'L and M', letters: ['l', 'm'], counts: '6 and 6', topic: 'feedback (L1 the loop broken, L2 desensitivity, L3 gain-bandwidth from the loop, L4 the ports, L5 two poles ring three oscillate with the Control Lab link, L6 the buffer from the inside) and inside the op-amp (M1 the two-stage op-amp, M2 gain-bandwidth from one capacitor, M3 phase margin, M4 slew, M5 offset and bias current derived, M6 the output stage)' },
  no: { key: 'no', groups: 'N and O', letters: ['n', 'o'], counts: '4 and 5', topic: 'oscillators (N1 Wien at the threshold, N2 amplitude needs a nonlinearity, N3 relaxation, N4 LC stretch) and noise (O1 a density not a spectrum importing @ee-labs/random, O2 thermal, O3 shot, O4 referred to the input, O5 SNR after gain)' },
}
const LANES = (args || ['de', 'fg', 'hi']).map(k => ALL[k])

phase('Lanes')
const results = await pipeline(
  LANES,
  (lane) => agent(`You are the OVERSEER and builder of one lane of the Electronics Lab: Groups ${lane.groups}.
${SETUP('lab/electronics-' + lane.key, INTEGRATION)}
${RULES}
READ FIRST: ELECTRONICS_LAB_PLAN.md (section 2 engine, section 3 models, section 4 app and its defaults, section 5 the curriculum for Groups ${lane.groups}, in full), apps/electronics-lab/AGENT_BRIEF.md (section 3 contracts, section 4 the lesson schema and quantity paths, section 5 the library netlists with fixed node names, section 6 pins), apps/electronics-lab/NEEDS.md section 4 and section 5 (the transistor symbol, which has landed in packages/ui, and two numbers that moved), and the app as it stands: apps/electronics-lab/src/groups/a.js and c.js and lessons/a.js and c.js (your models), experiments.js, lessons.js, terms.js, math.js, experiments.test.js, App.jsx and components/. Then packages/network/src (bjt, mosfet, companion, smallSignal, transfer, loop, macro, junction, noise and their tests) so every reading path resolves to a solver call. Then packages/ui/src/Schematic.jsx's Transistor component and schematicGeometry.js's transistor exports.
YOUR LANE: Groups ${lane.groups} (${lane.counts} experiments): ${lane.topic}.
YOU OWN exactly: apps/electronics-lab/src/groups/${lane.letters[0]}.js, groups/${lane.letters[1]}.js, lessons/${lane.letters[0]}.js, lessons/${lane.letters[1]}.js, groups/${lane.letters[0]}.terms.js and groups/${lane.letters[1]}.terms.js (new: term definitions for your groups, merged by terms.js), any new canvas in components/ that only your groups need, and ONE import line each in experiments.js, lessons.js and terms.js for your groups. Touch nothing else in the app. Do not edit packages/network; if a solver lacks something, work around it in your group file and record it in the result's needs. If a layout carrying a transistor needs apps/circuit-elements-lab/src/layoutCheck.js to know the transistor geometry, record that as a need rather than editing that file.
BUILD: every experiment of your groups with the plan's claim, knob and measured numbers, using the brief's netlists (node names fixed), every lesson in the three registers (see <=70 words, try steps <=45 words each with set/at/reads, why <=160 words), every quoted number resolving through experiments.test.js's reads paths and pinned as a function of the knobs, terms on contact, layouts passing the geometry test, the transistor symbol from packages/ui used on every schematic. Compute every number with a node script before writing it; where the plan's number disagrees with the engine, use the engine's and note it. No lesson references an unbuilt experiment (Elements H7, I9 and I10 and Electronics A and C are built; your own groups are built once you build them; every other Electronics group is not).
VERIFY: npx vitest run apps/electronics-lab --maxWorkers=4 green (existing groups A and C must stay green), npm run build --workspace apps/electronics-lab succeeds. Commit by path on your branch after each group. Return the structured result with ok=true only if all of that holds.`,
    { label: 'lane:' + lane.key, phase: 'Lanes', model: 'opus', effort: 'high', isolation: 'worktree', agentType: 'general-purpose', schema: RESULT }),
  (built, lane) => {
    if (!built) { log(`lane ${lane.key}: no result`); return null }
    log(`lane ${lane.key}: ok=${built.ok}; ${built.built}`)
    return agent(`You are an adversarial REVIEWER in the EE Labs program, checking one lane of the Electronics Lab: Groups ${lane.groups}, on branch ${built.branch}. Default to finding fault.
SETUP: you are in your own git worktree created from master. First run: git checkout --ignore-other-worktrees ${built.branch} && npm ci --no-audit --no-fund. You may commit fixes by path on this branch. NEVER push.
${RULES}
The builder reported: ${JSON.stringify(built)}.
READ: ELECTRONICS_LAB_PLAN.md section 5 for Groups ${lane.groups} and section 4.3, apps/electronics-lab/AGENT_BRIEF.md section 4 to section 6, CORE_SCOPE.md, STYLE.md, REVIEW_PLAYBOOK.md, and every file the lane added or changed (git diff ${INTEGRATION}...${built.branch} --stat, then read them).
CHECK, and fix what you find: (1) every number a lesson quotes is produced by the solver through a reads pair or claim and pinned as a function of the knobs, not typed as a constant (perturb a default in a scratch test and confirm the pin moves); (2) every experiment of the plan's groups exists with the plan's claim, or the deviation is justified by the engine and recorded; (3) CORE_SCOPE: nothing approximate is presented as exact, every guard has a threshold and a test, every refusal has a tested message; (4) STYLE: see/try/why within budget, no personification, prose.test.js green; (5) REVIEW_PLAYBOOK classes 1 to 10: sentences follow controls, phase beside magnitude, axes named and united, the feature visible at the defaults; (6) the transistor symbol drawn on every schematic that has one, layouts passing the geometry test; (7) no edit outside the lane's ownership and none to a shared surface. Run npx vitest run apps/electronics-lab --maxWorkers=4 and npm run build --workspace apps/electronics-lab. Commit fixes by path with narrative messages. Return the structured verdict; mergeable=true only if green, pinned, lint-clean and faithful after your fixes.`,
      { label: 'review:' + lane.key, phase: 'Review', model: 'opus', effort: 'high', isolation: 'worktree', agentType: 'general-purpose', schema: VERDICT })
  },
)

const verdicts = results.filter(Boolean)
log(`${verdicts.filter(v => v.mergeable).length} of ${LANES.length} lanes mergeable`)
return { verdicts }