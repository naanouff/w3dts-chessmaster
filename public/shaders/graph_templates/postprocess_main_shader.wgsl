/**
 * @file postprocess_main_shader.wgsl
 * @description Fragment-only shell for Shader Graph post-process masters.
 * Vertex stage remains packages/.../post-processing/fullscreen.vert.wgsl (executor).
 * Bind layout must match FullscreenPassExecutor local group:
 *   binding 0 = filtering sampler (textureSampler)
 *   binding 1..N = input textures (in pass inputs order / property names)
 *   then optional uniform buffers
 */

{{graph_id}}
// [[DEFINES]]
// [[UTILITY_FUNCTIONS]]
// [[UNIFORM_STRUCT]]
// [[TEXTURE_BINDINGS]]

@fragment
fn fs_main(@location(0) uv: vec2<f32>) -> @location(0) vec4<f32> {
// [[FUNCTION_BODY]]
  return final_color;
}
