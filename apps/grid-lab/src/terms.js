/**
 * Definitions on contact. Every term a lesson leans on is defined here, in a
 * folded panel under the note, which costs nothing to a reader who already
 * knows them. `experiments.test.js` requires every referenced term to be
 * defined and every definition to be referenced.
 *
 * Each definition is three or four sentences at most, prefers a number to an
 * abstraction, and names the experiment where the term is first used.
 */

export const TERMS = {
  // ------------------------------------------------------------ per unit
  perunit: {
    term: 'Per unit',
    def: 'Every quantity divided by a base of its own kind. Pick a base power and a base voltage and the other bases follow. At 100 MVA and 230 kV the impedance base is 529 Ω. The change of variables is exact, so it carries no guard anywhere in this lab.',
  },
  base: {
    term: 'Base quantity',
    def: 'The number a per-unit value is measured against. Two are chosen, the three-phase base power and the line-to-line base voltage. The rest follow as V_b² over S_b for impedance and S_b over √3 V_b for current.',
  },
  apparentpower: {
    term: 'Apparent power',
    def: 'The product of voltage and current without regard to the angle between them, written S and measured in volt-amperes. Real power is S times the power factor. A transformer is rated in apparent power, because its losses follow the current and not the phase.',
  },
  transformer: {
    term: 'Transformer',
    def: 'Two windings on one core. The voltages are in the ratio of the turns and the currents are in the inverse ratio. In per unit the two zones take base voltages in that same ratio, so the ratio divides out and the transformer becomes a series reactance.',
  },
  ratedimpedance: {
    term: 'Rated impedance',
    def: 'A device’s impedance quoted on its own rating rather than the system base. A generator marked 0.20 pu on 90 MVA is 0.222222 pu on 100 MVA. Using the nameplate number unconverted overstates the fault current here by an eighth.',
  },
  powerfactor: {
    term: 'Power factor',
    def: 'Real power over apparent power, which is the cosine of the angle between voltage and current. A load of 100 Ω and 50 Ω of reactance has a power factor of 0.894427. Lagging means the current lags the voltage, and the load takes reactive power.',
  },
  zipload: {
    term: 'ZIP load',
    def: 'A load written as a mix of constant impedance, constant current and constant power. The three take power in proportion to the square of the voltage, to the voltage, and not at all. At 0.90 pu the first two take 81 % and 90 % of what the third takes.',
  },

  // ------------------------------------------------------------ three phase
  linetoline: {
    term: 'Line-to-line voltage',
    def: 'The voltage between two of the three conductors, which is what a nameplate quotes. It is √3 times the line-to-neutral value and leads it by 30°. A 230 kV line has 132.791 kV between a line and the neutral.',
  },
  linetoneutral: {
    term: 'Line-to-neutral voltage',
    def: 'The voltage between one conductor and the star point, which is what a per-phase circuit uses. Dividing the line-to-line value by √3 gives it.',
  },
  balanced: {
    term: 'Balanced set',
    def: 'Three phasors of equal magnitude 120° apart. They add to zero, so a neutral wire carries nothing and can be left out. Everything in a balanced network can be solved on one phase.',
  },
  perphase: {
    term: 'Per-phase circuit',
    def: 'One phase of a balanced three-phase circuit, drawn with the line-to-neutral voltage and one leg of the load. Its answer is multiplied by three for the whole. Every network in this lab past Group B is drawn this way.',
  },
  instantaneouspower: {
    term: 'Instantaneous power',
    def: 'The product of voltage and current at one instant, before any averaging. One phase of an alternating load pulses at twice the supply frequency and goes negative when the power factor is below one. Three balanced phases together do not pulse at all.',
  },
  delta: {
    term: 'Delta connection',
    def: 'Three impedances joined end to end, so each sees the line-to-line voltage. A delta of 300 Ω per leg draws the same line current as a wye of 100 Ω per phase. It has no neutral, so no zero-sequence current can leave it.',
  },
  wye: {
    term: 'Wye connection',
    def: 'Three impedances joined at a common star point, so each sees the line-to-neutral voltage. The star point may be earthed, and whether it is decides the zero-sequence path.',
  },

  // -------------------------------------------------- symmetrical components
  symmetricalcomponents: {
    term: 'Symmetrical components',
    def: 'Any three phasors written as one balanced positive set, one balanced negative set and one zero set. The transform is a change of basis, so it is exact and reversible. It is what makes an unbalanced fault a closed-form problem.',
  },
  positivesequence: {
    term: 'Positive sequence',
    def: 'The balanced set that turns the way the machine turns. In a healthy balanced network it is the only set present, and its network is the ordinary per-phase circuit.',
  },
  negativesequence: {
    term: 'Negative sequence',
    def: 'The balanced set that turns backwards. A motor sees it as a field at twice the supply frequency, and the rotor currents it induces are heat. Its network differs from the positive one only at rotating machines.',
  },
  zerosequence: {
    term: 'Zero sequence',
    def: 'The set in which all three currents are equal and in phase. They add rather than cancel, so a neutral carries three times one of them. Its network is a different circuit, because zero-sequence current needs a return path and only some winding connections give it one.',
  },
  neutral: {
    term: 'Neutral current',
    def: 'The current in the fourth wire, which is the sum of the three phase currents. That sum is exactly three times the zero-sequence current. For the unbalanced set here it is 5.95477 A.',
  },
  unbalancefactor: {
    term: 'Unbalance factor',
    def: 'The negative-sequence current over the positive-sequence current, as a percentage. For the set here it is 16.9272 %. Supply codes limit it, because a motor turns negative sequence into heat.',
  },
  sequencenetwork: {
    term: 'Sequence network',
    def: 'One network per sequence, each carrying the impedance that sequence sees. The positive and negative networks here are 0.45 pu and the zero network is 0.7 pu. A fault is a connection between the three at one bus.',
  },
  grounding: {
    term: 'Neutral grounding',
    def: 'An impedance between a star point and earth. It carries three times the zero-sequence current while the sequence network carries one, so it appears three times over in the zero-sequence network. Grounding through an impedance limits ground-fault current on purpose.',
  },

  // ------------------------------------------------------------ the line
  pimodel: {
    term: 'π model',
    def: 'A line drawn as its whole series impedance in the middle with half its shunt admittance at each end. Every element is one the circuit solver already stamps. The lumping is an approximation, and past 250 km this lab uses the exact hyperbolic form instead.',
  },
  charging: {
    term: 'Line charging',
    def: 'The current a line’s own capacitance draws with nothing connected at the far end. One hundred kilometres of this line has 0.1587 pu of it. On a long line that current raises the far-end voltage above the sending end.',
  },
  surgeimpedance: {
    term: 'Surge impedance',
    def: 'The square root of the line’s inductance over its capacitance, which is 365.148 Ω here. A line carrying V² over that impedance absorbs exactly as much reactive power as it produces. That loading is 144.873 MW at 230 kV.',
  },
  longline: {
    term: 'Long-line correction',
    def: 'The exact hyperbolic form of a line, which replaces the lumped π model when the length makes the lumping visible. At 200 km the two differ by 0.00982 %, and at 800 km by 3.88886 %. The guard switches models at 250 km.',
  },
  ferranti: {
    term: 'Ferranti rise',
    def: 'The rise in voltage at the open far end of a line, caused by its own charging current flowing through its own reactance. At 200 km the far end sits 2.449 % above the sending end. It is why a lightly loaded line is switched out or fitted with a reactor.',
  },
  voltagedrop: {
    term: 'Voltage drop',
    def: 'The fall in magnitude between a sending bus and a receiving one, caused by current through the series reactance. Reactive current makes most of it, which is why the usual estimate uses Q and not P. Here 0.8 + j0.6 pu through 0.1 pu leaves 0.931926 pu.',
  },
  tapchanger: {
    term: 'Tap changer',
    def: 'A switch that moves a transformer’s turns ratio in small steps, usually 0.625 % each. A ratio of 1.06301 restores 1.00 pu at the receiving bus here. It moves the voltage without supplying any reactive power.',
  },
  shuntcompensation: {
    term: 'Shunt compensation',
    def: 'A capacitor bank across a bus, supplying reactive power where it is needed. It cuts the reactive current through the line, so the drop falls rather than being offset. Here 63.2051 Mvar restores 1.00 pu.',
  },

  // ------------------------------------------------------------ power flow
  powerflow: {
    term: 'Power flow',
    def: 'The problem of finding every bus voltage when the injections are scheduled rather than the sources. It is nonlinear, because a constant-power load draws a current that depends on the voltage the solve is looking for.',
  },
  constantpower: {
    term: 'Constant-power load',
    def: 'A load that takes the same real and reactive power whatever its terminal voltage. Its current is the conjugate of the power over the voltage, which is not linear in the voltage. That is what makes the power flow a Newton problem.',
  },
  mismatch: {
    term: 'Mismatch',
    def: 'The difference between the power a bus is scheduled to inject and the power the present guess says it injects. Newton drives it to zero. From a flat start on this network it falls from 1.6 pu to below 10⁻¹² pu in four passes.',
  },
  slackbus: {
    term: 'Slack bus',
    def: 'The bus that holds the angle reference and takes up whatever the rest of the network does not balance. It contributes no equation and no unknown. Its output is the load nobody else supplies plus every watt of loss.',
  },
  pvbus: {
    term: 'PV bus',
    def: 'A bus whose magnitude and real injection are held, usually by a generator with a voltage regulator. It contributes one equation and one unknown. Its reactive output is read out after the solve rather than solved for.',
  },
  pqbus: {
    term: 'PQ bus',
    def: 'A bus whose real and reactive injections are known and whose angle and magnitude are not. It contributes two equations and two unknowns. Every load bus is one.',
  },
  newton: {
    term: 'Newton’s method',
    def: 'Replace each equation by its tangent at a guess, solve that linear system, and repeat. The tangent is exact, so the error squares each pass. Four iterations reach twelve figures on this network.',
  },
  jacobian: {
    term: 'Jacobian',
    def: 'The matrix of derivatives of every injection with respect to every angle and every free magnitude. Each bus contributes its own rows. Every entry is checked against a central finite difference of the injection it differentiates.',
  },
  reactivelimit: {
    term: 'Reactive limit',
    def: 'The most reactive power a generator can make, set by its excitation. Past it the machine cannot hold its terminal voltage. Bus 2 needs 0.407676 pu here, so a limit below that makes it give up its magnitude.',
  },
  region: {
    term: 'Region change',
    def: 'A change in which equations a device contributes, recorded at the iteration it happens on. A PV bus at its reactive limit becomes a PQ bus. It is the same kind of event as a transistor leaving saturation, and it is handled the same way.',
  },
  loss: {
    term: 'Transmission loss',
    def: 'The real power turned into heat in the branch resistances, which is the gap between what is generated and what is consumed. Here it is 0.0181741 pu, or 1.81741 MW. Summing the branch losses and summing the bus injections agree to floating point.',
  },
  nose: {
    term: 'Nose of the P–V curve',
    def: 'The loading past which no voltage lets the network deliver the demanded power. The Jacobian is singular there. On this network the last loading with an answer is 4.25 times the base case.',
  },
  voltagecollapse: {
    term: 'Voltage collapse',
    def: 'What happens when a network is loaded past the nose. There is no operating point to fall to, so the voltage does not settle at a lower value. The pane gives that reason rather than printing a number.',
  },

  // -------------------------------------------------------- the DC power flow
  dcpowerflow: {
    term: 'DC power flow',
    def: 'The linear model that drops branch resistance, pins every magnitude at 1.00 pu and replaces the sine of each angle by the angle. What is left is one solve for every angle at once. It gives no voltage, no reactive flow and no loss.',
  },
  susceptance: {
    term: 'Susceptance matrix',
    def: 'The matrix built from the reciprocals of the branch reactances, written B′. The DC power flow solves B′θ = P once. It is the same shape as the nodal admittance matrix with the resistances taken out.',
  },
  smallangle: {
    term: 'Small-angle step',
    def: 'Replacing the sine of an angle by the angle itself. At the largest branch angle here, 4.75867°, the two differ by 0.115060 %. That is a thirty-second of what the whole linear model costs, so it is not the expensive assumption.',
  },
  guard: {
    term: 'Guard',
    def: 'An applicability check with a concrete threshold, carried by every approximation this suite ships. Crossing it changes what the pane shows. The DC power flow warns past 10° and declines its flow arrows past 30°.',
  },

  // ------------------------------------------------------------ faults
  faultlevel: {
    term: 'Fault level',
    def: 'The apparent power a bolted three-phase fault would deliver at a bus, which is the fault current times the prefault voltage times the base. Here it is 222.222 MVA. Switchgear is rated against it.',
  },
  groundfault: {
    term: 'Ground fault',
    def: 'A fault involving the earth, so zero-sequence current flows. A single line to ground puts the three sequence networks in series, and a double line to ground puts the negative and zero networks in parallel across the positive one.',
  },

  // ------------------------------------------------------------ protection
  overcurrent: {
    term: 'Overcurrent relay',
    def: 'A relay that times out on the current it measures, faster for a bigger current. The IEC very inverse curve is a time dial times 13.5 over the multiple of pickup less one. At four times pickup and a dial of 0.1 it operates in 0.45 s.',
  },
  pickup: {
    term: 'Pickup',
    def: 'The current above which a relay starts timing. Below it the relay never operates. It is set above the largest load the circuit is meant to carry.',
  },
  timedial: {
    term: 'Time dial',
    def: 'A setting that multiplies the whole operating curve. Two relays on the same characteristic keep a fixed ratio of times at every current, which is what makes coordination possible.',
  },
  coordination: {
    term: 'Coordination',
    def: 'Setting relays so the one nearest a fault trips first. The upstream relay waits a margin, usually 0.3 s, to cover the downstream breaker’s opening time and the errors in both measurements.',
  },
  distancerelay: {
    term: 'Distance relay',
    def: 'A relay that divides its voltage by its current, which on a line is proportional to the distance to the fault. It needs no communication with the far end. Its reach is set in ohms.',
  },
  zone: {
    term: 'Zone',
    def: 'A reach and a delay. Zone 1 covers eight tenths of the line and trips at once, short of the whole line because the measurement carries error. Zone 2 covers 120 % and waits, so it backs up the next relay without racing it.',
  },
  apparentimpedance: {
    term: 'Apparent impedance',
    def: 'The impedance a relay measures, which is its own voltage over its own current. On a healthy line it is the load. During a fault it is the impedance to the fault, unless something feeds the fault without passing through the relay.',
  },
  infeed: {
    term: 'Infeed',
    def: 'Current reaching a fault from a source that the relay does not measure. The drop past that point is made by more current than the relay sees, so the relay reads the section as longer. Here an infeed equal to the relay’s own current turns 24 Ω into 36 Ω.',
  },

  // ------------------------------------------------------------ stability
  synchronous: {
    term: 'Synchronous machine',
    def: 'A machine whose rotor turns at exactly the speed of the stator field. Nothing slips. What varies is the angle between the rotor’s flux and the stator’s, and that angle is the machine’s control variable.',
  },
  powerangle: {
    term: 'Power angle',
    def: 'The angle between a machine’s internal voltage and the network’s. The power transferred is the maximum transfer times the sine of it, so the maximum is at 90°. At 1 pu of mechanical power against 2 pu of transfer the machine sits at 30.0000°.',
  },
  transientreactance: {
    term: 'Transient reactance',
    def: 'The reactance a machine is drawn behind during the first cycles after a disturbance, written X_d′. The flux trapped in the rotor windings holds the internal voltage up for that long. The swing equation runs behind it.',
  },
  swingequation: {
    term: 'Swing equation',
    def: 'The rotor’s inertia times its angular acceleration equals the mechanical power less the electrical power. The inertia constant M is twice H over the synchronous electrical speed, which is 0.0212207 pu·s² per radian here.',
  },
  inertiaconstant: {
    term: 'Inertia constant',
    def: 'The stored kinetic energy at synchronous speed divided by the machine’s rating, written H and measured in seconds. Four seconds is a common value for a large turbo generator. A heavier machine swings more slowly.',
  },
  synchronising: {
    term: 'Synchronising coefficient',
    def: 'The slope of the power-angle curve at the operating point, which is the stiffness the rotor swings against. Here it is 1.118034 pu per radian after the fault. The swing frequency is the square root of it over the inertia.',
  },
  equalarea: {
    term: 'Equal-area criterion',
    def: 'The swing equation integrated once, which gives an energy relation with nothing dropped. The rotor turns back if the area it can lose after clearing equals the area it gained while the fault was on. Both areas here are 0.438833 pu·rad.',
  },
  criticalangle: {
    term: 'Critical clearing angle',
    def: 'The largest angle at which a fault may be cleared and still leave the machine in step. It is a closed form, and here it is 70.2924°. The corresponding time is not a closed form.',
  },
  integrator: {
    term: 'Fixed-step RK4',
    def: 'Runge–Kutta of fourth order at a constant step, which is how this lab turns the swing equation into an angle against time. The method and the step are printed on the pane. The step halves until the integrated peak matches the energy relation.',
  },
  firstswing: {
    term: 'First swing',
    def: 'The rotor’s first excursion after a fault is cleared, and the one that decides stability. Cleared at 0.15 s the machine peaks at 89.7763° and turns back. Cleared past the critical time it does not.',
  },

  // ------------------------------------------------------------ dispatch
  dispatch: {
    term: 'Economic dispatch',
    def: 'Splitting a demand between units at the least total cost. With quadratic costs the answer puts every free unit at the same incremental cost. It is exact, and the only numerical step is finding the multiplier that closes the balance.',
  },
  incrementalcost: {
    term: 'Incremental cost',
    def: 'The slope of a unit’s cost curve, which is what one more megawatt from that unit costs. With a quadratic cost it is a straight line in the output. Equalising it across units is what makes a split cheapest.',
  },
  lambda: {
    term: 'Lambda',
    def: 'The Lagrange multiplier on the power balance, which is the common incremental cost of every free unit. Here it is 8.5 dollars a megawatt hour at 800 MW of demand.',
  },
  marginalcost: {
    term: 'Marginal cost',
    def: 'What the next megawatt actually costs, found by solving the whole dispatch again one megawatt higher. Here it is 8.50189 dollars against a multiplier of 8.5 dollars. The gap is a fifth of a cent, because the cost is quadratic.',
  },
}

/** The terms one experiment names, in the order it names them. */
export const termsFor = (exp) => (exp.terms || []).map((key) => ({ key, ...TERMS[key] })).filter((t) => t.term)
