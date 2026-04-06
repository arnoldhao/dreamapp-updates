#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { copyDirectory, ensureDir, writeJson, assert } from "./lib/helpers.mjs";
import { buildAppManifest } from "./lib/manifest.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const distDir = path.join(rootDir, "dist");
const appsDir = path.join(rootDir, "apps");
const schemaFile = path.join(rootDir, "schema", "manifest.schema.json");
const staticDir = path.join(rootDir, "static");

const options = parseArgs(process.argv.slice(2));
const publicBaseUrl = String(process.env.PUBLIC_BASE_URL || "https://updates.dreamapp.cc").replace(/\/+$/, "");
const githubToken = String(process.env.GITHUB_TOKEN || "");
const sourceRevision = String(process.env.GITHUB_SHA || "");
const runNumber = String(process.env.GITHUB_RUN_NUMBER || "1");

const appConfigs = await loadAppConfigs(appsDir, options.app);
assert(appConfigs.length > 0, "no app configs matched the requested filter");

await fs.rm(distDir, { recursive: true, force: true });
await ensureDir(distDir);
await copyDirectory(staticDir, distDir);

const generated = [];
for (const app of appConfigs) {
  const built = await buildAppManifest({
    appConfig: app.config,
    appName: app.name,
    publicBaseUrl,
    githubToken,
    sourceRevision,
    runNumber,
  });
  const manifestPath = path.join(distDir, built.path, "manifest.json");
  await writeJson(manifestPath, built.manifest);
  generated.push(built);
  console.log(`[dreamapp-updates] generated ${built.path}/manifest.json`);
}

await ensureDir(path.join(distDir, "schema"));
await fs.copyFile(schemaFile, path.join(distDir, "schema", "manifest.schema.json"));

await writeJson(path.join(distDir, "index.json"), {
  schemaVersion: 1,
  updatedAt: new Date().toISOString(),
  apps: generated.map((item) => ({
    appId: item.appId,
    path: item.path,
    manifestUrl: item.manifestUrl,
  })),
});

console.log(`[dreamapp-updates] wrote ${generated.length} manifest(s) to ${distDir}`);

function parseArgs(argv) {
  const options = {
    app: "",
  };

  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];
    switch (current) {
      case "--app":
        options.app = String(argv[index + 1] || "").trim();
        index += 1;
        break;
      default:
        throw new Error(`unknown argument: ${current}`);
    }
  }

  return options;
}

async function loadAppConfigs(directory, appFilter) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const candidates = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".config.mjs"))
    .sort((left, right) => left.name.localeCompare(right.name));

  const result = [];
  for (const candidate of candidates) {
    const appName = candidate.name.replace(/\.config\.mjs$/, "");
    if (appFilter && appFilter !== appName) {
      continue;
    }

    const filePath = path.join(directory, candidate.name);
    const module = await import(pathToFileURL(filePath).href);
    result.push({
      name: appName,
      config: module.default,
    });
  }
  return result;
}
