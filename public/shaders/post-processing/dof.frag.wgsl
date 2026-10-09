/**
 * @file dof.frag.wgsl
 * @description Disk blur around a world focus point. The review puts that point on the board.
 */

#include "../shared/structs.wgsl"

@group(0) @binding(0) var<uniform> frame: FrameUniforms;

@group(1) @binding(0) var s: sampler;
@group(1) @binding(1) var inputTex: texture_2d<f32>;
@group(1) @binding(2) var depthTex: texture_depth_2d;

struct DoFParams {
    focusX: f32,
    focusY: f32,
    focusZ: f32,
    focusRange: f32,
    blurRadius: f32,
}
@group(1) @binding(3) var<uniform> params: DoFParams;
@group(1) @binding(4) var<uniform> dofSlot: f32;

fn linearDepth(uv: vec2<f32>) -> f32 {
    let dim = textureDimensions(depthTex);
    let coords = vec2<i32>(floor(uv * vec2<f32>(dim)));
    let depth = textureLoad(depthTex, coords, 0);
    let x = uv.x * 2.0 - 1.0;
    let y = (1.0 - uv.y) * 2.0 - 1.0;
    let clipPos = vec4<f32>(x, y, depth, 1.0);
    let worldRaw = frame.inverseViewProjectionMatrix * clipPos;
    let worldPos = worldRaw.xyz / max(worldRaw.w, 1e-4);
    let viewPos = frame.viewMatrix * vec4<f32>(worldPos, 1.0);
    return -viewPos.z;
}

fn luminance(color: vec3<f32>) -> f32 {
    return dot(color, vec3<f32>(0.2126, 0.7152, 0.0722));
}

/** Energy above display white is a reflection. It stays on its own pixel. */
fn withoutReflection(color: vec3<f32>) -> vec3<f32> {
    let lum = max(luminance(color), 1e-3);
    return color * min(lum, 1.0) / lum;
}

@fragment
fn fs_main(@location(0) uv: vec2<f32>) -> @location(0) vec4<f32> {
    let dim = vec2<f32>(textureDimensions(inputTex));
    let pixelSize = vec2<f32>(1.0 / dim.x, 1.0 / dim.y);
    let centerDepth = linearDepth(uv);
    let centerColor = textureSampleLevel(inputTex, s, uv, 0.0).rgb;
    let centerBase = withoutReflection(centerColor);
    let centerGlint = centerColor - centerBase;

    let focusWorld = vec3<f32>(params.focusX, params.focusY, params.focusZ);
    let focusView = frame.viewMatrix * vec4<f32>(focusWorld, 1.0);
    let focusDistance = -focusView.z;
    let dist = abs(centerDepth - focusDistance);
    let coc = smoothstep(params.focusRange, params.focusRange * 2.0, dist) * dofSlot;

    if (coc < 0.01) {
        return vec4<f32>(centerColor, 1.0);
    }

    var finalColor = vec3<f32>(0.0);
    var totalWeight = 0.0;
    let goldenAngle = 2.39996323;
    let maxRadius = params.blurRadius * coc;
    let iterations = 16.0;

    for (var i = 0.0; i < iterations; i += 1.0) {
        let theta = i * goldenAngle;
        let r = sqrt(i / iterations) * maxRadius;
        let offset = vec2<f32>(cos(theta), sin(theta)) * r * pixelSize;
        let sampleColor = withoutReflection(textureSampleLevel(inputTex, s, uv + offset, 0.0).rgb);
        finalColor += sampleColor;
        totalWeight += 1.0;
    }

    return vec4<f32>(finalColor / max(totalWeight, 1e-4) + centerGlint, 1.0);
}
