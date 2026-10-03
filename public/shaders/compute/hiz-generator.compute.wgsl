/**
 * @file hiz-generator.compute.wgsl
 * @project w3dts
 * @author Cyril TARRIET
 * @date 2026-01-16
 * @description Compute shader for generating Hi-Z (Hierarchical-Z) mipmap pyramid from depth buffer.
 * Uses MAX-depth reduction: stores the farthest visible surface depth in each tile.
 * This enables conservative occlusion: cull only objects farther than the farthest visible surface.
 */

// =============================================================================
// BINDINGS
// =============================================================================

// Input: Source mip level from the Hi-Z pyramid (r32float)
@group(0) @binding(0) var sourceMip: texture_2d<f32>;

// Output: Destination mip level (next level in pyramid)
@group(0) @binding(1) var destMip: texture_storage_2d<r32float, write>;

// Sampler for reading depth values
@group(0) @binding(2) var depthSampler: sampler;

// Uniform buffer with mip level info
struct HiZParams {
    sourceMipLevel: u32,
    destMipLevel: u32,
    sourceWidth: u32,
    sourceHeight: u32,
};

@group(0) @binding(3) var<uniform> params: HiZParams;

// =============================================================================
// WORKGROUP CONFIGURATION
// =============================================================================

// Each workgroup processes a 16x16 tile
const WORKGROUP_SIZE: u32 = 16u;

@compute @workgroup_size(16, 16, 1)
fn main(@builtin(global_invocation_id) globalId: vec3<u32>) {
    let destCoord = vec2<u32>(globalId.xy);
    
    // Check if we're within bounds of the destination mip
    let destSize = vec2<u32>(textureDimensions(destMip));
    if (destCoord.x >= destSize.x || destCoord.y >= destSize.y) {
        return;
    }

    // Calculate source coordinates (2x2 region in source mip)
    let sourceCoord = destCoord * 2u;
    
    // Sample 4 depth values from source mip (2x2 quad).
    // We want the MAXIMUM depth (farthest visible surface).
    // Conservative occlusion: only cull objects farther than the farthest visible surface in a tile.
    var maxDepth = 0.0;
    
    // Sample top-left
    let depth00 = textureLoad(sourceMip, vec2<i32>(sourceCoord), 0).r;
    maxDepth = max(maxDepth, depth00);
    
    // Sample top-right (check bounds)
    if (sourceCoord.x + 1u < params.sourceWidth) {
        let depth10 = textureLoad(sourceMip, vec2<i32>(sourceCoord + vec2<u32>(1u, 0u)), 0).r;
        maxDepth = max(maxDepth, depth10);
    }
    
    // Sample bottom-left (check bounds)
    if (sourceCoord.y + 1u < params.sourceHeight) {
        let depth01 = textureLoad(sourceMip, vec2<i32>(sourceCoord + vec2<u32>(0u, 1u)), 0).r;
        maxDepth = max(maxDepth, depth01);
    }
    
    // Sample bottom-right (check bounds)
    if (sourceCoord.x + 1u < params.sourceWidth && sourceCoord.y + 1u < params.sourceHeight) {
        let depth11 = textureLoad(sourceMip, vec2<i32>(sourceCoord + vec2<u32>(1u, 1u)), 0).r;
        maxDepth = max(maxDepth, depth11);
    }
    
    // Write maximum depth to destination mip
    textureStore(destMip, vec2<i32>(destCoord), vec4<f32>(maxDepth, 0.0, 0.0, 0.0));
}
