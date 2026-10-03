/**
 * Clears the full-resolution path trace composite when a full scene/camera reset occurs.
 * u32[6] in pathTracerTileInfo: 1 = clear this frame, 0 = skip (threads exit immediately).
 */

@group(0) @binding(0) var<storage, read> pathTracerTileInfo: array<u32>;
@group(0) @binding(1) var pathTraceComposite: texture_storage_2d<rgba16float, write>;

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
    textureStore(pathTraceComposite, p, vec4<f32>(0.0, 0.0, 0.0, 1.0));
}
