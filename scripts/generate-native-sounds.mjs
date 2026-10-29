
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const RATE = 44100;
const SECONDS = 8;
const FRAMES = RATE * SECONDS;
const TYPES = ["white", "pink", "brown", "dryer", "ocean"];
const OUTPUT = join("android", "app", "src", "main", "assets", "sounds");

mkdirSync(OUTPUT, { recursive: true });

function generateChannel(type) {
  const data = new Float32Array(FRAMES);

  let b0 = 0, b1 = 0, b2 = 0, b3 = 0;
  let b4 = 0, b5 = 0, b6 = 0;
  let last = 0, smooth = 0;

  for (let i = 0; i < FRAMES; i++) {
    const w = Math.random() * 2 - 1;
    const t = i / RATE;

    smooth = smooth * 0.985 + w * 0.015;

    if (type === "white") {
      data[i] = w * 0.35;
    } else if (type === "dryer") {
      b0 = b0 * 0.6 + w * 0.4;
      data[i] =
        (b0 - smooth) * 0.45 +
        Math.sin(2 * Math.PI * 120 * t) * 0.02;
    } else if (type === "ocean") {
      const swell = Math.pow(
        0.5 - 0.5 * Math.cos((2 * Math.PI * t) / 8),
        2
      );
      b1 = b1 * 0.995 + w * 0.005;
      data[i] =
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

      data[i] =
        (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.1;

      b6 = w * 0.115926;
    } else {
      last = (last + 0.02 * w) / 1.02;
      data[i] = last * 3.2;
    }
  }

  const xf = Math.floor(RATE * 0.05);

  for (let i = 0; i < xf; i++) {
    const t = i / xf;
    data[i] =
      data[i] * t +
      data[FRAMES - xf + i] * (1 - t);
  }

  return data;
}

function createWav(type) {
  const left = generateChannel(type);
  const right = generateChannel(type);

  const channels = 2;
  const bytesPerSample = 2;
  const dataSize = FRAMES * channels * bytesPerSample;
  const buffer = Buffer.alloc(44 + dataSize);

  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write("WAVE", 8);
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(channels, 22);
  buffer.writeUInt32LE(RATE, 24);
  buffer.writeUInt32LE(RATE * channels * bytesPerSample, 28);
  buffer.writeUInt16LE(channels * bytesPerSample, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(dataSize, 40);

  for (let i = 0; i < FRAMES; i++) {
    for (let ch = 0; ch < channels; ch++) {
      const value = ch === 0 ? left[i] : right[i];
      const sample = Math.max(-1, Math.min(1, value));
      const pcm = sample < 0
        ? Math.round(sample * 32768)
        : Math.round(sample * 32767);

      buffer.writeInt16LE(pcm, 44 + (i * channels + ch) * 2);
    }
  }

  const file = join(OUTPUT, `nestling-${type}-loop.wav`);
  writeFileSync(file, buffer);
  console.log(`Generated: ${file}`);
}

for (const type of TYPES) {
  createWav(type);
}

console.log("All five native sounds generated successfully.");
