/**
 * @file bloom_add.frag.wgsl
 * @description Additive bloom composite (HDR scene + blurred bright pass).
 */

@group(0) @binding(0) var s: sampler;
@group(0) @binding(1) var sceneTex: texture_2d<f32>;
@group(0) @binding(2) var bloomTex: texture_2d<f32>;
@group(0) @binding(3) var<uniform> intensity: f32;

@fragment
fn fs_main(@location(0) uv: vec2<f32>) -> @location(0) vec4<f32> {
    let scene = textureSample(sceneTex, s, uv).rgb;
    let bloom = textureSample(bloomTex, s, uv).rgb;
    return vec4<f32>(scene + bloom * intensity, 1.0);
}
