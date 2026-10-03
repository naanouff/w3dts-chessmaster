/**
 * @file cad_cavity_combine.frag.wgsl
 * @description Applies screen-space ambient occlusion as a Blender-like **World cavity** term on HDR
 * scene color before tone mapping. `aoTex` is the blurred SSAO mask (R channel, ~1 = unoccluded).
 *
 * **Normal / depth data**: occlusion itself is computed in `ssao.frag.wgsl`, which samples
 * `normalBuffer` (normals encoded 0–1, decoded to [-1,1] in view space) and `sceneDepth`.
 */

struct CadWorldCavityParams {
  /** 0 = no AO; 1 = full multiply by `ao` (standard SSAO combine). */
  strength: f32,
  _pad0: f32,
  _pad1: f32,
  _pad2: f32,
};

@group(0) @binding(0) var s: sampler;
@group(0) @binding(1) var sceneTex: texture_2d<f32>;
@group(0) @binding(2) var aoTex: texture_2d<f32>;
@group(0) @binding(3) var<uniform> params: CadWorldCavityParams;

@fragment
fn fs_main(@location(0) uv: vec2<f32>) -> @location(0) vec4<f32> {
    let hdr = textureSample(sceneTex, s, uv).rgb;
    let ao = clamp(textureSample(aoTex, s, uv).r, 0.0, 1.0);
    let mixed_ao = mix(1.0, ao, clamp(params.strength, 0.0, 1.0));
    return vec4<f32>(hdr * mixed_ao, 1.0);
}
