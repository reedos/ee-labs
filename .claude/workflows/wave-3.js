export const meta = {
  name: 'wave-3',
  description: 'Bring every lab to the gold standard of the three original modules: one Opus overseer lane per lab (verify, build the remaining groups, write or run the harness), then an adversarial Opus reviewer per lane',
  phases: [
    { title: 'Lanes', detail: 'one Opus overseer per lab, one or two sittings, on its own w3/ branch', model: 'opus' },
    { title: 'Review', detail: 'an adversarial Opus reviewer per lab, fixing and committing on the same branch', model: 'opus' },
  ],
}

const INTEGRATION = 'integration/reconcile'

const RULES = `HOUSE RULES (binding). Reed owns the repo. Read PROGRAM.md (section 8 especially), CORE_SCOPE.md, STYLE.md and REVIEW_PLAYBOOK.md before touching a file. Commit by path only (never git add -A, never commit -a). NEVER push. No model names in files. Narrative commit messages in the register of git log. Run tests, builds and harnesses in the FOREGROUND with the Bash tool's timeout parameter at 600000 ms, piping through tail -40; never wait on a monitor for a test. The one thing you may run in the background is a preview server, which you must kill by its pid before you finish (never pkill with a pattern that could match your own shell). Run SCOPED tests only (this app and the packages you touch), never the whole suite, and always pass --maxWorkers=2 to vitest because up to sixteen agents share this machine. Every explanatory sentence is a claim about physics with a test that measures it against the rendered result; every number a lesson quotes is produced by the engine and pinned as a function of the knobs, never typed as a constant; theory-versus-measured rows only where measured is an independent code path; unmeasurable claims get footnotes, not crosses. Prose passes node packages/prose/bin/lint.mjs on every .md you touch and the lab's own prose test. Never edit a shared surface (site/, README.md, packages/ui/src/LabNav.jsx, .github/workflows/deploy.yml, CURRICULUM.md, EE_LABS_MAP.md, BACKLOG.md, PROGRAM.md, HANDOFF.md, packages/ui/src/progression.test.js, packages/ui/src/deployedApps.js) and never edit packages/ui, packages/explain or packages/prose: write what they need into your lab's NEEDS.md under a heading "Needs from the director" and into your result's needs. Never change an existing file of a package another lab owns; add new files only where that lab's plan says the engine lives, or put the module inside your app, and record the request in NEEDS.md. Commit early and after every group so nothing is lost if you are cut off. Machine notes: Windows with Git Bash; Node cannot see Git Bash's /tmp, so scratch files live inside your worktree with a leading underscore and .tmp in the name and are deleted before your last commit; files on disk are CRLF, so string-replacement patterns need \\r?\\n; python is not installed; never run playwright install (Chromium is in Playwright's default cache, and the package name is playwright); if a tool call is denied by a permission classifier, retry it once with wider context and do not read the denial as an objection; never cd outside your worktree; the preview server is started with npx vite preview --outDir apps/<slug>/dist --port <port> --strictPort --host 127.0.0.1 and reached at http://127.0.0.1:<port>/ (restart it after every rebuild, because vite preview caches the file list).`

const OWNERS = `PACKAGE OWNERSHIP in this wave: packages/network is the Electronics Lab's; packages/switched the Power Lab's; packages/rf the RF Lab's; packages/fields the Fields Lab's; packages/photonics the Photonics Lab's; packages/events the Logic Lab's; packages/random the Random Signals Lab's; packages/comms the Communications Lab's; packages/codes the Information Lab's; packages/machines the Machines Lab's; packages/grid the Grid Lab's; packages/lessons the Applied Analog Lab's. packages/dsp and packages/systems are governed by CORE_SCOPE.md: exact rational forms only, and a refused bridge is a finished feature. An owner may change its package with tests, and must then run the scoped tests of every app that imports what it changed (grep the export name across apps/). Everyone else uses a package as it is and records what it lacks in NEEDS.md.`

const GOLD = `THE GOLD STANDARD. Signal Lab, Circuit Lab and Control Lab (apps/signal-lab, apps/circuit-lab, apps/control-lab) are the reference implementations, and Circuit Elements Lab Groups A to I are the fourth. Every lab in this wave is brought to their shape. That shape is: (1) the lesson sidebar carries the note, then a try line rendered with @ee-labs/ui TryLine with one-click chips that set the knobs, then the lesson's featured knob rendered directly under it inside .lesson-body, then LessonNav from @ee-labs/ui (index, total, prev, next, reset, dirty); the lab opens on a chosen first lesson whose feature is visible at the defaults; (2) view controls sit on the pane headers beside what they control; the math is a tab of the lower pane with worked substitutions of the live values and measured check rows; chips and presets use the suite's styles from @ee-labs/ui base.css rather than local copies; (3) terms are defined on contact through a terms.js in the shape of apps/control-lab/src/terms.js with its scan test; Hz and rad/s both wherever a frequency is shown; phase printed beside magnitude; axes named, united and sized to their content and sticky across the steps of a lesson; "settles to" only where the plot proves it; (4) every claim measured as RULES says; refusals with tested messages; approximation guards with thresholds tested on both sides; (5) apps/<slug>/scripts/verify.mjs in the shape of apps/circuit-lab/scripts/verify.mjs and apps/signal-lab/scripts/verify.mjs: it walks every experiment and every try step in order without an implicit reset, checks that every reading the lesson quotes appears on screen with the pinned value, that every canvas draws where the feature is claimed, that the lab nav does not link a dark lab, and it runs foldProbe over every lesson at LAPTOP_VIEWPORTS (title, try line, chips and featured knob inside the first screen at 1366x768 and 1440x900), phoneProbe at PHONE_VIEWPORT (390x844: no horizontal scroll, note and first knob on the first screen) and tapTargetProbe, all imported from @ee-labs/ui/verify/foldProbe.mjs and @ee-labs/ui/verify/tapTargetProbe.mjs; each probe names the claim it measures and no probe passes over an empty set (REVIEW_PLAYBOOK section 11); (6) a screenshot pass read as a first-year student (REVIEW_PLAYBOOK sections 11 and 12) at 390x844 and 1280x900 across every group, written up as a cold walk in NEEDS.md with the playbook class beside each finding, and the findings fixed; (7) RELEASE_STATUS dark with release.test.js for a dark lab, README pins of every quoted count, AGENT_BRIEF.md and NEEDS.md in the shape of apps/electronics-lab/AGENT_BRIEF.md. Where a lab's own architecture makes one of these impossible, do the closest faithful equivalent and record the gap in NEEDS.md.`

const SETUP = (branch) => `SETUP: you are in your own git worktree. First run: git fetch origin --quiet; (git checkout -b ${branch} ${INTEGRATION} 2>/dev/null || git checkout --ignore-other-worktrees ${branch}); npm ci --no-audit --no-fund. Work only in this worktree, on ${branch}. If the branch already carried commits when you arrived, an earlier sitting was cut off: read git log ${INTEGRATION}..${branch} --stat and every file it changed, then finish that work rather than restart it.`

const READ = (lane) => `READ FIRST, in full: ${lane.plan ? lane.plan + ' (its decisions are made; do not reopen them, and record what you cannot honour in NEEDS.md for Reed), ' : ''}apps/${lane.slug}/AGENT_BRIEF.md and apps/${lane.slug}/NEEDS.md if they exist, apps/${lane.slug}/src in full (the registry, App.jsx, components, the tests, the harness if any), the packages it imports, then apps/circuit-lab/src/App.jsx, apps/circuit-lab/scripts/verify.mjs, apps/control-lab/src/terms.js and apps/signal-lab/scripts/verify.mjs as the reference shape${lane.read ? ', and ' + lane.read : ''}.`

const DELIVER_COMMON = (lane) => `Every change is committed by path on your branch with a narrative message, one commit per group or per class of defect. Record in apps/${lane.slug}/NEEDS.md: the cold walk findings with playbook classes, every plan deviation with its reason, every decision that is Reed's, everything you need from the director or another lab, and the evidence (commands, exit codes, viewport sizes, screenshot paths under apps/${lane.slug}/scripts/_shots.tmp/ which you delete before your last commit).`

const VERIFY = (lane) => `VERIFY before you return: npx vitest run apps/${lane.slug} --maxWorkers=2 (add the packages you touched, and the scoped tests of any app that imports an export you changed) is green; npm run build --workspace apps/${lane.slug} succeeds; the harness passes against the preview build at port ${lane.port}; node packages/prose/bin/lint.mjs is clean on every .md you touched; the preview server is dead; git status shows nothing of yours uncommitted.`

const RESULT = {
  type: 'object',
  properties: {
    branch: { type: 'string' },
    commits: { type: 'array', items: { type: 'string' } },
    done: { type: 'string', description: 'what was verified, built or fixed, with counts' },
    planDeviations: { type: 'array', items: { type: 'string' } },
    forReed: { type: 'array', items: { type: 'string' }, description: 'decisions only Reed can make, each with the evidence' },
    harnessSummary: { type: 'string', description: 'the harness output tail after fixes, verbatim, or the reason it could not run' },
    testSummary: { type: 'string', description: 'the vitest summary lines, verbatim' },
    lintClean: { type: 'boolean' },
    defectsOpen: { type: 'array', items: { type: 'string' } },
    needs: { type: 'array', items: { type: 'string' } },
    ok: { type: 'boolean', description: 'true only if every scoped test and the harness passed, the build succeeded, the lint is clean, the server is dead and everything is committed' },
  },
  required: ['branch', 'commits', 'done', 'planDeviations', 'forReed', 'harnessSummary', 'testSummary', 'lintClean', 'defectsOpen', 'needs', 'ok'],
}

const VERDICT = {
  type: 'object',
  properties: {
    branch: { type: 'string' },
    issuesFound: { type: 'array', items: { type: 'string' } },
    issuesFixed: { type: 'array', items: { type: 'string' } },
    issuesOpen: { type: 'array', items: { type: 'string' } },
    fixCommits: { type: 'array', items: { type: 'string' } },
    harnessSummary: { type: 'string' },
    testSummary: { type: 'string' },
    forReed: { type: 'array', items: { type: 'string' } },
    mergeable: { type: 'boolean', description: 'true only if the lab is green, pinned, lint-clean, harness-green and faithful to the plan and the gold standard after your fixes' },
  },
  required: ['branch', 'issuesFound', 'issuesFixed', 'issuesOpen', 'fixCommits', 'harnessSummary', 'testSummary', 'forReed', 'mergeable'],
}

const OPTS = (label, phaseName, schema) => ({ label, phase: phaseName, model: 'opus', effort: 'high', isolation: 'worktree', agentType: 'general-purpose', schema })

const MERGE_SAVED = (slug, detail) => `(a) The saved verification pass: git fetch origin verify/${slug} && git merge --no-ff origin/verify/${slug}. ${detail} Resolve every conflict in favour of the current code wherever the saved fix was superseded by later work, then confirm each saved fix still applies by re-running the probe that motivated it.`

const LANES = [
  { slug: 'circuit-elements-lab', name: 'Circuit Elements Lab', plan: 'CIRCUIT_ELEMENTS_LAB_PLAN.md', port: 4601, sittings: 2,
    read: 'apps/circuit-elements-lab/SITTINGS.md, src/progress.js, src/reference.js and packages/network in full',
    first: `This lab is RELEASED: every public link and experiment id stays valid and release.test.js stays green. ${MERGE_SAVED('circuit-elements-lab', 'It is 9 commits with 4 conflicts, saved before the Circuits II consolidation.')} (b) Plan-fidelity audit of Groups J to N and the reworked H (the Circuits II groups, 89 experiments in 14 groups, added between 2026-09-06 and 2026-09-09 by a different toolchain with its own conventions): for every experiment confirm that each quoted number resolves through the engine and is pinned in experiments.test.js as a function of the knobs, that see, try and why are within the STYLE budgets, that terms are on contact, that the schematic passes layoutCheck.js at fifteen seeds, and that the worked-solution panes state only what the solver produced; fix what is not, group by group, committing after each.`,
    second: `(c) The gold-standard pass over all 14 groups: the harness in scripts/verify.mjs extended with foldProbe, phoneProbe and tapTargetProbe over all 89 experiments, the screenshot pass at both sizes, and the fixes. (d) SITTINGS.md expects real students and you must not fake a sitting: instead write two cold walks in NEEDS.md, one as a newcomer seated at a1 to c2 and one seated at f3 to h2, with findings by playbook class, and fix what they find.` },
  { slug: 'circuit-lab', name: 'Circuit Lab', port: 4602, sittings: 1,
    read: 'apps/circuit-lab/src/incoming.js and packages/ui/src/circuitLink.js (the hand-over both ways)',
    first: `This lab is RELEASED and a reference: bring it back to its own conventions rather than changing them. ${MERGE_SAVED('circuit-lab', 'It is 6 commits with 3 conflicts; the saved pass recorded 34 Chromium and 35 Firefox browser failures, phone plots and laptop lesson chips.')} (b) Since the Circuits II consolidation this lab is the frequency-response tool with 16 lessons and its former phasor lessons redirect into Circuit Elements: confirm every redirect target exists and that the incoming link parser still clamps and warns. (c) Run the harness, fix every browser failure inside this lab, then the gold-standard pass, the screenshot pass and a cold walk.` },
  { slug: 'control-lab', name: 'Control Lab', port: 4603, sittings: 1,
    first: `This lab is RELEASED and a reference: bring it back to its own conventions rather than changing them. ${MERGE_SAVED('control-lab', 'It is 8 commits and merges clean.')} (b) Run the harness, fix what fails, then the gold-standard pass, the screenshot pass and a cold walk; every plant stays in the EE domain as the lab's rules say.` },
  { slug: 'signal-lab', name: 'Signal Lab', port: 4604, sittings: 1,
    first: `This lab is RELEASED and a reference: bring it back to its own conventions rather than changing them. ${MERGE_SAVED('signal-lab', 'It is 6 commits and merges clean.')} (b) The commit "Restore shared Signal Lab navigation on mobile" from 2026-09-07 is on the tip: confirm the harness's navigation probe agrees with it. (c) Run the harness and scripts/verify-navigation.mjs, fix what fails, then the gold-standard pass, the screenshot pass and a cold walk; the notes stay within 55 words and 3 sentences.` },
  { slug: 'power-lab', name: 'Power Lab', plan: 'POWER_LAB_PLAN.md', port: 4605, sittings: 2,
    read: 'packages/switched in full (this lab owns it) and apps/power-lab/NEEDS.md (the saved browser report)',
    first: `${MERGE_SAVED('power-lab', 'It is 6 commits with 4 conflicts; its checkpoint fixed motor sweep coordinates, speed predictions on current axes, logarithmic trace mapping, efficiency markers and spectrum captions, and made the harness fail on a missing browser.')} (b) The open gate: 58 first-knob visibility failures at the two desktop sizes, largest overrun 49 px, which is the sidebar's vertical budget. Fix the sidebar so the note, the try line and the first knob fit the first screen at 1366x768 and 1440x900 on every experiment, then the phone rule at 390x844. (c) Build D5, the leakage spike (the flux that links one winding only), as the plan writes it, on packages/switched, pinned as a function of the knobs.`,
    second: `(d) The gold-standard pass over all 56 experiments, the harness extended with the three probes, the screenshot pass and a cold walk. (e) The plan's recorded model deviations go into NEEDS.md for Reed with the evidence beside each.` },
  { slug: 'machines-lab', name: 'Machines Lab', plan: 'MACHINES_LAB_PLAN.md', port: 4606, sittings: 2,
    read: 'packages/machines in full (this lab owns it) and packages/switched/src/drive.js and index.js (the Power Lab contracts the drives group needed)',
    first: `${MERGE_SAVED('machines-lab', 'It is 7 commits with 2 conflicts.')} (b) Plan-fidelity audit against the plan: the deferred drives group waited for Power Lab Groups F and L, which now exist on packages/switched (drive, driveSteadyState, driveMeasures, driveAveraged, commutation and the inverter functions): build the drives experiments the plan names on those contracts, changing nothing in packages/switched; what the contract lacks goes to NEEDS.md with the tested refusal the plan allows in its place.`,
    second: `(c) The gold-standard pass over every group, the harness extended with the three probes, the screenshot pass and a cold walk.` },
  { slug: 'instruments-lab', name: 'Instruments Lab', plan: 'INSTRUMENTS_LAB_PLAN.md', port: 4607, sittings: 2,
    read: 'packages/rf/index.js and src (the S-parameter, Smith and line contracts the network-analyser group needed)',
    first: `${MERGE_SAVED('instruments-lab', 'It is 9 commits and merges clean.')} (b) Plan-fidelity audit: the network-analyser extension waited for an RF contract, which now exists in packages/rf: build the network-analyser group as the plan scopes it, on those contracts, changing nothing in packages/rf; what the contract lacks goes to NEEDS.md.`,
    second: `(c) The gold-standard pass over every group, the harness extended with the three probes, the screenshot pass and a cold walk.` },
  { slug: 'fields-lab', name: 'Fields Lab', plan: 'FIELDS_LAB_PLAN.md', port: 4608, sittings: 2,
    read: 'packages/fields in full (this lab owns it) and SYSTEM_LAB_PLAN.md where it names the antenna prerequisite Fields L supplies',
    first: `${MERGE_SAVED('fields-lab', 'It is 9 commits and merges clean.')} (b) Build Groups I and J as the plan writes them, engine first in packages/fields with fuzzed invariants, then the experiments, pinned.`,
    second: `(c) Build Groups K and L, including the antenna group the System Lab's plan names as its prerequisite, with the contract it will consume named in NEEDS.md. (d) The gold-standard pass over every group, the harness extended with the three probes, the screenshot pass and a cold walk.` },
  { slug: 'random-lab', name: 'Random Signals Lab', plan: 'RANDOM_LAB_PLAN.md', port: 4609, sittings: 1,
    first: `The recovery pass is already integrated. (a) The open findings: C3 and I1 phone captions, and F4's spread instruction; fix them with tests. (b) Run the harness, then the gold-standard pass over every group, the harness extended with the three probes, the screenshot pass and a cold walk.` },
  { slug: 'electronics-lab', name: 'Electronics Lab', plan: 'ELECTRONICS_LAB_PLAN.md', port: 4610, sittings: 2,
    read: 'packages/network in full (this lab owns it; twenty apps import it, so every change to an existing export is followed by the scoped tests of each importer), and git show c8d8981 --stat (a commit from 2026-09-08 that touched this lab under different conventions)',
    first: `(a) Plan-fidelity audit: 75 of 77 experiments exist. Group B is Circuit Elements I9 and I10 by the plan's Decision 3: cross-reference, do not build. K5's common-base half is Reed's open decision: build it as the plan writes it and mark it in NEEDS.md as awaiting his ruling. The plan's section 5 lists thirteen shape deviations for Reed to rule on: verify each still holds against the code and record the evidence beside it in NEEDS.md. (b) Audit what commit c8d8981 changed in this lab against RULES and GOLD, and fix what it left short.`,
    second: `(c) The gold-standard pass over every group, the harness extended with the three probes, the screenshot pass and a cold walk.` },
  { slug: 'rf-lab', name: 'RF Lab', plan: 'RF_LAB_PLAN.md', port: 4611, sittings: 2,
    read: 'packages/rf in full (this lab owns it), packages/network/src (the small-signal capacitances Groups E and F need), apps/rf-lab/src/extended.js and packages/lessons (a lesson tier added on 2026-09-08 by a different toolchain)',
    first: `(a) Plan-fidelity audit: Groups A to D exist (19 experiments). The app also carries extended.js lessons under a CurriculumApp wrapper in main.jsx: audit those lessons against RULES and GOLD; keep what is sound as a measured lesson tier or fold it into the lab's own experiment shape, remove duplication, and pin every number they quote. (b) Build Groups E and F as the plan writes them, engine first in packages/rf with fuzzed invariants.`,
    second: `(c) Build Groups G and H. (d) Write scripts/verify.mjs (none exists) in the reference shape with the three probes, the gold-standard pass over every group, the screenshot pass and a cold walk.` },
  { slug: 'system-lab', name: 'System Lab', plan: 'SYSTEM_LAB_PLAN.md', port: 4612, sittings: 2,
    read: 'packages/rf/index.js and src (the noise and linearity contracts; the RF Lab owns the package), packages/fields/index.js (the antenna contract if it exists yet), apps/system-lab/src/extended.js and packages/lessons',
    first: `(a) Plan-fidelity audit: Group A exists (4 experiments) plus an extended.js lesson tier under a CurriculumApp wrapper added on 2026-09-08 by a different toolchain: audit it against RULES and GOLD as the RF lane does. (b) Build Groups B and C as the plan writes them on packages/rf's contracts, changing nothing in packages/rf; a missing contract becomes the tested refusal the plan allows plus a NEEDS.md entry.`,
    second: `(c) Build Groups D to F as far as their prerequisites exist in the tree (Fields L's antenna, RF H); where one is absent, the tested refusal and the NEEDS.md entry. (d) The harness extended with the three probes, the gold-standard pass, the screenshot pass and a cold walk.` },
  { slug: 'photonics-lab', name: 'Photonics Lab', plan: 'PHOTONICS_LAB_PLAN.md', port: 4613, sittings: 2,
    read: 'packages/photonics in full (this lab owns it; receiver.js arrived on 2026-09-08 from a different toolchain), apps/electronics-lab/src/groups/o.js (the receiver contract Group B depends on), apps/photonics-lab/src/extended.js and packages/lessons',
    first: `(a) Plan-fidelity audit: Groups A and C to F exist (21 experiments) plus an extended.js lesson tier under a CurriculumApp wrapper added on 2026-09-08 by a different toolchain: audit it against RULES and GOLD as the RF lane does. (b) Build Group B as the plan writes it on the Electronics O receiver contract and packages/photonics, engine first with fuzzed invariants.`,
    second: `(c) The harness extended with the three probes, the gold-standard pass over every group, the screenshot pass and a cold walk.` },
  { slug: 'vlsi-lab', name: 'VLSI Lab', plan: 'VLSI_LAB_PLAN.md', port: 4614, sittings: 2,
    read: 'PROGRAM.md section 8 acceptance gates (written after Reed rejected this lab\'s first review), packages/events (the Logic Lab\'s), packages/network/src (the MOSFET model), packages/explain (ChipContext, shared, do not edit) and apps/vlsi-lab/src/extended.js with packages/lessons',
    first: `(a) Plan-fidelity audit: Group A exists (5 experiments); A3's analog-chain comparison and part of A5 are incomplete: finish them. The app also carries an extended.js lesson tier added on 2026-09-08 by a different toolchain: audit it against RULES and GOLD as the RF lane does. (b) Build Groups B and C as the plan writes them.`,
    second: `(c) Build Groups D to G as the plan writes them, on packages/events for the clock and memory groups without changing it. (d) The harness extended with the three probes, the gold-standard pass, the screenshot pass and a cold walk against the section 8 gates.` },
  { slug: 'interfaces-lab', name: 'Interfaces Lab', plan: 'INTERFACES_LAB_PLAN.md', port: 4615, sittings: 2,
    read: 'PROGRAM.md section 8 acceptance gates (written after Reed rejected this lab\'s first review), packages/events (the Logic Lab\'s), packages/network/src (the pin\'s drivers and RC), apps/computer-lab/src (the other claimant of the timing canvas) and apps/interfaces-lab/src/extended.js with packages/lessons',
    first: `(a) Plan-fidelity audit: Group A exists (5 pin experiments) plus an extended.js lesson tier added on 2026-09-08 by a different toolchain: audit it against RULES and GOLD as the RF lane does. (b) Build Groups B and C as the plan writes them, on packages/events without changing it.`,
    second: `(c) Build Groups D to G as the plan writes them. (d) The harness extended with the three probes, the gold-standard pass, the screenshot pass and a cold walk against the section 8 gates.` },
  { slug: 'control-lab-ii', name: 'Control Lab II', plan: 'CONTROL_LAB_II_PLAN.md', port: 4616, sittings: 2,
    read: 'packages/systems (governed by CORE_SCOPE.md) and packages/random/index.js (the contracts F3 to F5 need)',
    first: `(a) Plan-fidelity audit: Groups A to E and F1, F2 exist (32). Build F3 to F5 as the plan writes them on packages/random's contracts, changing nothing there; a missing contract becomes the tested refusal plus a NEEDS.md entry.`,
    second: `(b) Write scripts/verify.mjs (none exists) in the reference shape with the three probes, the gold-standard pass over every group, the screenshot pass and a cold walk.` },
  { slug: 'dsp-lab', name: 'DSP Lab', plan: 'DSP_LAB_PLAN.md', port: 4617, sittings: 2,
    read: 'packages/dsp (governed by CORE_SCOPE.md; the Signal Lab\'s chain)',
    first: `(a) Plan-fidelity audit against the plan, every quoted number re-pinned where it is typed. (b) Write scripts/verify.mjs (none exists) in the reference shape with the three probes, run it against the preview build and fix every failure.`,
    second: `(c) The gold-standard pass over every group, the screenshot pass and a cold walk.` },
  { slug: 'comms-lab', name: 'Communications Lab', plan: 'COMMUNICATIONS_LAB_PLAN.md', port: 4618, sittings: 2,
    read: 'packages/comms in full (this lab owns it) and packages/random/index.js',
    first: `(a) Plan-fidelity audit: the ledger records reported plan-number differences: find each, decide it from the engine, and record the resolution in NEEDS.md. (b) Write scripts/verify.mjs (none exists) in the reference shape with the three probes, run it against the preview build and fix every failure.`,
    second: `(c) The gold-standard pass over every group, the screenshot pass and a cold walk.` },
  { slug: 'info-lab', name: 'Information Lab', plan: 'INFORMATION_LAB_PLAN.md', port: 4619, sittings: 2,
    read: 'packages/codes in full (this lab owns it)',
    first: `(a) Plan-fidelity audit: the ledger records a plan correction: confirm it is applied and the plan and the code agree. (b) Write scripts/verify.mjs (none exists) in the reference shape with the three probes, run it against the preview build and fix every failure.`,
    second: `(c) The gold-standard pass over every group, the screenshot pass and a cold walk.` },
  { slug: 'logic-lab', name: 'Logic Lab', plan: 'LOGIC_LAB_PLAN.md', port: 4620, sittings: 2,
    read: 'packages/events in full (this lab owns it; the VLSI, Interfaces and Computer labs import it)',
    first: `(a) Plan-fidelity audit against the plan; the Electronics D6 cross-reference now exists, so the note that waited for it can point at it. (b) Write scripts/verify.mjs (none exists) in the reference shape with the three probes, run it against the preview build and fix every failure.`,
    second: `(c) The gold-standard pass over every group, the screenshot pass and a cold walk.` },
  { slug: 'computer-lab', name: 'Computer Lab', plan: 'COMPUTER_LAB_PLAN.md', port: 4621, sittings: 2,
    read: 'packages/events (the Logic Lab\'s) and packages/ui/src/TimingCanvas.jsx (shared, do not edit)',
    first: `(a) Plan-fidelity audit; the shared timing contracts with the Logic and Interfaces labs are checked against the code and recorded. (b) Write scripts/verify.mjs (none exists) in the reference shape with the three probes, run it against the preview build and fix every failure.`,
    second: `(c) The gold-standard pass over every group, the screenshot pass and a cold walk.` },
  { slug: 'grid-lab', name: 'Grid Lab', plan: 'GRID_LAB_PLAN.md', port: 4622, sittings: 2,
    read: 'packages/grid in full (this lab owns it), packages/network (the Newton it reuses) and apps/power-lab/src for I3 and D1 (the two cross-references that waited for them)',
    first: `(a) Plan-fidelity audit; Power I3 and D1 now exist, so the two cross-references that waited for them are checked and pointed. (b) Write scripts/verify.mjs (none exists) in the reference shape with the three probes, run it against the preview build and fix every failure.`,
    second: `(c) The gold-standard pass over every group, the screenshot pass and a cold walk.` },
  { slug: 'energy-lab', name: 'Energy Lab', plan: 'ENERGY_LAB_PLAN.md', port: 4623, sittings: 2,
    read: 'packages/machines/index.js and src (the generator contract the wind extension needed; the Machines Lab owns it) and packages/switched/index.js',
    first: `(a) Plan-fidelity audit; the wind extension waited for a generator contract: if packages/machines now supplies it, build the extension as the plan scopes it without changing that package, otherwise the tested refusal and the NEEDS.md entry. (b) Write scripts/verify.mjs (none exists) in the reference shape with the three probes, run it against the preview build and fix every failure.`,
    second: `(c) The gold-standard pass over every group, the screenshot pass and a cold walk.` },
  { slug: 'devices-lab', name: 'Devices Lab', plan: 'DEVICES_LAB_PLAN.md', port: 4624, sittings: 2,
    first: `(a) Plan-fidelity audit against the plan, every quoted number re-pinned where it is typed. (b) Write scripts/verify.mjs (none exists) in the reference shape with the three probes, run it against the preview build and fix every failure.`,
    second: `(c) The gold-standard pass over every group, the screenshot pass and a cold walk.` },
  { slug: 'applied-analog-lab', name: 'Applied Analog Lab', plan: 'APPLIED_ANALOG_LAB_PLAN.md', port: 4625, sittings: 2, analog: true,
    read: 'packages/lessons in full (this lane owns it in this wave; the RF, System, Photonics, VLSI and Interfaces apps also import CurriculumApp, so every change is followed by their scoped tests), packages/ui/src/useCanvas.js, PlaybackControls.jsx, NumField.jsx and base.css' },
  { slug: 'analog-ic-lab', name: 'Analog IC Lab', plan: 'ANALOG_IC_LAB_PLAN.md', port: 4626, sittings: 2, analog: true,
    read: 'packages/lessons (the Applied Analog lane owns it in this wave: use it as it is and record needs), packages/ui/src/useCanvas.js, PlaybackControls.jsx, NumField.jsx and base.css' },
  { slug: 'mixed-signal-lab', name: 'Mixed-Signal Lab', plan: 'MIXED_SIGNAL_LAB_PLAN.md', port: 4627, sittings: 2, analog: true,
    read: 'packages/lessons (the Applied Analog lane owns it in this wave: use it as it is and record needs), packages/switched/index.js (chargeStep, the Power Lab\'s package), packages/ui/src/useCanvas.js, PlaybackControls.jsx, NumField.jsx and base.css' },
]

const ANALOG_FIRST = (lane) => `This app was built between 2026-09-08 and 2026-09-09 by a different toolchain as lesson-driven pages on packages/lessons: a CurriculumApp with a Workbench, and one solve(p) function per lesson producing readings from the knobs, with intro, try, symbols, sources, flow, route and limits fields. (a) Plan-fidelity audit against the plan: which of the plan's experiments and groups exist, which numbers the intro, try and limits quote, and whether each is produced by solve and pinned in a test as a function of the knobs; STYLE budgets; terms on contact; sources stay cited. Fix what is not, group by group. (b) Begin the move onto the suite's shell, keeping every solve model: @ee-labs/ui base.css and LabNav, the lesson sidebar in the gold shape (note, TryLine with chips that set the knobs, the featured knob, LessonNav), the lab opening on a chosen first lesson, plots drawn with the suite's canvases (useCanvas, niceBounds, COLORS) with named axes and the feature visible at the defaults, the math as a lower-pane tab with worked substitutions of the live values and measured check rows, PlaybackControls where time exists. Convert the first half of the groups in this sitting, committing after each group. Write apps/${lane.slug}/AGENT_BRIEF.md and NEEDS.md in the electronics brief's shape.`
const ANALOG_SECOND = (lane) => `(c) Finish the move onto the suite's shell across every remaining group, keeping every solve model. (d) Write scripts/verify.mjs in the reference shape with the three probes, run it against the preview build and fix every failure; the gold-standard pass, the screenshot pass and a cold walk; README pins of every quoted count; the release test stays green with the lab dark.`

const laneBranch = (lane) => 'w3/' + lane.slug

const firstPrompt = (lane) => `You are the OVERSEER of the ${lane.name} in wave 3 of the EE Labs program${lane.sittings === 2 ? ', first of two sittings' : ''}.
${SETUP(laneBranch(lane))}
${RULES}
${OWNERS}
${GOLD}
${READ(lane)}
YOUR TASKS THIS SITTING: ${lane.analog ? ANALOG_FIRST(lane) : lane.first}
${DELIVER_COMMON(lane)}
${VERIFY(lane)}
Return the structured result; ok=true only if everything above holds.`

const secondPrompt = (lane, r1) => `You are the OVERSEER of the ${lane.name} in wave 3 of the EE Labs program, second of two sittings. The first sitting reported: ${JSON.stringify(r1)}.
${SETUP(laneBranch(lane))}
${RULES}
${OWNERS}
${GOLD}
${READ(lane)}
Also read git log ${INTEGRATION}..${laneBranch(lane)} --stat and every file the first sitting changed. Finish anything it left incomplete before your own tasks, and say so.
YOUR TASKS THIS SITTING: ${lane.analog ? ANALOG_SECOND(lane) : lane.second}
${DELIVER_COMMON(lane)}
${VERIFY(lane)}
Return the structured result; ok=true only if everything above holds.`

const reviewPrompt = (lane, r) => `You are an adversarial REVIEWER in wave 3 of the EE Labs program, checking the ${lane.name} on branch ${laneBranch(lane)}. Default to finding fault.
SETUP: you are in your own git worktree. First run: git fetch origin --quiet; git checkout --ignore-other-worktrees ${laneBranch(lane)}; npm ci --no-audit --no-fund. You may commit fixes by path on this branch. NEVER push.
${RULES}
${OWNERS}
${GOLD}
The overseer reported: ${JSON.stringify(r)}.
READ: ${lane.plan ? lane.plan + ' in full, ' : ''}apps/${lane.slug}/AGENT_BRIEF.md and NEEDS.md, CORE_SCOPE.md, STYLE.md, REVIEW_PLAYBOOK.md, PROGRAM.md section 8, and every file the branch added or changed (git diff ${INTEGRATION}...${laneBranch(lane)} --stat, then read them), then the reference apps named in GOLD.
CHECK, and fix what you find: (1) every number a lesson quotes is produced by the engine through a reads pair or claim and pinned as a function of the knobs, not typed as a constant (perturb a default in a scratch test and confirm the pin moves); (2) every experiment of the plan's groups the overseer claims exists with the plan's claim, or the deviation is justified by the engine and recorded in NEEDS.md; (3) CORE_SCOPE: nothing approximate presented as exact, every guard has a threshold and a test on both sides, every refusal a tested message, the engine's invariants fuzzed across the knob space rather than sampled at one point; (4) STYLE: see, try and why within budget, no personification, the prose tests green and the lint clean on every .md; (5) REVIEW_PLAYBOOK classes 1 to 10 against working behaviour in the browser, not source imports; (6) GOLD items 1 to 7 present and working: build the app, serve it at port ${lane.port + 100}, run apps/${lane.slug}/scripts/verify.mjs against it, and read a screenshot of at least six experiments across the groups at 390x844 and 1280x900 as a first-year student; (7) the release test asserts only the three shared surfaces and no shared surface or foreign package file was edited (git diff ${INTEGRATION}...${laneBranch(lane)} --name-only shows only this lab, its own package and the packages the overseer was allowed to add files to); (8) the brief's contracts match the code and each names its failing test; (9) the overseer's ok and harnessSummary are true to what you observe. Run the scoped tests with --maxWorkers=2 and the build. Commit fixes by path with narrative messages. Kill your preview server by pid. Return the structured verdict; mergeable=true only if green, pinned, lint-clean, harness-green and faithful to the plan and the gold standard after your fixes.`

phase('Lanes')
const results = await pipeline(
  LANES,
  (lane) => agent(firstPrompt(lane), OPTS(lane.slug + ':1', 'Lanes', RESULT)),
  (r1, lane) => {
    if (!r1) { log(`${lane.name} first sitting: no result`); return null }
    log(`${lane.name} sitting 1: ok=${r1.ok}; ${String(r1.done).slice(0, 160)}`)
    if (lane.sittings !== 2) return r1
    return agent(secondPrompt(lane, r1), OPTS(lane.slug + ':2', 'Lanes', RESULT))
  },
  (r, lane) => {
    if (!r) { log(`${lane.name}: no overseer result to review`); return null }
    if (lane.sittings === 2) log(`${lane.name} sitting 2: ok=${r.ok}; ${String(r.done).slice(0, 160)}`)
    return agent(reviewPrompt(lane, r), OPTS('review:' + lane.slug, 'Review', VERDICT)).then((v) => ({ lane: lane.slug, overseer: r, verdict: v }))
  },
)

const done = results.filter(Boolean)
const mergeable = done.filter((d) => d.verdict && d.verdict.mergeable)
log(`${mergeable.length} of ${LANES.length} lanes mergeable; ${done.filter((d) => !d.verdict).length} without a verdict`)
return { lanes: done, mergeable: mergeable.map((d) => d.lane), missing: LANES.map((l) => l.slug).filter((s) => !done.some((d) => d.lane === s)) }
