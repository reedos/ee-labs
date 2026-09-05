export const meta = {
  name: 'harness-wave-2',
  description: 'Write and run a Playwright harness for each lab that has none, fixing what it finds, one Opus lane per lab',
  phases: [
    { title: 'Harness', detail: 'one Opus lane per lab, writing scripts/verify.mjs in the suite\'s shape and running it against a preview build' },
  ],
}

const RULES = `HOUSE RULES (binding). Reed owns the repo. Read PROGRAM.md, CORE_SCOPE.md, STYLE.md, REVIEW_PLAYBOOK.md before touching a file. Commit by path only (never git add -A, never commit -a). NEVER push. No model names in files. Narrative commit messages in the register of git log. Run tests and the harness in the FOREGROUND with the Bash tool's timeout parameter at 600000 ms and pipe through tail -40; never wait on a monitor. Run SCOPED tests only (the app you touch), never the whole suite, and always pass --maxWorkers=4 to vitest because up to a dozen agents share this machine. Every fix that changes a number or a claim needs a test; prose passes node packages/prose/bin/lint.mjs on every .md you touch and the lab's prose test. Never edit a shared surface (site/, README.md, packages/ui/src/LabNav.jsx, .github/workflows/deploy.yml, CURRICULUM.md, packages/ui/src/progression.test.js). Commit early, one commit per class of defect.`

const INTEGRATION = 'claude/advanced-analog-labs-5eh3qd'

const LABS = (args && args.length ? args : ['logic-lab', 'computer-lab', 'comms-lab', 'info-lab', 'devices-lab', 'grid-lab', 'dsp-lab', 'control-lab-ii', 'energy-lab', 'electronics-lab'])
  .map((slug, i) => ({ slug, port: 4421 + i }))

const RESULT = {
  type: 'object',
  properties: {
    branch: { type: 'string' },
    commits: { type: 'array', items: { type: 'string' } },
    harness: { type: 'string', description: 'what the harness checks, as a list of claims measured' },
    runSummary: { type: 'string', description: 'the harness output tail after fixes, verbatim' },
    defectsFound: { type: 'array', items: { type: 'string' } },
    defectsFixed: { type: 'array', items: { type: 'string' } },
    defectsOpen: { type: 'array', items: { type: 'string' } },
    testSummary: { type: 'string' },
    serverStopped: { type: 'boolean' },
    ok: { type: 'boolean', description: 'true only if the harness passes, the scoped tests pass, and the preview server is stopped' },
  },
  required: ['branch', 'commits', 'harness', 'runSummary', 'defectsFound', 'defectsFixed', 'defectsOpen', 'testSummary', 'serverStopped', 'ok'],
}

phase('Harness')
const results = await pipeline(LABS, (lab) => agent(`You are a VERIFIER in the EE Labs program, assigned one lab that has no browser harness yet: apps/${lab.slug}. Chromium is installed for Playwright in its default browsers cache (never run "playwright install"; use the Chromium the installed @playwright/test resolves on its own).
SETUP: you are in your own git worktree created from master, which is behind. First: (git checkout -b verify/${lab.slug} ${INTEGRATION} 2>/dev/null || git checkout verify/${lab.slug}) && npm ci --no-audit --no-fund. If the branch already existed it carries an earlier sitting's partial work, cut off part way: read git log ${INTEGRATION}..verify/${lab.slug} --stat and every file it added before you continue, and finish that work rather than restart it. Work only in this worktree.
${RULES}
READ FIRST: apps/circuit-lab/scripts/verify.mjs and apps/power-lab/scripts/verify.mjs (the harness idiom: what they load, what they measure, how they report; probes must measure the claim, not a proxy), apps/${lab.slug}/AGENT_BRIEF.md, the lab's plan file at the root, apps/${lab.slug}/src in full (experiments or lessons, App.jsx, components, the tests), and REVIEW_PLAYBOOK.md in full.
DO, in order:
1. Write apps/${lab.slug}/scripts/verify.mjs in the suite's shape, and a "verify" script in the app's package.json like circuit-lab's. It walks every experiment and every lesson step: the page loads without console errors, every control the lesson's try steps name exists and responds, every reading the lesson quotes appears on screen with the pinned value, every canvas draws (a non-blank pixel region where the feature is claimed), the math panel opens, the report link resolves, the lab nav does not link this dark lab, and the layout has no overlap the geometry test would catch. Each probe names the claim it measures.
2. npm run build --workspace apps/${lab.slug}. Start the preview in the background: npx vite preview --outDir apps/${lab.slug}/dist --port ${lab.port} --strictPort (Bash run_in_background). Confirm it answers: curl -s -o /dev/null -w "%{http_code}" http://localhost:${lab.port}/ .
3. Run the harness in the FOREGROUND: cd apps/${lab.slug} && APP_URL=http://localhost:${lab.port} node scripts/verify.mjs, timeout 600000. Record every failure verbatim.
4. Fix what you found inside apps/${lab.slug} only: app code, layouts, lesson text, harness. A failure that is the harness's own fault is fixed in the harness and said so; a failure that is the app's is fixed in the app with a test. Re-run the harness and npx vitest run apps/${lab.slug} --maxWorkers=4 after fixing. Commit by path on verify/${lab.slug}, one commit per class of defect, the harness first.
5. Anything you could not fix goes into apps/${lab.slug}/NEEDS.md under "Open defects from the browser pass" with the probe that finds it.
6. Kill the preview server by its pid (never pkill with a pattern that could match your own shell). Confirm nothing is listening on port ${lab.port}.
Return the structured result; ok=true only if the harness passes, the scoped tests pass, and the server is stopped.`,
  { label: 'harness:' + lab.slug, phase: 'Harness', model: 'opus', effort: 'high', isolation: 'worktree', agentType: 'general-purpose', schema: RESULT }))

const done = results.filter(Boolean)
log(`${done.filter(r => r.ok).length} of ${LABS.length} harnesses green`)
return { results: done }
