/**
 * @file hbao_blur.frag.wgsl
 * @description Bilateral blur for HBAO output.
 *
 * Performs an edge-preserving bilateral blur (depth-aware) to smooth the
 * noisy single-sample-per-direction HBAO output while keeping sharp edges
 * at depth discontinuities.
 */

#include "../shared/structs.wgsl"

@group(0) @binding(0) var<uniform> frame: FrameUniforms;

@group(1) @binding(0) var s: sampler;
@group(1) @binding(1) var depthTex: texture_depth_2d;   // scene depth
@group(1) @binding(2) var aoTex: texture_2d<f32>;       // raw HBAO output

struct BlurParams {
    sharpness: f32,  // depth-aware edge sharpness (higher = sharper edges)
    _pad0:     f32,
    _pad1:     f32,
    _pad2:     f32,
};
@group(1) @binding(3) var<uniform> params: BlurParams;

/// Load AO value at pixel coordinates (textureLoad — no uniform-flow restriction).
fn loadAO(coords: vec2<i32>) -> f32 {
    let dim = vec2<i32>(textureDimensions(aoTex));
    let c = clamp(coords, vec2<i32>(0), dim - vec2<i32>(1));
    return textureLoad(aoTex, c, 0).r;
}

/// Linearize depth at pixel coordinates.
fn linearDepthAt(coords: vec2<i32>) -> f32 {
    let dim = textureDimensions(depthTex);
    let c = clamp(coords, vec2<i32>(0), vec2<i32>(dim) - vec2<i32>(1));
    let depth = textureLoad(depthTex, c, 0);

    let fDim = vec2<f32>(dim);
    let uvSample = (vec2<f32>(c) + 0.5) / fDim;
    let x = uvSample.x * 2.0 - 1.0;
    let y = (1.0 - uvSample.y) * 2.0 - 1.0;
    let clipPos = vec4<f32>(x, y, depth, 1.0);

    let worldRaw = frame.inverseViewProjectionMatrix * clipPos;
    let worldPos = worldRaw.xyz / worldRaw.w;
    let viewPos = frame.viewMatrix * vec4<f32>(worldPos, 1.0);
    return -viewPos.z;
}

@fragment
fn fs_main(@location(0) uv: vec2<f32>) -> @location(0) vec4<f32> {
    let aoDim = vec2<i32>(textureDimensions(aoTex));
    let center = vec2<i32>(floor(uv * vec2<f32>(aoDim)));

    // Sky guard
    let depthDim = textureDimensions(depthTex);
    let depthCoords = vec2<i32>(floor(uv * vec2<f32>(depthDim)));
    let rawDepth = textureLoad(depthTex, depthCoords, 0);
    if (rawDepth >= 0.9999) {
        return vec4<f32>(1.0);
    }

    let centerDepth = linearDepthAt(center);

    // 5×5 bilateral blur kernel
    var totalAO: f32 = 0.0;
    var totalWeight: f32 = 0.0;

    for (var x = -2; x <= 2; x++) {
        for (var y = -2; y <= 2; y++) {
            let coords = center + vec2<i32>(x, y);

            let sampleAO = loadAO(coords);
            let sampleDepth = linearDepthAt(coords);

            // Depth-based bilateral weight: reject samples at different depths
            let depthDiff = abs(centerDepth - sampleDepth);
            let depthWeight = exp(-depthDiff * params.sharpness);

            // Spatial Gaussian
            let spatialDist = length(vec2<f32>(f32(x), f32(y)));
            let spatialWeight = exp(-spatialDist * spatialDist * 0.2);

            let w = depthWeight * spatialWeight;
            totalAO += sampleAO * w;
            totalWeight += w;
        }
    }

    let ao = totalAO / max(totalWeight, 0.0001);
    return vec4<f32>(ao, ao, ao, 1.0);
}
