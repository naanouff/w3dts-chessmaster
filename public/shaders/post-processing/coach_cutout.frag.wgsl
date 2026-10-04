/**
 * @file coach_cutout.frag.wgsl
 * @description Silhouette ring from the coach mask. The piece itself stays the scene color.
 */

@group(0) @binding(0) var s: sampler;
@group(0) @binding(1) var sceneTex: texture_2d<f32>;
@group(0) @binding(2) var maskTex: texture_2d<f32>;

fn maskAt(uv: vec2<f32>) -> vec4<f32> {
    return textureSampleLevel(maskTex, s, uv, 0.0);
}

@fragment
fn fs_main(@location(0) uv: vec2<f32>) -> @location(0) vec4<f32> {
    let scene = textureSampleLevel(sceneTex, s, uv, 0.0);
    let center = maskAt(uv);
    if (center.a > 0.5) {
        return scene;
    }
    let texel = 1.0 / vec2<f32>(textureDimensions(maskTex));
    var found = vec4<f32>(0.0);
    var best = 1000.0;
    for (var y: i32 = -4; y <= 4; y++) {
        for (var x: i32 = -4; x <= 4; x++) {
            if (x == 0 && y == 0) {
                continue;
            }
            let dist = f32(x * x + y * y);
            if (dist > 16.0 || dist >= best) {
                continue;
            }
            let hit = maskAt(uv + vec2<f32>(f32(x), f32(y)) * texel);
            if (hit.a > 0.5) {
                best = dist;
                found = hit;
            }
        }
    }
    if (found.a < 0.5) {
        return scene;
    }
    return vec4<f32>(found.rgb * 3.0, scene.a);
}
