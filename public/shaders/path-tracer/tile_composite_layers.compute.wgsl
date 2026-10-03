/**
 * Copies the current path-trace tile into full-resolution composites: denoised beauty, raw noisy,
 * normal/depth guide, and first-hit albedo (for offline OIDN aux).
 */

@group(0) @binding(0) var<storage, read> pathTracerTileInfo: array<u32>;
@group(0) @binding(1) var denoisedTile: texture_2d<f32>;
@group(0) @binding(2) var noisyTile: texture_2d<f32>;
@group(0) @binding(3) var guideTile: texture_2d<f32>;
@group(0) @binding(4) var albedoTile: texture_2d<f32>;
@group(0) @binding(5) var pathTraceComposite: texture_storage_2d<rgba16float, write>;
@group(0) @binding(6) var pathTraceNoisyComposite: texture_storage_2d<rgba16float, write>;
@group(0) @binding(7) var pathTraceGuideComposite: texture_storage_2d<rgba16float, write>;
@group(0) @binding(8) var pathTraceAlbedoComposite: texture_storage_2d<rgba16float, write>;

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
    let pOut = vec2<i32>(i32(originX) + i32(gid.x), i32(originY) + i32(gid.y));

    let den = textureLoad(denoisedTile, pTile, 0);
    let noisy = textureLoad(noisyTile, pTile, 0);
    let guide = textureLoad(guideTile, pTile, 0);
    let alb = textureLoad(albedoTile, pTile, 0);

    textureStore(pathTraceComposite, pOut, den);
    textureStore(pathTraceNoisyComposite, pOut, noisy);
    textureStore(pathTraceGuideComposite, pOut, guide);
    textureStore(pathTraceAlbedoComposite, pOut, alb);
}
