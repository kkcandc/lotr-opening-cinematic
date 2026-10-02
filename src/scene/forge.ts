import * as THREE from 'three';
import { NOISE } from '../glsl';
import { live } from '../mood';
import { FORGE, sampleHeight } from '../world';

function stoneMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uSunDir: live.sunDir,
      uTime: live.time,
    },
    vertexShader: /* glsl */ `
      varying vec3 vNormal;
      varying vec3 vWorld;
      void main() {
        vec4 world = modelMatrix * vec4(position, 1.0);
        vWorld = world.xyz;
        vNormal = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * viewMatrix * world;
      }
    `,
    fragmentShader: /* glsl */ `
      precision highp float;
      ${NOISE}
      varying vec3 vNormal;
      varying vec3 vWorld;
      uniform vec3 uSunDir;
      uniform float uTime;
      void main() {
        vec3 n = normalize(vNormal);
        vec3 viewDir = normalize(cameraPosition - vWorld);
        float rim = pow(1.0 - max(dot(n, viewDir), 0.0), 2.2);
        float streak = smoothstep(0.4, 0.6, fract(vWorld.y * 0.11 + vnoise(vWorld.xz * 0.08)));
        vec3 col = vec3(0.025, 0.02, 0.018);
        col += vec3(0.05, 0.035, 0.028) * streak;
        float ndl = max(dot(n, normalize(uSunDir)), 0.0);
        col += vec3(0.08, 0.05, 0.03) * ndl;
        col += vec3(0.85, 0.38, 0.14) * rim * 0.55;
        float soot = fbm(vWorld.xz * 0.05 + vWorld.y * 0.02);
        col *= 0.65 + soot;
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
}

function glowMaterial(cold: boolean): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: { uTime: live.time },
    toneMapped: false,
    vertexShader: /* glsl */ `
      varying vec3 vLocal;
      void main() {
        vLocal = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      precision highp float;
      varying vec3 vLocal;
      uniform float uTime;
      void main() {
        float pulse = 0.72 + 0.28 * sin(uTime * 1.8);
        vec3 col;
        if (${cold ? 'true' : 'false'}) {
          float flick = 0.75 + 0.25 * sin(uTime * 9.0 + vLocal.y * 4.0);
          col = vec3(0.55, 0.82, 1.35) * (1.3 * flick);
        } else {
          col = mix(vec3(0.35, 0.05, 0.0), vec3(2.6, 0.85, 0.22), pulse);
        }
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
}

export function createForge(): THREE.Group {
  const group = new THREE.Group();
  const stone = stoneMaterial();
  const ember = glowMaterial(false);
  const cold = glowMaterial(true);

  const base = new THREE.Mesh(new THREE.CylinderGeometry(24, 28, 11, 9), stone);
  base.position.y = 4.2;
  group.add(base);

  const step = new THREE.Mesh(new THREE.CylinderGeometry(16, 21, 7, 8), stone);
  step.position.y = 12;
  group.add(step);

  const stack = new THREE.Mesh(new THREE.CylinderGeometry(6.5, 9.5, 30, 7), stone);
  stack.position.y = 29;
  group.add(stack);

  for (let i = 0; i < 5; i++) {
    const butt = new THREE.Mesh(new THREE.BoxGeometry(3.2, 16 + (i % 2) * 6, 5.5), stone);
    const a = -0.9 + i * 0.42;
    butt.position.set(Math.sin(a) * 20, 8, -Math.cos(a) * 18);
    butt.rotation.z = Math.sin(a) * 0.28;
    butt.rotation.x = -0.18;
    group.add(butt);
  }

  for (let i = 0; i < 3; i++) {
    const horn = new THREE.Mesh(new THREE.ConeGeometry(2.8, 15, 5), stone);
    const a = -0.6 + i * 0.7;
    horn.position.set(Math.sin(a) * 5.5, 49, Math.cos(a) * 4.2);
    horn.rotation.z = Math.sin(a) * 0.45;
    horn.rotation.x = 0.25 + i * 0.08;
    group.add(horn);
  }

  const mouth = new THREE.Mesh(new THREE.BoxGeometry(16, 3.4, 2.4), ember);
  mouth.position.set(0, 7.4, -23);
  group.add(mouth);
  for (const x of [-9.5, 9.5]) {
    const vent = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.6, 1.4), ember);
    vent.position.set(x, 6.2, -21);
    group.add(vent);
  }

  const crack = new THREE.Mesh(new THREE.BoxGeometry(0.55, 22, 0.45), cold);
  crack.position.set(1.1, 33, -8.6);
  crack.rotation.z = 0.08;
  group.add(crack);

  const leak = new THREE.Mesh(new THREE.BoxGeometry(7, 0.35, 3.2), ember);
  leak.position.set(0, 5.6, -24);
  group.add(leak);

  const y = sampleHeight(FORGE.x, FORGE.z);
  group.position.set(FORGE.x, y - 1.5, FORGE.z);
  group.rotation.y = 0.15;
  return group;
}
