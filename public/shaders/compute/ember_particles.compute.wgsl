/**
 * Procedural ember / smoke particles: writes InstanceOutput compatible with instanced Lit pipeline.
 */

#include "../shared/compute_structs.wgsl"
#include "../shared/compute_math_utils.wgsl"

struct SimU {
  time: f32,
  count: u32,
  enabled: u32,
  palette: u32,
  emitter: vec4<f32>,
}

@group(0) @binding(0) var<uniform> sim: SimU;
@group(0) @binding(1) var<storage, read_write> output_data: array<InstanceOutput>;

fn hash_u32(x: u32) -> f32 {
  var v = x;
  v = v ^ (v >> 16u);
  v = v * 0x7feb352du;
  v = v ^ (v >> 15u);
  v = v * 0x846ca68bu;
  v = v ^ (v >> 16u);
  return f32(v & 0xfffffu) / f32(0xfffffu);
}

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let i = gid.x;
  if (i >= sim.count) {
    return;
  }

  if (sim.enabled == 0u) {
    let modelMatrix = scaling(vec3<f32>(0.0, 0.0, 0.0));
    let normalMatrix = mat4x4<f32>(
      vec4<f32>(1.0, 0.0, 0.0, 0.0),
      vec4<f32>(0.0, 1.0, 0.0, 0.0),
      vec4<f32>(0.0, 0.0, 1.0, 0.0),
      vec4<f32>(0.0, 0.0, 0.0, 1.0)
    );
    output_data[i].modelMatrix = modelMatrix;
    output_data[i].normalMatrix = normalMatrix;
    output_data[i].color = vec4<f32>(0.0, 0.0, 0.0, 0.0);
    return;
  }

  let r1 = hash_u32(i * 0x9e3779b9u);
  let r2 = hash_u32(i * 0x85ebca6bu + 1u);
  let r3 = hash_u32(i * 0xc2b2ae35u + 7u);

  let life = fract(sim.time * (0.35 + r2 * 0.4) + r1);
  let angle = r2 * 6.2831853;
  let up = life * (2.2 + r3 * 1.8);
  let spread = (0.15 + r1 * 0.55) * sqrt(life);
  let cx = cos(angle);
  let sx = sin(angle);
  let ox = spread * cx + sin(sim.time * 1.7 + f32(i) * 0.01) * 0.08;
  let oz = spread * sx + cos(sim.time * 1.3 + f32(i) * 0.013) * 0.08;
  let oy = up;

  let world_pos = sim.emitter.xyz + vec3<f32>(ox, oy, oz);
  let wobble = sin(sim.time * 3.0 + r3 * 6.28) * 0.25;
  let scale_base = select(0.04, 0.12, sim.palette == 1u);
  let sc = scale_base * (1.0 - life) * (0.4 + r3 * 0.6) * (1.0 + wobble * 0.15);

  let modelMatrix = translation(world_pos) * rotation_y(r1 * 6.28 + sim.time * 0.5) * scaling(vec3<f32>(sc, sc, sc));
  let normalMatrix = transpose(matrix_inverse(modelMatrix));

  var col: vec4<f32>;
  if (sim.palette == 0u) {
    let heat = 1.0 - life;
    col = vec4<f32>(1.0, 0.35 + heat * 0.45, 0.05 + heat * 0.15, 0.85);
  } else {
    col = vec4<f32>(0.55, 0.55, 0.58, 0.22 * (1.0 - life * 0.7));
  }

  output_data[i].modelMatrix = modelMatrix;
  output_data[i].normalMatrix = normalMatrix;
  output_data[i].color = col;
}
