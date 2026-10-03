/**
 * @file ribbon.vert.wgsl
 * @project w3dts
 * @description Screen-space constant-width vertex shader for CAD ribbon overlays.
 *
 * Vertex format (44 bytes / 11 × f32):
 *   location(0) spinePos     vec3  — center of the cross-section (A or B segment endpoint)
 *   location(1) direction    vec3  — normalized world-space direction from spinePos to this vertex
 *   location(2) worldHalfW   f32   — pre-computed world-space distance |vertex − spinePos|
 *   location(3) color        vec4  — rgba
 *
 * The shader enforces a minimum pixel width at any camera distance:
 *   effectiveHalfW = max(worldHalfW, minHalfW)
 * where minHalfW is derived from the view-space depth and the projection matrix so that
 * the ribbon appears as at least MIN_NDC_HALF_W NDC units wide at the spine depth.
 *
 * Reference: 1 NDC unit = viewport_width / 2 pixels, so a constant NDC width
 * scales proportionally with viewport resolution (correct HiDPI behaviour).
 */

#include "../shared/structs.wgsl"

@group(0) @binding(0) var<uniform> frame: FrameUniforms;

struct RibbonVertexInput {
    @location(0) spinePos:   vec3<f32>,
    @location(1) direction:  vec3<f32>,
    @location(2) worldHalfW: f32,
    @location(3) color:      vec4<f32>,
};

struct RibbonVertexOutput {
    @builtin(position) clip_position: vec4<f32>,
    @location(0) frag_color: vec4<f32>,
};

/// Minimum NDC half-width: ~1.5 px on a 1920-pixel-wide viewport.
/// At 4K (3840 px) this is ~3 px, which remains visually fine for CAD overlays.
const MIN_NDC_HALF_W: f32 = 0.00156;

@vertex
fn main(input: RibbonVertexInput) -> RibbonVertexOutput {
    // View-space depth of the spine center (abs: behind-camera vertices handled gracefully).
    let viewSpineZ = abs((frame.viewMatrix * vec4<f32>(input.spinePos, 1.0)).z);

    // frame.projectionMatrix is column-major in WGSL: [col][row].
    // projectionMatrix[0][0] = P(row=0, col=0) = cot(fovX/2) for a symmetric perspective.
    let projScaleX = frame.projectionMatrix[0][0];

    // Minimum world half-width that maps to MIN_NDC_HALF_W at this view depth:
    //   ndcWidth = worldWidth * projScaleX / viewZ  →  worldWidth = ndcWidth * viewZ / projScaleX
    let minHalfW = select(0.0, MIN_NDC_HALF_W * viewSpineZ / projScaleX, projScaleX > 1e-4);

    // Use the larger of the geometry-encoded width or the screen-space minimum.
    let effectiveHalfW = max(input.worldHalfW, minHalfW);

    let worldPos = input.spinePos + input.direction * effectiveHalfW;

    var output: RibbonVertexOutput;
    output.clip_position = frame.projectionMatrix * frame.viewMatrix * vec4<f32>(worldPos, 1.0);
    output.frag_color = input.color;
    return output;
}
