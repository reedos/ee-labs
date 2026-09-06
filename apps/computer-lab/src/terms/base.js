// The glossary for Groups A to D: arithmetic, the register file, the
// single-cycle machine and control.
//
// Every term an experiment names is defined here, and `terms.test.js` checks
// that each is introduced where it first does work. A definition that quotes a
// delay quotes one this lab's model card produces.

export const BASE_TERMS = {
  gatedelay: {
    name: 'Gate delay',
    def: 'The unit this lab counts combinational time in. One gate delay is a two-input NAND driving one NAND input, which is 37.65 ps on this model card. A design is quoted in gate delays because that ratio survives a change of process, and the picoseconds do not.',
  },
  ripplecarry: {
    name: 'Ripple-carry adder',
    def: 'An adder built as one full adder a bit, with each carry out wired to the next carry in. Its sum bits are cheap and its top carry is not. The carry crosses two gate delays a bit, so a 32-bit adder takes 64 of them.',
  },
  carry: {
    name: 'Carry',
    def: 'The bit an adder passes from one column to the next. A column generates a carry when both its operand bits are 1, and propagates one when exactly one of them is. The carry chain is the longest path in every adder that does not look ahead.',
  },
  criticalpath: {
    name: 'Critical path',
    def: 'The longest path from where a value is launched to where it is captured. It sets the clock period, because every other path finishes earlier and waits. Shortening anything else changes nothing until it becomes the longest.',
  },
  lookahead: {
    name: 'Carry lookahead',
    def: 'A carry computed from the operands directly rather than passed along the word. Each block of bits reports whether it generates a carry and whether it would propagate one, and a tree of those reports produces the top carry in a few levels. It costs gates and it removes the chain.',
  },
  generate: {
    name: 'Generate',
    def: 'A column generates a carry when both of its operand bits are 1. The carry out is then 1 whatever arrives at the carry in. A block generates when any column in it generates and every column above that one propagates.',
  },
  propagate: {
    name: 'Propagate',
    def: 'A column propagates a carry when exactly one of its operand bits is 1. Its carry out is then whatever its carry in is. A block propagates when every column in it does, which is the term that makes the lookahead tree work.',
  },
  alu: {
    name: 'ALU',
    def: 'The arithmetic and logic unit, which computes one of several functions of two operands. Add, subtract, and, or and set on less than share one adder and one output multiplexer here. The operation select is a control signal the instruction decides.',
  },
  multiplexer: {
    name: 'Multiplexer',
    def: 'A circuit that passes one of its inputs and ignores the rest, chosen by a select signal. It is two gate delays on the data path, an AND and an OR. Every choice a datapath makes is one of these.',
  },
  twoscomplement: {
    name: 'Two’s complement',
    def: 'The way this machine writes a negative number. Inverting every bit and adding one gives the negation, so one adder does subtraction with the second operand inverted and a carry in of one. The top bit is then the sign.',
  },
  shiftandadd: {
    name: 'Shift and add',
    def: 'Multiplication as a loop of additions, one for each bit of the second operand. It needs one adder and one cycle a bit. Doing the same additions at once needs an adder a bit, which is the area against time trade in its simplest form.',
  },
  throughput: {
    name: 'Throughput',
    def: 'How many instructions a machine finishes in a second. It is not the same as latency, which is how long one instruction takes. A pipeline raises the first and lengthens the second.',
  },
  decoder: {
    name: 'Decoder',
    def: 'A circuit that turns an n-bit number into one of 2ⁿ lines, with exactly one line high. A register file needs one to pick the row an address names. Two levels of gates do it for five bits.',
  },
  wordline: {
    name: 'Word line',
    def: 'The wire that selects one row of a memory array. Exactly one word line is high at a time in a register file read. The cells on that row drive their bit lines, and everything else stays quiet.',
  },
  registerfile: {
    name: 'Register file',
    def: 'The machine’s 32 registers, as a small memory with two read ports and one write port. Register 0 reads zero whatever is written to it. A read costs 8 gate delays here and a write costs 4.',
  },
  readport: {
    name: 'Read port',
    def: 'One address in and one word out, available at the same time as every other port. An instruction reads two registers at once, so the file has two of them. Each port is its own decoder and its own output multiplexer.',
  },
  writeport: {
    name: 'Write port',
    def: 'The path that puts a value into a register on a clock edge. This machine writes in the first half of the cycle and reads in the second, so an instruction in decode sees what the instruction in write-back is storing.',
  },
  memory: {
    name: 'Memory',
    def: 'An array of words with an address in and a word out, and a stated access time. This machine has 256 words and an access of 12 gate delays. It is the largest single delay in the model card, and the datapath meets it twice.',
  },
  accesstime: {
    name: 'Access time',
    def: 'How long a memory takes to answer, from the address arriving to the data being valid. It is stated on the model card rather than simulated, because simulating a thousand cells would measure the array and not the machine.',
  },
  opcode: {
    name: 'Opcode',
    def: 'The field of an instruction that says what it is. It sits in the same six bits of every instruction, so the control unit can decode it before anything else about the instruction is known. This machine has 12 of them.',
  },
  field: {
    name: 'Field',
    def: 'A run of bits in an instruction word with a fixed meaning and a fixed place. The register numbers sit in the same bits of every format, so the register file can start reading before the opcode has been decoded.',
  },
  immediate: {
    name: 'Immediate',
    def: 'A constant carried in the instruction itself rather than read from a register. It is 16 bits here, and the sign extender widens it to 32 before the ALU sees it. A load’s offset and an addi’s constant are both immediates.',
  },
  programcounter: {
    name: 'Program counter',
    def: 'The register holding the address of the instruction being fetched. It advances by four each cycle, because an instruction is four bytes. A branch or a jump changes it to something else through a multiplexer.',
  },
  fetch: {
    name: 'Fetch',
    def: 'Reading the instruction at the address the counter holds. It is the first thing every instruction does and it takes a whole memory access. The adder that makes the next address works beside it in the same cycle.',
  },
  word: {
    name: 'Word',
    def: 'Thirty-two bits, which is the width of a register, an instruction and a memory location here. Addresses count bytes, so consecutive words are four apart. A block of a cache holds several of them.',
  },
  datapath: {
    name: 'Datapath',
    def: 'Everything an instruction’s data passes through, drawn as blocks and the wires between them. The control signals steer it and are drawn as their own layer. A single-cycle datapath holds every path the instruction set needs at once.',
  },
  controlsignal: {
    name: 'Control signal',
    def: 'A wire from the control unit that steers a multiplexer or enables a write. There are nine of them here, and each is a function of the opcode alone. Their values are the difference between one instruction and another.',
  },
  writeback: {
    name: 'Write back',
    def: 'The last step of an instruction that produces a value, where the value reaches the register file. A multiplexer picks between the ALU result and the memory’s output. Instructions that produce nothing skip it.',
  },
  clockperiod: {
    name: 'Clock period',
    def: 'The time between two clock edges, which has to fit the longest path plus the flip-flop’s own two times. A single-cycle machine’s period is the longest instruction. A pipelined machine’s is the longest stage.',
  },
  load: {
    name: 'Load',
    def: 'An instruction that reads memory into a register. Its address is a register plus an immediate, so the ALU has to finish before the memory can start. That is why it is the longest path in a single-cycle machine.',
  },
  branch: {
    name: 'Branch',
    def: 'An instruction that changes the program counter when a condition holds. This machine compares two registers by subtracting them and testing for zero. The target is the address after the branch plus the offset in instructions.',
  },
  zero: {
    name: 'Zero',
    def: 'The ALU’s output that reports whether its result was zero. A branch on equal is a subtraction and this bit. It reaches the counter’s multiplexer, which is why a branch is a comparison and a choice.',
  },
  truthtable: {
    name: 'Truth table',
    def: 'Every input a circuit can be given, with the output it produces for each. The control unit’s table has 12 rows, one an opcode. A table with no memory in it can be built from two levels of gates.',
  },
  statemachine: {
    name: 'State machine',
    def: 'A circuit whose outputs depend on which state it is in as well as on its inputs. The multicycle control unit is one, with 5 states. The Logic Lab builds and minimises these, and this lab gives one a job.',
  },
  multicycle: {
    name: 'Multicycle machine',
    def: 'A machine that gives each instruction only the steps it needs, with a clock set by the slowest single block. Its cycles are shorter and an instruction takes several. Whether that wins depends on the mix.',
  },
  state: {
    name: 'State',
    def: 'One step of the multicycle machine, and one circle on the diagram. Fetch and decode are the same for every instruction. What follows depends on the class, so a load visits five states and a branch visits three.',
  },
  cpi: {
    name: 'Cycles an instruction',
    def: 'How many clock cycles a machine spends for each instruction it finishes. It is a count from a run, or arithmetic over a stated mix of instructions and stated hazard rates. Both appear in this lab, and they are different numbers.',
  },
  mix: {
    name: 'Instruction mix',
    def: 'The stated shares of arithmetic, load, store, branch and jump instructions a program is assumed to hold. This lab uses 45, 25, 10, 15 and 5 per cent. Every cycles-an-instruction figure from arithmetic is an average over it.',
  },
}
