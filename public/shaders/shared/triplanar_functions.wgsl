// public/shaders/shared/triplanar_functions.wgsl

/**
 * Échantillonne une texture 2D en utilisant les coordonnées et le sampler global.
 */
fn sample_tri(tex: texture_2d<f32>, uv: vec2f) -> vec3f {
  // 'textureSampler' est le sampler global défini dans main_shader.wgsl
  return textureSample(tex, textureSampler, uv).rgb;
}

/**
 * Calcule une couleur en utilisant le texturing tri-planar.
 *
 * @param pos Position in the same space as `norm` (object or world), already scaled by the graph.
 * @param norm Surface normal in that same space.
 * @param texTop La texture à projeter depuis l'axe Y (herbe).
 * @param texSide La texture à projeter depuis les axes X et Z (roche/terre).
 * @param sharpness La "dureté" de la transition entre les textures.
 */
fn triplanar_sample(
  pos: vec3f, 
  norm: vec3f, 
  texTop: texture_2d<f32>, 
  texSide: texture_2d<f32>, 
  sharpness: f32
) -> vec3f {
  
  // 1. Calculer les poids de mélange (blend weights)
  // On utilise abs() pour gérer les faces négatives et pow() pour la netteté.
  var weights = pow(abs(norm), vec3f(sharpness));
  
  // 2. Normaliser les poids pour que leur somme soit 1.0
  // (Ajouter un epsilon pour éviter la division par zéro sur les normales nulles)
  weights = weights / (weights.x + weights.y + weights.z + 0.0001);

  // 3. Calculer les coordonnées UV pour chaque projection
  let uv_y = pos.xz; // Projection Y (Top/Bottom) utilise les coords XZ
  let uv_x = pos.zy; // Projection X (Left/Right) utilise les coords ZY
  let uv_z = pos.xy; // Projection Z (Front/Back) utilise les coords XY

  // 4. Échantillonner les textures
  // Note : texTop est utilisée pour la projection Y
  let tex_y_color = sample_tri(texTop, uv_y);
  // Note : texSide est utilisée pour les projections X et Z
  let tex_x_color = sample_tri(texSide, uv_x);
  let tex_z_color = sample_tri(texSide, uv_z);

  // 5. Mélanger les résultats en utilisant les poids
  let final_color = 
      tex_y_color * weights.y +
      tex_x_color * weights.x +
      tex_z_color * weights.z;
      
  return final_color;
}