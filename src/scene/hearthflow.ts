import * as THREE from 'three';
import { NOISE } from '../glsl';
import { live } from '../mood';
import { sampleHeight, valleyCenterX } from '../world';

export function createHearthflow(): THREE.Mesh {
  const segs = 220;
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const z0 = -70;
  const z1 = 470;
  for (let i = 0; i <= segs; i++) {
    const u = i / segs;
    const z = z0 + (z1 - z0) * u;
    const x = valleyCenterX(z);
    const y = sampleHeight(x, z) + 0.45;
    const dx = valleyCenterX(z + 2) - valleyCenterX(z - 2);
    const pl = Math.hypot(-4, dx) || 1;
    const ox = (-4 / pl) * 3.4;
    const oz = (dx / pl) * 3.4;
    positions.push(x + ox, y, z + oz, x - ox, y, z - oz);
    uvs.push(0, u, 1, u);
  }
  for (let i = 0; i < segs; i++) {
    const a = i * 2;
    const b = a + 1;
    const c = a + 2;
    const d = a + 3;
    indices.push(a, c, b, b, c, d);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();

  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: live.time,
      uHorizon: live.horizon,
      uFogDensity: live.fogDensity,
    },
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      varying vec3 vWorld;
      void main() {
        vUv = uv;
        vec4 world = modelMatrix * vec4(position, 1.0);
        vWorld = world.xyz;
        gl_Position = projectionMatrix * viewMatrix * world;
      }
    `,
    fragmentShader: /* glsl */ `
      precision highp float;
      ${NOISE}
      varying vec2 vUv;
      varying vec3 vWorld;
      uniform float uTime;
      uniform vec3 uHorizon;
      uniform float uFogDensity;
      void main() {
        float flow = fbm(vec2(vUv.x * 3.0, vUv.y * 18.0 - uTime * 0.35));
        float core = smoothstep(0.0, 0.15, vUv.x) * smoothstep(1.0, 0.85, vUv.x);
        core *= 0.55 + 0.9 * flow;
        float die = smoothstep(0.62, 0.98, vUv.y);
        vec3 hot = vec3(1.7, 0.62, 0.16);
        vec3 ember = vec3(2.4, 1.05, 0.45);
        vec3 cold = vec3(0.25, 0.32, 0.42);
        vec3 col = mix(hot, ember, smoothstep(0.55, 0.9, flow));
        col = mix(col, cold, die);
        float ends = smoothstep(0.0, 0.04, vUv.y) * smoothstep(1.0, 0.9, vUv.y);
        float alpha = core * ends * (1.0 - die * 0.35);
        float dist = distance(cameraPosition, vWorld);
        float fog = 1.0 - exp(-dist * uFogDensity);
        col = mix(col, uHorizon, fog * 0.65);
        alpha *= 1.0 - fog * 0.5;
        gl_FragColor = vec4(col, alpha);
      }
    `,
  });

  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = 1;
  return mesh;
}
