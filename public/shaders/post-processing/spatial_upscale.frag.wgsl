/**
 * @file spatial_upscale.frag.wgsl
 * @description Magnifies a smaller render and sharpens edges. Flat areas stay soft.
 */

@group(0) @binding(0) var samp: sampler;
@group(0) @binding(1) var srcTex: texture_2d<f32>;
@group(0) @binding(2) var<uniform> sharpness: f32;

@fragment
fn fs_main(@location(0) uv: vec2<f32>) -> @location(0) vec4<f32> {
    let dims = max(vec2<f32>(textureDimensions(srcTex)), vec2<f32>(1.0));
    let px = 1.0 / dims.x;
    let py = 1.0 / dims.y;

    let c = textureSample(srcTex, samp, uv);
    let b = textureSample(srcTex, samp, uv + vec2<f32>(0.0, -py));
    let d = textureSample(srcTex, samp, uv + vec2<f32>(-px, 0.0));
    let e = textureSample(srcTex, samp, uv + vec2<f32>(px, 0.0));
    let f = textureSample(srcTex, samp, uv + vec2<f32>(0.0, py));

    let min_c = min(c, min(min(b, d), min(e, f)));
    let max_c = max(c, max(max(b, d), max(e, f)));
    let contrast = max_c - min_c;
    let lum = dot(vec3<f32>(0.299, 0.587, 0.114), contrast.rgb);
    let w = sharpness * clamp(lum * 4.0, 0.0, 1.0);
    let lap = (b + d + e + f) * 0.25 - c;
    var out_rgb = c.rgb - lap.rgb * w;
    out_rgb = clamp(out_rgb, vec3<f32>(0.0), vec3<f32>(1.0));
    return vec4<f32>(out_rgb, c.a);
}
