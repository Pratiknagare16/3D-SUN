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
} from "./shaders.js";

const container = document.getElementById("app");

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputEncoding = THREE.sRGBEncoding;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.5;
container.appendChild(renderer.domElement);

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

const composer = new EffectComposer(renderer);
const renderPass = new RenderPass(scene, camera);
composer.addPass(renderPass);

const bloomPass = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  1.8,
  0.4,
  0.0
);
composer.addPass(bloomPass);

const starField = new THREE.Group();
const starGeometry = new THREE.BufferGeometry();
const starCount = 3000;
const starPositions = new Float32Array(starCount * 3);

for (let i = 0; i < starCount; i++) {
  const r = 200;
  const u = Math.random();
  const v = Math.random();
  const theta = 2 * Math.PI * u;
  const phi = Math.acos(2 * v - 1);
  const x = r * Math.sin(phi) * Math.cos(theta);
  const y = r * Math.sin(phi) * Math.sin(theta);
  const z = r * Math.cos(phi);
  starPositions[i * 3 + 0] = x;
  starPositions[i * 3 + 1] = y;
  starPositions[i * 3 + 2] = z;
}

starGeometry.setAttribute(
  "position",
  new THREE.BufferAttribute(starPositions, 3)
);

const starMaterial = new THREE.PointsMaterial({
  color: 0xffffff,
  size: 0.7,
  sizeAttenuation: true,
  transparent: true,
  opacity: 0.8,
});

const stars = new THREE.Points(starGeometry, starMaterial);
starField.add(stars);
scene.add(starField);

const SUN_RADIUS = 5;

function createSun() {
  const group = new THREE.Group();

  const photosphereGeometry = new THREE.SphereGeometry(SUN_RADIUS, 128, 128);

  const photosphereMaterial = new THREE.ShaderMaterial({
    vertexShader: photosphereVertexShader,
    fragmentShader: photosphereFragmentShader,
    uniforms: {
      time: { value: 0 },
      colorHot: { value: new THREE.Color(1.0, 0.86, 0.4) },
      colorCool: { value: new THREE.Color(0.9, 0.4, 0.05) },
      brightness: { value: 2.2 },
    },
    transparent: false,
  });

  const photosphere = new THREE.Mesh(photosphereGeometry, photosphereMaterial);
  photosphere.name = "photosphere";
  group.add(photosphere);

  const chromosphereGeometry = new THREE.SphereGeometry(
    SUN_RADIUS * 1.03,
    96,
    96
  );

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
  });

  const chromosphere = new THREE.Mesh(
    chromosphereGeometry,
    chromosphereMaterial
  );
  chromosphere.name = "chromosphere";
  group.add(chromosphere);

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
  });

  const corona = new THREE.Mesh(coronaGeometry, coronaMaterial);
  corona.name = "corona";
  group.add(corona);

  const prominenceGroup = new THREE.Group();
  prominenceGroup.name = "prominences";

  const prominenceMaterial = new THREE.MeshBasicMaterial({
    color: new THREE.Color(1.0, 0.55, 0.2),
    transparent: true,
    opacity: 0.7,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });

  const prominenceCount = 12;
  for (let i = 0; i < prominenceCount; i++) {
    const arcRadius = SUN_RADIUS * (1.05 + Math.random() * 0.2);
    const tubeRadius = SUN_RADIUS * 0.015;

    const arcLength = Math.PI * (0.3 + Math.random() * 0.3);
    const torusGeometry = new THREE.TorusGeometry(
      arcRadius,
      tubeRadius,
      24,
      64,
      arcLength
    );

    const torus = new THREE.Mesh(torusGeometry, prominenceMaterial.clone());

    const lat = THREE.MathUtils.degToRad(THREE.MathUtils.randFloatSpread(50));
    const lon = THREE.MathUtils.degToRad(Math.random() * 360);

    const dir = new THREE.Vector3(
      Math.cos(lat) * Math.cos(lon),
      Math.sin(lat),
      Math.cos(lat) * Math.sin(lon)
    ).normalize();

    const centerRadius = SUN_RADIUS * 1.02;
    torus.position.copy(dir.multiplyScalar(centerRadius));

    torus.lookAt(torus.position.clone().multiplyScalar(1.1));
    torus.rotateX(Math.PI * 0.5);

    const scale = 0.7 + Math.random() * 0.3;
    torus.scale.set(scale, scale, scale);

    torus.userData = {
      baseOpacity: torus.material.opacity,
      phaseOffset: Math.random() * Math.PI * 2,
    };

    prominenceGroup.add(torus);
  }

  group.add(prominenceGroup);

  const flareGroup = new THREE.Group();
  flareGroup.name = "flares";

  const flareCount = 5;
  for (let i = 0; i < flareCount; i++) {
    const flareGeometry = new THREE.SphereGeometry(SUN_RADIUS * 0.18, 32, 32);
    const flareMaterial = new THREE.MeshBasicMaterial({
      color: new THREE.Color(1.0, 0.9, 0.6),
      transparent: true,
      opacity: 0.0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const flare = new THREE.Mesh(flareGeometry, flareMaterial);
    flare.visible = false;
    flare.userData = {
      active: false,
      startTime: 0,
      duration: 0.8 + Math.random() * 0.6,
      cooldown: Math.random() * 5.0,
      nextTrigger: Math.random() * 8.0,
    };
    flareGroup.add(flare);
  }

  group.add(flareGroup);

  const windCount = 6000;
  const windGeometry = new THREE.BufferGeometry();
  const windPositions = new Float32Array(windCount * 3);
  const windVelocities = new Float32Array(windCount * 3);

  function resetWindParticle(i) {
    const u = Math.random();
    const v = Math.random();
    const theta = 2 * Math.PI * u;
    const phi = Math.acos(2 * v - 1);
    const x = Math.sin(phi) * Math.cos(theta);
    const y = Math.sin(phi) * Math.sin(theta);
    const z = Math.cos(phi);
    const r = SUN_RADIUS * (1.05 + Math.random() * 0.05);
    windPositions[i * 3 + 0] = x * r;
    windPositions[i * 3 + 1] = y * r;
    windPositions[i * 3 + 2] = z * r;
    const speed = 0.08 + Math.random() * 0.18;
    windVelocities[i * 3 + 0] = x * speed;
    windVelocities[i * 3 + 1] = y * speed;
    windVelocities[i * 3 + 2] = z * speed;
  }

  for (let i = 0; i < windCount; i++) {
    resetWindParticle(i);
  }

  windGeometry.setAttribute(
    "position",
    new THREE.BufferAttribute(windPositions, 3)
  );

  const windMaterial = new THREE.PointsMaterial({
    color: new THREE.Color(0.8, 0.9, 1.0),
    size: 0.04,
    transparent: true,
    opacity: 0.6,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });

  const solarWind = new THREE.Points(windGeometry, windMaterial);
  solarWind.name = "solarWind";
  solarWind.userData = {
    velocities: windVelocities,
  };

  group.add(solarWind);

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

  group.userData = {
    photosphereMaterial,
    chromosphereMaterial,
    coronaMaterial,
    coreMaterial,
    coreGroup,
    flares: flareGroup.children,
    prominences: prominenceGroup.children,
    solarWind,
    differentialRotationFactor: 0.04,
  };

  return group;
}

const sun = createSun();
scene.add(sun);

const tempScale = SUN_RADIUS / 696340000.0;

const ambientLight = new THREE.AmbientLight(0xffffff, 0.02);
scene.add(ambientLight);

const sunLight = new THREE.PointLight(0xffffff, 3.0, 0, 2);
sunLight.position.set(0, 0, 0);
scene.add(sunLight);

let isCutaway = false;
let flaresEnabled = true;

function setCutaway(enabled) {
  isCutaway = enabled;
  const photosphere = sun.getObjectByName("photosphere");
  const chromosphere = sun.getObjectByName("chromosphere");
  const corona = sun.getObjectByName("corona");
  const internal = sun.getObjectByName("internalLayers");

  if (!photosphere || !chromosphere || !corona || !internal) {
    return;
  }

  photosphere.material.transparent = enabled;
  chromosphere.material.transparent = true;
  corona.material.transparent = true;

  photosphere.material.opacity = enabled ? 0.35 : 1.0;
  chromosphere.material.opacity = enabled ? 0.25 : 1.0;
  corona.material.opacity = enabled ? 0.4 : 1.0;

  internal.visible = enabled;
}

window.addEventListener("keydown", (event) => {
  if (event.key === "c" || event.key === "C") {
    setCutaway(!isCutaway);
  }
  if (event.key === "f" || event.key === "F") {
    flaresEnabled = !flaresEnabled;
  }
});

function updateSolarWind(delta, elapsedTime) {
  const solarWind = sun.userData.solarWind;
  const positions = solarWind.geometry.attributes.position.array;
  const velocities = solarWind.userData.velocities;
  const count = positions.length / 3;

  for (let i = 0; i < count; i++) {
    const idx = i * 3;
    positions[idx + 0] += velocities[idx + 0] * delta * 60;
    positions[idx + 1] += velocities[idx + 1] * delta * 60;
    positions[idx + 2] += velocities[idx + 2] * delta * 60;

    const x = positions[idx + 0];
    const y = positions[idx + 1];
    const z = positions[idx + 2];
    const r = Math.sqrt(x * x + y * y + z * z);

    if (r > SUN_RADIUS * 6.0) {
      const u = Math.random();
      const v = Math.random();
      const theta = 2 * Math.PI * u;
      const phi = Math.acos(2 * v - 1);
      const dx = Math.sin(phi) * Math.cos(theta);
      const dy = Math.sin(phi) * Math.sin(theta);
      const dz = Math.cos(phi);
      const radius = SUN_RADIUS * (1.05 + Math.random() * 0.05);
      positions[idx + 0] = dx * radius;
      positions[idx + 1] = dy * radius;
      positions[idx + 2] = dz * radius;
      const speed = 0.08 + Math.random() * 0.18;
      velocities[idx + 0] = dx * speed;
      velocities[idx + 1] = dy * speed;
      velocities[idx + 2] = dz * speed;
    }
  }

  solarWind.geometry.attributes.position.needsUpdate = true;
}

function updateProminences(delta, elapsedTime) {
  const prominences = sun.userData.prominences;
  for (let i = 0; i < prominences.length; i++) {
    const torus = prominences[i];
    const data = torus.userData;
    const t = elapsedTime * 0.4 + data.phaseOffset;
    const scaleMod = 0.9 + Math.sin(t * 2.0) * 0.1;
    torus.scale.setScalar(scaleMod);
    torus.material.opacity =
      data.baseOpacity * (0.7 + 0.3 * Math.sin(t * 1.5 + i));
  }
}

function updateFlares(delta, elapsedTime) {
  const flares = sun.userData.flares;
  if (!flaresEnabled) {
    for (let i = 0; i < flares.length; i++) {
      const flare = flares[i];
      flare.visible = false;
      flare.material.opacity = 0.0;
    }
    return;
  }

  for (let i = 0; i < flares.length; i++) {
    const flare = flares[i];
    const data = flare.userData;

    if (!data.active) {
      data.nextTrigger -= delta;
      if (data.nextTrigger <= 0) {
        data.active = true;
        data.startTime = elapsedTime;
        data.duration = 0.7 + Math.random() * 0.7;
        data.nextTrigger = 4.0 + Math.random() * 8.0;

        const u = Math.random();
        const v = Math.random();
        const theta = 2 * Math.PI * u;
        const phi = Math.acos(2 * v - 1);
        const x = Math.sin(phi) * Math.cos(theta);
        const y = Math.sin(phi) * Math.sin(theta);
        const z = Math.cos(phi);
        const r = SUN_RADIUS * (1.02 + Math.random() * 0.05);
        flare.position.set(x * r, y * r, z * r);
      }
    }

    if (data.active) {
      flare.visible = true;
      const t = (elapsedTime - data.startTime) / data.duration;
      if (t >= 1.0) {
        data.active = false;
        flare.visible = false;
        flare.material.opacity = 0.0;
      } else {
        const intensity = Math.sin(Math.PI * t);
        flare.material.opacity = intensity * 0.9;
        const s = 0.8 + intensity * 1.5;
        flare.scale.setScalar(s);
      }
    }
  }
}

function updateInternalLayers(delta, elapsedTime) {
  const internal = sun.userData.coreGroup;
  if (!internal.visible) {
    return;
  }
  const convectiveZone = internal.getObjectByName("convectiveZone");
  if (convectiveZone) {
    convectiveZone.rotation.y += delta * 0.15;
  }
}

let previousTime = performance.now() / 1000;

function animate() {
  requestAnimationFrame(animate);

  const currentTime = performance.now() / 1000;
  const delta = currentTime - previousTime;
  previousTime = currentTime;

  const elapsedTime = currentTime;

  const photosphereMaterial = sun.userData.photosphereMaterial;
  const chromosphereMaterial = sun.userData.chromosphereMaterial;
  const coronaMaterial = sun.userData.coronaMaterial;
  const coreMaterial = sun.userData.coreMaterial;

  photosphereMaterial.uniforms.time.value = elapsedTime;
  chromosphereMaterial.uniforms.time.value = elapsedTime;
  coronaMaterial.uniforms.time.value = elapsedTime;
  coreMaterial.uniforms.time.value = elapsedTime;

  sun.rotation.y += delta * sun.userData.differentialRotationFactor;

  updateSolarWind(delta, elapsedTime);
  updateProminences(delta, elapsedTime);
  updateFlares(delta, elapsedTime);
  updateInternalLayers(delta, elapsedTime);

  controls.update();

  starField.rotation.y += delta * 0.002;

  composer.render();
}

animate();

function onWindowResize() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height);
  composer.setSize(width, height);
}

window.addEventListener("resize", onWindowResize);
