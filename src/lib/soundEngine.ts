import { useEffect, useSyncExternalStore } from "react";
import {
  isNativeAndroidAudio,
  playNativeSound,
  stopNativeSound,
  setNativeSoundVolume,
  setNativeSleepTimer,
  getNativeAudioStatus,
} from "./nestlingAudio";

// Module-level audio engine: survives React route changes.
export type NoiseType =
  | "white"
  | "lullaby"
  | "pink"
  | "brown"
  | "vacuum"
  | "dryer"
  | "ocean"
  | "rain";

type State = {
  active: NoiseType | null;
  volume: number;
  minutes: number;
  endsAt: number | null;
  fading: boolean;
};

const FADE_SECONDS = 5;

const RECORDINGS: Partial<Record<NoiseType, string>> = {
  lullaby: "/sounds/nestling-lullaby-loop.mp3",
  vacuum: "/sounds/nestling-vacuum-loop.mp3",
  rain: "/sounds/nestling-rain-loop.mp3",
};

let state: State = {
  active: null,
  volume: 0.5,
  minutes: 0,
  endsAt: null,
  fading: false,
};

const listeners = new Set<() => void>();
const buffers = new Map<NoiseType, AudioBuffer>();
const pendingBuffers = new Map<NoiseType, Promise<AudioBuffer>>();

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let source: AudioBufferSourceNode | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;
let fadeTimer: ReturnType<typeof setTimeout> | null = null;
let requestId = 0;

// Serialize native commands so quick sound changes cannot run out of order.
let nativeCommands: Promise<void> = Promise.resolve();
function enqueueNative(action: () => Promise<void>): Promise<void> {
  const next = nativeCommands.catch(() => {}).then(action);
  nativeCommands = next.catch((error) => {
    console.error("Nestling native audio command failed:", error);
  });
  return next;
}

const NATIVE_TYPES: NoiseType[] = [
  "white", "lullaby", "pink", "brown", "vacuum", "dryer", "ocean", "rain",
];

// Read Android's actual playback state instead of relying on suspended JS timers.
async function syncNativeStatus() {
  if (!isNativeAndroidAudio()) return;
  const snapshotRequest = requestId;
  await enqueueNative(async () => {
    if (snapshotRequest !== requestId) return;
    const status = await getNativeAudioStatus();
    if (snapshotRequest !== requestId) return;
    const active = status.playing && NATIVE_TYPES.includes(status.active as NoiseType)
      ? (status.active as NoiseType)
      : null;
    const endsAt = active && status.remainingMs > 0
      ? Date.now() + status.remainingMs
      : null;
    const patch: Partial<State> = {
      active,
      endsAt,
      fading: Boolean(active && status.fading),
    };
    if (status.active) patch.minutes = status.minutes;
    if (state.active !== patch.active || state.fading !== patch.fading ||
        ((state.endsAt === null) !== (patch.endsAt === null)) ||
        (state.endsAt !== null && patch.endsAt !== null &&
         Math.abs(state.endsAt - patch.endsAt) > 1500) ||
        (patch.minutes !== undefined && state.minutes !== patch.minutes)) {
      set(patch);
    }
  });
}

function set(patch: Partial<State>) {
  state = { ...state, ...patch };
  listeners.forEach((listener) => listener());
}

// Original generated sounds are preserved.
function buildBuffer(c: AudioContext, type: NoiseType): AudioBuffer {
  const length = c.sampleRate * 8;
  const buffer = c.createBuffer(2, length, c.sampleRate);

  for (let ch = 0; ch < 2; ch++) {
    const d = buffer.getChannelData(ch);

    let b0 = 0;
    let b1 = 0;
    let b2 = 0;
    let b3 = 0;
    let b4 = 0;
    let b5 = 0;
    let b6 = 0;
    let last = 0;
    let smooth = 0;

    for (let i = 0; i < length; i++) {
      const w = Math.random() * 2 - 1;
      const t = i / c.sampleRate;

      smooth = smooth * 0.985 + w * 0.015;

      if (type === "white") {
        d[i] = w * 0.35;
      } else if (type === "dryer") {
        b0 = b0 * 0.6 + w * 0.4;
        d[i] =
          (b0 - smooth) * 0.45 +
          Math.sin(2 * Math.PI * 120 * t) * 0.02;
      } else if (type === "ocean") {
        const swell = Math.pow(
          0.5 - 0.5 * Math.cos((2 * Math.PI * t) / 8),
          2
        );
        b1 = b1 * 0.995 + w * 0.005;
        d[i] =
          b1 * 9 * (0.25 + swell) +
          smooth * 2 * swell +
          w * 0.03 * swell;
      } else if (type === "pink") {
        b0 = 0.99886 * b0 + w * 0.0555179;
        b1 = 0.99332 * b1 + w * 0.0750759;
        b2 = 0.969 * b2 + w * 0.153852;
        b3 = 0.8665 * b3 + w * 0.3104856;
        b4 = 0.55 * b4 + w * 0.5329522;
        b5 = -0.7616 * b5 - w * 0.016898;

        d[i] =
          (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) *
          0.1;

        b6 = w * 0.115926;
      } else {
        // Original brown-noise generator.
        last = (last + 0.02 * w) / 1.02;
        d[i] = last * 3.2;
      }
    }

    // Preserve the original generated-sound loop smoothing.
    const xf = Math.floor(c.sampleRate * 0.05);

    for (let i = 0; i < xf; i++) {
      const t = i / xf;
      d[i] =
        d[i]! * t +
        d[length - xf + i]! * (1 - t);
    }
  }

  return buffer;
}

async function getBuffer(
  c: AudioContext,
  type: NoiseType
): Promise<AudioBuffer> {
  const cached = buffers.get(type);
  if (cached) return cached;

  const recordingUrl = RECORDINGS[type];

  if (!recordingUrl) {
    const generated = buildBuffer(c, type);
    buffers.set(type, generated);
    return generated;
  }

  let pending = pendingBuffers.get(type);

  if (!pending) {
    pending = (async () => {
      const response = await fetch(recordingUrl);

      if (!response.ok) {
        throw new Error(
          `Could not load ${type} recording: HTTP ${response.status}`
        );
      }

      const audioData = await response.arrayBuffer();
      const decoded = await c.decodeAudioData(audioData);

      buffers.set(type, decoded);
      return decoded;
    })();

    pendingBuffers.set(type, pending);
  }

  try {
    return await pending;
  } finally {
    if (pendingBuffers.get(type) === pending) {
      pendingBuffers.delete(type);
    }
  }
}

function clearTimers() {
  if (timer) clearTimeout(timer);
  if (fadeTimer) clearTimeout(fadeTimer);

  timer = null;
  fadeTimer = null;
}

function stopSource() {
  try {
    source?.stop();
  } catch {
    // Source may already be stopped.
  }

  source?.disconnect();
  source = null;
}

function scheduleTimer() {
  clearTimers();

  if (!state.active || state.minutes === 0) {
    set({ endsAt: null, fading: false });
    return;
  }

  const ms = state.minutes * 60_000;

  set({
    endsAt: Date.now() + ms,
    fading: false,
  });

  timer = setTimeout(
    fadeOut,
    Math.max(0, ms - FADE_SECONDS * 1000)
  );
}

function fadeOut() {
  if (!ctx || !master) {
    stop();
    return;
  }

  set({ fading: true });

  const now = ctx.currentTime;

  master.gain.cancelScheduledValues(now);
  master.gain.setValueAtTime(master.gain.value, now);
  master.gain.linearRampToValueAtTime(
    0.0001,
    now + FADE_SECONDS
  );

  fadeTimer = setTimeout(
    stop,
    FADE_SECONDS * 1000 + 50
  );
}

// Existing iOS audio-session workaround.
let silentEl: HTMLAudioElement | null = null;

function silentWavUrl() {
  const rate = 8000;
  const samples = 800;
  const buf = new ArrayBuffer(44 + samples);
  const v = new DataView(buf);

  const str = (offset: number, value: string) =>
    [...value].forEach((char, index) =>
      v.setUint8(offset + index, char.charCodeAt(0))
    );

  str(0, "RIFF");
  v.setUint32(4, 36 + samples, true);
  str(8, "WAVE");
  str(12, "fmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, rate, true);
  v.setUint32(28, rate, true);
  v.setUint16(32, 1, true);
  v.setUint16(34, 8, true);
  str(36, "data");
  v.setUint32(40, samples, true);

  for (let i = 0; i < samples; i++) {
    v.setUint8(44 + i, 128);
  }

  return URL.createObjectURL(
    new Blob([buf], { type: "audio/wav" })
  );
}

function unlockIosSession() {
  try {
    const nav = navigator as Navigator & {
      audioSession?: { type: string };
    };

    if (nav.audioSession) {
      nav.audioSession.type = "playback";
    }
  } catch {
    // Unsupported.
  }

  if (!silentEl) {
    silentEl = new Audio(silentWavUrl());
    silentEl.loop = true;
    silentEl.setAttribute("playsinline", "");
    silentEl.setAttribute("x-webkit-airplay", "deny");
  }

  void silentEl.play().catch(() => {
    // Unsupported or blocked.
  });
}

const TITLES: Record<NoiseType, string> = {
  white: "White Noise",
  lullaby: "Gentle Lullaby",
  pink: "Pink Noise",
  brown: "Brown Noise",
  vacuum: "Vacuum Cleaner",
  dryer: "Hair Dryer",
  ocean: "Ocean Waves",
  rain: "Soft Rain",
};

let lastTrack: NoiseType | null = null;

function updateMediaSession() {
  if (
    typeof navigator === "undefined" ||
    !("mediaSession" in navigator)
  ) {
    return;
  }

  const ms = navigator.mediaSession;

  if (state.active) {
    lastTrack = state.active;

    ms.metadata = new MediaMetadata({
      title: TITLES[state.active],
      artist: "Nursery Sounds",
      album: "Nestling",
      artwork: [
        {
          src: "/icon-192.png",
          sizes: "192x192",
          type: "image/png",
        },
        {
          src: "/icon-512.png",
          sizes: "512x512",
          type: "image/png",
        },
      ],
    });
  }

  ms.playbackState = state.active ? "playing" : "paused";

  try {
    ms.setActionHandler("play", () => {
      if (lastTrack) void play(lastTrack);
    });

    ms.setActionHandler("pause", () => stop());
    ms.setActionHandler("stop", () => stop());
  } catch {
    // Unsupported action.
  }
}

export async function play(type: NoiseType) {
  const thisRequest = ++requestId;

  if (isNativeAndroidAudio()) {
    clearTimers();
    stopSource();
    set({ active: null, endsAt: null, fading: false });
    try {
      await enqueueNative(async () => {
        if (thisRequest !== requestId) return;
        await setNativeSoundVolume(state.volume);
        if (thisRequest !== requestId) return;
        await setNativeSleepTimer(state.minutes);
        if (thisRequest !== requestId) return;
        await playNativeSound(type);
      });
      if (thisRequest !== requestId) return;
      set({ active: type });
      void syncNativeStatus();
    } catch (error) {
      if (thisRequest !== requestId) return;
      console.error("Nestling native playback failed:", error);
      set({ active: null, endsAt: null, fading: false });
    }
    return;
  }

  clearTimers();
  stopSource();

  set({
    active: null,
    endsAt: null,
    fading: false,
  });

  // Start the audio session within the user gesture.
  unlockIosSession();

  try {
    ctx ??= new AudioContext();

    const audioContext = ctx;

    const resuming =
      audioContext.state !== "running"
        ? audioContext.resume()
        : null;

    if (!master) {
      master = audioContext.createGain();
      master.gain.value = state.volume;
      master.connect(audioContext.destination);
    }

    if (resuming) await resuming;

    const buffer = await getBuffer(audioContext, type);

    // Ignore an old load if the user changed sounds or stopped.
    if (thisRequest !== requestId) return;

    const now = audioContext.currentTime;

    master.gain.cancelScheduledValues(now);
    master.gain.setValueAtTime(0.0001, now);
    master.gain.linearRampToValueAtTime(
      state.volume,
      now + 0.4
    );

    const nextSource = audioContext.createBufferSource();

    nextSource.buffer = buffer;
    nextSource.loop = true;
    nextSource.connect(master);
    nextSource.start();

    source = nextSource;

    set({ active: type });
    scheduleTimer();
    updateMediaSession();
  } catch (error) {
    if (thisRequest !== requestId) return;

    console.error("Nestling sound playback failed:", error);

    clearTimers();
    stopSource();
    silentEl?.pause();

    set({
      active: null,
      endsAt: null,
      fading: false,
    });

    updateMediaSession();
  }
}

export function stop() {
  ++requestId;
  if (isNativeAndroidAudio()) {
    clearTimers();
    set({ active: null, endsAt: null, fading: false });
    void enqueueNative(stopNativeSound);
    return;
  }

  clearTimers();
  stopSource();
  silentEl?.pause();

  if (master && ctx) {
    const now = ctx.currentTime;

    master.gain.cancelScheduledValues(now);
    master.gain.setValueAtTime(state.volume, now);
  }

  set({
    active: null,
    endsAt: null,
    fading: false,
  });

  updateMediaSession();
}

export function toggle(type: NoiseType) {
  return state.active === type ? stop() : play(type);
}

export function setVolume(v: number) {
  v = Math.max(0, Math.min(1, v));
  set({ volume: v });
  if (isNativeAndroidAudio()) {
    void enqueueNative(() => setNativeSoundVolume(v));
    return;
  }

  if (master && ctx && !state.fading) {
    master.gain.setTargetAtTime(
      v,
      ctx.currentTime,
      0.05
    );
  }
}

export function setMinutes(m: number) {
  if (![0, 15, 30, 60].includes(m)) return;
  set({ minutes: m });
  if (isNativeAndroidAudio()) {
    void enqueueNative(() => setNativeSleepTimer(m)).then(() => {
      void syncNativeStatus();
    });
    return;
  }

  if (state.active) {
    if (state.fading && master && ctx) {
      master.gain.setTargetAtTime(
        state.volume,
        ctx.currentTime,
        0.1
      );
    }

    scheduleTimer();
  }
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export function useSoundEngine() {
  useEffect(() => {
    if (!isNativeAndroidAudio()) return;
    const refresh = () => {
      if (document.visibilityState === "visible") {
        void syncNativeStatus().catch((error) => {
          console.error("Nestling audio status refresh failed:", error);
        });
      }
    };
    refresh();
    const interval = window.setInterval(refresh, 1000);
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("focus", refresh);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, []);
  return useSyncExternalStore(
    subscribe,
    () => state,
    () => state
  );
}
