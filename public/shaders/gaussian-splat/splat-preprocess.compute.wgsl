struct SplatParams {
  count: u32,
  _pad0: u32,
  _pad1: u32,
  _pad2: u32,
};

struct ProjectedSplat {
  clip_x: f32,
  clip_y: f32,
  clip_w: f32,
  radius: f32,
  color_r: f32,
  color_g: f32,
  color_b: f32,
  color_a: f32,
};

@group(0) @binding(0) var<uniform> params: SplatParams;
@group(0) @binding(1) var<storage, read> packedData: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read> sortedIndices: array<u32>;
@group(0) @binding(3) var<storage, read_write> projected: array<ProjectedSplat>;

@compute @workgroup_size(64, 1, 1)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let i = gid.x;
  if (i >= params.count) {
    return;
  }

  let splatIndex = sortedIndices[i];
  let base = splatIndex * 4u;

  let pos = packedData[base + 0u];
  let scale = packedData[base + 1u];
  let col = packedData[base + 3u];

  let r = max(scale.x, max(scale.y, scale.z));

  projected[i].clip_x = pos.x;
  projected[i].clip_y = pos.y;
  projected[i].clip_w = pos.z;
  projected[i].radius = r;
  projected[i].color_r = col.x;
  projected[i].color_g = col.y;
  projected[i].color_b = col.z;
  projected[i].color_a = col.w;
}
