import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { FilmPass } from 'three/addons/postprocessing/FilmPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { live } from '../mood';

const GodrayShader = {
  name: 'VaelorneGodray',
  uniforms: {
    tDiffuse: { value: null },
    uSun: { value: new THREE.Vector2(0.5, 0.7) },
    uStrength: { value: 0.28 },
    uTime: live.time,
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    precision highp float;
    uniform sampler2D tDiffuse;
    uniform vec2 uSun;
    uniform float uStrength;
    uniform float uTime;
    varying vec2 vUv;
    void main() {
      vec3 base = texture2D(tDiffuse, vUv).rgb;
      vec3 col = base;
      if (uStrength > 0.001) {
        vec2 delta = (uSun - vUv) / 18.0;
        vec2 coord = vUv;
        float illum = 0.4;
        vec3 rays = vec3(0.0);
        for (int i = 0; i < 18; i++) {
          coord += delta;
          vec3 s = texture2D(tDiffuse, coord).rgb;
          float bright = max(max(s.r, s.g), s.b) - 0.82;
          bright = max(bright, 0.0);
          rays += s * bright * illum;
          illum *= 0.94;
        }
        float lum = max(base.r, max(base.g, base.b));
        float mask = smoothstep(0.45, 1.15, lum);
        col += rays * uStrength * mask;
      }
      vec2 p = (vUv - 0.5) * vec2(1.2, 1.05);
      float vig = smoothstep(1.08, 0.28, length(p));
      col *= mix(0.58, 1.0, vig);
      float grain = fract(sin(dot(vUv * (uTime + 3.0), vec2(12.9898, 78.233))) * 43758.5453);
      col += (grain - 0.5) * 0.028;
      gl_FragColor = vec4(col, 1.0);
    }
  `,
};

export type Grade = {
  composer: EffectComposer;
  godray: ShaderPass;
  film: FilmPass;
  sun: THREE.Vector2;
  strength: { value: number };
};

export function createGrade(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera): Grade {
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.16, 0.42, 0.98);
  composer.addPass(bloom);
  const godray = new ShaderPass(GodrayShader);
  composer.addPass(godray);
  const film = new FilmPass(0.14, false);
  composer.addPass(film);
  composer.addPass(new OutputPass());
  return {
    composer,
    godray,
    film,
    sun: godray.uniforms.uSun.value as THREE.Vector2,
    strength: godray.uniforms.uStrength,
  };
}
