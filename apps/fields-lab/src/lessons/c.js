// Group C's three registers. This is the group that ships an approximation, so
// every note here names the guard and none of them quotes a grid answer to more
// figures than the guard allows.

export const LESSONS_C = {
  c1: {
    see:
      'A square trough with its top side at 100 V and the other three at zero. No formula gives the potential ' +
      'inside, so the solver makes each node the average of its four neighbours, over and over. The probe at ' +
      '(25, 75) mm reads 43.2 V.',
    seeReads: [['grid.value', 43.20183]],
    try: [
      {
        say: 'Move the probe to the centre, at (50, 50) mm. It reads 25.0 V, a quarter of the top side.',
        set: { px: 0.05, py: 0.05 },
        reads: [['grid.value', 25]],
      },
      {
        say: 'Set the coarsest mesh to 30 cells. The probe still reads 43.2 V, and the guard tightens.',
        set: { n: 30 },
        reads: [['grid.value', 43.20239]],
      },
    ],
    why:
      'Laplace’s equation says the potential has no local maximum or minimum anywhere charge is absent. In two ' +
      'dimensions that has a sharp form: the value at a point is the average of the values around it on any circle ' +
      'drawn about it. Relaxation is that statement used as an instruction. Sweep the grid, replace each free node ' +
      'by the average of its four neighbours, and repeat until nothing moves. The centre of a square trough reads a ' +
      'quarter of the top side at every mesh, because the four sides can be superposed and each contributes the ' +
      'same amount there.',
  },

  c2: {
    see:
      'The same trough, solved at 20, 40 and 80 cells across. The probe reads 43.1868, 43.1988 and 43.2018 V. The ' +
      'last halving moved the answer by 0.00696 per cent, and the Fourier series for this trough gives 43.2028 V.',
    seeReads: [['grid.change', 6.9596e-5], ['compare.value', 43.202837]],
    try: [
      {
        say: 'Set the coarsest mesh to 12 cells. The change grows to 0.0193 per cent, since the meshes are coarser.',
        set: { n: 12 },
        reads: [['grid.change', 1.9293e-4]],
      },
      {
        say: 'Read the observed order, near 1.99. That is the second order the scheme is built to have.',
        reads: [['grid.order', 1.9949]],
      },
    ],
    why:
      'A grid answer needs a warrant, and the residual is not one. A small residual says the solver solved the ' +
      'discrete problem well, which is a different question from whether the discrete problem stands for the ' +
      'continuous one. The warrant used here is the change in the answer between two mesh refinements, measured ' +
      'against a threshold the panel states. Three levels also give the observed order of convergence. Near two ' +
      'means the error is falling as the square of the cell size, which is what this scheme promises when the ' +
      'boundary follows the mesh. The band the guard defends is the extrapolated error times a safety factor.',
  },

  c3: {
    see:
      'The same solver on a round coaxial line, meshed on a square grid. It gives 44.1 pF/m against the closed ' +
      'form’s 44.41 pF/m. The observed order has fallen to 0.81, and 46.3 per cent of the conductor boundary steps ' +
      'across the mesh rather than following it.',
    seeReads: [['grid.value', 4.4096e-11], ['compare.value', 4.4408e-11], ['grid.staircase', 0.46278]],
    try: [
      {
        say: 'Widen the shield to 7 mm. The grid gives 28.4 pF/m against the closed form’s 28.59 pF/m.',
        set: { b: 7e-3 },
        reads: [['grid.value', 2.8359e-11], ['compare.value', 2.8589e-11]],
      },
      {
        say: 'Read the error band, 2.62 per cent. The true error against the closed form is 0.703 per cent.',
        reads: [['grid.band', 0.026157]],
      },
    ],
    why:
      'A circle cut out of a square mesh has a staircase boundary, and the steps do not shrink in proportion as the ' +
      'mesh is refined. The error then falls at first order rather than second, and it does not fall smoothly, so ' +
      'the extrapolation the guard uses is less reliable. The guard measures that rather than assuming it. It walks ' +
      'the conductor boundary and counts the nodes exposed on two perpendicular sides, which is what a step is. A ' +
      'rectangle has four of those however fine the mesh. A circle has them all the way round. When the fraction is ' +
      'high the safety factor goes from 1.25 to three, and the band widens to hold the error it cannot pin down.',
  },

  c4: {
    see:
      'The same solved field, with a square contour drawn around the inner conductor. The flux out of it implies ' +
      '44.1 pC/m of charge on that conductor. The closed form puts 44.41 pC/m there, and the two agree inside the ' +
      'guard’s band.',
    seeReads: [['flux.value', 4.4096e-11], ['compare.value', 4.4408e-11]],
    try: [
      {
        say: 'Shrink the contour to 0.3 of the shield. The flux is unchanged at 44.1 pC/m, since the charge is.',
        set: { box: 0.3 },
        reads: [['flux.value', 4.4096e-11]],
      },
      {
        say: 'Compare the flux with the charge inside. Both read 44.1 pC/m, to the solver’s own residual.',
        reads: [['flux.value', 4.4096e-11], ['flux.inside', 4.4096e-11]],
      },
    ],
    why:
      'Two different checks are running here, and the panel keeps them apart. The flux through the contour and the ' +
      'charge inside it are the two sides of the divergence theorem written on this grid, so they agree to the ' +
      'residual the relaxation stopped at. That is a check on the bookkeeping. The check on the physics is the flux ' +
      'against the closed form’s charge, and that one is limited by the mesh, so it is measured against the ' +
      'guard’s band. Moving the contour changes neither, which is what Gauss’s law says: only the charge inside ' +
      'counts.',
  },

  c5: {
    see:
      'A square inner conductor inside a square shield. Nothing gives this capacitance in closed form, so the ' +
      'guard is the whole warrant. The last halving moved the answer by 0.118 per cent, past the 0.1 per cent ' +
      'threshold, so it is quoted to two figures as 48 pF/m.',
    seeReads: [['grid.change', 0.0011763], ['grid.value', 4.7832e-11]],
    try: [
      {
        say: 'Widen the inner conductor to 3 mm. The change falls to 0.0994 per cent and the guard is met.',
        set: { a: 3e-3 },
        reads: [['grid.change', 9.941e-4], ['grid.ok', true]],
      },
      {
        say: 'Read the observed order, near 1.34. The sharp corners hold it below the second order of the trough.',
        reads: [['grid.order', 1.343]],
      },
    ],
    why:
      'This geometry has no closed form, which is the ordinary case once a shape stops being a plate, a cylinder or ' +
      'a sphere. The boundary follows the mesh here, so the staircase fraction is small and the safety factor stays ' +
      'at 1.25. What holds the order below two is the re-entrant corner at each edge of the inner conductor. The ' +
      'field there is singular, the discretisation cannot follow it, and the error picks up a term that falls more ' +
      'slowly than the square of the cell size. The guard notices without being told, because it measures the ' +
      'answer and not the geometry.',
  },
}
