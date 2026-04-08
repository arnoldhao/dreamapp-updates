import fs from "node:fs/promises";
import path from "node:path";

const STRIPPED_RELEASE_NOTE_SECTIONS = [
  {
    startMarker: "dreamapp-release-header:start",
    endMarker: "dreamapp-release-header:end",
  },
];

export function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

export async function ensureDir(dirPath) {
  await fs.mkdir(dirPath, { recursive: true });
}

export async function copyDirectory(sourceDir, targetDir) {
  try {
    await fs.access(sourceDir);
  } catch {
    return;
  }
  await ensureDir(targetDir);
  await fs.cp(sourceDir, targetDir, { recursive: true });
}

export async function writeJson(filePath, value) {
  await ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export function formatManifestVersion(updatedAt, runNumber) {
  const year = updatedAt.getUTCFullYear();
  const month = String(updatedAt.getUTCMonth() + 1).padStart(2, "0");
  const day = String(updatedAt.getUTCDate()).padStart(2, "0");
  const suffix = String(runNumber || "1").trim() || "1";
  return `${year}.${month}.${day}.${suffix}`;
}

export function normalizeVersion(tag, prefixes = ["v"]) {
  let normalized = String(tag || "").trim();
  const sortedPrefixes = [...prefixes].sort((left, right) => right.length - left.length);
  for (const prefix of sortedPrefixes) {
    if (normalized.toLowerCase().startsWith(String(prefix).toLowerCase())) {
      normalized = normalized.slice(String(prefix).length);
      break;
    }
  }
  return normalized.trim();
}

export function renderTemplate(template, values) {
  return String(template).replace(/\{(\w+)\}/g, (_, key) => {
    if (!(key in values)) {
      throw new Error(`missing template value: ${key}`);
    }
    return String(values[key]);
  });
}

export function summarizeText(text, maxLength = 600) {
  const normalized = sanitizeReleaseNotes(text);
  if (!normalized) {
    return "";
  }
  if (normalized.length <= maxLength) {
    return normalized;
  }
  const clipped = normalized.slice(0, Math.max(0, maxLength - 1)).trimEnd();
  return `${clipped}…`;
}

export function buildNotes(noteConfig, fallbackText) {
  if (typeof noteConfig === "string") {
    return noteConfig.trim();
  }
  if (noteConfig && typeof noteConfig === "object") {
    if (typeof noteConfig.value === "string") {
      return noteConfig.value.trim();
    }
    if (noteConfig.from === "release-body") {
      return summarizeText(fallbackText, noteConfig.maxLength ?? 600);
    }
  }
  return summarizeText(fallbackText, 600);
}

export function sanitizeReleaseNotes(text) {
  let normalized = String(text || "").replace(/\r\n?/g, "\n");

  for (const section of STRIPPED_RELEASE_NOTE_SECTIONS) {
    const start = escapeRegExp(section.startMarker);
    const end = escapeRegExp(section.endMarker);
    const pattern = new RegExp(`<!--\\s*${start}\\s*-->[\\s\\S]*?<!--\\s*${end}\\s*-->\\n*`, "gi");
    normalized = normalized.replace(pattern, "");
  }

  return normalized.replace(/\n{3,}/g, "\n\n").trim();
}

export function buildDownloadSources(templates, rawUrl) {
  return [...templates]
    .map((template) => ({
      name: template.name,
      kind: template.kind,
      url: renderTemplate(template.urlTemplate, { url: rawUrl }),
      priority: Number(template.priority ?? 0),
      enabled: template.enabled !== false,
    }))
    .sort((left, right) => left.priority - right.priority);
}

export function isHexSha256(value) {
  return /^[a-f0-9]{64}$/i.test(String(value || ""));
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
