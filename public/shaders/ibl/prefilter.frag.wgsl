/**
 * @file Fragment shader for pre-filtering an environment cubemap for PBR specular reflections.
 * It uses the surface roughness to sample an appropriate mipmap level of the cubemap,
 * simulating the blurring effect for rougher surfaces.
 * @author Cyril Tarriet
 */

#include "../shared/math_common.wgsl"
#include "../shared/structs.wgsl"

/**
 * The source HDR environment cubemap.
 * @group(0) @binding(1)
 */
@group(0) @binding(1) var environmentMap: texture_cube<f32>;
/**
 * The sampler for the cubemap.
 * @group(0) @binding(2)
 */
@group(0) @binding(2) var envSampler: sampler;
/**
 * The material's roughness, used to determine which mipmap level to sample.
 * @group(0) @binding(3)
 */
@group(0) @binding(3) var<uniform> roughness: f32;

/** The maximum number of mipmap levels for the reflection cubemap. */
const MAX_REFLECTION_LOD: f32 = 4.0;

/**
 * The main entry point for the fragment shader.
 * @param local_pos The fragment's position in local space, used as the world normal for sampling.
 * @returns The pre-filtered color.
 */
@fragment
fn main(@location(0) local_pos: vec3<f32>) -> @location(0) vec4<f32> {
    let N = normalize(local_pos);

    // Calculate the mipmap level (Level of Detail) based on the roughness.
    let lod = roughness * MAX_REFLECTION_LOD;

    let prefilteredColor = textureSampleLevel(environmentMap, envSampler, N, lod);

    return prefilteredColor;
}
