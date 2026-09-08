export const PARAMETER_ROLES = {
  ron: 'Driver choice: effective resistance of the conducting output transistor.',
  rpu: 'Design choice: external resistor that charges the released line.',
  cload: 'External load: receiver inputs, package and wiring capacitance combined.',
  vdd: 'Operating condition: supply shared by this driver and receiver model.',
  vt: 'Device property: transistor threshold, not the receiver logic input limit.',
  riseBudget: 'Requirement: maximum allowed 10-90% rise time. It does not change the circuit.',
  loadCurrent: 'External load: steady current used only in the static voltage-drop budget.',
  inductance: 'Interconnect property: shared return inductance in the separate bounce budget.',
  edgeTime: 'Switching condition: current ramp duration in the bounce budget, not the RC waveform.',
  pins: 'Switching activity: number of outputs sharing the return current ramp.',
}

export const FOUNDATIONS = {
  a1: {
    purpose: 'Send a logic level from a chip to another device using a push-pull output.',
    context: 'A pin is an external electrical connection on a chip. A push-pull driver charges the line toward the supply or discharges it toward ground. Its receiver reads that voltage as logic.',
    prediction: 'Doubling load capacitance or on resistance doubles the rise and fall times. The final voltage stays the same for this purely capacitive load.',
    tradeoff: 'Push-pull actively drives both levels for fast edges. Two outputs commanding opposite levels on one wire can conduct excessive current. Stronger drive reduces delay but increases peak charging current.',
    limits: 'The switches have fixed resistance and change instantly. Leakage, protection diodes, simultaneous transistor conduction and transmission-line effects are omitted.',
  },
  a2: {
    purpose: 'Decide when a voltage arriving at a CMOS input can be trusted as a logic low or high.',
    context: 'CMOS uses complementary n-channel and p-channel transistors. A CMOS input receives a signal. It is not a third kind of output driver. The schematic shows the push-pull source and combined load, with receiver limits overlaid on its voltage.',
    prediction: 'More load capacitance delays the threshold crossings without changing VIL or VIH. Changing the device threshold changes those limits, not the RC voltage trace.',
    tradeoff: 'CMOS inputs draw little steady current, but add capacitance and need a defined voltage. A floating or slowly changing input can cause uncertain logic and extra supply current. A Schmitt-trigger input adds hysteresis for slow or noisy signals.',
    limits: 'The input limits come from a matched square-law inverter model, not a part datasheet. The gap is not hysteresis. Input leakage, clamp current and receiver supply current are not simulated.',
  },
  a3: {
    purpose: 'Share a signal wire, such as an interrupt line, using outputs that only pull low or release.',
    context: 'An open-drain output has no active high-side driver. An external pull-up supplies the high level. Several compatible outputs can share the wire: any one can assert low, and all must release for high.',
    prediction: 'Reducing pull-up resistance makes the release rise faster. It also increases the low-state current and raises the low voltage across the conducting output resistance.',
    tradeoff: 'A large pull-up saves low-state current but slows the rising edge. A small pull-up speeds the rise but demands more sink current. Shared devices must meet voltage, current and bus timing ratings.',
    limits: 'Only one sink is drawn. The model omits leakage and protection paths. Release starts from zero here. A repeated release starts at the previous divider voltage. A different pull-up supply is not modeled.',
  },
  a4: {
    purpose: 'Choose a driver and allowable load that meet a receiving system\'s rise-time requirement.',
    context: 'Wiring and each receiver add capacitance to the output pin. The driver must move that charge before the next useful logic decision. The rise budget is a requirement, not a component.',
    prediction: 'Doubling capacitance doubles rise time. Doubling the allowed rise budget doubles the capacitance limit, but leaves the actual voltage waveform unchanged.',
    tradeoff: 'Fewer receivers or shorter wiring reduce the load. A lower-resistance driver supports more load, at the cost of larger peak current and potentially more noise. The fastest edge is not always needed.',
    limits: 'The sweep varies lumped capacitance with fixed driver resistance. It excludes wire propagation delay, receiver setup time and signal reflections. Passing this rise budget alone does not certify a link.',
  },
  a5: {
    purpose: 'Estimate whether shared return inductance can consume the voltage margin of a digital interface.',
    context: 'Several outputs can change current through the same package or board return. The resulting inductive voltage shifts the local ground. A receiver may then see less margin between the signal and its input limit.',
    prediction: 'Doubling current ramp time halves the estimated bounce. More switching pins or return inductance increase it. Static load current changes the DC margins, not the separate RC waveform.',
    tradeoff: 'Slower current edges and lower return inductance reduce bounce. Reducing simultaneous transitions also reduces bounce. Lower on resistance improves static output levels but increases the assumed current step in this budget.',
    limits: 'This is a lumped screening budget, not a package waveform simulation. Each pin ramps by VDD divided by on resistance. Ringing, mutual coupling and actual transistor current limiting are omitted.',
  },
}

export function signalStory(id, direction) {
  const rising = direction === 'rise'
  const input = id === 'a3'
    ? rising ? 'At t = 0, the output command releases the pull-down switch.' : 'At t = 0, the output command closes the pull-down switch.'
    : `At t = 0, a logic command selects the ${rising ? 'high-side' : 'low-side'} output switch.`
  const output = rising
    ? 'The pin voltage rises from zero toward VDD. The receiver is low below VIL and high above VIH. Between them its logic is undefined.'
    : `The pin voltage falls from VDD toward ${id === 'a3' ? 'the pull-up/on-resistance divider voltage' : 'ground'}. The receiver becomes low at or below VIL.`
  return { input, output }
}
