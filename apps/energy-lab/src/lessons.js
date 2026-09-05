/**
 * What the student reads, per experiment, in three registers:
 *
 *   see — what the picture shows at the defaults, in a few lines;
 *   try — knob moves with the reading each one produces;
 *   why — the reasoning, for after the picture has made its point.
 *
 * Every number a register quotes is a measurement. A step's `set` is applied
 * on top of the defaults, its `at` moves the cursor, and each `reads` pair is
 * a quantity path (or a function of the analysis) with the value the sentence
 * quotes. `experiments.test.js` solves each step and checks both the pair and
 * every number-with-unit in the sentence against it.
 *
 * The paths are the brief's §4. A pair may also be a function of
 * `(x, p, again, exp)`, where `again(over)` re-solves the experiment with
 * those knobs changed. That is how a note compares two settings without
 * quoting a constant.
 */

const pct = (a, b) => (a / b) * 100

export const LESSONS = {
  // ---------------------------------------------------------- A · the cell
  a1: {
    see:
      'A photovoltaic cell is a diode with a current source across it. Short the terminals and the whole ' +
      'photocurrent comes out, 5.0000 A. Open them and none does, at 0.632944 V. In between the diode takes ' +
      'a share and the terminals get the rest. Both intercepts are exact solves, not readings off a curve.',
    seeReads: [
      ['pv.isc', 5],
      ['pv.voc', 0.632944],
    ],
    try: [
      {
        say: 'Halve the light. The short-circuit current halves with it, to 2.5000 A, because the photocurrent is what the light makes.',
        set: { G: 500 },
        reads: [['pv.isc', 2.5]],
      },
      {
        say: 'Turn the cell to 65 °C. The open-circuit voltage falls to 0.556595 V while the light has not changed at all.',
        set: { Tc: 65 },
        reads: [['pv.voc', 0.556595]],
      },
      {
        say: 'Set the shunt to 1 Ω. The open-circuit voltage drops to 0.629487 V, because the leakage path now takes some of the photocurrent.',
        set: { Rsh: 1 },
        reads: [['pv.voc', 0.629487]],
      },
    ],
    why:
      'The single-diode model is one equation. The light makes I_ph, the junction passes ' +
      'I_s(e^(v/nV_T) − 1), the shunt passes v/R_sh, and what is left leaves the terminals. At short circuit ' +
      'the junction has no voltage across it, so it takes nothing and the terminals take everything. At open ' +
      'circuit the terminals take nothing, so the junction takes it all, and the voltage it needs to do that ' +
      'is n·V_T·ln(I_ph/I_s + 1). That closed form gives 0.632944 V here. The solved answer sits 0.325 µV ' +
      'below it, because the shunt took a little of the photocurrent that the formula gave to the junction.',
    whyReads: [
      ['pv.voc_formula', 0.632944],
      [(x) => x.formulas.voc - x.fig.voc, 3.25e-7, 1e-8],
    ],
  },

  a2: {
    see:
      'Every point of this curve is its own Newton solve, three iterations at the default load. The straight ' +
      'line through the origin is the load, and the operating point is where the two meet. At 0.11572 Ω the ' +
      'cell delivers 0.552914 V and 4.77803 A.',
    seeReads: [
      ['pv.iters', 3],
      ['pv.v', 0.552914],
      ['pv.i', 4.77803],
    ],
    try: [
      {
        say: 'Drop the load to 0.05 Ω. The load line steepens, the point slides to the short-circuit end, and the power falls to 1.24999 W.',
        set: { R: 0.05 },
        reads: [['pv.p', 1.24999]],
      },
      {
        say: 'Raise it to 1 Ω. Now the point sits near open circuit, at 0.629487 V, and the power is 0.396253 W.',
        set: { R: 1 },
        reads: [
          ['pv.v', 0.629487],
          ['pv.p', 0.396253],
        ],
      },
      {
        say: 'Set it to 0.5 Ω, between the two. The cell gives 0.782613 W, still under a third of what it could.',
        set: { R: 0.5 },
        reads: [
          ['pv.p', 0.782613],
          [(x) => pct(x.at.p, x.fig.pmpp), 29.62],
        ],
      },
    ],
    why:
      'The knee is the diode turning on. Below it the junction carries almost nothing and the terminal ' +
      'current is the whole photocurrent, so the curve is flat. Above it the junction current climbs by a ' +
      'factor of ten for every 59.159 mV, so a few tens of millivolts take the terminal current from all of ' +
      'the photocurrent to none. That is the same exponential Elements I1 and I2 put on screen, read the ' +
      'other way round. The load line has not changed either. It is Elements I2 with the source replaced by ' +
      'the light.',
    whyReads: [['pv.decade', 0.059159]],
  },

  a3: {
    see:
      'Power is voltage times current, so it is zero at both ends of the curve. Between them it has one ' +
      'maximum. Here it sits at 0.552926 V and 4.77793 A, giving 2.64184 W. Golden-section search on the ' +
      'exact solve finds it, so it is the model’s own maximum rather than the best of a sample grid.',
    seeReads: [
      ['pv.vmpp', 0.552926],
      ['pv.impp', 4.77793],
      ['pv.pmpp', 2.64184],
    ],
    try: [
      {
        say: 'Halve the light. The maximum moves down and slightly left, to 1.27839 W at 0.535884 V.',
        set: { G: 500 },
        reads: [
          ['pv.pmpp', 1.27839],
          ['pv.vmpp', 0.535884],
        ],
      },
      {
        say: 'Take the light to a tenth. The maximum is 0.235965 W, which is under a tenth of the full-sun figure.',
        set: { G: 100 },
        reads: [['pv.pmpp', 0.235965]],
      },
      {
        say: 'Return the light and set the load to 0.11572 Ω. The operating point lands on the maximum, and the reading agrees to five figures.',
        set: { G: 1000, R: 0.11572 },
        reads: [['pv.p', 2.64184]],
      },
    ],
    why:
      'The maximum power point is where the product stops rising. Below it the current is barely changing ' +
      'and the voltage is, so raising the voltage buys power. Above it the exponential has taken over and ' +
      'the current is falling faster than the voltage rises. The resistance that sits there is V_mpp/I_mpp, ' +
      'which is 0.11572 Ω for this cell. It is not a property of the load. It is a property of the light, ' +
      'the temperature and the junction, and every one of those moves during a day. That is why Group C ' +
      'exists.',
    whyReads: [['pv.rmpp', 0.11572]],
  },

  a4: {
    see:
      'The rectangle behind the curve is V_oc times I_sc, which is 3.16472 W. No cell reaches it. At the ' +
      'open-circuit corner it passes no current and at the short-circuit corner it holds no voltage. The ' +
      'fill factor is how much of that rectangle the knee leaves, and here it is 0.83478.',
    seeReads: [
      ['pv.rect', 3.16472],
      ['pv.ff', 0.83478],
      ['pv.pmpp', 2.64184],
    ],
    try: [
      {
        say: 'Add 20 mΩ of series resistance. The rectangle is unchanged and the fill factor falls to 0.69314, so the maximum power is 2.19358 W.',
        set: { Rs: 0.02 },
        reads: [
          ['pv.ff', 0.69314],
          ['pv.pmpp', 2.19358],
          ['pv.rect', 3.16472],
        ],
      },
      {
        say: 'Clear that and set the shunt to 1 Ω instead. The fill factor falls to 0.74326, and this time the rectangle shrinks too.',
        set: { Rs: 0, Rsh: 1 },
        reads: [
          ['pv.ff', 0.74326],
          ['pv.rect', 3.14743, 0.002],
        ],
      },
      {
        say: 'Halve the light. The fill factor barely moves, to 0.83129, because both intercepts and the knee move together.',
        set: { Rsh: 10000, G: 500 },
        reads: [['pv.ff', 0.83129]],
      },
    ],
    why:
      'Fill factor separates two questions a datasheet answers together. How much light is there, and how ' +
      'good is the cell? The two intercepts carry the first, because I_sc follows the irradiance and V_oc ' +
      'follows the junction. The fill factor carries the second. A cell with a sharp knee has little series ' +
      'resistance to round it off and a high shunt resistance to keep the top flat, and it fills more of its ' +
      'own rectangle. The identity P_mpp = FF·V_oc·I_sc holds to floating point, because that is what the ' +
      'fill factor is defined to be.',
    whyReads: [[(x) => x.fig.pmpp - x.fig.ff * x.fig.voc * x.fig.isc, 0, 1e-12]],
  },

  a5: {
    see:
      'Series resistance sits between the junction and the terminals, so it drops i·R_s. With it absent the ' +
      'maximum power is 2.64184 W. The two intercepts barely notice it, and the knee is where it lands.',
    seeReads: [['pv.pmpp', 2.64184]],
    try: [
      {
        say: 'Switch to 5 mΩ. V_oc does not move at all, and I_sc falls only to 4.9999975 A, but the maximum power drops to 2.52814 W.',
        set: { Rs: 0.005 },
        reads: [
          ['pv.voc', 0.632944],
          ['pv.isc', 4.9999975],
          ['pv.pmpp', 2.52814],
        ],
      },
      {
        say: 'Go on to 20 mΩ. The maximum falls to 2.19358 W and the voltage at it to 0.468765 V, so the knee has moved a long way left.',
        set: { Rs: 0.02 },
        reads: [
          ['pv.pmpp', 2.19358],
          ['pv.vmpp', 0.468765],
        ],
      },
      {
        say: 'Keep 20 mΩ and read the fill factor: 0.69314, down from 0.83478. That one number carries the whole loss.',
        set: { Rs: 0.02 },
        reads: [
          ['pv.ff', 0.69314],
          [(x, p, again) => again({ Rs: 0 }).fig.ff, 0.83478],
        ],
      },
    ],
    why:
      'Look at where the resistance can matter. At open circuit no current flows, so it drops nothing and ' +
      'V_oc is untouched. At short circuit the current is large but the voltage it needs to divert is the ' +
      'whole junction voltage, so 25.00 mV of drop moves almost nothing. The knee is the one place where ' +
      'the current and the voltage are both large, and that is where a series resistance is paid for. It ' +
      'is the contacts, the fingers on the front of the cell, and the wire to the next cell, which is why ' +
      'array wiring is a design problem rather than an afterthought.',
    whyReads: [[(x, p, again) => again({ Rs: 0.005 }).fig.isc * 0.005, 0.025]],
  },

  a6: {
    see:
      'Shunt resistance is a leakage path straight across the junction, and every real cell has one. At the ' +
      'default 10 kΩ it costs almost nothing: the maximum power is 2.64184 W, against 2.64187 W with the ' +
      'element removed entirely.',
    seeReads: [
      ['pv.pmpp', 2.64184],
      [(x, p, again) => again({ Rsh: 0 }).fig.pmpp, 2.64187],
    ],
    try: [
      {
        say: 'Switch the shunt to 5 Ω. The flat top of the curve tilts, V_oc falls to 0.632286 V, and the maximum power drops to 2.58085 W.',
        set: { Rsh: 5 },
        reads: [
          ['pv.voc', 0.632286],
          ['pv.pmpp', 2.58085],
        ],
      },
      {
        say: 'Read the tilt. The curve near short circuit now slopes by −0.200000 siemens, which is exactly −1/R_sh.',
        set: { Rsh: 5 },
        reads: [['pv.slope', -0.2, 1e-5]],
      },
      {
        say: 'Go on to 1 Ω. V_oc falls to 0.629487 V and the fill factor to 0.74326, so a bad shunt costs what a bad series resistance does.',
        set: { Rsh: 1 },
        reads: [
          ['pv.voc', 0.629487],
          ['pv.ff', 0.74326],
        ],
      },
    ],
    why:
      'The two parasitics fail at opposite ends. Near short circuit the junction carries nothing, so the ' +
      'shunt is the only thing across it, and the curve picks up its conductance as a slope. Near open ' +
      'circuit the shunt steals part of the photocurrent, so the junction needs less voltage to swallow the ' +
      'rest, and V_oc falls. The closed form for V_oc knows nothing about that, which is why it reads ' +
      '0.632944 V while the solve reads 0.629487 V at 1 Ω. The formula is the approximation here, and the ' +
      'circuit is the model.',
    whyReads: [
      ['pv.voc_formula', 0.632944],
      [(x, p, again) => again({ Rsh: 1 }).fig.voc, 0.629487],
    ],
  },

  a7: {
    see:
      'Irradiance moves the two intercepts in completely different ways. Halve the light and the ' +
      'short-circuit current halves exactly, from 5.0000 A. The open-circuit voltage falls by 17.809 mV, ' +
      'which is a fortieth of it.',
    seeReads: [
      ['pv.isc', 5],
      ['pv.halving', 0.017809],
    ],
    try: [
      {
        say: 'Set the light to 500 W/m². I_sc reads 2.5000 A, exactly half, and V_oc reads 0.615135 V.',
        set: { G: 500 },
        reads: [
          ['pv.isc', 2.5],
          ['pv.voc', 0.615135],
        ],
      },
      {
        say: 'Go to 100 W/m², a tenth of full sun. I_sc reads 0.5000 A and V_oc has fallen by 59.162 mV in total.',
        set: { G: 100 },
        reads: [
          ['pv.isc', 0.5],
          [(x, p, again) => again({ G: 1000 }).fig.voc - x.fig.voc, 0.059162],
        ],
      },
      {
        say: 'Compare that with the diode’s own slope, n·V_T·ln 10, which is 59.159 mV per decade of current.',
        set: { G: 100 },
        reads: [['pv.decade', 0.059159]],
      },
    ],
    why:
      'The photocurrent is proportional to the irradiance because every photon that arrives either makes a ' +
      'carrier pair or does not, at a rate that has nothing to do with the terminals. So I_sc follows the ' +
      'light linearly. V_oc is n·V_T·ln(I_ph/I_s + 1), and a logarithm of a linear thing is not linear. ' +
      'Each halving of the light costs n·V_T·ln 2, and each decade costs n·V_T·ln 10. That is why a panel ' +
      'in poor light still reads nearly its full voltage while delivering hardly any current, and why an ' +
      'open-circuit voltmeter is a bad way to tell whether the sun is out.',
    whyReads: [
      ['pv.halving', 0.017809],
      ['pv.decade', 0.059159],
    ],
  },

  a8: {
    see:
      'Temperature moves V_oc down, and the thermal voltage is not the reason. At 25 °C the cell reads ' +
      '0.632944 V open-circuit with V_T at 25.693 mV. Raise the cell and V_T rises with it, and V_oc falls ' +
      'anyway.',
    seeReads: [
      ['pv.voc', 0.632944],
      ['pv.vt', 0.025693],
    ],
    try: [
      {
        say: 'Set the cell to 45 °C. V_T has risen to 27.416 mV and V_oc has fallen to 0.594932 V.',
        set: { Tc: 45 },
        reads: [
          ['pv.vt', 0.027416],
          ['pv.voc', 0.594932],
        ],
      },
      {
        say: 'Go on to 65 °C. V_T reads 29.140 mV, V_oc reads 0.556595 V, and the maximum power has fallen to 2.23075 W.',
        set: { Tc: 65 },
        reads: [
          ['pv.vt', 0.02914],
          ['pv.voc', 0.556595],
          ['pv.pmpp', 2.23075],
        ],
      },
      {
        say: 'Over that span the slope is −1.9087 mV per kelvin, and the maximum power falls 0.389 % of itself for each one.',
        set: { Tc: 65 },
        reads: [
          [(x, p, again) => (x.fig.voc - again({ Tc: 25 }).fig.voc) / 40, -0.0019087],
          [(x, p, again) => pct(x.fig.pmpp - again({ Tc: 25 }).fig.pmpp, again({ Tc: 25 }).fig.pmpp) / 40, -0.389],
        ],
      },
    ],
    why:
      'The saturation current carries the whole effect. Its law is I_s(T) = I_s(T_ref)·(T/T_ref)^(XTI/n) ' +
      'times exp((E_g·q/n·k)(1/T_ref − 1/T)), with silicon’s band gap at 1.12 eV and XTI at 3. That ' +
      'doubles I_s about every five kelvin. Because V_oc is n·V_T·ln(I_ph/I_s + 1), a doubling of I_s costs ' +
      'n·V_T·ln 2, and I_s doubles far faster than V_T grows. The two pull opposite ways and the ' +
      'exponential wins. A panel therefore makes less power on a hot still afternoon than on a cold bright ' +
      'morning at the same irradiance, which surprises everyone once.',
    whyReads: [[(x, p, again) => again({ Tc: 45 }).formulas.is / x.formulas.is, 18.824, 0.01]],
  },

  // ------------------------------------------------- B · strings and shade
  b1: {
    see:
      'Twelve cells in series carry one current and add their voltages. I_sc is unchanged at 5.0000 A and ' +
      'V_oc is 7.59533 V, which is twelve times one cell’s. The maximum power is 31.7021 W, twelve ' +
      'times as well, and the fill factor is the same 0.83478.',
    seeReads: [
      ['pv.isc', 5],
      ['pv.voc', 7.59533],
      ['pv.pmpp', 31.7021],
      ['pv.ff', 0.83478],
    ],
    try: [
      {
        say: 'Open the string view. All twelve junctions sit at the same 0.552926 V, because identical cells carrying one current must.',
        reads: [
          ['cell.0.v', 0.552926],
          ['cell.11.v', 0.552926],
        ],
      },
      {
        say: 'Halve the string to six cells. V_oc halves to 3.79766 V and the maximum power to 15.8510 W, with I_sc untouched.',
        set: { Ns: 6 },
        reads: [
          ['pv.voc', 3.79766],
          ['pv.pmpp', 15.851],
          ['pv.isc', 5],
        ],
      },
      {
        say: 'Go back to twelve and read the resistance at the maximum: 1.3887 Ω, which is 144 times one cell’s 0.11572 Ω.',
        set: { Ns: 12 },
        reads: [
          ['pv.rmpp', 1.3887],
          [(x, p, again) => again({ Ns: 1 }).fig.rmpp, 0.11572],
        ],
      },
    ],
    why:
      'Series connection multiplies the voltage and leaves the current alone, so it multiplies the power ' +
      'and leaves the fill factor alone. The resistance at the maximum goes as the square of the count, ' +
      'because the voltage rose and the current did not. That is the whole reason a module is a string. At ' +
      'one cell’s 0.552926 V a useful power would be an enormous current, and the wire to carry it would ' +
      'cost more than the cells. The price is in the next experiment. One current means the worst cell ' +
      'decides what all of them may deliver.',
    whyReads: [
      ['pv.rmpp', 1.3887],
      [(x, p, again) => again({ Ns: 1 }).fig.rmpp, 0.11572],
      ['cell.0.v', 0.552926],
    ],
  },

  b2: {
    see:
      'Three strings across the same terminals share one voltage and add their currents. V_oc is unchanged ' +
      'at 7.59533 V, I_sc is 15.000 A, and the maximum power is 95.1063 W, three times one string’s.',
    seeReads: [
      ['pv.voc', 7.59533],
      ['pv.isc', 15],
      ['pv.pmpp', 95.1063],
    ],
    try: [
      {
        say: 'Drop to one string. The maximum power is 31.7021 W and the ratio between the two readings is exactly three.',
        set: { Np: 1 },
        reads: [['pv.pmpp', 31.7021]],
      },
      {
        say: 'Back to three strings, and read the resistance at the maximum: 0.462899 Ω, a third of one string’s 1.3887 Ω.',
        set: { Np: 3 },
        reads: [
          ['pv.rmpp', 0.462899],
          [(x, p, again) => again({ Np: 1 }).fig.rmpp, 1.3887],
        ],
      },
      {
        say: 'Halve the light on all of them. The maximum power falls to 46.0221 W and the ratio to one string holds at three.',
        set: { Np: 3, G: 500 },
        reads: [['pv.pmpp', 46.0221]],
      },
    ],
    why:
      'The ratio is exactly three only because the three strings are identical. Each is then held at the ' +
      'voltage it would have chosen anyway, so nothing is being forced anywhere. Give one string less light ' +
      'and that stops being true, and the good strings are pulled off their own maximum by the bad one. ' +
      'The asymmetry between the two connections is worth holding on to. Parallel strings disagree about ' +
      'current and settle it by sharing unevenly. Series cells cannot disagree about current at all, so ' +
      'they settle it in voltage, and one of them can be driven backwards.',
    whyReads: [
      [(x, p, again) => x.fig.pmpp / again({ Np: 1 }).fig.pmpp, 3, 1e-6],
    ],
  },

  b3: {
    see:
      'One cell of twelve is at 300 W/m² and the other eleven are in full sun. The string can no longer ' +
      'carry more than the shaded cell’s photocurrent, so I_sc has fallen to 2.8417 A and the maximum ' +
      'power from 30.9702 W to 10.3057 W. Eleven untouched cells still make their power. They cannot ' +
      'deliver it.',
    seeReads: [
      ['pv.isc', 2.8417],
      ['pv.pmpp', 10.3057],
      [(x, p, again) => again({ Gshade: 1000 }).fig.pmpp, 30.9702],
    ],
    try: [
      {
        say: 'Take the shade off, at 1000 W/m². The maximum power returns to 30.9702 W, so the one shaded cell was costing 66.72 % of it.',
        set: { Gshade: 1000 },
        reads: [
          ['pv.pmpp', 30.9702],
          [(x, p, again) => pct(x.fig.pmpp - again({ Gshade: 300 }).fig.pmpp, x.fig.pmpp), 66.72],
        ],
      },
      {
        say: 'Put the shade back and open the string view. The shaded cell holds −3.67756 V while its eleven neighbours each hold 0.616547 V.',
        set: { Gshade: 300 },
        reads: [
          ['cell.0.v', -3.67756],
          ['cell.1.v', 0.616547],
        ],
      },
      {
        say: 'Read what the fixed load now gets: 6.94005 W, which is 67.34 % of the shaded string’s own maximum and 22.41 % of the clear one’s.',
        set: { Gshade: 300 },
        reads: [
          ['pv.p', 6.94005],
          [(x) => x.share * 100, 67.34],
          [(x, p, again) => pct(x.at.p, again({ Gshade: 1000 }).fig.pmpp), 22.41],
        ],
      },
    ],
    why:
      'A series string has one current. Ask it for more than the shaded cell’s light makes and the ' +
      'difference has to go somewhere, and the only place left is backwards through that cell. Its junction ' +
      'reverses, and the cell stops being a source and becomes a load on the other eleven. That is why the ' +
      'curve now has a step in it rather than a knee. Below the shaded cell’s photocurrent all twelve ' +
      'behave; above it, eleven of them are pushing current through the twelfth. What that costs is the ' +
      'next experiment.',
  },

  b4: {
    see:
      'Something outside is forcing 4.77793 A through the string, which is what the unshaded string would ' +
      'have carried at its maximum. The shaded cell cannot make that, so it is driven to −16.390 V and ' +
      'turns 78.31 W into heat. The terminal has gone to −10.494 V, so the whole string is now a load.',
    seeReads: [
      ['cell.0.v', -16.39],
      [(x) => -x.cells[0].v * x.at.i, 78.31],
      ['pv.v', -10.494],
    ],
    try: [
      {
        say: 'Take the shade off. The forced current is now within reach, the cell returns to 0.535996 V, and the string delivers again.',
        set: { Gshade: 1000 },
        reads: [['cell.0.v', 0.535996]],
      },
      {
        say: 'Put the shade back and switch the bypass diode in. The shaded cell now holds −0.384848 V and the string terminal is back at 5.51111 V.',
        set: { Gshade: 300, bypass: true },
        reads: [
          ['cell.0.v', -0.384848],
          ['pv.v', 5.51111],
        ],
      },
      {
        say: 'Read what the diode is carrying: 3.20096 A, which is the forced current less what the shaded cell’s light makes.',
        set: { bypass: true },
        reads: [['bypass.0.i', 3.20096]],
      },
    ],
    why:
      'The reverse voltage here is the model’s, not a real cell’s. This model has no breakdown, ' +
      'so its only reverse path is the shunt resistance, set to 5 Ω for this group. A real silicon cell ' +
      'avalanches at about fifteen volts the wrong way round and conducts, which caps the voltage and ' +
      'spreads the heat differently. Take the mechanism and the size from this reading, and not the exact ' +
      'volts. The size is the point. Tens of watts in one cell, delivered by its neighbours, is how a ' +
      'shaded module burns a hole in itself. Bypass diodes exist for this and for nothing else.',
  },

  b5: {
    see:
      'A diode across the shaded cell, anode at its bottom, gives the string’s current a way round. ' +
      'The maximum power rises from 10.3057 W to 26.5964 W, which is 158.1 % more, and I_sc is back to ' +
      '4.99297 A. The shaded cell now holds −0.38072 V rather than volts.',
    seeReads: [
      ['pv.pmpp', 26.5964],
      [(x, p, again) => again({ bypass: false }).fig.pmpp, 10.3057],
      [(x, p, again) => pct(x.fig.pmpp, again({ bypass: false }).fig.pmpp) - 100, 158.1],
      ['pv.isc', 4.99297],
      ['cell.0.v', -0.38072],
    ],
    try: [
      {
        say: 'Switch the diode out. The maximum falls back to 10.3057 W and the short-circuit current to 2.8417 A.',
        set: { bypass: false },
        reads: [
          ['pv.pmpp', 10.3057],
          ['pv.isc', 2.8417],
        ],
      },
      {
        say: 'Switch it back in and read what it carries at the fixed load: 2.72579 A at 0.38072 V, which it turns into heat.',
        set: { bypass: true },
        reads: [
          ['bypass.0.i', 2.72579],
          ['bypass.0.v', 0.38072],
        ],
      },
      {
        say: 'Look at the P–V curve. It has two maxima now, 26.5964 W at 5.7072 V and 10.3010 W at 7.0736 V.',
        set: { bypass: true },
        reads: [
          [(x) => Math.max(...x.humps.map((h) => h.p)), 26.5964, 0.01],
          [(x) => Math.min(...x.humps.map((h) => h.p)), 10.301, 0.01],
          [(x) => x.humps.find((h) => h.p > 20).v, 5.7072, 0.005],
          [(x) => x.humps.find((h) => h.p < 20).v, 7.0736, 0.005],
          [(x) => x.humps.length, 2],
        ],
      },
    ],
    why:
      'Above the shaded cell’s photocurrent the diode conducts, the shaded cell is bypassed, and the ' +
      'string is eleven cells instead of twelve. Below it the diode blocks and all twelve are in circuit. ' +
      'Those are two different curves, and the P–V curve of the pair has a maximum on each. That is the ' +
      'trouble a tracker meets: a rule that only walks uphill will stop on whichever hump it started ' +
      'nearest, and the smaller one is a third of the larger. A real module carries one diode per group of ' +
      'cells, so a real curve can have several humps, and finding the tallest is a search rather than a ' +
      'climb.',
  },

  // ------------------------------------------------------------ C · tracking
  c1: {
    see:
      'The load is 1.3887 Ω, which is exactly the resistance at the string’s maximum power point in ' +
      'full sun. So at 1000 W/m² it takes 31.7021 W, all of what is there. Nothing about that survives a ' +
      'change in the light.',
    seeReads: [
      ['pv.p', 31.7021],
      ['pv.pmpp', 31.7021],
    ],
    try: [
      {
        say: 'Halve the light. The same resistor now takes 8.67912 W of the 15.3407 W available, which is 56.58 %.',
        set: { G: 500 },
        reads: [
          ['pv.p', 8.67912],
          ['pv.pmpp', 15.3407],
          [(x) => x.share * 100, 56.58],
        ],
      },
      {
        say: 'Take the light to a fifth. Now it takes 1.38867 W of 5.86679 W, which is 23.67 %, and the load line is far too steep.',
        set: { G: 200 },
        reads: [
          ['pv.p', 1.38867],
          ['pv.pmpp', 5.86679],
          [(x) => x.share * 100, 23.67],
        ],
      },
      {
        say: 'At 200 W/m², set the load to 6.46932 Ω instead. It takes 5.86679 W again, all of what is there, so the resistance was the whole problem.',
        set: { G: 200, R: 6.46932 },
        reads: [['pv.p', 5.86679, 0.002]],
      },
    ],
    why:
      'A resistor sets a straight load line through the origin, and the maximum power point is not on a ' +
      'fixed line. It moves left as the light falls, because V_mpp follows a logarithm while I_mpp follows ' +
      'the light itself. It moves left again as the cell warms. A fixed resistor is therefore right at one ' +
      'condition and wrong at every other, and the further off it is, the more it wastes. What is wanted ' +
      'is a load whose resistance can be changed while the array runs. That is a converter, and Group C ' +
      'ends by using one.',
  },

  c2: {
    see:
      'Perturb and observe is one rule. Move the terminal by one step, measure the power, and reverse if it ' +
      'fell. From 2.000 V with a 200.0 mV step the walk climbs the curve, reverses at step 24, and then ' +
      'oscillates across the maximum for ever.',
    seeReads: [['mppt.reversal', 24]],
    try: [
      {
        say: 'Start the walk at 7.400 V, above the maximum. Its first step upward loses power, so it turns round at once and walks down.',
        set: { v0: 7.4 },
        reads: [['mppt.reversal', 1]],
      },
      {
        say: 'Set the step to 400.0 mV. The walk reaches the peak in 13 steps rather than 24, because each one is twice as far.',
        set: { step: 0.4 },
        reads: [['mppt.reversal', 13]],
      },
      {
        say: 'Set it to 50.00 mV. Now it takes 94 steps, and the tracker is still walking when the light has changed.',
        set: { step: 0.05, steps: 140 },
        reads: [['mppt.reversal', 94]],
      },
    ],
    why:
      'The rule works because the P–V curve rises on one side of the maximum and falls on the other. A step ' +
      'that gains power was in the right direction, so the next one goes the same way. A step that loses ' +
      'power has passed the top, so the next one turns round. Nothing about it needs to know the ' +
      'irradiance, the temperature, or anything else about the array. It needs a voltmeter, an ammeter and ' +
      'a memory of one previous power. That is why it is what most trackers actually run.',
  },

  c3: {
    see:
      'Once the walk is at the top it never stops. With a 200.0 mV step it settles between 6.400 V and ' +
      '6.800 V and its mean power is 31.5358 W, against the 31.7021 W available. That is 99.476 % of what ' +
      'is there, and the missing 0.524 % is the price of the rule.',
    seeReads: [
      ['mppt.settled', 31.5358],
      ['pv.pmpp', 31.7021],
      [(x) => x.share * 100, 99.476],
      [(x) => (1 - x.share) * 100, 0.524],
      [(x) => x.settled.vmin, 6.4],
      [(x) => x.settled.vmax, 6.8],
    ],
    try: [
      {
        say: 'Read the swing: 400.0 mV, which is two steps wide, because the walk crosses the peak and comes back.',
        reads: [['mppt.swing', 0.4]],
      },
      {
        say: 'Halve the step to 100.0 mV. The swing halves to 200.0 mV and the settled power rises to 31.6541 W.',
        set: { step: 0.1 },
        reads: [
          ['mppt.swing', 0.2],
          ['mppt.settled', 31.6541],
        ],
      },
      {
        say: 'Set the step to 500.0 mV. The swing is 1.000 V and the settled power falls to 30.7228 W, which is 96.911 % of the maximum.',
        set: { step: 0.5 },
        reads: [
          ['mppt.swing', 1],
          ['mppt.settled', 30.7228],
          [(x) => x.share * 100, 96.911],
        ],
      },
    ],
    why:
      'The oscillation is not a defect to engineer away. The rule learns which way is uphill by moving and ' +
      'looking, so it has to keep moving, and at the top every move is downhill. What it gives up is the ' +
      'curvature of the peak over one step. Halve the step and the loss falls by about four, because the ' +
      'curve is quadratic near its maximum. That is the trade in one sentence, and the next experiment ' +
      'puts the other half of it on screen. A smaller step tracks a moving sun more slowly.',
  },

  c4: {
    see:
      'The step size buys speed with one hand and accuracy with the other. At 400.0 mV the walk reaches ' +
      'the peak in 13 steps and then settles 5.216 % under it.',
    seeReads: [
      ['mppt.reversal', 13],
      [(x) => (1 - x.share) * 100, 5.216],
    ],
    try: [
      {
        say: 'Halve the step to 200.0 mV. It now takes 24 steps to arrive and gives up only 0.5244 % once there.',
        set: { step: 0.2 },
        reads: [
          ['mppt.reversal', 24],
          [(x) => (1 - x.share) * 100, 0.5244],
        ],
      },
      {
        say: 'Take it to 50.00 mV. Arriving costs 94 steps and the shortfall falls to 0.04123 %, which is a hundredth of the first setting.',
        set: { step: 0.05 },
        reads: [
          ['mppt.reversal', 94],
          [(x) => (1 - x.share) * 100, 0.04123],
        ],
      },
      {
        say: 'Compare the settled powers directly: 30.0486 W at the coarse step and 31.6890 W at the fine one.',
        set: { step: 0.05 },
        reads: [
          ['mppt.settled', 31.689],
          [(x, p, again) => again({ step: 0.4 }).settled.mean, 30.0486],
        ],
      },
    ],
    why:
      'Steps to arrive go as one over the step size, and the loss once there goes as the step size ' +
      'squared. Quarter the step and the walk takes four times as long and loses a sixteenth as much. ' +
      'Neither end is free. A tracker with a coarse step follows a passing cloud and wastes power in ' +
      'steady sun, and one with a fine step is nearly perfect in steady sun and is still walking when the ' +
      'cloud has gone. Real trackers vary the step, taking large ones while the power is changing fast and ' +
      'small ones when it is not.',
  },

  c5: {
    see:
      'An ideal buck in continuous conduction is lossless, so the resistance it shows its source is R/D². ' +
      'At a duty of 60.0 % that is 1.38889 Ω, which is what the string wants, so the array sits at ' +
      '6.63556 V and gives 31.7021 W. The converter delivers 3.98134 V into its load.',
    seeReads: [
      [(x, p) => p.D * 100, 60],
      ['buck.rin', 1.38889],
      ['pv.v', 6.63556],
      ['pv.p', 31.7021],
      ['buck.vout', 3.98134],
    ],
    try: [
      {
        say: 'Set the duty to 40.0 %. The input resistance rises to 3.125 Ω, the array is pulled up to 7.39757 V, and it gives 17.5117 W.',
        set: { D: 0.4 },
        reads: [
          [(x, p) => p.D * 100, 40],
          ['buck.rin', 3.125],
          ['pv.v', 7.39757],
          ['pv.p', 17.5117],
        ],
      },
      {
        say: 'Set it to 80.0 %. The input resistance falls to 781.25 mΩ, the array is dragged down to 3.90620 V, and it gives 19.5307 W.',
        set: { D: 0.8 },
        reads: [
          [(x, p) => p.D * 100, 80],
          ['buck.rin', 0.78125],
          ['pv.v', 3.9062],
          ['pv.p', 19.5307],
        ],
      },
      {
        say: 'Read the two input currents at the default duty. The R/D² model gives 4.777605 A and the switched steady state gives 4.777605 A.',
        reads: [
          ['buck.iinModel', 4.7776046],
          ['buck.iinSwitched', 4.7776046],
          [(x) => x.buck.iinSwitched - x.buck.iinModel, 0, 1e-6],
        ],
      },
    ],
    why:
      'A converter is a resistance knob. Volt-second balance gives V_out = D·V_in, charge balance gives ' +
      'I_out = V_out/R, and losslessness gives I_in = D·I_out, so R_in = R/D². Turn the duty and the array ' +
      'moves along its own curve to wherever that resistance meets it. The tracking duty is therefore ' +
      '√(R·I_mpp/V_mpp), which is 60.0 % here. The two input currents printed above are the check that ' +
      'closes the loop. One comes from the algebra and one from the switched steady state Power Lab solves, ' +
      'and they agree to the steady state’s own residual.',
    whyReads: [
      ['buck.D', 0.600041],
      [(x) => x.duty.D * 100, 60.0041],
    ],
  },

  // ------------------------------------------------------------ D · battery
  d1: {
    see:
      'The cell rests at 3.8400 V, which is its open-circuit voltage at half charge. Draw 1.000 A and the ' +
      'terminal falls to 3.8150 V in no time at all, a step of 25.00 mV. It goes on falling after that, ' +
      'and the shape of the fall is the two RC pairs relaxing.',
    seeReads: [
      ['batt.rest', 3.84],
      ['batt.step', 0.025],
      [(x, p, again) => again({}, 0.001).at.v, 3.815],
    ],
    try: [
      {
        say: 'Put the cursor a millisecond in. The terminal reads 3.8150 V, and the only thing that has acted is R₀.',
        at: 0.001,
        reads: [['batt.v', 3.815]],
      },
      {
        say: 'Move to 30.00 s, which is the first time constant. The terminal reads 3.80113 V.',
        at: 30,
        reads: [['batt.v', 3.80113]],
      },
      {
        say: 'Move to 200.0 s, the second time constant. The terminal reads 3.77370 V, and the settled resistance is 50.00 mΩ.',
        at: 200,
        reads: [
          ['batt.v', 3.7737],
          ['batt.rdc', 0.05],
        ],
      },
    ],
    why:
      'This is Elements F’s ladder with a name on each part. R₀ is the electrolyte and the current ' +
      'collectors, and it acts within nanoseconds, so a current step shows it as a step. The two RC pairs ' +
      'are slower processes at the electrode, and each one adds its own resistance over its own time ' +
      'constant. Together they give the settled resistance of 50.00 mΩ that a datasheet quotes. The reason ' +
      'this matters is not the model’s elegance. It is that a cell measured a millisecond after a step ' +
      'and one measured a minute after report different resistances, and both are correct.',
    whyReads: [['batt.rdc', 0.05]],
  },

  d2: {
    see:
      'The state of charge here is not a bookkeeping variable. It is a capacitor of 10.000 kF, so its ' +
      'charge is the integral of the current by definition. Draw 1.000 A for 1200 s and the cell has given ' +
      'up a sixth of its 7200 coulombs, leaving the state of charge at 0.33333.',
    seeReads: [
      ['batt.cq', 10000],
      ['batt.z', 0.333333],
    ],
    try: [
      {
        say: 'Move the cursor to 600.0 s. Half the charge has gone and the state of charge reads 0.416667, exactly halfway.',
        at: 600,
        reads: [['batt.z', 0.416667]],
      },
      {
        say: 'Double the current to 2.000 A and stop at 600.0 s. The state of charge is 0.333333 again, because it is the product that matters.',
        set: { i: 2 },
        at: 600,
        reads: [['batt.z', 0.333333]],
      },
      {
        say: 'Start from 0.900 instead and read the end of the window. The state of charge is 0.733333, a sixth lower again.',
        set: { z0: 0.9 },
        reads: [['batt.z', 0.733333]],
      },
    ],
    why:
      'The trick is the straight-line fit. Over the band where the open-circuit voltage rises linearly with ' +
      'the state of charge, OCV = V₀ + k·z, and z is charge over capacity, so the open-circuit source and ' +
      'the charge store are one capacitor of Q/k farads. That makes the whole cell a linear circuit, which ' +
      'is why every number in this group is exact rather than stepped. The fit is labelled data and it has ' +
      'a band, from 0.1 to 0.9. Outside it a real cell’s curve turns over at both ends and this one ' +
      'does not, so the panel says when a setting has left it.',
  },

  d3: {
    see:
      'Over 1200 s at 1.000 A the terminal delivers 4478.45 J and the three resistances turn 56.3349 J into ' +
      'heat. That is 1.242 % of what left the cell, and it is the whole of the difference between the ' +
      'charge taken out and the energy received.',
    seeReads: [
      ['batt.out', 4478.45],
      ['batt.heat', 56.3349],
      [(x) => pct(x.heat, x.heat + x.out), 1.242],
    ],
    try: [
      {
        say: 'Compare the settled estimate. The product i²·(R₀+R₁+R₂)·t is 60.00 J, more than the ledger’s 56.3349 J.',
        reads: [
          [(x, p) => p.i * p.i * x.rdc * p.tEnd, 60],
          ['batt.heat', 56.3349],
        ],
      },
      {
        say: 'The ratio is 0.93892, and the shortfall is the first few minutes, while the RC pairs have not yet reached their full resistance.',
        reads: [[(x, p) => x.heat / (p.i * p.i * x.rdc * p.tEnd), 0.93892]],
      },
      {
        say: 'Double the current to 2.000 A. The heat rises to 225.340 J, four times over, because it goes as the square.',
        set: { i: 2 },
        reads: [['batt.heat', 225.34]],
      },
    ],
    why:
      'Heat goes as the square of the current, so a cell worked twice as hard loses four times as much. ' +
      'That is why fast charging is a thermal problem rather than an electrical one. The gap between the ' +
      'ledger and the settled estimate is worth noticing on its own. Any calculation that uses the ' +
      'datasheet resistance for a short pulse overstates the loss, because the slow pairs have not had ' +
      'time to develop their share of it. The ledger here is the integral of i²R over each element, taken ' +
      'on the exact solution, so it does not have that problem.',
  },

  d4: {
    see:
      'Take 2.000 A out for 900.0 s, then put 2.000 A back in for 900.0 s. The state of charge ends where ' +
      'it began, so the two energies differ by the heat and by nothing else. Out is 6579.71 J, in is ' +
      '6910.67 J, and the round trip is 95.211 % efficient.',
    seeReads: [
      ['batt.eOut', 6579.71],
      ['batt.eIn', 6910.67],
      [(x) => x.round.eta * 100, 95.211],
    ],
    try: [
      {
        say: 'Read the two heats: 165.477 J going out and 160.752 J coming back, which sum to 326.229 J.',
        reads: [
          ['batt.heatOut', 165.477],
          ['batt.heatIn', 160.752],
          [(x) => x.round.heatIn + x.round.heatOut, 326.229],
        ],
      },
      {
        say: 'Compare that with the difference between the two energies, 330.955 J. The gap is the store’s own residual, and the ledger shows both.',
        reads: [[(x) => x.round.eIn - x.round.eOut, 330.955]],
      },
      {
        say: 'Halve the current to 1.000 A over the same 900.0 s. The efficiency rises to 97.606 %, because the heat fell fourfold while the energy only halved.',
        set: { i: 1 },
        reads: [[(x) => x.round.eta * 100, 97.6057]],
      },
    ],
    why:
      'Measuring this any other way overstates the loss. Two runs that both start from the same state of ' +
      'charge are not a cycle. The charging run begins lower on the open-circuit curve, so it takes more ' +
      'energy than the discharge gave back, and most of that extra is stored rather than lost. Closing the ' +
      'cycle removes the confusion, because the store ends where it started and cannot be hiding anything. ' +
      'What is left is heat, and heat goes as the square of the current, so the round-trip efficiency is ' +
      'not a property of the cell alone. It is a property of the cell and the rate.',
  },

  d5: {
    see:
      'Charge at 2.000 A from a fifth of full and the terminal climbs. It reaches the 4.100 V limit at ' +
      '1880.01 s, with the state of charge at 0.722225. The charger then holds the terminal there and lets ' +
      'the current fall away.',
    seeReads: [
      ['batt.tSwitch', 1880.01],
      ['batt.zSwitch', 0.722225],
    ],
    try: [
      {
        say: 'Put the cursor at the changeover. The current is still 2.000 A and the terminal is at 4.100 V, so both are continuous across it.',
        at: 1880.01,
        reads: [
          ['batt.i', 2, 0.001],
          ['batt.v', 4.1],
        ],
      },
      {
        say: 'Move to 2180 s, three hundred seconds past the changeover. The current has fallen to 1.03599 A while the terminal is still at 4.100 V.',
        at: 2180,
        reads: [
          ['batt.i', 1.03599],
          ['batt.v', 4.1],
        ],
      },
      {
        say: 'Move to 3680 s. The current is down to 70.2289 mA and the state of charge has reached 0.855615.',
        at: 3680,
        reads: [
          ['batt.i', 0.0702289],
          ['batt.z', 0.855615],
        ],
      },
    ],
    why:
      'The two phases exist for two different reasons. Constant current is the fastest safe way to move ' +
      'charge, and it stops when the terminal reaches a voltage the chemistry should not be pushed past. ' +
      'Constant voltage then finishes the job, and the current falls because the store’s own voltage ' +
      'is climbing towards the limit and the difference across the resistance is shrinking. The long tail ' +
      'is why the last tenth of a charge takes as long as the first half. The changeover instant is found ' +
      'by bisection on the exact solution, so it is a property of the waveform rather than of a sample grid.',
  },

  // ------------------------------------------------------------ E · the day
  e1: {
    see:
      'Three rows of twenty-four numbers drive this group: the irradiance, the cell temperature and the ' +
      'household load, hour by hour. They are labelled data. Nothing computes them. What the array does ' +
      'with them is a solve, and at noon 940 W of light per square metre gives 2476.7 W from thirty ' +
      'modules.',
    seeReads: [
      ['day.12.G', 940],
      ['day.peakPv', 2476.67],
    ],
    try: [
      {
        say: 'Move the cursor to hour 18. The load is at its peak of 2100 W and the array is down to 346.929 W.',
        set: { hour: 18 },
        reads: [
          ['day.peakLoad', 2100],
          ['day.18.pv', 346.929],
        ],
      },
      {
        say: 'Move to hour 6. The array makes 292.512 W against a load of 800.0 W, and the store makes up the rest.',
        set: { hour: 6 },
        reads: [
          ['day.6.pv', 292.512],
          ['day.6.load', 800],
        ],
      },
      {
        say: 'Halve the array to fifteen modules. Noon falls to 1238.34 W, exactly half, because the modules are identical.',
        set: { modules: 15 },
        reads: [['day.12.pv', 1238.34]],
      },
    ],
    why:
      'The line between data and physics has to be visible or the whole group is a guess dressed as a ' +
      'result. These three profiles are a plausible clear spring day and a plausible household, chosen so ' +
      'the lesson can be seen. They are not a measurement and no test treats them as one. Everything ' +
      'downstream of them is exact. Each hour’s array power is a Newton solve at that hour’s own ' +
      'irradiance and temperature, and the ledger that follows is arithmetic on those solves. The hourly ' +
      'step is the other labelled thing. Within an hour every quantity is held.',
  },

  e2: {
    see:
      'Over the day the array makes 19.7944 kilowatt hours and the load asks for 19.1200, all of which is ' +
      'served. Another 3.4329 is curtailed, because the bank was already full. The ledger closes: what came ' +
      'in equals what was served, plus what was stored, plus what was thrown away.',
    seeReads: [
      ['day.eIn', 19.7944],
      ['day.eLoad', 19.12],
      ['day.curtailed', 3.4329],
      ['day.residual', 0, 1e-6],
    ],
    try: [
      {
        say: 'Read the heat in the bank: 0.056002 kilowatt hours, which is a fifth of a percent of what passed through it.',
        reads: [['day.lost', 0.056002]],
      },
      {
        say: 'Read the state of charge at midnight: 0.243441, against the 0.500 it began at. This day does not repeat itself.',
        reads: [['day.zEnd', 0.243441]],
      },
      {
        say: 'Raise the array to forty-five modules. Curtailment rises to 12.7035 and the bank still ends at only 0.301714, so half again as much array buys little.',
        set: { modules: 45 },
        reads: [
          ['day.curtailed', 12.7035],
          ['day.zEnd', 0.301714],
        ],
      },
    ],
    why:
      'Curtailment is the word for energy a system could have had and did not take. It is not a loss in ' +
      'the thermodynamic sense, because nothing was dissipated. The array simply was not asked for it, and ' +
      'a tracker that is not tracking is holding its panels off their maximum on purpose. It is still the ' +
      'largest number in most of these ledgers, and it is the one a designer can do something about. The ' +
      'ledger closing to floating point is the check that the balance is a balance. Every hour’s ' +
      'energy is a power times 3600 seconds, and nothing is rounded away between them.',
  },

  e3: {
    see:
      'The bank is a hundred cells wide, which is 200.0 amp hours at 53.76 V, so it stores 10.7520 ' +
      'kilowatt hours. On this day it meets every hour of the load and still has to throw 3.4329 away at ' +
      'noon. Both of those numbers are the bank’s size rather than the array’s.',
    seeReads: [
      ['day.bankQ', 200],
      ['day.bankV', 53.76],
      ['day.bankE', 10.752],
      ['day.curtailed', 3.4329],
    ],
    try: [
      {
        say: 'Halve the bank to fifty cells. Curtailment doubles to 6.86891 and the day now leaves 4.31292 of the load unserved.',
        set: { bankParallel: 50 },
        reads: [
          ['day.curtailed', 6.86891],
          ['day.unserved', 4.31292],
        ],
      },
      {
        say: 'Double it to two hundred instead. Nothing is curtailed, nothing is unserved, and the bank ends at 0.531360.',
        set: { bankParallel: 200 },
        reads: [
          ['day.curtailed', 0, 1e-6],
          ['day.unserved', 0, 1e-6],
          ['day.zEnd', 0.53136],
        ],
      },
      {
        say: 'At fifty cells, read the share of the load that was met: 77.443 %, so a quarter of the evening went dark.',
        set: { bankParallel: 50 },
        reads: [[(x) => x.served * 100, 77.443]],
      },
    ],
    why:
      'The array in this day already makes more energy than the load asks for. What it does not do is make ' +
      'it at the right time, and the peak of the light is six hours before the peak of the load. The store ' +
      'is what moves energy across those six hours, and its size is what decides how much can move. Too ' +
      'small and the surplus has nowhere to go at noon and nothing is left at dusk, so the same day both ' +
      'curtails and goes dark. That is the microgrid problem in one screen, and no amount of extra array ' +
      'fixes it.',
  },
}
