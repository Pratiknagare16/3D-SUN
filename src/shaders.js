// ============================================================
// Photosphere shaders – Voronoi granulation, differential rotation,
// physically-correct limb darkening
// ============================================================
export const photosphereVertexShader = `
uniform float time;
uniform float rotationSpeed;   // base angular speed (rad/s at equator)

varying vec3 vWorldPosition;
varying vec3 vNormal;
varying vec3 vLocalPos;

void main() {
  vNormal = normalize(normalMatrix * normal);

  // --- Differential rotation in shader (Fix #8) ---
  // Sidereal rotation: equator ~25.05 days, pole ~34.3 days
  // Snodgrass & Ulrich coefficients (deg/day → we just use the ratio)
  float sinLat  = normal.y;   // latitude proxy (object-space Y)
  float sin2Lat = sinLat * sinLat;
  // Relative angular velocity  A + B*sin^2 + C*sin^4
  float relOmega = 1.0 - 0.1900 * sin2Lat - 0.2250 * sin2Lat * sin2Lat;
  float angle = time * rotationSpeed * relOmega;

  // Y-axis rotation matrix
  float ca = cos(angle);
  float sa = sin(angle);
  vec3 rotatedPos = vec3(
    position.x * ca + position.z * sa,
    position.y,
   -position.x * sa + position.z * ca
  );

  vLocalPos = rotatedPos;
  vec4 worldPosition = modelMatrix * vec4(rotatedPos, 1.0);
  vWorldPosition = worldPosition.xyz;
  gl_Position = projectionMatrix * viewMatrix * worldPosition;
}
`;

export const photosphereFragmentShader = `
precision highp float;

uniform float time;
uniform vec3  colorHot;
uniform vec3  colorCool;
uniform float brightness;

varying vec3 vWorldPosition;
varying vec3 vNormal;
varying vec3 vLocalPos;

// -------- Voronoi noise (Fix #9) --------
vec3 hash3(vec3 p) {
  p = vec3(
    dot(p, vec3(127.1, 311.7, 74.7)),
    dot(p, vec3(269.5, 183.3, 246.1)),
    dot(p, vec3(113.5, 271.9, 124.6))
  );
  return fract(sin(p) * 43758.5453123);
}

// Returns vec2( F1 distance, F2 distance )
vec2 voronoi(vec3 x) {
  vec3 p = floor(x);
  vec3 f = fract(x);

  float d1 = 8.0;
  float d2 = 8.0;

  for (int k = -1; k <= 1; k++)
  for (int j = -1; j <= 1; j++)
  for (int i = -1; i <= 1; i++) {
    vec3 g = vec3(float(i), float(j), float(k));
    vec3 o = hash3(p + g);
    // animate cell centres slowly
    o = 0.5 + 0.5 * sin(time * 0.04 + 6.2831 * o);
    vec3 diff = g + o - f;
    float d = dot(diff, diff);
    if (d < d1) {
      d2 = d1;
      d1 = d;
    } else if (d < d2) {
      d2 = d;
    }
  }
  return vec2(sqrt(d1), sqrt(d2));
}

// Utility value noise (kept for sunspots / fine detail)
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

  float n000 = hash(i);
  float n100 = hash(i + vec3(1,0,0));
  float n010 = hash(i + vec3(0,1,0));
  float n110 = hash(i + vec3(1,1,0));
  float n001 = hash(i + vec3(0,0,1));
  float n101 = hash(i + vec3(1,0,1));
  float n011 = hash(i + vec3(0,1,1));
  float n111 = hash(i + vec3(1,1,1));

  float nx00 = mix(n000, n100, f.x);
  float nx10 = mix(n010, n110, f.x);
  float nx01 = mix(n001, n101, f.x);
  float nx11 = mix(n011, n111, f.x);

  float nxy0 = mix(nx00, nx10, f.y);
  float nxy1 = mix(nx01, nx11, f.y);

  return mix(nxy0, nxy1, f.z);
}

void main() {
  vec3 n = normalize(vLocalPos);

  // Voronoi granulation
  vec2 vor = voronoi(n * 12.0);
  float cellEdge = vor.y - vor.x;                 // bright at cell edges
  float granulation = smoothstep(0.0, 0.35, cellEdge);

  // Fine turbulence overlay
  float fine = noise(n * 40.0 + vec3(time * 0.02));
  granulation = granulation * 0.8 + fine * 0.2;

  // Sunspots
  float spotNoise = noise(n * 20.0 + vec3(-time * 0.01));
  float sunspot = smoothstep(0.72, 0.93, spotNoise);

  // ---- Limb darkening (Fix #10) – Neckel & Labs polynomial ----
  // mu = cos(theta) where theta = angle from centre to limb
  vec3 viewDir = normalize(-vWorldPosition);
  float mu = clamp(dot(normalize(vNormal), viewDir), 0.0, 1.0);
  // I(mu)/I(1) = 1 - u(1-mu) - v(1-mu^2)   u=0.93, v=-0.23
  float limbDarkening = 1.0 - 0.93 * (1.0 - mu) + 0.23 * (1.0 - mu * mu);
  limbDarkening = clamp(limbDarkening, 0.0, 1.0);

  // Combine
  float intensity = clamp(granulation, 0.0, 1.0);
  vec3 baseColor = mix(colorCool, colorHot, intensity);
  baseColor *= (1.0 - sunspot * 0.7);
  baseColor *= limbDarkening;

  gl_FragColor = vec4(baseColor * brightness, 1.0);
}
`;

// ============================================================
// Chromosphere shaders
// ============================================================
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
  float rim = pow(1.0 - abs(dot(normalize(-vWorldPosition), vNormal)), 2.0);

  float wave = sin((n.y + time * 0.2) * 20.0) * 0.5 + 0.5;
  float intensity = rim * 1.5 + wave * 0.3;

  float height = length(vWorldPosition);
  float fade = smoothstep(1.0, 1.2, height);
  intensity *= fade;

  vec3 color = mix(colorOuter, colorInner, intensity);

  gl_FragColor = vec4(color * 3.0, intensity * 0.7);
}
`;

// ============================================================
// Corona shaders – volumetric raymarching (Fix #11)
// ============================================================
export const coronaVertexShader = `
uniform float time;
varying vec3 vWorldPosition;
varying vec3 vNormal;
varying vec3 vViewDir;

void main() {
  vNormal = normalize(normalMatrix * normal);
  vec4 worldPosition = modelMatrix * vec4(position, 1.0);
  vWorldPosition = worldPosition.xyz;
  vViewDir = normalize(cameraPosition - worldPosition.xyz);
  gl_Position = projectionMatrix * viewMatrix * worldPosition;
}
`;

export const coronaFragmentShader = `
precision highp float;

uniform float time;
uniform vec3  colorInner;
uniform vec3  colorOuter;

varying vec3 vWorldPosition;
varying vec3 vNormal;
varying vec3 vViewDir;

// Simple 3D noise for streamer variation
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

  float n000 = hash(i);                    float n100 = hash(i + vec3(1,0,0));
  float n010 = hash(i + vec3(0,1,0));      float n110 = hash(i + vec3(1,1,0));
  float n001 = hash(i + vec3(0,0,1));      float n101 = hash(i + vec3(1,0,1));
  float n011 = hash(i + vec3(0,1,1));      float n111 = hash(i + vec3(1,1,1));

  float nx00 = mix(n000, n100, f.x);  float nx10 = mix(n010, n110, f.x);
  float nx01 = mix(n001, n101, f.x);  float nx11 = mix(n011, n111, f.x);
  float nxy0 = mix(nx00, nx10, f.y);  float nxy1 = mix(nx01, nx11, f.y);
  return mix(nxy0, nxy1, f.z);
}

// Density function for the corona volume
float coronaDensity(vec3 p, float t) {
  float r = length(p);
  if (r < 1.05 || r > 3.2) return 0.0;

  vec3 dir = normalize(p);

  // Radial density falloff (approx 1/r^2)
  float radial = 1.0 / (r * r);

  // Streamer noise
  float streamNoise = noise(dir * 5.0 + vec3(t, -t, t * 0.5));
  float radialNoise = noise(dir * 14.0 + vec3(-t * 1.5, t * 1.2, -t));
  float stream = streamNoise * 0.55 + radialNoise * 0.45;
  stream = pow(stream, 1.8);

  // Polar brightening (streamers are more polar)
  float polar = 0.6 + 0.4 * abs(dir.y);

  return radial * (0.3 + 1.7 * stream) * polar;
}

void main() {
  // --- Raymarching through the corona shell (Fix #11) ---
  vec3 rayOrigin = vWorldPosition;
  vec3 rayDir    = -vViewDir;
  float t = time * 0.05;

  float stepSize = 0.25;
  int   steps    = 8;

  vec3  accumColor = vec3(0.0);
  float accumAlpha = 0.0;

  for (int i = 0; i < 8; i++) {
    vec3 samplePos = rayOrigin + rayDir * (float(i) * stepSize);
    float density = coronaDensity(samplePos, t);

    float r = length(samplePos);
    float frac = clamp((r - 1.1) / 2.0, 0.0, 1.0);
    vec3 sampleColor = mix(colorInner, colorOuter, frac) * 2.0;

    // Front-to-back compositing
    float sampleAlpha = density * stepSize * 2.5;
    sampleAlpha = clamp(sampleAlpha, 0.0, 1.0);

    accumColor += sampleColor * sampleAlpha * (1.0 - accumAlpha);
    accumAlpha += sampleAlpha * (1.0 - accumAlpha);

    if (accumAlpha > 0.95) break;
  }

  gl_FragColor = vec4(accumColor, accumAlpha * 0.85);
}
`;

// ============================================================
// Core shader (Fix #14 – reduced octaves)
// ============================================================
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
uniform vec3  colorCore;

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

  float n000 = hash(i);                    float n100 = hash(i + vec3(1,0,0));
  float n010 = hash(i + vec3(0,1,0));      float n110 = hash(i + vec3(1,1,0));
  float n001 = hash(i + vec3(0,0,1));      float n101 = hash(i + vec3(1,0,1));
  float n011 = hash(i + vec3(0,1,1));      float n111 = hash(i + vec3(1,1,1));

  float nx00 = mix(n000, n100, f.x);  float nx10 = mix(n010, n110, f.x);
  float nx01 = mix(n001, n101, f.x);  float nx11 = mix(n011, n111, f.x);
  float nxy0 = mix(nx00, nx10, f.y);  float nxy1 = mix(nx01, nx11, f.y);
  return mix(nxy0, nxy1, f.z);
}

void main() {
  float r = length(vWorldPosition);
  float t = time * 0.5;

  // 3 octaves instead of 5 (Fix #14)
  float turb = noise(vWorldPosition * 40.0 + vec3(t, -t, t * 0.3));
  turb += 0.5 * noise(vWorldPosition * 80.0 + vec3(-t, t * 0.7, t));
  turb += 0.25 * noise(vWorldPosition * 160.0 + vec3(t * 0.5, -t * 1.3, t * 0.8));
  turb /= 1.75;

  float intensity = 1.0 - smoothstep(0.0, 0.25, r);
  intensity += turb * 0.4;
  intensity = clamp(intensity, 0.0, 1.5);

  vec3 color = colorCore * intensity * 4.0;
  gl_FragColor = vec4(color, 1.0);
}
`;

// ============================================================
// Starfield custom shader (Fix #6)
// ============================================================
export const starVertexShader = `
attribute float starBrightness;
varying float vBrightness;

void main() {
  vBrightness = starBrightness;
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  // Size independent of distance – constant apparent magnitude
  gl_PointSize = mix(1.0, 3.5, starBrightness);
  gl_Position = projectionMatrix * mvPosition;
}
`;

export const starFragmentShader = `
precision highp float;
varying float vBrightness;

void main() {
  // Soft circular point
  vec2 uv = gl_PointCoord - vec2(0.5);
  float d = length(uv);
  if (d > 0.5) discard;

  float alpha = smoothstep(0.5, 0.1, d);
  // Warm-to-blue tint based on brightness
  vec3 color = mix(vec3(1.0, 0.9, 0.7), vec3(0.8, 0.9, 1.0), vBrightness);

  gl_FragColor = vec4(color * (0.4 + 0.6 * vBrightness), alpha * (0.5 + 0.5 * vBrightness));
}
`;

// ============================================================
// Solar wind GPU particle shader (Fix #12, #15)
// ============================================================
export const solarWindVertexShader = `
uniform float time;
uniform float sunRadius;

attribute vec3 seed;       // random direction + speed encoded per particle

varying float vAlpha;

// pseudo-random from seed
float rand(float n) {
  return fract(sin(n) * 43758.5453123);
}

void main() {
  // Decode seed: seed.xyz = unit direction on sphere
  vec3 dir = normalize(seed);

  // Per-particle timing: birth offset so particles are spread in time
  float birthOffset = rand(dot(seed, vec3(12.9898, 78.233, 45.164))) * 8.0;
  float speed = 0.08 + rand(dot(seed, vec3(93.989, 67.345, 11.877))) * 0.18;

  // Lifecycle: particle travels from surface to 6x radius then respawns
  float maxDist = sunRadius * 5.0;
  float travelTime = maxDist / (speed * 60.0);
  float cycleT = mod(time + birthOffset, travelTime) / travelTime;   // 0..1

  float r = sunRadius * 1.05 + cycleT * maxDist;
  vec3 pos = dir * r;

  vAlpha = 1.0 - cycleT;  // fade as it travels outward
  vAlpha *= smoothstep(0.0, 0.05, cycleT);  // quick fade-in

  vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
  gl_PointSize = max(1.0, 2.5 * (1.0 - cycleT));
  gl_Position = projectionMatrix * mvPosition;
}
`;

export const solarWindFragmentShader = `
precision highp float;
varying float vAlpha;

void main() {
  vec2 uv = gl_PointCoord - vec2(0.5);
  float d = length(uv);
  if (d > 0.5) discard;

  float softEdge = smoothstep(0.5, 0.15, d);
  gl_FragColor = vec4(0.8, 0.9, 1.0, softEdge * vAlpha * 0.6);
}
`;
