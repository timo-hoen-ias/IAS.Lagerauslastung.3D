import { useEffect, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';

/**
 * Wärmekamera-Look (White-Hot FLIR) für die Heatmap-Ansicht.
 * Ein Fullscreen-Pass remappt die Helligkeit der Szene in ein monochromes
 * Schwarz-Weiß-Bild mit kräftigem Analog-Rauschen: kalte Flächen bleiben
 * dunkel, die hellen Gaswolken glühen weiß-heiß.
 */
const THERMAL_SHADER = {
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uThreshold: { value: 0.5 },
    uPower: { value: 1.5 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uTime;
    uniform float uThreshold;
    uniform float uPower;
    varying vec2 vUv;

    float hash(vec2 p) {
      return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
    }
    float luma(vec3 c) {
      return dot(c, vec3(0.299, 0.587, 0.114));
    }

    void main() {
      vec3 col = texture2D(tDiffuse, vUv).rgb;
      float lum = luma(col);

      // Kontrastkurve: erst oberhalb der Schwelle wird etwas „heiß“.
      float heat = pow(smoothstep(uThreshold, 1.0, lum), uPower);

      // White-Hot FLIR: schwarz (kalt) → grau → weiß (heiß).
      vec3 outCol = vec3(heat);

      // Kalte Flächen: dunkler, leicht grauer Grundton (Thermalkamera-Hintergrund).
      float cold = smoothstep(uThreshold, uThreshold * 0.4, lum);
      outCol = mix(outCol, vec3(0.08, 0.09, 0.10), cold);

      // Kräftiges zeitbasiertes Rauschen (krieseliges Analog-Bild).
      float n1 = hash(vUv + fract(uTime * 0.7) * 137.0);
      float n2 = hash(vUv * 2.3 + fract(uTime * 0.31) * 53.0);
      outCol += (n1 - 0.5) * 0.26 + (n2 - 0.5) * 0.10;
      outCol += smoothstep(0.55, 1.0, n2) * 0.08;

      // Scanlines.
      outCol *= 0.94 + 0.06 * sin(vUv.y * 420.0);

      // Vignette.
      vec2 q = vUv - 0.5;
      outCol *= clamp(1.0 - dot(q, q) * 1.2, 0.5, 1.0);

      gl_FragColor = vec4(outCol, 1.0);
    }
  `,
};

export default function ThermalCam() {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);

  const composer = useMemo(() => {
    const c = new EffectComposer(gl);
    c.addPass(new RenderPass(scene, camera));
    c.addPass(new ShaderPass(THERMAL_SHADER));
    c.setPixelRatio(gl.getPixelRatio());
    return c;
  }, [gl, scene, camera]);

  useEffect(() => {
    composer.setSize(size.width, size.height);
  }, [composer, size]);

  useFrame((state) => {
    const pass = composer.passes[composer.passes.length - 1] as ShaderPass;
    pass.uniforms.uTime.value = state.clock.elapsedTime;
    composer.render();
  }, 1);

  useEffect(() => () => composer.dispose(), [composer]);

  return null;
}
