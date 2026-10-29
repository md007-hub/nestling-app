
import { cpSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { join } from "node:path";

const source = join("public", "sounds");
const destination = join("dist", "sounds");

if (!existsSync(source)) {
  throw new Error("Missing public/sounds folder");
}

mkdirSync(destination, { recursive: true });

const files = [
  "nestling-rain-loop.mp3",
  "nestling-lullaby-loop.mp3",
  "nestling-vacuum-loop.mp3",
];

for (const file of files) {
  const from = join(source, file);
  const to = join(destination, file);

  if (!existsSync(from)) {
    throw new Error(`Missing sound file: ${from}`);
  }

  cpSync(from, to);
  console.log(`Copied: ${file}`);
}

console.log("Nestling sounds copied successfully.");
