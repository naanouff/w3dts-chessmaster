/**
 * @file hiz-copy-depth.compute.wgsl
 * @project w3dts
 * @author Cyril TARRIET
 * @date 2026-01-16
 * @description Copies the main depth buffer into Hi-Z mip 0 (r32float).
 */

// Input: Depth texture (SceneDepth)
@group(0) @binding(0) var sourceDepth: texture_depth_2d;

// Output: Hi-Z mip 0 (r32float)
@group(0) @binding(1) var destMip: texture_storage_2d<r32float, write>;

@group(0) @binding(2) var depthSampler: sampler;

struct HiZParams {
    sourceMipLevel: u32,
    destMipLevel: u32,
    sourceWidth: u32,
    sourceHeight: u32,
};

@group(0) @binding(3) var<uniform> params: HiZParams;

@compute @workgroup_size(16, 16, 1)
fn main(@builtin(global_invocation_id) globalId: vec3<u32>) {
    let coord = vec2<u32>(globalId.xy);
    let size = vec2<u32>(textureDimensions(destMip));
    if (coord.x >= size.x || coord.y >= size.y) {
        return;
    }

    let depth = textureLoad(sourceDepth, vec2<i32>(coord), 0);
    textureStore(destMip, vec2<i32>(coord), vec4<f32>(depth, 0.0, 0.0, 0.0));
}
