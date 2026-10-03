/**
 * @file ssao.frag.wgsl
 * @description Screen Space Ambient Occlusion (View Space Correction).
 */

#include "../shared/structs.wgsl"

// --- GROUP 0 : GLOBAL FRAME ---
@group(0) @binding(0) var<uniform> frame: FrameUniforms;

// --- GROUP 1 : RESSOURCES LOCALES ---
@group(1) @binding(0) var s: sampler;
@group(1) @binding(1) var depthTex: texture_depth_2d;
@group(1) @binding(2) var normalTex: texture_2d<f32>;
@group(1) @binding(3) var noiseTex: texture_2d<f32>;
@group(1) @binding(4) var kernelTex: texture_2d<f32>; // Texture 8x8 (rgba16float)

struct SSAOParams {
    kernelSize: f32,
    radius: f32,
    bias: f32,
    noiseScaleX: f32,
    noiseScaleY: f32,
};
@group(1) @binding(5) var<uniform> ssaoParams: SSAOParams;

/**
 * Reconstruit la position du pixel dans l'Espace Vue (Camera Space).
 */
fn getPositionViewSpace(uv: vec2<f32>) -> vec3<f32> {
    let dim = textureDimensions(depthTex);
    let coords = vec2<i32>(floor(uv * vec2<f32>(dim)));
    let depth = textureLoad(depthTex, coords, 0);
    
    // 1. Reconstruire la position Clip Space / NDC
    // Note: Y est inversé (1.0 - uv.y) pour matcher la convention WebGPU/Vulkan si nécessaire
    // Si votre rendu est à l'envers, essayez (uv.y * 2.0 - 1.0)
    let x = uv.x * 2.0 - 1.0;
    let y = (1.0 - uv.y) * 2.0 - 1.0; 
    let clipPos = vec4<f32>(x, y, depth, 1.0);
    
    // 2. Transformer vers World Space
    let worldPosRaw = frame.inverseViewProjectionMatrix * clipPos;
    let worldPos = worldPosRaw.xyz / worldPosRaw.w;
    
    // 3. Transformer vers View Space (C'est l'étape qui manquait !)
    let viewPos = frame.viewMatrix * vec4<f32>(worldPos, 1.0);
    
    return viewPos.xyz;
}

@fragment
fn fs_main(@location(0) uv: vec2<f32>) -> @location(0) vec4<f32> {
    // Position et Normale sont maintenant toutes les deux en View Space
    let fragPos = getPositionViewSpace(uv);
    
    // Optimisation : Pas de SSAO sur le fond du ciel (depth = 1.0 ou z très grand négatif en view space)
    // En View Space, Z est négatif devant la caméra.
    if (fragPos.z < -900.0) { 
        return vec4<f32>(1.0); 
    }

    let normalRaw = textureSampleLevel(normalTex, s, uv, 0.0).xyz;
    // Décodage des normales [0..1] -> [-1..1]
    let normal = normalize(normalRaw * 2.0 - 1.0);

    let noiseScale = vec2<f32>(ssaoParams.noiseScaleX, ssaoParams.noiseScaleY);
    let randomVecRaw = textureSampleLevel(noiseTex, s, uv * noiseScale, 0.0).xyz;
    let randomVec = randomVecRaw * 2.0 - 1.0;
    
    let tangent = normalize(randomVec - normal * dot(randomVec, normal));
    let bitangent = cross(normal, tangent);
    let TBN = mat3x3<f32>(tangent, bitangent, normal);

    var occlusion: f32 = 0.0;
    let kSize = i32(ssaoParams.kernelSize);
    
    for (var i = 0; i < kSize; i++) {
        let sampleCoords = vec2<i32>(i % 8, i / 8);
        let sampleVec = textureLoad(kernelTex, sampleCoords, 0).xyz;

        // Position de l'échantillon en View Space
        var samplePos = TBN * sampleVec; 
        samplePos = fragPos + samplePos * ssaoParams.radius;
        
        // Projection : View Space -> Clip Space
        // On utilise seulement la matrice de projection car on est déjà en View Space
        var offset = vec4<f32>(samplePos, 1.0);
        offset = frame.projectionMatrix * offset; 
        
        offset.x /= offset.w;
        offset.y /= offset.w; 
        
        // Transformation NDC -> UV [0..1]
        offset.x = offset.x * 0.5 + 0.5;
        offset.y = offset.y * -0.5 + 0.5; 
        
        if (offset.x < 0.0 || offset.x > 1.0 || offset.y < 0.0 || offset.y > 1.0) {
            continue;
        }

        // On compare la profondeur de l'échantillon (géométrie réelle)
        // avec la profondeur théorique du point dans le kernel
        let sampleDepth = getPositionViewSpace(offset.xy).z;
        
        // Range Check : pour éviter que des objets très lointains n'occultent des objets proches
        // (effet de halo noir autour des objets au premier plan)
        let rangeCheck = smoothstep(0.0, 1.0, ssaoParams.radius / abs(fragPos.z - sampleDepth));
        
        // Si la géométrie est plus proche de la caméra (Z plus grand car négatif) que le point théorique + bias
        // Alors il y a occlusion.
        // En View Space (Z négatif), "plus proche" signifie Z plus grand (ex: -5 > -10).
        if (sampleDepth >= samplePos.z + ssaoParams.bias) {
            occlusion += 1.0 * rangeCheck;
        }
    }
    
    occlusion = 1.0 - (occlusion / f32(kSize));
    
    // Debug: Pour voir les normales
    // return vec4(normal * 0.5 + 0.5, 1.0);
    
    return vec4<f32>(occlusion, occlusion, occlusion, 1.0);
}