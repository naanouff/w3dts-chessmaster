/**
 * @file Fragment shader: multiply input color by a tint (RGBA uniform).
 * Bind layout matches FullscreenPassExecutor (sampler, texture, optional uniform).
 */

@group(0) @binding(0) var s: sampler;
@group(0) @binding(1) var srcTex: texture_2d<f32>;
@group(0) @binding(2) var<uniform> tintColor: vec4<f32>;

@fragment
fn fs_main(@location(0) uv: vec2<f32>) -> @location(0) vec4<f32> {
  let src = textureSample(srcTex, s, uv);
  return src * tintColor;
}
