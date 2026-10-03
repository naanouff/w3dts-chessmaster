/**
 * Blends raster HDR (`sceneColor`) with path-traced `pathTraceComposite` (no FSR).
 * @binding(0) sampler, (1) sceneColor, (2) pathTraceComposite, (3) hybridStrength, (4) hybridPtUvScale
 */

@group(0) @binding(0) var s: sampler;
@group(0) @binding(1) var sceneTex: texture_2d<f32>;
@group(0) @binding(2) var ptTex: texture_2d<f32>;
@group(0) @binding(3) var<uniform> hybridStrength: f32;
@group(0) @binding(4) var<uniform> hybridPtUvScale: vec4<f32>;

@fragment
fn fs_main(@location(0) uv: vec2<f32>) -> @location(0) vec4<f32> {
    let cR = textureSample(sceneTex, s, uv).rgb;
    let uvPt = uv * hybridPtUvScale.xy;
    let cP = textureSample(ptTex, s, uvPt).rgb;
    let w = clamp(hybridStrength, 0.0, 1.0);
    let outRgb = mix(cR, cP, w);
    return vec4<f32>(outRgb, 1.0);
}
