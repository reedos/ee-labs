# Interfaces Lab integration needs

## Director integration

Register `apps/interfaces-lab` in the root lockfile. All declared dependencies already exist in this checkout.
The assigned worktree installed its dependencies with offline `npm ci`. No dependency versions or root files changed for this app.

Add the dark deployment copy and assembly entry. Keep the lab unlisted until Reed authorizes release.

```sh
cp -r apps/interfaces-lab/dist _site/interfaces-lab
```

Register Group A with five experiments, `a1` through `a5`, in the progression inventory.
Electronics prerequisites are `d5` and `d6`. Both exist in this worktree.

The director reported that the shared URL registry excludes Interfaces Lab. Shared LabNav therefore remains absent at its deployed path.
Add the path during integration and perform the deployed navigation review afterward. This app contains no local navigation workaround.

## Engine and scope

Group A requires no shared engine changes. Fixed switch topologies use `network.transient` and `solveDC`.
The timing canvas already supports analog samples and input limits. No events package changes are needed for this wave.

The independent Electronics check measures transfer slopes at both input limits at both supplies.
An extra midpoint Newton probe did not converge for some reduced-supply settings. The lessons make no midpoint operating-point claim.
Threshold checks pass. No numerical substitute was introduced.

The plan's rise factor of 2.2 is rounded. The app uses the exact factor `ln(9)`.
The open-drain crossing ratio uses an initially discharged capacitor. A physical low state has the pull-up divider voltage.
Its falling waveform uses the parallel resistance. Both initial conditions have separate boundary checks.

## Deferred work

Groups B through G are outside this assignment. Protocol implementation and events contracts remain for later waves.
Full-suite testing, Firefox, student sittings and the final deployed navigation review remain integration or release work.
The release status remains dark.
