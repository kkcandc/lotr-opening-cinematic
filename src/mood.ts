import * as THREE from 'three';

/** Shared uniform values. Materials hold these objects and read them every frame. */
export const live = {
  time: { value: 0 },
  fogDensity: { value: 0.0032 },
  sunDir: { value: new THREE.Vector3(0.42, 0.48, 0.55).normalize() },
  horizon: { value: new THREE.Color('#f2c79a') },
  zenith: { value: new THREE.Color('#152033') },
  dust: { value: 0 },
  shaft: { value: 1 },
  exposure: 1,
};

export const DURATION = 78;

export type Chapter = {
  id: string;
  name: string;
  t: number;
};

export const chapters: Chapter[] = [
  { id: 'vaelorne', name: 'Vaelorne', t: 0 },
  { id: 'spine', name: 'The Spine', t: 8 },
  { id: 'hearthflow', name: 'Hearthflow', t: 22 },
  { id: 'ashhost', name: 'Ashhost', t: 36 },
  { id: 'forge', name: 'The Forge', t: 54 },
  { id: 'threshold', name: 'Threshold', t: 68 },
];

export type Card = {
  t0: number;
  t1: number;
  place: 'center' | 'lower';
  kicker?: string;
  title?: string;
  body?: string;
};

export const cards: Card[] = [
  {
    t0: 0.45,
    t1: 6.35,
    place: 'center',
    kicker: 'A prologue',
    title: 'Vaelorne',
    body: 'The Last Hearth',
  },
  {
    t0: 12.2,
    t1: 19.6,
    place: 'lower',
    body: 'The Spine of Cinders held the sky on its back.',
  },
  {
    t0: 23.6,
    t1: 31.4,
    place: 'lower',
    body: 'Below, the Kilnborn kept a fire the dark had never named.',
  },
  {
    t0: 36.6,
    t1: 44.4,
    place: 'lower',
    body: 'The Hollow Regent quenched the unkillable hearth. The Ashhost rose in its smoke.',
  },
  {
    t0: 56.2,
    t1: 64.8,
    place: 'lower',
    body: 'They marched for no throne. Only for the dark after the last flame.',
  },
  {
    t0: 74.6,
    t1: 400,
    place: 'center',
    kicker: 'The war for the last dawn',
    title: 'The Ashen Threshold',
    body: 'The last dawn is still burning.',
  },
];
