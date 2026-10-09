/**
 * @file Fragment shader for the "Bright Pass".
 * It keeps emissive pixels and drops specular highlights.
 * @author Cyril Tarriet
 */

@group(0) @binding(0) var s: sampler;
@group(0) @binding(1) var t: texture_2d<f32>;
@group(0) @binding(2) var<uniform> threshold: f32;

@fragment
fn fs_main(@location(0) uv: vec2<f32>) -> @location(0) vec4<f32> {
    let color = textureSample(t, s, uv);
    // Opaque pixels store 1. Emissive pixels store their peak channel, above 1.
    // A specular highlight is bright in RGB and still has alpha 1, so it cannot bloom.
    // Luminance would do the opposite: a white pawn reflection passes, a magenta neon does not.
    if (color.a <= threshold) {
        return vec4<f32>(0.0, 0.0, 0.0, 1.0);
    }
    return vec4<f32>(color.rgb, 1.0);
}
