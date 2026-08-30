import { createChain } from '@ee-labs/dsp'
import { BLOCK_TYPES } from './blocks.js'

// This application's chain: the shared machinery from @ee-labs/dsp, bound once
// to the block registry defined in blocks.js.
//
// The registry is injected rather than imported by the package, so a tool with
// entirely different blocks — a control loop, say — reuses all of this without
// the package needing to know anything about filters.

export const { chainSettle, applyChain, renderChain, runChain, chainResponse, chainPhase } =
  createChain(BLOCK_TYPES)
