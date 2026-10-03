/**
 * @file Procedural skybox shader.
 * This fragment shader generates a realistic sky with gradients,
 * a sun, and clouds based on the view direction.
 */

#include "../shared/structs.wgsl"
#include "../shared/noise_functions.wgsl"

@group(0) @binding(0) var<uniform> frame: FrameUniforms;

@vertex
fn vs_main(@builtin(vertex_index) vertexIndex : u32) -> VertexOutput {
    // Vertices for a cube with faces visible from the inside.
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

    // Remove translation from the view matrix to make the skybox
    // always centered on the camera.
    var view_no_translation = frame.viewMatrix;
    view_no_translation[3] = vec4<f32>(0.0, 0.0, 0.0, 1.0);

    let p = pos[vertexIndex];
    var output: VertexOutput;

    // Set clip position to (x, y, w, w) to force depth to 1.0.
    // This makes the skybox render behind all other geometry.
    output.clip_position = (frame.projectionMatrix * view_no_translation * vec4<f32>(p, 1.0)).xyww;
    
    // Pass the vertex position to the fragment shader to be used as a direction vector.
    output.world_position = p;

    // Unused outputs for the skybox shader, but required by the struct definition.
    output.uv = vec2<f32>(0.0, 0.0);
    output.tangent_space_light_dir = vec3<f32>(0.0, 0.0, 0.0);
    output.tangent_space_view_dir = vec3<f32>(0.0, 0.0, 0.0);
    output.shadowPos = vec4<f32>(0.0, 0.0, 0.0, 1.0);
    output.color = vec4<f32>(0.0, 0.0, 0.0, 1.0);
    output.world_normal = p;
    
    return output;
}

@fragment
fn fs_main(input: VertexOutput) -> @location(0) vec4<f32> {
    let dir = normalize(input.world_position);
    // Sky gradient colors
    let groundColor = vec3<f32>(0.5, 0.4, 0.2);
    let horizonColor = vec3<f32>(2.0, 2.5, 3.0);
    let zenithColor = vec3<f32>(0.5, 0.7, 1.2);
    let deepSkyColor = vec3<f32>(0.1, 0.2, 0.6);
    let deepGroundColor = vec3<f32>(0.02, 0.01, 0.005);
    
    var skyColor: vec3<f32>;

    // Interpolate between colors based on vertical direction
    if (dir.y < -0.2) {
        let t_ground_south_pole = smoothstep(-1.0, -0.2, dir.y);
        skyColor = mix(deepGroundColor, groundColor, t_ground_south_pole);
    } else if (dir.y < 0.0) {
        let t_ground_horizon = smoothstep(-0.2, 0.0, dir.y);
        skyColor = mix(groundColor, horizonColor, t_ground_horizon);
    } else if (dir.y < 0.7) {
        let t_horizon_zenith = smoothstep(0.0, 0.7, dir.y);
        skyColor = mix(horizonColor, zenithColor, t_horizon_zenith);
    } else {
        let t_zenith_north_pole = smoothstep(0.7, 1.0, dir.y);
        skyColor = mix(zenithColor, deepSkyColor, t_zenith_north_pole);
    }

    // Add sun influence
    let sunDirectionFromCamera = normalize(-frame.lightDirection);
    let sunDotProduct = dot(dir, sunDirectionFromCamera);
    let sunInfluence = pow(max(0.0, sunDotProduct), 100.0) * vec3<f32>(5.0, 4.0, 3.0);
    skyColor += sunInfluence;

    // Add clouds with noise
    let cloudTextureCoord = (dir.xz * 5.0) + (vec2<f32>(frame.totalTime * 0.05, frame.totalTime * 0.02));
    let cloudDensity = fractal_noise(cloudTextureCoord, 4u);
    let cloudLayerFactor = smoothstep(0.1, 0.6, dir.y);
    let finalCloudDensity = clamp(cloudDensity - 0.5, 0.0, 1.0) * cloudLayerFactor;
    let cloudColor = vec3<f32>(1.5, 1.5, 1.5);
    skyColor = mix(skyColor, cloudColor, finalCloudDensity);

    return vec4<f32>(skyColor, 1.0);
}