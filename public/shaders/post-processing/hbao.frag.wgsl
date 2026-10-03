/**
 * @file hbao.frag.wgsl
 * @description Horizon-Based Ambient Occlusion (HBAO).
 *
 * Traces rays along the horizon in screen-space using the depth buffer
 * and normal buffer to compute per-pixel ambient occlusion.
 *
 * Reference: Bavoil, Sainz – "Image-Space Horizon-Based Ambient Occlusion" (2008)
 */

#include "../shared/structs.wgsl"

// --- GROUP 0 : GLOBAL FRAME ---
@group(0) @binding(0) var<uniform> frame: FrameUniforms;

// --- GROUP 1 : LOCAL RESOURCES ---
@group(1) @binding(0) var s: sampler;
@group(1) @binding(1) var depthTex: texture_depth_2d;
@group(1) @binding(2) var normalTex: texture_2d<f32>;

struct HBAOParams {
    radius:      f32,  // world-space AO radius
    intensity:   f32,  // occlusion strength multiplier
    bias:        f32,  // angle bias (radians) to reduce self-occlusion
    numSteps:    f32,  // ray-march steps per direction (cast to i32)
};
@group(1) @binding(3) var<uniform> params: HBAOParams;

// ─── Constants ───────────────────────────────────────────────────────────────
const PI: f32 = 3.14159265;
const NUM_DIRECTIONS: i32 = 8;

// ─── Helpers ─────────────────────────────────────────────────────────────────

/// Hash-based pseudo-random for spatial noise (avoid banding).
fn interleavedGradientNoise(pixelCoord: vec2<f32>) -> f32 {
    let magic = vec3<f32>(0.06711056, 0.00583715, 52.9829189);
    return fract(magic.z * fract(dot(pixelCoord, magic.xy)));
}

/// Reconstruct view-space position from UV + depth buffer.
fn getViewPos(uv: vec2<f32>) -> vec3<f32> {
    let dim = textureDimensions(depthTex);
    let coords = vec2<i32>(floor(uv * vec2<f32>(dim)));
    let depth = textureLoad(depthTex, coords, 0);

    let x = uv.x * 2.0 - 1.0;
    let y = (1.0 - uv.y) * 2.0 - 1.0;
    let clipPos = vec4<f32>(x, y, depth, 1.0);

    let worldRaw = frame.inverseViewProjectionMatrix * clipPos;
    let worldPos = worldRaw.xyz / worldRaw.w;

    let viewPos = frame.viewMatrix * vec4<f32>(worldPos, 1.0);
    return viewPos.xyz;
}

/// Get raw depth value at UV.
fn getRawDepth(uv: vec2<f32>) -> f32 {
    let dim = textureDimensions(depthTex);
    let coords = vec2<i32>(floor(uv * vec2<f32>(dim)));
    return textureLoad(depthTex, coords, 0);
}

/// Decode view-space normal from the opaque MRT (see `graph_templates/main_shader.wgsl`: RGB encodes
/// `viewNormal * 0.5 + 0.5`; alpha carries shadow factor and is ignored here).
fn getViewNormal(uv: vec2<f32>) -> vec3<f32> {
    let dim = textureDimensions(normalTex);
    let coords = vec2<i32>(floor(uv * vec2<f32>(dim)));
    let nView = textureLoad(normalTex, coords, 0).xyz * 2.0 - 1.0;
    return normalize(nView);
}

// ─── Main ────────────────────────────────────────────────────────────────────

@fragment
fn fs_main(@location(0) uv: vec2<f32>) -> @location(0) vec4<f32> {
    // Sky guard
    let rawDepth = getRawDepth(uv);
    if (rawDepth >= 0.9999) {
        return vec4<f32>(1.0);
    }

    let dim = vec2<f32>(textureDimensions(depthTex));
    let texelSize = 1.0 / dim;
    let pixelCoord = uv * dim;

    let P = getViewPos(uv);
    let N = getViewNormal(uv);

    let numSteps = i32(params.numSteps);

    // Project AO radius from world-space to screen-space (pixels).
    // In view space, Z is negative forward. Use |P.z| as distance.
    let projScale = dim.y * 0.5 * frame.projectionMatrix[1][1];
    let screenRadius = (params.radius * projScale) / max(abs(P.z), 0.1);

    // Clamp to avoid excessive marching at close range
    let clampedRadius = clamp(screenRadius, 3.0, 128.0);
    let stepSize = clampedRadius / f32(numSteps);

    // Random rotation per-pixel to break banding
    let noise = interleavedGradientNoise(pixelCoord);

    var occlusion: f32 = 0.0;

    for (var d = 0; d < NUM_DIRECTIONS; d++) {
        // Uniformly distributed directions with per-pixel jitter
        let angle = (f32(d) + noise) * (2.0 * PI / f32(NUM_DIRECTIONS));
        let dir = vec2<f32>(cos(angle), sin(angle));

        // Track highest horizon angle (tangent angle from the surface)
        var maxHorizon: f32 = params.bias;

        for (var step = 1; step <= numSteps; step++) {
            let offset = dir * (f32(step) * stepSize) * texelSize;
            let sampleUV = uv + offset;

            // Bounds check
            if (sampleUV.x < 0.0 || sampleUV.x > 1.0 ||
                sampleUV.y < 0.0 || sampleUV.y > 1.0) {
                break;
            }

            let sampleDepth = getRawDepth(sampleUV);
            if (sampleDepth >= 0.9999) {
                continue;
            }

            let S = getViewPos(sampleUV);
            let delta = S - P;
            let dist = length(delta);

            // Skip samples beyond AO radius to avoid distant false occlusion
            if (dist > params.radius) {
                continue;
            }

            // Horizon angle: angle between the surface normal plane and the
            // direction to the sample. atan2(height above tangent, distance).
            let horizonAngle = atan2(dot(delta, N), length(delta - N * dot(delta, N)));

            if (horizonAngle > maxHorizon) {
                // Distance-based attenuation (smooth falloff at edges of AO radius)
                let falloff = 1.0 - (dist / params.radius) * (dist / params.radius);

                occlusion += (sin(horizonAngle) - sin(maxHorizon)) * falloff;
                maxHorizon = horizonAngle;
            }
        }
    }

    occlusion = occlusion / f32(NUM_DIRECTIONS);
    occlusion = clamp(occlusion * params.intensity, 0.0, 1.0);

    let ao = 1.0 - occlusion;
    return vec4<f32>(ao, ao, ao, 1.0);
}
