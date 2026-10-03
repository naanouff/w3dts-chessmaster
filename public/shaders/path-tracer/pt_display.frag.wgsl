/**
 * Path tracer → swap chain: HDR (rgba16float) to displayable LDR.
 * Match raster tonemap (`tonemapping.frag.wgsl`): exposure × ACES fitted (no extra sRGB pow;
 * swap chain format handles display encoding where applicable).
 */
@group(0) @binding(0) var s: sampler;
@group(0) @binding(1) var hdrTex: texture_2d<f32>;

fn ACESFitted(color: vec3<f32>) -> vec3<f32> {
    let a = 2.51;
    let b = 0.03;
    let c = 2.43;
    let d = 0.59;
    let e = 0.14;
    return (color * (a * color + b)) / (color * (c * color + d) + e);
}

@fragment
fn fs_main(@location(0) uv: vec2<f32>) -> @location(0) vec4<f32> {
    let px = textureSample(hdrTex, s, uv);
    let a = clamp(px.a, 0.0, 1.0);
    let exposure = 1.0;
    /** Premultiplied HDR in .rgb when a < 1 (transparent-bg path trace). */
    var linearStraight = vec3<f32>(0.0);
    if (a > 1e-6) {
        linearStraight = (px.rgb * exposure) / a;
    }
    let ldr = ACESFitted(linearStraight);
    return vec4<f32>(ldr, a);
}
