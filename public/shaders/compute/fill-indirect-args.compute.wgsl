/**
 * @file fill-indirect-args.compute.wgsl
 * @project w3dts
 * @author Cyril TARRIET
 * @date 2026-01-16
 * @description Compute shader that fills indirect draw arguments based on visibility buffer.
 * Compacts visible objects and prepares GPUDrawIndexedIndirectArgs for each batch.
 */

struct InstanceData {
    modelMatrix: mat4x4<f32>,
    normalMatrix: mat4x4<f32>, // Inverse transpose of model matrix
    color: vec4<f32>,
};

/**
 * Indirect draw arguments structure.
 * Matches GPUDrawIndexedIndirectArgs layout (20 bytes).
 * Note: instanceCount is atomic for thread-safe increment.
 */
struct IndirectDrawArgs {
    indexCount: u32,
    instanceCount: atomic<u32>,
    firstIndex: u32,
    baseVertex: i32,
    firstInstance: u32,
};

// =============================================================================
// BINDINGS
// =============================================================================

// Group 0: Per-batch processing
@group(0) @binding(0) var<storage, read> visibilityBuffer: array<u32>;
@group(0) @binding(1) var<storage, read> sourceInstances: array<InstanceData>;
@group(0) @binding(2) var<storage, read> globalIndices: array<u32>;
@group(0) @binding(3) var<storage, read_write> filteredInstances: array<InstanceData>;
@group(0) @binding(4) var<storage, read_write> indirectArgs: IndirectDrawArgs;
@group(0) @binding(5) var<uniform> batchCount: u32;

@compute @workgroup_size(64, 1, 1)
fn main(@builtin(global_invocation_id) globalId: vec3<u32>) {
    let index = globalId.x;
    
    // Bounds check
    if (index >= batchCount) {
        return;
    }
    
    // Lookup global object index to check visibility
    let objectId = globalIndices[index];
    
    // Check visibility
    // visibilityBuffer[objectId] == 1 means visible
    if (visibilityBuffer[objectId] != 0u) {
        // Increment instance count atomically
        let outIndex = atomicAdd(&indirectArgs.instanceCount, 1u);
        
        // Copy instance data to filtered buffer
        filteredInstances[outIndex] = sourceInstances[index];
    }
}
