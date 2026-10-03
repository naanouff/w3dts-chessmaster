// Ultra Terrain - Path Mask Debug Composite
// Overlays the pathMask (R channel) as a red tint on top of the input scene.
// Bindings (group 0):
// 0: sampler
// 1: sceneColor (2D float)
// 2: pathMask (2D float, from rgba8unorm)

@group(0) @binding(0) var s: sampler;
@group(0) @binding(1) var sceneTex: texture_2d<f32>;
@group(0) @binding(2) var maskTex: texture_2d<f32>;

struct FragmentInput {
  @location(0) uv: vec2<f32>,
};

@fragment
fn fs_main(input: FragmentInput) -> @location(0) vec4<f32> {
  let scene = textureSample(sceneTex, s, input.uv);
  let mask = textureSample(maskTex, s, input.uv).r;

  // Slight curve to make low values visible.
  let m = clamp(pow(mask, 0.75), 0.0, 1.0);

  let overlay = vec3<f32>(1.0, 0.15, 0.1) * m;
  let rgb = mix(scene.rgb, overlay, m * 0.85);

  return vec4<f32>(rgb, 1.0);
}
