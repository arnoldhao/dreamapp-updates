import dreamcreatorConfig from "./dreamcreator.config.mjs";

const dreamcreatorStableApp = dreamcreatorConfig.channels.stable.app;

const xiadownSource = {
  provider: "github-release",
  owner: "arnoldhao",
  repo: "xiadown",
  versionPrefixes: ["v"],
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
        fallbackRelease: {
          version: "0.0.1",
          notes: {
            from: "release-body",
            maxLength: 800,
          },
          fromRelease: {
            source: dreamcreatorStableApp.source,
            selector: dreamcreatorStableApp.selector,
            platforms: dreamcreatorStableApp.platforms,
          },
        },
        notes: {
          from: "release-body",
          maxLength: 800,
        },
        downloadAliases: [
          {
            route: "downloads/xiadown-macos-arm64-latest.zip",
            asset: {
              name: "xiadown-macos-arm64-{version}.zip",
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
          },
        },
      },
      tools: dreamcreatorConfig.channels.stable.tools,
    },
  },
};
