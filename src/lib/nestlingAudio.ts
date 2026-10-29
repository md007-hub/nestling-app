import { Capacitor, registerPlugin } from "@capacitor/core";

export interface NativeAudioStatus {
  available: boolean;
  active: string | null;
  playing: boolean;
  fading: boolean;
  remainingMs: number;
  minutes: number;
}

interface NestlingAudioPlugin {
  startService(): Promise<{ available: boolean }>;
  playSound(options: { type: string }): Promise<void>;
  stopSound(): Promise<void>;
  setSoundVolume(options: { volume: number }): Promise<void>;
  setSleepTimer(options: { minutes: number }): Promise<void>;
  getStatus(): Promise<NativeAudioStatus>;
}

const NativeAudio = registerPlugin<NestlingAudioPlugin>("NestlingAudio");
export const isNativeAndroidAudio = () =>
  Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android";

export async function startNativeAudio(): Promise<boolean> {
  if (!isNativeAndroidAudio()) return false;
  try {
    await NativeAudio.startService();
    return true;
  } catch (error) {
    console.error("Failed to connect to Nestling native audio:", error);
    return false;
  }
}

export async function playNativeSound(type: string): Promise<void> {
  await NativeAudio.playSound({ type });
}
export async function stopNativeSound(): Promise<void> {
  await NativeAudio.stopSound();
}
export async function setNativeSoundVolume(volume: number): Promise<void> {
  await NativeAudio.setSoundVolume({ volume });
}
export async function setNativeSleepTimer(minutes: number): Promise<void> {
  await NativeAudio.setSleepTimer({ minutes });
}
export async function getNativeAudioStatus(): Promise<NativeAudioStatus> {
  return NativeAudio.getStatus();
}
