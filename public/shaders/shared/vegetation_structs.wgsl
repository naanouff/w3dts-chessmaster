/**
 * @file vegetation_structs.wgsl
 * Structures partagées pour la génération de végétation GPU.
 */

// Structure correspondant à 'InstanceInput' du vertex shader
// Stride: 64 bytes (16 floats) pour simplifier le prototype (Matrice Modèle uniquement)
// Ou 144 bytes si on garde votre format complet (Model + Inverse + Color)
// Pour ce prototype, restons simples : Matrice Modèle (16 floats) + Padding
struct VegetationInstance {
    modelMatrix: mat4x4<f32>,
    // On peut ajouter d'autres données ici (couleur, type...)
};

// Structure requise par drawIndexedIndirect
// Voir spécification WebGPU: 
// https://gpuweb.github.io/gpuweb/#dictdef-gpubufferbindinglayout
struct IndirectDrawArgs {
    vertexCount: u32,
    instanceCount: atomic<u32>, // C'est ici qu'on va incrémenter le compteur !
    firstVertex: u32,
    firstInstance: u32,
};

// Paramètres de simulation (envoyés par le CPU)
struct VegetationUniforms {
    seed: f32,
    chunkPos: vec2<f32>,   // Position du coin du chunk
    chunkSize: f32,        // Taille du chunk (ex: 256m)
    density: f32,          // Probabilité globale (0..1)
    minHeight: f32,
    maxHeight: f32,
    maxSlope: f32,
    waterLevel: f32,
};