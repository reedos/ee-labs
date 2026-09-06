export const meta = {
  name: 'verify-harnesses',
  description: 'Run every lab\'s Playwright harness against a real build, read screenshots as a student would, fix what is found',
  phases: [
    { title: 'Verify', detail: 'one Opus lane per lab: build, serve, harness, screenshots, fixes' },
  ],
}

const RULES = `HOUSE RULES (binding). Reed owns the repo. Read PROGRAM.md, CORE_SCOPE.md, STYLE.md, REVIEW_PLAYBOOK.md (section 11 especially: screenshot, then read it as a student would) before touching a file. Commit by path only (never git add -A, never commit -a). NEVER push. No model names in files. Narrative commit messages in the register of git log. Run unit tests in the FOREGROUND with the Bash tool's timeout parameter at 600000 ms and pipe through tail -20; never wait on a monitor for a test. The ONE thing you may run in the background is the preview server, and you must kill it before you finish. Run SCOPED tests only (this lab and the packages it touches), never the whole suite. Fix only files inside this lab's directory; anything a fix needs elsewhere goes into the lab's NEEDS.md and your result's needs.`

const LABS = [
  { slug: 'circuit-elements-lab', port: 4401 },
  { slug: 'circuit-lab', port: 4402 },
  { slug: 'control-lab', port: 4403 },
  { slug: 'signal-lab', port: 4404 },
  { slug: 'power-lab', port: 4405 },
  { slug: 'machines-lab', port: 4406 },
  { slug: 'random-lab', port: 4407 },
  { slug: 'instruments-lab', port: 4408 },
  { slug: 'fields-lab', port: 4409 },
]

const RESULT = {
  type: 'object',
  properties: {
    lab: { type: 'string' },
    branch: { type: 'string' },
    harnessRan: { type: 'boolean' },
    harnessFailuresBefore: { type: 'array', items: { type: 'string' } },
    harnessFailuresAfter: { type: 'array', items: { type: 'string' } },
    screenshotsRead: { type: 'integer' },
    defectsFound: { type: 'array', items: { type: 'string' }, description: 'each with the playbook class number and the experiment id' },
    defectsFixed: { type: 'array', items: { type: 'string' } },
    defectsOpen: { type: 'array', items: { type: 'string' } },
    commits: { type: 'array', items: { type: 'string' } },
    testSummary: { type: 'string' },
    needs: { type: 'array', items: { type: 'string' } },
    ok: { type: 'boolean', description: 'harness green after fixes, scoped tests green, server killed, everything committed' },
  },
  required: ['lab', 'branch', 'harnessRan', 'harnessFailuresBefore', 'harnessFailuresAfter', 'screenshotsRead', 'defectsFound', 'defectsFixed', 'defectsOpen', 'commits', 'testSummary', 'needs', 'ok'],
}

const INTEGRATION = 'claude/advanced-analog-labs-5eh3qd'

phase('Verify')
const results = await pipeline(LABS, (lab) => agent(`You are a VERIFIER in the EE Labs program, assigned one lab: apps/${lab.slug}. Every overseer deferred this step believing there was no browser. There is: Chromium is installed for Playwright in its default browsers cache (never run "playwright install").
SETUP: you are in your own git worktree created from master, which is behind. First: (git checkout verify/${lab.slug} 2>/dev/null || git checkout -b verify/${lab.slug} ${INTEGRATION}) && npm ci --no-audit --no-fund. If the branch already existed it carries an earlier sitting's partial work, cut off part way: read git log ${INTEGRATION}..verify/${lab.slug} --stat and every file it added before you continue, and finish that work rather than restart it.
${RULES}
READ FIRST: apps/${lab.slug}/scripts/verify.mjs (the harness: what it loads, what it checks, what it expects in APP_URL), apps/${lab.slug}/AGENT_BRIEF.md if present, the lab's plan file at the root if present, apps/${lab.slug}/src (experiments or presets or lessons, App.jsx, components), and REVIEW_PLAYBOOK.md in full.
STEPS:
1. npm run build --workspace apps/${lab.slug}. Then start the server in the background: npx vite preview --outDir apps/${lab.slug}/dist --port ${lab.port} --strictPort (Bash run_in_background). Confirm it answers with curl -s -o /dev/null -w "%{http_code}" http://localhost:${lab.port}/ .
2. Run the harness in the FOREGROUND: cd apps/${lab.slug} && APP_URL=http://localhost:${lab.port} node scripts/verify.mjs, with the Bash timeout at 600000 ms. Record every failure verbatim. If the harness itself is broken (imports, selectors that never matched, a stale expectation), fix the harness so that it measures the claim and not a proxy, and say so.
3. Screenshot pass: write a scratch Playwright script (not committed) that opens the app, loads at least eight experiments spread across every group (or all of them if fewer than twelve), and for each saves a PNG at 390x844 and at 1280x900, with every pane the experiment offers. Then READ each PNG with the Read tool and audit it as a student would, against REVIEW_PLAYBOOK classes 4 (axes named, united, sized to content), 5 (the lesson's feature visible), 6 (rendering matches data: occlusion, density, mixed scales stated), 7 (structure the student can steer), and the 390 px rule (no horizontal scroll, the note and first knob on the first screen). Record every defect with the class number and the experiment id.
4. Fix what you found inside apps/${lab.slug} only: app code, layouts, lesson text (prose must still pass this lab's prose test), harness. Every fix that changes a number or a claim needs a test. Re-run the harness and this lab's scoped vitest (npx vitest run apps/${lab.slug}) after fixing. Commit by path on verify/${lab.slug} with narrative messages, one commit per class of defect.
5. Kill the preview server (find its pid; do not use pkill with a pattern that could match your own shell). Confirm nothing of yours is still listening on port ${lab.port}.
6. Return the structured result. ok=true only if the harness is green after your fixes, scoped tests are green, the server is dead, and everything is committed. List defects you could not fix under defectsOpen with the reason.`,
  { label: 'verify:' + lab.slug, phase: 'Verify', model: 'opus', effort: 'high', isolation: 'worktree', agentType: 'general-purpose', schema: RESULT }))

const done = results.filter(Boolean)
log(`${done.filter(r => r.ok).length} of ${LABS.length} labs verified green; ${done.reduce((n, r) => n + r.defectsFixed.length, 0)} defects fixed, ${done.reduce((n, r) => n + r.defectsOpen.length, 0)} open`)
return done