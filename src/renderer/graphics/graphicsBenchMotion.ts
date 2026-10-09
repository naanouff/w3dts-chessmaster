/**
 * @file graphicsBenchMotion.ts
 * @description Motion phase the host plays while the graphics bench is sampling.
 */

export type GraphicsBenchMotion = 'idle' | 'flight' | 'grab';

export interface GraphicsBenchPose {
  position: readonly [number, number, number];
  rotation: readonly [number, number, number, number];
}

let motion: GraphicsBenchMotion = 'idle';
let pose: GraphicsBenchPose | null = null;

export function setGraphicsBenchMotion(next: GraphicsBenchMotion): void {
  motion = next;
}

export function getGraphicsBenchMotion(): GraphicsBenchMotion {
  return motion;
}

export function noteGraphicsBenchPose(
  position: readonly [number, number, number],
  rotation: readonly [number, number, number, number]
): void {
  pose = {
    position: [position[0], position[1], position[2]],
    rotation: [rotation[0], rotation[1], rotation[2], rotation[3]],
  };
}

export function readGraphicsBenchPose(): GraphicsBenchPose | null {
  return pose;
}
