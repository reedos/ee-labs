import { TERMS } from './terms.js'

export const PLOT_NOTES = {
  inputLimits: `${TERMS.vih.def} ${TERMS.vil.def} These are the unity-slope limits of this model. VOH is the lowest guaranteed high output voltage. VOL is the highest guaranteed low output voltage.`,
  transfer: 'The square-law view is static. The shaded band means neither input logic level is guaranteed. The analog output is still defined. Brackets compare input and output voltage limits along the voltage scale. V_IL, V_IH, V_OL and V_OH in the math mean VIL, VIH, VOL and VOH. NM_L and NM_H mean NML and NMH.',
  timing: 'Digital rows show logic signals, with 1 high and 0 low. Vertical green edges are transitions. The analog row shows the final connected-stage voltage. Gray vertical lines are time-grid guides.',
  fanout: 'Each load is one unit inverter input. These delays assume ideal rail steps. tpHL means output high-to-low delay. tpLH means output low-to-high delay. At width 2 the rising, falling and default curves coincide.',
}
