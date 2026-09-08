import React from 'react'

export const CHIP_CONTEXT = {
  intro: 'An integrated circuit (IC) contains connected devices made together on a semiconductor wafer. A wafer is a thin crystal slice containing many copies of a chip, each called a die.',
  process: 'Lithography patterns a light-sensitive coating. Deposition adds films, etching removes selected material, and doping introduces atoms that change electrical behavior. Repeating these steps builds devices and wiring in layers, not simply grooves carved into silicon.',
  components: 'Transistors use semiconductor regions, insulating films and electrodes. Resistors can use doped regions or resistive films. Capacitors use conductors separated by an insulator. Metal interconnects form the wires, and vertical contacts connect layers.',
  package: 'After testing, the wafer is separated into dies. Packaging connects a die to external pins or pads and helps remove heat. Those connections add resistance, capacitance and inductance that affect real signals.',
  scope: 'A material can be a substrate or an added device layer. A chip can combine several materials. Material choice changes available devices and manufacturing constraints, not the basic circuit laws.',
}

export const CHIP_MATERIALS = [
  { symbol: 'Si', name: 'Silicon',
    benefit: 'The standard platform for dense digital logic, with mature manufacturing and useful insulating oxides.',
    tradeoff: 'Silicon is inefficient at emitting light. Optical sources often need another material.' },
  { symbol: 'SiGe', name: 'Silicon-germanium',
    benefit: 'An alloy often added in layers on silicon. It supports fast bipolar transistors alongside complementary metal-oxide-semiconductor (CMOS) logic in radio and high-speed analog circuits.',
    tradeoff: 'Special layers and device processing add complexity. It complements silicon logic rather than replacing every silicon device.' },
  { symbol: 'InP', name: 'Indium phosphide',
    benefit: 'A compound semiconductor used in high-frequency electronics and optical systems. InP-based material systems support lasers and optical amplifiers.',
    tradeoff: 'Combining it with dense silicon electronics requires extra integration steps. Manufacturing scale, packaging and cost differ from silicon logic.' },
  { symbol: 'SiC / GaN', name: 'Silicon carbide / gallium nitride',
    benefit: 'Wide-bandgap semiconductors need more energy to excite an electron across their band gap. They support strong electric fields and efficient power switching.',
    tradeoff: 'The benefits depend on voltage, switching frequency and thermal design. Device cost and drive requirements must be weighed against system savings.' },
]

export function ChipContext() {
  return <div className="chip-context" data-role="chip-context">
    <h3>From wafer to circuit</h3>
    <p>{CHIP_CONTEXT.intro}</p>
    <details>
      <summary>Fabrication and material choices</summary>
      <p>{CHIP_CONTEXT.process}</p><p>{CHIP_CONTEXT.components}</p><p>{CHIP_CONTEXT.package}</p>
      <dl>{CHIP_MATERIALS.map((material) => <React.Fragment key={material.symbol}>
        <dt>{material.symbol}: {material.name}</dt>
        <dd><p>{material.benefit}</p><p>{material.tradeoff}</p></dd>
      </React.Fragment>)}</dl>
      <p>{CHIP_CONTEXT.scope}</p>
      <p className="chip-sources">Sources: <a href="https://www.asml.com/en/company/stories/2021/semiconductor-manufacturing-process-steps">ASML fabrication</a>,{' '}
        <a href="https://www.ihp-microelectronics.com/fileadmin/user_upload/Broschuere_MPW_IHP.pdf">IHP SiGe</a>,{' '}
        <a href="https://www.imec-int.com/en/articles/heterogeneous-integration-technologies-enable-next-generation-wireless-6g">imec integration</a>,{' '}
        <a href="https://www.photonics.intec.ugent.be/research/topics.asp?ID=73">Ghent optical materials</a>,{' '}
        <a href="https://www.infineon.com/technology/wide-bandgap-semiconductors-sic-gan">Infineon power materials</a>.</p>
    </details>
  </div>
}
