<p align="center">
  <img src="public/images/logo.svg" width="120" alt="ClawPanel Logo">
</p>

<h1 align="center">ClawPanel</h1>

<p align="center">
  OpenClaw 可视化管理面板 — 基于 Tauri v2 的跨平台桌面应用
</p>

<p align="center">
  <a href="https://github.com/qingchencloud/clawpanel/blob/main/LICENSE">
    <img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="License">
  </a>
  <a href="https://github.com/qingchencloud/clawpanel/releases">
    <img src="https://img.shields.io/github/v/release/qingchencloud/clawpanel" alt="Release">
  </a>
</p>

---

ClawPanel 是 [OpenClaw](https://github.com/openclaw-labs/openclaw) AI Agent 框架的可视化管理面板，提供服务管控、模型配置、日志查看、记忆管理等核心功能，一站式管理 OpenClaw 实例。

## 功能截图

> 截图待补充

## 功能特性

- **仪表盘** — 系统概览，服务状态实时监控
- **服务管理** — OpenClaw 服务启停、版本检测、配置备份与恢复
- **模型配置** — 多服务商管理、模型增删改查、主模型选择、批量测试、延迟检测、自动保存与撤销
- **网关配置** — Gateway 端口、运行模式、认证方式配置
- **日志查看** — 多日志源实时查看与关键字搜索
- **记忆管理** — OpenClaw 记忆文件的查看、编辑、导出
- **扩展工具** — cftunnel 内网穿透管理、ClawApp 连接状态
- **关于** — 版本信息、社群入口、相关项目

## 技术架构

| 层级 | 技术 | 说明 |
|------|------|------|
| 前端 | Vanilla JS + Vite | 零框架依赖，轻量快速 |
| 后端 | Rust + Tauri v2 | 原生性能，跨平台打包 |
| 通信 | Tauri IPC + Shell Plugin | 前后端桥接，本地命令执行 |
| 样式 | 纯 CSS（CSS Variables） | 暗色主题，玻璃拟态风格 |

```
clawpanel/
├── src/                    # 前端源码
│   ├── pages/              # 8 个页面模块
│   ├── components/         # 通用组件（侧边栏、弹窗、Toast）
│   ├── lib/                # 工具库（Tauri API 封装、主题）
│   ├── style/              # 样式文件
│   ├── router.js           # 路由
│   └── main.js             # 入口
├── src-tauri/              # Rust 后端
│   ├── src/                # Tauri 命令与业务逻辑
│   ├── Cargo.toml          # Rust 依赖
│   └── tauri.conf.json     # Tauri 配置
├── public/                 # 静态资源
├── scripts/                # 开发与构建脚本
│   ├── dev.sh              # 开发模式启动
│   └── build.sh            # 编译与打包
├── index.html              # HTML 入口
├── vite.config.js          # Vite 配置
└── package.json            # 前端依赖
```

## 快速开始

### 前置条件

- [Node.js](https://nodejs.org/) >= 18
- [Rust](https://www.rust-lang.org/tools/install) (stable)
- Tauri v2 系统依赖（参考 [Tauri 官方文档](https://v2.tauri.app/start/prerequisites/)）

### 安装依赖

```bash
git clone https://github.com/qingchencloud/clawpanel.git
cd clawpanel
npm install
```

### 开发

```bash
# 启动完整 Tauri 桌面应用（默认）
./scripts/dev.sh

# 仅启动 Vite 前端（浏览器调试，使用 mock 数据）
./scripts/dev.sh web
```

### 构建

```bash
# 编译 debug 版本（默认）
./scripts/build.sh

# 仅检查 Rust 编译（最快，不生成产物）
./scripts/build.sh check

# 编译正式发布版本（含打包）
./scripts/build.sh release
```

## 相关项目

| 项目 | 说明 |
|------|------|
| [OpenClaw](https://github.com/openclaw-labs/openclaw) | AI Agent 框架 |
| [ClawApp](https://github.com/qingchencloud/clawapp) | 跨平台移动聊天客户端 |
| [cftunnel](https://github.com/qingchencloud/cftunnel) | Cloudflare Tunnel 内网穿透工具 |

## 贡献

欢迎提交 Issue 和 Pull Request。贡献流程详见 [CONTRIBUTING.md](CONTRIBUTING.md)。

## 许可证

[MIT License](LICENSE)
