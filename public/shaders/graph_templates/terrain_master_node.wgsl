// ===================================================
// === TERRAIN MASTER NODE (Textured + PBR Light) ===
// ===================================================

// --- 1. Input Extraction ---

let albedo_sample = {{albedo}};
let albedo = albedo_sample.rgb;
let opacity_factor = {{opacity_factor}};
let alpha = albedo_sample.a * opacity_factor;

let input_normal = normalize({{normal}});
// Use world normal from vertex shader for proper lighting
let normal = normalize(input.world_normal);
let roughness_factor = clamp({{roughness_factor}}, 0.04, 1.0);
let metallic_factor = clamp({{metallic_factor}}, 0.0, 1.0);
let emission_sample = {{emission}};
let emission = max(emission_sample.rgb, vec3<f32>(0.0));

// --- 2. View & Light Vectors ---

let V = normalize(frame.cameraPosition - input.world_position);
let L = normalize(-frame.lightDirection);
let H = normalize(V + L);
let N = normal;

// --- 3. Simple PBR ---

let NdotV = max(dot(N, V), 0.001);
let NdotL = max(dot(N, L), 0.0);

// Fresnel
let F0 = mix(vec3<f32>(0.04), albedo, vec3<f32>(metallic_factor));
let F = F0 + (vec3<f32>(1.0) - F0) * pow(clamp(1.0 - dot(H, V), 0.0, 1.0), 5.0);

// Diffuse
let diffuse = albedo * (1.0 - metallic_factor) / 3.14159;

// Specular: disabled for terrain so it stays fully matte (no light reflections).
// The graph may feed a blended roughness; we ignore it and force specular to zero.
var specular = vec3<f32>(0.0);

// Ambient term to avoid completely black areas
let ambient = albedo * 0.15;
// Apply shadowing: use fetchShadow (will return 1.0 if no shadow data available)
let shadow = fetchShadow(0u, 0, input.world_position, N, NdotL, vec3<f32>(0.0));
let final_color = (diffuse + specular) * NdotL * shadow + ambient + emission * 0.5;

// --- 4. Output ---

let final_alpha = alpha;
var shadow_factor_out = shadow;

// --- Height-based blend demonstration ---
// Placeholder heights & base weights (runtime should supply real per-layer heights)
let _layer_heights = vec4f(0.0, 0.0, 0.0, 0.0);
let _base_weights = vec4f(0.25, 0.25, 0.25, 0.25);
let _blend_weights = compute_height_blend_weights(_layer_heights, _base_weights, 0.1);
// Optionally modulate final_color by blend weights (debug example uses RGB channels)
let final_color_blended = final_color * vec3<f32>(_blend_weights.x, _blend_weights.y, _blend_weights.z);

