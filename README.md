# dreamapp-updates

`dreamapp-updates` 是 DreamApp 产品更新清单仓库。

本仓库负责生成并维护静态更新清单文件，供客户端通过固定地址读取更新元数据。当前已提供：

- `/dreamcreator/manifest.json`
- `/dreamcreator/downloads/dreamcreator-macos-arm64-latest.zip`
- `/dreamcreator/downloads/dreamcreator-macos-x64-latest.zip`
- `/dreamcreator/downloads/dreamcreator-windows-x64-latest-installer.exe`
- `/dreamcreator/downloads/dreamcreator-windows-x64-latest.zip`
- `/hush/manifest.json`
- `/hush/downloads/latest-mac.yml`
- `/hush/downloads/latest.yml`
- `/hush/downloads/hush-macos-arm64-latest.zip`
- `/hush/downloads/hush-macos-x64-latest.zip`
- `/hush/downloads/hush-macos-universal-latest.zip`
- `/hush/downloads/hush-macos-universal-latest.dmg`
- `/hush/downloads/hush-windows-x64-latest-installer.exe`
- `/hush/downloads/hush-windows-x64-latest-setup.exe`
- `/xiadown/manifest.json`
- `/xiadown/downloads/xiadown-macos-arm64-latest.zip`
- `/xiadown/downloads/xiadown-macos-arm64-latest.dmg`
- `/xiadown/downloads/xiadown-macos-x64-latest.zip`
- `/xiadown/downloads/xiadown-macos-x64-latest.dmg`
- `/xiadown/downloads/xiadown-windows-x64-latest-installer.exe`
- `/xiadown/downloads/xiadown-windows-x64-latest.zip`
- `/index.json`
- `/schema/manifest.schema.json`

更新清单由 GitHub Actions 定时生成并提交到 `main`，Cloudflare Pages 基于 Git integration 自动发布。

## Cloudflare Pages 配置

在 Cloudflare Pages 中将本仓库连接为一个 Git 项目，并使用以下配置：

- Production branch: `main`
- Build command: `true`
- Build output directory: `dist`

推荐同时完成以下设置：

- Custom domain: `updates.dreamapp.cc`
- Root directory: 留空

## GitHub Actions

本仓库使用 `.github/workflows/deploy.yml` 定时刷新 `dist/` 中的清单文件。`dreamcreator` 全量刷新；`xiadown` 只刷新配置中 `autoUpdate: true` 的工具，`yt-dlp` 和 FFmpeg 均跟随上游最新稳定版；`hush` 保持原清单。

`xiadown` 的 Bun 锁定在 `1.3.14`，定时工具刷新保留已发布的 Bun 内容。软件版本、下载地址和直播频道信息也保持已发布内容，软件版本仍通过手动 workflow 更新。

默认行为：

- `schedule`: 每小时第 `07` 分和 `37` 分执行
- `workflow_dispatch`: 支持手动执行，与定时任务使用相同的刷新范围

定时任务运行 `npm run build:auto`（`node scripts/build.mjs --exclude-app hush --tools-only-app xiadown`）。单独刷新 XiaDown 自动更新工具可运行 `node scripts/build.mjs --app xiadown --tools-only-app xiadown`。工具刷新需要已有的 XiaDown 清单，首次发布必须手动运行完整刷新；若上游工具的安装包或 SHA-256 尚未齐全，则保留该工具上一版，等待下次检测。

`.github/workflows/refresh-xiadown.yml` 只支持 `workflow_dispatch`，用于手动刷新 `xiadown` 软件版本清单。

`.github/workflows/refresh-hush.yml` 只支持 `workflow_dispatch`，用于手动刷新 `hush` 软件版本清单和 Electron 自动更新 metadata。Hush 发布后先验证 GitHub Release 资产，再手动运行该 workflow，将新版本推送给所有自动更新用户。

Workflow 使用 GitHub Actions 自带的 `github.token` 读取上游 GitHub Release 元数据，并将生成结果提交回 `main`。
