// The glossary for Groups E to G: pipelining, the memory hierarchy, and the
// machine's edges.

export const PIPE_TERMS = {
  pipeline: {
    name: 'Pipeline',
    def: 'A machine cut into stages with registers between them, so several instructions are in it at once. Each stage works on a different instruction in the same cycle. The clock then only has to fit the slowest stage.',
  },
  stage: {
    name: 'Stage',
    def: 'One step of the pipeline, with its own logic and its own registers. This machine has five: fetch, decode, execute, memory and write back. An instruction visits all five whether it needs them or not.',
  },
  latency: {
    name: 'Latency',
    def: 'How long one instruction takes from start to finish. A pipeline makes it longer, because the instruction now waits through five whole periods. Throughput is the number that improves.',
  },
  pipelineregister: {
    name: 'Pipeline register',
    def: 'The flip-flops between two stages, holding everything the next stage needs. They cost a clock-to-Q and a setup time on every cycle, which is 82.86 ps here. Their outputs are also where forwarding takes its operands from.',
  },
  setuptime: {
    name: 'Setup time',
    def: 'How long a flip-flop’s input has to be still before the clock edge. It is 30.13 ps on this model card. It is charged to every clock period, whatever the logic in front of it does.',
  },
  clocktoq: {
    name: 'Clock to Q',
    def: 'How long a flip-flop takes to put its new value out after the clock edge. It is 52.73 ps here. Together with the setup time it is the overhead a pipeline register adds to every cycle.',
  },
  datahazard: {
    name: 'Data hazard',
    def: 'An instruction needing a value that an instruction ahead of it has not written yet. The pipeline either waits for it or forwards it from wherever it already exists. Nothing about the answer changes, only when it arrives.',
  },
  forwarding: {
    name: 'Forwarding',
    def: 'Taking an operand from a pipeline register rather than from the register file. The value exists two stages before it reaches the file, and a multiplexer in front of the ALU picks it up. It removes every data hazard but the load-use one.',
  },
  stall: {
    name: 'Stall',
    def: 'A cycle the hazard unit spends waiting, by holding the front of the pipeline and inserting a bubble. It shows in the schedule as a repeated stage. Each one is a cycle in which nothing retires.',
  },
  loaduse: {
    name: 'Load-use hazard',
    def: 'A load followed by an instruction that uses what it loaded. The value leaves memory one stage after the ALU wanted it, so no forwarding path can reach backwards in time. One bubble is unavoidable.',
  },
  bubble: {
    name: 'Bubble',
    def: 'An empty slot moving through the pipeline where an instruction would have been. It comes from a stall or from a redirect that threw work away. Counting bubbles by cause is how the cycles of a run are accounted for.',
  },
  controlhazard: {
    name: 'Control hazard',
    def: 'Not knowing which instruction to fetch next until a branch has been decided. The machine fetches something and throws it away when it guessed wrong. Deciding earlier or guessing better are the two answers.',
  },
  flush: {
    name: 'Flush',
    def: 'Throwing away the instructions fetched on a path the machine turned out not to take. Resolved in execute, a taken branch flushes two. Resolved in decode it flushes one, and the comparison then needs its operands earlier.',
  },
  predictor: {
    name: 'Branch predictor',
    def: 'A small memory of what branches did before, used to guess what the next one will do. A wrong guess costs the same flush the machine would have paid anyway. A right one costs nothing.',
  },
  history: {
    name: 'History',
    def: 'The record of recent branch outcomes a correlating predictor indexes with. Three bits of it separate the four positions of a four-iteration loop, so that loop becomes predictable. An eight-iteration loop does not fit in three bits.',
  },
  saturatingcounter: {
    name: 'Saturating counter',
    def: 'A two-bit predictor that has to be wrong twice before it changes its mind. It costs a loop one misprediction a pass rather than two. The extra bit is the whole difference.',
  },
  cache: {
    name: 'Cache',
    def: 'A small fast memory holding blocks of a large slow one. An address says where to look through its index, and a stored tag says whether the block found there is the one asked for. Everything about it is counting.',
  },
  tag: {
    name: 'Tag',
    def: 'The part of an address stored beside a cached block, so the cache can tell which of the many blocks with that index it holds. It is whatever is left after the index and the offset.',
  },
  index: {
    name: 'Index',
    def: 'The part of an address that picks the set. It is taken from the low bits above the offset, so neighbouring blocks land in different sets. Two blocks with the same index cannot both sit in a direct-mapped cache.',
  },
  offset: {
    name: 'Offset',
    def: 'The part of an address that picks the byte inside a block. Its width is the block size in bits. It plays no part in whether a reference hits.',
  },
  hitrate: {
    name: 'Hit rate',
    def: 'The share of references a cache answered from what it already held. It is a count over one trace, and it is exact for that trace. It is not a prediction about any other program, which is why every rate here names its trace.',
  },
  compulsory: {
    name: 'Compulsory miss',
    def: 'The first reference to a block, which no cache can hold in advance. Its count is the number of distinct blocks a trace touches. It is the same in every configuration of the same block size.',
  },
  conflict: {
    name: 'Conflict miss',
    def: 'A miss that happened because two blocks wanted the same set, and that a fully associative cache of the same size would not have taken. Associativity is what removes them.',
  },
  trace: {
    name: 'Trace',
    def: 'The list of addresses a program asked for, in the order it asked. Every cache number in this lab is counted over one of these, and the trace view sits beside the number. A rate without a trace is not a claim this lab makes.',
  },
  associativity: {
    name: 'Associativity',
    def: 'How many places in the cache a block may sit. One is direct mapped, and every block has exactly one line it may use. More ways means fewer conflicts, more comparators, and a slower hit.',
  },
  way: {
    name: 'Way',
    def: 'One of the places a set holds a block. A two-way cache has two lines a set and two tag comparators. Which way a miss replaces is what the replacement policy decides.',
  },
  thrash: {
    name: 'Thrashing',
    def: 'Two blocks taking turns in one set, each evicting the other before it is used again. The hit rate falls to zero however small the working set is. A second way ends it outright.',
  },
  blocksize: {
    name: 'Block size',
    def: 'How many bytes a cache moves at a time. A larger block brings neighbours in with a miss, which helps a program that reads in address order. It also leaves fewer blocks in a cache of the same size.',
  },
  spatiallocality: {
    name: 'Spatial locality',
    def: 'A program using addresses near the ones it has just used. A sequential walk has it completely, so a block of n words costs one miss and gives n − 1 hits. Block size is the knob that trades on it.',
  },
  penalty: {
    name: 'Miss penalty',
    def: 'The cycles a miss costs beyond the hit. It is 100 cycles at the default here, which is far larger than the hit, so the miss rate decides the average access time almost by itself.',
  },
  secondlevel: {
    name: 'Second level',
    def: 'A larger cache behind the first one, so a miss reaches it rather than main memory. Its miss rate is local, meaning the share of the accesses that reach it. It turns one large penalty into a small one and a rarer large one.',
  },
  virtualmemory: {
    name: 'Virtual memory',
    def: 'The addresses a program uses, which are translated into the addresses the memory uses. The translation is by page, and a table holds one entry a page. This lab goes as far as that table and its buffer.',
  },
  page: {
    name: 'Page',
    def: 'The unit virtual memory translates, 4096 bytes by default. The low bits of an address are the offset inside it and never change. The high bits are the page number the table translates.',
  },
  pagetable: {
    name: 'Page table',
    def: 'One entry for every page of the address space. With 4096-byte pages and four-byte entries it is 4 MB a process, which is why real machines build it in levels. This lab quotes the flat size and stops there.',
  },
  translationbuffer: {
    name: 'Translation buffer',
    def: 'A cache of recent translations, so the table is not read on every access. Its reach is the entries it holds times the page size. A program that stays inside that reach rarely pays for a walk.',
  },
  bus: {
    name: 'Bus',
    def: 'The wires between the machine and everything outside it, shared between the devices on them. A transfer is an address phase and then a data phase. The address phase is a fixed cost a burst pays once.',
  },
  burst: {
    name: 'Burst',
    def: 'One address followed by several words of data. It fetches a cache line in fewer cycles than the same words fetched separately, because it pays for one address rather than four.',
  },
  addressphase: {
    name: 'Address phase',
    def: 'The cycle in which a transfer says which words it wants. It carries no data. Every transfer pays it, which is why a line fetched a word at a time spends half its cycles saying where.',
  },
  interrupt: {
    name: 'Interrupt',
    def: 'A device asking the machine to stop what it is doing and run a handler. The pipeline is emptied, the registers are saved and a vector is fetched. Those cycles are the latency a waiting device sees.',
  },
  amdahl: {
    name: 'Amdahl’s law',
    def: 'The speed-up of a whole machine from a speed-up of one part of it. It is one over the share that did not change plus the share that did, divided by how much faster that part became. It bounds every improvement a machine can be given.',
  },
  speedup: {
    name: 'Speed-up',
    def: 'How much faster one machine is than another, as a ratio of times. A part made three times faster does not make the machine three times faster unless it was all of the time.',
  },
  bound: {
    name: 'Bound',
    def: 'What an improvement gives when the part it touches takes no time at all. It is one over the share that did not change. Nothing beyond that is available however much effort the part receives.',
  },
  profile: {
    name: 'Profile',
    def: 'The stated shares of time the parts of a machine take. This lab states 20 per cent for the adder and 35 per cent for memory, and computes the branch penalty’s share from the cycles-an-instruction arithmetic.',
  },
}
