# Vaelorne — The Ashen Threshold

An original fantasy prologue, played as a procedural short. Mountains, mist, a river of living fire, and a host of silhouettes under a failing sun. About 78 seconds. No recorded music, no image plates, no paid APIs.

This is not an adaptation of any existing book or film. The people, places, and the quenched forge are invented for this piece.

## Watch

```bash
npm install
npm run dev
```

Open the local URL. The film starts on its own, muted. Unmute if you want the generated drone, wind, and march pulse. The picture carries the story either way.

Chapters:

| Time | Chapter | What you see |
| --- | --- | --- |
| 0:00 | Vaelorne | Title on living black, then the first cut of light |
| 0:08 | The Spine | Ridges, cloud, and a lone figure for scale |
| 0:22 | Hearthflow | The valley fire-river and the Kilnborn line |
| 0:36 | Ashhost | The host from above, then from inside the march |
| 0:54 | The Forge | The quenched kiln on its shelf |
| 1:08 | Threshold | Last title. The film holds. Replay starts it again |

`?t=36` or `#ashhost` opens on a chapter.

## Controls

- **Replay** restarts from the title
- **Skip** jumps to the next chapter (from the last chapter, it replays)
- Chapter names seek directly
- The gold line scrubs
- **Space** pauses
- **Left / right** change chapter
- **M** mutes or unmutes
- **R** replays
- **F** toggles fullscreen

## Lore

Vaelorne is a high country. Its mountains are called the Spine of Cinders. In the valleys, the Kilnborn kept a fire that had never gone out. The Hollow Regent taught the north how to quench it. What walked out of that dead fire is the Ashhost: cloaks, spears, and ember eyes, marching on the last living hearth. The hearth’s light still runs the valley as the Hearthflow. At the far shelf stands the Quenched Forge, cold along its crack and still leaking ember at the mouth.

## Deploy

Static Vite build. [`vercel.json`](vercel.json) publishes `dist`.

This project belongs to **Kenny Kline**, personal account, Vercel scope **`kkcandc` only**. Do not create or deploy it under any other team.

```bash
npm run build
npx vercel --scope kkcandc
```

## Stack

Vite, TypeScript, and Three.js. Terrain, clouds, mist, the host, and the grade are shaders and instancing. Cinzel and Cormorant Garamond are used under the SIL Open Font License.
