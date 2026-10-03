/**
 * @file unlit_master_node.wgsl
 * @description Template de logique pour le master node "Unlit".
 * Il gère l'albedo, l'alpha et le masquage (alpha cutout).
 */

// --- Unlit Shading (Généré par UnlitMasterNode) ---

// 1. Gestion de l'Alpha Masking
// 'ALPHA_MODE' est une constante (ex: const ALPHA_MODE: u32 = 2u;) définie par le ShaderGraphCompiler.
// 2u correspond à 'MASK'.
if (ALPHA_MODE == 2u) {
    // {{alpha_cutoff}} provient d'une propriété du graphe (ex: material.alphaCutoff)
    if ({{alpha}} < {{alpha_cutoff}}) {
        discard;
    }
}

// 2. Assignation finale
// Le 'main_shader.wgsl' s'attend à ce que 'final_color' et 'final_alpha' soient définis.
let final_color = {{albedo}};
let final_alpha = {{alpha}};
var shadow_factor_out = 1.0;