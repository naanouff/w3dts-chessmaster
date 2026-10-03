// Resolves multisampled depth to a single-sample depth attachment (sample 0 per pixel).
@group(0) @binding(0) var ms_depth: texture_depth_multisampled_2d;

struct VsOut {
  @builtin(position) position: vec4f,
};

@vertex
fn vs_main(@builtin(vertex_index) vid: u32) -> VsOut {
  var pos = array<vec2f, 3>(
    vec2f(-1.0, -1.0),
    vec2f(3.0, -1.0),
    vec2f(-1.0, 3.0)
  );
  var o: VsOut;
  let p = pos[vid];
  o.position = vec4f(p, 0.0, 1.0);
  return o;
}

@fragment
fn fs_main(@builtin(position) pos: vec4f) -> @builtin(frag_depth) f32 {
  let dims = textureDimensions(ms_depth);
  let x = u32(clamp(pos.x, 0.0, f32(dims.x) - 1.0));
  let y = u32(clamp(pos.y, 0.0, f32(dims.y) - 1.0));
  return textureLoad(ms_depth, vec2u(x, y), 0);
}
