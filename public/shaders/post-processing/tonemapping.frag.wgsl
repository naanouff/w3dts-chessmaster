/**
 * @file Fragment shader for applying a tone mapping algorithm to an HDR texture.
 * It converts the image's color range from High Dynamic Range (HDR) to a
 * Low Dynamic Range (LDR) suitable for display.
 * @author Cyril Tarriet
 */

/**
 * Bind group 0 contains the sampler, the input HDR texture, and the exposure value.
 * @group(0) @binding(0)
 */
@group(0) @binding(0) var s: sampler;
/**
 * The input High Dynamic Range (HDR) texture.
 * @group(0) @binding(1)
 */
@group(0) @binding(1) var hdrTex: texture_2d<f32>;
/**
 * The exposure value, used to adjust the image's brightness.
 * @group(0) @binding(2)
 */
@group(0) @binding(2) var<uniform> exposure: f32;

/**
 * Applies an approximation of the ACES filmic tone mapping curve.
 * This compresses the wide range of HDR colors into the displayable LDR range.
 * @param color The input HDR color.
 * @returns The output tone-mapped color.
 */
fn ACESFitted(color: vec3<f32>) -> vec3<f32> {
    let a = 2.51; let b = 0.03; let c = 2.43; let d = 0.59; let e = 0.14;
    // ACES filmic curve approximation
    let new_color = (color * (a * color + b)) / (color * (c * color + d) + e);
    return new_color;
}

/**
 * The main entry point for the fragment shader.
 * @param uv The UV coordinates of the fragment.
 * @returns The final LDR output color of the fragment.
 */
@fragment
fn fs_main(@location(0) uv: vec2<f32>) -> @location(0) vec4<f32> {
    var hdrColor = textureSample(hdrTex, s, uv).rgb;

    // Apply exposure before tone mapping to adjust brightness.
    hdrColor = hdrColor * exposure;

    // Apply the tone mapping function to convert from HDR to LDR.
    let finalColor = ACESFitted(hdrColor);

    return vec4(finalColor, 1.0);
}
