# Needs and heads-ups for the other territories

Raised by the verification pass of 2026-09-05, which screenshotted sixteen
experiments at 390x844 and 1280x900 and read each one as a student would.
Every item below was fixed inside this lab, because a lab may not edit a
shared surface. Each fix is a workaround in the wrong file. The shared fix
belongs to the director, and each one helps more labs than this one.

## 1. `packages/ui/src/plot.js`: a rotated y-axis title is cut by the canvas edge

`drawFrame` centres `yTitle` on the plot and draws it rotated. The room the
title has is the plot's HEIGHT, and nothing checks that it fits. At 390x844
this lab's frequency pane is 76 px of plot, and "Amplitude (dB, 1.0 = 0 dB)"
measures 139.5 px at 12 px type. A phone reader was shown "Amplitude (dB,
1.0 = 0", which states the opposite of the fact the title carries. The
overlay's own title lost both ends and arrived as "delay of the chain
(sample". Every lab that draws a tall-ish plot on a phone is exposed.

This lab now measures the wordings itself and draws the longest that fits
(`fitTitle` in `src/components/SpectrumCanvas.jsx`). The shared fix is for
`drawFrame` to take a list of wordings, or to report the room it has, so the
choice is made once for the suite.

## 2. `packages/ui/src/plot.js`: `niceStep` leaves the top of an axis unlabelled

The ladder is 1, 2, 5 and 10. A dB axis running from -100 to +30 has a range
of 130, and the round step for six ticks is 50, so the ticks come out -100,
-50 and 0. "Resonance is Q" puts its resonant peak at +20 dB and its try line
names that number. Every gridline the reader could measure it against sat
below the peak.

This lab now computes its own step and passes `yStep`
(`spectrumYStep` in `src/components/SpectrumCanvas.jsx`). A 2.5 rung, or a
rule that a range's own ceiling always carries a tick, would fix it for
everyone.

## 3. `packages/ui/src/ZPlaneCanvas.jsx`: one far root destroys the frame

The canvas grows its span to hold every root it is handed. That is right for
an unstable pole just outside the circle. It is wrong for an FIR's outliers.
"The kernel is the filter" is a 31-tap Blackman-windowed sinc, whose furthest
zero sits near |z| = 15, so the axes ran to +-18. The unit circle, which is
the frequency axis and the whole subject of the view, collapsed to about 8 px
across on a laptop and to nothing on a phone. Twenty-seven zeros ON the
circle became one blob.

This lab now filters the roots before handing them over and counts what it
dropped in its own readout (`framedRoots` in `src/dsp/chain.js`). The shared
fix is a `maxR` prop plus an edge marker for each root outside it, so the
canvas can say "three more, that way" instead of the lab saying it. DSP Lab
and Mixed-Signal Lab both draw this view next.

## 4. `packages/ui/src/plot.js`: a phone-sized pane draws one tick

`niceStep`'s tick target is `floor(areaH / 46)`, which is 2 on a 125 px pane.
For a z-plane running -1.35 to +1.35 that yields a step of 2 and exactly one
label, "0". An axis with one label is not an axis. This lab's scope and kernel
panes work around it by passing their own step (`scopeYStep` in
`src/components/ScopeCanvas.jsx`), and `ZPlaneCanvas` cannot, because it is
not this lab's file to edit.

## 5. `packages/ui/src/ZPlaneCanvas.jsx`: the DC and Nyquist labels collide

At 390x844 the "DC" and "Nyquist" labels are drawn 7 px from their markers,
and the roots crowding the rim sit on top of them. Both words are unreadable
on a phone. No workaround was applied here.

## 6. `packages/ui/src/base.css`: the top bar cannot hold the flow strip

`.topbar` is a fixed 44 px grid row, `.topbar-controls` does not shrink, and
`.flow` scrolls. Measured across all 35 lessons at 1280x900, the strip
overflows on 20 of them, by 41 px on "Clipping makes harmonics" and by 193 px
on "AM: the carrier returns". The node it cuts is always the last one, the
output, and it cut it mid-word. "scope + FFT" read "scop" against a hard edge.

This lab now fades that edge when the content is wider than the box. The rule
is `isClipped` in `src/components/FlowStrip.jsx`. The shared fix is a top bar
that wraps to a second row. A strip that drops its RMS values before it drops
the output would also do.
