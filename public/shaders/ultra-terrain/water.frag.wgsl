// Ultra Terrain — water surface fragment shader (TER-A4)
// Fresnel + Beer-Lambert absorption + shore foam + SSR refraction snapshot.

#include "water_common.wgsl"

struct FrameUniforms {
    projectionMatrix           : mat4x4<f32>,
    viewMatrix                 : mat4x4<f32>,
    inverseViewProjectionMatrix: mat4x4<f32>,
    cameraPosition             : vec3<f32>,
    @size(64) lightMatrix      : mat4x4<f32>,
    lightDirection             : vec3<f32>,
    lightColor                 : vec3<f32>,
    ambientLightIntensity      : f32,
    debugViewMode              : u32,
    totalTime                  : f32,
};

struct WaterBodyParams {
    kind         : f32,
    waterLevel   : f32,
    centerX      : f32,
    centerZ      : f32,
    radius       : f32,
    shoreWidth   : f32,
    waveAmp      : f32,
    waveFreq     : f32,
    absorption   : vec3<f32>,
    _padA        : f32,
    shallowColor : vec3<f32>,
    _padB        : f32,
    deepColor    : vec3<f32>,
    _padC        : f32,
};

struct WaterSceneParams {
    heightmapOriginX : f32,
    heightmapOriginZ : f32,
    heightmapWorldSize : f32,
    heightmapResolution : f32,
};

struct VertexOutput {
    @builtin(position) clipPosition : vec4<f32>,
    @location(0) worldPos         : vec3<f32>,
    @location(1) uv                 : vec2<f32>,
    @location(2) worldNormal        : vec3<f32>,
};

@group(0) @binding(0) var<uniform> frame : FrameUniforms;
@group(1) @binding(0) var<uniform> body  : WaterBodyParams;
@group(1) @binding(1) var<uniform> scene : WaterSceneParams;
@group(1) @binding(2) var          texSampler : sampler;
@group(1) @binding(3) var          heightmap  : texture_2d<f32>;
@group(1) @binding(4) var          sceneRefract : texture_2d<f32>;

fn aces_tonemap(x: vec3<f32>) -> vec3<f32> {
    let a = 2.51;
    let b = 0.03;
    let c = 2.43;
    let d = 0.59;
    let e = 0.14;
    return clamp((x * (a * x + b)) / (x * (c * x + d) + e), vec3<f32>(0.0), vec3<f32>(1.0));
}

@fragment
fn main(input: VertexOutput) -> @location(0) vec4<f32> {
    let worldXZ = input.worldPos.xz;
    let terrainH = sample_terrain_height(
        worldXZ,
        heightmap,
        vec2<f32>(scene.heightmapOriginX, scene.heightmapOriginZ),
        scene.heightmapWorldSize,
    );

    // Clip water above terrain (no underwater sheets).
    if (terrainH > body.waterLevel + 0.15) {
        discard;
    }

    // Lake / pond horizontal basin clip.
    if (body.kind > 0.5 && body.kind < 2.5) {
        let d = length(worldXZ - vec2<f32>(body.centerX, body.centerZ));
        if (d > body.radius) {
            discard;
        }
        // Pond: softer edge fade.
        if (body.kind > 1.5 && d > body.radius * 0.92) {
            discard;
        }
    }

    // River: clip outside ribbon banks (uv.y is -1..+1 across width).
    if (body.kind > 2.5 && body.kind < 3.5) {
        if (abs(input.uv.y) > 1.02) {
            discard;
        }
    }

    let depth = max(body.waterLevel - terrainH, 0.0);
    let depthNorm = clamp(depth / 12.0, 0.0, 1.0);

    let V = normalize(frame.cameraPosition - input.worldPos);
    let N = normalize(input.worldNormal);
    let NdotV = max(dot(N, V), 0.0);
    let fresnel = fresnel_schlick(NdotV, 0.02);

    let waterTint = mix(body.shallowColor, body.deepColor, depthNorm);
    let absorb = beer_lambert(body.absorption, depth);
    let baseColor = waterTint * absorb;

    // Screen-space refraction (sceneColorRefract is LDR post-tonemap in game graph path).
    let refractUv = input.clipPosition.xy / input.clipPosition.w * vec2<f32>(0.5, -0.5) + vec2<f32>(0.5, 0.5);
    let refracted = textureSampleLevel(sceneRefract, texSampler, refractUv, 0.0).rgb;
    let refractMix = (1.0 - fresnel) * 0.55;

    let foam = shore_foam(depth, body.shoreWidth);
    let foamColor = vec3<f32>(0.85, 0.9, 0.88);

    var color = mix(baseColor, refracted, refractMix);
    color = mix(color, foamColor, foam * 0.65);

    // River: flow-map streak foam + bank white water (TER-A5).
    if (body.kind > 2.5 && body.kind < 3.5) {
        let flowFoam = river_flow_foam(input.uv, frame.totalTime, body.waveFreq);
        let bankFoam = river_bank_foam(input.uv.y, body.shoreWidth);
        color = mix(color, foamColor, flowFoam * 0.45 + bankFoam * 0.35);
        color += frame.lightColor * flowFoam * 0.08;
    }

    // Subtle sun specular on ocean.
    if (body.kind < 0.5) {
        let L = normalize(-frame.lightDirection);
        let H = normalize(V + L);
        let spec = pow(max(dot(N, H), 0.0), 128.0) * 0.35;
        color += frame.lightColor * spec;
    }

    // Pond: greener scatter.
    if (body.kind > 1.5 && body.kind < 2.5) {
        color = mix(color, body.shallowColor * 1.2, 0.25);
    }

    var alpha = mix(0.75, 0.92, fresnel);
    if (body.kind > 0.5 && body.kind < 2.5) {
        let d = length(worldXZ - vec2<f32>(body.centerX, body.centerZ));
        let rim = smoothstep(body.radius * 0.88, body.radius, d);
        alpha *= 1.0 - rim * 0.35;
    }

    return vec4<f32>(aces_tonemap(color), alpha);
}
