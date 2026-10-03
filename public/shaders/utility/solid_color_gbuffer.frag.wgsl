/**
 * @file solid_color_gbuffer.frag.wgsl
 * @project w3dts
 * @author Cyril TARRIET
 * @date 2025-01-16
 * @description Fragment shader fallback pour les passes G-Buffer avec 2 color attachments.
 * Utilisé comme fallback pendant la compilation asynchrone des pipelines.
 */

struct GBufferOutput {
    @location(0) color: vec4<f32>,
    @location(1) normal: vec4<f32>,
}

@fragment
fn main() -> GBufferOutput {
    var output: GBufferOutput;
    output.color = vec4<f32>(1.0, 0.0, 1.0, 1.0);  // Magenta pour identifier le fallback
    output.normal = vec4<f32>(0.5, 0.5, 1.0, 1.0); // Normal par défaut (up)
    return output;
}
