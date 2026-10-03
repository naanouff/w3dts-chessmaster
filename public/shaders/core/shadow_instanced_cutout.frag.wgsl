// shadow_instanced_cutout.frag.wgsl
// Fragment stage for the instanced alpha-cutout shadow pass.
// Discards fragments whose alpha is below the threshold so vegetation
// casts accurate silhouette shadows instead of solid quads.

@group(1) @binding(0) var smp: sampler;
@group(1) @binding(1) var albedoTex: texture_2d<f32>;

@fragment
fn fs_main(@location(0) uv: vec2<f32>) {
    let alpha = textureSample(albedoTex, smp, uv).a;
    // Hard threshold matching the material alphaCutoff default (0.5).
    // We use 0.5 here; the main pass uses material.alphaCutoff which may differ,
    // but for shadows a conservative mid-point gives clean silhouettes.
    if (alpha < 0.5) {
        discard;
    }
}
