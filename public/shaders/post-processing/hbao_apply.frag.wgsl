/**
 * @file hbao_apply.frag.wgsl
 * @description Multiplies the blurred HBAO occlusion into the HDR scene color.
 *
 * Placed between transparents and tone mapping so AO affects the full scene
 * in linear HDR space.
 */

@group(0) @binding(0) var s: sampler;
@group(0) @binding(1) var sceneTex: texture_2d<f32>;   // sceneColor (HDR)
@group(0) @binding(2) var aoTex: texture_2d<f32>;      // blurred HBAO

@fragment
fn fs_main(@location(0) uv: vec2<f32>) -> @location(0) vec4<f32> {
    let color = textureSample(sceneTex, s, uv);
    let ao = textureSample(aoTex, s, uv).r;
    return vec4<f32>(color.rgb * ao, color.a);
}
