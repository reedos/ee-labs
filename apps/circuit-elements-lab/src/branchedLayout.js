export function phasorLayout(topology) {
  const branch = topology === 'branched'
  const items = [
    { el: 'V1', x: 60, y: 150, dir: 'v' }, { el: 'R1', x: 150, y: 50, dir: 'h' },
    { wire: [60, 130, 60, 50] }, { wire: [60, 50, 130, 50] }, { wire: [170, 50, 250, 50] },
    { wire: [60, 170, 60, 260] }, { wire: [60, 260, 250, 260] }, { gnd: [60, 260] },
    { node: 'in', x: 60, y: 50, side: 't' }, { node: 'n', x: 250, y: 50, side: 't' },
  ]
  if (topology === 'rc' || branch) items.push(
    { el: 'C1', x: 250, y: 150, dir: 'v' }, { wire: [250, 50, 250, 130] }, { wire: [250, 170, 250, 260] },
  )
  else items.push(
    { el: 'L1', x: 250, y: 110, dir: 'v' }, { el: 'C1', x: 250, y: 210, dir: 'v' },
    { wire: [250, 50, 250, 90] }, { wire: [250, 130, 250, 190] }, { wire: [250, 230, 250, 260] },
    { node: 'm', x: 250, y: 160 },
  )
  if (branch) items.push(
    { el: 'R2', x: 370, y: 110, dir: 'v' }, { el: 'L1', x: 370, y: 210, dir: 'v' },
    { wire: [250, 50, 370, 50] }, { wire: [370, 50, 370, 90] }, { wire: [370, 130, 370, 190] },
    { wire: [370, 230, 370, 260] }, { wire: [250, 260, 370, 260] }, { node: 'm', x: 370, y: 160, side: 'r' },
  )
  return { w: branch ? 450 : 340, h: 310, items }
}
