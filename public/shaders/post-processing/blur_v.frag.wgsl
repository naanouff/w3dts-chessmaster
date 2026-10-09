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
    let offsetDir = vec2<f32>(0.0, 1.0);
    // One texel per tap. Spacing the taps by `radius` stamped a grid of the neon.
    // `radius` is the gaussian sigma, in texels of this half-resolution buffer.
    let sigma = max(radius, 0.5);
    let taps = i32(ceil(sigma * 3.0));
    var result = vec4<f32>(0.0);
    var weightSum = 0.0;
    for (var i: i32 = -taps; i <= taps; i = i + 1) {
        let x = f32(i);
        let w = exp(-0.5 * (x * x) / (sigma * sigma));
        result += textureSample(t, s, uv + texelSize * offsetDir * x) * w;
        weightSum += w;
    }
    return result / max(weightSum, 1e-5);
}
