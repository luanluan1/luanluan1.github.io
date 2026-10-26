---
title: "DeepSeek Harness（二）Cordis 如何组织插件"
description: "理解 Cordis 的 Plugin、Service、Context、Inject、Effect、Event 与 Scope，以及这些机制怎样支撑 Agent Preset。"
published: 2026-08-14T16:20:00+08:00
tags: ["DeepSeek Harness", "Cordis", "插件系统", "依赖注入", "Agent"]
category: "AI 工程"
comment: false
---

> 系列目录 [DeepSeek Harness 学习笔记](/posts/deepseek-harness-notes/) · 上一篇 [Agent Preset 如何组装一个 Agent](/posts/deepseek-harness-agent-preset/)

Agent Preset 能让两个会话看到不同的工具，背后依靠的是 Cordis。它是 DeepSeek Harness 底层的 TypeScript 插件运行框架，负责加载插件、连接服务、等待依赖、管理作用域，并在插件卸载时清理它注册过的内容。

Cordis 不回答用户问题，也不参与模型训练。它管理运行 Agent 所需的程序模块。

DeepSeek Harness、Agent Preset 和 Cordis 可以这样放在一起理解。

```text
DeepSeek Harness    完整的 Agent 产品
Agent Preset        单个 Agent 的模型侧组装
Cordis              运行插件和组装方案的框架
```

## 为什么要把功能做成插件

一个完整 Agent 会逐渐接入模型、系统提示词、工具、会话、压缩、文件系统、网页检索、权限、工作流和子 Agent。把这些功能全部接进一个主程序，任何替换都会牵动大量代码。

Cordis 让每项能力由插件提供，再由 YAML 配置决定挂载哪些插件。DeepSeek Harness 的模型适配器、工具注册表、会话日志和 Agent Loop 都采用了这种方式。插件树改变以后，应用的能力随之改变。

Cordis 同时处理服务发现、依赖注入、类型化事件、生命周期、可撤销 Effect、Scope 隔离、配置加载和热更新。把它看成一个带事件系统的服务容器，会比把它理解成插件文件夹更准确。

## Plugin、Service 与 Tool

Plugin 是被 Cordis 安装和管理的代码模块。它可以注册服务、监听事件，也可以向其他注册表贡献内容。

Service 是插件公开给其他插件使用的程序接口。服务通过稳定的 `ctx.<key>` 访问，例如 `ctx.llm`、`ctx.tools`、`ctx.sessions` 和 `ctx.compaction`。

Tool 是最终暴露给模型调用的动作。模型只会看到 Tool Schema，不需要知道后面连接了哪些插件。

网页检索可以拆成下面这条链。

```text
Web Provider Plugin
        ↓ 提供
ctx.web 服务
        ↓ 被消费
Tool Web Plugin
        ↓ 注册
模型看到 web_search
```

网页 Provider 可以替换，模型工具的名称和参数仍可保持稳定。工具插件只依赖 `ctx.web` 这个接口。

## Cordis Context 与模型上下文

Cordis Context 是运行时的服务容器。`ctx.llm` 指向模型服务，`ctx.tools` 指向工具注册表，`ctx.sessions` 管理会话。插件通过 Context 找到能力，无需直接导入某个具体实现。

模型上下文是一次请求发送给大模型的消息、系统提示词和工具定义。Cordis 插件会共同生成这些内容，Cordis Context 自己不会进入聊天记录。

同一个“上下文”在这里指向两种东西。读源码时看到 `ctx`，通常先按运行时服务容器理解；看到 messages、prompt sections 或 tool schemas，才是在讨论模型当前能够读取的内容。

## Inject 让插件等待依赖

插件可以通过 `inject` 声明自己需要的服务。网页工具依赖 `ctx.web` 时，Cordis 会等网页 Provider 准备完成，再启动工具插件。

```text
网页工具已经挂载
        ↓
ctx.web 尚未出现，插件保持等待
        ↓
网页 Provider 提供 ctx.web
        ↓
网页工具进入运行状态
```

加载顺序由服务依赖表达，开发者无需手工排一套启动时序。删除 Provider 却保留 Consumer 时，依赖无法满足，相关插件会继续等待，Preset 挂载审计也可能把这份组合判为不可用。

插件可以删除，组合仍然必须满足依赖约定。

## Effect 负责把注册撤回

插件运行后可能注册一个工具、一段系统提示词、一个事件监听器，或者启动后台任务。这些动作都会改变运行时。

Cordis 让注册跟随 Effect 生命周期。插件卸载时，Effect 一起释放，工具从目录中消失，监听器取消，后台任务停止。热更新因此可以先卸载旧实现，再挂载新实现。

缺少这套清理机制，重复加载很容易留下两个同名工具和多份监听器。旧服务已经失效，回调却仍可能继续收到事件。

DeepSeek Harness 对 vendored Cordis 的生命周期还做了额外修补，用于处理插件加载和卸载同时发生时的清理问题。这也是项目把 Cordis 源码纳入自身仓库的原因之一。

## Event 把策略接进 Agent Loop

一次 Agent Turn 会经过输入、模型请求、工具调用和结果写入。Cordis Event 给插件留下介入位置。

```text
用户消息
  ↓
turn/start
  ↓
agent/pre-step
  ↓
组装提示词、历史与工具定义
  ↓
agent/request → llm/stream
  ↓
tool/call
  ↓
tools/pre-execute → tools/execute → tools/post-execute
  ↓
消息和工具结果写入会话日志
  ↓
step/end → turn/end
```

压缩插件可以在模型请求前检查 Token 压力。权限策略可以在工具执行前拒绝危险操作。遥测插件记录模型耗时，Guard 插件检查重复调用。Agent Loop 只保留共同的执行过程，各项策略从事件接入。

Cordis 支持 `emit`、`waterfall`、`parallel` 和 `serial` 等分发方式。它们决定监听器是单纯观察、并行处理，还是按顺序传递结果。

## Waterfall 是一条可拦截的处理链

Waterfall 监听器会收到当前参数和 `next()`。调用 `next()` 会把处理继续交给下一环，直接返回则可以终止这条链。监听器也能包装下游结果。

一项有风险的工具调用可以经过参数处理、权限判断、用户审批和沙箱策略。任何一环拒绝后，请求都不会到达真正的执行器。只负责记录信息的监听器则调用 `next()`，让后续处理继续。

权限、审批和遥测因此可以单独实现。工具作者专注于动作本身，宿主组合决定哪些策略包在外面。

## Scope 让多个 Agent 共用一个进程

Harness 为每个 Agent 建立自己的 `agent.ctx`。工具、提示词和 Skills 按 Scope 注册，读取时再沿当前 Scope 的父链合并。

```text
Host Context
├─ Agent A Scope  网页检索
├─ Agent B Scope  代码、文件和 Shell
└─ Agent C Scope  数据库查询与报表
```

Agent Preset 会建立一份常驻 Preset Scope。会话选择它以后，Agent Scope 认父到对应的 Preset Scope。工具注册表仍是同一套服务，查询结果会根据当前 Agent 的作用域变化。

这也解释了纯网页检索 Agent 的现象。宿主继续保留网页 Provider、模型路由和会话服务，Preset 只向自己的 Scope 注册 Persona 与网页工具。模型读取当前工具目录时，自然看不到文件和 Shell。

## Capability Seam 让实现可以替换

Harness 把一项完整能力拆成 Service Definition、Service Provider 和 Consumer。

Service Definition 定义稳定接口。Provider 给出本地、远程或沙箱实现。Consumer 使用接口，可以是模型工具，也可以是另一个服务。

文件与进程能力共享同一个执行环境。将对应 Provider 指向远程沙箱以后，Bash、PTY 和 LSP 等消费者可以继续使用原来的服务接口，无需分别实现一套远程版本。

这种拆法的价值很具体。替换能力提供方，所有消费者一起迁移。

## Profile、Bundle、Patch 与 Preset

Cordis 的配置还有几层组合单位。

| 名称 | 作用范围 |
| --- | --- |
| Bundle | 分发一组 Cordis 插件配置和代码 |
| Profile | 决定应用启动时叠加哪些 Bundle |
| Patch | 修改、禁用或插入宿主插件行 |
| Agent Preset | 为单个 Agent 挂载模型侧插件 |

一套 Web 启动配置会从空列表开始，依次应用 Base Bundle、Web App Bundle、Profile Patch、用户全局 Patch 和命令行 Patch。Agent 创建时再加入所选 Preset。

```powershell
dsh --profile web --dump-config
```

这条命令可以打印宿主最终启动的插件树。检查一个服务究竟从哪里出现时，它比只读某一份 YAML 更可靠。

## 创造模式怎样使用 Cordis

创造模式是一份带 Cordis 检查与创作能力的 Agent Preset。它保留标准模式的工具，又加入 `tool-cordis` 和随 Preset 携带的创作 Skills。

它可以检查运行中的插件与服务，复制标准 Preset，编辑用户副本，临时挂载插件，再验证新组合能否正常启动。它调用现有的 Agent Loop 和 Cordis Loader，没有重新实现一套运行时。

随部署提供的 Preset 应当作为只读起点。创造模式先复制，再修改用户目录中的副本。这样既能保留已知可用的依赖关系，也能避免升级覆盖自定义内容。

## 可组合仍然有约束

Provider 被移除后，依赖它的 Consumer 可能无法启动。进程级服务也不能在多个 Preset 中重复注册。需要由某个 Preset 独占的服务要放入隔离 Realm，避免同名服务撞到根作用域。

模型工具从 Preset 中消失，不会自动撤销宿主权限。Preset 本身与它引用的插件处在较高信任级别，真正的文件隔离和命令限制仍由沙箱、审批及部署策略执行。

“所有功能都是插件”描述的是 Harness 的产品模块。Cordis 自己仍然有 Context、Fiber、Service Registry 和 Loader 等框架代码，插件必须遵守这些生命周期与事件约定。

## Harness 为什么直接带着 Cordis 源码

仓库把 Cordis 与相关基础库放在 `vendor/` 中，并把包名改到 `@deepseek-ai` 命名空间。这样可以固定版本，审计和修改生命周期行为，再与 Harness 一起测试及发布。

这份 vendored 源码保留上游版本和许可证，也记录了 Harness 做过的本地修改。更新 Cordis 时，维护者需要重新同步源码、应用这些修改并运行完整测试。

读完这一层以后，Agent Preset 的行为就容易解释了。Preset 是一棵按会话挂载的 Cordis 插件树。它通过 Scope 改变模型视图，通过 Inject 连接宿主服务，通过 Effect 保证卸载能够清理干净。

## 参考资料

- [DeepSeek Harness 架构](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/architecture.zh.md)
- [Cordis 入门](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/cordis-primer.md)
- [Agent Preset 机制](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/preset/agent-presets/README.zh.md)
- [Vendored Cordis 说明](https://github.com/deepseek-ai/deepseek-harness/blob/master/vendor/README.md)
