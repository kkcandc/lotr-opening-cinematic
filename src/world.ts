/** Original geography for Vaelorne. Pure math — no renderer imports. */

export const WORLD = 1800;
export const RES = 320;

export const WATCH = { x: -220, z: -80 };
export const FORGE = { x: 24, z: 530 };

const VALLEY_A = 0.0031;
const VALLEY_B = 36;
const VALLEY_C = 0.0107;
const VALLEY_D = 12;

export function valleyCenterX(z: number): number {
  return Math.sin(z * VALLEY_A) * VALLEY_B + Math.sin(z * VALLEY_C) * VALLEY_D;
}

function smoothstep(e0: number, e1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
}

const perm = new Uint8Array(512);
function buildPerm(seed: number): void {
  const p = new Uint8Array(256);
  for (let i = 0; i < 256; i++) p[i] = i;
  let s = seed >>> 0;
  for (let i = 255; i > 0; i--) {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    const j = s % (i + 1);
    const tmp = p[i];
    p[i] = p[j];
    p[j] = tmp;
  }
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
}
buildPerm(0x5a17);

function fade(t: number): number {
  return t * t * t * (t * (t * 6 - 15) + 10);
}

function grad(hash: number, x: number, y: number): number {
  const h = hash & 3;
  const u = h < 2 ? x : y;
  const v = h < 2 ? y : x;
  return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
}

export function noise2(x: number, y: number): number {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const xf = x - x0;
  const yf = y - y0;
  const xi = x0 & 255;
  const yi = y0 & 255;
  const u = fade(xf);
  const v = fade(yf);
  const aa = perm[xi + perm[yi]];
  const ba = perm[xi + 1 + perm[yi]];
  const ab = perm[xi + perm[yi + 1]];
  const bb = perm[xi + 1 + perm[yi + 1]];
  const x1 = xf - 1;
  const y1 = yf - 1;
  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
  return lerp(
    lerp(grad(aa, xf, yf), grad(ba, x1, yf), u),
    lerp(grad(ab, xf, y1), grad(bb, x1, y1), u),
    v,
  );
}

function fbm(x: number, y: number, octaves: number): number {
  let amp = 0.5;
  let freq = 1;
  let sum = 0;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += amp * noise2(x * freq, y * freq);
    norm += amp;
    amp *= 0.5;
    freq *= 2.03;
  }
  return sum / norm;
}

function ridged(x: number, y: number, octaves: number): number {
  let amp = 0.55;
  let freq = 1;
  let sum = 0;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    let n = noise2(x * freq, y * freq);
    n = 1 - Math.abs(n);
    n *= n;
    sum += n * amp;
    norm += amp;
    amp *= 0.5;
    freq *= 2.09;
  }
  return sum / norm;
}

/** Meters-ish elevation at a world coordinate. Deterministic. */
export function computeHeight(x: number, z: number): number {
  const nx = x * 0.00082;
  const nz = z * 0.00082;
  const warpX = fbm(nx * 1.6 + 2.2, nz * 1.6, 4) * 0.62;
  const warpZ = fbm(nx * 1.6 + 8.4, nz * 1.6 + 3.1, 4) * 0.62;
  let ridges = ridged(nx * 1.28 + warpX, nz * 1.22 + warpZ, 6);
  ridges = Math.pow(ridges, 1.28);
  const detail = ridged(nx * 3.8 + 19.0, nz * 3.6, 3);
  let mountains = (ridges * 0.8 + detail * 0.2) * 172;

  const cx = x - valleyCenterX(z);
  const width = 172 + 26 * Math.sin(z * 0.0042);
  const across = Math.exp(-((cx * cx) / (width * width)) * 2.15);
  const along = smoothstep(-230, -50, z) * (1 - smoothstep(575, 710, z));
  const mask = across * along;
  const floor = 8 + fbm(nx * 5.5 + 4.0, nz * 5.5, 3) * 2.4;
  let h = mountains * (1 - mask * 0.94) + floor * mask;

  const wdx = x - WATCH.x;
  const wdz = z - WATCH.z;
  h += 48 * Math.exp(-(wdx * wdx + wdz * wdz) / (46 * 46));

  const fdx = x - FORGE.x;
  const fdz = z - FORGE.z;
  const fd = Math.hypot(fdx, fdz);
  if (fd < 84) {
    const k = smoothstep(84, 36, fd);
    h = h * (1 - k) + 48 * k;
  }
  const wallZ = FORGE.z + 68;
  const wall =
    Math.exp(-((z - wallZ) * (z - wallZ)) / (24 * 24)) *
    Math.exp(-(fdx * fdx) / (96 * 96));
  h += wall * 70;

  return h;
}

let grid: Float32Array | null = null;

export function buildField(): void {
  const data = new Float32Array(RES * RES);
  for (let iz = 0; iz < RES; iz++) {
    const z = (iz / (RES - 1) - 0.5) * WORLD;
    for (let ix = 0; ix < RES; ix++) {
      const x = (ix / (RES - 1) - 0.5) * WORLD;
      data[iz * RES + ix] = computeHeight(x, z);
    }
  }
  grid = data;
}

export function getGrid(): Float32Array {
  if (!grid) throw new Error('Call buildField() before sampling the spine.');
  return grid;
}

export function sampleHeight(x: number, z: number): number {
  const data = getGrid();
  const u = (x / WORLD + 0.5) * (RES - 1);
  const v = (z / WORLD + 0.5) * (RES - 1);
  const x0 = Math.min(RES - 1, Math.max(0, Math.floor(u)));
  const y0 = Math.min(RES - 1, Math.max(0, Math.floor(v)));
  const x1 = Math.min(RES - 1, x0 + 1);
  const y1 = Math.min(RES - 1, y0 + 1);
  const tx = u - Math.floor(u);
  const ty = v - Math.floor(v);
  const h00 = data[y0 * RES + x0];
  const h10 = data[y0 * RES + x1];
  const h01 = data[y1 * RES + x0];
  const h11 = data[y1 * RES + x1];
  const a = h00 + (h10 - h00) * tx;
  const b = h01 + (h11 - h01) * tx;
  return a + (b - a) * ty;
}

/** Yaw that points a figure's local +Z along the valley, toward the hearth (decreasing z). */
export function marchYaw(z: number): number {
  const ahead = valleyCenterX(z - 3) - valleyCenterX(z + 3);
  return Math.atan2(ahead, -6);
}
