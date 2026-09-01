import { fmtHz } from '@ee-labs/ui'

/**
 * What to show at the top of a report from this lab.
 *
 * A plain function rather than inline JSX so it can be checked — see the
 * matching files in the other two labs, where the inline version silently
 * dropped the row naming which circuit the report came from.
 *
 * "Started from" rather than "Loaded from" because this lab keeps its preset
 * name after the sliders move: unlike a static lesson note, every panel here
 * recomputes from live state, so the name stays useful while no longer
 * describing the setup exactly. The authoritative record is the state below.
 */
export function reportSummary(state) {
  const on = (state.sources || []).filter((s) => s.enabled)
  return {
    'Started from': state.presetName || '(built by hand)',
    Sources: on.length
      ? on
          .map((s) => {
            const band =
              s.type === 'square' && s.topHarmonic > 0 ? ` up to harmonic ${s.topHarmonic}` : ''
            return `${s.type} at ${fmtHz(s.freq)}Hz${band}`
          })
          .join(', ')
      : 'none enabled',
    Chain: (state.blocks || []).length
      ? state.blocks.map((b) => b.type + (b.bypass ? ' (bypassed)' : '')).join(' → ')
      : 'empty',
    'Sample rate': `${fmtHz(state.sampleRate)}Hz`,
    'FFT size': state.fftSize,
    Window: state.window,
  }
}
