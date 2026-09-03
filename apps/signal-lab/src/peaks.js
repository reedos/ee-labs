// The spectrum's peak readout: which lines, and where.
//
// Two things the old argmax got wrong, both caught by a student reading the
// chrome against the note:
//
//   1. Beating shows two lines and the readout named one. Every local maximum
//      within `withinDb` of the tallest, at least `minSepBins` from a taller
//      one, is a line worth naming — capped, so noise does not print a list.
//
//   2. Exactly at Nyquist read 3996.1 Hz for a 4 kHz tone. 4 kHz IS bin N/2;
//      the Hann window puts half its height into bin N/2−1, and the single-
//      sided spectrum doubles that bin (fold 2) while Nyquist keeps fold 1 —
//      a tie at 1.0 that a strict `>` argmax breaks toward the lower bin. A
//      tone at the edge is the only thing that can light the edge bin to full,
//      so an edge bin tied with the peak IS the peak.
//
// Between bins the frequency is refined from the three bins around the
// maximum, so a 255 Hz tone in 0.98 Hz bins reads 255.0 rather than the bin
// centre 254.9. For the Hann window the estimate is exact for a pure tone:
// its main lobe is |W(x)| ∝ 1/(x(1−x²)) in bins, and for a tone δ bins above
// bin k that gives |X[k−1]| : |X[k]| : |X[k+1]| = (1−δ)/(2+δ) : 1 : (1+δ)/(2−δ),
// which solves to δ = 2(c − a)/(a + 2b + c). The rectangular window's lobe is
// 1/x, giving δ = c/(b + c). Other windows fall back to a parabola through
// the log-magnitudes. The edge bins are never refined — they have one
// neighbour, not two.

const TIE = 1e-3

/** Refine one bin's frequency; see the header. */
export function refinePeak(freqs, amps, i, window = 'hann') {
  const last = amps.length - 1
  if (i >= last - 1 && amps[last] >= amps[i] * (1 - TIE)) return freqs[last]
  if (i <= 1 && amps[0] >= amps[i] * (1 - TIE)) return freqs[0]
  if (i <= 0 || i >= last) return freqs[i]
  const a = amps[i - 1]
  const b = amps[i]
  const c = amps[i + 1]
  if (!(a > 0 && b > 0 && c > 0)) return freqs[i]
  let d
  if (window === 'hann') {
    d = (2 * (c - a)) / (a + 2 * b + c)
  } else if (window === 'none') {
    d = c > a ? c / (b + c) : -a / (b + a)
  } else {
    const la = Math.log(a)
    const lb = Math.log(b)
    const lc = Math.log(c)
    const den = la - 2 * lb + lc
    d = den < 0 ? (0.5 * (la - lc)) / den : 0
  }
  if (!Number.isFinite(d) || Math.abs(d) > 1) return freqs[i]
  return freqs[i] + d * (freqs[i + 1] - freqs[i])
}

/**
 * @returns {{freq:number, amp:number, bin:number}[]} tallest lines, in
 *   ascending frequency; empty when the spectrum is numerical dust.
 */
export function spectralPeaks(
  freqs,
  amps,
  { withinDb = 6, minSepBins = 3, cap = 3, floor = 1e-6, window = 'hann' } = {},
) {
  const n = amps.length
  if (!n) return []
  let iMax = 0
  for (let i = 1; i < n; i++) if (amps[i] > amps[iMax]) iMax = i
  const max = amps[iMax]
  if (!(max > floor)) return []
  const threshold = max * Math.pow(10, -withinDb / 20)

  // Local maxima above the threshold. A flat tie (the Nyquist case) counts
  // its higher-frequency member, so the edge rule in refinePeak can see it.
  const cands = []
  for (let i = 0; i < n; i++) {
    if (amps[i] < threshold) continue
    const left = i === 0 ? -Infinity : amps[i - 1]
    const right = i === n - 1 ? -Infinity : amps[i + 1]
    if (amps[i] >= left && amps[i] >= right) cands.push(i)
  }
  cands.sort((p, q) => amps[q] - amps[p] || p - q)

  const kept = []
  for (const i of cands) {
    if (kept.length >= cap) break
    if (kept.some((k) => Math.abs(k - i) < minSepBins)) continue
    kept.push(i)
  }
  return kept
    .map((i) => ({ bin: i, amp: amps[i], freq: refinePeak(freqs, amps, i, window) }))
    .sort((p, q) => p.freq - q.freq)
}

/** "250.0 Hz", "250.0 and 255.0 Hz", "250.0, 255.0 and 260.0 Hz". */
export function formatPeaks(peaks, decimals = 1) {
  if (!peaks.length) return '—'
  const f = peaks.map((p) => p.freq.toFixed(decimals))
  if (f.length === 1) return `${f[0]} Hz`
  return `${f.slice(0, -1).join(', ')} and ${f[f.length - 1]} Hz`
}

/** Source types with a line to name; noise has none, and an impulse or step is flat or DC. */
const TONAL = new Set(['sine', 'square', 'triangle', 'sawtooth'])

/**
 * Whether the readout should name peaks at all.
 *
 * A noise source holds every frequency at once, so "the tallest three bins"
 * are three random bins: the cold walk read "peak 27.9, 166.3 and 273.9 Hz"
 * over white noise through a low-pass and asked what they meant. Nothing.
 * With no tonal source enabled the readout says "broadband" instead.
 */
export function isBroadband(sources = []) {
  const on = sources.filter((s) => s.enabled)
  return on.length > 0 && !on.some((s) => TONAL.has(s.type))
}

/** Every enabled source is a tone — the only case where a line's height means an amplitude. */
export function allTonal(sources = []) {
  const on = sources.filter((s) => s.enabled)
  return on.length > 0 && on.every((s) => TONAL.has(s.type))
}

/**
 * Does a tone at `freq` sit between bin centres far enough to read low?
 *
 * A Hann window loses 1.42 dB at half a bin off; at 0.15 bin the loss is
 * about 0.13 dB (1.5%), which is where a printed "amp 0.682" for a 0.7
 * source stops being rounding and starts being a question. Below that the
 * flag would be noise.
 */
export const OFF_BIN = 0.15

export function offBin(freq, binHz) {
  if (!(binHz > 0) || !(freq > 0)) return false
  const k = freq / binHz
  return Math.abs(k - Math.round(k)) > OFF_BIN
}

/** "0.0039" and "−48.2 dB": three significant figures, never a blind toFixed(3). */
export function fmtAmp(a) {
  if (!(a > 1e-6)) return { lin: '—', db: '' }
  const lin = a >= 0.1 ? a.toFixed(3) : Number(a.toPrecision(3)).toString()
  const db = 20 * Math.log10(a)
  return { lin, db: `${db < 0 ? '−' : ''}${Math.abs(db).toFixed(1)} dB` }
}
