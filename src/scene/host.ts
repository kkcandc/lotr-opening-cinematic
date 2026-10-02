import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { NOISE } from '../glsl';
import { live } from '../mood';
import {
  WATCH,
  marchYaw,
  sampleHeight,
  valleyCenterX,
} from '../world';

export type Soldier = {
  x: number;
  y: number;
  z: number;
  yaw: number;
  host: number;
  scale: number;
  seed: number;
};

function mulberry(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (Math.imul(a, 1664525) + 1013904223) >>> 0;
    return a / 4294967296;
  };
}

export function placeSoldiers(): Soldier[] {
  const rand = mulberry(0xa5e11);
  const out: Soldier[] = [];
  for (const side of [-1, 1]) {
    for (let r = 0; r < 112; r++) {
      for (let c = 0; c < 17; c++) {
        const z = 48 + r * 2.55 + rand() * 0.85;
        const cx = valleyCenterX(z);
        const x = cx + side * (8.4 + c * 2.32) + (rand() - 0.5) * 0.65;
        const y = sampleHeight(x, z);
        if (y > 26) continue;
        out.push({
          x,
          y,
          z,
          yaw: marchYaw(z) + (rand() - 0.5) * 0.14,
          host: 0,
          scale: 0.88 + rand() * 0.36,
          seed: rand(),
        });
      }
    }
  }
  for (let r = 0; r < 3; r++) {
    for (let i = 0; i < 78; i++) {
      const z = -34 - r * 2.15;
      const cx = valleyCenterX(z);
      const x = cx + (i - 39) * 1.62;
      const y = sampleHeight(x, z);
      if (y > 30) continue;
      out.push({
        x,
        y,
        z,
        yaw: marchYaw(z) + Math.PI,
        host: 1,
        scale: 0.98 + rand() * 0.16,
        seed: rand(),
      });
    }
  }
  return out;
}

function tag(geo: THREE.BufferGeometry, part: number): THREE.BufferGeometry {
  const count = geo.getAttribute('position').count;
  const parts = new Float32Array(count);
  parts.fill(part);
  geo.setAttribute('aPart', new THREE.BufferAttribute(parts, 1));
  if (!geo.getAttribute('uv')) {
    geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(count * 2), 2));
  }
  return geo;
}

function figureGeometry(): THREE.BufferGeometry {
  const left = tag(new THREE.BoxGeometry(0.16, 0.62, 0.18), 1);
  left.translate(-0.13, 0.31, 0);
  const right = tag(new THREE.BoxGeometry(0.16, 0.62, 0.18), 2);
  right.translate(0.13, 0.31, 0);
  const cloak = tag(new THREE.CylinderGeometry(0.18, 0.56, 1.28, 6, 1), 0);
  cloak.translate(0, 1.02, 0);
  const chest = tag(new THREE.BoxGeometry(0.32, 0.36, 0.2), 0);
  chest.translate(0, 1.28, 0.02);
  const hood = tag(new THREE.SphereGeometry(0.19, 6, 5), 0);
  hood.translate(0, 1.7, 0.03);
  const spear = tag(new THREE.CylinderGeometry(0.028, 0.04, 2.4, 4), 3);
  spear.translate(0, 1.2, 0);
  spear.rotateX(-0.38);
  spear.translate(0.32, 0.92, 0.08);

  const merged = mergeGeometries([left, right, cloak, chest, hood, spear], false);
  if (!merged) throw new Error('Figure geometry failed to merge.');
  left.dispose();
  right.dispose();
  cloak.dispose();
  chest.dispose();
  hood.dispose();
  spear.dispose();
  return merged;
}

const FIGURE_VERT = /* glsl */ `
attribute float aPart;
attribute float aSeed;
attribute float aHost;
uniform float uTime;
varying vec3 vNormal;
varying vec3 vWorld;
varying float vHost;
varying float vTorch;
void main() {
  vec3 p = position;
  float swing = sin(uTime * 7.4 + aSeed * 6.28318);
  if (aPart > 0.5 && aPart < 1.5) {
    vec3 hip = vec3(-0.13, 0.62, 0.0);
    float ang = swing * 0.6;
    vec3 q = p - hip;
    float c = cos(ang);
    float s = sin(ang);
    q = vec3(q.x, q.y * c - q.z * s, q.y * s + q.z * c);
    p = q + hip;
  }
  if (aPart > 1.5 && aPart < 2.5) {
    vec3 hip = vec3(0.13, 0.62, 0.0);
    float ang = -swing * 0.6;
    vec3 q = p - hip;
    float c = cos(ang);
    float s = sin(ang);
    q = vec3(q.x, q.y * c - q.z * s, q.y * s + q.z * c);
    p = q + hip;
  }
  if (aPart < 0.5) {
    float hem = smoothstep(1.2, 0.28, p.y);
    p.x += sin(uTime * 1.45 + aSeed * 8.0 + p.y * 2.0) * 0.11 * hem;
    p.z += cos(uTime * 1.15 + aSeed * 5.0) * 0.07 * hem;
  }
  if (aPart > 2.5 && aPart < 3.5) {
    float tip = smoothstep(0.3, 2.3, p.y);
    p.x += sin(uTime * 1.7 + aSeed * 4.0) * 0.07 * tip;
  }
  #ifdef USE_INSTANCING
    vec4 world = modelMatrix * instanceMatrix * vec4(p, 1.0);
    vNormal = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * normal);
  #else
    vec4 world = modelMatrix * vec4(p, 1.0);
    vNormal = normalize(mat3(modelMatrix) * normal);
  #endif
  vWorld = world.xyz;
  vHost = aHost;
  vTorch = step(0.82, aSeed);
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

const FIGURE_FRAG = /* glsl */ `
precision highp float;
varying vec3 vNormal;
varying vec3 vWorld;
varying float vHost;
varying float vTorch;
uniform vec3 uSunDir;
void main() {
  vec3 n = normalize(vNormal);
  vec3 viewDir = normalize(cameraPosition - vWorld);
  float rim = pow(1.0 - max(dot(n, viewDir), 0.0), 1.65);
  float sunWrap = 0.35 + 0.65 * max(dot(n, normalize(uSunDir)), 0.0);
  vec3 col = vec3(0.015, 0.012, 0.01);
  vec3 edge = mix(vec3(1.0, 0.7, 0.38), vec3(1.0, 0.88, 0.58), clamp(vHost, 0.0, 1.0));
  col += edge * rim * sunWrap * mix(1.05, 1.35, clamp(vHost, 0.0, 1.0));
  col += vec3(0.55, 0.18, 0.04) * vTorch * 0.4;
  gl_FragColor = vec4(col, 1.0);
}
`;

function figureMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: live.time,
      uSunDir: live.sunDir,
    },
    vertexShader: FIGURE_VERT,
    fragmentShader: FIGURE_FRAG,
  });
}

function fillMesh(mesh: THREE.InstancedMesh, soldiers: Soldier[], offset = 0): void {
  const dummy = new THREE.Object3D();
  const seeds = new Float32Array(mesh.count);
  const hosts = new Float32Array(mesh.count);
  for (let i = 0; i < mesh.count; i++) {
    const s = soldiers[offset + i];
    dummy.position.set(s.x, s.y, s.z);
    dummy.rotation.set(0, s.yaw, 0);
    dummy.scale.setScalar(s.scale);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
    seeds[i] = s.seed;
    hosts[i] = s.host;
  }
  mesh.instanceMatrix.needsUpdate = true;
  mesh.geometry.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seeds, 1));
  mesh.geometry.setAttribute('aHost', new THREE.InstancedBufferAttribute(hosts, 1));
  mesh.frustumCulled = false;
}

export function createHost(soldiers: Soldier[]): THREE.Group {
  const group = new THREE.Group();
  const geo = figureGeometry();
  const mat = figureMaterial();
  const watchGeo = geo.clone();
  const mesh = new THREE.InstancedMesh(geo, mat, soldiers.length);
  fillMesh(mesh, soldiers);
  group.add(mesh);
  const watcher = new THREE.InstancedMesh(watchGeo, mat, 1);
  const wy = sampleHeight(WATCH.x, WATCH.z);
  fillMesh(watcher, [
    {
      x: WATCH.x,
      y: wy,
      z: WATCH.z,
      yaw: marchYaw(WATCH.z) + 0.4,
      host: 1,
      scale: 1.55,
      seed: 0.4,
    },
  ]);
  group.add(watcher);

  const bannerSoldiers = soldiers.filter((s, i) => s.host === 0 && i % 140 === 0).slice(0, 36);
  for (let i = 0; i < 8; i++) {
    const s = soldiers.find((soldier, index) => soldier.host === 1 && index % 20 === i);
    if (s) bannerSoldiers.push(s);
  }
  if (bannerSoldiers.length) {
    group.add(createBanners(bannerSoldiers));
  }
  group.add(createBirds());
  return group;
}

function createBanners(soldiers: Soldier[]): THREE.InstancedMesh {
  const geo = new THREE.PlaneGeometry(1.35, 2.7, 10, 1);
  geo.translate(0.68, 2.35, 0);
  const mat = new THREE.ShaderMaterial({
    uniforms: { uTime: live.time, uSunDir: live.sunDir },
    side: THREE.DoubleSide,
    vertexShader: /* glsl */ `
      attribute float aSeed;
      attribute float aHost;
      uniform float uTime;
      varying vec2 vUv;
      varying float vHost;
      varying float vSeed;
      void main() {
        vUv = uv;
        vHost = aHost;
        vSeed = aSeed;
        vec3 p = position;
        float flap = sin(uTime * 2.4 + aSeed * 12.0 + p.y * 1.6);
        p.z += flap * 0.42 * uv.x;
        p.y += cos(uTime * 1.8 + aSeed * 6.0) * 0.08 * uv.x;
        vec4 world = modelMatrix * instanceMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * viewMatrix * world;
      }
    `,
    fragmentShader: /* glsl */ `
      precision highp float;
      ${NOISE}
      varying vec2 vUv;
      varying float vHost;
      varying float vSeed;
      uniform vec3 uSunDir;
      void main() {
        float tear = vnoise(vec2(vUv.y * 9.0, vSeed * 8.0));
        if (vUv.x > 0.72 && tear > 0.55) discard;
        vec3 cloth = mix(vec3(0.11, 0.045, 0.03), vec3(0.22, 0.16, 0.08), vHost);
        vec3 stripe = vec3(0.82, 0.62, 0.32);
        float band = smoothstep(0.08, 0.12, vUv.x) * (1.0 - smoothstep(0.2, 0.26, vUv.x));
        vec3 col = mix(cloth, stripe, band);
        col += stripe * pow(max(dot(vec3(0.0, 0.0, 1.0), normalize(uSunDir)), 0.0), 1.2) * 0.15;
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
  const mesh = new THREE.InstancedMesh(geo, mat, soldiers.length);
  fillMesh(mesh, soldiers);
  return mesh;
}

function createBirds(): THREE.InstancedMesh {
  const geo = new THREE.BufferGeometry();
  const positions = new Float32Array([
    0, 0, 0, -1.15, 0.02, -0.25, -0.15, 0.05, 0.35,
    0, 0, 0, 1.15, 0.02, -0.25, 0.15, 0.05, 0.35,
  ]);
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(18).fill(0).map((_, i) => (i % 3 === 1 ? 1 : 0)), 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(12), 2));
  const count = 28;
  const seeds = new Float32Array(count);
  const radii = new Float32Array(count);
  const heights = new Float32Array(count);
  const centers = new Float32Array(count * 2);
  const rand = mulberry(99);
  for (let i = 0; i < count; i++) {
    seeds[i] = rand();
    radii[i] = 40 + rand() * 90;
    heights[i] = 78 + rand() * 48;
    centers[i * 2] = -80 + rand() * 160;
    centers[i * 2 + 1] = -180 + rand() * 120;
  }
  geo.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seeds, 1));
  geo.setAttribute('aRad', new THREE.InstancedBufferAttribute(radii, 1));
  geo.setAttribute('aHeight', new THREE.InstancedBufferAttribute(heights, 1));
  geo.setAttribute('aCenter', new THREE.InstancedBufferAttribute(centers, 2));
  const mat = new THREE.ShaderMaterial({
    uniforms: { uTime: live.time },
    side: THREE.DoubleSide,
    vertexShader: /* glsl */ `
      attribute float aSeed;
      attribute float aRad;
      attribute float aHeight;
      attribute vec2 aCenter;
      uniform float uTime;
      void main() {
        float ang = uTime * 0.18 + aSeed * 6.28318;
        vec3 center = vec3(aCenter.x + cos(ang) * aRad, aHeight + sin(uTime * 0.7 + aSeed) * 2.0, aCenter.y + sin(ang) * aRad * 0.65);
        vec3 p = position;
        float flap = sin(uTime * 8.0 + aSeed * 20.0);
        p.y += abs(p.x) * flap * 0.55;
        vec3 forward = normalize(vec3(-sin(ang), 0.0, cos(ang)));
        vec3 side = normalize(cross(vec3(0.0, 1.0, 0.0), forward));
        vec3 world = center + side * p.x + vec3(0.0, 1.0, 0.0) * p.y + forward * p.z;
        gl_Position = projectionMatrix * viewMatrix * vec4(world, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      precision highp float;
      void main() {
        gl_FragColor = vec4(0.03, 0.025, 0.02, 1.0);
      }
    `,
  });
  const mesh = new THREE.InstancedMesh(geo, mat, count);
  const dummy = new THREE.Object3D();
  for (let i = 0; i < count; i++) {
    dummy.position.set(0, 0, 0);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
  }
  mesh.instanceMatrix.needsUpdate = true;
  mesh.frustumCulled = false;
  return mesh;
}
