/**
 * @file SimpleTexturedTerrain.wgsl
 * @description Simple textured terrain shader with grass and rock blending
 */

// --- Uniforms & Textures ---
struct PBRParams {
  grassRoughness: f32,
  rockRoughness: f32,
  metallic: f32,
  _pad0: f32,
};

@group(0) @binding(0) var<uniform> pbrParams: PBRParams;
@group(0) @binding(1) var grassAlbedoTex: texture_2d<f32>;
@group(0) @binding(2) var rockAlbedoTex: texture_2d<f32>;
@group(0) @binding(3) var defaultSampler: sampler;

// --- Input/Output Structures ---
struct VertexInput {
  @location(0) position: vec3f,
  @location(1) normal: vec3f,
  @location(2) tangent: vec3f,
  @location(3) uv: vec2f,
};

struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) worldPos: vec3f,
  @location(1) normal: vec3f,
  @location(2) uv: vec2f,
};

struct FragmentOutput {
  @location(0) color: vec4f,
};

// --- Vertex Shader ---
@vertex
fn vs_main(input: VertexInput) -> VertexOutput {
  var output: VertexOutput;
  output.position = vec4f(input.position, 1.0);
  output.worldPos = input.position;
  output.normal = input.normal;
  output.uv = input.uv;
  return output;
}

// --- Fragment Shader ---
@fragment
fn fs_main(input: VertexOutput) -> FragmentOutput {
  // Sample textures
  let grassColor = textureSample(grassAlbedoTex, defaultSampler, input.uv);
  let rockColor = textureSample(rockAlbedoTex, defaultSampler, input.uv);
  
  // 50/50 blend
  let blendFactor = 0.5;
  let blendedAlbedo = mix(grassColor, rockColor, blendFactor);
  
  // Blend roughness
  let roughness = mix(pbrParams.grassRoughness, pbrParams.rockRoughness, blendFactor);
  
  // Simple output for now (will be enhanced with proper PBR)
  var output: FragmentOutput;
  output.color = vec4f(blendedAlbedo.rgb, 1.0);
  return output;
}
