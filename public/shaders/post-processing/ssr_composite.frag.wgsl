/**
 * @file ssr_composite.frag.wgsl
 * @description Additive composite of screen-space reflections over HDR scene color.
 */

@group(0) @binding(0) var s: sampler;
@group(0) @binding(1) var sceneTex: texture_2d<f32>;
@group(0) @binding(2) var ssrTex: texture_2d<f32>;

@fragment
fn fs_main(@location(0) uv: vec2<f32>) -> @location(0) vec4<f32> {
    let scene = textureSample(sceneTex, s, uv).rgb;
    let ssr = textureSample(ssrTex, s, uv).rgb;
    return vec4<f32>(scene + ssr, 1.0);
}
