// Explaining a number, and proving the explanation.
//
// The panel is the visible half. The discipline behind it is the valuable half:
//
//   - a two-column "theory vs measured" comparison only appears when the
//     measured side is genuinely read from something the tool is showing.
//     Anything else is a derived value with no tick, because marking 1 = 1
//     correct teaches the reader to trust a tick that carries no information.
//   - a claim the current settings make unmeasurable is footnoted with the
//     reason, never crossed out. The formula has not stopped being true; this
//     configuration just cannot see it.
//
// `./testing` carries the helpers that hold tools to that standard.

export { default as MathPanel, Formula, Check, Values, agrees } from './src/MathPanel.jsx'
