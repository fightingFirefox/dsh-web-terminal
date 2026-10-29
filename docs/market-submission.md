# 插件市场收录（awesome-dsh-plugin）

目标仓库：https://github.com/awesome-dsh-plugin/awesome-dsh-plugin

## 形式（来自 contributing.md）

一次 PR 只加**一个文件**：

```
data/plugins/<owner>__dsh-web-terminal.yml
```

内容见同目录 `market-listing.yml`（把 `OWNER` 换成你的 GitHub 账号）。

## 硬性要求（CI 会查）

- `package.json` 有 `dsh.bundle.patch`（本仓库有：`src/package.json` 的 `dsh.bundle`）✅
- 仓库有真实可用代码（不是占位/纯 README）✅
- **仓库创建满 1 天**（这条是自动检查；今天建仓的话明天再提）
- 仓库打 `dsh-plugin` topic（GitHub 仓库设置 → Topics）
- 描述只说功能、不含营销词，且必须与代码一致（我们写的是「17 个 live_terminal_* 工具」，实测 17 个）

## 步骤

1. 仓库已经 local commit：`git push` 到 `github.com/OWNER/dsh-web-terminal`
2. GitHub 仓库页 → About 右侧 ⚙ → Topics 加 `dsh-plugin`
3. 创建一个空提交（或等明天）满足「满 1 天」
4. fork `awesome-dsh-plugin`
5. 新建 `data/plugins/OWNER__dsh-web-terminal.yml`，粘贴 `docs/market-listing.yml` 内容并替换 OWNER
6. PR 标题示例：`Add dsh-web-terminal (ui)`
7. 等待 CI 绿 + 维护者合并

## 备注

- 分类选 `ui`（右侧栏终端面板）；若维护者认为更适合 `dev`，他们会直接改，不会打回
- 描述里的数字与 API 名会被核对，别改大
