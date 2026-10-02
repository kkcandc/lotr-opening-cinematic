import * as THREE from 'three';
import { NOISE } from '../glsl';
import { live } from '../mood';

export type Air = {
  group: THREE.Group;
  update: (cameraY: number) => void;
};

export function createAir(): Air {
  const group = new THREE.Group();
  const cloudMats: { mat: THREE.ShaderMaterial; y: number; base: number }[] = [];

  const cloudShader = (scale: number, speed: number) =>
    new THREE.ShaderMaterial({
      uniforms: {
        uSunDir: live.sunDir,
        uHorizon: live.horizon,
        uTime: live.time,
        uOpacity: { value: 1 },
        uScale: { value: scale },
        uSpeed: { value: speed },
        uDust: live.dust,
      },
      transparent: true,
      depthWrite: false,
      toneMapped: false,
      vertexShader: /* glsl */ `
        varying vec3 vWorld;
        varying vec2 vUv;
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
        varying vec3 vWorld;
        varying vec2 vUv;
        uniform vec3 uSunDir;
        uniform vec3 uHorizon;
        uniform float uTime;
        uniform float uOpacity;
        uniform float uScale;
        uniform float uSpeed;
        uniform float uDust;
        void main() {
          vec2 p = vWorld.xz * uScale + vec2(uTime * uSpeed, 0.0);
          float n = fbm(p);
          float b = fbm(p * 2.4 - uTime * uSpeed * 0.6);
          float dens = smoothstep(0.46, 0.78, n);
          dens *= smoothstep(0.15, 0.55, b);
          float edge = smoothstep(0.0, 0.18, dens) * (1.0 - smoothstep(0.35, 0.85, dens));
          float sun = pow(max(dot(vec3(0.0, 1.0, 0.0), normalize(uSunDir)), 0.0), 0.65);
          vec3 shadowCol = mix(vec3(0.22, 0.20, 0.26), vec3(0.32, 0.20, 0.14), uDust);
          vec3 litCol = mix(vec3(1.0, 0.84, 0.66), uHorizon, 0.35);
          vec3 col = mix(shadowCol, litCol, edge * 0.85 + dens * sun * 0.45);
          float radial = smoothstep(0.78, 0.25, length(vUv - 0.5));
          float alpha = dens * uOpacity * radial;
          if (alpha < 0.01) discard;
          gl_FragColor = vec4(col, alpha);
        }
      `,
    });

  const layers: { y: number; scale: number; speed: number; opacity: number; size: number }[] = [
    { y: 102, scale: 0.0042, speed: 0.8, opacity: 0.72, size: 3400 },
    { y: 128, scale: 0.0031, speed: 0.45, opacity: 0.6, size: 3800 },
    { y: 158, scale: 0.0024, speed: 0.22, opacity: 0.45, size: 4200 },
  ];

  for (const layer of layers) {
    const geo = new THREE.PlaneGeometry(layer.size, layer.size, 1, 1);
    geo.rotateX(-Math.PI / 2);
    const mat = cloudShader(layer.scale, layer.speed);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.y = layer.y;
    mesh.renderOrder = 2;
    mesh.frustumCulled = false;
    group.add(mesh);
    cloudMats.push({ mat, y: layer.y, base: layer.opacity });
  }

  const mistMats: { mat: THREE.ShaderMaterial; y: number; base: number }[] = [];
  const mistHeights = [11, 18, 27, 38];
  mistHeights.forEach((y, index) => {
    const geo = new THREE.PlaneGeometry(1500, 1500, 1, 1);
    geo.rotateX(-Math.PI / 2);
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uHorizon: live.horizon,
        uTime: live.time,
        uOpacity: { value: 0.35 },
        uDust: live.dust,
        uDrift: { value: index * 2.3 },
      },
      transparent: true,
      depthWrite: false,
      vertexShader: /* glsl */ `
        varying vec3 vWorld;
        void main() {
          vec4 world = modelMatrix * vec4(position, 1.0);
          vWorld = world.xyz;
          gl_Position = projectionMatrix * viewMatrix * world;
        }
      `,
      fragmentShader: /* glsl */ `
        precision highp float;
        ${NOISE}
        varying vec3 vWorld;
        uniform vec3 uHorizon;
        uniform float uTime;
        uniform float uOpacity;
        uniform float uDust;
        uniform float uDrift;
        float valleyCenter(float z) {
          return sin(z * 0.0031) * 36.0 + sin(z * 0.0107) * 12.0;
        }
        void main() {
          vec2 p = vWorld.xz * 0.012 + vec2(uTime * 0.015 + uDrift, uTime * 0.004);
          float n = fbm(p);
          float dens = smoothstep(0.38, 0.75, n);
          float cx = vWorld.x - valleyCenter(vWorld.z);
          float valley = exp(-pow(abs(cx) / 190.0, 2.0));
          valley *= smoothstep(-260.0, -40.0, vWorld.z) * (1.0 - smoothstep(560.0, 720.0, vWorld.z));
          vec3 col = mix(uHorizon, vec3(0.55, 0.32, 0.16), uDust * 0.65);
          col = mix(col, vec3(0.72, 0.64, 0.54), 0.25);
          float alpha = dens * valley * uOpacity;
          if (alpha < 0.015) discard;
          gl_FragColor = vec4(col, alpha);
        }
      `,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.y = y;
    mesh.renderOrder = 2;
    mesh.frustumCulled = false;
    group.add(mesh);
    mistMats.push({ mat, y, base: 0.22 + index * 0.04 });
  });

  const shaftGeo = new THREE.CylinderGeometry(18, 46, 420, 8, 1, true);
  const shafts: THREE.Mesh[] = [];
  for (let i = 0; i < 7; i++) {
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: live.time,
        uSunDir: live.sunDir,
        uOpacity: live.shaft,
        uSeed: { value: i * 1.7 },
      },
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        precision highp float;
        ${NOISE}
        varying vec2 vUv;
        uniform float uTime;
        uniform float uOpacity;
        uniform float uSeed;
        void main() {
          float along = vUv.y;
          float across = abs(vUv.x - 0.5) * 2.0;
          float streak = fbm(vec2(vUv.x * 6.0 + uSeed, vUv.y * 2.0 - uTime * 0.05 + uSeed));
          float alpha = smoothstep(0.85, 0.15, across) * smoothstep(0.0, 0.15, along) * smoothstep(1.0, 0.55, along);
          alpha *= (0.35 + 0.65 * streak) * uOpacity * 0.09;
          vec3 col = vec3(1.0, 0.78, 0.48);
          gl_FragColor = vec4(col, alpha);
        }
      `,
    });
    const mesh = new THREE.Mesh(shaftGeo, mat);
    mesh.position.set(-180 + i * 70, 150, -160 + (i % 3) * 40);
    mesh.renderOrder = 1;
    mesh.frustumCulled = false;
    group.add(mesh);
    shafts.push(mesh);
  }

  const aim = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  const anchors: [number, number][] = [
    [-280, -240],
    [-90, -190],
    [70, -150],
    [190, -70],
    [-170, -30],
    [30, 40],
    [-40, -300],
  ];

  return {
    group,
    update(cameraY: number) {
      for (const cloud of cloudMats) {
        const away = Math.min(1, Math.abs(cameraY - cloud.y) / 22);
        cloud.mat.uniforms.uOpacity.value = cloud.base * (0.25 + 0.75 * away);
      }
      for (const mist of mistMats) {
        const away = Math.min(1, Math.abs(cameraY - mist.y) / 10);
        mist.mat.uniforms.uOpacity.value = mist.base * (0.08 + 0.92 * away);
      }
      aim.copy(live.sunDir.value).normalize().multiplyScalar(-1);
      for (let i = 0; i < shafts.length; i++) {
        const mesh = shafts[i];
        mesh.quaternion.setFromUnitVectors(up, aim);
        const [x, z] = anchors[i];
        mesh.position.set(x, 200, z);
      }
    },
  };
}
