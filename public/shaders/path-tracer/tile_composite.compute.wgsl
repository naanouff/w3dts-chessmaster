/**
 * Copies the current denoised tile into the full-resolution composite at (originX, originY).
 */

@group(0) @binding(0) var<storage, read> pathTracerTileInfo: array<u32>;
@group(0) @binding(1) var denoisedTile: texture_storage_2d<rgba16float, read>;
@group(0) @binding(2) var pathTraceComposite: texture_storage_2d<rgba16float, write>;

@compute @workgroup_size(8, 8, 1)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
    let tileW = pathTracerTileInfo[4];
    let tileH = pathTracerTileInfo[5];
    if (gid.x >= tileW || gid.y >= tileH) {
        return;
    }
    let originX = pathTracerTileInfo[0];
    let originY = pathTracerTileInfo[1];
    let pTile = vec2<i32>(i32(gid.x), i32(gid.y));
    let c = textureLoad(denoisedTile, pTile);
    let pOut = vec2<i32>(i32(originX) + i32(gid.x), i32(originY) + i32(gid.y));
    textureStore(pathTraceComposite, pOut, c);
}
