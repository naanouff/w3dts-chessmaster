/**
 * @file Vertex shader used for rendering the shadow map.
 * It calculates the vertex position from the light's point of view
 * and only outputs the position, without any color or normal calculations,
 * which is optimized for a depth-only pass.
 * @author Cyril Tarriet
 */

/**
 * Data structure for frame uniforms, shared by all objects
 * and unchanging during the shadow pass.
 */
struct FrameUniforms {
    /** The view-projection matrix from the light's perspective. */
    lightViewProjectionMatrix: mat4x4<f32>,
};

/**
 * Bind group 0 contains the frame uniforms.
 * @group(0) @binding(0)
 */
@group(0) @binding(0) var<uniform> frame: FrameUniforms;

/**
 * Data structure for object-specific uniforms,
 * which change for each rendered object.
 */
struct ObjectUniforms {
    /** The model transformation matrix. */
    modelMatrix: mat4x4<f32>,
};

/**
 * Bind group 1 contains the object uniforms, using a dynamic offset.
 * @group(1) @binding(0)
 */
@group(1) @binding(0) var<uniform> object: ObjectUniforms;

/**
 * The output structure of the vertex shader.
 */
struct VertexOutput {
    /** The final, transformed position of the vertex. */
    @builtin(position) position: vec4<f32>,
};

/**
 * The main entry point for the vertex shader.
 * @param position The vertex position in local space.
 * @returns The vertex position in clip space.
 */
@vertex
fn main(
    @location(0) position: vec3<f32> // Seule la position est nécessaire pour la profondeur
    // Les locations 1 à 5 sont implicitement présentes dans le buffer d'entrée,
    // mais ignorées par ce shader.
    ) -> VertexOutput {
    var output: VertexOutput;
    
    // Le calcul reste inchangé, mais l'input `position` est désormais lu correctement
    output.position = frame.lightViewProjectionMatrix * object.modelMatrix * vec4<f32>(position, 1.0);
    return output;
}
