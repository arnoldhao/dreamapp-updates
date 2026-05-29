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
- `/xiadown/downloads/xiadown-macos-x64-latest.zip`
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

本仓库使用 `.github/workflows/deploy.yml` 定时刷新 `dist/` 中的清单文件，但不会自动检测 `hush` 和 `xiadown` 的软件版本。

默认行为：

- `schedule`: 每小时第 `07` 分和 `37` 分执行
- `workflow_dispatch`: 支持手动执行，刷新 `hush` 和 `xiadown` 以外的清单

`.github/workflows/refresh-xiadown.yml` 只支持 `workflow_dispatch`，用于手动刷新 `xiadown` 软件版本清单。

`.github/workflows/refresh-hush.yml` 只支持 `workflow_dispatch`，用于手动刷新 `hush` 软件版本清单和 Electron 自动更新 metadata。Hush 发布后先验证 GitHub Release 资产，再手动运行该 workflow，将新版本推送给所有自动更新用户。

Workflow 使用 GitHub Actions 自带的 `github.token` 读取上游 GitHub Release 元数据，并将生成结果提交回 `main`。
