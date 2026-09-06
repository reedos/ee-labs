import { CARD, CU, RU, inverter, transfer } from '../src/model.js'
import { edgeResponse } from '../src/extract.js'

const delays = []
for (const wp of [1, 2, 4]) for (const fanout of [0, 1, 4, 8]) {
  const fall = edgeResponse(inverter({ wp }), fanout * 3 * CU, 'fall')
  const rise = edgeResponse(inverter({ wp }), fanout * 3 * CU, 'rise')
  delays.push({ wp, fanout, fallPs: fall.measured * 1e12, risePs: rise.measured * 1e12 })
}
const { samples, ...dc } = transfer()
console.log(JSON.stringify({ card: CARD, ruOhms: RU, cuFarads: CU, dc, delays }, null, 2))
