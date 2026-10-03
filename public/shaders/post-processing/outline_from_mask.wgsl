/**
 * @file outline_from_mask.wgsl
 * @project w3dts
 * @author Cyril TARRIET
 * @date 2025-10-14
 * @description Détecte les bords à partir d'une texture de masque (noir et blanc)
 * pour dessiner un contour autour des objets sélectionnés.
 */

// --- BINDINGS ---
@group(0) @binding(0) var s: sampler;
@group(0) @binding(1) var maskTexture: texture_2d<f32>; // Notre texture masque en entrée

@fragment
fn fs_main(@location(0) uv: vec2<f32>) -> @location(0) vec4<f32> {
    let texel_size = 1.0 / vec2<f32>(textureDimensions(maskTexture));
    
    // On lit la valeur du pixel central (soit ~0.0 pour noir, soit ~1.0 pour blanc)
    let center_val = textureSample(maskTexture, s, uv).r;
    
    // On va comparer le pixel central avec ses 4 voisins directs (haut, bas, gauche, droite)
    var edge_intensity = 0.0;
    
    // Voisin du haut
    edge_intensity += abs(center_val - textureSample(maskTexture, s, uv + vec2(0.0, texel_size.y)).r);
    // Voisin du bas
    edge_intensity += abs(center_val - textureSample(maskTexture, s, uv - vec2(0.0, texel_size.y)).r);
    // Voisin de droite
    edge_intensity += abs(center_val - textureSample(maskTexture, s, uv + vec2(texel_size.x, 0.0)).r);
    // Voisin de gauche
    edge_intensity += abs(center_val - textureSample(maskTexture, s, uv - vec2(texel_size.x, 0.0)).r);

    // Si `edge_intensity` est supérieur à un petit seuil, cela signifie qu'au moins un voisin
    // a une couleur différente, donc nous sommes sur un bord.
    if (edge_intensity > 0.001) {
        // On retourne la couleur du contour (orange vif opaque)
        return vec4<f32>(1.0, 0.0, 0.0, 1.0);
    }

    // Sinon, ce n'est pas un bord, on retourne une couleur transparente.
    return vec4<f32>(0.0);
}