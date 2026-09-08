import {solveDC} from '@ee-labs/network'
import {n} from './derivationMath.js'

const step = (title, text, ...latex) => ({title, text, latex: latex.map(line => `&${line}`)})
const check = (label, predicted, measured, unit) => ({label, predicted, measured, unit, tol: 1e-8, abs: 1e-10})
const displayLabel = label => label.replace(/\d/g, digit => '₀₁₂₃₄₅₆₇₈₉'[Number(digit)]).replaceAll('RL', 'R_L')
const R = (key, value, label = key) => ({key, label: displayLabel(label), default: value, unit: 'Ω', min: 100, max: 10000, scale: 'log'})
const V = (key, value) => ({key, label: displayLabel(key), default: value, unit: 'V', min: -20, max: 20, scale: 'linear'})
const el = (type, id, a, b, value) => ({type, id, nodes: [a, b], value})

/** Independent algebra and separately solved equivalent networks. */
export function methodStudy(id, p, x) {
  if (id === 'd7' || id === 'd8') {
    const norton = id === 'd8'
    const resistance = norton ? p.R1 * p.R2 / (p.R1 + p.R2) : p.R1
    const voltage = norton ? p.V1 * p.R2 / (p.R1 + p.R2) : p.V1
    const current = voltage / resistance
    const load = voltage * p.RL / (resistance + p.RL)
    const equivalent = solveDC({elements: [el('I', 'I1', 'gnd', 'A', current), el('R', 'RN', 'A', 'gnd', resistance), el('R', 'RL', 'A', 'gnd', p.RL)]})
    return {
      title: norton ? 'Construct Norton and Thévenin from the same port' : 'Transform a source without changing its load',
      intro: 'The port is node A relative to ground. Load current is positive from A through RL to ground. An equivalent preserves the voltage and current at this port for any connected load.',
      steps: [
        step('Identify the network and the load', 'RL is the external load. Remove only RL when finding the equivalent. V1 and the remaining resistors belong to the source network.', String.raw`v_L=v_A,\qquad i_L=\frac{v_A}{R_L}`),
        ...(norton ? [
          step('Open the port to find the Thévenin voltage', 'With RL removed, R1 and R2 form a divider. The open-circuit voltage is the voltage at A, not the full source voltage.', String.raw`V_{\mathrm{Th}}=V_1\frac{R_2}{R_1+R_2}=(${n(p.V1)})\frac{${n(p.R2)}}{${n(p.R1)}+${n(p.R2)}}=${n(voltage)}\,\mathrm V`),
          step('Find the resistance seen into the port', 'Set the independent voltage source to zero, replacing it with a wire. R1 and R2 now share both terminals, so they are in parallel. A dependent source, if present, would stay active and require a test source.', String.raw`R_{\mathrm{Th}}=R_N=R_1\parallel R_2=\frac{R_1R_2}{R_1+R_2}=${n(resistance)}\,\Omega`),
        ] : [step('Write the terminal equation', 'The series resistor drops iL R1. KVL gives a straight-line relation between port voltage and load current. The Thévenin voltage is V1, and its series resistance is R1. This entire relation must survive the transformation.', String.raw`V_{\mathrm{Th}}=V_1,\qquad R_N=R_{\mathrm{Th}}=R_1`, String.raw`v_A=V_1-i_LR_1=(${n(p.V1)})-i_L(${n(p.R1)})`)]),
        step('Find the Norton current and its direction', 'The Norton source injects current from ground into A. Shorting A to ground sends this source current into the short. A negative result means the actual direction reverses.', String.raw`I_N=\frac{V_{\mathrm{Th}}}{R_N}=\frac{${n(voltage)}}{${n(resistance)}}=${n(current)}\,\mathrm A`),
        step('Connect the load and apply KCL', 'The source current divides between the Norton resistance and the load. Multiplying KCL by RN recovers the original terminal equation.', String.raw`I_N=\frac{v_A}{R_N}+\frac{v_A}{R_L}`, String.raw`v_A=I_N(R_N\parallel R_L)=V_{\mathrm{Th}}\frac{R_L}{R_N+R_L}=${n(load)}\,\mathrm V`),
        step('Recover load current and check the original circuit', 'Solve the original circuit and the Norton circuit independently. Both must give the same load voltage and current, including their signs.', String.raw`i_L=\frac{${n(load)}}{${n(p.RL)}}=${n(load / p.RL)}\,\mathrm A`, String.raw`v_{A,\mathrm{original}}=${n(x.sol.v.A)},\qquad v_{A,\mathrm{Norton}}=${n(equivalent.v.A)}\,\mathrm V`),
      ],
      advantage: 'Useful when one load changes repeatedly, or when converting to a current source makes nodal equations shorter.',
      limitation: 'Only terminal behavior is preserved. Internal resistor and source powers can differ. A source transformation needs a finite series or parallel resistance; it does not transform an isolated ideal source.',
      checks: [check('original load voltage', load, x.sol.v.A, 'V'), check('Norton load voltage', load, equivalent.v.A, 'V'), check('load current', load / p.RL, x.sol.i.RL, 'A')],
      practice: {prompt: `Keep this source network, but replace the load by ${n(2 * p.RL)} Ω. Calculate the new load voltage in volts before changing the knob.`, target: voltage * 2 * p.RL / (resistance + 2 * p.RL), unit: 'V', hint: 'Use VTh × RL / (RN + RL), with the replacement load in both places.'},
    }
  }
  if (id === 'd9') {
    const i2 = (p.V1 - p.V2 - p.R1 * p.I1) / (p.R1 + p.R3)
    const i1 = i2 + p.I1
    return {
      title: 'Solve two meshes with a shared current source',
      intro: 'Choose both mesh currents clockwise: i1 passes through R1 from in to A, and i2 passes through R3 from A to n2. The source I1 points from A to ground, along the shared branch.',
      steps: [
        step('Write the current-source constraint', 'In the shared branch, clockwise i1 is downward and clockwise i2 is upward. Their difference must equal the source current.', String.raw`i_1-i_2=I_1=${n(p.I1)}\,\mathrm A`),
        step('Walk the supermesh boundary', 'A supermesh is the outer loop around both meshes, omitting the shared current-source branch. Starting at ground, V1 is a rise, both resistor terms are drops, and V2 is a drop.', String.raw`-V_1+R_1i_1+R_3i_2+V_2=0`, String.raw`R_1i_1+R_3i_2=V_1-V_2`),
        step('Substitute the constraint into KVL', 'The current source fixes a current, so its voltage must remain an unknown until after solving. Substitution avoids inventing a voltage for it.', String.raw`i_1=i_2+I_1`, String.raw`R_1(i_2+I_1)+R_3i_2=V_1-V_2`, String.raw`i_2=\frac{V_1-V_2-R_1I_1}{R_1+R_3}=\frac{${n(p.V1)}-(${n(p.V2)})-(${n(p.R1)})(${n(p.I1)})}{${n(p.R1)}+${n(p.R3)}}=${n(i2)}\,\mathrm A`),
        step('Recover the other mesh current', 'A negative current means flow opposite the clockwise reference; the original equations remain valid.', String.raw`i_1=i_2+I_1=(${n(i2)})+(${n(p.I1)})=${n(i1)}\,\mathrm A`),
        step('Find the current-source voltage and verify KCL', 'The source voltage is vA relative to ground. Compute it from the left branch, then check the independent nodal solution and the shared-branch current.', String.raw`v_A=V_1-R_1i_1=${n(p.V1 - p.R1 * i1)}\,\mathrm V`, String.raw`i_{R1}-i_{R3}=${n(x.sol.i.R1 - x.sol.i.R3)}\,\mathrm A=I_1`),
      ],
      advantage: 'Useful for a planar circuit with a current source shared by two meshes: one outer KVL equation plus one source constraint replaces the two difficult inner equations.',
      limitation: 'Mesh currents depend on the chosen planar loops. Nodal analysis can be shorter when the circuit has many current sources. Neither method changes the physical answer.',
      checks: [check('left mesh current', i1, x.sol.i.R1, 'A'), check('right mesh current', i2, x.sol.i.R3, 'A')],
      practice: {prompt: 'Set the shared current source to zero in your calculation, keeping both voltages and resistors as shown. What is the right mesh current in amperes?', target: (p.V1 - p.V2) / (p.R1 + p.R3), unit: 'A', hint: 'Zero source current makes the two clockwise mesh currents equal. Apply the outer-loop KVL equation.'},
    }
  }
  if (id === 'd10') {
    const sum = p.R1 + p.R2 + p.R3
    const ra = p.R1 * p.R3 / sum, rb = p.R1 * p.R2 / sum, rc = p.R2 * p.R3 / sum
    const star = solveDC({elements: [el('V', 'V1', 'A', 'gnd', p.V1), el('V', 'V2', 'B', 'gnd', p.V2), el('R', 'RA', 'A', 'O', ra), el('R', 'RB', 'B', 'O', rb), el('R', 'RC', 'gnd', 'O', rc)]})
    const ia = (p.V1 - p.V2) / p.R1 + p.V1 / p.R3
    const ib = (p.V2 - p.V1) / p.R1 + p.V2 / p.R2
    return {
      title: 'Replace an unbalanced resistor triangle by a star',
      intro: 'The three terminals are A, B and C; C is grounded in this test. R1 joins A–B, R2 joins B–C, and R3 joins C–A. Two independent voltage sources excite the terminals so the comparison tests more than a single divider ratio.',
      steps: [
        step('Name the new center and its three arms', 'The star adds an internal node O. RA joins A to O, RB joins B to O, and RC joins C to O. O is not ground.', String.raw`\Sigma_R=R_1+R_2+R_3=${n(sum)}\,\Omega`),
        step('Convert each arm using the two adjacent triangle edges', 'Each star arm is the product of the two triangle resistances touching its terminal, divided by the sum of all three edges.', String.raw`R_A=\frac{R_1R_3}{\Sigma_R}=${n(ra)}\,\Omega`, String.raw`R_B=\frac{R_1R_2}{\Sigma_R}=${n(rb)}\,\Omega`, String.raw`R_C=\frac{R_2R_3}{\Sigma_R}=${n(rc)}\,\Omega`),
        step('Explain why the port behavior is preserved', 'With terminal C externally open, the resistance between A and B is R1 in parallel with R3 + R2 in the triangle, and RA + RB in the star. The same equality holds for the other two terminal pairs.', String.raw`R_{AB}=R_1\parallel(R_2+R_3)=\frac{R_1(R_2+R_3)}{\Sigma_R}=R_A+R_B`),
        step('Solve the star center with both sources active', 'KCL at the new internal node determines its voltage. Currents entering the network at A and B must match the triangle under this simultaneous excitation.', String.raw`\frac{v_O-V_1}{R_A}+\frac{v_O-V_2}{R_B}+\frac{v_O}{R_C}=0`, String.raw`v_O=\frac{V_1/R_A+V_2/R_B}{1/R_A+1/R_B+1/R_C}=${n(star.v.O)}\,\mathrm V`, String.raw`i_A=\frac{V_1-V_2}{R_1}+\frac{V_1}{R_3}=${n(ia)}\,\mathrm A`, String.raw`i_{A,\mathrm{star}}=\frac{V_1-v_O}{R_A}=${n(star.i.RA)}\,\mathrm A`),
        step('Convert back as a consistency check', 'The triangle edge between A and B is the sum of the pairwise star products divided by the opposite arm RC. This recovers R1, and cyclic permutations recover the other edges.', String.raw`R_{AB}=\frac{R_AR_B+R_BR_C+R_CR_A}{R_C}=${n((ra * rb + rb * rc + rc * ra) / rc)}\,\Omega`),
      ],
      advantage: 'Useful in bridge networks that cannot be reduced by series and parallel combinations alone. Balance is not required.',
      limitation: 'The internal nodes, currents and individual resistor powers change. The equivalence is at the three terminals, so do not attach an extra external connection to the new center O.',
      checks: [check('triangle terminal A current', ia, -x.sol.i.V1, 'A'), check('star terminal A current', ia, star.i.RA, 'A'), check('star terminal B current', ib, star.i.RB, 'A')],
      practice: {prompt: 'Leave terminal C externally open. Calculate the equivalent resistance measured between A and B in ohms.', target: ra + rb, unit: 'Ω', hint: 'Use RA + RB, or R1 in parallel with the series path R2 + R3.'},
    }
  }
  throw new Error(`Unknown worked method ${id}`)
}

export function completionMethods(base, groups) {
  const find = id => base.find(e => e.id === id)
  const simple = (id, name, params, net, layout, lesson, prerequisites) => ({
    id, name, group: groups[3], params, net, layout, terms: ['kcl', 'kvl'], show: 'v', view: 'equations', views: ['reading', 'equations', 'power'], claim: {},
    lesson, prerequisites, study: methodStudy,
    headline: {label: id === 'd10' ? 'current entering terminal A' : 'the node A voltage', tag: id === 'd10' ? 'i_A' : 'v_A', unit: id === 'd10' ? 'A' : 'V', where: null, value: x => id === 'd10' ? -x.sol.i.V1 : x.sol.v.A},
  })
  const source = (id, norton) => simple(id, norton ? 'Construct a Norton equivalent' : 'Source transformations: the same load behavior',
    [V('V1', 10), R('R1', 1200), ...(norton ? [R('R2', 1800)] : []), R('RL', 2400, 'Load RL')],
    p => ({elements: [el('V', 'V1', 'in', 'gnd', p.V1), el('R', 'R1', 'in', 'A', p.R1), ...(norton ? [el('R', 'R2', 'A', 'gnd', p.R2)] : []), el('R', 'RL', 'A', 'gnd', p.RL)]}),
    norton ? find('c3').layout : {...find('c3').layout, items: find('c3').layout.items.filter(it => it.el !== 'R2' && !(it.wire && it.wire[0] === 180 && it.wire[2] === 180))},
    {see: 'A complicated source can often be replaced at its load terminals. Follow the original circuit and the independently solved Norton circuit to see what remains the same when the load changes.', why: 'The equivalent preserves the complete terminal voltage–current relation. It does not promise the same power in each internal component. Start with the port definition and follow the worked equations before using the load divider.', try: [{say: 'Set the load to 4800 Ω and compare the original and Norton load voltages in Equations.', set: {RL: 4800}, reads: []}, {say: 'Set V1 to −10 V and explain why the load current reverses.', set: {V1: -10}, reads: []}]},
    norton ? ['d7', 'd5'] : ['d5', 'c3'])
  const mesh = simple('d9', 'Supermesh: a current source between loops', [V('V1', 12), V('V2', 2), R('R1', 1500), R('R3', 2500), {key: 'I1', label: 'Shared source I₁', unit: 'A', default: .002, min: -.01, max: .01, scale: 'linear'}],
    p => ({elements: [el('V', 'V1', 'in', 'gnd', p.V1), el('R', 'R1', 'in', 'A', p.R1), el('I', 'I1', 'A', 'gnd', p.I1), el('R', 'R3', 'A', 'n2', p.R3), el('V', 'V2', 'n2', 'gnd', p.V2)]}),
    {...find('d3').layout, items: find('d3').layout.items.map(it => it.el === 'R2' ? {...it, el: 'I1'} : {...it})},
    {see: 'The central current source fixes the difference between two clockwise mesh currents. Its voltage is unknown, so take KVL around the outside and use the source constraint as the second equation.', why: 'This is a supermesh. The outer loop avoids the unknown source voltage without discarding the source current. Once both mesh currents are known, recover the central node voltage and compare with nodal analysis.', try: [{say: 'Set I1 to zero and check that both clockwise mesh currents agree.', set: {I1: 0}, reads: []}, {say: 'Set I1 to −0.002 A and follow the sign change in the shared-branch constraint.', set: {I1: -.002}, reads: []}]}, ['d3', 'd7'])
  const triangle = simple('d10', 'Delta–wye: an unbalanced three-terminal network', [V('V1', 9), V('V2', 3), R('R1', 1200), R('R2', 1800), R('R3', 2400)],
    p => ({elements: [el('V', 'V1', 'A', 'gnd', p.V1), el('V', 'V2', 'B', 'gnd', p.V2), el('R', 'R1', 'A', 'B', p.R1), el('R', 'R2', 'B', 'gnd', p.R2), el('R', 'R3', 'A', 'gnd', p.R3)]}),
    {w: 650, h: 250, items: [
      ...[['V1', 50], ['R3', 190], ['R2', 420], ['V2', 550]].flatMap(([id, xx]) => [{el: id, x: xx, y: 120, dir: 'v'}, {wire: [xx, 40, xx, 100]}, {wire: [xx, 140, xx, 200]}]),
      {el: 'R1', x: 300, y: 40, dir: 'h'}, {wire: [50, 40, 280, 40]}, {wire: [320, 40, 550, 40]}, {wire: [50, 200, 550, 200]}, {gnd: [300, 200]}, {node: 'A', x: 190, y: 40, side: 't'}, {node: 'B', x: 420, y: 40, side: 't'}, {text: 'C = ground', x: 440, y: 224},
    ]},
    {see: 'The three resistors form a triangle between A, B and ground, even though the drawing uses rectangular wires. Replace it by a star and compare currents entering the same three terminals under two independent source voltages.', why: 'The conversion depends on which edges touch each terminal. Pairwise resistance tests derive the formulas, and simultaneous excitation checks the full terminal behavior. The internal star center is a new node, not a new ground connection.', try: [{say: 'Set V2 to zero and compare the triangle and star terminal currents.', set: {V2: 0}, reads: []}, {say: 'Set R2 to 3600 Ω and identify all three star arms that change.', set: {R2: 3600}, reads: []}]}, ['c4', 'd1', 'd7'])
  return [source('d7', false), source('d8', true), mesh, triangle]
}
