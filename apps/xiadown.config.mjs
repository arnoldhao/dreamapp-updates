import dreamcreatorConfig from "./dreamcreator.config.mjs";

const xiadownSource = {
  provider: "github-release",
  owner: "arnoldhao",
  repo: "xiadown",
  versionPrefixes: ["v"],
};

const dreamFmLiveChannel = {
  schemaVersion: 1,
  url: "https://updates.dreamapp.cc/xiadown/dream.fm/live/2026.06.23.1/channel.json",
  version: "2026.06.23.1",
  updatedAt: "2026-06-23T08:19:25.000Z",
  minAppVersion: "0.0.1",
  ttlSeconds: 300,
  fallback: "embedded",
};

export default {
  path: "xiadown",
  appId: "cc.dreamapp.xiadown",
  defaultChannel: "stable",
  defaults: dreamcreatorConfig.defaults,
  channels: {
    stable: {
      app: {
        source: xiadownSource,
        selector: {
          type: "latest",
          prerelease: false,
        },
        notes: {
          from: "release-body",
          maxLength: 5000,
        },
        downloadAliases: [
          {
            route: "downloads/xiadown-macos-arm64-{version}.dmg",
            asset: {
              name: "xiadown-macos-arm64-{version}.dmg",
            },
            sourceName: "gh-proxy",
          },
          {
            route: "downloads/xiadown-macos-x64-{version}.dmg",
            asset: {
              name: "xiadown-macos-x64-{version}.dmg",
            },
            sourceName: "gh-proxy",
          },
          {
            route: "downloads/xiadown-macos-arm64-latest.zip",
            asset: {
              name: "xiadown-macos-arm64-{version}.zip",
            },
            sourceName: "gh-proxy",
          },
          {
            route: "downloads/xiadown-macos-arm64-latest.dmg",
            asset: {
              name: "xiadown-macos-arm64-{version}.dmg",
            },
            sourceName: "gh-proxy",
          },
          {
            route: "downloads/xiadown-macos-x64-latest.zip",
            asset: {
              name: "xiadown-macos-x64-{version}.zip",
            },
            sourceName: "gh-proxy",
          },
          {
            route: "downloads/xiadown-macos-x64-latest.dmg",
            asset: {
              name: "xiadown-macos-x64-{version}.dmg",
            },
            sourceName: "gh-proxy",
          },
          {
            route: "downloads/xiadown-windows-x64-latest-installer.exe",
            asset: {
              name: "xiadown-windows-x64-{version}-installer.exe",
            },
            sourceName: "gh-proxy",
          },
          {
            route: "downloads/xiadown-windows-x64-latest.zip",
            asset: {
              name: "xiadown-windows-x64-{version}.zip",
            },
            sourceName: "gh-proxy",
          },
        ],
        platforms: {
          "darwin-arm64": {
            asset: {
              name: "xiadown-macos-arm64-{version}.zip",
            },
            install: {
              strategy: "archive",
              artifactType: "zip",
            },
          },
          "darwin-amd64": {
            asset: {
              name: "xiadown-macos-x64-{version}.zip",
            },
            install: {
              strategy: "archive",
              artifactType: "zip",
            },
          },
          "windows-amd64": {
            asset: {
              name: "xiadown-windows-x64-{version}-installer.exe",
            },
            install: {
              strategy: "app-installer",
              artifactType: "exe",
            },
            variants: {
              portable: {
                asset: {
                  name: "xiadown-windows-x64-{version}.zip",
                },
                install: {
                  strategy: "archive",
                  artifactType: "zip",
                },
              },
            },
          },
        },
      },
      tools: dreamcreatorConfig.channels.stable.tools,
      listen: {
        liveChannel: dreamFmLiveChannel,
      },
    },
  },
};
