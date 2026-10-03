/**
 * @file tonemapping-alpha.frag.wgsl
 * @description Tone mapping that preserves sceneColor alpha (transparent hero backgrounds).
 */

@group(0) @binding(0) var s: sampler;
@group(0) @binding(1) var hdrTex: texture_2d<f32>;
@group(0) @binding(2) var<uniform> exposure: f32;

fn ACESFitted(color: vec3<f32>) -> vec3<f32> {
    let a = 2.51; let b = 0.03; let c = 2.43; let d = 0.59; let e = 0.14;
    let new_color = (color * (a * color + b)) / (color * (c * color + d) + e);
    return new_color;
}

@fragment
fn fs_main(@location(0) uv: vec2<f32>) -> @location(0) vec4<f32> {
    let sample = textureSample(hdrTex, s, uv);
    var hdrColor = sample.rgb;
    hdrColor = hdrColor * exposure;
    let finalColor = ACESFitted(hdrColor);
    return vec4(finalColor, sample.a);
}
