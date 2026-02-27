# 贡献指南

感谢你对 ClawPanel 项目的关注！以下是参与贡献的相关说明。

## 开发环境要求

| 依赖 | 最低版本 | 说明 |
|------|----------|------|
| Node.js | 18+ | 前端构建 |
| Rust | stable | Tauri 后端编译 |
| Tauri CLI | v2 | `cargo install tauri-cli --version "^2"` |

### 快速开始

```bash
# 克隆仓库
git clone https://github.com/qingchencloud/clawpanel.git
cd clawpanel

# 安装前端依赖
npm install

# 启动开发模式
cargo tauri dev
```

## 分支策略

- 所有开发基于 `main` 分支
- 新功能分支：`feature/功能描述`（例如 `feature/log-export`）
- 修复分支：`fix/问题描述`（例如 `fix/model-save-crash`）
- 完成后发起 PR 合并回 `main`

## 提交规范

提交信息采用 [Conventional Commits](https://www.conventionalcommits.org/) 格式：

```
<类型>(可选范围): 简要描述
```

### 类型说明

| 类型 | 说明 |
|------|------|
| `feat` | 新功能 |
| `fix` | 修复 Bug |
| `docs` | 文档变更 |
| `style` | 代码格式调整（不影响逻辑） |
| `refactor` | 重构（非新功能、非 Bug 修复） |
| `test` | 测试相关 |
| `chore` | 构建/工具/依赖变更 |

### 示例

```
feat(model): 新增模型批量测试功能
fix(gateway): 修复端口配置未生效的问题
docs: 更新安装说明
```

## PR 流程

1. Fork 本仓库并克隆到本地
2. 从 `main` 创建新分支
3. 完成开发并进行本地测试
4. 确保代码风格一致、注释完整
5. 提交并推送到你的 Fork 仓库
6. 发起 Pull Request，描述清楚变更内容和测试情况
7. 等待代码审查，根据反馈修改

## 代码规范

- **前端**：使用 Vanilla JS，不引入第三方框架
- **注释**：所有代码注释使用中文
- **风格**：简洁清晰，避免过度封装
- **命名**：变量和函数使用驼峰命名（camelCase），CSS 类名使用短横线命名（kebab-case）
- **资源**：静态资源本地化，禁止引用远程 CDN

## 问题反馈

如果发现 Bug 或有功能建议，欢迎通过 [GitHub Issues](https://github.com/qingchencloud/clawpanel/issues) 提交。
