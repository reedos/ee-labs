import React from 'react'

// "Something look wrong?" — a report that arrives with its own reproducer.
//
// A report about a signals tool is worth very little without the exact setup
// behind it. "The spectrum looked wrong" cannot be acted on; the same sentence
// with the sources, blocks, rate and frame that produced it can be opened and
// looked at. So the reader is asked for one thing only — what they noticed —
// and everything else is filled in from the live state.
//
// It is deliberately NOT called "report a bug", and it invites three things
// rather than one: something looks wrong, something was confusing, or
// something needed an explanation it did not get.
//
// The last of those is not a lesser category here. This suite's product IS the
// explanation — a plot nobody can follow has failed at the job it exists to
// do, however exact its arithmetic. And the two problems most recently found
// were a caption drawn over the trace it described, and a control that counted
// terms while its label named a harmonic: neither was a wrong number, and
// neither would ever fail a test. The physics is checked exhaustively; the
// naming, the layout and the prose have no harness at all and cannot easily
// have one. Those reports are the higher-yield ones, and a button marked "bug"
// quietly tells people not to send them.

const REPO = 'https://github.com/reedos/ee-labs'

/** GitHub accepts a prefilled issue URL of about 8 KB; leave real headroom. */
const URL_LIMIT = 7000

/** Enough of the UA to identify a rendering difference, without the novel. */
function browserLine() {
  if (typeof navigator === 'undefined') return 'unknown'
  const ua = navigator.userAgent || ''
  // Order matters: Edge and Opera both claim Chrome, Chrome claims Safari.
  const hit =
    /Edg\/([\d.]+)/.exec(ua) ||
    /OPR\/([\d.]+)/.exec(ua) ||
    /Firefox\/([\d.]+)/.exec(ua) ||
    /Chrome\/([\d.]+)/.exec(ua) ||
    /Version\/([\d.]+).*Safari/.exec(ua)
  const name = hit
    ? { Edg: 'Edge', OPR: 'Opera', Firefox: 'Firefox', Chrome: 'Chrome', Version: 'Safari' }[
        hit[0].split('/')[0]
      ] || hit[0].split('/')[0]
    : 'unknown'
  const os = /Windows/.test(ua)
    ? 'Windows'
    : /Mac OS X/.test(ua)
      ? 'macOS'
      : /Android/.test(ua)
        ? 'Android'
        : /(iPhone|iPad)/.test(ua)
          ? 'iOS'
          : /Linux/.test(ua)
            ? 'Linux'
            : 'unknown OS'
  return `${name} ${hit ? hit[1] : ''} on ${os}`.replace(/\s+/g, ' ').trim()
}

/**
 * The issue body: the reader's part first, then everything gathered for them.
 *
 * The state goes in as pretty JSON rather than as a share link, because a
 * share link is LOSSY here — the hand-over format carries a source's type,
 * frequency and amplitude, and would silently drop its phase, its enabled
 * flag, and (today's example) the harmonic it stops at. A reproducer that
 * does not reproduce is worse than none, so the exact object travels, and it
 * travels readable, which is the same rule the link format itself follows.
 */
export function issueBody({ lab, version, state, summary, cap = 6000 }) {
  // A row is dropped when it is empty, and ALSO when it stringifies to
  // something that is plainly a mistake in the caller rather than a fact about
  // the reader's setup. The first real report proved both halves necessary:
  // one lab read `.label` off a descriptor carrying `.name`, so its "which
  // circuit is this" row vanished, and another interpolated the same missing
  // field into a template — printing the word "undefined" into the report,
  // which is worse than saying nothing. Neither is recoverable here; what this
  // can do is refuse to present nonsense as information.
  const rows = Object.entries(summary || {})
    .map(([k, v]) => [k, v == null ? '' : String(v)])
    .filter(([, v]) => v !== '' && !/undefined|\[object Object\]|\bNaN\b/.test(v))
    .map(([k, v]) => `| ${k} | ${v.replace(/\|/g, '\\|')} |`)
    .join('\n')

  const screen =
    typeof window !== 'undefined' ? `${window.innerWidth}×${window.innerHeight}` : 'unknown'

  let json
  try {
    json = JSON.stringify(state, null, 2)
  } catch {
    json = '(state could not be serialised)'
  }
  // A very large setup would otherwise push the prefilled URL past what GitHub
  // accepts, and an over-long URL fails by silently dropping the body rather
  // than by saying so. reportUrl shrinks `cap` until the ENCODED url fits,
  // which is the length that actually matters: percent-encoding a JSON blob
  // full of braces, quotes and newlines inflates it about two and a half
  // times, so a limit measured on the raw text passes while the real URL is
  // 8153 characters — measured, on a setup of twelve sources and twelve
  // biquads, by the test that pins this.
  if (cap <= 0) {
    json = '(omitted — this setup was too large to carry in a link; please attach it if you can)'
  } else if (json.length > cap) {
    json = `${json.slice(0, cap)}\n\n... truncated at ${cap} characters — please attach the rest if you can.`
  }

  return [
    '### What looked wrong, confusing, or unexplained?',
    '',
    '',
    '<!-- Your part is just above this line, and a sentence is plenty. All three of these are worth sending:',
    '',
    '  - something looks incorrect       ("the peak is at 3 kHz and I think it should be 4")',
    '  - something was confusing         ("I expected 3 to give me the 3rd harmonic")',
    '  - something needed explaining     ("why does the ripple appear when I lower the rate?")',
    '',
    'The last one is not a lesser report. If a plot cannot be followed, that is a problem with the',
    'tool and not with the reader — explaining these is the whole point of the thing.',
    '',
    'Everything below was filled in automatically. There is nothing down there you need to edit. -->',
    '',
    '---',
    '',
    '### The setup this came from',
    '',
    rows ? `| | |\n|---|---|\n${rows}` : '_(no summary available)_',
    '',
    '<details><summary>Exact state — open this to reproduce it</summary>',
    '',
    '```json',
    json,
    '```',
    '',
    '</details>',
    '',
    '### Environment',
    '',
    `| | |\n|---|---|\n| Lab | ${lab} |\n| Version | ${version} |\n| Browser | ${browserLine()} |\n| Window | ${screen} |`,
    '',
  ].join('\n')
}

/**
 * The prefilled GitHub issue URL for the current state.
 *
 * No `labels` parameter: GitHub drops a label the repo does not define, and
 * silently drops ALL of them for a visitor without triage rights on the repo —
 * which is every reader this button exists for.
 */
export function reportUrl({ lab, version, state, summary, repo = REPO }) {
  const build = (cap) => {
    const url = new URL(`${repo}/issues/new`)
    url.searchParams.set('title', `[${lab}] `)
    url.searchParams.set('body', issueBody({ lab, version, state, summary, cap }))
    return url.toString()
  }
  // Shrink the attached state until the whole encoded URL fits. Nearly every
  // real setup lands on the first try; the ladder exists so that the rare huge
  // one degrades to a shorter report instead of to a broken one.
  for (const cap of [6000, 2500, 1000, 400, 0]) {
    const url = build(cap)
    if (url.length <= URL_LIMIT) return url
  }
  return build(0)
}

/**
 * The link itself. `state` is the app's live state object and `summary` a few
 * human-readable rows naming what the reader is looking at.
 *
 * The URL is built inside the click rather than kept in an href, for two
 * reasons: serialising the whole state on every render would do it again on
 * every drag of every slider, and building it on hover instead would race on
 * any device that has no hover — the click would carry an empty form, which
 * is exactly the failure this button exists to prevent.
 *
 * The href stays a plain new-issue link so the control still degrades to
 * something useful if the script fails, and so middle-click behaves.
 */
export default function ReportIssue({ lab, version = '1.0.0', state, summary, repo = REPO }) {
  const onClick = (e) => {
    // Let the browser handle the modified clicks it already handles well.
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return
    e.preventDefault()
    window.open(reportUrl({ lab, version, state, summary, repo }), '_blank', 'noopener')
  }

  return (
    <a
      className="report-issue"
      href={`${repo}/issues/new`}
      target="_blank"
      rel="noreferrer noopener"
      onClick={onClick}
      title="Wrong, confusing, or needing more explanation — all three are worth sending. Opens GitHub with your current setup already filled in, so you write only what you noticed."
    >
      Something wrong or unclear?
    </a>
  )
}
