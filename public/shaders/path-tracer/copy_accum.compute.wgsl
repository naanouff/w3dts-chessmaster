/**
 * Copy pathTraceAccumWrite -> pathTraceAccumRead for next frame's accumulation.
 * Storage textures: read from one, write to the other (rgba16float does not support read_write).
 */

@group(0) @binding(0) var accumSource: texture_storage_2d<rgba16float, read>;
@group(0) @binding(1) var accumDest: texture_storage_2d<rgba16float, write>;

@compute @workgroup_size(8, 8, 1)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
    let dims = textureDimensions(accumSource);
    if (gid.x >= dims.x || gid.y >= dims.y) { return; }
    let p = vec2<i32>(gid.xy);
    textureStore(accumDest, p, textureLoad(accumSource, p));
}
