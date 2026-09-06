export function mathEntry(id, p, x) {
  const formulas = {
    a1: ['v(t)=V_{DD}(1-e^{-t/(R_{on}C)})', 't_r=R_{on}C\\ln 9'],
    a2: ['V_{IL}=\\frac{3V_{DD}+2V_t}{8},\\quad V_{IH}=\\frac{5V_{DD}-2V_t}{8}', 't_{IH}=-RC\\ln(1-V_{IH}/V_{DD})'],
    a3: ['\\tau_{rise}=R_{pu}C,\\quad \\tau_{fall}=(R_{pu}\\parallel R_{on})C', 'V_{low}=V_{DD}\\frac{R_{on}}{R_{pu}+R_{on}}'],
    a4: ['t_r=C R_{on}\\ln 9', 'C_{max}=\\frac{t_{budget}}{R_{on}\\ln 9}'],
    a5: ['V_{OL}=I R_{on},\\quad V_{OH}=V_{DD}-I R_{on}', 'V_{bounce}=LN\\frac{V_{DD}/R_{on}}{t_{edge}}'],
  }
  const rows = id === 'a5'
    ? [{ label: 'Low noise margin', value: x.margins.nml, unit: 'V' },
      { label: 'High noise margin', value: x.margins.nmh, unit: 'V' },
      { label: 'Ground bounce', value: x.margins.bounce, unit: 'V' }]
    : [{ label: 'Rise time', value: x.rise.tr == null ? NaN : x.rise.tr / 1e-9, unit: 'ns' },
      { label: 'Delay to VIH', value: x.rise.tpLH == null ? NaN : x.rise.tpLH / 1e-9, unit: 'ns' }]
  return { blocks: [...formulas[id].map((tex) => ({ kind: 'formula', tex })), { kind: 'values', rows }] }
}
