/**
 * @file Fragment shader for the "Bright Pass".
 * It filters an input texture, keeping only the HDR excess above a luminance threshold.
 * @author Cyril Tarriet
 */

@group(0) @binding(0) var s: sampler;
@group(0) @binding(1) var t: texture_2d<f32>;
@group(0) @binding(2) var<uniform> threshold: f32;

@fragment
fn fs_main(@location(0) uv: vec2<f32>) -> @location(0) vec4<f32> {
    let color = textureSample(t, s, uv);
    let brightness = dot(color.rgb, vec3<f32>(0.2126, 0.7152, 0.0722));
    let contribution = max(0.0, brightness - threshold);
    if (contribution <= 0.0) {
        return vec4<f32>(0.0, 0.0, 0.0, 1.0);
    }
    // Only the energy above the threshold (preserves hue). A hard `return color`
    // made grazing gold/specular just above the cut bloom as a solid white band.
    return vec4<f32>(color.rgb * (contribution / brightness), 1.0);
}
