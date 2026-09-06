// The terms Group C, the filters that learn, needs.

export const TERMS = {
  adaptivefilter: {
    name: 'Adaptive filter',
    short: 'adaptive filter',
    def:
      'A filter that changes its own coefficients at every sample, driven by the error between ' +
      'what it produced and what was wanted. It is not one filter, so it carries no H(z). The ' +
      'weight view shows the sequence of filters it passes through, each an ordinary FIR.',
  },
  unknownplant: {
    name: 'Plant',
    short: 'plant',
    def:
      'The system an adaptive filter is trying to match, which nobody is allowed to look inside. ' +
      'Here it is an eight-tap FIR. Its taps are recovered from the input it was given and the ' +
      'output it produced, and never read off directly.',
  },
  wiener: {
    name: 'Wiener solution',
    short: 'Wiener solution',
    def:
      'The best fixed filter of a given length for a stationary input, found by solving R w = p. ' +
      'R holds the input autocorrelations and p the correlations between the input and what was ' +
      'wanted. One linear system, one answer, and no iteration.',
  },
  lms: {
    name: 'LMS',
    short: 'LMS',
    def:
      'Least mean squares, the update w <- w + mu e x. One multiply-accumulate a tap for the ' +
      'output and one more for the update, so 2N a sample. It follows a gradient estimated from ' +
      'a single sample, which is why it is cheap and why it never quite settles.',
  },
  nlms: {
    name: 'NLMS',
    short: 'NLMS',
    def:
      'LMS with the update divided by the energy in the delay line, at a cost of 3N a sample. ' +
      'The division makes the step size dimensionless. The same number then works at any signal ' +
      'level, and the bound is 0 to 2 rather than a figure that moves with the input.',
  },
  rls: {
    name: 'RLS',
    short: 'RLS',
    def:
      'Recursive least squares, which keeps the exact least-squares answer at every sample by ' +
      'updating an inverse correlation matrix. It costs about N squared a sample and reaches the ' +
      'plant in about 2N samples rather than in thousands.',
  },
  stepsize: {
    name: 'Step size',
    short: 'step size',
    def:
      'How far LMS moves the weights on each update, written mu. Below 2/(3 N Px) the mean square ' +
      'of the weights converges, and above 2/(N Px) even their mean does not. Here N is 8 and Px ' +
      'is 0.336, so those two numbers are 0.248 and 0.743.',
  },
  convergence: {
    name: 'Convergence',
    short: 'convergence',
    def:
      'How long the weights take to get within a stated distance of the answer, in samples. The ' +
      'distance used here is a tenth of the size of the plant. A larger step size takes fewer ' +
      'samples and settles further from the answer.',
  },
  misadjustment: {
    name: 'Misadjustment',
    short: 'misadjustment',
    def:
      'The excess error LMS settles at, as a fraction of the floor it is aiming for, predicted as ' +
      'mu N Px over 2. A gradient estimated from one sample is noisy, so the weights never stop ' +
      'moving. Halving the step size halves the excess and doubles the time.',
  },
  erle: {
    name: 'Echo return loss',
    short: 'echo return loss enhancement',
    def:
      'How much of an echo a canceller removed, in decibels, as ten log of the power before over ' +
      'the power after. Here the echo falls from 0.175 to 7.06e-3, an enhancement of 13.9 dB. ' +
      'What is left is the near-end voice, which the canceller is not there to remove.',
  },
}

/** The words that mean a reader has met one of these terms. */
export const TERM_WORDS = {
  adaptivefilter: [/\badaptive\b/i],
  unknownplant: [/\bplant\b/i],
  wiener: [/\bwiener\b/i],
  lms: [/\bLMS\b/],
  nlms: [/\bNLMS\b/],
  rls: [/\bRLS\b/],
  stepsize: [/\bstep size\b/i],
  convergence: [/\bconverges?\b/i, /\bconvergence\b/i, /\bdiverges?\b/i],
  misadjustment: [/\bmisadjust/i],
  erle: [/\becho return loss\b/i],
}
