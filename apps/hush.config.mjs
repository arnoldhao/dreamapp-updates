import xiadownConfig from "./xiadown.config.mjs";

const hushSource = {
  provider: "github-release",
  owner: "arnoldhao",
  repo: "hush",
  versionPrefixes: ["v"],
};

export default {
  path: "hush",
  appId: "com.dreamapp.hush",
  defaultChannel: "stable",
  defaults: xiadownConfig.defaults,
  channels: {
    stable: {
      app: {
        source: hushSource,
        selector: {
          type: "latest",
          prerelease: false,
        },
        notes: {
          from: "release-body",
          maxLength: 800,
        },
        downloadAliases: [
          {
            route: "downloads/hush-macos-arm64-latest.zip",
            asset: {
              name: "hush-macos-universal-{version}.zip",
            },
            sourceName: "gh-proxy",
          },
          {
            route: "downloads/hush-macos-x64-latest.zip",
            asset: {
              name: "hush-macos-universal-{version}.zip",
            },
            sourceName: "gh-proxy",
          },
          {
            route: "downloads/hush-macos-universal-latest.zip",
            asset: {
              name: "hush-macos-universal-{version}.zip",
            },
            sourceName: "gh-proxy",
          },
          {
            route: "downloads/hush-macos-universal-latest.dmg",
            asset: {
              name: "hush-macos-universal-{version}.dmg",
            },
            sourceName: "gh-proxy",
          },
          {
            route: "downloads/hush-windows-x64-latest-installer.exe",
            asset: {
              name: "hush-windows-x64-{version}-setup.exe",
            },
            sourceName: "gh-proxy",
          },
          {
            route: "downloads/hush-windows-x64-latest-setup.exe",
            asset: {
              name: "hush-windows-x64-{version}-setup.exe",
            },
            sourceName: "gh-proxy",
          },
        ],
        platforms: {
          "darwin-arm64": {
            asset: {
              name: "hush-macos-universal-{version}.zip",
            },
            install: {
              strategy: "archive",
              artifactType: "zip",
            },
          },
          "darwin-amd64": {
            asset: {
              name: "hush-macos-universal-{version}.zip",
            },
            install: {
              strategy: "archive",
              artifactType: "zip",
            },
          },
          "windows-amd64": {
            asset: {
              name: "hush-windows-x64-{version}-setup.exe",
            },
            install: {
              strategy: "app-installer",
              artifactType: "exe",
            },
          },
        },
      },
      dreamFm: xiadownConfig.channels.stable.dreamFm,
    },
  },
};
