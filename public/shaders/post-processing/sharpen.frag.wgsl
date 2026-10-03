/**
 * @file sharpen.frag.wgsl
 * @description Filtre de netteté simple.
 * Correction : Tous les bindings dans le Group 0 car 'useFrameUniforms' est false.
 */

@group(0) @binding(0) var s: sampler;
@group(0) @binding(1) var inputTex: texture_2d<f32>;

struct SharpenParams {
    amount: f32,
};

// CORRECTION : On passe en Group 0, Binding 2 (pour suivre l'exécuteur)
@group(0) @binding(2) var<uniform> params: SharpenParams;

@fragment
fn fs_main(@location(0) uv: vec2<f32>) -> @location(0) vec4<f32> {
    let dim = vec2<f32>(textureDimensions(inputTex));
    let pixel = vec2<f32>(1.0 / dim.x, 1.0 / dim.y);

    let center = textureSample(inputTex, s, uv).rgb;
    let up     = textureSample(inputTex, s, uv + vec2(0.0, -pixel.y)).rgb;
    let down   = textureSample(inputTex, s, uv + vec2(0.0, pixel.y)).rgb;
    let left   = textureSample(inputTex, s, uv + vec2(-pixel.x, 0.0)).rgb;
    let right  = textureSample(inputTex, s, uv + vec2(pixel.x, 0.0)).rgb;

    let edge = center * 4.0 - (up + down + left + right);

    let sharpened = center + edge * params.amount;

    return vec4<f32>(sharpened, 1.0);
}