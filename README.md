# dsh-web-terminal

> DSH 网页版（web profile）的**可见终端面板**，Claude 皮肤。
> 让 agent 执行的命令实时出现在右侧栏里：自动弹出、可交互、可截图、可回看历史。

<p align="center">
  <img src="docs/hero.png" alt="dsh-web-terminal" width="100%" />
</p>

<p align="center">
  <a href="LICENSE"><img alt="license" src="https://img.shields.io/badge/license-MIT-d97757" /></a>
  <img alt="dsh" src="https://img.shields.io/badge/DSH-%E2%89%A50.2.1--alpha.3-d97757" />
  <img alt="platform" src="https://img.shields.io/badge/platform-DSH%20Web-191919" />
  <img alt="profile" src="https://img.shields.io/badge/profile-web%20only-191919" />
</p>

---

## 这是什么

DSH（DeepSeek Harness）的 Web GUI 右侧栏，装上本插件后多出一个**终端标签页**：

- agent 执行 `pwsh` / `bash` 前台命令时，命令**实时流进面板**，右侧栏自动弹出
- 你也可以自己开交互终端（PowerShell / bash / cmd）直接敲
- agent 能「截屏」终端（text / ansi / png），用来读 TUI、确认服务启动、验证输出
- 一整套 `live_terminal_*` 工具：等待、搜索、分页读取、发信号、调尺寸、在已有 shell 里执行、导出日志

视觉是 **Claude Code Desktop** 那一套：暖白纸面、赤陶强调色（#d97757）、Inter / Noto Serif / JetBrains Mono 字体层、细描边、柔和投影；xterm 用 Claude 专用 ANSI 调色板，浅色深色跟随 DSH 主题。

> **只面向 Web 版。** 桌面版（desktop profile）请用上游 [dsh-live-terminal](https://github.com/Lancang-hzau/dsh-live-terminal)。
> 本仓库是它的 fork：保留全部功能，重做视觉层，安装链路改成「从 GitHub 直接装」，不走 npm。

---

## 功能

| | |
|---|---|
| **命令上屏** | 接管 agent 前台 shell 调用，输出实时显示；短命令（<1.2s）不上屏，避免刷屏 |
| **自动弹面板** | 命令开始时右侧栏自动打开；每个会话最多一次，失败自动重试 |
| **交互终端** | 多标签、resize、刷新重连、专注模式放大到 ~93% 视口、字号 10–20px |
| **终端截图** | `text` / `ansi` / `png`（png 由浏览器渲染成图片返回给模型） |
| **命令历史** | 关闭的命令默认保留 20 条，面板与 agent 都能回看、复制、搜索、导出 |
| **端口识别** | 输出里的 `http://localhost:PORT` 自动变可点链接，工具结果也带 ports |
| **Claude 皮肤** | 暖色 ANSI、赤陶光标、6/8/12/14 半径、细描边、胶囊徽标 |
| **沙箱透明** | 面板终端以当前系统用户权限运行，**不套 DSH 文件沙箱**，界面与工具结果都有标注 |

<p align="center">
  <img src="docs/screenshot-panel.png" alt="终端面板" width="46%" />
  <img src="docs/screenshot-focus.png" alt="专注模式" width="46%" />
</p>

---

## 安装（从 GitHub，不走 npm）

前置：DSH 用 **web profile** 成功启动过一次（`dsh web`），本机有 Node.js 22.19+ / 24+。

```powershell
git clone https://github.com/OWNER/dsh-web-terminal.git
cd dsh-web-terminal
pwsh -NoProfile -File install.ps1
```

脚本会：备份 profile 的 `package.json` / `cordis.patch.yml` → 复制插件到 `~/.dsh/profiles/web/node_modules/dsh-web-terminal` → 安装运行时依赖（`@xterm/headless`、`@xterm/addon-serialize`）→ 注册 bundle → 写配置行。

**然后完全退出 DSH，重新 `dsh web`。** 右侧栏即可看到终端标签页。

手动安装等价步骤：

```powershell
$dest = "$env:USERPROFILE\.dsh\profiles\web\node_modules\dsh-web-terminal"
New-Item -ItemType Directory -Force $dest | Out-Null
Copy-Item lib, package.json, cordis.patch.yml, LICENSE, NOTICE, icon.svg $dest -Recurse
cd $dest; npm install --omit=dev
# package.json 的 dsh.profile.bundles 加入 "dsh-web-terminal"
# cordis.patch.yml 末尾加入：
#   - id: dsh-web-terminal
#     name: dsh-web-terminal
#     config:
#       interceptShellTools: true
```

卸载：`pwsh -NoProfile -File uninstall.ps1`，然后重启 DSH。

---

## 用法

1. 正常和 agent 对话让它跑命令（「跑一下 npm test」）→ 右侧栏自动弹终端，输出实时滚动
2. 自己开终端：右侧栏 → 终端面板 → 会话条 **+**
3. 想留住终端：结束后有倒计时（成功 8s / 失败 30s），点「保留」或鼠标悬停暂停
4. `Ctrl+F` 搜输出；`Ctrl+Alt+Enter` 放大终端；`Ctrl+Alt+T` 新建终端
5. 回看已关闭命令：会话条 `⋯ → 历史`

快捷键：`Ctrl+Shift+\`` 打开/聚焦，`Ctrl+Alt+T` 新建，`Ctrl+Alt+Shift+W` 关闭当前，`Ctrl+Alt+F` 跟随最新命令。

---

## 配置

在 `~/.dsh/profiles/web/cordis.patch.yml` 的 `dsh-web-terminal` 行下覆盖：

| 键 | 默认 | 说明 |
|---|---|---|
| `interceptShellTools` | `true` | 是否接管 agent 前台 pwsh/bash 调用 |
| `interceptMinVisibleMs` | `1200` | 命令从 shell 就绪起至少跑多久才上屏；`0` = 全部上屏 |
| `autoCloseCommandDelayMs` | `8000` | 成功后自动关闭延迟；`-1` = 永不 |
| `autoCloseFailedDelayMs` | `30000` | 失败/超时/中止后的关闭延迟 |
| `autoCloseToolTerminals` | `true` | 是否也自动关闭 `live_terminal_run` 的终端 |
| `historySize` / `historyPersist` | `20` / `true` | 最近命令历史条数 / 是否落盘 |
| `shellPath` | 自动 | 交互 shell；null = pwsh → powershell → cmd |
| `scrollback` / `maxOutputBytes` | `2000` / `262144` | 每终端回滚行数 / 单会话保留输出字节 |
| `maxSessions` | `16` | 全局终端上限 |
| `requireSandbox` | `false` | `true` = 非 danger-full-access 时拒绝接管并回退内置工具 |
| `allowUnconfined` | `true` | 是否允许未套沙箱的 agent 终端 |
| `portDetection` | `true` | 识别 loopback 端口并生成可点链接 |

---

## Agent 工具

| 工具 | 作用 |
|---|---|
| `live_terminal_run` | 在可见终端跑一条命令（可等待 / 后台） |
| `live_terminal_screenshot` | 截屏：`text` / `ansi` / `png` |
| `live_terminal_send` | 向交互终端写文本 / `keys:["Up","Enter"]` / `C-c` |
| `live_terminal_read` | 读尾部 / 区间 / 全部输出（已关闭终端回退历史） |
| `live_terminal_search` | 在保留输出里搜字面量或正则 |
| `live_terminal_wait` | 等进程退出或输出匹配，不杀进程 |
| `live_terminal_expect` | 等某个模式出现（dev server ready / 提示符） |
| `live_terminal_status` | 状态、退出码、耗时、cwd、端口、沙箱标注 |
| `live_terminal_signal` | SIGINT / SIGTERM / SIGKILL / SIGHUP |
| `live_terminal_resize` | 调整 PTY 尺寸（截 TUI 前用） |
| `live_terminal_exec` | 在已有交互终端里执行（保留 cd / env / venv / alias） |
| `live_terminal_list` | 列出可见终端 |
| `live_terminal_history` | 最近关闭的命令 |
| `live_terminal_open` | 新建可见交互终端 |
| `live_terminal_close` | 关闭终端并终止进程树 |
| `live_terminal_rename` | 重命名终端 |
| `live_terminal_export` | 导出 text / ansi（大文件落盘） |

---

## 安全说明

- 面板命令与 agent 创建的终端**以当前系统用户权限运行**，`spawnTerminal` 的 PTY **不套 DSH 文件沙箱**，与 DSH 自带的「用户终端」语义一致
- 需要强制沙箱时设 `requireSandbox: true`：非 `danger-full-access` 下拒绝接管并回退内置沙箱工具
- 带 `run_in_background` 或升权 `sandbox_permissions` 的 shell 调用不会被接管，保持 DSH 原生审批语义
- 终端内容只在本机宿主与本地浏览器之间通过 HTTP/SSE 传输，不上传第三方

---

## 兼容性

- DSH `>= 0.2.1-alpha.3 < 0.3.0-0`（web profile；客户端注入 `@deepseek-ai/dsh-client-ui-sidebar-right`）
- Node.js `^22.19.0 || >=24.0.0`
- Windows 为主要测试平台；macOS / Linux 走同一套 `spawnTerminal` 语义，欢迎反馈

## 常见问题

**面板不出现 / 没有 `live_terminal_*` 工具**
1. `~/.dsh/profiles/web/package.json` 的 `dsh.profile.bundles` 里有 `dsh-web-terminal`
2. `cordis.patch.yml` 有 `- id: dsh-web-terminal` 行
3. 宿主已**完全重启**（插件只在启动时加载）
4. 宿主终端输出里搜 `[dsh-web-terminal]` 报错

**安装被 engines 拦住**：`dsh plugin add` 会校验版本；本仓库手工安装即绕过此限制，但 DSH 低于 0.2.1-alpha.3 时 API 不保证存在。

**命令不上屏**：检查 `interceptShellTools` 是否被改 false、命令是否短于 `interceptMinVisibleMs`、是否带后台/升权参数。

---

## 开发

```powershell
npm install          # 依赖（esbuild / xterm）
npm run build        # 常规构建
npm run build:cli    # 受限沙箱兜底：直接跑 esbuild CLI 再包一层
```

产物：`lib/client.js`（`window.__ModuleLoader__.load({ id, factory })` 信封）+ host 侧 `lib/index.js`、`lib/host/*.js`。

```
client-src/   浏览器半边（React + xterm；Claude 皮肤在 styles.ts / theme.ts）
lib/host/     宿主半边（PTY 注册表、拦截、工具、HTTP/SSE 路由）
lib/index.js  Cordis 插件入口
tools/        构建与打包脚本
```

---

## License & Credits

MIT，见 [LICENSE](LICENSE) 与 [NOTICE](NOTICE)。

- 上游：[dsh-live-terminal](https://github.com/Lancang-hzau/dsh-live-terminal)（LANCANG，MIT）——host 与客户端逻辑
- 设计语言参考：[dsh-claude-style](https://github.com/Nwflower/dsh-claude-style)（Nwflower，MIT）
- 终端引擎：[xterm.js](https://github.com/xtermjs/xterm.js)（MIT）

本仓库新增：Claude 皮肤层、Claude ANSI 调色板、web profile 安装链路与打包元数据。

---

<details>
<summary>English</summary>

**dsh-web-terminal** is a Claude-styled visible terminal panel for the DeepSeek Harness **web** GUI. It streams agent shell commands into the right sidebar live, auto-opens the panel when a command starts, lets the agent capture the terminal (text / ANSI / PNG) and drive it through a `live_terminal_*` toolset.

Install from GitHub (no npm): clone, then `pwsh -NoProfile -File install.ps1`, then fully restart DSH.

Forked from dsh-live-terminal (MIT). Web profile only; desktop users should use upstream.

</details>
