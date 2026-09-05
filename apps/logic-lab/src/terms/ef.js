// Groups E and F: the latch, the flip-flop, the register, the counter and the
// machine built from a specification.
//
// House rules, as in `base.js`: two to four sentences, the first saying what
// the thing is. Concrete numbers over abstraction, and no term defined using a
// term the reader has not met.

export const EF_TERMS = {
  ring: {
    name: 'Ring',
    def:
      'Two or more gates arranged so that each one eventually reads its own output. The engine finds one before it ' +
      'does anything else, because a ring has no order to evaluate in and so no truth table. It is not an error. ' +
      'It is the only way a netlist of gates can remember anything.',
  },
  memory: {
    name: 'Memory',
    def:
      'A circuit whose output depends on what happened before and not only on what its inputs are now. ' +
      'Everything in groups A to D has a truth table, and nothing with memory does. ' +
      'The smallest example in this lab is two cross-coupled gates.',
  },
  latch: {
    name: 'Latch',
    def:
      'A ring of two gates with a way to force it into either of its two states. It holds the state it was put in ' +
      'once the forcing input goes away. A latch responds to the level of its inputs, which is what separates it ' +
      'from the flip-flop.',
  },
  setreset: {
    name: 'Set-reset latch',
    def:
      'Two cross-coupled NOR gates with inputs called s and r. Raising s puts the latch in the state where q is 1, ' +
      'and raising r puts it in the other one. Raising both drives both outputs to 0, and the two are then no longer ' +
      'complements, which is why that combination is ruled out.',
  },
  transparent: {
    name: 'Transparent',
    def:
      'What a latch is while its gate signal lets its inputs through. Every change on the input reaches the output ' +
      'two gate delays later, over and over, for as long as the gate signal stays high. ' +
      'While the gate signal is low the same circuit is a ring, and it holds.',
  },
  gatesignal: {
    name: 'Gate signal',
    def:
      'The input that decides whether a latch is transparent or holding. It is a level rather than an edge, so a ' +
      'latch is open for as long as the signal is high. In a clocked design it is usually one phase of the clock.',
  },
  dlatch: {
    name: 'D latch',
    def:
      'A latch with one data input instead of two. An inverter makes the second input from the first, so the two ' +
      'can never be raised together and the ruled-out state cannot be reached. Five gates, and 100 ps from d to q ' +
      'while it is open.',
  },
  flipflop: {
    name: 'Flip-flop',
    def:
      'A circuit that takes the value of its input at one instant of the clock and holds it until the next. ' +
      'Unlike a latch, it is never open and closed at the same time as its neighbours, so a value cannot travel ' +
      'through two of them in one clock period. Every synchronous design in this lab is built from these.',
  },
  masterslave: {
    name: 'Master and slave',
    def:
      'Two latches in a row on opposite phases of the clock, which is one way to build a flip-flop. The first is ' +
      'open while the clock is low and the second while it is high, so they are never open together. ' +
      'This lab builds one from 11 gates and then uses a primitive with the same behaviour.',
  },
  edge: {
    name: 'Clock edge',
    def:
      'The instant the clock changes, and the only instant at which a flip-flop samples. This lab uses the rising ' +
      'edge throughout. Everything that a design does between two edges has to have settled before the next one.',
  },
  setup: {
    name: 'Setup time',
    def:
      'How long the data input has to be still before the clock edge arrives. This lab’s flip-flop asks for 40 ps. ' +
      'It is measured here at the flip-flop’s terminals, as the time since the data input last changed.',
  },
  hold: {
    name: 'Hold time',
    def:
      'How long the data input has to stay still after the clock edge. This lab’s flip-flop asks for 20 ps. ' +
      'A design that fails it cannot be fixed by slowing the clock down, which is the difference between this and ' +
      'the setup time.',
  },
  window: {
    name: 'The window',
    def:
      'The interval around a clock edge in which the data input may not change. It runs from one setup time before ' +
      'the edge to one hold time after it. Its width is the two times added up, less the one instant that belongs ' +
      'to both.',
  },
  violation: {
    name: 'Violation',
    def:
      'A report that the data input moved inside the window. It carries the kind, the flip-flop, the measured time, ' +
      'the required time and the slack between them. It is a statement about the design, not a value the flip-flop ' +
      'took.',
  },
  slack: {
    name: 'Slack',
    def:
      'How much a timing requirement was met by, as a time. Positive slack is margin and negative slack is a ' +
      'failure by that much. Every setup and hold report in this lab carries one.',
  },
  assumption: {
    name: 'The model’s assumption',
    def:
      'What this engine does when it is asked something it cannot state. On a violated setup time it takes the ' +
      'value the input held before the edge and says in the report that it did so. A real flip-flop may sit between ' +
      'the two levels instead, and how long it does is Group H.',
  },
}
