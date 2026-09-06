# From wafer to circuit

Read this after the basic circuit elements and before semiconductor devices, VLSI or digital interfaces.
The in-app version is shared by VLSI and Interfaces through `ChipContext` in `@ee-labs/explain`.

## What a chip is

An integrated circuit (IC) contains many connected devices made together on a wafer, a thin semiconductor crystal slice.
A wafer carries many copies of a circuit. Each individual chip is a die.
Testing and packaging connect each working die to external pads or pins and provide paths for heat to leave.

Fabrication is not just carving grooves into silicon. Lithography patterns a light-sensitive coating, deposition adds films, and etching removes selected material.
Doping introduces atoms that change electrical behavior. Repeated processing builds devices and connections in layers. [ASML fabrication overview](https://www.asml.com/en/company/stories/2021/semiconductor-manufacturing-process-steps)

Transistors combine semiconductor regions, insulating films and electrodes. Resistors can use doped regions or resistive films.
Capacitors use conductors separated by an insulator. Metal interconnects form the wires, with vertical contacts joining layers.
These structures have finite dimensions, so wiring and packaging add resistance, capacitance and inductance beyond the intended circuit elements.

## Why materials differ

The substrate and the active device layers need not be the same material. A single chip or package can combine several materials.
There is no universally best semiconductor. The choice depends on the job, the process and the complete system.

CMOS means complementary metal-oxide-semiconductor. It pairs complementary transistor types, rather than naming a separate wafer material.

| Material | Useful properties and applications | Tradeoffs |
| --- | --- | --- |
| Si: silicon | Dense digital logic, mature manufacturing and useful insulating oxides | Inefficient light emission means optical sources often need another material |
| SiGe: silicon-germanium | An alloy commonly added in layers on silicon, enabling fast bipolar transistors alongside CMOS logic | Additional layers and processing add complexity, rather than replacing all silicon devices |
| InP: indium phosphide | High-frequency electronics and optical material systems that support lasers and amplifiers | Combining it with dense silicon electronics needs extra integration, packaging and manufacturing choices |
| SiC: silicon carbide; GaN: gallium nitride | Wide-bandgap materials support strong electric fields and efficient power switching | Device and drive costs must be balanced against switching, cooling and system savings |

The band gap is the energy separation between the valence and conduction bands. A larger gap is one useful property, not a guarantee of a better circuit.

The comparison draws on [IHP's SiGe processes](https://www.ihp-microelectronics.com/fileadmin/user_upload/Broschuere_MPW_IHP.pdf),
[Ghent's optical-material research](https://www.photonics.intec.ugent.be/research/topics.asp?ID=73),
[imec's integration overview](https://www.imec-int.com/en/articles/heterogeneous-integration-technologies-enable-next-generation-wireless-6g)
and [Infineon's power-material overview](https://www.infineon.com/technology/wide-bandgap-semiconductors-sic-gan).

## Connection to the labs

VLSI studies how transistor resistance and capacitance affect logic delay, loading and sizing.
Interfaces studies how a die communicates through its package pins and board connections.
Their current introductory models represent silicon CMOS-style circuits. The material overview is context, not a material selector for those models.
Devices Lab develops the carrier, junction and transistor physics beyond this introduction.
