---
title: "DeepSeek Harness（一）Agent Preset 如何组装一个 Agent"
description: "通过一个纯网页检索 Agent，解释 DeepSeek Harness 的宿主层、Agent Preset，以及模型可见能力怎样按会话组装。"
published: 2026-08-14T16:10:00+08:00
tags: ["DeepSeek Harness", "Agent Preset", "Skill", "Workflow", "Agent"]
category: "AI 工程"
comment: false
---

> 系列目录 [DeepSeek Harness 学习笔记](/posts/deepseek-harness-notes/)

我最初把 DeepSeek Harness 理解成一个带工具的 AI 编程助手。它有模型、有 Shell，也能读写文件，和常见的 Coding Agent 看起来很接近。

后来我复制了一份标准 Agent Preset，把文件、代码搜索、Shell、Skill 管理等工具逐项移除，只保留网页搜索和网页读取。新会话中的模型果然只能检索网页。它无法修改文件，也看不到运行命令的入口。

后台没有因此缩成一套网页搜索程序。模型路由、API 凭据、会话持久化、Token 统计、权限和 Agent Loop 仍在工作。我改动的是这个 Agent 面向模型的能力组合。

这次实验让我开始把 Harness 看成一个可以组装 Agent 的运行系统。

## 宿主与 Agent Preset

从当前随附的 Web 部署来看，Harness 可以沿作用范围分成宿主组合和 Agent Preset 组合。

宿主组合负责进程共用的设施。模型连接、凭据、会话存储、沙箱和审批策略通常放在这里。网页搜索 Provider 也可以由宿主加载，供多个 Agent 共用。

Agent Preset 是一个目录，其中包含 `agent.cordis.yml`。它会把提示词段落、工具和 Skills 挂到自己的 Scope。会话选择这个 Preset 后，当前 Agent 的 Scope 会接到相应的 Preset Scope 上。

工具和提示词的读取顺序大致如下。

```text
agent scope
    ↓
preset scope
    ↓
global scope
```

当前 Agent 可以看到自己这一层、所选 Preset 和宿主全局层提供的内容。另一个 Preset 的工具不会混进来。多个 Agent 因此能够在同一个 Harness 进程里使用不同的模型可见能力。

Preset 只能在会话仍然空白时切换。会话已经产生工具调用以后再换 Preset，新组合可能没有能力重放旧工具，持久历史也会失去一致的解释方式。

## 纯网页检索 Agent 改了什么

我创建的网页检索 Agent 保留了 Persona 和网页工具，删除了代码编辑、文件系统和命令执行等模型入口。它可以概括为下面这份很小的组合。

```yaml
- id: persona
  name: "@deepseek-ai/dsh-persona"
  config:
    text: "你是一个网页研究助手。"

- id: tool-web
  name: "@deepseek-ai/dsh-tool-web"
  config:
    fetch: false
```

网页服务仍由宿主提供，`tool-web` 消费这项服务，再向模型注册网页工具。Preset 中删除 `tool-web` 后，宿主服务依然可以存在，模型已经没有调用它的入口。

这个区别也关系到安全。隐藏 Shell 工具可以阻止模型主动调用 Shell，但 Preset 文件本身仍是一份受信任的插件组合。租户隔离、文件权限和危险命令审批仍要由宿主的沙箱与权限系统承担。工具可见性控制模型能做什么，宿主策略决定一次调用最终是否获准执行。

## Skill、Tool、Workflow 与 Preset

这四个词经常出现在同一个界面里，负责的事情并不相同。

| 概念 | 它回答的问题 | 例子 |
| --- | --- | --- |
| Skill | 一类任务应该怎样完成 | 数据库查询规范、代码审查方法 |
| Tool | Agent 可以执行什么动作 | 网页搜索、文件读取、数据库查询 |
| Workflow | 一项任务按什么步骤推进 | 检索资料、生成方案、交给审查 Agent |
| Agent Preset | 这个 Agent 由哪些部分组成 | Persona、提示词、工具、Skills、计划和工作流 |

产品开发规范可以先写成 Skill，让通用 Agent 偶尔加载。任务长期重复，并且需要固定的工具、权限和输出格式时，可以建立产品开发 Agent Preset。固定执行顺序继续交给 Workflow。

Preset 管的是一整套模型侧组装。Skill 只是其中一种可加载内容。

## 四种随附模式怎样理解

当前 CLI 随附四种 Agent Preset。它们共享宿主，面向模型的组合不同。

| 模式 | 模型侧特点 | 适合的任务 |
| --- | --- | --- |
| 标准模式 | 文件、代码、Shell、网页、计划和子 Agent 等能力较完整 | 日常开发和综合任务 |
| PTC 模式 | 保留标准能力，并通过 Code Mode SDK 让模型用 TypeScript 程序组织多次工具调用 | 批量读取、复杂搜索和结构化处理 |
| 极简模式 | 固定提示词，只组合持久 Bash 与文本编辑工具 | 简单、明确、短上下文任务 |
| 创造模式 | 在标准能力上加入运行时检查、临时插件实验和 Preset 创作工具 | 创建或改造 Agent |

极简模式仍然运行在共享的浏览器、工作区、持久化、沙箱和权限宿主上。工具少，宿主并没有跟着消失。

创造模式携带 Cordis 检查与 Preset 创作能力。正常做法是复制一份随附 Preset，在用户目录中修改副本。随部署提供的标准组合继续保持原样，升级时也不会覆盖用户副本。

## 上下文压缩属于可组装能力

会话日志与模型当前看到的内容分开保存。用户消息、模型回答、工具调用和压缩事件进入持久日志，模型请求则从日志派生出当前可见内容。

Token 压力上升时，压缩插件可以先裁剪旧工具结果，再把一段较早的可见内容换成摘要。`compaction/start`、`compaction/summary` 和 `compaction/end` 会记录这次压缩，摘要则作为一条替换消息进入模型 Surface。原始事件仍留在仅追加日志中，后续恢复和回放可以继续使用。

压缩是一项可选 Capability。标准、PTC 与创造模式可以组合它，极简模式可以保持更小的能力集合。

## 与成品 Agent 的差别落在组装粒度

Codex、Claude Code 和 WorkBuddy 都提供 Skills、MCP、权限、自定义指令或子 Agent 等扩展能力。它们已经为编程和日常任务设计好主要运行方式，使用者在产品给出的接口上增加能力。

DeepSeek Harness 把单个 Agent 的模型侧组合继续开放了一层。开发者可以为每个新会话选择 Persona、工具、Skills、压缩、计划和工作流。共享宿主继续管理进程级设施。

这种结构很适合专用 Agent。问数 Agent 可以只保留指标查询、只读 SQL、权限校验和图表工具；代码审查 Agent 可以读取代码和差异，但拿不到文件修改与 Shell；研究 Agent 则只保留网页和资料整理能力。

我以后再判断一项 Harness 功能时，会先看它位于宿主组合还是 Agent Preset。这个位置决定了修改会影响整个进程，还是只改变一个 Agent 的模型视图。

> 下一篇 [Cordis 如何组织 Harness 的插件](/posts/deepseek-harness-cordis/)

## 参考资料

- [DeepSeek Harness 架构说明](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/architecture.md)
- [Agent Preset 说明](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/preset/agent-presets/README.zh.md)
- [随附 Preset 配置](https://github.com/deepseek-ai/deepseek-harness/tree/master/apps/cli/config/agent-presets)
- [上下文压缩说明](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/subsystems/compaction.md)
