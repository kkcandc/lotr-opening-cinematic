import * as THREE from 'three';
import { NOISE } from '../glsl';
import { live } from '../mood';
import { RES, WORLD, getGrid } from '../world';

const HEIGHT_FN = /* glsl */ `
uniform sampler2D uHeight;
uniform float uWorld;
uniform float uRes;
float sampleH(vec2 xz) {
  vec2 uv = xz / uWorld + 0.5;
  vec2 texel = uv * uRes - 0.5;
  vec2 f = fract(texel);
  vec2 base = floor(texel);
  vec2 ts = vec2(1.0 / uRes);
  vec2 uv00 = (base + 0.5) * ts;
  float h00 = texture2D(uHeight, uv00).r;
  float h10 = texture2D(uHeight, uv00 + vec2(ts.x, 0.0)).r;
  float h01 = texture2D(uHeight, uv00 + vec2(0.0, ts.y)).r;
  float h11 = texture2D(uHeight, uv00 + ts).r;
  return mix(mix(h00, h10, f.x), mix(h01, h11, f.x), f.y);
}
float valleyCenter(float z) {
  return sin(z * 0.0031) * 36.0 + sin(z * 0.0107) * 12.0;
}
`;

export function createTerrain(): THREE.Mesh {
  const grid = getGrid();
  const data = new Float32Array(RES * RES * 4);
  for (let i = 0; i < grid.length; i++) data[i * 4] = grid[i];

  const tex = new THREE.DataTexture(data, RES, RES, THREE.RGBAFormat, THREE.FloatType);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.needsUpdate = true;

  const seg = 340;
  const geo = new THREE.PlaneGeometry(WORLD, WORLD, seg, seg);
  geo.rotateX(-Math.PI / 2);

  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uHeight: { value: tex },
      uWorld: { value: WORLD },
      uRes: { value: RES },
      uSunDir: live.sunDir,
      uHorizon: live.horizon,
      uFogDensity: live.fogDensity,
      uTime: live.time,
    },
    vertexShader: /* glsl */ `
      ${HEIGHT_FN}
      varying vec3 vWorld;
      void main() {
        vec3 p = position;
        p.y = sampleH(p.xz);
        vec4 world = modelMatrix * vec4(p, 1.0);
        vWorld = world.xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      precision highp float;
      ${NOISE}
      ${HEIGHT_FN}
      varying vec3 vWorld;
      uniform vec3 uSunDir;
      uniform vec3 uHorizon;
      uniform float uFogDensity;
      uniform float uTime;
      void main() {
        float e = uWorld / uRes;
        vec2 xz = vWorld.xz;
        float hL = sampleH(xz - vec2(e, 0.0));
        float hR = sampleH(xz + vec2(e, 0.0));
        float hD = sampleH(xz - vec2(0.0, e));
        float hU = sampleH(xz + vec2(0.0, e));
        vec3 n = normalize(vec3(hL - hR, 2.0 * e, hD - hU));
        float micro = fbm(xz * 0.09) - 0.5;
        n = normalize(n + vec3(micro, 0.0, fbm(xz.yx * 0.07) - 0.5) * 0.45);

        float slope = n.y;
        float h = vWorld.y;
        float snowLine = smoothstep(78.0, 104.0, h) * smoothstep(0.42, 0.78, slope);
        vec3 rockDeep = vec3(0.11, 0.09, 0.08);
        vec3 rockHigh = vec3(0.40, 0.36, 0.32);
        vec3 albedo = mix(rockDeep, rockHigh, smoothstep(12.0, 90.0, h));
        float strata = smoothstep(0.42, 0.58, fract(h * 0.17 + fbm(xz * 0.02) * 2.0));
        albedo = mix(albedo, albedo * 0.62, strata * (1.0 - slope));
        albedo *= 0.78 + 0.35 * fbm(xz * 0.22);
        vec3 snow = vec3(0.86, 0.84, 0.80);
        albedo = mix(albedo, snow, snowLine);

        float cx = xz.x - valleyCenter(xz.y);
        float valley = exp(-pow(abs(cx) / 150.0, 2.0));
        vec3 dust = vec3(0.34, 0.28, 0.20);
        albedo = mix(albedo, dust, valley * 0.82 * (1.0 - snowLine));

        vec3 sun = normalize(uSunDir);
        float ndl = dot(n, sun);
        float diff = max(ndl, 0.0);
        vec3 sunCol = vec3(1.05, 0.78, 0.52);
        vec3 skyCol = vec3(0.50, 0.58, 0.72);
        vec3 col = albedo * (sunCol * (diff * 1.35 + 0.08) + skyCol * (0.18 + 0.22 * max(n.y, 0.0)));
        float grazing = pow(max(ndl, 0.0), 8.0);
        col += vec3(1.0, 0.72, 0.38) * grazing * (0.18 + snowLine * 0.45);
        vec3 viewDir = normalize(cameraPosition - vWorld);
        float rim = pow(1.0 - max(dot(n, viewDir), 0.0), 3.0);
        col += vec3(1.0, 0.74, 0.46) * rim * snowLine * 0.4;

        float cloud = 0.68 + 0.32 * fbm(xz * 0.0035 + vec2(uTime * 0.01, 0.0));
        col *= cloud;

        float bounce = exp(-abs(cx) / 22.0) * valley;
        col += vec3(0.42, 0.18, 0.05) * bounce * 0.55;

        float dist = distance(cameraPosition, vWorld);
        float fog = 1.0 - exp(-dist * uFogDensity);
        col = mix(col, uHorizon, fog);
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });

  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  mesh.matrixAutoUpdate = false;
  mesh.updateMatrix();
  return mesh;
}
