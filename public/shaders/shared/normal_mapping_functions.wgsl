// =============================================================================
// === Normal Mapping Helpers (glTF compliant) ===
// =============================================================================

fn normal_map_world(
  normalTex: texture_2d<f32>,
  samp: sampler,
  uv: vec2<f32>,
  normalScale: f32,
  worldNormal: vec3<f32>,
  worldTangent: vec3<f32>,
  worldBitangent: vec3<f32>
) -> vec3<f32> {
  // Geometric normal (interpolated), normalized
  let N_geo = normalize(worldNormal);

  // Tangent basis (preserve handedness via the supplied bitangent)
  let T_interp = normalize(worldTangent);
  let B_interp = normalize(worldBitangent);

  // Orthonormalize T against N_geo
  let T = normalize(T_interp - dot(T_interp, N_geo) * N_geo);
  let handedness = select(-1.0, 1.0, dot(cross(N_geo, T), B_interp) >= 0.0);
  let B = normalize(cross(N_geo, T)) * handedness;

  // glTF normal map is tangent-space in [0..1] -> [-1..1]
  var n_ts = textureSample(normalTex, samp, uv).xyz * 2.0 - vec3<f32>(1.0);

  // glTF: normalTexture.scale scales X/Y only
  n_ts = vec3<f32>(n_ts.x * normalScale, n_ts.y * normalScale, n_ts.z);
  // Linear mip filtering shortens the vector; lerp toward +Z (Toksvig-style) to kill sparkle.
  let n_len = max(length(n_ts), 1e-5);
  n_ts = mix(vec3<f32>(0.0, 0.0, 1.0), n_ts / n_len, clamp(n_len, 0.0, 1.0));
  n_ts = normalize(n_ts);

  // Tangent -> World
  let N_world = normalize(T * n_ts.x + B * n_ts.y + N_geo * n_ts.z);
  return N_world;
}
