import assert from "node:assert/strict";
import test from "node:test";

import xiadownConfig from "../../apps/xiadown.config.mjs";
import { buildAppManifest } from "./manifest.mjs";

const installerSHA256 = "1".repeat(64);
const portableSHA256 = "2".repeat(64);

test("XiaDown Windows manifest keeps installer and portable hashes with their assets", async () => {
  const release = {
    tag_name: "v1.0.0",
    name: "v1.0.0",
    draft: false,
    prerelease: false,
    published_at: "2026-07-22T00:00:00Z",
    html_url: "https://github.com/arnoldhao/xiadown/releases/tag/v1.0.0",
    body: "XiaDown 1.0",
    assets: [
      releaseAsset("xiadown-windows-x64-1.0.0-installer.exe", installerSHA256, "application/octet-stream", 200),
      releaseAsset("xiadown-windows-x64-1.0.0.zip", portableSHA256, "application/zip", 100),
      releaseAsset("xiadown-macos-arm64-1.0.0.zip", "3".repeat(64), "application/zip", 100),
      releaseAsset("xiadown-macos-x64-1.0.0.zip", "4".repeat(64), "application/zip", 100),
      releaseAsset("xiadown-macos-arm64-1.0.0.dmg", "5".repeat(64), "application/octet-stream", 100),
      releaseAsset("xiadown-macos-x64-1.0.0.dmg", "6".repeat(64), "application/octet-stream", 100),
    ],
  };
  const client = {
    async listReleases({ repo }) {
      if (repo === "xiadown") {
        return [release];
      }
      return [];
    },
  };

  const built = await buildAppManifest({
    appConfig: {
      ...xiadownConfig,
      channels: {
        stable: {
          ...xiadownConfig.channels.stable,
          tools: {},
          listen: {},
        },
      },
    },
    appName: "xiadown",
    publicBaseUrl: "https://updates.example.test",
    githubToken: "",
    sourceRevision: "test",
    runNumber: "1",
    client,
  });

  const installer = built.manifest.channels.stable.app.platforms["windows-amd64"];
  const portable = installer.variants.portable;
  assert.equal(installer.artifactName, "xiadown-windows-x64-1.0.0-installer.exe");
  assert.equal(installer.sha256, installerSHA256);
  assert.equal(installer.artifactType, "exe");
  assert.equal(installer.installStrategy, "app-installer");
  assert.match(
    installer.sources[0].url,
    /xiadown-windows-x64-1\.0\.0-installer\.exe$/,
  );
  assert.equal(portable.artifactName, "xiadown-windows-x64-1.0.0.zip");
  assert.equal(portable.sha256, portableSHA256);
  assert.equal(portable.artifactType, "zip");
  assert.equal(portable.installStrategy, "archive");
  assert.match(portable.sources[0].url, /xiadown-windows-x64-1\.0\.0\.zip$/);
  assert.notEqual(installer.sha256, portable.sha256);
  assert.notEqual(installer.sources[0].url, portable.sources[0].url);
});

function releaseAsset(name, sha256, contentType, size) {
  return {
    name,
    digest: `sha256:${sha256}`,
    content_type: contentType,
    size,
    browser_download_url: `https://github.com/arnoldhao/xiadown/releases/download/v1.0.0/${name}`,
  };
}
