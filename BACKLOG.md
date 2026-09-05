# The backlog: what is not built yet, and what it waits for

The director's ledger for the program in `PROGRAM.md`. Every lab in `EE_LABS_MAP.md`
has a row. Every item deferred by an overseer has a line under its lab's heading,
with the dependency that unblocks it. When a dependency is built, the director walks
this file and reopens what it unblocks. Nothing leaves this file by being forgotten.

Status words. **Built** is on the site. **Building** has an overseer and a branch.
**Planned** has a plan file and no overseer yet. **Waiting** has a plan or a map
entry and a named blocker. **Mapped** has a map entry only.

## 1. The ledger

| Lab | Status | Branch | Blocked on | Plan |
| --- | --- | --- | --- | --- |
| Circuit Elements Lab | built, dark | | | `CIRCUIT_ELEMENTS_LAB_PLAN.md` |
| Circuit Lab | built | | | |
| Signal Lab | built | | | |
| Control Lab | built | | | |
| Power Lab | built in part | | Groups D, F to N unassigned | `POWER_LAB_PLAN.md` |
| The two seams and the progression test | building | `lab/seams` | | `CURRICULUM.md` §3, §6 |
| Electronics Lab | building | `lab/electronics-lab` | | `ELECTRONICS_LAB_PLAN.md` |
| Logic Lab | building | `lab/logic-lab` | Electronics D6 for one cross-reference | to write |
| DSP Lab | building | `lab/dsp-lab` | | to write |
| Random Signals Lab | building | `lab/random-lab` | Electronics O1 for one cross-reference | to write |
| Control Lab II | building | `lab/control-lab-ii` | | to write |
| Instruments Lab | building | `lab/instruments-lab` | RF Lab for the network analyser group | to write |
| Fields Lab | building | `lab/fields-lab` | | to write |
| Energy Lab | building | `lab/energy-lab` | Machines Lab for the wind group | to write |
| Machines Lab | building | `lab/machines-lab` | Power Lab F for the drives group | to write |
| Communications Lab | waiting | | Random Signals Lab | to write |
| Information Lab | waiting | | Communications Lab | to write |
| Applied Analog Lab | waiting | | Electronics L, M | to write |
| Analog IC Lab | waiting | | Electronics H to M | to write |
| Mixed-Signal Lab | waiting | | Analog IC Lab, `switched` charge conservation | to write |
| RF Lab | waiting | | Analog IC Lab, Fields Lab's line | to write |
| System Lab | waiting | | RF Lab | to write |
| VLSI Lab | waiting | | Logic Lab, Analog IC Lab | to write |
| Computer Lab | waiting | | Logic Lab | to write |
| Interfaces Lab | waiting | | Logic Lab, Electronics D, Mixed-Signal Lab | to write |
| Grid Lab | waiting | | Machines Lab, Electronics companion Newton | to write |
| Photonics Lab | waiting | | Electronics O, Applied Analog Lab | to write |
| Devices Lab | waiting | | Electronics C | to write |
| Signal Integrity | out of this repo | | | |

## 2. Deferred items, by lab

Each overseer appends here. One line per item: what, why deferred, and the
dependency or decision that reopens it.

### Circuit Elements Lab

- I9 the clamper and I10 the doubler: assigned to the seams overseer.
- H7 "the roots are the poles": assigned to the seams overseer.
- The GBW toggle: superseded by the Electronics Lab's op-amp macro, which Elements
  may import once it lands.

### Circuit Lab

- The impulse-response experiment (`CURRICULUM.md` seam 2): assigned to the seams
  overseer.
- A gain-bandwidth knob on the op-amp circuits: waits for the Electronics macro.

### Power Lab

- Groups D, F to N: no overseer in this program. The Machines Lab's drives group and
  the Energy Lab's inverters wait on F and L.

### Electronics Lab

- Group B lives in Elements as I9 and I10 (Decision 3).
- Groups D to O wait on lane 1's gate, inside the lab's own brief.

## 3. The director's queue

Items that cross labs and land at integration.

- `deploy.yml`: one `cp` line per new dark lab, from each lab's `NEEDS.md`.
- `progression.test.js`: every new lab's ids and counts, from each lab's `NEEDS.md`.
- Shared canvases promoted to `packages/ui` when a second lab claims them
  (`PROGRAM.md` §4).
- The nav fold (`ELECTRONICS_LAB_PLAN.md` Decision 5) in the first release commit
  that makes a sixth lab public.
