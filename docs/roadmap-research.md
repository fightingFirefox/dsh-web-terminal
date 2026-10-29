# 功能调研：终端插件的市场空白（2026-10-29）

## 1. 方法

- 数据源：`awesome-dsh-plugin/awesome-dsh-plugin` 的生成版 README（2026-10-29 快照，**7557 个插件条目**）
- 方法：按分类统计 + 对标题/描述做关键词与正则检索；对 6 个终端类竞品精读 README
- 局限：只看描述，不看实现；关键词匹配会漏掉未写明的能力；计数为「提及该词的条目数」，不是功能覆盖度

分类规模（条目数）：UI Enhancements 1488、Tools & Capabilities 1023、Sessions & Messages 522、Development & Runtime 461、Workflow & Automation 424、Security & Permissions 207、Remote & Mobile 228。

终端相关：标题/描述含 terminal/pty/shell/tty/xterm 的 **237 条**；其中真正的「PTY 终端面板」约 20 个。

## 2. 竞品矩阵（精读）

| 插件 | 形态 | 已覆盖 |
|---|---|---|
| `btsd321/dsh-oh-my-terminal` | 底部面板 | 多会话、同组水平分屏、会话持久化、快捷键、可拖高、终端 profile 表、字体/行高、better-sidebar 兼容 |
| `hyzyn/dsh-plugin-kit#tty` | 侧栏 | 多标签 xterm、真实 PTY、SSH 重连 |
| `giiiiiithub/terminal` | 面板 | 真 PTY（node-pty）+ xterm |
| `JesmonX/dsh-web-shell` | 右侧可折叠 | WebSocket 桥接 PTY、bash/zsh 切换、resize |
| `lispking/dsh-devpanel` | 输入框下方 | 多标签 PTY + AI 输出文件浏览 |
| `Harzva/dsh-superterminal` | macOS 原生 | 本地终端 AI 会话、SSH 重连、多终端「参会」讨论 |
| `988hj7tczd-oss/dsh-asciinema` | 录制 | 从 `tool/result` 事件录 asciinema v2 `.cast`，离线回放、HTML 导出、rec/play/cat/mark |
| `tengyinan1994/dsh-project-runner` | 运行面板 | 一键起项目服务、彩色流式输出、按次保留日志 |

结论：**终端 UI 本身已高度饱和**，再做「又一个多标签终端」没有差异。

## 3. 不要做的（已有强竞品）

- 多标签 / 分屏 / 会话持久化 / 主题与字体 / 快捷键 —— oh-my-terminal、better-sidebar、powerdesk 都在做
- SSH / 跳板机终端 —— 10+ 个插件（ssh-tui、zterm、ssh-workspace、honeybee…）
- 终端里跑 AI 会话 —— superterminal 做得更深
- 工具级录制回放 —— asciinema 插件已覆盖 `tool/result` 流
- 「Shell 切换 / Git Bash 后端」—— 10+ 个
- Keybar（手机缺少的 Esc/Tab/Ctrl-C）—— 已有
- 危险命令拦截 —— 至少 6 个专做（safety-net、danger-guard、allow、policy…）

## 4. 空白点候选

检索计数为「描述中提及该概念的插件数」，0 表示市场里没有以该能力为主打的插件。

| # | 能力 | 市场证据 | 价值 | 成本（本仓库基座） |
|---|---|---|---|---|
| A | **命令台账**：每条命令的结构化记录（cmd / exit / 时长 / cwd / 端口 / 输出摘要 / 哈希），面板可筛，agent 可查，导出 JSONL & Markdown | 无直接竞品（「audit/timeline」命中的 128 条是审计/记忆类，非终端命令级） | 排障、复现、交付审计 | 1–1.5 天 |
| B | **localhost 预览**：识别命令打开的本地端口，一键在 DSH 内打开预览页（而不是复制链接去浏览器） | `preview.*localhost` 0 条；只有端口徽标/运行面板 | 开发闭环（dev server、文档站） | 1 天 |
| C | **挂起看门狗**：命令长时间无输出/无退出时标记、截图、通知，可一键中断 | 无终端类竞品 | 防 agent 卡死 | 0.5–1 天 |
| D | **PTY 级录制**（含用户按键）→ asciinema v2 `.cast`，可回放、导出 | 0 条；asciinema 插件只录工具结果，交互式 TUI 录不到 | 复现交互问题、教程 | 2–3 天 |
| E | **命令前后工作区快照 diff**：每条命令自动记快照，面板里看这条命令改了哪些文件、逐行 diff | 1 条邻接（`tmpdot/dsh-checkpoint-diff`，但非命令绑定） | 排查「谁改了这个文件」 | 2–3 天 |
| F | **测试结果树**：解析 vitest/jest/pytest 输出成树，点失败跳 `file:line`，一键重跑失败项 | 无（testgen 是生成测试，不是结果 UI） | 高频开发动作 | 3–5 天 |
| G | **终端输出语义检索**（跨会话） | 0 条 | 「上周那个报错」 | 4–6 天（要建索引） |
| H | **只读分享链接**（实时看终端） | 1 条邻接 | 远程求助 | 2–3 天（安全设计成本高） |

已排除的候选（有竞品或价值不足）：选中文本→追问 agent（`dsh-selection-chat`、`dsh-client-ui-quote` 已做，且支持 terminal 选区）、端口徽标（`CAOGGL/dsh-port-token`）、运行配置（`dsh-run-config`）。

## 5. 建议的版本组合

**v1.1（P0，约 3 天）**：A 命令台账 + C 挂起看门狗 + B localhost 预览

- 三者都复用现有 `TerminalRegistry` / `ports` / `history` 结构，不需要新依赖
- 对外叙事清晰：「agent 终端不仅可见，还可审计、可预览、可兜底」
- 差异点 A、C 在市场里为 0

**v1.2（P1，约 3 天）**：E 命令级快照 diff

- 依赖 A 的记录模型；用 git 影子仓库或文件哈希实现
- 与 A 组合后可以回答「这条测试命令到底改了哪些文件」

**v1.3（P2，约 3 天）**：D PTY 级录制

- asciinema v2 格式简单，播放器可复用其开源实现；差别在与「交互式会话」而非工具输出
- 需要处理按键回显与尺寸变化事件

**不建议**：F（工程量大、面向 CI 的替代品多）、G（要维护索引与嵌入模型）、H（安全面大，收益低）。

## 6. 与现有代码的契合点

| 候选 | 落点 |
|---|---|
| A | `lib/host/registry.js` 已有 session 生命周期与 history；新增 `ledger.js` + `live_terminal_ledger` 工具 + 面板 tab |
| B | `lib/host/ports.js` 已检测 loopback 端口；新增宿主路由 `/dsh-terminal-panel/preview/:id` 并在浏览器 tab 打开 |
| C | `lib/host/session.js` 已有输出时间戳；新增 idle 计时器 + 事件推送 |
| E | 复用 A 的时间点，调用 `git status --porcelain` / `git diff`（工作区是 git 仓库时） |
| D | xterm 已有 serialize addon；捕获输入流后在 host 端写 cast |

## 7. 参考

- 市场快照：https://github.com/awesome-dsh-plugin/awesome-dsh-plugin
- 竞品：`dsh-oh-my-terminal`、`dsh-asciinema`、`dsh-superterminal`、`dsh-project-runner`、`dsh-tty`
- 上游同类调研（2026-10）：dsh-live-terminal `research/existing-plugins.md`
