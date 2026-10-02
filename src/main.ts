import '@fontsource/cinzel/latin-500.css';
import '@fontsource/cinzel/latin-600.css';
import '@fontsource/cormorant-garamond/latin-500-italic.css';
import '@fontsource/cormorant-garamond/latin-600-italic.css';
import './style.css';

import * as THREE from 'three';
import { DURATION, cards, chapters, live, type Card, type Chapter } from './mood';
import { createScore } from './score';
import { createAir } from './scene/air';
import { createForge } from './scene/forge';
import { createGrade } from './scene/grade';
import { createHearthflow } from './scene/hearthflow';
import { createHost, placeSoldiers } from './scene/host';
import { createSky } from './scene/sky';
import { createSparks } from './scene/sparks';
import { createTerrain } from './scene/terrain';
import { createUi } from './ui';
import { FORGE, WATCH, buildField, sampleHeight, valleyCenterX } from './world';

type Vec3 = [number, number, number];
type Key = {
  t: number;
  pos: Vec3;
  look: Vec3;
  fov: number;
  roll: number;
  clear: number;
};

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const horizonDawn = new THREE.Color('#f4c99a');
const horizonDusk = new THREE.Color('#7a382c');
const zenithDawn = new THREE.Color('#1a2744');
const zenithDusk = new THREE.Color('#07060d');
const sunEarly = new THREE.Vector3(0.74, 0.44, 0.26);
const sunLate = new THREE.Vector3(0.16, 0.3, 0.9);
const sunPoint = new THREE.Vector3();

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function catmull(p0: Vec3, p1: Vec3, p2: Vec3, p3: Vec3, u: number): Vec3 {
  const u2 = u * u;
  const u3 = u2 * u;
  const out: Vec3 = [0, 0, 0];
  for (let i = 0; i < 3; i++) {
    out[i] =
      0.5 *
      (2 * p1[i] +
        (-p0[i] + p2[i]) * u +
        (2 * p0[i] - 5 * p1[i] + 4 * p2[i] - p3[i]) * u2 +
        (-p0[i] + 3 * p1[i] - 3 * p2[i] + p3[i]) * u3);
  }
  return out;
}

function sampleVec(keys: Key[], time: number, field: 'pos' | 'look'): Vec3 {
  const last = keys.length - 1;
  if (time <= keys[0].t) return [...keys[0][field]];
  if (time >= keys[last].t) return [...keys[last][field]];
  let i = 0;
  while (i < last - 1 && time > keys[i + 1].t) i++;
  const span = Math.max(0.0001, keys[i + 1].t - keys[i].t);
  const u = (time - keys[i].t) / span;
  return catmull(
    keys[Math.max(0, i - 1)][field],
    keys[i][field],
    keys[i + 1][field],
    keys[Math.min(last, i + 2)][field],
    u,
  );
}

function sampleNum(keys: Key[], time: number, field: 'fov' | 'roll' | 'clear'): number {
  const last = keys.length - 1;
  if (time <= keys[0].t) return keys[0][field];
  if (time >= keys[last].t) return keys[last][field];
  let i = 0;
  while (i < last - 1 && time > keys[i + 1].t) i++;
  const span = Math.max(0.0001, keys[i + 1].t - keys[i].t);
  const u = (time - keys[i].t) / span;
  return lerp(keys[i][field], keys[i + 1][field], u);
}

function buildKeys(): Key[] {
  const aisle = (z: number) => valleyCenterX(z);
  const watchY = sampleHeight(WATCH.x, WATCH.z);
  const forgeY = sampleHeight(FORGE.x, FORGE.z);
  return [
    { t: 0, pos: [190, 162, -370], look: [-20, 96, -150], fov: 37, roll: 0.02, clear: 18 },
    { t: 6.4, pos: [148, 154, -318], look: [-90, 88, -96], fov: 39, roll: 0.04, clear: 18 },
    { t: 10.4, pos: [-20, 132, -210], look: [-180, 76, -48], fov: 47, roll: -0.055, clear: 20 },
    {
      t: 15.4,
      pos: [WATCH.x + 58, watchY + 14, WATCH.z - 34],
      look: [WATCH.x, watchY + 2.4, WATCH.z],
      fov: 30,
      roll: 0.018,
      clear: 6,
    },
    { t: 20.6, pos: [-24, 102, -156], look: [aisle(70), 26, 100], fov: 51, roll: 0.07, clear: 24 },
    { t: 26.2, pos: [aisle(-112), 0, -112], look: [aisle(90), 16, 110], fov: 48, roll: 0, clear: 10 },
    { t: 33, pos: [aisle(-18), 0, -18], look: [aisle(160), 12, 190], fov: 46, roll: -0.02, clear: 7 },
    { t: 38.6, pos: [aisle(-86) + 10, 0, -86], look: [aisle(230), 14, 250], fov: 63, roll: 0.028, clear: 58 },
    { t: 45.4, pos: [aisle(26), 0, 26], look: [aisle(130), 8, 140], fov: 32, roll: 0, clear: 1.65 },
    { t: 51.6, pos: [aisle(168) + 12, 0, 168], look: [aisle(360), 18, 380], fov: 52, roll: -0.028, clear: 11 },
    {
      t: 58.2,
      pos: [aisle(310) + 64, 0, 310],
      look: [FORGE.x, forgeY + 38, FORGE.z],
      fov: 42,
      roll: 0.04,
      clear: 26,
    },
    {
      t: 66,
      pos: [FORGE.x - 82, forgeY + 16, FORGE.z - 102],
      look: [FORGE.x + 4, forgeY + 36, FORGE.z + 8],
      fov: 31,
      roll: -0.04,
      clear: 9,
    },
    {
      t: 73,
      pos: [FORGE.x + 6, forgeY + 96, FORGE.z - 210],
      look: [FORGE.x, forgeY + 42, FORGE.z],
      fov: 40,
      roll: 0,
      clear: 22,
    },
    {
      t: 78,
      pos: [FORGE.x - 12, forgeY + 128, FORGE.z - 270],
      look: [FORGE.x, forgeY + 28, FORGE.z],
      fov: 36,
      roll: 0,
      clear: 30,
    },
  ];
}

function scriptVeil(time: number): number {
  if (time < 6.4) return 1;
  if (time < 7.6) {
    const u = (time - 6.4) / 1.2;
    return 1 - u * u;
  }
  if (time < 72.2) return 0;
  if (time < 77.4) {
    const u = (time - 72.2) / 5.2;
    return u * u;
  }
  return 1;
}

function cardAt(time: number): { card: Card | null; opacity: number } {
  let best: Card | null = null;
  let opacity = 0;
  for (const card of cards) {
    const inn = smoothstep(card.t0, card.t0 + 0.65, time);
    const out = 1 - smoothstep(card.t1 - 0.75, card.t1, time);
    const value = Math.max(0, Math.min(inn, out));
    if (value > opacity) {
      opacity = value;
      best = card;
    }
  }
  return { card: best, opacity };
}

function chapterAt(time: number): Chapter {
  let current = chapters[0];
  for (const chapter of chapters) {
    if (time >= chapter.t - 0.001) current = chapter;
  }
  return current;
}

function readStart(): number {
  const params = new URLSearchParams(location.search);
  if (params.has('t')) {
    const value = Number(params.get('t'));
    if (Number.isFinite(value)) return Math.min(DURATION, Math.max(0, value));
  }
  const hash = location.hash.replace('#', '');
  const chapter = chapters.find((item) => item.id === hash);
  return chapter ? chapter.t : 0;
}

function fail(message: string): void {
  const node = document.createElement('div');
  node.id = 'fail';
  node.textContent = message;
  document.body.append(node);
}

function applyMood(time: number): void {
  const dusk = smoothstep(56, 72, time);
  live.horizon.value.copy(horizonDawn).lerp(horizonDusk, dusk);
  live.zenith.value.copy(zenithDawn).lerp(zenithDusk, dusk);
  const sunMix = smoothstep(10, 52, time);
  live.sunDir.value.copy(sunEarly).lerp(sunLate, sunMix).normalize();
  const valleyFog = lerp(0.0025, 0.0054, smoothstep(18, 34, time));
  live.fogDensity.value = lerp(valleyFog, 0.0074, smoothstep(54, 68, time));
  live.dust.value = smoothstep(36, 50, time) * (1 - smoothstep(66, 75, time) * 0.35);
  live.shaft.value = smoothstep(7.2, 11.5, time) * (1 - smoothstep(57, 70, time));
  const reveal = smoothstep(6.5, 7.8, time);
  const flash = Math.exp(-((time - 7.25) * (time - 7.25)) / 0.14);
  live.exposure = (0.58 + reveal * 0.48 + flash * 0.42) * (1 - dusk * 0.22);
  live.time.value = time;
}

function boot(): void {
  const canvas = document.getElementById('view');
  if (!(canvas instanceof HTMLCanvasElement)) {
    fail('This prologue needs a canvas.');
    return;
  }

  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      alpha: false,
      powerPreference: 'high-performance',
    });
  } catch {
    fail('This prologue needs WebGL.');
    return;
  }
  if (!renderer.getContext()) {
    fail('This prologue needs WebGL.');
    return;
  }

  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.setClearColor(0x07080c, 1);
  const pixelRatio = Math.min(window.devicePixelRatio || 1, window.innerWidth < 800 ? 1.15 : 1.45);
  renderer.setPixelRatio(pixelRatio);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, 1, 0.25, 5200);

  buildField();
  const keys = buildKeys();
  const soldiers = placeSoldiers();
  const sky = createSky();
  scene.add(sky);
  scene.add(createTerrain());
  scene.add(createHearthflow());
  scene.add(createForge());
  scene.add(createHost(soldiers));
  scene.add(createSparks(soldiers));
  const air = createAir();
  scene.add(air.group);
  const grade = createGrade(renderer, scene, camera);
  const score = createScore();

  let time = readStart();
  let paused = false;
  let seekGlow = 0;
  let chapterId = '';

  const resize = () => {
    const width = window.innerWidth;
    const height = Math.max(1, window.innerHeight);
    renderer.setSize(width, height, false);
    grade.composer.setSize(width, height);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  };
  resize();
  window.addEventListener('resize', resize);

  const ui = createUi(chapters, {
    onSeek: (next) => seek(next),
    onChapter: (next) => seek(next),
    onReplay: () => seek(0),
    onSkip: () => skip(1),
    onMute: () => {
      ui.setMuted(score.toggle());
    },
  });

  function seek(next: number): void {
    time = Math.min(DURATION, Math.max(0, next));
    seekGlow = 0.85;
  }

  function skip(dir: number): void {
    if (dir > 0) {
      const next = chapters.find((chapter) => chapter.t > time + 0.35);
      if (next) seek(next.t);
      else seek(0);
      return;
    }
    const prev = [...chapters].reverse().find((chapter) => chapter.t < time - 0.35);
    seek(prev ? prev.t : 0);
  }

  window.addEventListener('keydown', (event) => {
    if (event.code === 'Space') {
      event.preventDefault();
      paused = !paused;
    } else if (event.code === 'ArrowRight') {
      skip(1);
    } else if (event.code === 'ArrowLeft') {
      skip(-1);
    } else if (event.key === 'm' || event.key === 'M') {
      ui.setMuted(score.toggle());
    } else if (event.key === 'r' || event.key === 'R') {
      seek(0);
    } else if (event.key === 'f' || event.key === 'F') {
      if (!document.fullscreenElement) void document.documentElement.requestFullscreen().catch(() => undefined);
      else void document.exitFullscreen().catch(() => undefined);
    }
  });

  let last = performance.now();
  const loop = (now: number) => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (!document.hidden && !paused && time < DURATION) time += dt;
    if (time > DURATION) time = DURATION;
    seekGlow = Math.max(0, seekGlow - dt * 1.8);

    applyMood(time);
    renderer.toneMappingExposure = live.exposure;

    const pos = sampleVec(keys, time, 'pos');
    const look = sampleVec(keys, time, 'look');
    const clear = sampleNum(keys, time, 'clear');
    const ground = sampleHeight(pos[0], pos[2]);
    if (pos[1] < ground + clear) pos[1] = ground + clear;
    if (time > 43.6 && time < 49.2) look[1] = pos[1] + 6.4;

    const shake = reduceMotion || time < 7.4 ? 0 : time > 44 && time < 52 ? 0.16 : 0.045;
    pos[0] += Math.sin(time * 1.7) * shake;
    pos[1] += Math.sin(time * 2.3) * shake * 0.45;
    look[0] += Math.sin(time * 1.3) * shake * 0.35;

    camera.up.set(0, 1, 0);
    camera.position.set(pos[0], pos[1], pos[2]);
    camera.lookAt(look[0], look[1], look[2]);
    camera.rotateZ(sampleNum(keys, time, 'roll'));
    camera.fov = sampleNum(keys, time, 'fov');
    camera.updateProjectionMatrix();

    sky.position.copy(camera.position);
    air.update(camera.position.y);

    sunPoint.copy(camera.position).addScaledVector(live.sunDir.value, 900);
    sunPoint.project(camera);
    grade.sun.set((sunPoint.x * 0.5 + 0.5), (sunPoint.y * 0.5 + 0.5));
    const sunVisible = sunPoint.z < 1 && grade.sun.x > -0.15 && grade.sun.x < 1.15 && grade.sun.y > -0.15 && grade.sun.y < 1.15;
    grade.strength.value = sunVisible ? 0.32 : 0;

    if (!document.hidden) grade.composer.render();

    const chapter = chapterAt(time);
    if (chapter.id !== chapterId) {
      chapterId = chapter.id;
      const url = new URL(location.href);
      url.hash = chapter.id;
      history.replaceState(null, '', url);
      document.title = chapter.id === 'threshold' ? 'The Ashen Threshold' : `Vaelorne — ${chapter.name}`;
    }
    const card = cardAt(time);
    ui.setCard(card.card, card.opacity);
    ui.setVeil(Math.min(1, scriptVeil(time) + seekGlow));
    ui.setPlayhead(time, chapter.id, paused, time >= DURATION - 0.05);
    score.update(time);
    requestAnimationFrame(loop);
  };

  ui.setMuted(true);
  requestAnimationFrame(loop);
}

boot();
