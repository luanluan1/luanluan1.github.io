# 个人博客源码与发布记录

核对日期为 2026-10-26。

## 当前使用的版本

- 线上站点为 https://luanluan1.github.io/，GitHub Pages 从本仓库 `gh-pages` 分支根目录发布。
- 目前线上使用 Firefly。对应源码保存到本仓库的 `codex/firefly-source` 分支，保留 Firefly 上游历史与 MIT 许可证。
- 本仓库 `main` 是旧版 Astro 站点源码，保留供历史查阅；它目前不是线上 Firefly 的构建输入。不要直接用旧版 main 构建覆盖线上。
- 本机当前可维护目录为 `D:/项目/个人网站-codex-source`。`D:/项目/个人网站-firefly` 是此前本地定制目录，原修改保留，未改写其上游 origin。
- `D:/项目/个人网站` 中还有未提交的旧版站点改动，未丢弃也未混入本次发布。

## 继续更新

在 `codex/firefly-source` 分支基础上新建工作分支，文章放在 `src/content/posts/`，项目卡片在 `src/data/projects.ts`，静态图片在 `public/assets/images/`。沿用当前内容格式和主题，不把 `dist` 当成可维护源码。

环境为 Node.js 24.15.0、pnpm 9.14.4，依赖版本由 `pnpm-lock.yaml` 固定。

```sh
pnpm install --frozen-lockfile
pnpm check
pnpm type-check
pnpm build
```

三个命令依次运行，避免 Vite 同时修改构建缓存。源码审查、提交后，运行以下命令记录本次构建对应的源码版本。

```sh
node scripts/deployment-manifest.mjs
```

该命令要求 Git 工作区干净，将源码提交、目标仓库、文章及项目数据哈希写入 `dist/deployment.json`。发布前应确认当前 dist 来自上述源码构建。

使用 `gh-pages` 最新提交建立独立发布分支，将验证过的 `dist` 完整同步过去，保留 `.nojekyll` 并保留 gh-pages 历史，不 force push。提交构建结果并快进更新 gh-pages 后，等待 Pages 部署完成，再访问文章、项目页、RSS 和 `/deployment.json` 核对。

`deployment.json` 是版本追踪信息，不是部署签名或第三方证明。它可以回答“这份线上页面来自哪个源码提交”；本地有未提交改动时仍需用 Git 检查。

## 本次内容与验证范围

### 2026-10-26：Attention 点积与余弦相似度

新增 `src/content/posts/transformer-attention-dot-product-vs-cosine.md`，公开路径为 `/posts/transformer-attention-dot-product-vs-cosine/`。沿用“模型原理”分类与现有 KaTeX 渲染，保留原稿的四节结构，补充分数尺度、归一化注意力与论文参考资料。发布清单增加该文章的源码哈希，并确认对应页面已构建。

### 2026-10-26：企业 Agent 系列

项目总结现在包含一篇总览及六篇专题。总览仍为 `src/content/posts/codex-enterprise-agent-control-plane.md`，公开路径为 `/posts/codex-enterprise-agent-control-plane/`，专题沿用 `codex-enterprise-agent-` 文件前缀。项目卡片进入完整目录，既有项目和文章保留；deployment.json 记录全部七篇文章和项目数据哈希。章节范围与事实核验见 [系列编辑记录](docs/codex-enterprise-series.md)。

总结依据企业平台实际代码和验证记录撰写，明确本地试用与生产可靠性边界；没有公开企业平台源码、测试账号密码、Token、私有服务地址或真实业务材料。原始 Firefly 定制内容归入本次源码存档，不冒充本次新写的功能。
