import React from 'react'
import { LabNav, LessonNav, ReportIssue, TryLine } from '@ee-labs/ui'
import { MathPanel } from '@ee-labs/explain'
import { sourceMath } from '../math-parts.js'
import { GROUP_SIGNPOSTS, PRESET_GROUPS } from '../presets.js'
import BlockCard from './BlockCard.jsx'
import { SourceField, featuredFields } from './fields.jsx'
import { WAVEFORMS } from '@ee-labs/dsp'
import { BLOCK_GROUPS, BLOCK_TYPES, makeBlockRecord } from '../dsp/blocks.js'
import { CHROME_TERMS, termsFor, termsSummary } from '../terms.js'
import { activeChip } from '../chips.js'
import { reportSummary } from '../report.js'
import pkg from '../../package.json'

function Source({ src, sampleRate, onChange, onRemove, canRemove, fftSize }) {
  const set = (k, v) => onChange({ ...src, [k]: v })
  const field = (name) => (
    <SourceField src={src} field={name} sampleRate={sampleRate} onChange={onChange} />
  )

  return (
    <div className={`source${src.enabled ? '' : ' is-off'}`}>
      <div className="source-head">
        {/* Wrapped in its own label (bare before): a native checkbox's real
            tap target is whatever label surrounds it, and this one had none —
            the 13x13 native box was the whole target. */}
        <label className="source-enable" title="Enable source">
          <input
            type="checkbox"
            checked={src.enabled}
            onChange={(e) => set('enabled', e.target.checked)}
            aria-label="Enable source"
          />
        </label>
        <select value={src.type} onChange={(e) => set('type', e.target.value)}>
          {WAVEFORMS.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="ghost"
          onClick={onRemove}
          disabled={!canRemove}
          aria-label="Remove source"
          title={canRemove ? 'Remove' : 'Keep at least one source'}
        >
          ×
        </button>
      </div>

      {field('topHarmonic')}
      {field('freq')}
      {field('amp')}
      {field('phase')}

      <MathPanel
        label="The math for this source"
        getEntry={() => sourceMath(src, { sampleRate, fftSize })}
      />
    </div>
  )
}

export default function Controls({
  state,
  setState,
  presets,
  onPreset,
  onChip,
  lastChip = null,
  nav,
  openBlocks,
  setOpenBlocks,
  openGroups,
  setOpenGroups,
  math,
  linkWarnings = [],
  cameFromLink = false,
  linkFrom = null,
  onConvPlay,
  convPlaying = false,
  circuitHref = null,
}) {
  const patch = (k, v) => setState((s) => ({ ...s, [k]: v }))

  const setSource = (i, next) =>
    setState((s) => ({ ...s, sources: s.sources.map((v, j) => (j === i ? next : v)) }))

  const addSource = () =>
    setState((s) => ({
      ...s,
      sources: [
        ...s.sources,
        {
          id: Math.max(0, ...s.sources.map((v) => v.id)) + 1,
          type: 'sine',
          freq: 500,
          amp: 0.5,
          phase: 0,
          enabled: true,
        },
      ],
    }))

  const removeSource = (i) =>
    setState((s) => ({ ...s, sources: s.sources.filter((_, j) => j !== i) }))

  const addBlock = (type) => {
    if (!type) return
    setState((s) => {
      const id = Math.max(0, ...s.blocks.map((b) => b.id)) + 1
      setOpenBlocks((o) => new Set(o).add(id))
      return { ...s, blocks: [...s.blocks, makeBlockRecord(type, id)] }
    })
  }

  const setBlock = (i, next) =>
    setState((s) => ({ ...s, blocks: s.blocks.map((b, j) => (j === i ? next : b)) }))

  const removeBlock = (i) =>
    setState((s) => ({ ...s, blocks: s.blocks.filter((_, j) => j !== i) }))

  const moveBlock = (i, dir) =>
    setState((s) => {
      const j = i + dir
      if (j < 0 || j >= s.blocks.length) return s
      const next = s.blocks.slice()
      ;[next[i], next[j]] = [next[j], next[i]]
      return { ...s, blocks: next }
    })

  const toggleOpen = (id) =>
    setOpenBlocks((o) => {
      const n = new Set(o)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })

  const toggleGroup = (g) =>
    setOpenGroups((o) => {
      const n = new Set(o)
      if (n.has(g)) n.delete(g)
      else n.add(g)
      return n
    })

  const activePreset = presets.find((p) => p.name === state.presetName)
  const featured = activePreset
    ? featuredFields(activePreset.featured, state, { setSource, setBlock, patch })
    : []
  const terms = activePreset ? termsFor(activePreset.terms) : []
  const handOverNames = presets.filter((p) => p.handOver).map((p) => p.name)

  // The sidebar is its own scroller on a phone (capped in styles.css, so both
  // plots keep the first screen) — a scroller inside a scroller. A phone's
  // own scrollbar is transient (drawn only mid-gesture, on both iOS and
  // Android), so `overflow-y: auto` alone announces nothing in a still
  // screenshot — Reed's review found the source cards and the rest of the
  // curriculum below the fold reading as "everything there is". `has-more`
  // drives a CSS scroll-shadow (paint only, no layout height, so it never
  // competes with the featured knob for room) and reveals a plain-language
  // label at the point a small scroll would first uncover it. Measured
  // rather than assumed, since whether there IS more depends on the preset,
  // the open math panels and the block count, all of which resize this box.
  const controlsRef = React.useRef(null)
  const [moreBelow, setMoreBelow] = React.useState(false)

  // The sidebar is a scroller inside a scroller (`.controls` on top of the
  // page), and the ACTIVE lesson — `.lesson`, the title/try/featured block a
  // student came to touch — can sit anywhere inside it depending on how many
  // groups happen to be open and how far down the list its own preset lives.
  // A tap on a preset several groups down leaves `.controls` scrolled to
  // wherever that button was, with the lesson it just loaded off screen
  // above the fold (Reed's review measured 495 px on a phone tapping Ring
  // modulator). Opening a further group without tapping anything can do the
  // same thing from the other side: on a laptop `.preset-list` sits ABOVE
  // `.lesson` in the DOM, so every group left open by "browsing ahead"
  // pushes the ALREADY active lesson further down the pane, with the scroll
  // position never having moved (measured: the try line 413 px into a
  // 2048 px tall pane with the window still at the top). Prev and next read
  // as airtight only because a fresh load always leaves one group open —
  // fold the same content into that little room and the same bug is there.
  //
  // Fixed by checking, not assuming: after a preset loads OR a group's own
  // open/closed set changes, if `.lesson`'s own top edge is no longer inside
  // `.controls`' visible box, scroll it back to the top of that box. The
  // check is what keeps prev/next exactly as they were — on a normal single-
  // group screen the lesson is already in view, so nothing moves; the two
  // measured cases above are the ones where it actually fires. Skipped on
  // the very first render, since the initial load has nothing to correct.
  //
  // The check reads the TRY LINE's own box, not `.lesson`'s: `.lesson` runs
  // from the lesson nav down through the note and its terms, so its own top
  // edge can still be inside the visible box while the try line and the
  // featured knob a little further down it are not — exactly the case that
  // slipped through an earlier version of this check.
  const lessonRef = React.useRef(null)
  const loadedOnce = React.useRef(false)
  React.useEffect(() => {
    if (!loadedOnce.current) {
      loadedOnce.current = true
      return
    }
    const el = lessonRef.current
    const container = controlsRef.current
    if (!el || !container) return
    const target = el.querySelector('.try-line') || el
    const targetBox = target.getBoundingClientRect()
    const contBox = container.getBoundingClientRect()
    const visible = targetBox.top >= contBox.top - 0.5 && targetBox.bottom <= contBox.bottom + 0.5
    if (!visible) el.scrollIntoView({ block: 'start' })
  }, [state.presetName, openGroups])
  React.useLayoutEffect(() => {
    const el = controlsRef.current
    if (el) setMoreBelow(el.scrollHeight - el.scrollTop - el.clientHeight > 1)
  })
  React.useEffect(() => {
    const el = controlsRef.current
    if (!el) return
    const check = () => setMoreBelow(el.scrollHeight - el.scrollTop - el.clientHeight > 1)
    el.addEventListener('scroll', check, { passive: true })
    window.addEventListener('resize', check)
    return () => {
      el.removeEventListener('scroll', check)
      window.removeEventListener('resize', check)
    }
  }, [])

  return (
    <aside className={`controls${moreBelow ? ' has-more' : ''}`} ref={controlsRef}>
      <header>
        <LabNav current="signal-lab" />
        <h1>Signal Lab</h1>
        <p className="sub">
          A signal, its frequency content, and what happens when you put things in the way.
        </p>
        {/* The words the top bar and every readout use on EVERY screen — FFT,
            bin, frame, window, the window names, RMS, crest, span — defined
            once here rather than in each preset's own terms list (CHROME_TERMS
            in terms.js). Folded, so it costs nothing to a student who already
            knows them. */}
        <details className="terms chrome-terms">
          <summary>what the top bar means</summary>
          <dl>
            {termsFor(CHROME_TERMS).map((t) => (
              <React.Fragment key={t.id}>
                <dt>{t.name}</dt>
                <dd>{t.def}</dd>
              </React.Fragment>
            ))}
          </dl>
        </details>
      </header>

      <section>
        {cameFromLink ? (
          <p className="hint from-link">
            {linkFrom && linkFrom.label
              ? `This chain IS your “${linkFrom.label}” from ${
                  linkFrom.app === 'circuit' ? 'Circuit Lab' : linkFrom.app
                } — the same transfer function, sampled. Pick anything below to start over.`
              : 'Loaded from a link — this chain came from another tool in the suite. Pick anything below to start over.'}
          </p>
        ) : null}
        {linkWarnings.length ? (
          <ul className="link-warnings">
            {linkWarnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        ) : null}
        {/* Two halves, reordered by CSS on phone (≤900px): `.preset-list` is
            the curriculum — the thing you pick FROM; `.lesson` is the one you
            picked. On a laptop sidebar both fit and the order below (list,
            then lesson) is the natural reading order. On a phone the sidebar
            is a short scroller of its own (base.css stacks it under the
            plots), and with the list first that scroller showed nothing but
            group headers on a fresh load — the active lesson's title, try
            line and knob were a scroll away inside a scroller inside a
            scroller. flex `order` puts `.lesson` first there instead. */}
        <div className="preset-list">
        <h2>Try this</h2>
        {/* Grouped as a curriculum, and COLLAPSED to group headers by default:
            thirty buttons were most of the sidebar, and the thing a preset
            changes - the sources and chain below - was scrolled out of sight
            at the moment it changed. Only the active preset's group stays
            open, so where-you-are survives the fold.

            The <details> is fully controlled: `open` is the truth, and the
            summary's click is intercepted BEFORE the browser toggles anything.
            The previous version listened to onToggle instead, and React fires
            that on the initial open render — so the group holding the first
            preset was recorded as "opened by hand" and never folded when the
            student moved on to another group (Reed's review). The active
            group refuses the click outright, so it cannot be hidden. */}
        {PRESET_GROUPS.map((g) => {
          const inGroup = presets.filter((p) => p.group === g)
          if (!inGroup.length) return null
          const holdsActive = inGroup.some((p) => p.name === state.presetName)
          return (
            <details className="preset-group" key={g} open={holdsActive || openGroups.has(g)}>
              <summary
                onClick={(e) => {
                  e.preventDefault()
                  if (!holdsActive) toggleGroup(g)
                }}
              >
                {g}
                {GROUP_SIGNPOSTS[g] ? <span className="group-signpost">{GROUP_SIGNPOSTS[g]}</span> : null}
                {holdsActive ? <span className="group-active-dot" aria-hidden="true" /> : null}
              </summary>
              <div className="presets">
                {inGroup.map((p) => (
                  <button
                    type="button"
                    key={p.name}
                    className={`preset${p.name === state.presetName ? ' is-on' : ''}`}
                    onClick={() => onPreset(p)}
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            </details>
          )
        })}
        </div>
        <div className="lesson" ref={lessonRef}>
        {nav ? (
          <LessonNav
            index={nav.index}
            total={nav.total}
            dirty={nav.dirty}
            onPrev={nav.onPrev}
            onNext={nav.onNext}
            onReset={nav.onReset}
            noun="experiment"
          />
        ) : null}
        {activePreset ? (
          <>
            {/* The note gets its title. Once the groups fold, the paragraph
                below was the only place the selection was legible at all —
                and it opened mid-thought, anonymous. */}
            <h3 className="note-title">{activePreset.name}</h3>
            <TryLine
              text={activePreset.try}
              chips={activePreset.chips || []}
              onChip={onChip}
              activeChip={activeChip(state, activePreset.chips || [], lastChip)}
            />
            {/* The knob the try line names, right under it — the same
                control as in its card below, so "drag Q" is not a scroll
                away at 1366×768. verify.mjs holds this at laptop sizes.
                The note comes AFTER it: title → try → featured knob → note,
                so the knob a fold probe holds is never pushed past the fold
                by however long the note happens to run (six FIR/z-plane
                presets' knobs still ran 40-100 px past a 1366×768 fold with
                the note ahead of them). */}
            {featured.length || activePreset.playHint ? (
              <div className="featured">
                {featured.map((f) => (
                  <div className="featured-item" key={f.key}>
                    <p className="featured-from">{f.from}</p>
                    {f.node}
                  </div>
                ))}
                {/* "Press play" names a canvas transport, not a source or a
                    block field — the play button lives in the Time domain
                    view, a full column away from this try line and easy to
                    miss (the review's own complaint). Mirrored here rather
                    than moved: the scrubber and speed chips stay on the
                    canvas, where the animation they drive is visible. */}
                {activePreset.playHint ? (
                  <div className="featured-item" key="play">
                    <p className="featured-from">Time domain</p>
                    <button type="button" className="ghost try-play" onClick={onConvPlay}>
                      {convPlaying ? '⏸ pause' : '▶ play'}
                    </button>
                  </div>
                ) : null}
              </div>
            ) : null}
            <p className="hint">{activePreset.note}</p>
            {/* The hand-over out, the reverse of Circuit Lab's own "Open in
                Signal Lab →": a real link only where the two apps are
                deployed side by side (null in dev, so this renders nothing
                there) and only on the one preset CORE_SCOPE calls exact — a
                series RLC read across its capacitor carries the same cutoff
                and Q this block already has, not an approximation of them. */}
            {activePreset.handOver && circuitHref ? (
              <p className="hint circuit-forward">
                This is also a circuit, a series RLC with the same cutoff and Q.{' '}
                <a href={circuitHref} title="The same corner and Q, as the circuit they describe">
                  Open in Circuit Lab →
                </a>
              </p>
            ) : null}
          </>
        ) : null}
        {/* The vocabulary this lesson leans on, defined where it is used. A
            student meeting "bin" or "Q" mid-note should not need a second
            tab — and folded, the definitions cost nothing to someone who
            already has them. The summary NAMES the terms, so a student can
            see whether the word that stopped them is behind it without
            opening a panel that would push the knobs down. */}
        {activePreset && terms.length ? (
          <details className="terms">
            <summary>{termsSummary(activePreset.terms)}</summary>
            <dl>
              {terms.map((t) => (
                <React.Fragment key={t.id}>
                  <dt>{t.name}</dt>
                  <dd>{t.def}</dd>
                </React.Fragment>
              ))}
            </dl>
          </details>
        ) : null}
        {/* Said once, honestly: which experiments cross into another lab.
            CORE_SCOPE's rule is deliberate — no link where the mapping is
            not exact — so most experiments stand alone, and nothing said
            so before now. Placed at the END of the lesson block (after the
            note and its terms) rather than near the try line: anything
            earlier here pushes the try line and the featured knob down,
            and the fold probe holds both at 1366x768. Skipped on the one
            preset that already carries its own "Open in Circuit Lab" line,
            so nothing repeats itself. Computed from the data, not a
            hand-written name, so a second exact hand-over stays covered
            without a second edit here. */}
        {activePreset && !activePreset.handOver && handOverNames.length ? (
          <p className="hint transfer-note">
            {handOverNames.join(', ')} carries an exact match into another lab. Every other experiment here stands alone.
          </p>
        ) : null}
        </div>
        {/* Phone only (styles.css): announces that `.controls` is its own
            scroller — a scroller inside the page's own scroller, with no
            native scrollbar to say so, which read as "everything there is"
            rather than "more below" (Reed's review). Flex `order` leaves it
            at its default (0), so it lands right after `.lesson` (order -1)
            and before `.preset-list` (order 1): the first thing a further
            scroll reveals, never overlapping the featured knob above it. */}
        {moreBelow ? (
          <div className="controls-more" aria-hidden="true">
            ▾ more below
          </div>
        ) : null}
      </section>

      <section id="sources">
        <h2>
          Sources
          <button type="button" className="ghost add" onClick={addSource}>
            + add
          </button>
        </h2>
        {state.sources.map((s, i) => (
          <Source
            key={s.id}
            src={s}
            sampleRate={state.sampleRate}
            fftSize={state.fftSize}
            onChange={(next) => setSource(i, next)}
            onRemove={() => removeSource(i)}
            canRemove={state.sources.length > 1}
          />
        ))}
      </section>

      <section id="chain">
        <h2>
          Chain
          <select
            className="ghost add"
            value=""
            aria-label="Add a processing block"
            onChange={(e) => {
              addBlock(e.target.value)
              e.target.value = ''
            }}
          >
            <option value="" disabled>
              + add block
            </option>
            {BLOCK_GROUPS.map((g) => (
              <optgroup key={g} label={g}>
                {Object.entries(BLOCK_TYPES)
                  .filter(([, def]) => def.group === g)
                  .map(([type, def]) => (
                    <option key={type} value={type}>
                      {def.label}
                    </option>
                  ))}
              </optgroup>
            ))}
          </select>
        </h2>

        {state.blocks.length === 0 ? (
          <p className="hint empty">
            No blocks between the sources and the plots. Add a filter and its response
            is drawn over the spectrum.
          </p>
        ) : (
          state.blocks.map((b, i) => (
            <BlockCard
              key={b.id}
              block={b}
              index={i}
              count={state.blocks.length}
              open={openBlocks.has(b.id)}
              sampleRate={state.sampleRate}
              onToggleOpen={() => toggleOpen(b.id)}
              onChange={(next) => setBlock(i, next)}
              onRemove={() => removeBlock(i)}
              onMove={(dir) => moveBlock(i, dir)}
            />
          ))
        )}
      </section>

      {/* The experiment's math BELOW the knobs, not between the note and the
          sources: opened, it used to push every source and block off the
          bottom of the sidebar (Reed's review). Down here, expanding it moves
          nothing a student is holding. */}
      <section id="math">
        <MathPanel entry={math} label="The math for this experiment" />
      </section>

      <section>
        <h2>View</h2>
        <label className="check">
          <input
            type="checkbox"
            checked={state.showHarmonics}
            onChange={(e) => patch('showHarmonics', e.target.checked)}
          />
          Mark harmonics of source 1
        </label>
        <label className="check">
          <input
            type="checkbox"
            checked={state.showGhost}
            onChange={(e) => patch('showGhost', e.target.checked)}
          />
          Show pre-chain spectrum
        </label>
        {/* The dB/lin scale, the overlay and the zoom moved to the frequency
            pane's own header — next to the plot they govern. This section
            keeps the lesson-flavoured toggles that annotate BOTH panes. */}
        <label className="check">
          <input
            type="checkbox"
            checked={state.showTransient}
            onChange={(e) => patch('showTransient', e.target.checked)}
          />
          Show filter start-up transient
        </label>
      </section>

      {/* Moved out of the header, where it sat right above the experiment
          buttons and read as one more item in that list — the impatient
          student clicked it thinking it was an experiment. Down here, past
          everything a student came to touch, and set off by its own rule in
          styles.css, it reads as what it is: a way out, not a way in. */}
      <section className="feedback">
        <ReportIssue
          lab="Signal Lab"
          version={pkg.version}
          state={state}
          summary={reportSummary(state)}
        />
      </section>
    </aside>
  )
}
