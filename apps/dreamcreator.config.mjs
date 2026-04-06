const githubDownloadSources = [
  {
    name: "gh-proxy",
    kind: "proxy",
    priority: 10,
    enabled: true,
    urlTemplate: "https://gh-proxy.com/{url}",
  },
  {
    name: "github",
    kind: "origin",
    priority: 20,
    enabled: true,
    urlTemplate: "{url}",
  },
];

const dreamcreatorSource = {
  provider: "github-release",
  owner: "arnoldhao",
  repo: "dreamcreator",
  versionPrefixes: ["v"],
};

const ytDlpSource = {
  provider: "github-release",
  owner: "yt-dlp",
  repo: "yt-dlp",
  versionPrefixes: [],
};

const ffmpegSource = {
  provider: "github-release",
  owner: "jellyfin",
  repo: "jellyfin-ffmpeg",
  versionPrefixes: ["v"],
};

const bunSource = {
  provider: "github-release",
  owner: "oven-sh",
  repo: "bun",
  versionPrefixes: ["bun-v", "v"],
};

export default {
  path: "dreamcreator",
  appId: "cc.dreamapp.dreamcreator",
  defaultChannel: "stable",
  defaults: {
    downloadSources: githubDownloadSources,
  },
  channels: {
    stable: {
      app: {
        source: dreamcreatorSource,
        selector: {
          type: "latest",
          prerelease: false,
        },
        notes: {
          from: "release-body",
          maxLength: 800,
        },
        platforms: {
          "darwin-arm64": {
            asset: {
              name: "dreamcreator-macos-arm64-{version}.zip",
            },
            install: {
              strategy: "archive",
              artifactType: "zip",
            },
          },
          "darwin-amd64": {
            asset: {
              name: "dreamcreator-macos-x64-{version}.zip",
            },
            install: {
              strategy: "archive",
              artifactType: "zip",
            },
          },
          "windows-amd64": {
            asset: {
              name: "dreamcreator-windows-x64-{version}-installer.exe",
            },
            install: {
              strategy: "app-installer",
              artifactType: "exe",
            },
          },
        },
      },
      tools: {
        "yt-dlp": {
          displayName: "yt-dlp",
          kind: "external-tool",
          source: ytDlpSource,
          upstream: {
            selector: {
              type: "latest",
              prerelease: false,
            },
          },
          recommended: {
            selector: {
              type: "tag",
              tag: "2026.03.17",
            },
          },
          notes: "Pinned to a validated release for the stable channel.",
          autoUpdate: true,
          required: true,
          compatibility: {
            minAppVersion: "1.0.0",
            maxAppVersion: null,
          },
          platforms: {
            "darwin-arm64": {
              asset: {
                name: "yt-dlp_macos",
              },
              install: {
                strategy: "binary",
                artifactType: "raw-binary",
                executableName: "yt-dlp",
              },
            },
            "darwin-amd64": {
              asset: {
                name: "yt-dlp_macos",
              },
              install: {
                strategy: "binary",
                artifactType: "raw-binary",
                executableName: "yt-dlp",
              },
            },
            "windows-amd64": {
              asset: {
                name: "yt-dlp.exe",
              },
              install: {
                strategy: "binary",
                artifactType: "raw-binary",
                executableName: "yt-dlp.exe",
              },
            },
          },
        },
        ffmpeg: {
          displayName: "FFmpeg",
          kind: "external-tool",
          source: ffmpegSource,
          upstream: {
            selector: {
              type: "latest",
              prerelease: false,
            },
          },
          recommended: {
            selector: {
              type: "tag",
              tag: "v7.1.3-5",
            },
          },
          notes: "Manual review required before changing stable channel binaries.",
          autoUpdate: false,
          required: true,
          compatibility: {
            minAppVersion: "1.0.0",
            maxAppVersion: null,
          },
          platforms: {
            "darwin-arm64": {
              asset: {
                name: "jellyfin-ffmpeg_{version}_portable_macarm64-gpl.tar.xz",
              },
              install: {
                strategy: "archive",
                artifactType: "tar.xz",
                binaries: ["ffmpeg", "ffprobe"],
              },
            },
            "darwin-amd64": {
              asset: {
                name: "jellyfin-ffmpeg_{version}_portable_mac64-gpl.tar.xz",
              },
              install: {
                strategy: "archive",
                artifactType: "tar.xz",
                binaries: ["ffmpeg", "ffprobe"],
              },
            },
            "windows-amd64": {
              asset: {
                name: "jellyfin-ffmpeg_{version}_portable_win64-clang-gpl.zip",
              },
              install: {
                strategy: "archive",
                artifactType: "zip",
                binaries: ["ffmpeg.exe", "ffprobe.exe"],
              },
            },
          },
        },
        bun: {
          displayName: "Bun",
          kind: "external-tool",
          source: bunSource,
          upstream: {
            selector: {
              type: "latest",
              prerelease: false,
            },
          },
          recommended: {
            selector: {
              type: "tag",
              tag: "bun-v1.3.11",
            },
          },
          notes: "Pinned to a validated Bun release for the stable channel.",
          autoUpdate: false,
          required: false,
          compatibility: {
            minAppVersion: "1.0.0",
            maxAppVersion: null,
          },
          platforms: {
            "darwin-arm64": {
              asset: {
                name: "bun-darwin-aarch64.zip",
              },
              install: {
                strategy: "archive",
                artifactType: "zip",
                binaries: ["bun"],
              },
            },
            "darwin-amd64": {
              asset: {
                name: "bun-darwin-x64.zip",
              },
              install: {
                strategy: "archive",
                artifactType: "zip",
                binaries: ["bun"],
              },
            },
            "windows-amd64": {
              asset: {
                name: "bun-windows-x64.zip",
              },
              install: {
                strategy: "archive",
                artifactType: "zip",
                binaries: ["bun.exe"],
              },
            },
          },
        },
      },
    },
    beta: {
      optional: true,
      app: {
        source: dreamcreatorSource,
        selector: {
          type: "latest",
          prerelease: true,
        },
        notes: "Beta channel follows the latest prerelease when one exists.",
        platforms: {
          "darwin-arm64": {
            asset: {
              match: "^dreamcreator-macos-arm64-.*\\.zip$",
            },
            install: {
              strategy: "archive",
              artifactType: "zip",
            },
          },
          "darwin-amd64": {
            asset: {
              match: "^dreamcreator-macos-x64-.*\\.zip$",
            },
            install: {
              strategy: "archive",
              artifactType: "zip",
            },
          },
          "windows-amd64": {
            asset: {
              match: "^dreamcreator-windows-x64-.*-installer\\.exe$",
            },
            install: {
              strategy: "app-installer",
              artifactType: "exe",
            },
          },
        },
      },
      tools: {
        "yt-dlp": {
          displayName: "yt-dlp",
          kind: "external-tool",
          source: ytDlpSource,
          upstream: {
            selector: {
              type: "latest",
              prerelease: false,
            },
          },
          recommended: {
            selector: {
              type: "latest",
              prerelease: false,
            },
          },
          notes: "Beta channel follows the latest validated upstream release.",
          autoUpdate: true,
          required: true,
          compatibility: {
            minAppVersion: "1.3.0-beta.1",
            maxAppVersion: null,
          },
          platforms: {
            "darwin-arm64": {
              asset: {
                name: "yt-dlp_macos",
              },
              install: {
                strategy: "binary",
                artifactType: "raw-binary",
                executableName: "yt-dlp",
              },
            },
            "darwin-amd64": {
              asset: {
                name: "yt-dlp_macos",
              },
              install: {
                strategy: "binary",
                artifactType: "raw-binary",
                executableName: "yt-dlp",
              },
            },
          },
        },
        bun: {
          displayName: "Bun",
          kind: "external-tool",
          source: bunSource,
          upstream: {
            selector: {
              type: "latest",
              prerelease: false,
            },
          },
          recommended: {
            selector: {
              type: "latest",
              prerelease: false,
            },
          },
          notes: "Beta channel follows the latest validated Bun release.",
          autoUpdate: false,
          required: false,
          compatibility: {
            minAppVersion: "1.0.0",
            maxAppVersion: null,
          },
          platforms: {
            "darwin-arm64": {
              asset: {
                name: "bun-darwin-aarch64.zip",
              },
              install: {
                strategy: "archive",
                artifactType: "zip",
                binaries: ["bun"],
              },
            },
            "darwin-amd64": {
              asset: {
                name: "bun-darwin-x64.zip",
              },
              install: {
                strategy: "archive",
                artifactType: "zip",
                binaries: ["bun"],
              },
            },
            "windows-amd64": {
              asset: {
                name: "bun-windows-x64.zip",
              },
              install: {
                strategy: "archive",
                artifactType: "zip",
                binaries: ["bun.exe"],
              },
            },
          },
        },
      },
    },
  },
};
