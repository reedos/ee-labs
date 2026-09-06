// Group B lessons. see / try / why, in the budgets STYLE.md sets.

export default {
  B1: {
    see: [
      'Two points, at plus one and minus one on the horizontal axis.',
      'One bit chooses which point is sent, once every millisecond.',
      'The mean square of the two is 1, which is how every scheme in this lab is compared.',
      'The gap between them is 2, and that gap is what noise has to cross.',
    ].join(' '),
    try: [
      { say: 'Set Eb over N0 to 6 dB. The cloud around each point widens.', set: { ebN0Db: 6 } },
      { say: 'Set Eb over N0 to 20 dB. The two clouds shrink to dots.', set: { ebN0Db: 20 } },
      { say: 'Read the minimum distance. It stays at 2 at every setting.', set: { ebN0Db: 12 } },
    ],
    why: [
      'A constellation is a fixed table of points, and a modulator is a lookup into it.',
      'Every table in this lab is scaled so that the mean square over its points is 1.',
      'That scaling is what makes two schemes comparable at the same transmitted power.',
      'It also fixes the relation between energy per symbol and energy per bit.',
      'Here a symbol is a bit, so the two are equal and the difference between them is nothing.',
      'The gap of 2 between the points is the largest gap two points of unit mean square can have.',
      'No binary scheme does better, and Group D turns that into an error rate.',
    ].join(' '),
  },

  B2: {
    see: [
      'Four points, one in each quadrant, on the same unit circle.',
      'Two bits choose the point, so the bit rate is twice what BPSK carried.',
      'The gap between neighbours is 1.4142 rather than 2.',
      'The bandwidth is unchanged, because the symbol rate is unchanged.',
    ].join(' '),
    try: [
      { say: 'Set Eb over N0 to 8 dB. The four clouds stay apart.', set: { ebN0Db: 8 } },
      { say: 'Set Eb over N0 to 4 dB. They begin to touch across the boundaries.', set: { ebN0Db: 4 } },
      { say: 'Read Es over Eb. It is 3.010 dB, because a symbol now carries two bits.', set: { ebN0Db: 12 } },
    ],
    why: [
      'The two axes of the plane are two carriers a quarter turn apart.',
      'A receiver that multiplies by a cosine sees one of them and a receiver that multiplies by a sine sees the other.',
      'So this is two independent BPSK links sharing one band, and each one carries half the bits.',
      'The gap between neighbours falls by the root of two, and each arm still has a gap of 2 in its own axis.',
      'That is why D5 finds the same bit error rate as BPSK at the same energy per bit.',
      'The rate doubled and nothing was paid for it, which is the one free lunch in this lab.',
    ].join(' '),
  },

  B3: {
    see: [
      'The same four points, with two different sets of labels on them.',
      'Gray labels leave every pair of neighbours differing in exactly one bit.',
      'Natural binary leaves one pair differing in two.',
      'The ratio of the symbol error rate to twice the bit error rate reads 1.',
    ].join(' '),
    try: [
      { say: 'Read the two adjacency numbers. Gray reads 1 and natural binary reads 2.', set: {} },
      { say: 'Set Eb over N0 to 4 dB. Both labels give more errors, and the ratio holds.', set: { ebN0Db: 4 } },
      { say: 'Set Eb over N0 back to 8 dB.', set: { ebN0Db: 8 } },
    ],
    why: [
      'A symbol error almost always lands on a neighbour, because that is the shortest way for noise to go.',
      'So the bits a symbol error costs are the bits between a point and its neighbour.',
      'Gray labelling makes that one bit, whatever the constellation is, and it is built by one exclusive or.',
      'Natural binary makes it two for some pairs, which nearly doubles the bit error rate at high power.',
      'The engine checks the property by enumeration rather than by assertion.',
      'Every pair at the minimum distance is compared, for all six constellations this lab ships.',
      'D8 measures the consequence, and the ratio it reads is 0.9982 for 16-QAM.',
    ].join(' '),
  },

  B4: {
    see: [
      'Eight points, evenly spaced on the unit circle, three bits each.',
      'The gap between neighbours is 0.7654, which is 0.5412 of the QPSK gap.',
      'The bandwidth has not changed, because the symbol rate has not changed.',
      'Every point is the same distance from the origin, so the peak equals the mean.',
    ].join(' '),
    try: [
      { say: 'Set Eb over N0 to 10 dB. The clouds start to reach their boundaries.', set: { ebN0Db: 10 } },
      { say: 'Set Eb over N0 to 18 dB. They separate again.', set: { ebN0Db: 18 } },
      { say: 'Read the peak to average. It is 0 dB, because all eight points share one circle.', set: { ebN0Db: 14 } },
    ],
    why: [
      'Adding points to a circle of fixed radius is the direct way to raise the rate.',
      'Every point added pushes the neighbours closer, and the noise that separates them is unchanged.',
      'Eight points give three bits a symbol and 0.5412 of the QPSK gap, so more power is needed for the same errors.',
      'A constant radius has one advantage worth naming.',
      'An amplifier driven by a constant-amplitude signal can run close to its limit without clipping.',
      'A grid constellation gives a larger gap for the same average power and a larger peak with it, which is B5.',
      'The choice between the two is an amplifier question rather than a noise question.',
    ].join(' '),
  },

  B5: {
    see: [
      'Sixteen points on a four by four grid, four bits each.',
      'The spacing is 0.6325, which is the root of two fifths at unit mean square.',
      'The amplitude now carries information as well as the phase.',
      'The corner points are 2.553 dB above the average power.',
    ].join(' '),
    try: [
      { say: 'Set Eb over N0 to 10 dB. The corner clouds still separate, and the inner ones crowd.', set: { ebN0Db: 10 } },
      { say: 'Set Eb over N0 to 20 dB. Every cloud pulls into its own cell.', set: { ebN0Db: 20 } },
      { say: 'Read the peak to average. A grid costs 2.553 dB of amplifier headroom.', set: { ebN0Db: 16 } },
    ],
    why: [
      'A grid packs points into the plane more efficiently than a circle does.',
      'At sixteen points the grid gap is 0.6325 and a circle of sixteen would give 0.3902.',
      'The labels are Gray in each dimension separately, so neighbours across the grid still differ in one bit.',
      'The price is that the sixteen points no longer share one radius.',
      'The four corners carry 1.8 times the average power, which is 2.553 dB.',
      'An amplifier has to hold that peak without clipping, and F5 returns to the same problem for OFDM.',
      'Group D measures what the closer spacing costs, and the answer is 3.847 dB against QPSK.',
    ].join(' '),
  },

  B6: {
    see: [
      'The sixteen points have become sixteen clouds.',
      'At an Eb over N0 of 10 dB, seven symbols in a thousand land outside their own cell.',
      'The dashed lines are the decision boundaries, so a reader can see which points crossed one.',
      'The error vector magnitude in the corner reads how far the cloud spreads.',
    ].join(' '),
    try: [
      { say: 'Set Eb over N0 to 6 dB. The clouds overlap and the symbol error rate rises tenfold.', set: { ebN0Db: 6 } },
      { say: 'Set Eb over N0 to 16 dB. Almost nothing crosses a boundary.', set: { ebN0Db: 16 } },
      { say: 'Set the seed to 7. Every point moves, and the rate does not.', set: { seed: 7 } },
    ],
    why: [
      'The channel adds an independent Gaussian to each of the two coordinates.',
      'A symbol is decided wrongly when that pair carries the point across a boundary.',
      'The closed form counts the probability of that for every point and weights it by how likely the point is.',
      'The count on screen does the same thing by drawing symbols and comparing, and the two agree.',
      'The error vector magnitude is a different reading of the same cloud.',
      'It is the root mean square distance from each point to the one it was meant to be, as a fraction of the signal.',
      'An instrument reports it because it rises for reasons other than noise, such as a phase error.',
    ].join(' '),
  },

  B7: {
    see: [
      'Frequency shift keying sends one of two tones rather than one of two points.',
      'There is no constellation to draw, because the two signals are not two points in one plane.',
      'Two tones spaced at half the symbol rate correlate to nothing over one symbol.',
      'At a quarter of the symbol rate they still correlate.',
    ].join(' '),
    try: [
      { say: 'Read the three correlation values. They are 0.6366, 0 and 0.', set: {} },
      { say: 'Set Eb over N0 to 12.598 dB. The error rate reaches one in a hundred thousand.', set: { ebN0Db: 12.598 } },
      { say: 'Set Eb over N0 to 9.588 dB, which is what BPSK needs for the same rate.', set: { ebN0Db: 9.588 } },
    ],
    why: [
      'Two signals are orthogonal when their correlation over one symbol is zero.',
      'Two tones reach that when their spacing is a whole number of half the symbol rate.',
      'Orthogonal is not the same as opposite, and the difference costs exactly 3.010 dB.',
      'Two antipodal points are 2 apart at unit energy, and two orthogonal signals are the root of two apart.',
      'That is a factor of two inside the argument of the Q function, which is 3.010 dB of energy per bit.',
      'The gap is exact rather than approximate, and D7 measures it at three different rates.',
      'A receiver that cannot hold the phase pays a further 0.754 dB, which is the noncoherent case.',
    ].join(' '),
  },

  B8: {
    see: [
      'A carrier recovery loop locks with no way to tell which of two phases it found.',
      'On BPSK the ambiguity is half a turn, and on QPSK it is a quarter turn.',
      'Differential encoding puts the information in the change between symbols rather than in the symbol.',
      'That removes the ambiguity and costs 0.754 dB.',
    ].join(' '),
    try: [
      { say: 'Read the two thresholds. BPSK needs 9.588 dB and differential detection needs 10.342 dB.', set: {} },
      { say: 'Set Eb over N0 to 10.342 dB. The rate reaches one in a hundred thousand.', set: { ebN0Db: 10.342 } },
      { say: 'Set Eb over N0 to 6 dB. The rate rises to about one in a thousand.', set: { ebN0Db: 6 } },
    ],
    why: [
      'A suppressed-carrier signal gives a loop no way to know which of the constellation orientations is correct.',
      'The loop locks to one of them, and every bit after that is inverted or rotated.',
      'Encoding the bit as the change between two successive symbols makes the answer independent of the orientation.',
      'A receiver can then also work without a phase reference at all, by comparing each symbol against the last.',
      'The comparison uses a noisy sample as its reference rather than a clean one, so it needs more energy.',
      'The rate becomes half an exponential rather than a Q function, and it reaches 10 to the minus five at 10.342 dB.',
      'Group E is where the loop that produces the ambiguity is built.',
    ].join(' '),
  },
}
