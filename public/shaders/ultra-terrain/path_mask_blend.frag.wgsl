// Ultra Terrain - Path Mask Blend (WIP)
// Composites a path mask over the final graded color.
// This is an iteration-friendly first integration step (screen-space).
//
// Bindings follow FullscreenPassExecutor convention:
// @group(0) @binding(0): sampler
// @group(0) @binding(1..N): input textures in JSON order
// @group(0) @binding(N+1..): optional uniforms

@group(0) @binding(0) var s: sampler;
@group(0) @binding(1) var colorTex: texture_2d<f32>;
@group(0) @binding(2) var pathMaskTex: texture_2d<f32>;
@group(0) @binding(3) var sceneDepthTex: texture_depth_2d;

// params = [strength, tintR, tintG, tintB]
@group(0) @binding(4) var<uniform> params: vec4<f32>;

@fragment
fn fs_main(@location(0) uv: vec2<f32>) -> @location(0) vec4<f32> {
    var color = textureSample(colorTex, s, uv).rgb;

    // Only apply on geometry (avoid tinting the skybox).
    // Depth is cleared to 1.0; anything < ~1.0 is likely real geometry.
    let depthDims = textureDimensions(sceneDepthTex);
    let px = clamp(i32(uv.x * f32(depthDims.x)), 0, i32(depthDims.x) - 1);
    let py = clamp(i32(uv.y * f32(depthDims.y)), 0, i32(depthDims.y) - 1);
    let depth = textureLoad(sceneDepthTex, vec2<i32>(px, py), 0);
    let geoMask = 1.0 - step(0.99999, depth);

    let mask = textureSample(pathMaskTex, s, uv).r;
    let strength = max(0.0, params.x);
    let tint = clamp(params.yzw, vec3<f32>(0.0), vec3<f32>(1.0));

    let blend = clamp(mask * strength * geoMask, 0.0, 1.0);

    // Simple “path dirt/road” tint: darken and bias towards tint.
    color = color * (1.0 - 0.35 * blend) + tint * blend;

    return vec4<f32>(color, 1.0);
}
