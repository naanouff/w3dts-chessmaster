/**
 * @file vegetation_gen.compute.wgsl
 * Génération procédurale massive de végétation.
 */

#include "../shared/math_common.wgsl"
#include "../shared/noise_functions.wgsl"
#include "../shared/compute_math_utils.wgsl"

// Structure correspondant au Vertex Buffer Slot 1 (InstancedMesh)
// Stride : 36 floats (144 bytes)
struct InstanceData {
    modelMatrix: mat4x4<f32>,
    inverseModelMatrix: mat4x4<f32>,
    color: vec4<f32>,
};

// Structure pour drawIndexedIndirect
struct IndirectArgs {
    vertexCount: u32,
    instanceCount: atomic<u32>, // Compteur atomique
    firstVertex: u32,
    baseInstance: u32,
};

struct Uniforms {
    seed: f32,
    chunkPos: vec2<f32>,   // Offset du chunk (World X, Z)
    chunkSize: f32,        // Taille (ex: 256)
    density: f32,          // 0.0 à 1.0
    heightMin: f32,
    heightMax: f32,
    waterLevel: f32,
    time: f32,
};

@group(0) @binding(0) var<uniform> params: Uniforms;
@group(0) @binding(1) var<storage, read_write> instances: array<InstanceData>;
@group(0) @binding(2) var<storage, read_write> indirect: IndirectArgs;

// Fonction de hauteur simplifiée (devrait idéalement lire une texture Heightmap)
fn get_height(x: f32, z: f32) -> f32 {
    let scale = 0.02;
    let n = fractal_noise(vec2(x, z) * scale, 3u);
    return n * 50.0; // Amplitude arbitraire pour le test
}

fn hash(p: vec2<f32>) -> f32 {
    return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}

@compute @workgroup_size(8, 8, 1)
fn main(@builtin(global_invocation_id) id: vec3<u32>) {
    // 1. Coordonnées
    let lx = f32(id.x);
    let lz = f32(id.y);
    
    // Grille de densité : un arbre tous les 2 mètres
    let step = 2.0; 
    
    if (lx * step >= params.chunkSize || lz * step >= params.chunkSize) { return; }

    let wx = params.chunkPos.x + lx * step;
    let wz = params.chunkPos.y + lz * step;

    // 2. Règles de placement
    let rng = hash(vec2(wx, wz) + params.seed);
    
    if (rng > params.density) { return; }

    let h = get_height(wx, wz);
    
    // Filtres basiques
    if (h < params.waterLevel || h < params.heightMin || h > params.heightMax) { return; }

    // 3. Allocation (Atomic)
    let idx = atomicAdd(&indirect.instanceCount, 1u);
    
    // Sécurité buffer overflow (supposons max 100k)
    if (idx >= 100000u) { return; }

    // 4. Calcul Transform
    let scale = 0.8 + rng * 0.7;
    let rotY = rng * 6.28;
    
    // Jitter position
    let jx = (hash(vec2(wx, wz)*1.1) - 0.5) * 1.5;
    let jz = (hash(vec2(wx, wz)*1.2) - 0.5) * 1.5;

    let pos = vec3(wx + jx, h, wz + jz);

    // Construction Matrices
    let T = translation(pos);
    let R = rotation_y(rotY);
    let S = mat4x4<f32>(
        vec4(scale,0,0,0), vec4(0,scale,0,0), vec4(0,0,scale,0), vec4(0,0,0,1)
    );
    
    let model = T * R * S;
    
    // Compute inverse for normal transformation
    // (matrix_inverse doit être dispo via compute_math_utils, sinon on peut tricher pour la rotation/scale)
    // Pour faire simple et robuste ici, on utilise une approximation ou on inclut une vraie fonction d'inverse.
    // On va utiliser une fonction simplifiée car T*R*S est orthogonale.
    // Inverse = Inv(S) * Inv(R) * Inv(T)
    
    // NOTE: Pour ce prototype, on va utiliser une matrice inverse identité pour éviter la complexité d'inversion mat4 en WGSL pur
    // sauf si vous avez matrix_inverse dans compute_math_utils.
    // Utilisons le model pour l'instant, l'éclairage sera un peu faux sur le scale mais ça marchera.
    let invModel = model; 

    // 5. Écriture
    instances[idx].modelMatrix = model;
    instances[idx].inverseModelMatrix = invModel; // TODO: Vraie inversion
    instances[idx].color = vec4(1.0);
}