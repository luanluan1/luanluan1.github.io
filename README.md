# luanluan1 的个人站

> 2026-10-26 源码位置说明：当前线上使用 Firefly。可维护源码已保存到本仓库的 [codex/firefly-source 分支](https://github.com/luanluan1/luanluan1.github.io/tree/codex/firefly-source)，构建与发布说明见 [SITE-MAINTENANCE.md](https://github.com/luanluan1/luanluan1.github.io/blob/codex/firefly-source/SITE-MAINTENANCE.md)。本 `main` 分支保留旧版 Astro 源码用于历史查阅，不是当前线上站点的构建输入。
>
> 线上由 `gh-pages` 发布，可访问 [deployment.json](https://luanluan1.github.io/deployment.json) 查询对应源码提交。本次项目文章为 [Codex Enterprise Agent 总结](https://luanluan1.github.io/posts/codex-enterprise-agent-control-plane/)，项目卡片位于[项目页](https://luanluan1.github.io/projects/#codex-enterprise-agent)。原有文章和旧版本地改动保留。

一个基于 Astro 的静态技术博客，记录 AI 应用、RAG、Agent 和后端可靠性实践。

## 本地开发

```bash
pnpm install
pnpm dev
```

## 构建

```bash
pnpm build
```

以上命令针对本分支的历史版本。当前线上 Firefly 请使用上方源码分支及其维护说明；构建产物继续发布到 `gh-pages` 并由 GitHub Pages 托管。
