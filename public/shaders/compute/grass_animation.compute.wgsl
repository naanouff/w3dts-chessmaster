/**
 * @file Compute shader for animating a field of grass.
 * This shader simulates a wind effect by applying sinusoidal offsets and rotations
 * to the grass blades.
 * @author Cyril Tarriet
 */

#include "../shared/compute_structs.wgsl"
#include "../shared/compute_math_utils.wgsl"

/**
 * The total elapsed time since the application started.
 * @group(0) @binding(0)
 */
@group(0) @binding(0) var<uniform> totalTime: f32;

/**
 * The read-only storage buffer containing the input data for each grass blade.
 * @group(0) @binding(1)
 */
@group(0) @binding(1) var<storage, read> input_data: array<InstanceInput>;

/**
 * The read-write storage buffer that will contain the updated transformation
 * matrices and colors for each grass blade.
 * @group(0) @binding(2)
 */
@group(0) @binding(2) var<storage, read_write> output_data: array<InstanceOutput>;

/**
 * The main entry point for the compute shader.
 * Each compute thread executes this code for a single grass blade.
 * @param global_id The unique global identifier of the compute thread.
 */
@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let index = global_id.x;
  if (index >= arrayLength(&input_data)) { return; }

  // 1. Read the input data for the current instance.
  let initialPos = input_data[index].initial_pos;
  let color = input_data[index].color;
  let scale = input_data[index].params.x;
  let animPhase = input_data[index].params.y; // Random phase to desynchronize blades

  // 2. Calculate the wind animation.
  let wind_strength = 0.2;
  let wind_speed = 1.5;
  let wind_frequency = 0.5;

  // Combine two sine waves with different parameters to create a more natural, gusty wind effect.
  var wind_offset = sin(totalTime * wind_speed + initialPos.x * wind_frequency + animPhase) * wind_strength;
  wind_offset += cos(totalTime * wind_speed * 0.7 + initialPos.z * wind_frequency * 1.5 + animPhase) * wind_strength * 0.5;

  // Apply the wind offset to the position (sway) and create a corresponding rotation.
  let currentPos = vec3<f32>(initialPos.x + wind_offset, initialPos.y, initialPos.z);
  let rot_matrix = rotation_y(wind_offset * 2.0);

  // 3. Create the final transformation matrix.
  let modelMatrix = translation(currentPos) * rot_matrix * scaling(vec3<f32>(scale));
  let normalMatrix = transpose(matrix_inverse(modelMatrix));

  // 4. Write the result to the output buffer.
  output_data[index].modelMatrix = modelMatrix;
  output_data[index].normalMatrix = normalMatrix;
  output_data[index].color = color;
}
