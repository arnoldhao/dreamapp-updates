import assert from "node:assert/strict";
import test from "node:test";

import dreamcreatorConfig from "../../apps/dreamcreator.config.mjs";
import xiadownConfig from "../../apps/xiadown.config.mjs";
import { buildAppManifest } from "./manifest.mjs";

const previousVersion = "2026.07.21";
const latestVersion = "2026.09.08";
const latestFFmpegVersion = "8.0.1-1";
const macSHA256 = "a".repeat(64);
const windowsSHA256 = "b".repeat(64);
const ffmpegArtifacts = [
  ["darwin-arm64", "macarm64-gpl.tar.xz", "c".repeat(64)],
  ["darwin-amd64", "mac64-gpl.tar.xz", "d".repeat(64)],
  ["windows-amd64", "win64-clang-gpl.zip", "e".repeat(64)],
];

test("XiaDown enables latest stable FFmpeg without changing shared configuration or the Bun pin", () => {
  const tools = xiadownConfig.channels.stable.tools;
  assert.equal(tools["yt-dlp"].autoUpdate, true);
  assert.equal(tools.ffmpeg.autoUpdate, true);
  for (const tool of [tools["yt-dlp"], tools.ffmpeg]) {
    assert.deepEqual(tool.upstream.selector, { type: "latest", prerelease: false });
    assert.deepEqual(tool.recommended.selector, { type: "latest", prerelease: false });
  }
  assert.equal(tools.bun.autoUpdate, false);
  assert.deepEqual(tools.bun.upstream.selector, { type: "tag", tag: "bun-v1.3.14" });
  assert.deepEqual(tools.bun.recommended.selector, { type: "tag", tag: "bun-v1.3.14" });
  assert.equal(dreamcreatorConfig.channels.stable.tools.ffmpeg.autoUpdate, false);
  assert.deepEqual(dreamcreatorConfig.channels.stable.tools.ffmpeg.recommended.selector, {
    type: "tag", tag: "v7.1.3-5",
  });
});

test("tools-only refresh selects the latest stable yt-dlp and FFmpeg while preserving published app data", async () => {
  const previousBuild = makePreviousBuild();
  const appConfig = structuredClone(xiadownConfig);
  // A newly configured channel must wait for an explicit app publication.
  appConfig.channels.preview = structuredClone(appConfig.channels.stable);
  const originalBuild = structuredClone(previousBuild);
  const originalConfig = structuredClone(appConfig);
  deepFreeze(previousBuild);
  deepFreeze(appConfig);
  const requests = [];
  const ytDlpReleases = [
    makeRelease("2026.09.10", { draft: true }),
    makeRelease("2026.09.09", { prerelease: true }),
    makeRelease(latestVersion),
    makeRelease(previousVersion),
  ];
  const ffmpegReleases = [
    makeFFmpegRelease("8.1.0-1", { draft: true }),
    makeFFmpegRelease("8.1.0-0", { prerelease: true }),
    makeFFmpegRelease(latestFFmpegVersion),
    makeFFmpegRelease("7.1.3-5"),
  ];

  const built = await refresh({
    previousBuild,
    appConfig,
    client: toolReleaseClient({ "yt-dlp": ytDlpReleases, ffmpeg: ffmpegReleases }, requests),
  });

  assert.deepEqual([...new Set(requests)].sort(), ["jellyfin/jellyfin-ffmpeg", "yt-dlp/yt-dlp"], "must query both automatic tools and never query XiaDown or Bun releases");
  const tool = built.manifest.channels.stable.tools["yt-dlp"];
  assert.equal(tool.upstreamVersion, latestVersion);
  assert.equal(tool.recommendedVersion, latestVersion);
  assert.equal(tool.releasePage, `https://github.com/yt-dlp/yt-dlp/releases/tag/${latestVersion}`);
  assert.equal(tool.autoUpdate, true);
  assert.deepEqual(Object.keys(tool.platforms).sort(), ["darwin-amd64", "darwin-arm64", "windows-amd64"]);

  for (const [platform, name, digest] of [
    ["darwin-arm64", "yt-dlp_macos", macSHA256],
    ["darwin-amd64", "yt-dlp_macos", macSHA256],
    ["windows-amd64", "yt-dlp.exe", windowsSHA256],
  ]) {
    const artifact = tool.platforms[platform];
    const originUrl = `https://github.com/yt-dlp/yt-dlp/releases/download/${latestVersion}/${name}`;
    assert.equal(artifact.artifactName, name);
    assert.equal(artifact.sha256, digest);
    assert.equal(artifact.installStrategy, "binary");
    assert.equal(artifact.artifactType, "raw-binary");
    assert.deepEqual(artifact.sources.map(({ name: sourceName, url }) => ({ name: sourceName, url })), [
      { name: "gh-proxy", url: `https://gh-proxy.com/${originUrl}` },
      { name: "github", url: originUrl },
    ]);
  }

  const ffmpeg = built.manifest.channels.stable.tools.ffmpeg;
  assert.equal(originalBuild.manifest.channels.stable.tools.ffmpeg.autoUpdate, false);
  assert.equal(ffmpeg.autoUpdate, true, "configuration must enable upgrading previously manual FFmpeg entries");
  assert.equal(ffmpeg.upstreamVersion, latestFFmpegVersion);
  assert.equal(ffmpeg.recommendedVersion, latestFFmpegVersion);
  assert.equal(ffmpeg.releasePage, `https://github.com/jellyfin/jellyfin-ffmpeg/releases/tag/v${latestFFmpegVersion}`);
  assert.deepEqual(Object.keys(ffmpeg.platforms).sort(), ["darwin-amd64", "darwin-arm64", "windows-amd64"]);
  for (const [platform, suffix, digest] of ffmpegArtifacts) {
    const artifact = ffmpeg.platforms[platform];
    const name = `jellyfin-ffmpeg_${latestFFmpegVersion}_portable_${suffix}`;
    const originUrl = `https://github.com/jellyfin/jellyfin-ffmpeg/releases/download/v${latestFFmpegVersion}/${name}`;
    assert.equal(artifact.artifactName, name);
    assert.equal(artifact.sha256, digest);
    assert.equal(artifact.installStrategy, "archive");
    assert.equal(artifact.artifactType, platform === "windows-amd64" ? "zip" : "tar.xz");
    assert.deepEqual(artifact.binaries, platform === "windows-amd64" ? ["ffmpeg.exe", "ffprobe.exe"] : ["ffmpeg", "ffprobe"]);
    assert.deepEqual(artifact.sources.map(({ name: sourceName, url }) => ({ name: sourceName, url })), [
      { name: "gh-proxy", url: `https://gh-proxy.com/${originUrl}` },
      { name: "github", url: originUrl },
    ]);
  }
  assert.deepEqual(built.manifest.channels.stable.tools.bun, originalBuild.manifest.channels.stable.tools.bun);

  // Comparing the complete channel catches loss of variants and future metadata.
  const preservedStable = structuredClone(built.manifest.channels.stable);
  preservedStable.tools["yt-dlp"] = originalBuild.manifest.channels.stable.tools["yt-dlp"];
  preservedStable.tools.ffmpeg = originalBuild.manifest.channels.stable.tools.ffmpeg;
  assert.deepEqual(preservedStable, originalBuild.manifest.channels.stable);
  assert.deepEqual(built.manifest.channels.legacy, originalBuild.manifest.channels.legacy);
  assert.equal(built.manifest.channels.preview, undefined);
  assert.deepEqual(built.redirects, originalBuild.redirects);
  assert.deepEqual(built.files, originalBuild.files);
  assert.deepEqual(previousBuild, originalBuild, "refresh must not mutate the published build");
  assert.deepEqual(appConfig, originalConfig, "refresh must not mutate configuration");
  assert.notEqual(built.manifest.manifestVersion, previousBuild.manifest.manifestVersion);
  assert.notEqual(built.manifest.updatedAt, previousBuild.manifest.updatedAt);
});

test("tools-only refresh requires a previous published manifest before querying releases", async () => {
  let queried = false;
  await assert.rejects(refresh({
    previousBuild: undefined,
    client: { async listReleases() { queried = true; throw new Error("unexpected query"); } },
  }), /previous|existing|published|manifest/i);
  assert.equal(queried, false);
});

test("tools-only refresh rejects a manifest belonging to another app", async () => {
  const previousBuild = makePreviousBuild();
  previousBuild.appId = "cc.dreamapp.other";
  previousBuild.manifest.appId = "cc.dreamapp.other";
  let queried = false;
  await assert.rejects(refresh({
    previousBuild,
    client: { async listReleases() { queried = true; throw new Error("unexpected query"); } },
  }), /appId|app.id|mismatch|match/i);
  assert.equal(queried, false);
});

for (const incompleteTool of ["yt-dlp", "ffmpeg"]) {
  for (const incompleteAsset of ["missing file", "missing digest"]) {
    test(`tools-only refresh retains ${incompleteTool} with a ${incompleteAsset} while updating the other automatic tool`, async () => {
      const previousBuild = makePreviousBuild();
      const originalBuild = structuredClone(previousBuild);
      const release = incompleteTool === "yt-dlp" ? makeRelease(latestVersion) : makeFFmpegRelease(latestFFmpegVersion);
      if (incompleteAsset === "missing file") {
        release.assets.pop();
      } else {
        delete release.assets.at(-1).digest;
      }

      const built = await refresh({ previousBuild, client: toolReleaseClient({ [incompleteTool]: [release] }) });

      const otherTool = incompleteTool === "yt-dlp" ? "ffmpeg" : "yt-dlp";
      const expectedVersion = otherTool === "yt-dlp" ? latestVersion : latestFFmpegVersion;
      assert.equal(built.manifest.channels.stable.tools[otherTool].recommendedVersion, expectedVersion);
      const preservedChannels = structuredClone(built.manifest.channels);
      preservedChannels.stable.tools[otherTool] = originalBuild.manifest.channels.stable.tools[otherTool];
      assert.deepEqual(preservedChannels, originalBuild.manifest.channels);
      assert.deepEqual(built.redirects, originalBuild.redirects);
      assert.deepEqual(built.files, originalBuild.files);
      assert.deepEqual(previousBuild, originalBuild);
    });
  }
}

test("tools-only refresh does not hide an incomplete release when no previous tool exists", async () => {
  const previousBuild = makePreviousBuild();
  delete previousBuild.manifest.channels.stable.tools["yt-dlp"];
  const release = makeRelease(latestVersion);
  release.assets = [];

  await assert.rejects(
    refresh({ previousBuild, client: toolReleaseClient({ "yt-dlp": [release] }) }),
    (error) => error.code === "ERR_RELEASE_INCOMPLETE" || error.cause?.code === "ERR_RELEASE_INCOMPLETE",
  );
});

test("tools-only refresh propagates network errors even when a previous tool exists", async () => {
  const networkError = new Error("GitHub request failed (503): upstream unavailable");
  const previousBuild = makePreviousBuild();
  const originalBuild = structuredClone(previousBuild);

  await assert.rejects(refresh({
    previousBuild,
    client: { async listReleases() { throw networkError; } },
  }), (error) => error === networkError || error.cause === networkError);
  assert.deepEqual(previousBuild, originalBuild);
});

function refresh({ previousBuild, appConfig = xiadownConfig, client }) {
  return buildAppManifest({
    appName: "xiadown",
    appConfig,
    publicBaseUrl: "https://updates.example.test",
    sourceRevision: "tool-refresh-test",
    runNumber: "42",
    toolsOnly: true,
    previousBuild,
    client,
  });
}

function toolReleaseClient(releases = {}, requests = []) {
  const bySource = {
    "yt-dlp/yt-dlp": releases["yt-dlp"] ?? [makeRelease(latestVersion)],
    "jellyfin/jellyfin-ffmpeg": releases.ffmpeg ?? [makeFFmpegRelease(latestFFmpegVersion)],
  };
  return {
    async listReleases({ owner, repo }) {
      requests.push(`${owner}/${repo}`);
      assert.ok(Object.hasOwn(bySource, `${owner}/${repo}`), "tools-only refresh must not resolve app or pinned tool releases");
      return bySource[`${owner}/${repo}`];
    },
  };
}

function makeFFmpegRelease(version, overrides = {}) {
  return {
    tag_name: `v${version}`,
    name: `v${version}`,
    draft: false,
    prerelease: false,
    published_at: "2026-09-08T00:00:00Z",
    html_url: `https://github.com/jellyfin/jellyfin-ffmpeg/releases/tag/v${version}`,
    body: `FFmpeg ${version}`,
    assets: ffmpegArtifacts.map(([, suffix, sha256]) => {
      const name = `jellyfin-ffmpeg_${version}_portable_${suffix}`;
      return {
        name,
        digest: `sha256:${sha256}`,
        size: 456,
        content_type: "application/octet-stream",
        browser_download_url: `https://github.com/jellyfin/jellyfin-ffmpeg/releases/download/v${version}/${name}`,
      };
    }),
    ...overrides,
  };
}

function makeRelease(version, overrides = {}) {
  return {
    tag_name: version,
    name: version,
    draft: false,
    prerelease: false,
    published_at: `${version.replaceAll(".", "-")}T00:00:00Z`,
    html_url: `https://github.com/yt-dlp/yt-dlp/releases/tag/${version}`,
    body: `yt-dlp ${version}`,
    assets: [
      ["yt-dlp_macos", macSHA256],
      ["yt-dlp.exe", windowsSHA256],
    ].map(([name, sha256]) => ({
      name,
      digest: `sha256:${sha256}`,
      size: 123,
      content_type: "application/octet-stream",
      browser_download_url: `https://github.com/yt-dlp/yt-dlp/releases/download/${version}/${name}`,
    })),
    ...overrides,
  };
}

function makePreviousBuild() {
  const app = {
    source: { provider: "github-release", owner: "arnoldhao", repo: "xiadown" },
    version: "1.0.0",
    publishedAt: "2026-07-22T00:00:00Z",
    notes: "Published and manually reviewed XiaDown release.",
    releasePage: "https://github.com/arnoldhao/xiadown/releases/tag/v1.0.0",
    platforms: {
      "darwin-arm64": artifact("xiadown-macos-arm64-1.0.0.zip", "1"),
      "darwin-amd64": artifact("xiadown-macos-x64-1.0.0.zip", "2"),
      "windows-amd64": {
        ...artifact("xiadown-windows-x64-1.0.0-installer.exe", "3"),
        installStrategy: "app-installer",
        artifactType: "exe",
        variants: {
          portable: {
            ...artifact("xiadown-windows-x64-1.0.0.zip", "4"),
            installStrategy: "archive",
            artifactType: "zip",
          },
        },
      },
    },
  };
  const stable = {
    app,
    tools: {
      "yt-dlp": previousTool("yt-dlp", previousVersion, true),
      ffmpeg: previousTool("ffmpeg", "7.1.3-5", false),
      bun: previousTool("bun", "1.3.14", false),
    },
    listen: { liveChannel: { version: "published-listen", url: "https://updates.example.test/listen.json" } },
    dreamFm: { liveChannel: { version: "published-dream-fm", url: "https://updates.example.test/dream-fm.json" } },
    publicationMetadata: { approvedBy: "release-manager", sequence: 3 },
  };
  return {
    appId: xiadownConfig.appId,
    path: "xiadown",
    manifestUrl: "https://updates.example.test/xiadown/manifest.json",
    manifest: {
      schemaVersion: 1,
      appId: xiadownConfig.appId,
      defaultChannel: "stable",
      manifestVersion: "2026.07.22.1",
      updatedAt: "2026-07-22T00:00:00.000Z",
      sourceRevision: "previous-app-publication",
      channels: {
        stable,
        // Existing channels absent from current config must stay published.
        legacy: { app: structuredClone(app), tools: {}, publicationMetadata: { preserved: true } },
      },
    },
    redirects: [{
      from: "/xiadown/downloads/xiadown-windows-x64-latest-installer.exe",
      to: "https://downloads.example.test/xiadown-1.0.0-installer.exe",
      status: 302,
    }],
    files: [{ path: "/xiadown/downloads/published-checksums.txt", content: "published app checksums\n" }],
    redirectsIncomplete: false,
    redirectWarnings: [],
  };
}

function previousTool(name, version, autoUpdate) {
  return {
    displayName: name,
    kind: "external-tool",
    upstreamVersion: version,
    recommendedVersion: version,
    autoUpdate,
    required: true,
    notes: "Previously published tool metadata.",
    platforms: { "windows-amd64": artifact(`${name}-previous.exe`, "5") },
  };
}

function artifact(artifactName, digestCharacter) {
  return {
    artifactName,
    sha256: digestCharacter.repeat(64),
    size: 100,
    contentType: "application/octet-stream",
    sources: [{
      name: "published-origin",
      kind: "origin",
      priority: 1,
      enabled: true,
      url: `https://downloads.example.test/${artifactName}`,
    }],
  };
}

function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value).forEach(deepFreeze);
  }
  return value;
}
