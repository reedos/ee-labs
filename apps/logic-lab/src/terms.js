// Definitions, delivered where the term first does work — the suite's pattern
// (see signal-lab/src/terms.js). Each experiment lists the terms its note leans
// on, and the sidebar offers them folded under the note.
//
// House rules: two to four sentences. The first says what the thing is, and the
// rest say why it matters here. Concrete numbers over abstraction, and no term
// defined using an undefined term.

export const TERMS = {
  signal: {
    name: 'Signal',
    def:
      'A named wire, carrying one of two values at any instant. This lab writes those two as 0 and 1 and gives them no ' +
      'voltage. Every signal has exactly one thing driving it, unless the netlist says it is a shared line.',
  },
  gate: {
    name: 'Gate',
    def:
      'A cell that reads one or more signals and drives one, by a fixed rule. The rule is its truth table and the time it ' +
      'takes is its propagation delay. This library has eight kinds, from the 30 ps inverter to the 90 ps exclusive-or.',
  },
  inverter: {
    name: 'Inverter',
    def:
      'The gate whose output is the complement of its input: 0 becomes 1 and 1 becomes 0. It is the smallest and fastest ' +
      'cell in this library at 30 ps. Drawn as a triangle with a bubble on its point.',
  },
  delay: {
    name: 'Propagation delay',
    def:
      'The time between an input changing and the output that follows it changing. In this engine it is exact and it is a ' +
      'whole number of picoseconds. A path through several gates takes the sum of their delays, and nothing else.',
  },
  event: {
    name: 'Event',
    def:
      'One signal changing value at one instant. A waveform in this engine is the list of its events, complete, rather ' +
      'than a set of samples. Between two events nothing in the netlist changes, which is why the answer is exact.',
  },
  truthtable: {
    name: 'Truth table',
    def:
      'Every combination of input values, with the output each one produces. A circuit with n inputs has 2 to the n rows. ' +
      'The table says what a circuit computes and says nothing about how long it takes.',
  },
  and: {
    name: 'AND',
    def:
      'The gate whose output is 1 only when every input is 1. Written as a product, so a·b, and drawn as a D shape. ' +
      'This library gives a two-input AND 70 ps.',
  },
  or: {
    name: 'OR',
    def:
      'The gate whose output is 1 when any input is 1. Written as a sum, so a + b, and drawn as a curved shield. ' +
      'This library gives a two-input OR 70 ps and a three-input OR 80 ps.',
  },
  nand: {
    name: 'NAND',
    def:
      'An AND with its output complemented: 0 only when every input is 1. It is one stage of transistors where an AND is ' +
      'two, which is why this library gives it 50 ps against the AND’s 70 ps.',
  },
  nor: {
    name: 'NOR',
    def:
      'An OR with its output complemented: 1 only when every input is 0. Like the NAND it is one stage, at 50 ps. ' +
      'Two of them cross-coupled make the latch of the sequential group.',
  },
  universal: {
    name: 'Universal gate',
    def:
      'A gate from which every other function can be built. NAND is one and NOR is the other. A NAND with its inputs tied ' +
      'together is an inverter, and four NAND gates make an exclusive-or at 150 ps against the 90 ps cell.',
  },
  level: {
    name: 'Level',
    def:
      'How many gates deep a signal sits, counting from the inputs. A two-level circuit is one rank of AND gates into one ' +
      'OR, which is what a sum of products is. Each level adds its own delay to every path through it.',
  },
  wire: {
    name: 'Wire',
    def:
      'A connection with a delay and no logic in it. It copies one signal to another after its own time, 10 ps by default. ' +
      'Clock skew is written as a wire, and so is a long interconnect.',
  },
  buffer: {
    name: 'Buffer',
    def:
      'The gate that computes the identity: its output equals its input, 40 ps later. It exists because a signal driving ' +
      'many inputs needs more current than one gate can supply.',
  },
  fanout: {
    name: 'Fan-out',
    def:
      'How many inputs one signal drives. This engine gives every gate the same delay whatever its fan-out, which is a ' +
      'simplification the VLSI Lab removes. Fan-in, the number of inputs one gate takes, does change the delay here.',
  },
  minterm: {
    name: 'Minterm',
    def:
      'One row of the truth table where the output is 1, written as a product naming every input. Row 5 of a three-input ' +
      'table is a·b\'·c. A function is the sum of its minterms, and that sum is its canonical form.',
  },
  netlist: {
    name: 'Netlist',
    def:
      'The circuit as data: its sources, its gates, what each gate reads, and what each drives. Everything this lab draws ' +
      'and measures comes from one netlist, so the picture and the number cannot disagree.',
  },
  identity: {
    name: 'Identity',
    def:
      'A claim that two expressions have the same truth table. Here it is settled by building both and comparing the tables ' +
      'row by row. Two circuits that agree in every row may still cost different gates and different time.',
  },
  absorption: {
    name: 'Absorption',
    def:
      'The identity a + a·b = a. Whatever b is, the second term is 1 only where a already is. It removes a gate and 100 ps ' +
      'from the circuit that writes it out in full.',
  },
  demorgan: {
    name: 'De Morgan',
    def:
      "The pair of identities (a·b)' = a' + b' and (a + b)' = a'·b'. Complement each variable and swap AND for OR. " +
      'It is what makes NAND universal, and it is often what turns a slow circuit into a fast one.',
  },
  complement: {
    name: 'Complement',
    def:
      "The other value: the complement of 0 is 1. Written with a prime, so a' is the complement of a. " +
      'Producing one costs an inverter, and that inverter is where the glitch of Group D comes from.',
  },
  literal: {
    name: 'Literal',
    def:
      "One appearance of a variable in an expression, true or complemented. The term a·b'·c is three literals. " +
      'The literal count is the usual measure of how big a two-level circuit is, and minimisation is the search for the smallest.',
  },
  sop: {
    name: 'Sum of products',
    def:
      'An expression written as a set of AND terms with an OR over them. Every function has one, and every one builds as ' +
      'two levels of gates. It is the form the Karnaugh map and the minimiser both work in.',
  },
  fanin: {
    name: 'Fan-in',
    def:
      'How many inputs one gate takes. This library holds 2 to 4 for AND, OR, NAND and NOR, and a wider term is built as a ' +
      'tree of them. A tree is a second level, and a second level is more delay.',
  },
  kmap: {
    name: 'Karnaugh map',
    def:
      'The truth table drawn as a grid whose neighbouring cells differ in one variable. A block of adjacent 1 cells merges ' +
      'into one term with that variable dropped. It is a picture of the merging the minimiser does by arithmetic.',
  },
  gray: {
    name: 'Gray code',
    def:
      'An ordering of the numbers where each differs from the next in one bit: 00, 01, 11, 10. The Karnaugh map uses it for ' +
      'its rows and columns, and that is what puts the mergeable cells side by side.',
  },
  implicant: {
    name: 'Implicant',
    def:
      'A product term that is 1 only where the function is 1. A single minterm is one, and so is any block of adjacent ' +
      'minterms on the map. An implicant with fewer literals covers more of the function.',
  },
  prime: {
    name: 'Prime implicant',
    def:
      'An implicant that cannot be merged into a larger one. Every minimum cover is made of prime implicants, and Quine ' +
      'and McCluskey’s method finds all of them. This lab’s six-minterm function has 6.',
  },
  cover: {
    name: 'Cover',
    def:
      'A set of implicants that together account for every minterm of the function. The minimum cover is the one with the ' +
      'fewest terms, and among those the fewest literals. Here it is 3 terms and 6 literals.',
  },
  mux: {
    name: 'Multiplexer',
    def:
      'The circuit that passes one of its inputs, chosen by a select signal. Two data inputs need one select bit, and the ' +
      'expression is a·s\' + b·s. Every datapath is full of them.',
  },
  select: {
    name: 'Select',
    def:
      'The input of a multiplexer that says which data input to pass. Its path is longer than the data paths, because it ' +
      'goes through an inverter to enable one branch and not the other.',
  },
  decoder: {
    name: 'Decoder',
    def:
      'The circuit that turns an address into a line: n inputs, 2 to the n outputs, exactly one of them high. It is every ' +
      'minterm of the address built at once, and it is how a memory picks a row.',
  },
  onehot: {
    name: 'One-hot',
    def:
      'A set of signals of which exactly one is 1 at a time. A decoder’s outputs are one-hot by construction. It costs a ' +
      'wire per value where a binary code costs a wire per bit, and it needs no decoding at the far end.',
  },
  halfadder: {
    name: 'Half adder',
    def:
      'Two bits in, a sum and a carry out. The sum is the exclusive-or and the carry is the AND. It is called half because ' +
      'it has nowhere to put a carry coming in.',
  },
  fulladder: {
    name: 'Full adder',
    def:
      'Three bits in, a sum and a carry out, so it can be chained. The number that matters about it is the delay from its ' +
      'carry in to its carry out, 140 ps here, because that is the path a wide adder repeats.',
  },
  xor: {
    name: 'Exclusive-or',
    def:
      'The gate whose output is 1 when an odd number of inputs are 1. For two inputs that is "one or the other, not both". ' +
      'It is the sum bit of an adder, and at 90 ps it is the slowest cell in this library.',
  },
  sum: {
    name: 'Sum bit',
    def:
      'The low bit of the answer when bits are added: 1 when an odd number of the inputs are 1. In a wide adder each sum ' +
      'bit waits for the carry below it, so they do not all arrive at once.',
  },
  carry: {
    name: 'Carry',
    def:
      'The bit that moves to the next column when a sum will not fit. In a ripple adder each stage waits for the carry ' +
      'from the stage below, which is why the delay grows in proportion to the width.',
  },
  generate: {
    name: 'Generate',
    def:
      'The term a·b of a full adder, which makes a carry out whatever the carry in is. It is one AND, so it is ready early, ' +
      'and it is why the carry chain is one AND and one OR a bit rather than more.',
  },
  propagate: {
    name: 'Propagate',
    def:
      'The term that lets a carry in pass through a stage to the carry out. In this adder it is the partial sum a XOR b ' +
      'combined with the carry in. It is the path a carry actually travels.',
  },
  ripple: {
    name: 'Ripple carry',
    def:
      'An adder built by chaining full adders, each carry feeding the next. It is the simplest adder and the slowest, at ' +
      '140 ps a bit here. Carry-lookahead and carry-select adders exist to break the chain.',
  },
  word: {
    name: 'Word',
    def:
      'A set of signals read as one binary number, most significant first. This lab draws a word as one row of the timing ' +
      'diagram with its value written in it, rather than as one row per bit.',
  },
  width: {
    name: 'Width',
    def:
      'How many bits a word carries. Widening an adder adds one full adder per bit and 140 ps to its carry chain, so width ' +
      'and speed trade against each other directly.',
  },
  criticalpath: {
    name: 'Critical path',
    def:
      'The longest path from any start to any end, measured as the sum of the gate delays along it. It is what sets the ' +
      'clock period of a synchronous design. The path list names every gate on it.',
  },
  arrival: {
    name: 'Arrival time',
    def:
      'The latest time at which a signal can still change, counted from when its inputs did. Every net has one, and an ' +
      'output’s arrival is the largest over the paths that reach it.',
  },
  reconvergent: {
    name: 'Reconvergent paths',
    def:
      'Two paths that start at the same signal and end at the same gate. When their lengths differ, that gate sees a ' +
      'combination of inputs the truth table never produces, for as long as the difference lasts.',
  },
  glitch: {
    name: 'Glitch',
    def:
      'A pulse on a signal that settles back where it started. Here the output falls and rises again 30 ps later, and the ' +
      'settled value is the one the truth table asks for. Anything that read the output during the pulse read the wrong value.',
  },
  hazard: {
    name: 'Hazard',
    def:
      'The property of a circuit that lets a glitch happen, as opposed to the glitch itself. A static hazard is one where ' +
      'the output should have held still. It is a property of the gates, not of the function they compute.',
  },
  static1: {
    name: 'Static-1 hazard',
    def:
      'A hazard where the output should stay at 1 and dips to 0 on the way. The static-0 hazard is its mirror. Both come ' +
      'from two paths of unequal length reconverging, and both are removed by covering the transition with a third term.',
  },
  pulse: {
    name: 'Pulse',
    def:
      'A change followed by a change back. Its width is the time between the two. A pulse narrower than a gate’s own delay ' +
      'may or may not pass through it, which is what the two delay models disagree about.',
  },
  consensus: {
    name: 'Consensus term',
    def:
      "The term b·c of the expression a·b + a'·c: the part both branches agree on. On the Karnaugh map it is the loop that " +
      'bridges the other two. Adding it removes the hazard and costs one gate and 10 ps.',
  },
  transport: {
    name: 'Transport delay',
    def:
      'The model where a gate passes a pulse of any width, delayed by its own time. It is what shows a hazard, and it is ' +
      'this lab’s default. It is an exact statement of what it models, not an approximation of the other model.',
  },
  inertial: {
    name: 'Inertial delay',
    def:
      'The model where a gate rejects a pulse shorter than its own delay, because a real output needs time to move. It is ' +
      'also exact. The run reports every pulse it rejected, with the width, rather than dropping one in silence.',
  },
  swallowed: {
    name: 'Swallowed pulse',
    def:
      'A pulse the delay model removed rather than passing on. The run lists each one with its width and the model that ' +
      'removed it, because a pulse dropped in silence is a race the reader cannot see.',
  },
  settle: {
    name: 'Settling',
    def:
      'The interval between an input changing and every signal reaching the value the truth table asks for. During it a ' +
      'circuit can read as any number at all. A synchronous design tolerates that by not looking until it is over.',
  },
}
