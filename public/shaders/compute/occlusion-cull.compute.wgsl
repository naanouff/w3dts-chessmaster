/**
 * @file occlusion-cull.compute.wgsl
 * @project w3dts
 * @author Cyril TARRIET
 * @date 2026-01-16
 * @description GPU occlusion culling compute shader.
 * Tests bounding volumes against frustum and Hi-Z pyramid to determine visibility.
 * Writes results to visibility buffer and fills indirect draw arguments.
 */

// =============================================================================
// STRUCTURES
// =============================================================================

/**
 * Bounding volume data for an object.
 * Total: 32 bytes (8 floats)
 */
struct BoundingVolume {
    center: vec3<f32>,      // World-space center (12 bytes)
    radius: f32,            // Bounding sphere radius (4 bytes)
    aabbMin: vec3<f32>,     // AABB min corner (12 bytes)
    _padding0: f32,         // Padding for alignment (4 bytes)
};

/**
 * Frustum plane in Hessian normal form: ax + by + cz + d = 0
 */
struct FrustumPlane {
    normal: vec3<f32>,
    distance: f32,
};

/**
 * Culling parameters passed from CPU.
 */
struct CullingParams {
    viewProjectionMatrix: mat4x4<f32>,
    cameraPosition: vec3<f32>,
    objectCount: u32,
    hizWidth: u32,
    hizHeight: u32,
    hizLevels: u32,
    _padding1: u32,
    // Frustum planes
    frustumPlanes: array<FrustumPlane, 6>,
};

/**
 * Indirect draw arguments structure.
 * Matches GPUDrawIndexedIndirectArgs layout.
 */
struct IndirectDrawArgs {
    indexCount: u32,
    instanceCount: u32,    // Modified by this shader based on visibility
    firstIndex: u32,
    baseVertex: i32,
    firstInstance: u32,
};

// =============================================================================
// BINDINGS
// =============================================================================

// Group 0: Input data
@group(0) @binding(0) var<storage, read> boundingVolumes: array<BoundingVolume>;
@group(0) @binding(1) var<uniform> params: CullingParams;
@group(0) @binding(2) var hizTexture: texture_2d<f32>;

// Group 1: Output data
@group(1) @binding(0) var<storage, read_write> visibilityBuffer: array<u32>;
@group(1) @binding(1) var<storage, read_write> indirectArgs: array<IndirectDrawArgs>;

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Tests if a sphere is outside a plane.
 * Returns true if the sphere is completely outside (culled).
 */
fn sphereOutsidePlane(center: vec3<f32>, radius: f32, plane: FrustumPlane) -> bool {
    let distance = dot(plane.normal, center) + plane.distance;
    return distance < -radius;
}

/**
 * Frustum culling test using sphere-plane tests.
 * Returns true if the object is visible (inside frustum).
 */
fn frustumCull(center: vec3<f32>, radius: f32) -> bool {
    for (var i = 0u; i < 6u; i++) {
        if (sphereOutsidePlane(center, radius, params.frustumPlanes[i])) {
            return false; // Outside frustum
        }
    }
    return true; // Inside frustum
}

/**
 * Projects a bounding sphere to screen space and returns the rectangle.
 * Returns vec4(minX, minY, maxX, maxY) in [0, 1] normalized coordinates.
 */
fn projectBoundingSphere(center: vec3<f32>, radius: f32) -> vec4<f32> {
    // Transform center to clip space
    let clipPos = params.viewProjectionMatrix * vec4<f32>(center, 1.0);
    
    // Perspective divide
    let ndc = clipPos.xyz / clipPos.w;
    
    // Calculate screen-space radius (conservative approximation)
    // Project radius vector to screen space
    let radiusClip = radius / clipPos.w;
    
    // Convert NDC [-1, 1] to UV [0, 1]
    // WebGPU UV origin is top-left, while NDC Y+ points up.
    let centerUV = vec2<f32>(ndc.x * 0.5 + 0.5, -ndc.y * 0.5 + 0.5);
    let radiusUV = radiusClip * 0.5;
    
    // Clamp to [0, 1] range
    let minUV = clamp(centerUV - vec2<f32>(radiusUV), vec2<f32>(0.0), vec2<f32>(1.0));
    let maxUV = clamp(centerUV + vec2<f32>(radiusUV), vec2<f32>(0.0), vec2<f32>(1.0));
    
    return vec4<f32>(minUV.x, minUV.y, maxUV.x, maxUV.y);
}

/**
 * Selects appropriate mip level for Hi-Z test based on screen-space size.
 */
fn selectHiZMipLevel(screenRect: vec4<f32>) -> u32 {
    let rectWidth = (screenRect.z - screenRect.x) * f32(params.hizWidth);
    let rectHeight = (screenRect.w - screenRect.y) * f32(params.hizHeight);
    let maxDim = max(rectWidth, rectHeight);
    
    // Select mip level where the object covers roughly 1-2 pixels
    let mipLevel = u32(log2(maxDim));
    return min(mipLevel, params.hizLevels - 1u);
}

/**
 * Performs Hi-Z occlusion test.
 * Returns true if the object is visible (not occluded).
 */
fn hizOcclusionTest(center: vec3<f32>, radius: f32, depth: f32) -> bool {
    // Project bounding sphere to screen space
    let screenRect = projectBoundingSphere(center, radius);
    
    // Select appropriate mip level
    let mipLevel = selectHiZMipLevel(screenRect);
    
    // Conservative Hi-Z: sample four corners of the screen-space footprint (not center only).
    let dims = textureDimensions(hizTexture, mipLevel);
    let maxW = f32(dims.x) - 1.0;
    let maxH = f32(dims.y) - 1.0;
    let corners = array<vec2<f32>, 4>(
        vec2<f32>(screenRect.x, screenRect.y),
        vec2<f32>(screenRect.z, screenRect.y),
        vec2<f32>(screenRect.x, screenRect.w),
        vec2<f32>(screenRect.z, screenRect.w),
    );

    var hizDepth = 0.0;
    var sawInitialized = false;

    for (var c = 0u; c < 4u; c++) {
        let uv = corners[c];
        let fx = clamp(uv.x * f32(dims.x), 0.0, maxW);
        let fy = clamp(uv.y * f32(dims.y), 0.0, maxH);
        let coord = vec2<i32>(i32(fx), i32(fy));
        let sampleDepth = textureLoad(hizTexture, coord, i32(mipLevel)).r;
        if (sampleDepth >= 0.0001) {
            sawInitialized = true;
            hizDepth = max(hizDepth, sampleDepth);
        }
    }

    // First frame / empty tile: treat as fully clear so nothing is falsely occluded.
    if (!sawInitialized) {
        return true;
    }

    return depth <= hizDepth;
}

/**
 * Computes the depth of a point in normalized device coordinates [0, 1].
 */
fn computeDepth(worldPos: vec3<f32>) -> f32 {
    let clipPos = params.viewProjectionMatrix * vec4<f32>(worldPos, 1.0);
    // Match WebGPU depth buffer range [0, 1] (gl-matrix NDC z is in [-1, 1]).
    let ndcZ = clipPos.z / clipPos.w;
    return ndcZ * 0.5 + 0.5;
}

// =============================================================================
// MAIN COMPUTE SHADER
// =============================================================================

@compute @workgroup_size(256, 1, 1)
fn main(@builtin(global_invocation_id) globalId: vec3<u32>) {
    let objectIndex = globalId.x;
    
    // Bounds check
    if (objectIndex >= params.objectCount) {
        return;
    }
    
    // Load bounding volume
    let bounds = boundingVolumes[objectIndex];
    
    // 1. Frustum culling (fast rejection)
    if (!frustumCull(bounds.center, bounds.radius)) {
        visibilityBuffer[objectIndex] = 0u;
        return;
    }
    
    // 2. Compute depth for occlusion test
    let depth = computeDepth(bounds.center);
    
    // 3. Hi-Z occlusion test (accurate visibility)
    if (!hizOcclusionTest(bounds.center, bounds.radius, depth)) {
        visibilityBuffer[objectIndex] = 0u;
        return;
    }
    
    // Object is visible
    visibilityBuffer[objectIndex] = 1u;
    
    // Increment instance count for indirect draw
    // Note: This requires atomic operations in actual implementation
    // For now, we'll handle instance count aggregation in a separate pass
}
