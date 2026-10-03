/**
 * @file Fragment shader for pre-calculating the irradiance map from an environment cubemap.
 * It integrates the environment lighting for each normal direction of the cubemap,
 * using Monte Carlo integration.
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
 * The sampler for the environment cubemap.
 * @group(0) @binding(2)
 */
@group(0) @binding(2) var envSampler: sampler;

/**
 * The main entry point for the fragment shader.
 * @param local_pos The fragment's position in local space, used as the normal vector for sampling.
 * @returns The pre-calculated irradiance color.
 */
@fragment
fn main(@location(0) local_pos: vec3<f32>) -> @location(0) vec4<f32> {
    let normal = normalize(local_pos);
    var irradiance = vec3<f32>(0.0);

    // Construct a local basis (TBN) for hemisphere integration.
    var up = vec3<f32>(0.0, 1.0, 0.0);
    if (abs(normal.y) > 0.999) {
        up = vec3<f32>(1.0, 0.0, 0.0); // Avoid issues at the poles
    }
    let right = normalize(cross(up, normal));
    let tangent_up = cross(normal, right);

    let sampleDelta = 0.025;
    var nrSamples = 0u;

    // Monte Carlo integration loops over the hemisphere of the normal.
    for (var phi = 0.0; phi < 2.0 * PI; phi = phi + sampleDelta) {
        for (var theta = 0.0; theta < 0.5 * PI; theta = theta + sampleDelta) {
            // Convert spherical coordinates to Cartesian coordinates in tangent space.
            let tangentSample = vec3<f32>(sin(theta) * cos(phi),  sin(theta) * sin(phi), cos(theta));
            // Transform the sample vector from tangent space to world space.
            let sampleVec = tangentSample.x * right + tangentSample.y * tangent_up + tangentSample.z * normal;

            irradiance = irradiance + textureSample(environmentMap, envSampler, sampleVec).rgb * cos(theta) * sin(theta);
            nrSamples = nrSamples + 1u;
        }
    }
    // Final scaling to get the average irradiance.
    irradiance = PI * irradiance * (1.0 / f32(nrSamples));

    return vec4<f32>(irradiance, 1.0);
}
