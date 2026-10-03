/**
 * Clears full-resolution path trace composites when pathTracerTileInfo[6] != 0.
 */

@group(0) @binding(0) var<storage, read> pathTracerTileInfo: array<u32>;
@group(0) @binding(1) var<storage, read> pathTracerParams: array<u32>;
@group(0) @binding(2) var pathTraceComposite: texture_storage_2d<rgba16float, write>;
@group(0) @binding(3) var pathTraceNoisyComposite: texture_storage_2d<rgba16float, write>;
@group(0) @binding(4) var pathTraceGuideComposite: texture_storage_2d<rgba16float, write>;
@group(0) @binding(5) var pathTraceAlbedoComposite: texture_storage_2d<rgba16float, write>;

const FLAG_TRANSPARENT_BG = 64u;

@compute @workgroup_size(8, 8, 1)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
    if (pathTracerTileInfo[6] == 0u) {
        return;
    }
    let dims = textureDimensions(pathTraceComposite);
    if (gid.x >= dims.x || gid.y >= dims.y) {
        return;
    }
    let p = vec2<i32>(i32(gid.x), i32(gid.y));
    let transparent = (pathTracerParams[9] & FLAG_TRANSPARENT_BG) != 0u;
    let z = select(vec4<f32>(0.0, 0.0, 0.0, 1.0), vec4<f32>(0.0), transparent);
    textureStore(pathTraceComposite, p, z);
    textureStore(pathTraceNoisyComposite, p, z);
    textureStore(pathTraceGuideComposite, p, vec4<f32>(0.0));
    textureStore(pathTraceAlbedoComposite, p, vec4<f32>(0.0));
}
