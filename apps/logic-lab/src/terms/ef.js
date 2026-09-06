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
  register: {
    name: 'Register',
    def:
      'Several flip-flops on one clock, holding a word. Every bit of it changes at the same instant, one clock-to-Q ' +
      'after the edge. Nothing inside a register can race, because each stage samples what its neighbour held before ' +
      'the edge rather than what it takes after it.',
  },
  shift: {
    name: 'Shift register',
    def:
      'A register whose stages are fed from each other rather than from outside. A word put in at one end appears at ' +
      'the far end one clock per stage later. With no logic between the stages, it is the fastest a design of these ' +
      'flip-flops can be clocked.',
  },
  tmin: {
    name: 'The closing period',
    def:
      'The shortest clock period a design works at. It is the launching flip-flop’s clock-to-Q, plus the longest ' +
      'path of logic, plus the capturing flip-flop’s setup time. With no logic at all it is 120 ps here, which is ' +
      'the floor every other design is measured from.',
  },
  counter: {
    name: 'Counter',
    def:
      'A register whose next value is its present value plus one. Bit 0 changes every clock. Every other bit changes ' +
      'only on the clocks where all the bits below it are 1, which is the same carry the adder of group C computes.',
  },
  toggle: {
    name: 'Toggle',
    def:
      'To take the complement of what is held. A flip-flop toggles when its data input is the complement of its own ' +
      'output, which is one exclusive-or away. That is how each bit of a counter is built.',
  },
  wrap: {
    name: 'Wrap',
    def:
      'What a counter of n bits does after its largest value. It goes back to 0, because the carry out of the top ' +
      'bit has nowhere to go. A 4-bit counter walks 0 to 15 and then starts again.',
  },
  enable: {
    name: 'Enable chain',
    def:
      'The gates that work out which bits of a counter should toggle this clock. Each one is the one before it ANDed ' +
      'with one more bit, so the chain grows by one AND per bit. It is the adder’s carry chain in another shape, and ' +
      'it is what sets the counter’s closing period.',
  },
  statemachine: {
    name: 'State machine',
    def:
      'A design that holds which of a few named states it is in, and moves between them on each clock. What it moves ' +
      'to is a function of the state it is in and what its inputs are. Everything sequential in this lab past the ' +
      'counter is one of these.',
  },
  state: {
    name: 'State',
    def:
      'One of the situations a machine can be in, named rather than numbered. Two states are different when the ' +
      'machine has to do something different from them. The state is held in flip-flops, one per bit of its code.',
  },
  nextstate: {
    name: 'Next-state logic',
    def:
      'The gates that compute what the state will be after the next clock edge. Their inputs are the present state ' +
      'and the machine’s own inputs, and their outputs feed the flip-flops. They are ordinary combinational logic, ' +
      'so groups B to D apply to them unchanged.',
  },
  mealy: {
    name: 'Mealy and Moore',
    def:
      'Two kinds of machine, told apart by what the output reads. A Moore output is a function of the state alone. ' +
      'A Mealy output reads the inputs as well, so it can change between clock edges. Which one a machine is falls ' +
      'out of its own table, row by row, rather than out of what it was called.',
  },
  encoding: {
    name: 'Encoding',
    def:
      'Which bit pattern stands for which state. Three states need two bits, and the choice of which code goes with ' +
      'which state changes how big the logic comes out. This lab numbers them in order and then minimises.',
  },
  statebit: {
    name: 'State bit',
    def:
      'One flip-flop of the register that holds the state. A machine of n states needs at least as many bits as it ' +
      'takes to count them. Each bit has its own next-state equation.',
  },
  dontcare: {
    name: 'Unused code',
    def:
      'A bit pattern the state register can hold but the machine never reaches. Three states in two bits leave one. ' +
      'The minimiser is free to make the logic say anything at all for that row, and it uses that freedom to make ' +
      'the cover smaller.',
  },
  detector: {
    name: 'Sequence detector',
    def:
      'A machine that raises its output on the clock where the last few inputs were a pattern it is looking for. ' +
      'This lab builds the one that looks for 1, 0, 1. It counts overlapping matches, because its state after a ' +
      'match is the state that has just seen a 1.',
  },
}
