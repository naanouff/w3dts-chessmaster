/**
 * @file Fragment shader for rendering a skybox from a cubemap.
 * It samples a cubemap texture using the view ray direction.
 */

#include "../shared/structs.wgsl"

@group(1) @binding(0) var environmentMap: texture_cube<f32>;
@group(1) @binding(1) var environmentSampler: sampler;

@fragment
fn main(input: VertexOutput) -> @location(0) vec4<f32> {
    let dir = normalize(input.world_position);
    return textureSample(environmentMap, environmentSampler, dir);
}