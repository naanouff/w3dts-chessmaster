/**
 * Review stage for the three cleaned sets. Not the playable client.
 * Serve the docs folder, then open mockup/ambiances.html.
 * Game camera: eye [0, 0.55, -0.72], target [0, 0.02, 0], fov 38°.
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { SSRPass } from 'three/addons/postprocessing/SSRPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { BokehPass } from 'three/addons/postprocessing/BokehPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';
import { Pass, FullScreenQuad } from 'three/addons/postprocessing/Pass.js';

/** Same extent as CHESS_BOARD_MESH_EXTENT. The mockup draws the in-game photo board. */
const BOARD_EXTENT = (0.06 * 8) / (1 - 2 * 0.06);
const BOARD_HEIGHT = 0.024;
const BOARD_BEVEL = 0.002;
const BOARD_BORDER = 0.06;
const GAME_EYE = [0, 0.55, -0.72];
const GAME_TARGET = [0, 0.02, 0];

const SCENES = {
  atelier: {
    background: 0xc5c5c0,
    hemi: 0.35,
    hemiSky: 0xd5dbe2,
    hemiGround: 0x8d8b86,
    sun: 0.9,
    sunPos: [1.6, 6.5, -0.4],
    boardY: 0,
    floor: { color: 0xb7b7b2, roughness: 0.92, depth: 7, zMax: 0.7 },
    cove: { zFront: 0.62, floorRun: 1.85 },
    room: null,
    props: [
      { file: 'table', anchor: 'top' },
      { file: 'plateau-toile', anchor: 'surface', x: -0.5, z: 0.05 },
      { file: 'plateau-toile', anchor: 'surface', x: 0.5, z: 0.05 },
      { file: 'tabouret', anchor: 'floor', x: 0, z: 2.05 },
      { file: 'softbox', anchor: 'floor', x: 1.85, z: 0.45, yaw: -Math.PI / 2 },
      { file: 'projecteur', anchor: 'floor', x: -1.9, z: 0.35, yaw: Math.PI / 2 },
    ],
    lights: [
      {
        type: 'rect',
        color: 0xfff7f0,
        intensity: 12,
        width: 0.7,
        height: 1.05,
        position: [1.35, 0.85, 0.4],
        target: [0, 0.15, 0],
      },
      {
        type: 'spot',
        color: 0xfff4ea,
        intensity: 18,
        distance: 6,
        angle: 0.45,
        penumbra: 0.65,
        position: [-1.15, 1.4, 0.05],
        target: [0.1, 0.05, 0],
        cast: false,
      },
    ],
  },
  salon: {
    background: 0x070605,
    hemi: 0.04,
    hemiSky: 0x3a2a1c,
    hemiGround: 0x0c0907,
    sun: 0.04,
    sunPos: [-1.2, 2.4, 0.4],
    boardY: 0.02,
    floor: { color: 0x6a4630, roughness: 0.72 },
    room: { width: 7.2, height: 3.1, depth: 7.2, color: 0x1a140f, z: 1.15 },
    props: [
      { file: 'tapis', anchor: 'floor', lift: 0.006, z: -0.2 },
      { file: 'table', anchor: 'top' },
      { file: 'napperon', anchor: 'surface' },
      { file: 'plateau', anchor: 'surface', x: 0.62, z: 0.04 },
      { file: 'lampe', anchor: 'surface', x: -0.64, z: 0.2, emissiveScale: 0.25 },
      { file: 'cheminee', anchor: 'floor', z: 2.05, yaw: Math.PI },
      { file: 'fauteuil', anchor: 'floor', x: -1.35, z: 1.45, yaw: 2.6 },
      { file: 'fauteuil', anchor: 'floor', x: 1.35, z: 1.45, yaw: -2.6 },
      { file: 'bibliotheque', anchor: 'floor', x: -3.15, z: 0.15, yaw: Math.PI / 2 },
    ],
    lights: [
      {
        type: 'spot',
        color: 0xffb56a,
        intensity: 28,
        distance: 4.2,
        angle: 0.85,
        penumbra: 0.45,
        position: [-0.58, 0.26, 0.16],
        target: [0.2, 0, 0],
        cast: false,
      },
      {
        type: 'point',
        color: 0xff6a32,
        intensity: 6,
        distance: 2.2,
        fromFloor: 0.42,
        position: [0, 0, 1.72],
      },
    ],
  },
  club: {
    background: 0x05060a,
    hemi: 0.06,
    hemiSky: 0x1a2430,
    hemiGround: 0x140810,
    sun: 0,
    boardY: 0,
    glassTable: true,
    floor: { color: 0x5c6166, roughness: 0.22, metalness: 0.18 },
    room: { width: 8.4, height: 3.3, depth: 8.6, color: 0x6a7076, z: 1.7 },
    props: [
      { file: 'bar', anchor: 'floor', x: 0.35, z: 3.05 },
      { file: 'tabouret', anchor: 'floor', x: -0.55, z: 1.95 },
      { file: 'tabouret', anchor: 'floor', x: 0.2, z: 1.95 },
      { file: 'tabouret', anchor: 'floor', x: 0.95, z: 1.95 },
      { file: 'bouteilles', anchor: 'floor', lift: 1.1, x: -0.55, z: 2.55 },
      { file: 'tube', anchor: 'floor', lift: 0.55, x: -3.85, z: 0.7, roll: Math.PI / 2, tint: [0, 0.95, 1] },
      { file: 'tube', anchor: 'floor', lift: 1.7, x: 0.2, z: 3.7, tint: [1, 0.12, 0.7] },
      { file: 'enseigne', anchor: 'floor', lift: 0.08, x: -1.7, z: 2.55 },
    ],
    lights: [
      {
        type: 'spot',
        color: 0xf2f6fb,
        intensity: 10,
        distance: 3.2,
        angle: 0.6,
        penumbra: 0.5,
        position: [0, 1.35, -0.55],
        target: [0, 0, 0],
      },
      { type: 'point', color: 0x2ee7ff, intensity: 22, distance: 7, fromFloor: 1.3, position: [-3.4, 0, 0.7] },
      { type: 'point', color: 0xff2f8c, intensity: 28, distance: 6.5, fromFloor: 1.85, position: [0.2, 0, 3.2] },
    ],
  },
};

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
RectAreaLightUniformsLib.init();
document.body.prepend(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(38, window.innerWidth / window.innerHeight, 0.05, 40);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.target.set(...GAME_TARGET);

const loader = new GLTFLoader();
const cache = new Map();
let loadQueue = Promise.resolve();
const stage = new THREE.Group();
scene.add(stage);

const hemi = new THREE.HemisphereLight(0xd7dde6, 0x3a342c, 1);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff3e4, 1);
sun.position.set(1.6, 6.5, -0.4);
sun.castShadow = true;
tuneShadow(sun.shadow);
sun.shadow.camera.near = 0.5;
sun.shadow.camera.far = 12;
sun.shadow.camera.left = -2.5;
sun.shadow.camera.right = 2.5;
sun.shadow.camera.top = 2.5;
sun.shadow.camera.bottom = -2.5;
scene.add(sun);

const focusPoint = new THREE.Vector3(0, 0.02, 0);
const drawing = new THREE.Vector2();

class HbaoPass extends Pass {
  constructor(hbaoScene, hbaoCamera) {
    super();
    this.scene = hbaoScene;
    this.camera = hbaoCamera;
    this.depthTarget = new THREE.WebGLRenderTarget(1, 1, {
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
    });
    this.depthTarget.depthTexture = new THREE.DepthTexture();
    this.depthTarget.depthTexture.type = THREE.UnsignedShortType;
    this.material = new THREE.ShaderMaterial({
      uniforms: {
        tDiffuse: { value: null },
        tDepth: { value: this.depthTarget.depthTexture },
        resolution: { value: new THREE.Vector2(1, 1) },
        inverseProjection: { value: new THREE.Matrix4() },
        radius: { value: 0.32 },
        intensity: { value: 1.35 },
        bias: { value: 0.04 },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform sampler2D tDepth;
        uniform vec2 resolution;
        uniform mat4 inverseProjection;
        uniform float radius;
        uniform float intensity;
        uniform float bias;
        varying vec2 vUv;

        vec3 viewPosition(vec2 uv) {
          float depth = texture2D(tDepth, uv).x;
          vec4 clip = vec4(uv * 2.0 - 1.0, depth * 2.0 - 1.0, 1.0);
          vec4 view = inverseProjection * clip;
          return view.xyz / view.w;
        }

        void main() {
          vec4 color = texture2D(tDiffuse, vUv);
          vec3 origin = viewPosition(vUv);
          vec2 texel = 1.0 / resolution;
          float occlusion = 0.0;
          const int directions = 6;
          const int steps = 5;
          for (int direction = 0; direction < directions; direction++) {
            float angle = (float(direction) + 0.5) * 3.14159265 / float(directions);
            vec2 ray = vec2(cos(angle), sin(angle));
            float horizon = bias;
            for (int step = 1; step <= steps; step++) {
              float along = float(step) / float(steps);
              vec2 uv = vUv + ray * texel * mix(6.0, 36.0, along);
              if (uv.x <= 0.0 || uv.y <= 0.0 || uv.x >= 1.0 || uv.y >= 1.0) break;
              vec3 samplePosition = viewPosition(uv);
              vec3 delta = samplePosition - origin;
              float distance = length(delta);
              if (distance < 0.008 || distance > radius) continue;
              horizon = max(horizon, atan(delta.z, length(delta.xy)));
            }
            occlusion += clamp(horizon, 0.0, 1.5708);
          }
          float ao = 1.0 - clamp(occlusion / float(directions) * intensity, 0.0, 0.85);
          gl_FragColor = vec4(color.rgb * ao, color.a);
        }
      `,
      depthTest: false,
      depthWrite: false,
    });
    this.quad = new FullScreenQuad(this.material);
  }

  setSize(width, height) {
    this.depthTarget.setSize(width, height);
    this.material.uniforms.resolution.value.set(width, height);
  }

  render(renderer, writeBuffer, readBuffer) {
    const previousTarget = renderer.getRenderTarget();
    const previousAutoClear = renderer.autoClear;
    renderer.autoClear = true;
    renderer.setRenderTarget(this.depthTarget);
    renderer.clear();
    renderer.render(this.scene, this.camera);
    renderer.setRenderTarget(previousTarget);
    renderer.autoClear = previousAutoClear;

    this.material.uniforms.tDiffuse.value = readBuffer.texture;
    this.material.uniforms.inverseProjection.value.copy(this.camera.projectionMatrixInverse);
    renderer.setRenderTarget(this.renderToScreen ? null : writeBuffer);
    if (this.clear) renderer.clear();
    this.quad.render(renderer);
  }
}

function viewSize() {
  return renderer.getDrawingBufferSize(drawing);
}

const view = viewSize();
const composerTarget = new THREE.WebGLRenderTarget(window.innerWidth, window.innerHeight, {
  type: THREE.HalfFloatType,
  samples: 4,
});
const composer = new EffectComposer(renderer, composerTarget);
const renderPass = new RenderPass(scene, camera);
const ssrPass = new SSRPass({
  renderer,
  scene,
  camera,
  width: view.x,
  height: view.y,
});
ssrPass.opacity = 0.55;
ssrPass.maxDistance = 6;
ssrPass.thickness = 0.2;
const hbaoPass = new HbaoPass(scene, camera);
hbaoPass.setSize(view.x, view.y);
const bloomPass = new UnrealBloomPass(view.clone(), 0.14, 0.28, 1.2);
const dofPass = new BokehPass(scene, camera, { focus: 1, aperture: 0.018, maxblur: 0.012 });
const smaaPass = new SMAAPass(view.x, view.y);
const outputPass = new OutputPass();
composer.addPass(renderPass);
composer.addPass(ssrPass);
composer.addPass(hbaoPass);
composer.addPass(bloomPass);
composer.addPass(dofPass);
composer.addPass(smaaPass);
composer.addPass(outputPass);
composer.setSize(window.innerWidth, window.innerHeight);

const effects = {
  ssr: ssrPass,
  hbao: hbaoPass,
  bloom: bloomPass,
  dof: dofPass,
  aa: smaaPass,
};

function syncEffects() {
  renderPass.enabled = !ssrPass.enabled;
}

syncEffects();

let board = null;
let current = 'atelier';
let loading = 0;

const INTROS = {
  atelier: {
    duration: 4.5,
    ease: easeOutCubic,
    eye: [new THREE.Vector3(1.35, 0.72, -1.15), new THREE.Vector3(...GAME_EYE)],
    look: [new THREE.Vector3(0, 0.04, 0.1), new THREE.Vector3(...GAME_TARGET)],
  },
  salon: {
    duration: 6,
    ease: easeInOutCubic,
    eye: [
      new THREE.Vector3(0.2, 0.7, 1.55),
      new THREE.Vector3(0.9, 0.6, 0.4),
      new THREE.Vector3(...GAME_EYE),
    ],
    look: [
      new THREE.Vector3(0, 0.08, 0),
      new THREE.Vector3(0, 0.05, 0),
      new THREE.Vector3(...GAME_TARGET),
    ],
  },
  club: {
    duration: 2.8,
    ease: easeOutCubic,
    eye: [new THREE.Vector3(-1.6, 0.35, -1.4), new THREE.Vector3(...GAME_EYE)],
    look: [new THREE.Vector3(0, 0.05, 0.2), new THREE.Vector3(...GAME_TARGET)],
  },
};

let intro = null;

function easeOutCubic(t) {
  return 1 - (1 - t) ** 3;
}

function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

function endIntro() {
  intro = null;
  controls.enabled = true;
  document.querySelector('#intro')?.classList.remove('is-on');
}

function gameCamera() {
  endIntro();
  camera.position.set(...GAME_EYE);
  controls.target.set(...GAME_TARGET);
  controls.update();
  const status = document.querySelector('#status');
  if (status) status.textContent = 'Caméra de partie.';
}

function conceptCamera() {
  endIntro();
  camera.position.set(0, 0.95, -2.35);
  controls.target.set(0, 0.28, 0.7);
  controls.update();
}

function playIntro() {
  const move = INTROS[current];
  intro = {
    duration: move.duration,
    ease: move.ease,
    eye: new THREE.CatmullRomCurve3(move.eye),
    look: new THREE.CatmullRomCurve3(move.look),
    started: performance.now(),
  };
  controls.enabled = false;
  document.querySelector('#intro').classList.add('is-on');
  document.querySelector('#status').textContent = 'Arrivée. Un clic sur la vue l’arrête.';
}

function sampleIntro(now) {
  const raw = Math.min(1, (now - intro.started) / 1000 / intro.duration);
  if (raw >= 1) {
    gameCamera();
    return;
  }
  const t = intro.ease(raw);
  camera.position.copy(intro.eye.getPoint(t));
  controls.target.copy(intro.look.getPoint(t));
  camera.lookAt(controls.target);
}

/**
 * Smoked-glass club table, 1.60 × 0.90 m, top at y = 0, feet at 74 cm.
 * The Meshy bake is an opaque black slab, so the mockup does not load it.
 * @returns {THREE.Group}
 */
function makeClubTable() {
  const length = 1.6;
  const depth = 0.9;
  const height = 0.74;
  const frame = 0.018;
  const group = new THREE.Group();
  const metal = new THREE.MeshStandardMaterial({ color: 0x161616, metalness: 0.9, roughness: 0.32 });
  const bar = (w, h, d, x, y, z) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), metal);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  };
  bar(length, 0.02, frame, 0, -0.01, depth / 2 - frame / 2);
  bar(length, 0.02, frame, 0, -0.01, -depth / 2 + frame / 2);
  bar(frame, 0.02, depth - frame * 2, length / 2 - frame / 2, -0.01, 0);
  bar(frame, 0.02, depth - frame * 2, -length / 2 + frame / 2, -0.01, 0);

  const glass = new THREE.Mesh(
    new THREE.BoxGeometry(length - frame * 2, 0.01, depth - frame * 2),
    new THREE.MeshPhysicalMaterial({
      color: 0xb7c2c8,
      metalness: 0,
      roughness: 0.05,
      transmission: 1,
      thickness: 0.012,
      ior: 1.45,
      attenuationColor: new THREE.Color(0x1a2228),
      attenuationDistance: 0.4,
      envMap: clubGlassEnv(),
      envMapIntensity: 0.9,
    })
  );
  glass.position.y = -0.005;
  glass.castShadow = false;
  glass.receiveShadow = false;
  group.add(glass);

  const legX = length / 2 - 0.03;
  const legZ = depth / 2 - 0.03;
  const legH = height - 0.02;
  for (const x of [-legX, legX]) {
    for (const z of [-legZ, legZ]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.006, legH, 12), metal);
      leg.position.set(x, -0.02 - legH / 2, z);
      leg.castShadow = true;
      group.add(leg);
    }
  }
  const railY = -height + 0.16;
  bar(legX * 2, 0.012, 0.012, 0, railY, legZ);
  bar(legX * 2, 0.012, 0.012, 0, railY, -legZ);
  bar(0.012, 0.012, legZ * 2, legX, railY, 0);
  bar(0.012, 0.012, legZ * 2, -legX, railY, 0);
  const arch = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-legX, railY, 0),
    new THREE.Vector3(0, railY - 0.1, 0),
    new THREE.Vector3(legX, railY, 0),
  ]);
  const bow = new THREE.Mesh(new THREE.TubeGeometry(arch, 28, 0.007, 8, false), metal);
  bow.castShadow = true;
  group.add(bow);
  return group;
}

let glassEnv;

function clubGlassEnv() {
  if (glassEnv) return glassEnv;
  const room = new THREE.Scene();
  room.background = new THREE.Color(0x121418);
  const glow = (color, x, y, z) => {
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(1.6, 1.6),
      new THREE.MeshBasicMaterial({ color })
    );
    mesh.position.set(x, y, z);
    mesh.lookAt(0, 0, 0);
    room.add(mesh);
  };
  glow(0x2ee7ff, -2.2, 1, 0);
  glow(0xff2f8c, 1.6, 1.4, 1.2);
  glow(0x3a424c, 0, 2.2, -2);
  const pmrem = new THREE.PMREMGenerator(renderer);
  glassEnv = pmrem.fromScene(room, 0.04).texture;
  pmrem.dispose();
  return glassEnv;
}

/**
 * Gray plaster cove: 6 m wide, 3 m tall, 80 cm quarter-circle at the floor.
 * Opens toward the camera. The Meshy cyclorama is reversed and is not loaded.
 * @param {number} floorY
 * @param {{ zFront: number, floorRun: number }} cove
 */
function makeCyclorama(floorY, cove) {
  const width = 6;
  const height = 3;
  const radius = 0.8;
  const arcSteps = 20;
  const profile = [{ z: 0, y: 0 }];
  profile.push({ z: cove.floorRun, y: 0 });
  for (let step = 1; step <= arcSteps; step += 1) {
    const theta = -Math.PI / 2 + (step / arcSteps) * (Math.PI / 2);
    profile.push({
      z: cove.floorRun + Math.cos(theta) * radius,
      y: radius + Math.sin(theta) * radius,
    });
  }
  profile.push({ z: cove.floorRun + radius, y: height });

  const positions = [];
  const normals = [];
  const indices = [];
  const half = width / 2;
  for (let row = 0; row < profile.length; row += 1) {
    const next = profile[Math.min(row + 1, profile.length - 1)];
    const prev = profile[Math.max(row - 1, 0)];
    const dz = next.z - prev.z;
    const dy = next.y - prev.y;
    const length = Math.hypot(dz, dy) || 1;
    const ny = dz / length;
    const nz = -dy / length;
    const point = profile[row];
    positions.push(-half, point.y, point.z, half, point.y, point.z);
    normals.push(0, ny, nz, 0, ny, nz);
  }
  for (let row = 0; row < profile.length - 1; row += 1) {
    const index = row * 2;
    indices.push(index, index + 2, index + 1, index + 1, index + 2, index + 3);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setIndex(indices);
  const mesh = new THREE.Mesh(
    geometry,
    new THREE.MeshStandardMaterial({ color: 0xc5c5c0, roughness: 0.96, metalness: 0 })
  );
  mesh.position.set(0, floorY, cove.zFront);
  mesh.receiveShadow = true;
  return mesh;
}

/**
 * In-game board: Wood094 / Wood051 checker and a Metal048C gold plinth.
 * Bottom sits on the group origin. The Meshy GLB is not loaded.
 * @returns {Promise<THREE.Group>}
 */
async function ensureBoard() {
  if (board) return board;
  const [wood, gold] = await Promise.all([composeGameBoardMaps(), gameGoldMaterial()]);
  const outer = BOARD_EXTENT + BOARD_BEVEL * 2;
  const half = outer / 2;
  const shape = new THREE.Shape();
  shape.moveTo(-half, -half);
  shape.lineTo(half, -half);
  shape.lineTo(half, half);
  shape.lineTo(-half, half);
  shape.closePath();
  const bodyGeo = new THREE.ExtrudeGeometry(shape, {
    depth: BOARD_HEIGHT - BOARD_BEVEL * 2,
    bevelEnabled: true,
    bevelThickness: BOARD_BEVEL,
    bevelSize: BOARD_BEVEL,
    bevelSegments: 1,
  });
  bodyGeo.rotateX(-Math.PI / 2);
  bodyGeo.computeBoundingBox();
  bodyGeo.translate(0, -bodyGeo.boundingBox.min.y, 0);
  const body = new THREE.Mesh(bodyGeo, gold);
  body.castShadow = true;
  body.receiveShadow = true;
  const top = new THREE.Mesh(
    new THREE.PlaneGeometry(BOARD_EXTENT, BOARD_EXTENT),
    new THREE.MeshPhysicalMaterial({
      map: wood.color,
      normalMap: wood.normal,
      roughnessMap: wood.roughness,
      roughness: 1,
      metalness: 0,
      normalScale: new THREE.Vector2(0.55, 0.55),
      clearcoat: 0.38,
      clearcoatRoughness: 0.36,
    })
  );
  top.rotation.x = -Math.PI / 2;
  top.position.y = BOARD_HEIGHT + 0.0004;
  top.receiveShadow = true;
  const group = new THREE.Group();
  group.add(body, top);
  board = group;
  return board;
}

const GAME_TEX = '../game-textures';

function loadGameImage(file) {
  const image = new Image();
  image.src = `${GAME_TEX}/${file}?v=21`;
  return image.decode().then(() => image);
}

function imageToMap(image) {
  const canvas = document.createElement('canvas');
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  context.drawImage(image, 0, 0);
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
  return { data: pixels.data, w: canvas.width, h: canvas.height };
}

function sampleMap(map, u, v) {
  const x = (u - Math.floor(u)) * map.w;
  const y = (v - Math.floor(v)) * map.h;
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const tx = x - x0;
  const ty = y - y0;
  const x1 = (x0 + 1) % map.w;
  const y1 = (y0 + 1) % map.h;
  const at = (ix, iy) => {
    const offset = (iy * map.w + ix) * 4;
    return [map.data[offset], map.data[offset + 1], map.data[offset + 2]];
  };
  const a = at(x0, y0);
  const b = at(x1, y0);
  const c = at(x0, y1);
  const d = at(x1, y1);
  const blend = (p, q, t) => p + (q - p) * t;
  return [
    blend(blend(a[0], b[0], tx), blend(c[0], d[0], tx), ty),
    blend(blend(a[1], b[1], tx), blend(c[1], d[1], tx), ty),
    blend(blend(a[2], b[2], tx), blend(c[2], d[2], tx), ty),
  ];
}

function squareSeed(fx, fy) {
  const n = Math.sin(fx * 1.73 * 127.1 + fy * 3.11 * 311.7) * 43758.5453;
  return n - Math.floor(n);
}

async function composeGameBoardMaps() {
  const [lightColor, lightNormal, lightRough, darkColor, darkNormal, darkRough] = await Promise.all([
    loadGameImage('Wood094_1K_Color.jpg'),
    loadGameImage('Wood094_1K_NormalGL.jpg'),
    loadGameImage('Wood094_1K_Roughness.jpg'),
    loadGameImage('Wood051_1K_Color.jpg'),
    loadGameImage('Wood051_1K_NormalGL.jpg'),
    loadGameImage('Wood051_1K_Roughness.jpg'),
  ]);
  const maps = {
    light: { color: imageToMap(lightColor), normal: imageToMap(lightNormal), rough: imageToMap(lightRough) },
    dark: { color: imageToMap(darkColor), normal: imageToMap(darkNormal), rough: imageToMap(darkRough) },
  };
  const size = 1024;
  const color = new ImageData(size, size);
  const normal = new ImageData(size, size);
  const rough = new ImageData(size, size);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const u = (x + 0.5) / size;
      const v = 1 - (y + 0.5) / size;
      const cell = boardCell(u, v);
      let su;
      let sv;
      let rotate = false;
      let source;
      if (cell.kind === 'frame') {
        su = u * 4.5;
        sv = v * 1.15;
        source = maps.dark;
      } else {
        const seed = squareSeed(cell.fx, cell.fy);
        rotate = !cell.light;
        su = (rotate ? cell.lv : cell.lu) * 1.12 + seed * 0.85;
        sv = (rotate ? cell.lu : cell.lv) * 1.12 + seed * 0.37;
        source = cell.light ? maps.light : maps.dark;
      }
      const rgb = sampleMap(source.color, su, sv);
      const nRgb = sampleMap(source.normal, su, sv);
      const rRgb = sampleMap(source.rough, su, sv);
      let nx = (nRgb[0] / 255) * 2 - 1;
      let ny = (nRgb[1] / 255) * 2 - 1;
      const nz = (nRgb[2] / 255) * 2 - 1;
      if (rotate) {
        const swap = nx;
        nx = ny;
        ny = swap;
      }
      const length = Math.hypot(nx, ny, nz) || 1;
      const offset = (y * size + x) * 4;
      color.data[offset] = rgb[0];
      color.data[offset + 1] = rgb[1];
      color.data[offset + 2] = rgb[2];
      color.data[offset + 3] = 255;
      normal.data[offset] = (nx / length) * 127.5 + 127.5;
      normal.data[offset + 1] = (ny / length) * 127.5 + 127.5;
      normal.data[offset + 2] = (nz / length) * 127.5 + 127.5;
      normal.data[offset + 3] = 255;
      rough.data[offset + 1] = rRgb[0];
      rough.data[offset + 3] = 255;
    }
  }
  return {
    color: canvasTexture(color, THREE.SRGBColorSpace),
    normal: canvasTexture(normal, THREE.NoColorSpace),
    roughness: canvasTexture(rough, THREE.NoColorSpace),
  };
}

function canvasTexture(image, colorSpace) {
  const canvas = document.createElement('canvas');
  canvas.width = image.width;
  canvas.height = image.height;
  canvas.getContext('2d').putImageData(image, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = colorSpace;
  texture.anisotropy = 8;
  texture.flipY = false;
  return texture;
}

async function gameGoldMaterial() {
  const [colorImage, normalImage, roughImage, metalImage] = await Promise.all([
    loadGameImage('Metal048C_1K_Color.jpg'),
    loadGameImage('Metal048C_1K_NormalGL.jpg'),
    loadGameImage('Metal048C_1K_Roughness.jpg'),
    loadGameImage('Metal048C_1K_Metalness.jpg'),
  ]);
  const repeat = 24 / BOARD_EXTENT;
  const tile = (image, colorSpace) => {
    const texture = new THREE.Texture(image);
    texture.needsUpdate = true;
    texture.colorSpace = colorSpace;
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(repeat, repeat);
    return texture;
  };
  const roughMap = imageToMap(roughImage);
  const satin = new ImageData(roughMap.w, roughMap.h);
  for (let i = 0; i < roughMap.w * roughMap.h; i += 1) {
    const byte = Math.round(Math.min(1, 0.36 + 0.22 * (roughMap.data[i * 4] / 255)) * 255);
    satin.data[i * 4 + 1] = byte;
    satin.data[i * 4 + 3] = 255;
  }
  const roughness = canvasTexture(satin, THREE.NoColorSpace);
  roughness.wrapS = THREE.RepeatWrapping;
  roughness.wrapT = THREE.RepeatWrapping;
  roughness.repeat.set(repeat, repeat);
  return new THREE.MeshStandardMaterial({
    map: tile(colorImage, THREE.SRGBColorSpace),
    normalMap: tile(normalImage, THREE.NoColorSpace),
    roughnessMap: roughness,
    metalnessMap: tile(metalImage, THREE.NoColorSpace),
    metalness: 1,
    roughness: 1,
    normalScale: new THREE.Vector2(0.14, 0.14),
  });
}

function boardCell(u, v) {
  const inner = 1 - 2 * BOARD_BORDER;
  if (u < BOARD_BORDER || v < BOARD_BORDER || u >= 1 - BOARD_BORDER || v >= 1 - BOARD_BORDER) {
    return { kind: 'frame' };
  }
  const su = ((u - BOARD_BORDER) / inner) * 8;
  const sv = ((v - BOARD_BORDER) / inner) * 8;
  const fx = Math.min(7, Math.floor(su));
  const fy = Math.min(7, Math.floor(sv));
  return {
    kind: 'square',
    fx,
    fy,
    lu: su - fx,
    lv: sv - fy,
    light: (fx + (7 - fy)) % 2 === 0,
  };
}

function propUrl(name, file) {
  const size = document.querySelector('#tier').value;
  return `../raw_assets/${name}/baked/${size}/${file}.glb`;
}

async function loadOnce(url) {
  let lastError;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await loader.loadAsync(url);
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 200 * (attempt + 1)));
    }
  }
  throw lastError;
}

function loadProp(name, file) {
  const url = propUrl(name, file);
  const hit = cache.get(url);
  if (hit) return hit;
  const pending = loadQueue.then(() => loadOnce(url));
  loadQueue = pending.then(
    () => {},
    () => {}
  );
  pending.catch(() => cache.delete(url));
  cache.set(url, pending);
  return pending;
}

function cloneProp(root) {
  const clone = root.clone(true);
  clone.traverse((obj) => {
    if (obj.isMesh) {
      obj.material = obj.material.clone();
      obj.castShadow = true;
      obj.receiveShadow = true;
    }
  });
  return clone;
}

function place(root, spec, floorY) {
  root.rotation.set(spec.pitch ?? 0, spec.yaw ?? 0, spec.roll ?? 0);
  root.position.set(0, 0, 0);
  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root);
  if (spec.anchor === 'top') root.position.y = -box.max.y;
  if (spec.anchor === 'surface') root.position.y = -box.min.y + (spec.lift ?? 0);
  if (spec.anchor === 'under') root.position.y = -0.012 - box.max.y;
  if (spec.anchor === 'floor') root.position.y = floorY - box.min.y + (spec.lift ?? 0);
  root.position.x = spec.x ?? 0;
  root.position.z = spec.z ?? 0;
  if (spec.emissiveScale !== undefined) {
    root.traverse((obj) => {
      if (obj.isMesh) obj.material.emissiveIntensity *= spec.emissiveScale;
    });
  }
  if (spec.tint) {
    root.traverse((obj) => {
      if (!obj.isMesh) return;
      obj.material.emissive = new THREE.Color().setRGB(
        spec.tint[0],
        spec.tint[1],
        spec.tint[2],
        THREE.SRGBColorSpace
      );
    });
  }
}

async function show(name) {
  endIntro();
  const ticket = ++loading;
  const spec = SCENES[name];
  document.querySelector('#status').textContent = 'Chargement…';
  stage.clear();
  scene.background = new THREE.Color(spec.background);
  hemi.color.set(spec.hemiSky);
  hemi.groundColor.set(spec.hemiGround);
  hemi.intensity = spec.hemi;
  sun.intensity = spec.sun;
  if (spec.sunPos) sun.position.set(...spec.sunPos);

  const [loaded, realBoard] = await Promise.all([
    Promise.all(
      spec.props.map(async (prop) => ({
        prop,
        root: cloneProp((await loadProp(name, prop.file)).scene),
      }))
    ),
    ensureBoard(),
  ]);
  if (ticket !== loading) return;
  const table = spec.glassTable
    ? makeClubTable()
    : loaded.find((item) => item.prop.file === 'table' && item.prop.anchor === 'top').root;
  if (!spec.glassTable) place(table, { anchor: 'top' }, 0);
  const floorY = new THREE.Box3().setFromObject(table).min.y;
  stage.add(table);

  if (spec.floor) {
    const depth = spec.floor.depth ?? 14;
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(spec.floor.width ?? 14, depth),
      new THREE.MeshStandardMaterial({
        color: spec.floor.color,
        roughness: spec.floor.roughness,
        metalness: spec.floor.metalness ?? 0,
      })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = floorY + 0.003;
    if (spec.floor.zMax !== undefined) floor.position.z = spec.floor.zMax - depth / 2;
    floor.receiveShadow = true;
    stage.add(floor);
  }

  if (spec.cove) stage.add(makeCyclorama(floorY, spec.cove));

  if (spec.room) {
    const room = new THREE.Mesh(
      new THREE.BoxGeometry(spec.room.width, spec.room.height, spec.room.depth),
      new THREE.MeshStandardMaterial({ color: spec.room.color, roughness: 0.92, side: THREE.BackSide })
    );
    room.position.set(0, floorY + spec.room.height / 2, spec.room.z);
    room.receiveShadow = true;
    stage.add(room);
  }

  for (const item of loaded) {
    if (item.root === table) continue;
    place(item.root, item.prop, floorY);
    stage.add(item.root);
  }

  for (const light of spec.lights) addLight(light, floorY);
  if (ticket !== loading) return;

  realBoard.position.y = spec.boardY;
  stage.add(realBoard);
  focusPoint.set(0, spec.boardY + 0.012, 0);
  conceptCamera();
  document.querySelector('#status').textContent = 'Cadre du concept. Caméra de jeu pour le cadrage de partie.';
}

function tuneShadow(shadow) {
  shadow.mapSize.set(2048, 2048);
  shadow.bias = -0.0003;
  shadow.normalBias = 0.04;
}

function lightHeight(light, floorY) {
  return light.fromFloor === undefined ? light.position[1] : floorY + light.fromFloor;
}

function addLight(light, floorY) {
  const y = lightHeight(light, floorY);
  if (light.type === 'rect') {
    const rect = new THREE.RectAreaLight(light.color, light.intensity, light.width, light.height);
    rect.position.set(light.position[0], y, light.position[2]);
    rect.lookAt(light.target[0], light.target[1], light.target[2]);
    stage.add(rect);
    return;
  }
  if (light.type === 'spot') {
    const spot = new THREE.SpotLight(
      light.color,
      light.intensity,
      light.distance ?? 0,
      light.angle,
      light.penumbra,
      1
    );
    spot.position.set(light.position[0], y, light.position[2]);
    spot.target.position.set(...light.target);
    spot.castShadow = light.cast !== false;
    if (spot.castShadow) tuneShadow(spot.shadow);
    stage.add(spot, spot.target);
    return;
  }
  const point = new THREE.PointLight(light.color, light.intensity, light.distance, 2);
  point.position.set(light.position[0], y, light.position[2]);
  stage.add(point);
}

gameCamera();

document.querySelectorAll('[data-scene]').forEach((button) => {
  button.addEventListener('click', () => {
    document.querySelectorAll('[data-scene]').forEach((item) => item.classList.toggle('is-on', item === button));
    current = button.dataset.scene;
    show(current).catch((error) => {
      document.querySelector('#status').textContent = error.message;
    });
  });
});

document.querySelector('#tier').addEventListener('change', () => {
  cache.clear();
  show(current).catch((error) => {
    document.querySelector('#status').textContent = error.message;
  });
});

document.querySelector('#reset').addEventListener('click', gameCamera);
document.querySelector('#wide').addEventListener('click', conceptCamera);
document.querySelector('#intro').addEventListener('click', playIntro);
renderer.domElement.addEventListener('pointerdown', () => {
  if (intro) gameCamera();
});

document.querySelectorAll('[data-fx]').forEach((button) => {
  button.addEventListener('click', () => {
    const pass = effects[button.dataset.fx];
    pass.enabled = !pass.enabled;
    button.classList.toggle('is-on', pass.enabled);
    syncEffects();
  });
});

function resizeView() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
  const size = viewSize();
  ssrPass.setSize(size.x, size.y);
  hbaoPass.setSize(size.x, size.y);
  bloomPass.setSize(size.x, size.y);
  dofPass.setSize(size.x, size.y);
  dofPass.uniforms.aspect.value = camera.aspect;
}

window.addEventListener('resize', resizeView);

renderer.setAnimationLoop(() => {
  if (intro) sampleIntro(performance.now());
  else controls.update();
  dofPass.uniforms.focus.value = camera.position.distanceTo(focusPoint);
  dofPass.uniforms.aspect.value = camera.aspect;
  composer.render();
});

show(current).catch((error) => {
  document.querySelector('#status').textContent = error.message;
});
