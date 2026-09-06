// Group F: the cavity, and many colours.
//
// Two experiments about periodicity in frequency. A cavity repeats its
// resonances every free spectral range, and a multiplexed fibre repeats its
// channels every grid spacing. The first says why the cavity has no transfer
// function, and the second says what a fibre's low-loss window is worth once
// more than one colour is allowed down it.

import { facetReflectance } from '@ee-labs/photonics'

import { CavityLength, Freq, Index, Lambda, Reflectance, Width } from '../knobs.js'

export const GROUP = 'F · The cavity, and many colours'

export const F_GROUP = [
  {
    id: 'f1',
    group: GROUP,
    kind: 'cavity',
    name: 'The cavity, and why it has no transfer function',
    terms: ['cavity', 'freespectralrange', 'finesse', 'linewidth'],
    params: [
      // Computed from the index below rather than typed, so this cavity and
      // the chip C5 turns are one object.
      Reflectance('r', 'Facet reflectance', facetReflectance({ n1: 3.5 }), 'A cleaved facet of index 3.5 gives 0.30864'),
      CavityLength('L', 'Cavity length', 300e-6, 'Between the two mirrors'),
      Index('n', 'Index inside', 3.5, 'The semiconductor the light travels in'),
      Lambda('lambda', 'Wavelength', 1550e-9, 'Where the range is read in nanometres'),
    ],
    view: 'cavity',
    views: ['cavity', 'numbers'],
    headline: (x) => ({ value: x.fsr, unit: 'Hz', label: 'Free spectral range' }),
  },
  {
    id: 'f2',
    group: GROUP,
    kind: 'channels',
    name: 'Many colours down one fibre',
    terms: ['grid', 'cband', 'multiplexing'],
    params: [
      Freq('spacing', 'Channel spacing', 100e9, 'The grid the channels sit on', 1e9, 1e12),
      Lambda('lambda', 'Wavelength', 1550e-9, 'Where the grid is read in nanometres'),
      Lambda('from', 'Band, short end', 1530e-9, 'The C band starts here'),
      Lambda('to', 'Band, long end', 1565e-9, 'The C band ends here'),
      Width('dLambda', 'Source spectral width', 1e-10, 'Each channel needs a source narrower than the grid'),
    ],
    view: 'spectrum',
    views: ['spectrum', 'numbers'],
    headline: (x) => ({ value: x.band.channels, unit: '', label: 'Channels the band holds' }),
  },
]
