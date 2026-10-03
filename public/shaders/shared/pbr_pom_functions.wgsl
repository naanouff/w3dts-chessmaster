/// Parallax occlusion mapping for shader-graph PBR. **`displacementTexture`.r = cavity depth** (0 = flat surface, 1 = deepest).
/// When `scale <= 0`, returns `base_uv` unchanged. Uses `displacementTexture` and `textureSampler` from the material bind group.
fn w3dts_pom_surface_uv(
    base_uv: vec2<f32>,
    V_world: vec3<f32>,
    world_n: vec3<f32>,
    world_t: vec3<f32>,
    world_b: vec3<f32>,
    scale: f32,
    min_layers: f32,
    max_layers: f32,
) -> vec2<f32> {
    if (scale <= 1e-6) {
        return base_uv;
    }
    let N = normalize(world_n);
    let T0 = normalize(world_t);
    let B0 = normalize(world_b);
    let tbn = mat3x3<f32>(T0, B0, N);
    let V_ts = transpose(tbn) * normalize(V_world);
    let min_l = max(i32(min_layers + 0.5), 4);
    let max_l = max(i32(max_layers + 0.5), min_l);
    let view_angle = clamp(abs(V_ts.z), 0.05, 1.0);
    let num_layers = i32(mix(f32(max_l), f32(min_l), view_angle));
    let layer_depth = 1.0 / f32(num_layers);
    let P = V_ts.xy * (scale / max(V_ts.z, 0.08));
    let delta_uv = P / f32(num_layers);

    var cur_uv = base_uv;
    var cur_layer_depth = 0.0;
    var h = textureSampleLevel(displacementTexture, textureSampler, cur_uv, 0.0).r;

    for (var i = 0; i < num_layers; i++) {
        if (cur_layer_depth >= h) {
            break;
        }
        cur_uv -= delta_uv;
        h = textureSampleLevel(displacementTexture, textureSampler, cur_uv, 0.0).r;
        cur_layer_depth += layer_depth;
    }

    return cur_uv;
}
