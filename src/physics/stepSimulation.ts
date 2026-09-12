import type { ClawRig, RigCommand, RigObservation } from "../crane/types";

export interface SimulationSequence {
  tick(dt: number, observation: RigObservation): RigCommand;
}

/** The sole fixed-tick pipeline. The returned observation is sampled after Havok. */
export function stepSimulation(
  dt: number,
  sequence: SimulationSequence,
  rig: ClawRig,
  executePhysics: (dt: number) => void,
): RigObservation {
  const command = sequence.tick(dt, rig.observe());
  rig.command(command);
  rig.beforeStep(dt);
  executePhysics(dt);
  return rig.observe();
}
