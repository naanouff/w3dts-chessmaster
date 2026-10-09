/**
 * @file volumetric_fog.frag.wgsl
 * @description Height fog by raymarch. Each step samples the shadow atlas (directional CSM or point face).
 */

#include "../shared/structs.wgsl"

@group(0) @binding(0) var<uniform> frame: FrameUniforms;
@group(0) @binding(1) var<storage, read> sceneLights: SceneLights;

@group(1) @binding(0) var s: sampler;
@group(1) @binding(1) var depthTex: texture_depth_2d;

struct FogParams {
    density: f32,
    heightFalloff: f32,
    height: f32,
    scattering: f32,
    steps: f32,
};
@group(1) @binding(2) var<uniform> params: FogParams;

@group(2) @binding(0) var shadowMap: texture_depth_2d_array;
@group(2) @binding(1) var shadowSampler: sampler_comparison;
@group(2) @binding(2) var<uniform> shadowData: ShadowUniforms;

fn worldPosFromDepth(uv: vec2<f32>) -> vec3<f32> {
    let dim = textureDimensions(depthTex);
    let coords = vec2<i32>(floor(uv * vec2<f32>(dim)));
    let depth = textureLoad(depthTex, coords, 0);
    let x = uv.x * 2.0 - 1.0;
    let y = (1.0 - uv.y) * 2.0 - 1.0;
    let clipPos = vec4<f32>(x, y, depth, 1.0);
    let worldPosRaw = frame.inverseViewProjectionMatrix * clipPos;
    return worldPosRaw.xyz / worldPosRaw.w;
}

fn cascadeIndex(worldPos: vec3<f32>) -> i32 {
    let viewPos = frame.viewMatrix * vec4<f32>(worldPos, 1.0);
    let depth = -viewPos.z;
    if (depth < frame.cascadeSplits.x) { return 0; }
    if (depth < frame.cascadeSplits.y) { return 1; }
    if (depth < frame.cascadeSplits.z) { return 2; }
    return 3;
}

fn pointFace(dir: vec3<f32>) -> i32 {
    let a = abs(dir);
    if (a.x >= a.y && a.x >= a.z) {
        return select(1, 0, dir.x >= 0.0);
    }
    if (a.y >= a.z) {
        return select(3, 2, dir.y >= 0.0);
    }
    return select(5, 4, dir.z >= 0.0);
}

/** One comparison tap. Same atlas and cascade/face choice as fetchShadow. */
fn sampleShadow(
    lightType: u32,
    baseShadowIndex: i32,
    worldPos: vec3<f32>,
    lightWorldPos: vec3<f32>
) -> f32 {
    if (baseShadowIndex < 0) { return 1.0; }
    var layer = baseShadowIndex;
    if (lightType == 0u) {
        layer = baseShadowIndex + cascadeIndex(worldPos);
    } else if (lightType == 1u) {
        layer = baseShadowIndex + pointFace(worldPos - lightWorldPos);
    }
    if (layer < 0 || layer >= 8) { return 1.0; }

    let shadowPos = shadowData.matrices[layer] * vec4<f32>(worldPos, 1.0);
    let shadowNDC = shadowPos.xyz / shadowPos.w;
    let uv = vec2<f32>(shadowNDC.x * 0.5 + 0.5, -shadowNDC.y * 0.5 + 0.5);
    if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0 || shadowNDC.z < 0.0 || shadowNDC.z > 1.0) {
        // Outside the atlas the air stays lit. The board map does not cover the room.
        return 1.0;
    }
    return textureSampleCompareLevel(shadowMap, shadowSampler, uv, layer, shadowNDC.z - 0.0004);
}

/** Directional, point, and spot. A spot is the key in every room. */
fn spotCone(toLight: vec3<f32>, axis: vec3<f32>, innerCos: f32, outerCos: f32) -> f32 {
    let actualCos = dot(normalize(axis), normalize(-toLight));
    if (actualCos > outerCos) {
        if (actualCos < innerCos) {
            let angular = (actualCos - outerCos) / max(innerCos - outerCos, 1e-4);
            return angular * angular;
        }
        return 1.0;
    }
    return 0.0;
}

fn rangeWindow(dist: f32, range: f32) -> f32 {
    let d = max(dist, 1e-4);
    let invSq = 1.0 / (d * d);
    if (range <= 0.0) { return invSq; }
    let ratio = d / range;
    let window = max(min(1.0 - ratio * ratio * ratio * ratio, 1.0), 0.0);
    return window * invSq;
}

fn scatteredLight(worldPos: vec3<f32>, rayDir: vec3<f32>) -> vec3<f32> {
    var lit = vec3<f32>(0.0);
    let count = min(sceneLights.lightCount, 8u);
    for (var i = 0u; i < count; i++) {
        let raw = sceneLights.lights[i];
        let lightType = u32(raw.colorAndType.w + 0.1);
        if (lightType != 0u && lightType != 1u && lightType != 2u) { continue; }
        var attenuation = 1.0;
        if (lightType == 0u) {
            // The glow sits toward the source. On the terrace that source is the moon.
            let toward = normalize(-raw.dirAndIntensity.xyz);
            let align = max(dot(rayDir, toward), 0.0);
            attenuation = pow(align, 12.0);
        } else if (lightType == 1u || lightType == 2u) {
            let toLight = raw.positionAndRange.xyz - worldPos;
            attenuation = rangeWindow(length(toLight), raw.positionAndRange.w);
            if (lightType == 2u) {
                attenuation *= spotCone(toLight, raw.dirAndIntensity.xyz, raw.params.x, raw.params.y);
            }
        }
        if (attenuation <= 0.0) { continue; }
        let shadowIndex = i32(raw.params.z);
        let shadow = sampleShadow(lightType, shadowIndex, worldPos, raw.positionAndRange.xyz);
        lit += raw.colorAndType.rgb * raw.dirAndIntensity.w * attenuation * shadow;
    }
    return lit;
}

@fragment
fn fs_main(@location(0) uv: vec2<f32>) -> @location(0) vec4<f32> {
    let worldPos = worldPosFromDepth(uv);
    let camPos = frame.cameraPosition;
    let rayVector = worldPos - camPos;
    let rayLength = length(rayVector);
    let rayDir = rayVector / max(rayLength, 1e-4);
    let marchLen = min(rayLength, 8.0);

    let stepCount = i32(clamp(params.steps, 1.0, 48.0));
    let stepSize = marchLen / f32(stepCount);
    let dither = fract(sin(dot(uv, vec2(12.9898, 78.233))) * 43758.5453);
    var currentPos = camPos + rayDir * (stepSize * dither);

    var inscatter = vec3<f32>(0.0);
    var optical = 0.0;

    for (var i = 0; i < stepCount; i++) {
        let heightFactor = max(0.0, currentPos.y - params.height);
        let localDensity = params.density * exp(-params.heightFalloff * heightFactor);
        let light = scatteredLight(currentPos, rayDir);
        inscatter += light * localDensity * stepSize * params.scattering;
        optical += localDensity * stepSize;
        currentPos += rayDir * stepSize;
    }

    let transmittance = exp(-optical);
    return vec4<f32>(inscatter, transmittance);
}
