# Photonics Lab: what it needs from elsewhere

`PROGRAM.md` §1 says two overseers who need the same thing write it here and the
director resolves it once. This file is that list for the Photonics Lab. Nothing
in it is a request to another overseer. Every line is for the director.

## 1. The deploy line

One line for `.github/workflows/deploy.yml`, added at integration.

```
cp -r apps/photonics-lab/dist _site/photonics-lab
```

`release.test.js` holds this file to carrying that line, in exactly that text.
The lab deploys dark at `/photonics-lab/`, and `RELEASE_STATUS` reads `dark`
until Reed changes it. The release test also asserts that while it says `dark`,
`site/index.html`, `README.md` and `packages/ui/src/LabNav.jsx` carry no
reference to the lab. It says nothing about `deploy.yml`, because the director
writes that line and a test here would be asserting about a file this lab does
not own.

## 2. The new package

`packages/photonics` is created by this lab, per `PROGRAM.md` §5's "a new
package: the overseer whose lab creates it". It needs a row in
`EE_LABS_MAP.md` §3. Its name is `@ee-labs/photonics`, it depends only on
`@ee-labs/network`, and it holds `photon.js`, `fibre.js`, `cavity.js`,
`source.js` and `rate.js` today. `receiver.js` is the last module, and
`PHOTONICS_LAB_PLAN.md` §9 puts it in phase 4 behind the Electronics Lab's
Group O.

## 3. The progression test

`packages/ui/src/progression.test.js` belongs to the seams overseer. These are
this lab's ids and counts for it.

The slug is `photonics-lab`. Twenty-one experiments exist today, in five of
the plan's six groups. Group B is planned and not built. Its ids are listed
apart, and they do not go into the progression test until they land.

| Group | Ids | Count |
| --- | --- | --- |
| A Light, and the photodiode | a1 to a5 | 5 |
| C The LED and the laser | c1 to c5 | 5 |
| D The rate equations | d1 to d4 | 4 |
| E The fibre | e1 to e5 | 5 |
| F The cavity, and many colours | f1, f2 | 2 |

The sidebar order is the plan's, so Groups C and D sit between A and E. A
progression test that walks the ids in order should expect that order.

Not built. `PHOTONICS_LAB_PLAN.md` §9 says which phase it waits for, and
`BACKLOG.md` carries it under this lab's heading.

| Group | Ids | Count | Waits for |
| --- | --- | --- | --- |
| B The receiver | b1 to b4 | 4 | the Electronics Lab's Group O |

Cross-references this lab makes into other labs, which the progression test
should hold once each target is confirmed built:

| From | To | What it says |
| --- | --- | --- |
| a5 | Electronics Lab, junction group | the junction capacitance law, taken from `@ee-labs/network` |
| c1 | Elements I1 | the exponential law both devices carry current by |
| d3 | Control Lab, harder plants | a second-order plant at a damping ratio of 0.034848 |
| e4 | Fields Lab, wave group | where the wave equation behind V and NA comes from |

Within this lab the lessons cross-reference C4, D1, D2, D3 and F1, and every
one of those is built. `experiments.test.js` asserts that no lesson mentions a
b id or a bare "Group B", and that every c or d id a lesson names exists.

## 4. What Group B needs from the Electronics Lab's Group O

Group B is the receiver. Decision 5 of the plan keeps it at four experiments by
citing the Electronics Lab rather than repeating it. What it needs is a
**confirmed home for the two noise densities**, so that this lab cites an
experiment a reader can open.

- **The shot-noise density `2 q I`.** The plan names Electronics **O3**. B1
  compares it against thermal noise and does not define it.
- **The thermal-noise density `4 k T / R`, and the noise bandwidth.** The plan
  names Electronics **O2**. B2 turns the load resistance and reads both.
- **Noise through a network, one transfer per source, summed.** The plan names
  `packages/network/src/noise.js`. B3's sensitivity is the summed rms current
  over a stated band, divided by the responsivity, times a Q factor.

What the director has to confirm is the **experiment ids**, because the citation
in a term panel names them. If Electronics O2 and O3 are numbered differently
in the built lab, this lab's Group B cites the built numbers and not the plan's.

Two numbers this lab has already computed and will pin against that lab's, so
the seam can be checked the day Group B lands. At 1.000 µA the shot density is
0.5661 pA/√Hz. A 1.000 kΩ load at 300 K has a thermal density of
4.0704 pA/√Hz. The two are equal at 51.704 µA. The Electronics Lab's `noise.js`
must give the same three figures for the same inputs, or one of the two labs is
wrong.

Group B also names the **transimpedance amplifier** as what replaces the load
resistance, and that belongs to the Applied Analog Lab's front-end group, which
is mapped and not started. Until it exists, B2's term panel names it and no
experiment models it.

## 5. What the System Lab's waterfall must carry

Decision 4 of the plan makes the link view a chain with an optical middle, and
the budget under it the System Lab's waterfall with optical units. The System
Lab is not started, so this lab draws the waterfall itself, in
`src/components/panes.jsx`.

**It carries the second lab's shape from the first commit**, which is what
`PROGRAM.md` §4 asks of a new canvas:

```js
budget: {
  txDbm,                                  // the level at the top, in dBm
  items: [{ name, db }],                  // one row per loss, IN ORDER
  total,                                  // the sum of the items
  received,                               // txDbm − total
  sensitivityDbm,                         // the level the link has to clear
  margin,                                 // received − sensitivityDbm
}
```

Three requirements the System Lab shares and this lab already meets:

1. **A zero is a row, not an omission.** Every loss the model does not include
   is `{ name, db: 0 }` and draws as a zero-height bar with its name. This lab
   carries modal noise, the reflection penalty and mode-partition noise that
   way. `linkBudget` in `packages/photonics` refuses an unnamed item.
2. **The units are the caller's.** Nothing in the drawing knows the losses are
   optical. A radio link with the same shape draws the same picture.
3. **The margin is a row of its own** rather than the last bar. It is a
   difference against a level, and not another loss.

**What promotion needs.** Move `LinkPane`'s waterfall half into
`packages/ui/src/WaterfallCanvas.jsx` with the shape above, export it from
`packages/ui/index.js`, and leave the link strip here. The strip is optical: it
draws a transmitter, a length of fibre and a receiver. The waterfall is not.

The director decides whether that happens now or when the System Lab starts.
The plan recommends the second, because a component with one real user and one
guessed one is a component designed against a guess.

## 6. The photodiode, laser and LED symbols

`packages/ui/src/Schematic.jsx` belongs to the director. `PHOTONICS_LAB_PLAN.md`
§3 asks for three new symbols: a photodiode with its two inward arrows, a laser
diode with its two outward arrows, and a fibre drawn as a curve with its length
printed.

**None of the three is needed for the lab to be correct**, and none has been
added. The photodiode is drawn as what the solver is actually given. A diode
and a current source sit inside one dashed outline, which is `{ box: [...] }`
in the layout the shared renderer already supports. That drawing makes the
model visible rather than hiding it in a symbol.

Group C is built now, and it settled the question the other way. C1's whole
claim is that **nothing electrical tells an LED from a laser**, so drawing two
different symbols there would contradict the lesson. The circuit is one plain
diode, and the caption under it names both devices and the power each would
make at the current on screen. A `verify.mjs` check holds the caption to
naming both.

So the request narrows to one symbol and it is not urgent. A laser diode with
its two outward arrows would be worth having on the link view's transmitter
block, where the device is a picture rather than a circuit. The contract would
be one new `type` in the element switch, drawn along +x from −20 to +20 like
every other symbol, with no change to the layout format. The fibre symbol is
still wanted for the same block. The director decides, and nothing in the lab
fails without them.

## 7. The link budget in `packages/rf`

`PHOTONICS_LAB_PLAN.md` §2.9 says the optical budget reuses
`packages/rf/src/link.js`. **`packages/rf` does not exist**, because the RF Lab
is waiting on the Analog IC Lab and the Fields Lab's transmission-line group.

So the sum lives in `packages/photonics/src/fibre.js` as `linkBudget`,
`lossReach` and `bindingLimit`. It is thirty lines of arithmetic over named line
items and it is fully tested. When `packages/rf` lands, the director decides
which of the two is the one sum. Whichever survives has to keep the shape in §5
above, because two labs draw from it.

## 8. The Control Lab hand-over, when that lab wants it

D3 returns the laser's linearised response as an exactly rational second order,
in `@ee-labs/systems`' own coefficient order. `smallSignal(spec, current).b` is
the numerator and `.a` is the denominator, in descending powers of s, and
`.zeta` is 0.034848 at twice threshold with the plan's parameters.

`PHOTONICS_LAB_PLAN.md` §6 says the two labs' damping ratios are pinned equal.
Nothing is needed from the Control Lab to build that. What is needed is the
director's decision on where the pin lives, because a test that reads both
labs belongs to neither. This lab's `rate.test.js` pins the number on this
side.

## 9. Nothing else

This lab needs no new element in `packages/network`, no change to any existing
`packages/ui` component, and no experiment from another lab that is not already
built. `@ee-labs/network`'s `newtonDC`, `junctionCap` and `VT` are used
unchanged.
