// Ultra Terrain — water surface vertex shader (TER-A4)

#include "water_common.wgsl"

struct FrameUniforms {
    projectionMatrix           : mat4x4<f32>,
    viewMatrix                 : mat4x4<f32>,
    inverseViewProjectionMatrix: mat4x4<f32>,
    cameraPosition             : vec3<f32>,
    @size(64) lightMatrix      : mat4x4<f32>,
    lightDirection             : vec3<f32>,
    lightColor                 : vec3<f32>,
    ambientLightIntensity      : f32,
    debugViewMode              : u32,
    totalTime                  : f32,
};

struct WaterBodyParams {
    kind         : f32,
    waterLevel   : f32,
    centerX      : f32,
    centerZ      : f32,
    radius       : f32,
    shoreWidth   : f32,
    waveAmp      : f32,
    waveFreq     : f32,
    absorption   : vec3<f32>,
    _padA        : f32,
    shallowColor : vec3<f32>,
    _padB        : f32,
    deepColor    : vec3<f32>,
    _padC        : f32,
};

struct VertexInput {
    @location(0) position : vec3<f32>,
    @location(1) uv0      : vec2<f32>,
    @location(2) uv1      : vec2<f32>,
    @location(3) normal   : vec3<f32>,
    @location(4) tangent  : vec3<f32>,
    @location(5) bitangent: vec3<f32>,
    @location(6) color    : vec4<f32>,
};

struct InstanceInput {
    @location(7)  modelMatrix_r1 : vec4<f32>,
    @location(8)  modelMatrix_r2 : vec4<f32>,
    @location(9)  modelMatrix_r3 : vec4<f32>,
    @location(10) modelMatrix_r4 : vec4<f32>,
};

struct VertexOutput {
    @builtin(position) clipPosition : vec4<f32>,
    @location(0) worldPos         : vec3<f32>,
    @location(1) uv                 : vec2<f32>,
    @location(2) worldNormal        : vec3<f32>,
};

@group(0) @binding(0) var<uniform> frame : FrameUniforms;
@group(1) @binding(0) var<uniform> body  : WaterBodyParams;

@vertex
fn main(vertex: VertexInput, instance: InstanceInput) -> VertexOutput {
    let modelMatrix = mat4x4<f32>(
        instance.modelMatrix_r1,
        instance.modelMatrix_r2,
        instance.modelMatrix_r3,
        instance.modelMatrix_r4,
    );

    var localPos = vertex.position;
    let worldBase = (modelMatrix * vec4<f32>(localPos, 1.0)).xyz;
    var worldPos = worldBase;

    if (body.kind < 0.5) {
        let disp = ocean_displacement(worldBase.xz, frame.totalTime * body.waveFreq, body.waveAmp);
        worldPos = worldBase + disp;
    } else if (body.kind > 2.5 && body.kind < 3.5) {
        // River: subtle downstream ripple along flow UV.
        let ripple = sin(vertex.uv0.x * 40.0 - frame.totalTime * body.waveFreq * 4.0) * 0.04;
        worldPos = worldBase + vec3<f32>(0.0, ripple, 0.0);
    }

    var out: VertexOutput;
    out.clipPosition = frame.projectionMatrix * frame.viewMatrix * vec4<f32>(worldPos, 1.0);
    out.worldPos = worldPos;
    out.uv = vertex.uv0;
    out.worldNormal = vec3<f32>(0.0, 1.0, 0.0);
    return out;
}
