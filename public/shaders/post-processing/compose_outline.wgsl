// /shaders/post-processing/compose_outline.wgsl

// @group(0) contiendra les deux textures d'entrée
@group(0) @binding(0) var s: sampler;
@group(0) @binding(1) var sceneTexture: texture_2d<f32>; // L'image couleur de la scène
@group(0) @binding(2) var outlineTexture: texture_2d<f32>; // L'image avec les contours

@fragment
fn fs_main(@location(0) uv: vec2<f32>) -> @location(0) vec4<f32> {
    let scene_color = textureSample(sceneTexture, s, uv);
    let outline_color = textureSample(outlineTexture, s, uv);

    // On utilise la fonction 'mix'.
    // Si l'alpha du contour (outline_color.a) est 0, le résultat est la couleur de la scène.
    // Si l'alpha du contour est 1, le résultat est la couleur du contour.
    // Cela permet de dessiner le contour "par-dessus" l'image de base.
    let final_color = mix(scene_color.rgb, outline_color.rgb, outline_color.a);

    return vec4<f32>(final_color, scene_color.a);
}