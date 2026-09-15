export const meta = {
  name: 'records-w3',
  description: 'Make the ledger the single status record: reconcile the map, the roadmap, the trackers and the handoff with the executable inventory, and write the release order',
  phases: [
    { title: 'Records', detail: 'one Opus lane on w3/records, then an adversarial reviewer', model: 'opus' },
  ],
}

const INTEGRATION = 'integration/reconcile'

const RULES = `HOUSE RULES (binding). Reed owns the repo. Read PROGRAM.md, STYLE.md and REVIEW_PLAYBOOK.md before touching a file. Commit by path only (never git add -A, never commit -a). NEVER push. No model names in files (the toolchains that built parts of this repo are described by date and branch, never by product name). Narrative commit messages in the register of git log. Run tests in the FOREGROUND with the Bash tool's timeout parameter at 600000 ms, piping through tail -40, scoped and with --maxWorkers=2, because up to sixteen agents share this machine. Prose passes node packages/prose/bin/lint.mjs on every .md you touch; report the inherited baseline separately from your own findings and never describe a failing lint as clean. Do not edit any file under apps/ or packages/ except the two tests named below. Machine notes: Windows with Git Bash; Node cannot see Git Bash's /tmp, so scratch files live inside your worktree with a leading underscore and .tmp in the name and are deleted before your last commit; files on disk are CRLF, so string-replacement patterns need \\r?\\n; python is not installed; if a tool call is denied by a permission classifier, retry it once with wider context and do not read the denial as an objection; never cd outside your worktree.`

const RESULT = {
  type: 'object',
  properties: {
    branch: { type: 'string' },
    commits: { type: 'array', items: { type: 'string' } },
    done: { type: 'string' },
    inconsistenciesFound: { type: 'array', items: { type: 'string' } },
    inconsistenciesFixed: { type: 'array', items: { type: 'string' } },
    forReed: { type: 'array', items: { type: 'string' } },
    testSummary: { type: 'string' },
    lintBaseline: { type: 'string', description: 'inherited prose findings before, and after, on the whole repo' },
    ok: { type: 'boolean' },
  },
  required: ['branch', 'commits', 'done', 'inconsistenciesFound', 'inconsistenciesFixed', 'forReed', 'testSummary', 'lintBaseline', 'ok'],
}

const VERDICT = {
  type: 'object',
  properties: {
    issuesFound: { type: 'array', items: { type: 'string' } },
    issuesFixed: { type: 'array', items: { type: 'string' } },
    issuesOpen: { type: 'array', items: { type: 'string' } },
    fixCommits: { type: 'array', items: { type: 'string' } },
    mergeable: { type: 'boolean' },
  },
  required: ['issuesFound', 'issuesFixed', 'issuesOpen', 'fixCommits', 'mergeable'],
}

const OPTS = (label, schema) => ({ label, phase: 'Records', model: 'opus', effort: 'high', isolation: 'worktree', agentType: 'general-purpose', schema })

phase('Records')
const r = await agent(`You are the RECORDS lane of wave 3 in the EE Labs program: you make BACKLOG.md section 1 the one true status record, and every other document defer to it.
SETUP: you are in your own git worktree. First run: git fetch origin --quiet; (git checkout -b w3/records ${INTEGRATION} 2>/dev/null || git checkout --ignore-other-worktrees w3/records); npm ci --no-audit --no-fund. Work only in this worktree. If the branch already carried commits, read them first and continue.
${RULES}
READ FIRST, in full: PROGRAM.md (section 8 defines the five states: implemented, verified, integrated, accepted, released), BACKLOG.md (2300 lines; section 1 is the ledger, the rest is history from several sessions), EE_LABS_MAP.md, ANALOG_ROADMAP.md, CURRICULUM.md, HANDOFF.md, LAB_BUILDOUT_PROGRESS.md, CIRCUITS_COMPLETION_PROGRESS.md, CIRCUITS_I_II_BUILDOUT.md, README.md, scripts/director/inventory.mjs and inventory.test.js, packages/ui/src/progression.test.js, and the top of every *_LAB_PLAN.md. Then run node scripts/director/inventory.mjs (the output may carry a vite log line before the JSON; strip it) and keep the JSON as your source of truth for counts, groups, release markers and harness presence.
THE INCONSISTENCIES YOU ARE RESOLVING, and add every one you find: (1) EE_LABS_MAP.md section 1 carries Size and Status columns that contradict the ledger (Electronics "planned" against 75 implemented, Power "22 of 54" against 55, RF "mapped" against 19, the three analog labs at 16, 17 and 18 against 45, 45 and 40) and its section 3 engine table lists rf and photonics twice. (2) The documents LAB_BUILDOUT_PROGRESS.md, CIRCUITS_COMPLETION_PROGRESS.md and CIRCUITS_I_II_BUILDOUT.md, written between 2026-09-06 and 2026-09-09 on the feature/circuits-ii-rollout branch, use "accepted" and "released" to mean their own release checks passed, which is not what PROGRAM.md section 8 means by those words. (3) ANALOG_ROADMAP.md's tier statuses predate the analog apps. (4) BACKLOG.md's history sections repeat and contradict the ledger. (5) CURRICULUM.md quotes counts that packages/ui/src/progression.test.js pins to the registries. (6) HANDOFF.md opens with a reconciliation section written on 2026-09-13 and then carries three older layers.
DO, committing by path after each numbered step: (1) Rewrite BACKLOG.md section 1 from the inventory: one row per app with the executable count, present groups, the state per PROGRAM.md section 8 with its scope beside it (a dark app's state is "implemented" or "integrated", never "accepted" or "released", unless the evidence named in the row says otherwise), the next work, and the plan file; keep scripts/director/inventory.test.js green (you may edit that test only to widen what it parses, never to weaken a check). (2) Add BACKLOG.md section 2, "Release order and review budget": the four released labs first; then the order Electronics, Power, Logic, Random Signals, Communications, Control Lab II, Machines, Fields, Grid, Energy, Mixed-Signal, VLSI, Interfaces, Computer, RF, Photonics, System, DSP, Information, Devices, Instruments, Applied Analog, Analog IC, following EE_LABS_MAP.md section 4 with the three analog apps last because their teaching model is still under review; state that one lab is offered per sitting of Reed's time, that a lab is offered only in the accepted state with its cold walks and harness evidence recorded, and that Reed alone flips RELEASE_STATUS. (3) Move BACKLOG.md's history sections below a heading "3. History" untouched except for a two-sentence preface saying they are evidence of earlier decisions and do not override section 1. (4) In EE_LABS_MAP.md replace the Status and Size columns of section 1 with a single column "Ledger" pointing at BACKLOG.md section 1, fix the duplicated rows in section 3, and leave sections 2, 4 and 5 as they are. (5) Move LAB_BUILDOUT_PROGRESS.md, CIRCUITS_COMPLETION_PROGRESS.md and CIRCUITS_I_II_BUILDOUT.md into docs/history/ with git mv, prefix each with a short preface stating the date range, the branch, and that its words "accepted" and "released" refer to that branch's own release checks and not to PROGRAM.md section 8's states, and fix every link to them in README.md and elsewhere (grep the repo). (6) Update ANALOG_ROADMAP.md's tier statuses to point at the ledger rather than restate them. (7) Rewrite HANDOFF.md as one current document for a fresh session: where everything is, the state per the ledger, wave 3 (the w3/ branches, one per lab, and this records lane), what is Reed's, and the setup on this machine; move its older layers under a "History" heading. (8) Check CURRICULUM.md against the registries by running npx vitest run packages/ui/src/progression.test.js apps/circuit-elements-lab/src/experiments.test.js --maxWorkers=2, and fix any count the test shows wrong. (9) Run the prose lint on every document you touched and make your own text clean; record the repository baseline before and after.
Return the structured result. ok=true only if the inventory test and the progression test are green and every document you touched passes the prose lint.`, OPTS('records', RESULT))

if (!r) { log('records lane: no result'); return { ok: false } }
log(`records lane: ok=${r.ok}; ${r.inconsistenciesFixed.length} inconsistencies fixed`)

const v = await agent(`You are an adversarial REVIEWER of the records lane in wave 3 of the EE Labs program, on branch w3/records. Default to finding fault.
SETUP: you are in your own git worktree. First run: git fetch origin --quiet; git checkout --ignore-other-worktrees w3/records; npm ci --no-audit --no-fund. You may commit fixes by path on this branch. NEVER push.
${RULES}
The lane reported: ${JSON.stringify(r)}.
READ: PROGRAM.md section 8, then git diff ${INTEGRATION}...w3/records --stat and every file it changed, then node scripts/director/inventory.mjs (strip any vite log line before the JSON).
CHECK, and fix what you find: (1) every count in BACKLOG.md section 1 equals the inventory's count for that app and every state is one of PROGRAM.md section 8's five words with its scope beside it; no dark app is called accepted or released without evidence named in the row; (2) EE_LABS_MAP.md no longer states a status or a size for any lab, and its engine table has no duplicate rows; (3) the three moved documents carry their preface, no link to them is broken (grep the repo for their old names), and no file under apps/ or packages/ changed except scripts/director/inventory.test.js and only to widen parsing; (4) HANDOFF.md is one current document a fresh session could follow, with no model names; (5) npx vitest run scripts/director packages/ui/src/progression.test.js apps/circuit-elements-lab/src/experiments.test.js --maxWorkers=2 is green; (6) node packages/prose/bin/lint.mjs on every touched document reports no finding that the lane introduced. Commit fixes by path. Return the structured verdict.`, OPTS('review:records', VERDICT))

log(`records review: mergeable=${v && v.mergeable}`)
return { lane: r, verdict: v }
