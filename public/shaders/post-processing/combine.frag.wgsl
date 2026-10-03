/**
 * @file combine.frag.wgsl
 * @description Combinaison finale propre (Sans slot fantôme).
 */

@group(0) @binding(0) var s: sampler;
@group(0) @binding(1) var sceneTex: texture_2d<f32>;
@group(0) @binding(2) var bloomTex: texture_2d<f32>;
@group(0) @binding(3) var ssaoTex: texture_2d<f32>;

// CORRECTION : On retire le binding inutile (defaultBlack)
// On remonte SSR en binding 4
@group(0) @binding(4) var ssrTex: texture_2d<f32>;

// On remonte Params en binding 5
@group(0) @binding(5) var<uniform> params: CombineParams; 

struct CombineParams {
    bloomIntensity: f32,
    fogIntensity: f32, // (Inutilisé pour l'instant, mais gardé en struct)
    ssrIntensity: f32,
};

@fragment
fn fs_main(@location(0) uv: vec2<f32>) -> @location(0) vec4<f32> {
    let sceneColor = textureSample(sceneTex, s, uv).rgb;
    let bloomColor = textureSample(bloomTex, s, uv).rgb;
    let ao = textureSample(ssaoTex, s, uv).r;
    let ssrColor   = textureSample(ssrTex, s, uv).rgb;

    let sceneOccluded = sceneColor * ao; 
    let sceneWithReflect = sceneOccluded + (ssrColor * params.ssrIntensity);
    let finalColor = sceneWithReflect + (bloomColor * params.bloomIntensity);

    return vec4(finalColor, 1.0);
}