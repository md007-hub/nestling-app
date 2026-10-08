// Module-level Web Audio engine: lives outside React so playback survives tab/route changes.
import { useSyncExternalStore } from "react";

export type NoiseType = "white" | "lullaby" | "pink" | "brown" | "vacuum" | "dryer" | "ocean" | "rain";

type State = {
  active: NoiseType | null;
  volume: number;
  minutes: number; // 0 = continuous
  endsAt: number | null;
  fading: boolean;
};

const FADE_SECONDS = 5;
let state: State = { active: null, volume: 0.5, minutes: 0, endsAt: null, fading: false };
const listeners = new Set<() => void>();
const buffers = new Map<NoiseType, AudioBuffer>();

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let source: AudioBufferSourceNode | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;
let fadeTimer: ReturnType<typeof setTimeout> | null = null;

function set(patch: Partial<State>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

function buildBuffer(c: AudioContext, type: NoiseType) {
  const length = c.sampleRate * 8;
  const buffer = c.createBuffer(2, length, c.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buffer.getChannelData(ch);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0, last = 0, smooth = 0;
    const notes = [261.63, 329.63, 392, 329.63, 293.66, 261.63, 220, 261.63];
    for (let i = 0; i < length; i++) {
      const w = Math.random() * 2 - 1;
      const t = i / c.sampleRate;
      smooth = smooth * 0.985 + w * 0.015;
      if (type === "white") d[i] = w * 0.35;
      else if (type === "lullaby") {
        const beat = Math.floor(t * 2);
        const note = notes[Math.floor(beat / 2) % notes.length] ?? 261.63;
        const envelope = Math.pow(1 - (t * 2) % 1, 1.5);
        d[i] = envelope * (Math.sin(2 * Math.PI * note * t) * 0.22 + Math.sin(2 * Math.PI * note * 2 * t) * 0.05);
      }
      else if (type === "vacuum") {
        // deep resonant motor hum (100Hz + harmonics, all whole cycles in 8s) + low rumble
        last = (last + 0.02 * w) / 1.02;
        d[i] = Math.sin(2 * Math.PI * 100 * t) * 0.12 + Math.sin(2 * Math.PI * 200 * t) * 0.06 +
          Math.sin(2 * Math.PI * 300 * t) * 0.03 + last * 2.2 + smooth * 1.2;
      } else if (type === "dryer") {
        // warm steady mid-frequency rush: band-passed noise (white minus heavy low-pass)
        b0 = b0 * 0.6 + w * 0.4;
        d[i] = (b0 - smooth) * 0.45 + Math.sin(2 * Math.PI * 120 * t) * 0.02;
      } else if (type === "ocean") {
        // rhythmic low-pass swell, 8s period = exactly one wave per loop
        const swell = Math.pow(0.5 - 0.5 * Math.cos((2 * Math.PI * t) / 8), 2);
        b1 = b1 * 0.995 + w * 0.005;
        d[i] = (b1 * 9 * (0.25 + swell) + smooth * 2 * swell + w * 0.03 * swell);
      } else if (type === "rain") {
        // crisp light pink-ish hiss with scattered droplets
        b2 = 0.969 * b2 + w * 0.153852;
        b3 = 0.8665 * b3 + w * 0.3104856;
        b6 = b6 * 0.9 + (Math.random() < 0.0015 ? (Math.random() - 0.5) * 0.6 : 0);
        d[i] = (b2 + b3 + w * 0.3) * 0.12 + b6;
      }
      else if (type === "pink") {
        // Paul Kellet's 1/f filter
        b0 = 0.99886 * b0 + w * 0.0555179;
        b1 = 0.99332 * b1 + w * 0.0750759;
        b2 = 0.969 * b2 + w * 0.153852;
        b3 = 0.8665 * b3 + w * 0.3104856;
        b4 = 0.55 * b4 + w * 0.5329522;
        b5 = -0.7616 * b5 - w * 0.016898;
        d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.1;
        b6 = w * 0.115926;
      } else {
        // integrated white noise -> 1/f²
        last = (last + 0.02 * w) / 1.02;
        d[i] = last * 3.2;
      }
    }
    // short crossfade so the loop point is seamless
    const xf = Math.floor(c.sampleRate * 0.05);
    for (let i = 0; i < xf; i++) {
      const t = i / xf;
      d[i] = d[i]! * t + d[length - xf + i]! * (1 - t);
    }
  }
  return buffer;
}

function clearTimers() {
  if (timer) clearTimeout(timer);
  if (fadeTimer) clearTimeout(fadeTimer);
  timer = fadeTimer = null;
}

function stopSource() {
  try { source?.stop(); } catch { /* already stopped */ }
  source?.disconnect();
  source = null;
}

function scheduleTimer() {
  clearTimers();
  if (!state.active || state.minutes === 0) return set({ endsAt: null, fading: false });
  const ms = state.minutes * 60_000;
  set({ endsAt: Date.now() + ms, fading: false });
  timer = setTimeout(fadeOut, Math.max(0, ms - FADE_SECONDS * 1000));
}

function fadeOut() {
  if (!ctx || !master) return stop();
  set({ fading: true });
  const now = ctx.currentTime;
  master.gain.cancelScheduledValues(now);
  master.gain.setValueAtTime(master.gain.value, now);
  master.gain.linearRampToValueAtTime(0.0001, now + FADE_SECONDS);
  fadeTimer = setTimeout(stop, FADE_SECONDS * 1000 + 50);
}

// iOS: a playing <audio> element moves the audio session to "playback",
// so Web Audio is heard even with the hardware silent switch on.
let silentEl: HTMLAudioElement | null = null;
function silentWavUrl() {
  const rate = 8000, samples = 800; // 0.1s of 8-bit silence
  const buf = new ArrayBuffer(44 + samples);
  const v = new DataView(buf);
  const str = (o: number, s: string) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  str(0, "RIFF"); v.setUint32(4, 36 + samples, true); str(8, "WAVE"); str(12, "fmt ");
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, rate, true); v.setUint32(28, rate, true); v.setUint16(32, 1, true);
  v.setUint16(34, 8, true); str(36, "data"); v.setUint32(40, samples, true);
  for (let i = 0; i < samples; i++) v.setUint8(44 + i, 128);
  return URL.createObjectURL(new Blob([buf], { type: "audio/wav" }));
}
function unlockIosSession() {
  try {
    const nav = navigator as Navigator & { audioSession?: { type: string } };
    if (nav.audioSession) nav.audioSession.type = "playback";
  } catch { /* unsupported */ }
  if (!silentEl) {
    silentEl = new Audio(silentWavUrl());
    silentEl.loop = true;
    silentEl.setAttribute("playsinline", "");
    silentEl.setAttribute("x-webkit-airplay", "deny");
  }
  void silentEl.play().catch(() => { /* ignore */ });
}

export async function play(type: NoiseType) {
  // Everything below up to the first await runs synchronously inside the tap gesture.
  unlockIosSession();
  ctx ??= new AudioContext();
  const resuming = ctx.state !== "running" ? ctx.resume() : null;
  if (!master) {
    master = ctx.createGain();
    master.gain.value = state.volume;
    master.connect(ctx.destination);
  }
  if (resuming) await resuming;
  stopSource(); // one sound at a time
  let buf = buffers.get(type);
  if (!buf) buffers.set(type, (buf = buildBuffer(ctx, type)));
  const now = ctx.currentTime;
  master.gain.cancelScheduledValues(now);
  master.gain.setValueAtTime(0.0001, now);
  master.gain.linearRampToValueAtTime(state.volume, now + 0.4);
  source = ctx.createBufferSource();
  source.buffer = buf;
  source.loop = true;
  source.connect(master);
  source.start();
  set({ active: type });
  scheduleTimer();
  updateMediaSession();
}

export function stop() {
  clearTimers();
  stopSource();
  silentEl?.pause();
  if (master && ctx) master.gain.setValueAtTime(state.volume, ctx.currentTime);
  set({ active: null, endsAt: null, fading: false });
  updateMediaSession();
}

export function toggle(type: NoiseType) {
  return state.active === type ? stop() : play(type);
}

const TITLES: Record<NoiseType, string> = {
  white: "White Noise", lullaby: "Gentle Lullaby", pink: "Pink Noise", brown: "Brown Noise",
  vacuum: "Vacuum Cleaner", dryer: "Hair Dryer", ocean: "Ocean Waves", rain: "Soft Rain",
};
let lastTrack: NoiseType | null = null;

function updateMediaSession() {
  if (typeof navigator === "undefined" || !("mediaSession" in navigator)) return;
  const ms = navigator.mediaSession;
  if (state.active) {
    lastTrack = state.active;
    ms.metadata = new MediaMetadata({
      title: TITLES[state.active],
      artist: "Nursery Sounds",
      album: "Nestling",
      artwork: [
        { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
        { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      ],
    });
  }
  ms.playbackState = state.active ? "playing" : "paused";
  try {
    ms.setActionHandler("play", () => { if (lastTrack) void play(lastTrack); });
    ms.setActionHandler("pause", () => stop());
    ms.setActionHandler("stop", () => stop());
  } catch { /* unsupported action */ }
}

export function setVolume(v: number) {
  set({ volume: v });
  if (master && ctx && !state.fading) master.gain.setTargetAtTime(v, ctx.currentTime, 0.05);
}

export function setMinutes(m: number) {
  set({ minutes: m });
  if (state.active) {
    if (state.fading && master && ctx) master.gain.setTargetAtTime(state.volume, ctx.currentTime, 0.1);
    scheduleTimer();
  }
}

const subscribe = (l: () => void) => (listeners.add(l), () => listeners.delete(l));
export function useSoundEngine() {
  return useSyncExternalStore(subscribe, () => state, () => state);
}
