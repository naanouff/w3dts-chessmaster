// ============================================================
// Gaussian Splat Vertex Shader — EWA Splatting (correct 2D covariance)
//
// Reference: "3D Gaussian Splatting for Real-Time Radiance Field Rendering"
// Kerbl et al. 2023  — forward.cu / computeCov2D / computeCov3D
//
// Algorithm:
//  1. Build rotation matrix R from quaternion; form world-space axis vectors a_i = R[:,i] * s_i
//  2. Project each axis endpoint to pixel space; take difference from center → screen-space axis c_i
//  3. 2D covariance (pixel²) = Σ_i (c_i * c_iᵀ)  + low-pass 0.3 I
//  4. Eigen-decompose 2x2 symmetric matrix → λ1 ≥ λ2, eigenvector for major axis
//  5. Quad semi-axes: r1 = 3√λ1, r2 = 3√λ2  (3σ coverage)
//  6. Fragment evaluates exp(-4.5 * r²) = exp(-0.5 * 9 * r²) in the eigen basis
// ============================================================

struct SplatUniforms {
  viewProj: mat4x4<f32>,
  viewportAndScale: vec4<f32>, // x=width, y=height, z=scaleMult (1.0 = phys-correct)
  cameraRight: vec4<f32>,
  modelMatrix: mat4x4<f32>,    // entity world transform (identity = no offset)
};

struct ProjectedSplat {
  clip_x: f32,
  clip_y: f32,
  clip_w: f32,
  radius: f32,
  color_r: f32,
  color_g: f32,
  color_b: f32,
  color_a: f32,
};

struct SplatParams {
  count: u32,
  _pad0: u32,
  _pad1: u32,
  _pad2: u32,
};

struct VsOut {
  @builtin(position) position: vec4<f32>,
  @location(0) localUv: vec2<f32>,
  @location(1) color: vec4<f32>,
};

@group(0) @binding(0) var<uniform> uniforms: SplatUniforms;
@group(0) @binding(1) var<storage, read> packedData: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read> sortedIndices: array<u32>;
@group(0) @binding(3) var<storage, read> projected: array<ProjectedSplat>;
@group(0) @binding(4) var<storage, read> params: array<u32>;

// Build 3x3 rotation matrix from quaternion stored as (w, x, y, z) = (q.x, q.y, q.z, q.w)
// Returns column-major mat3x3 where column i is the i-th local axis in world space.
fn quatToMat3(q: vec4<f32>) -> mat3x3<f32> {
  let w = q.x; let x = q.y; let y = q.z; let z = q.w;
  return mat3x3<f32>(
    vec3<f32>(1.0 - 2.0*(y*y + z*z),  2.0*(x*y + w*z),         2.0*(x*z - w*y)),
    vec3<f32>(2.0*(x*y - w*z),          1.0 - 2.0*(x*x + z*z),  2.0*(y*z + w*x)),
    vec3<f32>(2.0*(x*z + w*y),          2.0*(y*z - w*x),         1.0 - 2.0*(x*x + y*y))
  );
}

@vertex
fn main(@builtin(vertex_index) vertexIndex: u32, @builtin(instance_index) instanceIndex: u32) -> VsOut {
  var out: VsOut;

  let count = params[0u];
  if (instanceIndex >= count) {
    out.position = vec4<f32>(2.0, 2.0, 2.0, 1.0);
    out.localUv = vec2<f32>(0.0, 0.0);
    out.color = vec4<f32>(0.0, 0.0, 0.0, 0.0);
    return out;
  }

  let splatIndex = sortedIndices[instanceIndex];
  let base = splatIndex * 4u;
  let pos   = packedData[base + 0u].xyz;
  let scale = packedData[base + 1u].xyz;
  let rot   = packedData[base + 2u];       // w,x,y,z stored as vec4.xyzw
  let col   = packedData[base + 3u];

  // Apply entity world transform so the splat cloud can be moved with the gizmo.
  // pos is in the cloud's local space; modelMatrix brings it to world space.
  let worldPos = (uniforms.modelMatrix * vec4<f32>(pos, 1.0)).xyz;

  // Half-viewport in pixels
  let hw = uniforms.viewportAndScale.x * 0.5;
  let hh = uniforms.viewportAndScale.y * 0.5;

  // Project splat center to clip space
  let centerClip = uniforms.viewProj * vec4<f32>(worldPos, 1.0);
  // Discard splats whose center is behind the camera — rendering them produces garbage geometry
  if (centerClip.w <= 0.0) {
    out.position = vec4<f32>(2.0, 2.0, 2.0, 1.0);
    out.localUv  = vec2<f32>(0.0);
    out.color    = vec4<f32>(0.0);
    return out;
  }
  let clipW = centerClip.w;
  let centerNdc = centerClip.xy / clipW;

  // Rotation matrix: column i = world-space direction of local axis i
  // Also rotated by the model matrix so the ellipses follow the entity's orientation.
  let modelRot = mat3x3<f32>(uniforms.modelMatrix[0].xyz, uniforms.modelMatrix[1].xyz, uniforms.modelMatrix[2].xyz);
  let R = modelRot * quatToMat3(rot);

  // World-space axis endpoints (one per local axis, scaled by that axis's sigma)
  let e0 = worldPos + R[0] * scale.x;
  let e1 = worldPos + R[1] * scale.y;
  let e2 = worldPos + R[2] * scale.z;

  // Project endpoints to pixel space and compute displacements from center
  // (linear approximation of Jacobian — exact for orthographic, good approx for perspective)
  let c0clip = uniforms.viewProj * vec4<f32>(e0, 1.0);
  let c1clip = uniforms.viewProj * vec4<f32>(e1, 1.0);
  let c2clip = uniforms.viewProj * vec4<f32>(e2, 1.0);

  // Screen displacement in pixels for each axis.
  // Clamp per-axis displacement to prevent covariance explosion when any axis endpoint
  // crosses the near-plane (clip.w → 0 makes the NDC division blow up).
  let maxDisp = min(hw, hh);
  let c0 = clamp(
    (c0clip.xy / max(0.0001, c0clip.w) - centerNdc) * vec2<f32>(hw, hh),
    vec2<f32>(-maxDisp), vec2<f32>(maxDisp));
  let c1 = clamp(
    (c1clip.xy / max(0.0001, c1clip.w) - centerNdc) * vec2<f32>(hw, hh),
    vec2<f32>(-maxDisp), vec2<f32>(maxDisp));
  let c2 = clamp(
    (c2clip.xy / max(0.0001, c2clip.w) - centerNdc) * vec2<f32>(hw, hh),
    vec2<f32>(-maxDisp), vec2<f32>(maxDisp));

  // 2D covariance matrix in pixels² (sum of outer products + low-pass 0.3)
  // [ cov_a  cov_b ]
  // [ cov_b  cov_c ]
  let cov_a = c0.x*c0.x + c1.x*c1.x + c2.x*c2.x + 0.3;
  let cov_b = c0.x*c0.y + c1.x*c1.y + c2.x*c2.y;
  let cov_c = c0.y*c0.y + c1.y*c1.y + c2.y*c2.y + 0.3;

  // Eigenvalues of 2x2 symmetric matrix (same formula as CUDA forward.cu)
  let mid   = 0.5 * (cov_a + cov_c);
  let det   = cov_a * cov_c - cov_b * cov_b;
  let delta = sqrt(max(0.1, mid * mid - det));
  let lambda1 = mid + delta;               // larger eigenvalue (major axis)
  let lambda2 = max(0.01, mid - delta);    // smaller eigenvalue (minor axis)

  // Semi-axes in pixels at 3σ coverage, multiplied by optional visual scale.
  // Cap at viewport size so near-camera splats can't fill the entire screen.
  let scaleMult = uniforms.viewportAndScale.z;
  let maxR = min(hw, hh) * 2.0;
  let r1 = min(3.0 * sqrt(lambda1) * scaleMult, maxR);
  let r2 = min(3.0 * sqrt(lambda2) * scaleMult, maxR);

  // Eigenvector for the major axis in pixel space
  var majorPx: vec2<f32>;
  if (abs(cov_b) < 1e-5) {
    majorPx = select(vec2<f32>(0.0, 1.0), vec2<f32>(1.0, 0.0), cov_a >= cov_c);
  } else {
    majorPx = normalize(vec2<f32>(cov_b, lambda1 - cov_a));
  }
  let minorPx = vec2<f32>(-majorPx.y, majorPx.x);

  // Oriented quad vertices
  var quad = array<vec2<f32>, 6>(
    vec2<f32>(-1.0, -1.0),
    vec2<f32>( 1.0, -1.0),
    vec2<f32>( 1.0,  1.0),
    vec2<f32>(-1.0, -1.0),
    vec2<f32>( 1.0,  1.0),
    vec2<f32>(-1.0,  1.0)
  );

  let uv = quad[vertexIndex];
  let offsetPx = majorPx * (uv.x * r1) + minorPx * (uv.y * r2);
  let ndcOffset = vec2<f32>(
    2.0 * offsetPx.x / max(1.0, uniforms.viewportAndScale.x),
    2.0 * offsetPx.y / max(1.0, uniforms.viewportAndScale.y)
  );

  out.position = vec4<f32>(
    (centerNdc.x + ndcOffset.x) * clipW,
    (centerNdc.y + ndcOffset.y) * clipW,
    centerClip.z,
    clipW
  );
  out.localUv = uv;
  out.color = col;
  return out;
}
