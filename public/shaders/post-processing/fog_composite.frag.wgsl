/**
 * @file fog_composite.frag.wgsl
 * @description Applies the half-resolution haze. One sample, so the march is not blurred.
 */

@group(0) @binding(0) var s: sampler;
@group(0) @binding(1) var sceneTex: texture_2d<f32>;
@group(0) @binding(2) var fogTex: texture_2d<f32>;

@fragment
fn fs_main(@location(0) uv: vec2<f32>) -> @location(0) vec4<f32> {
    let scene = textureSample(sceneTex, s, uv);
    let fog = textureSample(fogTex, s, uv);
    return vec4<f32>(scene.rgb * fog.a + fog.rgb, scene.a);
}
