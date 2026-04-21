#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { copyDirectory, ensureDir, writeJson, assert } from "./lib/helpers.mjs";
import { GitHubClient, isReleaseIncompleteError } from "./lib/github.mjs";
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
const previousBuilds = await loadExistingBuilds(distDir, appConfigs, publicBaseUrl);
const githubClient = new GitHubClient({ token: githubToken });

await fs.rm(distDir, { recursive: true, force: true });
await ensureDir(distDir);
await copyDirectory(staticDir, distDir);

const generated = [];
for (const app of appConfigs) {
  let built;
  const previous = previousBuilds.get(app.name);
  try {
    built = await buildAppManifest({
      appConfig: app.config,
      appName: app.name,
      publicBaseUrl,
      githubToken,
      sourceRevision,
      runNumber,
      client: githubClient,
    });
  } catch (error) {
    if (!isReleaseIncompleteError(error) || !previous) {
      throw error;
    }

    built = previous;
    console.warn(
      `[dreamapp-updates] reuse previous ${built.path}/manifest.json because the latest release is incomplete: ${error.message}`,
    );
  }

  if (built.redirectsIncomplete) {
    const warningSuffix =
      built.redirectWarnings?.length > 0 ? `: ${built.redirectWarnings.join("; ")}` : "";
    if (previous?.redirects?.length) {
      built = {
        ...built,
        redirects: previous.redirects,
        redirectsIncomplete: false,
      };
      console.warn(
        `[dreamapp-updates] reuse previous ${built.path} download redirects because the latest release aliases are incomplete${warningSuffix}`,
      );
    } else {
      built = {
        ...built,
        redirects: [],
        redirectsIncomplete: false,
      };
      console.warn(
        `[dreamapp-updates] skip updating ${built.path} download redirects because the latest release aliases are incomplete${warningSuffix}`,
      );
    }
  }

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

const staticRedirects = await loadRedirects(path.join(distDir, "_redirects"));
const generatedRedirects = generated.flatMap((item) => item.redirects ?? []);
await writeRedirects(path.join(distDir, "_redirects"), [...staticRedirects, ...generatedRedirects]);

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

async function loadExistingBuilds(directory, appConfigs, publicBaseUrl) {
  const result = new Map();
  const redirects = await loadRedirects(path.join(directory, "_redirects"));

  for (const app of appConfigs) {
    const manifestPath = path.join(directory, app.config.path, "manifest.json");
    let manifest;
    try {
      manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
    } catch (error) {
      if (error && error.code === "ENOENT") {
        continue;
      }
      throw error;
    }

    result.set(app.name, {
      appId: app.config.appId,
      path: app.config.path,
      manifest,
      manifestUrl: `${publicBaseUrl}/${app.config.path}/manifest.json`,
      redirects: redirects.filter((entry) => entry.from.startsWith(`/${app.config.path}/`)),
    });
  }

  return result;
}

async function loadRedirects(filePath) {
  try {
    const content = await fs.readFile(filePath, "utf8");
    return content
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#"))
      .map(parseRedirectLine);
  } catch (error) {
    if (error && error.code === "ENOENT") {
      return [];
    }
    throw error;
  }
}

async function writeRedirects(filePath, redirects) {
  if (!redirects.length) {
    return;
  }

  const deduped = new Map();
  for (const redirect of redirects) {
    validateRedirect(redirect);
    const existing = deduped.get(redirect.from);
    if (existing && (existing.to !== redirect.to || existing.status !== redirect.status)) {
      throw new Error(`duplicate redirect with different target: ${redirect.from}`);
    }
    deduped.set(redirect.from, redirect);
  }

  const content = [...deduped.values()]
    .sort((left, right) => left.from.localeCompare(right.from))
    .map((redirect) => `${redirect.from} ${redirect.to} ${redirect.status}`)
    .join("\n");

  await fs.writeFile(filePath, `${content}\n`, "utf8");
}

function parseRedirectLine(line) {
  const [from = "", to = "", status = "302"] = line.split(/\s+/);
  return {
    from,
    to,
    status: Number(status),
  };
}

function validateRedirect(redirect) {
  assert(String(redirect?.from || "").startsWith("/"), `redirect source must start with /: ${redirect?.from || ""}`);
  assert(String(redirect?.to || "").length > 0, `redirect target is required for ${redirect?.from || ""}`);
  assert([301, 302, 307, 308].includes(Number(redirect?.status)), `redirect status is invalid for ${redirect?.from || ""}`);
}
