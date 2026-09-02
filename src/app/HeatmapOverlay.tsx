import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { platzIndex, platzWorld } from './article';
import { heatColor, heatIntensity, type HeatmapPoint } from './heatmap';
import { getTransform } from './store';
import type { PlacedRack } from './scene/transform';

const VERT = `
attribute float aSize;
attribute float aOpacity;
varying vec3 vColor;
varying float vOpacity;
void main() {
  vColor = color;
  vOpacity = aOpacity;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = min(aSize * (700.0 / -mv.z), 96.0);
  gl_Position = projectionMatrix * mv;
}`;

const FRAG = `
uniform float uTime;
varying vec3 vColor;
varying float vOpacity;

// Kleiner prozeduraler Value-Noise (hash → glattes Rauschen).
float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}
float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
// Fractional Brownian Motion: 4 Oktaven → fluffige Wolkenform.
float fbm(vec2 p) {
  float v = 0.0;
  float amp = 0.5;
  for (int i = 0; i < 4; i++) {
    v += amp * noise(p);
    p *= 2.02;
    amp *= 0.5;
  }
  return v;
}

void main() {
  // Billboardsphäre: r im Einheitskreis, z = Kugeltiefe → volumetrischer Kern.
  vec2 uv = gl_PointCoord * 2.0 - 1.0;
  float r = length(uv);
  if (r > 1.0) discard;
  float z = sqrt(max(0.0, 1.0 - r * r));

  // Zeitabhängige FBM verzerrt die UVs → wabernde, rauchige Silhouette.
  vec2 p = gl_PointCoord * 6.0;
  p += (fbm(p * 1.5 + vec2(uTime * 0.0003, uTime * 0.0002)) - 0.5) * 0.7;
  float cloud = fbm(p + vec2(uTime * 0.00015, -uTime * 0.00012));

  // Weiche Kante, die Wolke bleibt nah am Kern → kein Bleed auf Nachbarzellen.
  float edge = smoothstep(1.0, 0.6, r);
  float density = edge * (0.25 + 0.85 * cloud * z);
  float a = density * vOpacity;
  if (a < 0.03) discard;

  gl_FragColor = vec4(vColor * (0.6 + 0.6 * z), a);
}`;

/**
 * Heatmap als animierte „Gaswolke": ein Points-Pass mit additiver Mischung.
 * Größe und Opazität jedes Punkts skalieren mit der Buchungsintensität,
 * die Farbe läuft Blau → Gelb; das prozedurale FBM wabert zeitabhängig.
 */
export default function HeatmapOverlay({ racks, points }: { racks: PlacedRack[]; points: HeatmapPoint[] }) {
  const index = useMemo(() => platzIndex(racks), [racks]);
  const matRef = useRef<THREE.ShaderMaterial>(null);

  const { geometry, material } = useMemo(() => {
    const hit = points
      .filter((p) => p.n > 0)
      .map((p) => ({ p, hit: index.get(p.platzId) }))
      .filter((x): x is { p: HeatmapPoint; hit: NonNullable<ReturnType<typeof index.get>> } => Boolean(x.hit));
    const max = points.reduce((m, p) => Math.max(m, p.n), 0);

    const pos = new Float32Array(hit.length * 3);
    const col = new Float32Array(hit.length * 3);
    const size = new Float32Array(hit.length);
    const opa = new Float32Array(hit.length);
    const tmp = new THREE.Color();

    for (let i = 0; i < hit.length; i++) {
      const { p, hit: h } = hit[i]!;
      const w = platzWorld(h.rack, getTransform(h.rack.key), h.platz);
      pos[i * 3] = w.x;
      pos[i * 3 + 1] = w.y + w.h + 0.3;
      pos[i * 3 + 2] = w.z;
      const t = heatIntensity(p.n, max);
      tmp.set(heatColor(p.n, max));
      col[i * 3] = tmp.r;
      col[i * 3 + 1] = tmp.g;
      col[i * 3 + 2] = tmp.b;
      size[i] = 0.6 + 5.6 * t;
      opa[i] = 0.3 + 0.7 * t;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
    geo.setAttribute('aOpacity', new THREE.BufferAttribute(opa, 1));

    const mat = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 } },
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    mat.vertexColors = true;
    matRef.current = mat;

    return { geometry: geo, material: mat };
  }, [index, points]);

  useFrame((state) => {
    const u = matRef.current?.uniforms.uTime;
    if (u) u.value = state.clock.elapsedTime * 1000;
  });

  return <points geometry={geometry} material={material} raycast={() => null} frustumCulled={false} />;
}
