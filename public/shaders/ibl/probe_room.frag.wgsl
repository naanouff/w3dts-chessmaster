/**
 * Captures one cubemap from the probe origin: room box interior, sky on a miss.
 * Vertex stage is equirect-to-cube.vert.wgsl (local_pos = direction).
 */

struct RoomCapture {
    origin: vec3<f32>,
    _pad0: f32,
    boxHalf: vec3<f32>,
    _pad1: f32,
    interior: vec3<f32>,
    _pad2: f32,
    sky: vec3<f32>,
    _pad3: f32,
}

@group(0) @binding(1) var<uniform> room: RoomCapture;

@fragment
fn main(@location(0) local_pos: vec3<f32>) -> @location(0) vec4<f32> {
    let dir = normalize(local_pos);
    let box = room.boxHalf;
    if (box.x < 1e-3 || box.y < 1e-3 || box.z < 1e-3) {
        let skyMix = smoothstep(-0.05, 0.25, dir.y);
        return vec4<f32>(mix(room.interior, room.sky, skyMix), 1.0);
    }
    let denom = max(abs(dir), vec3<f32>(1e-5));
    let t = box / denom;
    let tHit = min(t.x, min(t.y, t.z));
    var color = room.interior;
    if (tHit == t.y && dir.y > 0.0) {
        color = room.interior * 1.4;
    } else if (tHit == t.y && dir.y < 0.0) {
        color = room.interior * 0.35;
    }
    return vec4<f32>(color, 1.0);
}
