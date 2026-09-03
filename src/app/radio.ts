import { useEffect } from 'react';

/**
 * Kampfpilot-Funk für das FLIR-Easteregg: spielt in zufälligen Abständen
 * CC0-Radio-Chatter-Clips (siehe docs/radio-credits.md) als leises,
 * „hintergrundfunkiges“ Grundrauschen. Dazu ein gefiltertes Statik-Bett aus
 * WebAudio-Noise, damit es nach echtem Funk klingt.
 */
export const RADIO_CLIPS = [
  '/audio/radio/air-strike.mp3',
  '/audio/radio/plane-chatter.mp3',
  '/audio/radio/fighter-panic.mp3',
  '/audio/radio/radio-dropout.mp3',
];

export const DEFAULT_VOLUME = 0.12;
export const STATIC_VOLUME = 0.014;

/** Pseudo-Zufallsindex in [0, n) — testbar über injiziertes rng. */
export function pickIndex(rng: () => number, n: number): number {
  if (n <= 0) return 0;
  return Math.min(n - 1, Math.max(0, Math.floor(rng() * n)));
}

/** Zufällige Pause zwischen zwei Clips in ms. */
export function nextGapMs(rng: () => number, minMs = 6000, maxMs = 16000): number {
  return Math.round(minMs + rng() * (maxMs - minMs));
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function playOnce(url: string, volume: number): Promise<void> {
  return new Promise((resolve) => {
    let audio: HTMLAudioElement | null = null;
    try {
      audio = new Audio(url);
    } catch {
      resolve();
      return;
    }
    audio.volume = volume;
    const done = () => {
      audio?.removeEventListener('ended', done);
      audio?.removeEventListener('error', done);
      resolve();
    };
    audio.addEventListener('ended', done);
    audio.addEventListener('error', done);
    audio.play().catch(done);
  });
}

export type RadioChatter = { start: () => void; stop: () => void };

export function createRadioChatter(opts: {
  clips?: string[];
  rng?: () => number;
  volume?: number;
  gapMinMs?: number;
  gapMaxMs?: number;
} = {}): RadioChatter {
  const clips = opts.clips ?? RADIO_CLIPS;
  const rng = opts.rng ?? Math.random;
  const volume = opts.volume ?? DEFAULT_VOLUME;
  const gapMinMs = opts.gapMinMs ?? 6000;
  const gapMaxMs = opts.gapMaxMs ?? 16000;
  if (clips.length === 0) return { start: () => {}, stop: () => {} };

  let ctx: AudioContext | null = null;
  let bedGain: GainNode | null = null;
  let running = false;

  const startBed = () => {
    try {
      ctx = new AudioContext();
      const buffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      src.loop = true;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 1600;
      bedGain = ctx.createGain();
      bedGain.gain.value = STATIC_VOLUME;
      src.connect(filter);
      filter.connect(bedGain);
      bedGain.connect(ctx.destination);
      src.start();
    } catch {
      ctx = null;
      bedGain = null;
    }
  };

  const loop = async () => {
    while (running) {
      const clip = clips[pickIndex(rng, clips.length)]!;
      if (!running) return;
      await playOnce(clip, volume);
      if (!running) return;
      await sleep(nextGapMs(rng, gapMinMs, gapMaxMs));
    }
  };

  return {
    start: () => {
      if (running) return;
      running = true;
      startBed();
      if (ctx?.state === 'suspended') ctx.resume().catch(() => {});
      void loop();
    },
    stop: () => {
      running = false;
      try {
        if (ctx) void ctx.close();
      } catch {
        /* noop */
      }
      ctx = null;
      bedGain = null;
    },
  };
}

/** Lässt während des FLIR-Modus leise Funk-Chatter laufen. */
export function useFlirRadio(active: boolean): void {
  useEffect(() => {
    if (!active) return;
    const chatter = createRadioChatter();
    chatter.start();
    return () => chatter.stop();
  }, [active]);
}
