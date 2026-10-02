import * as THREE from 'three';
import { live } from '../mood';
import { FORGE, sampleHeight, valleyCenterX } from '../world';
import type { Soldier } from './host';

function mulberry(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (Math.imul(a, 1664525) + 1013904223) >>> 0;
    return a / 4294967296;
  };
}

function localOffset(yaw: number, scale: number, lx: number, ly: number, lz: number): [number, number, number] {
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  const wx = (lx * c + lz * s) * scale;
  const wz = (-lx * s + lz * c) * scale;
  return [wx, ly * scale, wz];
}

export function createSparks(soldiers: Soldier[]): THREE.Group {
  const group = new THREE.Group();
  const rand = mulberry(0x51a11);

  const positions: number[] = [];
  const colors: number[] = [];
  const sizes: number[] = [];
  const phases: number[] = [];
  const kinds: number[] = [];

  const push = (x: number, y: number, z: number, r: number, g: number, b: number, size: number, kind: number) => {
    positions.push(x, y, z);
    colors.push(r, g, b);
    sizes.push(size);
    phases.push(rand());
    kinds.push(kind);
  };

  for (const soldier of soldiers) {
    const [hx, hy, hz] = localOffset(soldier.yaw, soldier.scale, 0, 1.62, 0.06);
    if (soldier.host === 1) {
      push(soldier.x + hx, soldier.y + hy, soldier.z + hz, 1.0, 0.82, 0.45, 1.15, 0);
    } else {
      push(soldier.x + hx, soldier.y + hy, soldier.z + hz, 1.0, 0.32, 0.08, 1.35, 0);
    }
    const torchChance = soldier.host === 0 ? 0.2 : 0.1;
    if (soldier.seed < torchChance) {
      const [tx, ty, tz] = localOffset(soldier.yaw, soldier.scale, 0.36, 1.25, 0.42);
      push(soldier.x + tx, soldier.y + ty, soldier.z + tz, 1.0, 0.48, 0.12, 7.5, 1);
    }
  }

  for (let i = 0; i < 900; i++) {
    const z = -40 + rand() * 520;
    const x = valleyCenterX(z) + (rand() - 0.5) * 150;
    const y = sampleHeight(x, z) + 4 + rand() * 36;
    push(x, y, z, 1.0, 0.72, 0.38, 3.2 + rand() * 3.5, 2);
  }

  const forgeY = sampleHeight(FORGE.x, FORGE.z);
  for (let i = 0; i < 700; i++) {
    const x = FORGE.x + (rand() - 0.5) * 30;
    const z = FORGE.z - 8 - rand() * 24;
    const y = forgeY + 6 + rand() * 18;
    push(x, y, z, 1.0, 0.45 + rand() * 0.3, 0.1, 4.5 + rand() * 4, 2);
  }

  for (let i = 0; i < 500; i++) {
    const x = (rand() - 0.5) * 700;
    const z = -300 + rand() * 400;
    const y = 70 + rand() * 80;
    push(x, y, z, 1.0, 0.85, 0.65, 10 + rand() * 14, 3);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('aColor', new THREE.Float32BufferAttribute(colors, 3));
  geo.setAttribute('aSize', new THREE.Float32BufferAttribute(sizes, 1));
  geo.setAttribute('aPhase', new THREE.Float32BufferAttribute(phases, 1));
  geo.setAttribute('aKind', new THREE.Float32BufferAttribute(kinds, 1));

  const mat = new THREE.ShaderMaterial({
    uniforms: { uTime: live.time, uDust: live.dust },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
    vertexShader: /* glsl */ `
      attribute vec3 aColor;
      attribute float aSize;
      attribute float aPhase;
      attribute float aKind;
      uniform float uTime;
      varying vec3 vColor;
      varying float vKind;
      void main() {
        vec3 p = position;
        float bob = sin(uTime * 7.0 + aPhase * 6.28) * 0.06;
        if (aKind < 0.5) p.y += abs(bob);
        if (aKind > 0.5 && aKind < 1.5) p.y += abs(bob) + 0.15;
        if (aKind > 1.5 && aKind < 2.5) {
          float rise = fract(aPhase + uTime * 0.045);
          p.y += rise * 28.0;
          p.x += sin(uTime * 0.6 + aPhase * 12.0) * rise * 4.0;
          p.z += cos(uTime * 0.45 + aPhase * 9.0) * rise * 4.0;
        }
        if (aKind > 2.5) {
          p.x += sin(uTime * 0.15 + aPhase * 8.0) * 6.0;
          p.y += sin(uTime * 0.2 + aPhase) * 2.0;
        }
        vec4 mv = viewMatrix * vec4(p, 1.0);
        gl_PointSize = clamp(aSize * 92.0 / max(1.0, -mv.z), 1.0, 48.0);
        gl_Position = projectionMatrix * mv;
        vColor = aColor;
        vKind = aKind;
      }
    `,
    fragmentShader: /* glsl */ `
      precision highp float;
      varying vec3 vColor;
      varying float vKind;
      uniform float uDust;
      void main() {
        vec2 d = gl_PointCoord - vec2(0.5);
        float r = length(d);
        if (r > 0.5) discard;
        float soft = smoothstep(0.5, 0.0, r);
        float alpha = soft;
        vec3 col = vColor;
        if (vKind < 0.5) alpha *= 0.95;
        else if (vKind < 1.5) {
          alpha *= 0.9;
          col *= 1.6;
        } else if (vKind < 2.5) {
          alpha *= 0.55;
        } else {
          alpha *= 0.08 + uDust * 0.05;
        }
        gl_FragColor = vec4(col, alpha);
      }
    `,
  });

  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  points.renderOrder = 3;
  group.add(points);

  const ashPositions: number[] = [];
  const ashPhases: number[] = [];
  for (let i = 0; i < 1100; i++) {
    const z = 80 + rand() * 480;
    const x = valleyCenterX(z) + (rand() - 0.5) * 180;
    const y = sampleHeight(x, z) + rand() * 50;
    ashPositions.push(x, y, z);
    ashPhases.push(rand());
  }
  const ashGeo = new THREE.BufferGeometry();
  ashGeo.setAttribute('position', new THREE.Float32BufferAttribute(ashPositions, 3));
  ashGeo.setAttribute('aPhase', new THREE.Float32BufferAttribute(ashPhases, 1));
  const ashMat = new THREE.ShaderMaterial({
    uniforms: { uTime: live.time, uDust: live.dust },
    transparent: true,
    depthWrite: false,
    vertexShader: /* glsl */ `
      attribute float aPhase;
      uniform float uTime;
      varying float vAlpha;
      void main() {
        float fall = fract(aPhase + uTime * 0.03);
        vec3 p = position;
        p.y = position.y + 40.0 * (1.0 - fall);
        p.x += sin(uTime * 0.4 + aPhase * 10.0) * 3.0;
        vec4 mv = viewMatrix * vec4(p, 1.0);
        gl_PointSize = clamp(28.0 / max(1.0, -mv.z), 1.0, 18.0);
        gl_Position = projectionMatrix * mv;
        vAlpha = smoothstep(0.0, 0.1, fall) * (1.0 - smoothstep(0.8, 1.0, fall));
      }
    `,
    fragmentShader: /* glsl */ `
      precision highp float;
      varying float vAlpha;
      uniform float uDust;
      void main() {
        float r = length(gl_PointCoord - vec2(0.5));
        if (r > 0.5) discard;
        float a = smoothstep(0.5, 0.1, r) * vAlpha * (0.15 + uDust * 0.45);
        gl_FragColor = vec4(0.08, 0.07, 0.06, a);
      }
    `,
  });
  const ash = new THREE.Points(ashGeo, ashMat);
  ash.frustumCulled = false;
  ash.renderOrder = 4;
  group.add(ash);
  return group;
}
