/**
 * @file voronoi_functions.wgsl
 * @project w3dts
 * @description Fournit des fonctions de bruit de Voronoi (cellulaire) pour WGSL.
 */

// L'include commenté a été supprimé pour corriger le bug du ShaderLoader

/**
 * Fonction de hachage 2D -> 2D.
 * Génère un vecteur pseudo-aléatoire (dans la plage [0, 1])
 * à partir d'une coordonnée d'entrée.
 */
fn hash_2_2(p: vec2f) -> vec2f {
    let k = vec2f(dot(p, vec2f(127.1, 311.7)), dot(p, vec2f(269.5, 183.3)));
    return fract(sin(k) * 43758.5453);
}

/**
 * Calcule un bruit de Voronoi 2D simple.
 *
 * @param uv Les coordonnées d'échantillonnage.
 * @param scale L'échelle du motif de bruit.
 * @returns f32 La distance au centre de la cellule la plus proche (plage [0, 1+]).
 */
fn voronoi_noise(uv: vec2f, scale: f32) -> f32 {
    let p = uv * scale;
    let i_part = floor(p); // Coordonnée entière de la cellule
    let f_part = fract(p); // Coordonnée locale dans la cellule (0-1)

    var min_dist = 100.0;

    // Boucle sur la cellule actuelle et ses 8 voisines
    for (var j: i32 = -1; j <= 1; j = j + 1) {
        for (var i: i32 = -1; i <= 1; i = i + 1) {
            let cell_offset = vec2f(f32(i), f32(j));
            let cell_coord = i_part + cell_offset;
            
            // Point aléatoire à l'intérieur de la cellule voisine
            // 'hash_2_2' donne un point (0-1), 'cell_offset' place ce point
            // par rapport à notre cellule (ex: -1, 0, 1)
            let point_in_cell = cell_offset + hash_2_2(cell_coord);
            
            // Calculer la distance entre notre fragment (f_part)
            // et le point aléatoire de cette cellule.
            let dist_to_point = length(point_in_cell - f_part);

            min_dist = min(min_dist, dist_to_point);
        }
    }

    return min_dist;
}