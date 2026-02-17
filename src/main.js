import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";

import {
  photosphereVertexShader,
  photosphereFragmentShader,
  chromosphereVertexShader,
  chromosphereFragmentShader,
  coronaVertexShader,
  coronaFragmentShader,
  coreVertexShader,
  coreFragmentShader,
  starVertexShader,
  starFragmentShader,
  solarWindVertexShader,
  solarWindFragmentShader,
} from "./shaders.js";

// ── Renderer ───────────────────────────────────────────────
const container = document.getElementById("app");

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);

// Fix #1 – modern colour-space API
renderer.outputColorSpace = THREE.SRGBColorSpace;

// Fix #2 – physically correct light attenuation (r161+)
renderer.useLegacyLights = false;

// Fix #3 – HDR tone mapping pipeline
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;

container.appendChild(renderer.domElement);

// ── Scene & Camera ─────────────────────────────────────────
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);

const camera = new THREE.PerspectiveCamera(
  45,
  window.innerWidth / window.innerHeight,
  0.1,
  200
);
camera.position.set(0, 5, 18);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.minDistance = 6;
controls.maxDistance = 40;

// ── Post-processing ────────────────────────────────────────
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));

const bloomPass = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  1.8,
  0.4,
  0.0
);
composer.addPass(bloomPass);

// ── Starfield (Fix #6 – custom shader) ─────────────────────
const starField = new THREE.Group();
const starCount = 3000;
const starPositions = new Float32Array(starCount * 3);
const starBrightness = new Float32Array(starCount);

for (let i = 0; i < starCount; i++) {
  const r = 200;
  const u = Math.random();
  const v = Math.random();
  const theta = 2 * Math.PI * u;
  const phi = Math.acos(2 * v - 1);
  starPositions[i * 3 + 0] = r * Math.sin(phi) * Math.cos(theta);
  starPositions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
  starPositions[i * 3 + 2] = r * Math.cos(phi);
  starBrightness[i] = Math.random();
}

const starGeometry = new THREE.BufferGeometry();
starGeometry.setAttribute("position", new THREE.BufferAttribute(starPositions, 3));
starGeometry.setAttribute("starBrightness", new THREE.BufferAttribute(starBrightness, 1));

const starMaterial = new THREE.ShaderMaterial({
  vertexShader: starVertexShader,
  fragmentShader: starFragmentShader,
  transparent: true,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
  toneMapped: false,       // Fix #4
});

const stars = new THREE.Points(starGeometry, starMaterial);
starField.add(stars);
scene.add(starField);

// ── Sun ────────────────────────────────────────────────────
const SUN_RADIUS = 5;

function createSun() {
  const group = new THREE.Group();

  // --- Photosphere ---
  const photosphereGeometry = new THREE.SphereGeometry(SUN_RADIUS, 128, 128);
  const photosphereMaterial = new THREE.ShaderMaterial({
    vertexShader: photosphereVertexShader,
    fragmentShader: photosphereFragmentShader,
    uniforms: {
      time: { value: 0 },
      rotationSpeed: { value: 0.04 },    // Fix #8
      colorHot: { value: new THREE.Color(1.0, 0.86, 0.4) },
      colorCool: { value: new THREE.Color(0.9, 0.4, 0.05) },
      brightness: { value: 2.2 },
    },
    transparent: false,
    toneMapped: false,       // Fix #4
  });

  const photosphere = new THREE.Mesh(photosphereGeometry, photosphereMaterial);
  photosphere.name = "photosphere";
  photosphere.renderOrder = 0;    // Fix #7
  group.add(photosphere);

  // --- Chromosphere ---
  const chromosphereGeometry = new THREE.SphereGeometry(SUN_RADIUS * 1.03, 96, 96);
  const chromosphereMaterial = new THREE.ShaderMaterial({
    vertexShader: chromosphereVertexShader,
    fragmentShader: chromosphereFragmentShader,
    uniforms: {
      time: { value: 0 },
      colorInner: { value: new THREE.Color(1.0, 0.47, 0.2) },
      colorOuter: { value: new THREE.Color(0.9, 0.2, 0.05) },
    },
    blending: THREE.AdditiveBlending,
    side: THREE.BackSide,
    transparent: true,
    depthWrite: false,
    toneMapped: false,       // Fix #4
  });

  const chromosphere = new THREE.Mesh(chromosphereGeometry, chromosphereMaterial);
  chromosphere.name = "chromosphere";
  chromosphere.renderOrder = 2;   // Fix #7
  group.add(chromosphere);

  // --- Corona (Fix #5 + #7 + #11) ---
  const coronaGeometry = new THREE.SphereGeometry(SUN_RADIUS * 2.5, 96, 96);
  const coronaMaterial = new THREE.ShaderMaterial({
    vertexShader: coronaVertexShader,
    fragmentShader: coronaFragmentShader,
    uniforms: {
      time: { value: 0 },
      colorInner: { value: new THREE.Color(0.9, 0.95, 1.0) },
      colorOuter: { value: new THREE.Color(0.5, 0.7, 1.0) },
    },
    blending: THREE.AdditiveBlending,
    transparent: true,
    side: THREE.FrontSide,
    depthWrite: false,
    depthTest: false,        // Fix #5
    toneMapped: false,       // Fix #4
  });

  const corona = new THREE.Mesh(coronaGeometry, coronaMaterial);
  corona.name = "corona";
  corona.renderOrder = 3;        // Fix #7
  group.add(corona);

  // --- Prominences (Fix #13 – InstancedMesh) ---
  const prominenceCount = 12;
  const prominenceArcGeometry = new THREE.TorusGeometry(
    SUN_RADIUS * 1.15,
    SUN_RADIUS * 0.015,
    24,
    64,
    Math.PI * 0.45
  );
  const prominenceMaterial = new THREE.MeshBasicMaterial({
    color: new THREE.Color(1.0, 0.55, 0.2),
    transparent: true,
    opacity: 0.7,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });

  const prominenceInstanced = new THREE.InstancedMesh(
    prominenceArcGeometry,
    prominenceMaterial,
    prominenceCount
  );
  prominenceInstanced.name = "prominences";
  prominenceInstanced.renderOrder = 1;  // Fix #7

  const _pDummy = new THREE.Object3D();
  const prominenceData = [];

  for (let i = 0; i < prominenceCount; i++) {
    const lat = THREE.MathUtils.degToRad(THREE.MathUtils.randFloatSpread(50));
    const lon = THREE.MathUtils.degToRad(Math.random() * 360);

    const dir = new THREE.Vector3(
      Math.cos(lat) * Math.cos(lon),
      Math.sin(lat),
      Math.cos(lat) * Math.sin(lon)
    ).normalize();

    const centerRadius = SUN_RADIUS * 1.02;
    _pDummy.position.copy(dir.clone().multiplyScalar(centerRadius));
    _pDummy.lookAt(_pDummy.position.clone().multiplyScalar(1.1));
    _pDummy.rotateX(Math.PI * 0.5);

    const scale = 0.7 + Math.random() * 0.3;
    _pDummy.scale.set(scale, scale, scale);
    _pDummy.updateMatrix();
    prominenceInstanced.setMatrixAt(i, _pDummy.matrix);

    prominenceData.push({
      baseScale: scale,
      phaseOffset: Math.random() * Math.PI * 2,
      baseOpacity: 0.7,
    });
  }
  prominenceInstanced.instanceMatrix.needsUpdate = true;
  group.add(prominenceInstanced);

  // --- Flares (Fix #13 – InstancedMesh) ---
  const flareCount = 5;
  const flareGeometry = new THREE.SphereGeometry(SUN_RADIUS * 0.18, 32, 32);
  const flareMaterial = new THREE.MeshBasicMaterial({
    color: new THREE.Color(1.0, 0.9, 0.6),
    transparent: true,
    opacity: 0.0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });

  const flareInstanced = new THREE.InstancedMesh(
    flareGeometry,
    flareMaterial,
    flareCount
  );
  flareInstanced.name = "flares";
  flareInstanced.renderOrder = 1;  // Fix #7

  const _fDummy = new THREE.Object3D();
  const flareData = [];

  for (let i = 0; i < flareCount; i++) {
    // Start hidden far away
    _fDummy.position.set(0, 0, 0);
    _fDummy.scale.set(0.001, 0.001, 0.001);
    _fDummy.updateMatrix();
    flareInstanced.setMatrixAt(i, _fDummy.matrix);

    flareData.push({
      active: false,
      startTime: 0,
      duration: 0.8 + Math.random() * 0.6,
      nextTrigger: Math.random() * 8.0,
      posX: 0, posY: 0, posZ: 0,
    });
  }
  flareInstanced.instanceMatrix.needsUpdate = true;
  group.add(flareInstanced);

  // --- Solar Wind (Fix #12, #15 – GPU particles) ---
  const windCount = 6000;
  const windGeometry = new THREE.BufferGeometry();
  const windSeeds = new Float32Array(windCount * 3);
  const windPositions = new Float32Array(windCount * 3); // dummy, shader overrides

  for (let i = 0; i < windCount; i++) {
    const u = Math.random();
    const v = Math.random();
    const theta = 2 * Math.PI * u;
    const phi = Math.acos(2 * v - 1);
    windSeeds[i * 3 + 0] = Math.sin(phi) * Math.cos(theta);
    windSeeds[i * 3 + 1] = Math.sin(phi) * Math.sin(theta);
    windSeeds[i * 3 + 2] = Math.cos(phi);
    // Position is computed in vertex shader
    windPositions[i * 3 + 0] = 0;
    windPositions[i * 3 + 1] = 0;
    windPositions[i * 3 + 2] = 0;
  }

  windGeometry.setAttribute("position", new THREE.BufferAttribute(windPositions, 3));
  windGeometry.setAttribute("seed", new THREE.BufferAttribute(windSeeds, 3));

  const windMaterial = new THREE.ShaderMaterial({
    vertexShader: solarWindVertexShader,
    fragmentShader: solarWindFragmentShader,
    uniforms: {
      time: { value: 0 },
      sunRadius: { value: SUN_RADIUS },
    },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,       // Fix #4
  });

  const solarWind = new THREE.Points(windGeometry, windMaterial);
  solarWind.name = "solarWind";
  solarWind.renderOrder = 4;     // Fix #7
  solarWind.frustumCulled = false;
  group.add(solarWind);

  // --- Internal cutaway layers ---
  const coreGroup = new THREE.Group();
  coreGroup.name = "internalLayers";

  const coreGeometry = new THREE.SphereGeometry(SUN_RADIUS * 0.25, 64, 64);
  const coreMaterial = new THREE.ShaderMaterial({
    vertexShader: coreVertexShader,
    fragmentShader: coreFragmentShader,
    uniforms: {
      time: { value: 0 },
      colorCore: { value: new THREE.Color(1.0, 1.0, 0.9) },
    },
    transparent: false,
    toneMapped: false,       // Fix #4
  });

  const core = new THREE.Mesh(coreGeometry, coreMaterial);
  core.name = "core";
  coreGroup.add(core);

  const radiativeGeometry = new THREE.SphereGeometry(SUN_RADIUS * 0.45, 64, 64);
  const radiativeMaterial = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(1.0, 0.9, 0.7),
    emissive: new THREE.Color(1.0, 0.9, 0.6),
    emissiveIntensity: 2.5,
    transparent: true,
    opacity: 0.9,
    roughness: 0.2,
    metalness: 0.0,
  });

  const radiativeZone = new THREE.Mesh(radiativeGeometry, radiativeMaterial);
  radiativeZone.name = "radiativeZone";
  coreGroup.add(radiativeZone);

  const convectiveGeometry = new THREE.SphereGeometry(SUN_RADIUS * 0.75, 64, 64);
  const convectiveMaterial = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(1.0, 0.7, 0.3),
    emissive: new THREE.Color(1.0, 0.6, 0.2),
    emissiveIntensity: 1.5,
    transparent: true,
    opacity: 0.8,
    roughness: 0.7,
  });

  const convectiveZone = new THREE.Mesh(convectiveGeometry, convectiveMaterial);
  convectiveZone.name = "convectiveZone";
  coreGroup.add(convectiveZone);

  coreGroup.visible = false;
  group.add(coreGroup);

  // ── Export references ──
  group.userData = {
    photosphereMaterial,
    chromosphereMaterial,
    coronaMaterial,
    coreMaterial,
    windMaterial,
    coreGroup,
    flareInstanced,
    flareData,
    prominenceInstanced,
    prominenceData,
    solarWind,
  };

  return group;
}

const sun = createSun();
scene.add(sun);

// ── Lighting ───────────────────────────────────────────────
const ambientLight = new THREE.AmbientLight(0xffffff, 0.02);
scene.add(ambientLight);

const sunLight = new THREE.PointLight(0xffffff, 3.0, 0, 2);
sunLight.position.set(0, 0, 0);
scene.add(sunLight);

// ── Keyboard controls ──────────────────────────────────────
let isCutaway = false;
let flaresEnabled = true;

function setCutaway(enabled) {
  isCutaway = enabled;
  const photosphere = sun.getObjectByName("photosphere");
  const chromosphere = sun.getObjectByName("chromosphere");
  const corona = sun.getObjectByName("corona");
  const internal = sun.getObjectByName("internalLayers");

  if (!photosphere || !chromosphere || !corona || !internal) return;

  photosphere.material.transparent = enabled;
  photosphere.material.opacity = enabled ? 0.35 : 1.0;
  chromosphere.material.transparent = true;
  corona.material.transparent = true;

  internal.visible = enabled;
}

window.addEventListener("keydown", (event) => {
  if (event.key === "c" || event.key === "C") setCutaway(!isCutaway);
  if (event.key === "f" || event.key === "F") flaresEnabled = !flaresEnabled;
  if (event.key === "Escape") closeSunInfoPanel();
});

// ── Sun Info Panel toggle ──────────────────────────────────
const sunInfoBtn = document.getElementById("sunInfoBtn");
const sunInfoPanel = document.getElementById("sunInfoPanel");
const panelCloseBtn = document.getElementById("panelCloseBtn");
const panelBackdrop = document.getElementById("panelBackdrop");
let panelOpen = false;

function openSunInfoPanel() {
  panelOpen = true;
  sunInfoPanel.classList.add("open");
  panelBackdrop.classList.add("open");
}

function closeSunInfoPanel() {
  if (!panelOpen) return;
  panelOpen = false;
  sunInfoPanel.classList.remove("open");
  panelBackdrop.classList.remove("open");
}

function toggleSunInfoPanel() {
  panelOpen ? closeSunInfoPanel() : openSunInfoPanel();
}

sunInfoBtn.addEventListener("click", toggleSunInfoPanel);
panelCloseBtn.addEventListener("click", closeSunInfoPanel);
panelBackdrop.addEventListener("click", closeSunInfoPanel);


// ── Prominence animation (InstancedMesh) ───────────────────
const _promDummy = new THREE.Object3D();
const _promMatrix = new THREE.Matrix4();

function updateProminences(delta, elapsedTime) {
  const instMesh = sun.userData.prominenceInstanced;
  const data = sun.userData.prominenceData;

  for (let i = 0; i < data.length; i++) {
    const d = data[i];
    const t = elapsedTime * 0.4 + d.phaseOffset;
    const scaleMod = 0.9 + Math.sin(t * 2.0) * 0.1;
    const opacity = d.baseOpacity * (0.7 + 0.3 * Math.sin(t * 1.5 + i));

    // Read current matrix, update scale only
    instMesh.getMatrixAt(i, _promMatrix);
    _promDummy.matrix.copy(_promMatrix);
    _promDummy.matrix.decompose(_promDummy.position, _promDummy.quaternion, _promDummy.scale);
    const s = d.baseScale * scaleMod;
    _promDummy.scale.set(s, s, s);
    _promDummy.updateMatrix();
    instMesh.setMatrixAt(i, _promDummy.matrix);
  }

  instMesh.instanceMatrix.needsUpdate = true;

  // Opacity: uniform for all instances via the shared material
  const avgT = elapsedTime * 0.4;
  instMesh.material.opacity = 0.6 + 0.15 * Math.sin(avgT);
}

// ── Flare animation (InstancedMesh) ────────────────────────
const _flareDummy = new THREE.Object3D();

function updateFlares(delta, elapsedTime) {
  const instMesh = sun.userData.flareInstanced;
  const data = sun.userData.flareData;

  if (!flaresEnabled) {
    for (let i = 0; i < data.length; i++) {
      data[i].active = false;
      _flareDummy.position.set(0, 0, 0);
      _flareDummy.scale.set(0.001, 0.001, 0.001);
      _flareDummy.updateMatrix();
      instMesh.setMatrixAt(i, _flareDummy.matrix);
    }
    instMesh.material.opacity = 0.0;
    instMesh.instanceMatrix.needsUpdate = true;
    return;
  }

  let maxOpacity = 0;

  for (let i = 0; i < data.length; i++) {
    const d = data[i];

    if (!d.active) {
      d.nextTrigger -= delta;
      if (d.nextTrigger <= 0) {
        d.active = true;
        d.startTime = elapsedTime;
        d.duration = 0.7 + Math.random() * 0.7;
        d.nextTrigger = 4.0 + Math.random() * 8.0;

        const u = Math.random();
        const v = Math.random();
        const theta = 2 * Math.PI * u;
        const phi = Math.acos(2 * v - 1);
        const x = Math.sin(phi) * Math.cos(theta);
        const y = Math.sin(phi) * Math.sin(theta);
        const z = Math.cos(phi);
        const r = SUN_RADIUS * (1.02 + Math.random() * 0.05);
        d.posX = x * r;
        d.posY = y * r;
        d.posZ = z * r;
      }
    }

    if (d.active) {
      const t = (elapsedTime - d.startTime) / d.duration;
      if (t >= 1.0) {
        d.active = false;
        _flareDummy.scale.set(0.001, 0.001, 0.001);
        _flareDummy.position.set(0, 0, 0);
      } else {
        const intensity = Math.sin(Math.PI * t);
        maxOpacity = Math.max(maxOpacity, intensity * 0.9);
        const s = 0.8 + intensity * 1.5;
        _flareDummy.position.set(d.posX, d.posY, d.posZ);
        _flareDummy.scale.set(s, s, s);
      }
    } else {
      _flareDummy.scale.set(0.001, 0.001, 0.001);
      _flareDummy.position.set(0, 0, 0);
    }

    _flareDummy.updateMatrix();
    instMesh.setMatrixAt(i, _flareDummy.matrix);
  }

  instMesh.material.opacity = Math.min(maxOpacity, 0.9);
  instMesh.instanceMatrix.needsUpdate = true;
}

// ── Internal layers ────────────────────────────────────────
function updateInternalLayers(delta, elapsedTime) {
  const internal = sun.userData.coreGroup;
  if (!internal.visible) return;
  const convectiveZone = internal.getObjectByName("convectiveZone");
  if (convectiveZone) convectiveZone.rotation.y += delta * 0.15;
}

// ── Animation loop ─────────────────────────────────────────
let previousTime = performance.now() / 1000;

function animate() {
  requestAnimationFrame(animate);

  const currentTime = performance.now() / 1000;
  const delta = currentTime - previousTime;
  previousTime = currentTime;
  const elapsedTime = currentTime;

  // Update shader uniforms
  const {
    photosphereMaterial,
    chromosphereMaterial,
    coronaMaterial,
    coreMaterial,
    windMaterial,
  } = sun.userData;

  photosphereMaterial.uniforms.time.value = elapsedTime;
  chromosphereMaterial.uniforms.time.value = elapsedTime;
  coronaMaterial.uniforms.time.value = elapsedTime;
  coreMaterial.uniforms.time.value = elapsedTime;
  windMaterial.uniforms.time.value = elapsedTime;  // GPU particles (Fix #12)

  // Fix #8 – no mesh rotation; differential rotation handled in shader

  updateProminences(delta, elapsedTime);
  updateFlares(delta, elapsedTime);
  updateInternalLayers(delta, elapsedTime);

  controls.update();
  starField.rotation.y += delta * 0.002;

  composer.render();
}

animate();

// ── Window resize ──────────────────────────────────────────
function onWindowResize() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height);
  composer.setSize(width, height);
}

window.addEventListener("resize", onWindowResize);
