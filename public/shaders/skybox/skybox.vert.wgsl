/**
 * @file Vertex shader for rendering a skybox.
 * It transforms a cube's geometry, cancels the camera's translation effect,
 * and forces the depth to its maximum value so the skybox is always
 * rendered in the background.
 */

#include "../shared/structs.wgsl"

@group(0) @binding(0) var<uniform> frame: FrameUniforms;

@vertex
fn main(@builtin(vertex_index) vertexIndex : u32) -> VertexOutput {
    // Vertex coordinates for a cube with an inverted winding order
    // so that the faces are visible from the inside.
    let pos = array<vec3<f32>, 36>(
        vec3<f32>(-1.0, -1.0, 1.0), vec3<f32>(1.0, -1.0, 1.0), vec3<f32>(1.0, 1.0, 1.0),
        vec3<f32>(-1.0, -1.0, 1.0), vec3<f32>(1.0, 1.0, 1.0), vec3<f32>(-1.0, 1.0, 1.0),
        vec3<f32>(-1.0, -1.0, -1.0), vec3<f32>(-1.0, 1.0, -1.0), vec3<f32>(1.0, 1.0, -1.0),
        vec3<f32>(-1.0, -1.0, -1.0), vec3<f32>(1.0, 1.0, -1.0), vec3<f32>(1.0, -1.0, -1.0),
        vec3<f32>(-1.0, 1.0, -1.0), vec3<f32>(-1.0, 1.0, 1.0), vec3<f32>(1.0, 1.0, 1.0),
        vec3<f32>(-1.0, 1.0, -1.0), vec3<f32>(1.0, 1.0, 1.0), vec3<f32>(1.0, 1.0, -1.0),
        vec3<f32>(-1.0, -1.0, -1.0), vec3<f32>(1.0, -1.0, -1.0), vec3<f32>(1.0, -1.0, 1.0),
        vec3<f32>(-1.0, -1.0, -1.0), vec3<f32>(1.0, -1.0, 1.0), vec3<f32>(-1.0, -1.0, 1.0),
        vec3<f32>(1.0, -1.0, -1.0), vec3<f32>(1.0, 1.0, -1.0), vec3<f32>(1.0, 1.0, 1.0),
        vec3<f32>(1.0, -1.0, -1.0), vec3<f32>(1.0, 1.0, 1.0), vec3<f32>(1.0, -1.0, 1.0),
        vec3<f32>(-1.0, -1.0, -1.0), vec3<f32>(-1.0, -1.0, 1.0), vec3<f32>(-1.0, 1.0, 1.0),
        vec3<f32>(-1.0, -1.0, -1.0), vec3<f32>(-1.0, 1.0, 1.0), vec3<f32>(-1.0, 1.0, -1.0)
    );

    // Create a copy of the view matrix without translation.
    // This ensures the skybox remains centered on the camera regardless of camera movement.
    var view_no_translation = mat4x4<f32>(frame.viewMatrix);
    view_no_translation[3] = vec4<f32>(0.0, 0.0, 0.0, 1.0);

    let p = pos[vertexIndex];
    var output: VertexOutput;

    // Calculate the clip position. By setting the Z component to W,
    // the skybox is forced to render at maximum depth (behind all other geometry).
    output.clip_position = (frame.projectionMatrix * view_no_translation * vec4<f32>(p, 1.0)).xyww;

    // Assign unused properties for this shader to match the `VertexOutput` structure.
    output.uv = vec2<f32>(0.0, 0.0);
    output.tangent_space_light_dir = vec3<f32>(0.0, 0.0, 0.0);
    output.tangent_space_view_dir = vec3<f32>(0.0, 0.0, 0.0);
    output.shadowPos = vec4<f32>(0.0, 0.0, 0.0, 1.0);
    output.color = vec4<f32>(0.0, 0.0, 0.0, 1.0);
    
    // The world position is passed directly to the fragment shader for cubemap sampling.
    output.world_position = p;
    output.world_normal = p;

    return output;
}