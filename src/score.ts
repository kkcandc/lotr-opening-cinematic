/** Original procedural bed. Silent until the viewer unmutes. No recorded themes. */

export type Score = {
  toggle: () => boolean;
  muted: () => boolean;
  update: (time: number) => void;
};

export function createScore(): Score {
  let ctx: AudioContext | null = null;
  let master: GainNode | null = null;
  let pad: OscillatorNode | null = null;
  let coldGain: GainNode | null = null;
  let isMuted = true;
  let lastBeat = -1;

  function ensure(): void {
    if (ctx) return;
    const AC = window.AudioContext;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0;
    master.connect(ctx.destination);

    const make = (type: OscillatorType, freq: number, gain: number) => {
      const osc = ctx!.createOscillator();
      const amp = ctx!.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      amp.gain.value = gain;
      osc.connect(amp).connect(master!);
      osc.start();
      return osc;
    };

    make('sine', 55, 0.16);
    make('triangle', 82.5, 0.04);
    pad = make('sine', 165, 0.026);

    const cold = ctx.createOscillator();
    cold.type = 'sine';
    cold.frequency.value = 294;
    coldGain = ctx.createGain();
    coldGain.gain.value = 0;
    cold.connect(coldGain).connect(master);
    cold.start();

    const seconds = 2;
    const noiseBuf = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
    const data = noiseBuf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuf;
    noise.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 380;
    const wind = ctx.createGain();
    wind.gain.value = 0.055;
    noise.connect(filter).connect(wind).connect(master);
    noise.start();
  }

  function pulse(): void {
    if (!ctx || !master || isMuted) return;
    const osc = ctx.createOscillator();
    const amp = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 44;
    const now = ctx.currentTime;
    amp.gain.setValueAtTime(0.0001, now);
    amp.gain.exponentialRampToValueAtTime(0.32, now + 0.02);
    amp.gain.exponentialRampToValueAtTime(0.0001, now + 0.36);
    osc.connect(amp).connect(master);
    osc.start(now);
    osc.stop(now + 0.4);
  }

  return {
    muted: () => isMuted,
    toggle(): boolean {
      ensure();
      isMuted = !isMuted;
      if (!ctx || !master) return isMuted;
      void ctx.resume();
      master.gain.setTargetAtTime(isMuted ? 0 : 0.5, ctx.currentTime, isMuted ? 0.12 : 0.4);
      return isMuted;
    },
    update(time: number) {
      if (!ctx || !pad || !coldGain || isMuted) return;
      pad.frequency.setTargetAtTime(158 + Math.sin(time * 0.11) * 6, ctx.currentTime, 0.5);
      const chill = time > 60 ? Math.min(0.028, ((time - 60) / 10) * 0.028) : 0;
      coldGain.gain.setTargetAtTime(chill, ctx.currentTime, 0.4);
      if (time > 40 && time < 66) {
        const beat = Math.floor(time * 0.85);
        if (beat !== lastBeat) {
          lastBeat = beat;
          pulse();
        }
      }
    },
  };
}
