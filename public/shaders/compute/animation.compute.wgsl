/**
 * @file Compute shader for animating a large number of instances via a sinusoidal wave effect.
 * It reads the initial positions of the instances and writes updated transformation matrices.
 * @author Cyril Tarriet
 */

// Includes shared data structures and math utility functions.
#include "../shared/compute_structs.wgsl"
#include "../shared/compute_math_utils.wgsl"

/**
 * The total elapsed time since the application started.
 * @group(0) @binding(0)
 */
@group(0) @binding(0) var<uniform> totalTime: f32;

/**
 * The read-only storage buffer containing the input data for each instance.
 * @group(0) @binding(1)
 */
@group(0) @binding(1) var<storage, read> input_data: array<InstanceInput>;

/**
 * The read-write storage buffer that will contain the updated transformation
 * matrices and colors for each instance.
 * @group(0) @binding(2)
 */
@group(0) @binding(2) var<storage, read_write> output_data: array<InstanceOutput>;

/**
 * The main entry point for the compute shader.
 * Each compute thread executes this code for a single instance.
 * @param global_id The unique global identifier of the compute thread.
 */
@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let index = global_id.x;
  // Bounds check to prevent processing out-of-range instances.
  if (index >= arrayLength(&input_data)) { return; }

  // 1. Read the initial data for the current instance.
  let initialPos = input_data[index].initial_pos;
  let color = input_data[index].color;
  let scale = input_data[index].params.x;

  // 2. Calculate the wave animation.
  // The y-position is offset by a wave function based on time and the initial x/z position.
  let wave = sin(totalTime * 2.0 + initialPos.x * 0.5) + cos(totalTime * 2.0 + initialPos.z * 0.5);
  let currentPos = vec3<f32>(initialPos.x, initialPos.y + wave, initialPos.z);

  // 3. Calculate the rotation.
  let rot_matrix = rotation_y(totalTime * 30.0) * rotation_x(totalTime * 20.0);

  // 4. Build the final transformation matrices.
  let modelMatrix = translation(currentPos) * rot_matrix * scaling(vec3<f32>(scale));
  let normalMatrix = transpose(matrix_inverse(modelMatrix));

  // 5. Write the results to the output buffer, which will be used by the rendering pass.
  output_data[index].modelMatrix = modelMatrix;
  output_data[index].normalMatrix = normalMatrix;
  output_data[index].color = color;
}
