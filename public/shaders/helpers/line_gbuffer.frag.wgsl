/**
 * @file line_gbuffer.frag.wgsl
 * @project w3dts
 * @description Helper lines for opaque passes with two color attachments (e.g. sceneColor rgba16float + normalBuffer rgba8unorm).
 */

struct FragmentInput {
    @location(0) frag_color: vec4<f32>,
};

struct LineGBufferOut {
    @location(0) color: vec4<f32>,
    @location(1) normal_pack: vec4<f32>,
}

@fragment
fn main(input: FragmentInput) -> LineGBufferOut {
    var out: LineGBufferOut;
    out.color = input.frag_color;
    // Match {@link solid_color_gbuffer.frag.wgsl} default normal encoding for unused G-buffer slots.
    out.normal_pack = vec4<f32>(0.5, 0.5, 1.0, 1.0);
    return out;
}
