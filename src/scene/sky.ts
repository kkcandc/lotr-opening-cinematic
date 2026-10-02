import * as THREE from 'three';
import { NOISE } from '../glsl';
import { live } from '../mood';

export function createSky(): THREE.Mesh {
  const geo = new THREE.SphereGeometry(2400, 32, 20);
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uSunDir: live.sunDir,
      uHorizon: live.horizon,
      uZenith: live.zenith,
      uTime: live.time,
    },
    side: THREE.BackSide,
    depthWrite: false,
    depthTest: false,
    toneMapped: false,
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      precision highp float;
      ${NOISE}
      varying vec3 vDir;
      uniform vec3 uSunDir;
      uniform vec3 uHorizon;
      uniform vec3 uZenith;
      uniform float uTime;
      void main() {
        vec3 dir = normalize(vDir);
        float h = dir.y;
        vec3 col = mix(uHorizon, uZenith, smoothstep(-0.02, 0.62, h));
        col = mix(col, uHorizon * 1.15, pow(1.0 - max(h, 0.0), 6.0) * 0.35);
        float sunDot = max(dot(dir, normalize(uSunDir)), 0.0);
        float disk = pow(sunDot, 2800.0);
        float glow = pow(sunDot, 28.0);
        float wide = pow(sunDot, 5.0);
        col += vec3(1.15, 0.97, 0.82) * disk * 2.4;
        col += vec3(1.0, 0.55, 0.22) * glow * 0.28;
        col += uHorizon * wide * 0.1;
        float stars = step(0.9982, hash12(floor(dir.xy * 280.0 + dir.zx * 40.0)));
        float night = smoothstep(0.55, 0.15, uHorizon.r);
        col += vec3(0.85, 0.88, 1.0) * stars * night * smoothstep(0.05, 0.4, h);
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = -1000;
  return mesh;
}
