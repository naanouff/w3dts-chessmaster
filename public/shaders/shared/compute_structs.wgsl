/**
 * @file Shared data structures for compute shaders.
 * They define the format of the input and output data for compute pipelines,
 * including an instance's initial information and the calculated transformation matrices.
 * @author Cyril Tarriet
 */

/**
 * The input data structure for each instance in a compute shader.
 * @field initial_pos L'alignement est 16 bytes pour le vec3
 */
struct InstanceInput {
  initial_pos: vec4<f32>, // Vec3 + Padding (pour l'alignement à 16 bytes)
  params: vec4<f32>,
  color: vec4<f32>,
};

/**
 * The output data structure for each instance in a compute shader.
 * ...
 */
struct InstanceOutput {
  modelMatrix: mat4x4<f32>,
  normalMatrix: mat4x4<f32>,
  color: vec4<f32>,
};
