/** Typed surface of setProps.mjs for the renderer density helpers. */

export const SET_TEXTURE_SIZES: number[];

export const MESHY_NORMAL_CREASE: number;

export type SetProp = {
  scene: string;
  file: string;
  axis: number;
  metres: number;
  smooth?: number;
};

export const SET_PROPS: SetProp[];

export function setProp(scene: string, file: string): SetProp;
export function countFacetedSplits(
  positions: Float32Array,
  normals: Float32Array,
  creaseRadians: number
): number;
export function smoothSplitNormals(
  positions: Float32Array,
  normals: Float32Array,
  creaseRadians: number
): Float32Array;
