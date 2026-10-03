/**
 * @file color_grading.frag.wgsl
 * @description Application d'une LUT (Look-Up Table) pour l'étalonnage couleur.
 * Supporte les LUTs en bande horizontale (ex: 256x16 pour une précision de 16).
 */

@group(0) @binding(0) var s: sampler;
@group(0) @binding(1) var inputTex: texture_2d<f32>;
@group(0) @binding(2) var lutTex: texture_2d<f32>; // Texture LUT (ex: 256x16)

struct GradingParams {
    intensity: f32, // 0.0 (Original) -> 1.0 (Graded)
};
@group(0) @binding(3) var<uniform> params: GradingParams;

@fragment
fn fs_main(@location(0) uv: vec2<f32>) -> @location(0) vec4<f32> {
    let color = textureSample(inputTex, s, uv);
    
    // Paramètres de la LUT (Hardcodé pour une LUT standard 16x16x16 stockée en 256x16)
    // Vous pouvez passer ces valeurs en uniform si vous supportez différentes tailles (32x32x32, etc.)
    let lutHeight = 16.0;
    let lutWidth = 256.0;
    let slices = 16.0; // Nombre de tranches bleues

    // Calcul des coordonnées dans la LUT
    // La couleur Bleue détermine quelle "tranche" (slice) horizontale choisir
    let slice = color.b * (slices - 1.0);
    
    // On doit interpoler entre deux tranches pour éviter le banding (sauts de couleur)
    let sliceZ = floor(slice);
    let sliceZNext = min(sliceZ + 1.0, slices - 1.0);
    let interp = fract(slice);

    // Calcul UV pour la tranche 1
    let uv1 = vec2<f32>(
        (sliceZ * lutHeight + color.r * (lutHeight - 1.0) + 0.5) / lutWidth,
        (color.g * (lutHeight - 1.0) + 0.5) / lutHeight
    );

    // Calcul UV pour la tranche 2 (suivante)
    let uv2 = vec2<f32>(
        (sliceZNext * lutHeight + color.r * (lutHeight - 1.0) + 0.5) / lutWidth,
        (color.g * (lutHeight - 1.0) + 0.5) / lutHeight
    );

    // Échantillonnage
    let graded1 = textureSample(lutTex, s, uv1);
    let graded2 = textureSample(lutTex, s, uv2);

    // Mélange des deux tranches
    let gradedColor = mix(graded1, graded2, interp);

    // Mélange final avec l'original selon l'intensité
    let finalColor = mix(color, gradedColor, params.intensity);

    return finalColor; // On garde l'alpha d'origine implicitement
}