// shadow_cutout.frag.wgsl
// Fragment stage for the non-instanced alpha-cutout shadow pass.
// group(2) is used because group(0)=frame and group(1)=object uniforms.

@group(2) @binding(0) var smp: sampler;
@group(2) @binding(1) var albedoTex: texture_2d<f32>;

@fragment
fn fs_main(@location(0) uv: vec2<f32>) {
    let alpha = textureSample(albedoTex, smp, uv).a;
    if (alpha < 0.5) {
        discard;
    }
}
