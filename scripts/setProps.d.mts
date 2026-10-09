/** Typed surface of setProps.mjs for the renderer density helpers. */

export const SET_TEXTURE_SIZES: number[];

export type SetProp = {
  scene: string;
  file: string;
  axis: number;
  metres: number;
};

export const SET_PROPS: SetProp[];

export function setProp(scene: string, file: string): SetProp;
