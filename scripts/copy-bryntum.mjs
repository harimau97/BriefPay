import { copyFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = path.join(root, "node_modules/@bryntum/scheduler");
const dest = path.join(root, "public/bryntum");

const files = [
  ["scheduler.umd.js", "scheduler.umd.js"],
  ["scheduler.css", "scheduler.css"],
  ["stockholm-light.css", "stockholm-light.css"],
  ["locales/scheduler.locale.Ko.js", "scheduler.locale.Ko.js"],
];

await mkdir(dest, { recursive: true });
for (const [from, to] of files) {
  await copyFile(path.join(source, from), path.join(dest, to));
}
console.log("Copied Bryntum trial assets to public/bryntum");
