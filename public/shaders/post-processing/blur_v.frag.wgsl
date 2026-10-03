/**
 * @file Fragment shader for applying a Gaussian blur in the vertical direction.
 * It is designed to be used in a separable Gaussian blur pipeline, as a complement
 * to the horizontal blur shader.
 * @author Cyril Tarriet
 */

/**
 * Bind group 0 contains the sampler, input texture, blur radius, and resolution.
 * @group(0) @binding(0)
 */
@group(0) @binding(0) var s: sampler;
/**
 * The input texture to which the blur will be applied.
 * @group(0) @binding(1)
 */
@group(0) @binding(1) var t: texture_2d<f32>;
/**
 * The radius of the blur.
 * @group(0) @binding(2)
 */
@group(0) @binding(2) var<uniform> radius: f32;
/**
 * The resolution of the input texture.
 * @group(0) @binding(3)
 */
@group(0) @binding(3) var<uniform> resolution: vec2<f32>;

/**
 * The main entry point for the fragment shader.
 * @param uv The UV coordinates of the fragment.
 * @returns The output color with the blur applied.
 */
@fragment
fn fs_main(@location(0) uv: vec2<f32>) -> @location(0) vec4<f32> {
    let texelSize = 1.0 / resolution;
    // The offset direction is hard-coded for vertical blur.
    let offsetDir = vec2<f32>(0.0, 1.0);
    // The weights for a 5x5 Gaussian kernel, pre-calculated for efficiency.
    let weights = array<f32, 5>(0.227027, 0.1945946, 0.1216216, 0.054054, 0.016216);
    // The first sample is the center pixel, with the highest weight.
    var result = textureSample(t, s, uv) * weights[0];

    // Loop to sample neighboring pixels above and below.
    for (var i: u32 = 1u; i < 5u; i = i + 1u) {
        let sampleOffset = texelSize * offsetDir * f32(i) * radius;
        // Add the weighted colors from both sides of the center pixel.
        result += (textureSample(t, s, uv + sampleOffset) + textureSample(t, s, uv - sampleOffset)) * weights[i];
    }

    return result;
}
