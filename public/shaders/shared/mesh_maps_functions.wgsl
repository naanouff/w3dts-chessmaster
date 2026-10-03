// public/shaders/shared/mesh_maps_functions.wgsl

struct TriplanarTBNResult {
  tangent: vec3f,
  bitangent: vec3f,
  normal: vec3f,
}

fn triplanar_tbn(world_normal: vec3f) -> TriplanarTBNResult {
  let n = normalize(world_normal);
  let abs_n = abs(n);
  var tangent = vec3f(0.0, 0.0, 0.0);
  var bitangent = vec3f(0.0, 0.0, 0.0);

  if (abs_n.y >= abs_n.x && abs_n.y >= abs_n.z) {
    tangent = normalize(vec3f(1.0, 0.0, 0.0));
    bitangent = normalize(cross(n, tangent));
    tangent = cross(bitangent, n);
  } else if (abs_n.x >= abs_n.z) {
    tangent = normalize(vec3f(0.0, 1.0, 0.0));
    bitangent = normalize(cross(n, tangent));
    tangent = cross(bitangent, n);
  } else {
    tangent = normalize(vec3f(0.0, 1.0, 0.0));
    bitangent = normalize(cross(n, tangent));
    tangent = cross(bitangent, n);
  }

  return TriplanarTBNResult(tangent, bitangent, n);
}

fn unpack_mesh_maps(color: vec4f) -> vec4f {
  return color;
}

fn blend_normal_detail(
  base_normal: vec3f,
  detail_noise: f32,
  tangent: vec3f,
  bitangent: vec3f,
  normal: vec3f,
  scale: f32,
  world_pos: vec3f
) -> vec3f {
  let n = normalize(normal);
  var dHdx = dpdx(detail_noise);
  var dHdy = dpdy(detail_noise);
  let dHLen = length(vec2f(dHdx, dHdy));
  // Kill sub-pixel height jumps (hash / voronoi kinks) before they become firefly normals.
  let maxDh = 0.08;
  let dHScale = min(1.0, maxDh / max(dHLen, 1e-6));
  dHdx = dHdx * dHScale;
  dHdy = dHdy * dHScale;
  let lod_atten = 1.0 / (1.0 + dHLen * 12.0);
  let strength = max(scale, 0.0) * 6.0 * lod_atten;

  let dPdx = dpdx(world_pos);
  let dPdy = dpdy(world_pos);
  let r1 = cross(dPdy, n);
  let r2 = cross(n, dPdx);
  let det = dot(dPdx, r1);
  var perturbed: vec3f;
  if (abs(det) > 1e-8) {
    var grad = (r1 * dHdx + r2 * dHdy) / det;
    let gLen = length(grad);
    grad = grad * (min(gLen, 1.15) / max(gLen, 1e-6));
    perturbed = normalize(n - grad * strength);
  } else {
    let t = normalize(tangent - n * dot(n, tangent));
    let b = normalize(cross(n, t));
    let detail_ts = vec3f(-dHdx * strength, -dHdy * strength, 1.0);
    perturbed = normalize(t * detail_ts.x + b * detail_ts.y + n * detail_ts.z);
  }
  return normalize(mix(base_normal, perturbed, clamp(scale * 1.6, 0.0, 1.0)));
}

fn screen_space_curvature_fallback(normal: vec3f) -> f32 {
  let dx = dpdx(normal);
  let dy = dpdy(normal);
  return clamp(length(dx) + length(dy), 0.0, 1.0);
}
