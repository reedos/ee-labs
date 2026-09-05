// Definitions, delivered where the term first does work.
//
// Each experiment lists the terms its note leans on, and the sidebar offers
// them folded under the note. House rules: three or four sentences, the first
// saying what the thing is, concrete numbers over abstraction, and no term
// defined using a term this file does not also define.

export const TERMS = {
  // ------------------------------------------------------------------ Group A
  backemf: {
    name: 'Back-EMF',
    def:
      'The voltage a turning armature makes, e = k ω, opposing the supply that turns it. It is why a motor ' +
      'draws 0.897 A running and 20 A at standstill on the same 24 V. Its constant is the machine constant, ' +
      'measured in volt-seconds per radian.',
  },
  machineconstant: {
    name: 'Machine constant',
    def:
      'One number, k, that gives the back-EMF per unit speed and the torque per unit current. Those are the ' +
      'same number in SI units, 0.06 here, because the coupling neither stores nor loses energy. Weakening ' +
      'the field scales both together.',
  },
  torque: {
    name: 'Torque',
    def:
      'The turning effort at a shaft, in newton-metres. Multiply it by the speed in radians per second and ' +
      'the answer is mechanical power in watts. In this lab a torque is carried through the netlist as a ' +
      'current, because the equation a rotor obeys is the equation a capacitor obeys.',
  },
  shaft: {
    name: 'Shaft',
    def:
      'The mechanical port of a machine, and one node of its netlist. Its voltage is the speed in radians ' +
      'per second and the currents into it are torques. The inertia is a capacitance and the friction a ' +
      'conductance, so the engine solves the rotor without a second solver.',
  },
  inertia: {
    name: 'Inertia',
    def:
      'How much torque it takes to change a shaft speed, in kilogram metres squared. It stores half J omega ' +
      'squared of kinetic energy, which is the rotational form of half C v squared. A flywheel raises it ' +
      'and slows every speed change in proportion.',
  },
  gyrator: {
    name: 'Gyrator',
    def:
      'A pair of dependent sources that turns a voltage into a current and back. The back-EMF and the ' +
      'torque source are one, and when their two constants are equal the pair absorbs and delivers the same ' +
      'power. The power balance of a machine is that equality.',
  },
  state: {
    name: 'State',
    def:
      'A quantity that cannot jump, so its value now plus the inputs from now on decides everything after. ' +
      'A capacitor voltage, an inductor current and a shaft speed are the three in this lab. The state ' +
      'equation is the list of their derivatives.',
  },
  torquespeedline: {
    name: 'Torque–speed line',
    def:
      'What torque a machine makes at each speed in the steady state. For a DC machine it is a straight ' +
      'line from the stall torque down to zero at the no-load speed. Its slope is k squared over the ' +
      'armature resistance, which is the stiffness of the drive.',
  },
  stalltorque: {
    name: 'Stall torque',
    def:
      'The torque a machine makes at zero speed, k V over R. It is 1.2 N·m here, twenty-two times the ' +
      'running torque, and it is reached at the same twenty-two times the current. It is a starting figure ' +
      'and not a rating.',
  },
  noloadspeed: {
    name: 'No-load speed',
    def:
      'The speed at which the back-EMF equals the supply, so no current flows and no torque is made. It is ' +
      'V over k, which is 3820 rev/min here. A real machine settles a little below it, because friction is ' +
      'a load.',
  },
  operatingpoint: {
    name: 'Operating point',
    def:
      'Where the machine line crosses the load line, and so the one speed and torque at which both are ' +
      'satisfied. Everything else on either curve is a place the machine is not. The time solution settles ' +
      'on it, which is how the two pictures are checked against each other.',
  },
  startingcurrent: {
    name: 'Starting current',
    def:
      'The current at standstill, where there is no back-EMF to oppose the supply. It is the supply over ' +
      'the armature resistance, 20 A here against 0.897 A running. A starting resistor or a lower supply ' +
      'voltage brings it down.',
  },
  timeconstant: {
    name: 'Time constant',
    def:
      'How long a first-order quantity takes to cover 63 % of its remaining change. A machine has two, an ' +
      'electrical one of L over R and a mechanical one of J R over k squared. Their ratio decides whether ' +
      'the current settles before the speed moves.',
  },
  phaseplane: {
    name: 'Phase plane',
    def:
      'One state plotted against another, with time as the path rather than an axis. A run-up from ' +
      'standstill is a curve from the origin to the operating point. A corner in it means one state is much ' +
      'faster than the other.',
  },
  fieldweakening: {
    name: 'Field weakening',
    def:
      'Reducing the flux to run a machine above its rated speed. The no-load speed goes as one over the ' +
      'flux and the stall torque goes as the flux, so speed is bought and torque is sold. The current for a ' +
      'given load rises, and heating sets the limit.',
  },

  // ------------------------------------------------------------------ Group B
  idealtransformer: {
    name: 'Ideal transformer',
    def:
      'A two-port that scales voltage by the turns ratio and current by its reciprocal, with no loss and no ' +
      'stored energy. It is a model, and every real transformer is this model with resistances and ' +
      'reactances around it. The lab builds it from dependent sources so that both ratios are exact.',
  },
  turnsratio: {
    name: 'Turns ratio',
    def:
      'The ratio of primary turns to secondary turns, written n. Volts per turn are shared between the ' +
      'windings, so the voltage ratio is n. Ampere-turns cancel, so the current ratio is one over n, and ' +
      'the product of the two is one.',
  },
  reflected: {
    name: 'Reflected impedance',
    def:
      'What a load on the secondary looks like from the primary, which is n squared times its own value. ' +
      'A 6 Ω load behind a 2:1 transformer draws current as a 24 Ω load would. Referring the secondary ' +
      'winding the same way is what lets one series branch stand for two.',
  },
  leakage: {
    name: 'Leakage reactance',
    def:
      'The part of each winding flux that does not link the other winding, as a reactance in series. It ' +
      'carries no power and it drops voltage, so it is what makes the output sag under load. It is also ' +
      'what limits the current into a short.',
  },
  magnetising: {
    name: 'Magnetising branch',
    def:
      'The shunt path that carries the current needed to set up the core flux, drawn as a reactance beside ' +
      'a resistance for the core loss. It draws 0.328 A here against 9.61 A of load current. An open-circuit ' +
      'test reads it directly.',
  },
  opencircuit: {
    name: 'Open-circuit test',
    def:
      'A measurement with the secondary open, so no load current flows and the series branch drops almost ' +
      'nothing. What is left is the magnetising branch, and the wattmeter reads the core loss. It is run at ' +
      'rated voltage, because core loss follows the flux.',
  },
  shortcircuit: {
    name: 'Short-circuit test',
    def:
      'A measurement with the secondary shorted, so the magnetising branch carries almost nothing beside ' +
      'the short. What is left is the series resistance and leakage, and the wattmeter reads the full-load ' +
      'copper loss. It is run at rated current on a reduced voltage.',
  },
  regulation: {
    name: 'Regulation',
    def:
      'How far the output voltage falls from no load to full load, as a fraction of the loaded value. It is ' +
      '5.47 % here on a resistive load and 8.07 % on a lagging one. Lower is better, and it costs copper ' +
      'and iron to get.',
  },
  powerfactor: {
    name: 'Power factor',
    def:
      'Real power over apparent power, which is the cosine of the angle between voltage and current. At 0.8 ' +
      'a load needs a quarter more current than at 1.0 for the same watts. A lagging load draws current ' +
      'behind its voltage, and a leading one ahead of it.',
  },
  efficiency: {
    name: 'Efficiency',
    def:
      'Output power over input power. It is not a single number for a machine, because the losses do not ' +
      'all scale together. Copper loss rises with the square of the load and core loss stands still, so ' +
      'efficiency peaks below full load.',
  },
  copperloss: {
    name: 'Copper loss',
    def:
      'The I squared R heating in the windings, which rises with the square of the load. It is 252 W at ' +
      'full load in this machine and a quarter of that at half load. It is the loss a thermal rating is ' +
      'mostly about.',
  },
  coreloss: {
    name: 'Core loss',
    def:
      'Hysteresis and eddy-current heating in the iron, set by the flux and the frequency. At a fixed ' +
      'supply voltage neither changes with load, so this loss stands still while copper loss climbs. It is ' +
      '116 W in this machine.',
  },
  tellegen: {
    name: 'Tellegen’s theorem',
    def:
      'The sum of v times i over every element of a circuit is zero, whatever the elements are. It follows ' +
      'from the two laws alone. Applied across a transformer or a machine coupling, it is the statement ' +
      'that power in equals power out.',
  },

  // ------------------------------------------------------------------ Group C
  threephase: {
    name: 'Three-phase set',
    def:
      'Three voltages or currents of equal size, 120 degrees apart in time. Their sum is zero at every ' +
      'instant. Fed to three windings 120 degrees apart in space, they make a field that travels rather ' +
      'than one that pulsates.',
  },
  rotatingfield: {
    name: 'Rotating field',
    def:
      'One magnetomotive force that travels around the air gap at constant speed and constant amplitude. ' +
      'Three phases make it, and its amplitude is three halves of one winding acting alone. It is a ' +
      'trigonometric identity rather than an approximation.',
  },
  mmf: {
    name: 'Magnetomotive force',
    def:
      'Ampere-turns, the quantity that drives flux around a magnetic circuit. A winding carrying i amperes ' +
      'with N turns contributes N i, distributed around the gap by where its conductors sit. The three ' +
      'windings add their contributions at every angle.',
  },
  synchronousspeed: {
    name: 'Synchronous speed',
    def:
      'The speed of the rotating field, 120 f over the number of poles in rev/min. Four poles at 50 Hz give ' +
      '1500 rev/min, and two poles give 3000. Every torque in an induction machine is referred to this ' +
      'speed and not to the rotor speed.',
  },
  slip: {
    name: 'Slip',
    def:
      'How far the rotor runs behind the field, as a fraction of synchronous speed. At zero slip no flux ' +
      'cuts the rotor, no current is induced and no torque is made. This machine runs at 2.77 %, which is ' +
      '1458 rev/min against 1500.',
  },
  induction: {
    name: 'Induction machine',
    def:
      'A machine whose rotor carries no supply of its own. The travelling field induces the rotor current, ' +
      'which is why the rotor must run at a different speed from the field. It is the commonest motor there ' +
      'is, because a cage rotor has no brushes and no windings to connect.',
  },
  perphase: {
    name: 'Per-phase circuit',
    def:
      'One phase of a balanced machine drawn as a single-phase circuit, with the other two implied. Every ' +
      'power read from it is multiplied by three. It holds a series stator branch, a shunt magnetising ' +
      'branch, and a rotor branch whose resistance is divided by the slip.',
  },
  airgap: {
    name: 'Air-gap power',
    def:
      'The power that crosses from stator to rotor through the gap, three times I squared times R over s. ' +
      'It is 3190 W here. Divide it by the synchronous speed and the answer is the torque, exactly.',
  },
  rotorcopper: {
    name: 'Rotor copper loss',
    def:
      'The heating in the rotor bars, which is the slip fraction of the air-gap power. The rest, one minus ' +
      'the slip, becomes mechanical. So running at 2.77 % slip wastes 2.77 % of everything that crosses the ' +
      'gap, and the rotor of a high-slip machine runs hot.',
  },
  torquecurve: {
    name: 'Torque curve',
    def:
      'Torque against slip, from standstill at slip one to synchronous speed at slip zero. It rises from ' +
      'the starting torque, peaks at breakdown, then falls steeply to zero. Only the steep part beyond the ' +
      'peak is a stable place to run.',
  },
  breakdown: {
    name: 'Breakdown torque',
    def:
      'The largest torque the machine can make, 76.0 N·m here at a slip of 0.244. Ask for more and the ' +
      'machine slows, which reduces the torque further, and it stalls. It does not contain the rotor ' +
      'resistance, so changing that moves the peak sideways and not up.',
  },
  rotorresistance: {
    name: 'Rotor resistance',
    def:
      'The resistance of the rotor bars, referred to the stator. It sets the slip at which breakdown ' +
      'happens, in proportion, and leaves the height of the peak alone. A wound rotor lets it be changed ' +
      'from outside, which is how such a machine is started.',
  },

  // ------------------------------------------------------------------ Group D
  powerangle: {
    name: 'Power angle',
    def:
      'The angle by which the rotor flux lags the stator flux, written delta. Power follows its sine, so a ' +
      'synchronous machine at 20 degrees carries 7701 W and at 90 degrees carries its maximum. The rotor ' +
      'still turns at exactly synchronous speed.',
  },
  synchronousreactance: {
    name: 'Synchronous reactance',
    def:
      'The reactance between the internal EMF and the terminals of a synchronous machine, written X_s. It ' +
      'is what the current flows through, so it sets both the current and the power for a given angle. It ' +
      'is large, a few per unit, compared with a transformer.',
  },
  excitation: {
    name: 'Excitation',
    def:
      'The field current, and so the size of the internal EMF. Raising it past the terminal voltage makes ' +
      'the machine draw leading current, which supplies reactive power to the system. Lowering it makes the ' +
      'machine draw lagging current instead.',
  },
  pullout: {
    name: 'Pull-out',
    def:
      'The largest power a synchronous machine can carry, at 90 degrees for a round rotor. Past it there is ' +
      'no steady state, and the rotor loses synchronism. The ratio of pull-out to the running power is the ' +
      'stability margin, 2.92 here.',
  },
  reactivepower: {
    name: 'Reactive power',
    def:
      'The part of the apparent power that is borrowed and returned each quarter cycle, in vars. It does no ' +
      'work and it still needs current, and so copper. A synchronous machine can be run to supply it, which ' +
      'is what an over-excited machine does.',
  },
  saliency: {
    name: 'Saliency',
    def:
      'A rotor whose magnetic path differs along the field axis and across it, so X_d and X_q are not ' +
      'equal. The difference adds a second power term that needs no field current. A salient machine pulls ' +
      'out below 90 degrees.',
  },
  reluctancetorque: {
    name: 'Reluctance torque',
    def:
      'Torque that comes from a rotor preferring one alignment to another, with no magnet and no field ' +
      'winding. It follows the sine of twice the angle, so it peaks at 45 degrees. A synchronous reluctance ' +
      'machine is built from this term alone.',
  },
  dq: {
    name: 'dq transform',
    def:
      'A change of coordinates that rides the rotating field, so a balanced three-phase set becomes two ' +
      'numbers that stand still. It is invertible and it loses nothing. The machine equations in this frame ' +
      'are linear at a fixed speed, which is what makes a current loop possible.',
  },
  clarke: {
    name: 'Clarke transform',
    def:
      'The first half of the dq transform, from three phases to two stationary axes plus a zero sequence. ' +
      'It carries no angle. For a balanced set the zero component is zero, which is why two numbers can ' +
      'stand for three.',
  },
  park: {
    name: 'Park transform',
    def:
      'The second half of the dq transform, a rotation of the two stationary axes by the rotor angle. It ' +
      'has no scaling in it. Applied to a balanced set at the field angle, it makes the two components ' +
      'constant in time.',
  },
  powerinvariant: {
    name: 'Power-invariant convention',
    def:
      'The scaling of the dq transform that makes the matrix orthogonal, so v times i is the same number in ' +
      'both frames. The other common choice keeps amplitudes and carries a factor of three halves in every ' +
      'power and torque. Both are exact, and a constant quoted in the wrong one is wrong by that factor.',
  },
  pmsm: {
    name: 'Permanent-magnet machine',
    def:
      'A synchronous machine whose field comes from magnets rather than a winding. Its flux linkage is a ' +
      'constant, 0.08 Wb here, so torque is proportional to the q-axis current. It has no field loss and no ' +
      'field control.',
  },
  foc: {
    name: 'Field-oriented control',
    def:
      'Controlling a machine in the dq frame, holding the d-axis current at zero and commanding torque with ' +
      'the q-axis current. The plant is then two first-order lags, one fast and one slow. The fast one is ' +
      'closed inside the slow one.',
  },
  torqueconstant: {
    name: 'Torque constant',
    def:
      'Newton-metres per amp of q-axis current, 0.36 here. In the amplitude-invariant convention it is ' +
      'three halves times the pole pairs times the magnet flux. In the power-invariant convention the three ' +
      'halves is absent, so the convention travels with the number.',
  },
  plant: {
    name: 'Plant',
    def:
      'What a controller acts on, written as a transfer function. The current loop here is one over L s plus ' +
      'R and the speed loop is one over J s plus B. Both are exact, so they cross to Control Lab with no ' +
      'approximation attached.',
  },

  // ------------------------------------------------------------------ Group E
  strayloss: {
    name: 'Stray load loss',
    def:
      'The losses that no simple model accounts for, taken by convention as a fixed fraction of the output. ' +
      'It is half a per cent here. Naming it as a convention is more useful than pretending the other four ' +
      'terms add up exactly.',
  },
  thermalresistance: {
    name: 'Thermal resistance',
    def:
      'Kelvins of temperature rise per watt of loss, 0.17 here. Multiply it by the total loss and the ' +
      'answer is the steady rise above ambient. It is set by the frame, the fan and the mounting, and it is ' +
      'what a rating really depends on.',
  },
  thermalcapacitance: {
    name: 'Thermal capacitance',
    def:
      'Joules per kelvin of the machine mass, 6000 here. With the thermal resistance it makes a time ' +
      'constant of 17 minutes, so a machine can be overloaded briefly without reaching its final ' +
      'temperature. That is the whole basis of a short-time rating.',
  },
  insulationclass: {
    name: 'Insulation class',
    def:
      'The temperature the winding insulation is rated for, quoted as a letter. Class F is 155 °C. The ' +
      'machine may dissipate whatever loss keeps it under that, which is 676 W here from a 40 °C ambient.',
  },
  saturation: {
    name: 'Saturation',
    def:
      'Iron holding only so much flux, so that past a knee more current buys almost none. It is a curve ' +
      'rather than a law, so this lab offers named models of it and labels every number they produce. With ' +
      'the toggle off, every number in the lab is exact.',
  },
  fluxlinkage: {
    name: 'Flux linkage',
    def:
      'Flux times the turns that link it, in webers. Its rate of change is the voltage across the winding. ' +
      'Divided by the current it is the inductance, which is constant only while the iron is unsaturated.',
  },
}
