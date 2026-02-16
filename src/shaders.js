export const photosphereVertexShader = `
uniform float time;
varying vec3 vWorldPosition;
varying vec3 vNormal;

void main() {
  vNormal = normalize(normalMatrix * normal);
  vec4 worldPosition = modelMatrix * vec4(position, 1.0);
  vWorldPosition = worldPosition.xyz;
  gl_Position = projectionMatrix * viewMatrix * worldPosition;
}
`;

export const photosphereFragmentShader = `
precision highp float;

uniform float time;
uniform vec3 colorHot;
uniform vec3 colorCool;
uniform float brightness;

varying vec3 vWorldPosition;
varying vec3 vNormal;

float hash(vec3 p) {
  p = vec3(dot(p, vec3(127.1, 311.7, 74.7)),
           dot(p, vec3(269.5, 183.3, 246.1)),
           dot(p, vec3(113.5, 271.9, 124.6)));
  return fract(sin(p.x + p.y + p.z) * 43758.5453123);
}

float noise(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);

  float n000 = hash(i + vec3(0.0, 0.0, 0.0));
  float n100 = hash(i + vec3(1.0, 0.0, 0.0));
  float n010 = hash(i + vec3(0.0, 1.0, 0.0));
  float n110 = hash(i + vec3(1.0, 1.0, 0.0));
  float n001 = hash(i + vec3(0.0, 0.0, 1.0));
  float n101 = hash(i + vec3(1.0, 0.0, 1.0));
  float n011 = hash(i + vec3(0.0, 1.0, 1.0));
  float n111 = hash(i + vec3(1.0, 1.0, 1.0));

  float nx00 = mix(n000, n100, f.x);
  float nx10 = mix(n010, n110, f.x);
  float nx01 = mix(n001, n101, f.x);
  float nx11 = mix(n011, n111, f.x);

  float nxy0 = mix(nx00, nx10, f.y);
  float nxy1 = mix(nx01, nx11, f.y);

  return mix(nxy0, nxy1, f.z);
}

float fbm(vec3 p) {
  float v = 0.0;
  float a = 0.5;
  vec3 shift = vec3(100.0);
  for (int i = 0; i < 5; i++) {
    v += a * noise(p);
    p = p * 2.0 + shift;
    a *= 0.5;
  }
  return v;
}

void main() {
  vec3 n = normalize(vWorldPosition);
  float lat = abs(n.y);

  float t = time * 0.03;
  float baseNoise = fbm(n * 8.0 + vec3(t, 0.0, -t));
  float fineNoise = fbm(n * 32.0 + vec3(-t * 2.0, t, 0.0));

  float granulation = baseNoise * 0.7 + fineNoise * 0.3;

  float sunspotMask = smoothstep(0.3, 0.7, fineNoise);
  float sunspot = smoothstep(0.7, 0.95, sunspotMask);

  float limb = clamp(dot(n, normalize(-vWorldPosition)), 0.0, 1.0);
  float limbDarkening = pow(limb, 0.7);

  float differential = mix(1.1, 0.9, lat);
  float rotationMod = sin((n.y * 8.0 + t * differential) * 3.14159);

  float intensity = granulation * 0.7 + rotationMod * 0.3;
  intensity = clamp(intensity, 0.0, 1.0);

  vec3 baseColor = mix(colorCool, colorHot, intensity);

  float sunspotFactor = 1.0 - sunspot * 0.7;
  baseColor *= sunspotFactor;

  baseColor *= limbDarkening * 1.4;

  gl_FragColor = vec4(baseColor * brightness, 1.0);
}
`;

export const chromosphereVertexShader = `
uniform float time;
varying vec3 vWorldPosition;
varying vec3 vNormal;

void main() {
  vNormal = normalize(normalMatrix * normal);
  vec4 worldPosition = modelMatrix * vec4(position, 1.0);
  vWorldPosition = worldPosition.xyz;
  gl_Position = projectionMatrix * viewMatrix * worldPosition;
}
`;

export const chromosphereFragmentShader = `
precision highp float;

uniform float time;
uniform vec3 colorInner;
uniform vec3 colorOuter;

varying vec3 vWorldPosition;
varying vec3 vNormal;

void main() {
  vec3 n = normalize(vWorldPosition);
  float height = length(vWorldPosition);
  float rim = pow(1.0 - abs(dot(normalize(-vWorldPosition), vNormal)), 2.0);

  float wave = sin((n.y + time * 0.2) * 20.0) * 0.5 + 0.5;
  float intensity = rim * 1.5 + wave * 0.3;

  float fade = smoothstep(1.0, 1.2, height);
  intensity *= fade;

  vec3 color = mix(colorOuter, colorInner, intensity);

  gl_FragColor = vec4(color * 3.0, intensity * 0.7);
}
`;

export const coronaVertexShader = `
uniform float time;
varying vec3 vWorldPosition;
varying vec3 vNormal;

void main() {
  vNormal = normalize(normalMatrix * normal);
  vec4 worldPosition = modelMatrix * vec4(position, 1.0);
  vWorldPosition = worldPosition.xyz;
  gl_Position = projectionMatrix * viewMatrix * worldPosition;
}
`;

export const coronaFragmentShader = `
precision highp float;

uniform float time;
uniform vec3 colorInner;
uniform vec3 colorOuter;

varying vec3 vWorldPosition;
varying vec3 vNormal;

float hash(vec3 p) {
  p = vec3(dot(p, vec3(127.1, 311.7, 74.7)),
           dot(p, vec3(269.5, 183.3, 246.1)),
           dot(p, vec3(113.5, 271.9, 124.6)));
  return fract(sin(p.x + p.y + p.z) * 43758.5453123);
}

float noise(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);

  float n000 = hash(i + vec3(0.0, 0.0, 0.0));
  float n100 = hash(i + vec3(1.0, 0.0, 0.0));
  float n010 = hash(i + vec3(0.0, 1.0, 0.0));
  float n110 = hash(i + vec3(1.0, 1.0, 0.0));
  float n001 = hash(i + vec3(0.0, 0.0, 1.0));
  float n101 = hash(i + vec3(1.0, 0.0, 1.0));
  float n011 = hash(i + vec3(0.0, 1.0, 1.0));
  float n111 = hash(i + vec3(1.0, 1.0, 1.0));

  float nx00 = mix(n000, n100, f.x);
  float nx10 = mix(n010, n110, f.x);
  float nx01 = mix(n001, n101, f.x);
  float nx11 = mix(n011, n111, f.x);

  float nxy0 = mix(nx00, nx10, f.y);
  float nxy1 = mix(nx01, nx11, f.y);

  return mix(nxy0, nxy1, f.z);
}

void main() {
  vec3 dir = normalize(vWorldPosition);
  float r = length(vWorldPosition);

  float shell = smoothstep(1.1, 1.8, r) * (1.0 - smoothstep(1.8, 3.0, r));

  float t = time * 0.05;
  float streamNoise = noise(dir * 6.0 + vec3(t, -t, t * 0.5));
  float radialNoise = noise(dir * 20.0 + vec3(-t * 2.0, t * 1.7, -t));

  float stream = streamNoise * 0.6 + radialNoise * 0.4;
  stream = pow(stream, 2.0);

  float intensity = shell * (0.4 + 1.6 * stream);

  float edge = 1.0 - smoothstep(1.3, 3.0, r);
  intensity *= edge;

  vec3 color = mix(colorOuter, colorInner, intensity);

  gl_FragColor = vec4(color * 2.0, intensity * 0.9);
}
`;

export const coreVertexShader = `
uniform float time;
varying vec3 vWorldPosition;

void main() {
  vec4 worldPosition = modelMatrix * vec4(position, 1.0);
  vWorldPosition = worldPosition.xyz;
  gl_Position = projectionMatrix * viewMatrix * worldPosition;
}
`;

export const coreFragmentShader = `
precision highp float;

uniform float time;
uniform vec3 colorCore;

varying vec3 vWorldPosition;

float hash(vec3 p) {
  p = vec3(dot(p, vec3(127.1, 311.7, 74.7)),
           dot(p, vec3(269.5, 183.3, 246.1)),
           dot(p, vec3(113.5, 271.9, 124.6)));
  return fract(sin(p.x + p.y + p.z) * 43758.5453123);
}

float noise(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);

  float n000 = hash(i + vec3(0.0, 0.0, 0.0));
  float n100 = hash(i + vec3(1.0, 0.0, 0.0));
  float n010 = hash(i + vec3(0.0, 1.0, 0.0));
  float n110 = hash(i + vec3(1.0, 1.0, 0.0));
  float n001 = hash(i + vec3(0.0, 0.0, 1.0));
  float n101 = hash(i + vec3(1.0, 0.0, 1.0));
  float n011 = hash(i + vec3(0.0, 1.0, 1.0));
  float n111 = hash(i + vec3(1.0, 1.0, 1.0));

  float nx00 = mix(n000, n100, f.x);
  float nx10 = mix(n010, n110, f.x);
  float nx01 = mix(n001, n101, f.x);
  float nx11 = mix(n011, n111, f.x);

  float nxy0 = mix(nx00, nx10, f.y);
  float nxy1 = mix(nx01, nx11, f.y);

  return mix(nxy0, nxy1, f.z);
}

void main() {
  float r = length(vWorldPosition);
  float t = time * 0.5;
  float turbulence = noise(vWorldPosition * 40.0 + vec3(t, -t, t * 0.3));
  float intensity = 1.0 - smoothstep(0.0, 0.25, r);
  intensity += turbulence * 0.4;
  intensity = clamp(intensity, 0.0, 1.5);

  vec3 color = colorCore * intensity * 4.0;

  gl_FragColor = vec4(color, 1.0);
}
`;

