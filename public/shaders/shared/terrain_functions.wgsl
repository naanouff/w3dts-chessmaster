/* terrain_functions.wgsl
   Helpers for terrain sampling: anti-tiling, height-blend, and array sampling.
*/

// Simple 2D hash
fn hash2(p: vec2f) -> f32 {
  let h = dot(p, vec2f(127.1, 311.7));
  return fract(sin(h) * 43758.5453123);
}

fn rotate_uv(uv: vec2f, angle: f32) -> vec2f {
  let c = cos(angle);
  let s = sin(angle);
  return vec2f(uv.x * c - uv.y * s, uv.x * s + uv.y * c);
}

fn stochastic_uv(uv: vec2f, scale: f32) -> vec2f {
  // Per-cell rotation + small jitter to reduce tiling
  let cell = floor(uv * scale);
  let local = fract(uv * scale) - vec2f(0.5, 0.5);
  let r = hash2(cell);
  let angle = r * 6.28318530718; // 2*pi
  let rotated = rotate_uv(local, angle);
  let jitter = (hash2(cell + vec2f(1.3, 7.1)) - 0.5) * 0.25;
  return (rotated + vec2f(0.5, 0.5) + jitter) / scale;
}

fn sample_terrain_array(tex: texture_2d_array<f32>, samp: sampler, uv: vec2f, layer: i32) -> vec4f {
  // Use the array-index overload: coords as vec2 and an explicit array_index i32
  return textureSample(tex, samp, uv, layer);
}

fn compute_height_blend_weights(heights: vec4f, weights: vec4f, sharpness: f32) -> vec4f {
  let h = heights + weights;
  let maxH = max(max(h.x, h.y), max(h.z, h.w));
  let blendMask = maxH - sharpness;
  var w = vec4f(0.0, 0.0, 0.0, 0.0);
  w.x = max(h.x - blendMask, 0.0);
  w.y = max(h.y - blendMask, 0.0);
  w.z = max(h.z - blendMask, 0.0);
  w.w = max(h.w - blendMask, 0.0);
  let sum = w.x + w.y + w.z + w.w;
  if (sum <= 0.0) {
    let s = weights.x + weights.y + weights.z + weights.w;
    if (s <= 0.0) {
      return vec4f(0.25, 0.25, 0.25, 0.25);
    }
    return weights / s;
  }
  return w / sum;
}

