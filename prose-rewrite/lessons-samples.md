# Lesson prose — worked rewrites

Twelve rewrites, at least two from each lab, covering every construction the
rules ban. They set the pattern for the remaining lesson strings: 1,358 strings
and 34,969 words across the five labs.

**Invariants.** Every number, unit and significant figure is unchanged. Every
`reads`, `seeReads` and `set` entry is unchanged, so the tests that solve each
quoted number still pass. No term is introduced that the experiment does not
list. Sentence order follows the same claim order, so a note stays matched to the
picture it describes.

---

## Circuit Elements Lab

### A1 · `see` — `lessons.js:130`

**Now**

> Voltage is energy per unit of charge — how hard each coulomb is pushed. Current
> is charge passing per second. Here a source holds 12 V, and a resistor turns it
> into a current: i = E/R = 12 mA. The voltage is the source's decision; the
> current is the resistor's.

**Rewrite**

> Voltage is energy per unit of charge. Current is charge passing per second.
> Here a source holds 12 V across a 1 kΩ resistor, so the current is
> i = E/R = 12 mA. The source sets the voltage. The resistor sets the current.

Rules: S3 (the appositive dash), S5, S7 (a source does not decide).

### A1 · `try` — `lessons.js:134-137`

| Now | Rewrite |
|---|---|
| Turn R down to 100 Ω: the current climbs to 120 mA while the source still reads 12 V. | Set R to 100 Ω. The current rises to 120 mA and the source still reads 12 V. |
| Set E to 5 V: the current follows, 5 mA through the same 1 kΩ. | Set E to 5 V. The current falls to 5 mA through the same 1 kΩ. |
| Switch the meters to voltages: the whole top wire reads 12 V — one node, one voltage. | Switch the meters to voltages. The whole top wire reads 12 V, because it is one node. |

### A1 · `why` — `lessons.js:139-145`

**Now**

> …Turn R down and the current climbs while the source's voltage does not move by
> a microvolt — that is what "source" means. The ideal wires between them have no
> voltage across them at all: the whole top wire is one node — one point,
> electrically — and it reads E everywhere.

**Rewrite**

> …Lower R and the current rises while the source voltage stays at 12 V. That is
> the defining property of an ideal voltage source. The ideal wires have no
> voltage across them, so the whole top wire is a single node and reads E at
> every point on it.

Rules: S3 (three dashes in two sentences), S4, S8.

### A2 · refusal step — `lessons.js:157`

| Now | Rewrite |
|---|---|
| Open the switch: 5 mA has nowhere to go, no voltage is large enough, and the solver refuses the circuit and says why. | Open the switch. No finite voltage can drive 5 mA through an open circuit, so the app reports no solution and its reason. |

### A3 · reference-node step — `lessons.js:171`

| Now | Rewrite |
|---|---|
| Switch the meters to currents: V_ref carries 0 A. It is renaming zero, not doing anything. | Switch the meters to currents. V_ref carries 0 A. It shifts the reference without moving any charge. |

### E · open-loop op-amp

**Now**

> An op-amp with nothing connecting its output back to an input. Ideal — A = ∞ —
> it has no solution at all: infinity times anything. The solver refuses and says
> why.

**Rewrite**

> An op-amp with no connection from its output back to an input. With the ideal
> model, A = ∞, the equations have no solution. The app reports that, and names
> the ideal model as the cause. Switch to finite gain and the circuit solves.

---

## Power Lab

### A1 · note — `experiments.js:199`

**Now**

> A series pass element drops the difference and carries the load current, so it
> dissipates their product. From 12 V to 5 V at 1 A: 5 W reach the load and 7 W
> heat the regulator. Efficiency is 5/12 = 41.7 %, the ratio V_out/V_in at any
> current. The sweep shows no setting improves it: a linear regulator is exactly
> as efficient as its ratio.

**Rewrite**

> A series pass element drops the difference in voltage and carries the load
> current, so it dissipates the product of the two. From 12 V to 5 V at 1 A, the
> load receives 5 W and the regulator dissipates 7 W. Efficiency is
> 5/12 = 41.7 %, which is V_out/V_in at any current. No setting in the sweep
> improves it. A linear regulator is as efficient as its voltage ratio.

74 words, 5 sentences, average 14.8. Cap is 70 for a group's first experiment,
so A1 needs one more cut: drop "in voltage" and "of the two" (68 words).

### A2 · note — `experiments.js:225`

**Now**

> Replace the pass element with a switch: on for a fraction D of each period, off
> for the rest. It wastes nothing, and the average output is D·V_in = 5.00 V. But
> the load sees 12 V for 41.7 % of the time and nothing otherwise: RMS 7.75 V, so
> 12.0 W of heating, not the 5.00 W a steady 5 V gives. The sweep:
> V_rms = √D·V_in sits above ⟨v⟩ = D·V_in at every D.

**Rewrite**

> Replace the pass element with a switch, on for a fraction D of each period and
> off for the rest. It dissipates nothing, and the average output is
> D·V_in = 5.00 V. The load sees 12 V for 41.7 % of the time and 0 V for the
> rest, so its RMS voltage is 7.75 V and it heats by 12.0 W, not the 5.00 W a
> steady 5 V would give. In the sweep, V_rms = √D·V_in stays above
> ⟨v⟩ = D·V_in at every D.

Rules: S4 (three colon reveals), S6 ("The sweep:" as a fragment).

---

## Signal Lab

### Baseline preset — `presets.js:72`

| Field | Now | Rewrite |
|---|---|---|
| name | One sine, one line | One sine wave |
| note | One sine, one line. The baseline everything else is read against. | One sine wave produces one line in the spectrum. Every other experiment is read against this one. |
| try | This is the baseline. Next: Square adds only odd harmonics. | This is the baseline. Next, Square adds odd harmonics only. |

`App.smoke.test.jsx:30` asserts the old name literally; change both in one
commit.

### The ideal square — `fields.jsx`

**Now**

> The true square: harmonics forever. Not a bigger number — a different object,
> and everything above Nyquist folds back

**Rewrite**

> The ideal square wave has harmonics without limit. It is a different signal
> from a truncated series, not a longer one, and every harmonic above Nyquist
> folds back into the spectrum.

---

## Circuit Lab

### RC low-pass · note — `lessons.js:62`

**Now**

> The cutoff is not a convention: it is the frequency where the capacitor's
> impedance equals the resistor's. There the two split the input evenly in
> magnitude — each 45° from the input in phase, and so 90° from each other, as R
> and C always are — which is why the output is 1/√2 of the input and −3.01 dB
> rather than −6.

**Rewrite**

> The cutoff is the frequency where the capacitor's impedance equals the
> resistor's. There the two divide the input equally in magnitude. Each is 45°
> from the input in phase, and therefore 90° from each other, as R and C always
> are. The output is 1/√2 of the input, which is −3.01 dB rather than −6 dB.

### High-pass · note — `lessons.js:86`

**Now**

> The same two components, with the output read across the resistor instead — and
> the low-pass becomes a high-pass. Nothing else changed — the same current flows
> through both components — so whatever one keeps, the other discards.

**Rewrite**

> The same two components, with the output read across the resistor instead of
> the capacitor. The low-pass becomes a high-pass. Nothing else changed, and the
> same current flows through both components, so whatever one passes the other
> rejects.

---

## Control Lab

### Disturbance rejection · note — `lessons.js:155`

**Now**

> A disturbance lands on the PLANT — a load transient, supply ripple — and the
> loop must fight it off. Under proportional control the shove leaves a permanent
> offset of P(0)/(1+L(0)), here 0.1: shrunk, not removed. THAT is why feedback
> exists.

**Rewrite**

> A disturbance enters at the plant, as a load transient or supply ripple would.
> Under proportional control it leaves a permanent offset of P(0)/(1+L(0)), which
> is 0.1 here. The loop reduces the disturbance without removing it, and that
> reduction is what feedback buys.

Rules: S7, S8, and the capitalised words for emphasis, which the rules replace
with sentence order.

### Integral term and phase margin · note — `lessons.js:186`

**Now**

> Nothing is free — now on the motor. An integrator costs −90° of phase at every
> frequency, and it comes out of the margin: at Kp = 2 plain proportional control
> has 52° of phase margin; add the integral term and it is 19°. Phase never
> reaches −180° here; the crossover just sits closer.

**Rewrite**

> An integrator costs −90° of phase at every frequency, and the loop pays that
> out of its margin. At Kp = 2, proportional control alone has 52° of phase
> margin. Adding the integral term leaves 19°. The phase never reaches −180°
> here, so the crossover moves closer to it without crossing.
