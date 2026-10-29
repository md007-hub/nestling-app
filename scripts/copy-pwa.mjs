
import { copyFile, readdir, access, readFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const sourceDir = path.join(root, "dist");
const outputDir = path.join(root, ".output", "public");
const serviceWorker = path.join(sourceDir, "sw.js");

await access(serviceWorker);
await access(outputDir);

const workerSource = await readFile(serviceWorker, "utf8");
const sourceFiles = await readdir(sourceDir);

const workboxFiles = sourceFiles.filter(
  (file) => /^workbox-.*\.js$/.test(file),
);

const referencedWorkbox = workboxFiles.find((file) =>
  workerSource.includes(file.replace(/\.js$/, "")),
);

if (!referencedWorkbox) {
  throw new Error("Could not find the Workbox file referenced by sw.js.");
}

await copyFile(
  path.join(sourceDir, referencedWorkbox),
  path.join(outputDir, referencedWorkbox),
);

await copyFile(
  serviceWorker,
  path.join(outputDir, "sw.js"),
);

console.log("PWA service worker copied successfully.");
console.log(`Workbox file: ${referencedWorkbox}`);
