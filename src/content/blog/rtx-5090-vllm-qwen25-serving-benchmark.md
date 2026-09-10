---
title: 'RTX 5090 实战 vLLM：为什么 4 并发吞吐接近单并发的 4 倍？'
description: '单卡部署 Qwen2.5-7B-Instruct，比较 1、4、8 路客户端并发：吞吐从 101 增至 406 tok/s 后趋于平台，首 token 延迟却升至 1.25 秒。'
pubDate: '2026-09-10T09:00:00+08:00'
tags: ['vLLM', 'Qwen', '模型部署', '性能测试', '推理服务']
---

最近在优云智算租了一张 RTX 5090 32GB，把 Qwen2.5-7B-Instruct 从模型文件跑成了 HTTP 服务，又做了三组并发压测。

最有收获的部分发生在接口跑通之后：客户端从单并发提高到 4 并发，总输出吞吐从 **101.22 tok/s** 增至 **405.67 tok/s**，单个请求开始输出后的 token 间隔几乎没变。继续加到 8 并发，吞吐没有再涨，平均首 token 延迟却到了 **1.25 秒**。

这让我开始把“模型能回答”与“服务能承受多少请求”分开看。先交代一个影响整篇结论的条件：**服务端始终设置了 `max-num-seqs = 4`。这次测到的是这套配置的表现，不能据此认定 RTX 5090 的最佳并发就是 4。**

## 从模型调用到推理服务

单独写 Python，加载模型，再调用 `transformers.generate()`，很适合验证模型效果。当 RAG、Agent 和 Web 应用需要共同调用它时，还需要处理 HTTP 接口、请求调度和运行状态。

我这次搭起来的链路是：

```text
RAG / Agent / Web 应用
         ↓ HTTP 请求
OpenAI 兼容 API
         ↓
vLLM：模型执行与请求调度
         ↓
Qwen2.5-7B-Instruct / RTX 5090
```

Qwen 负责生成回答，vLLM 负责运行模型并组织请求。后面的实验，就是观察多个请求同时进来时，这层调度会带来什么变化。

## 实验环境与服务启动

下面保留的是本次实验记录中的环境版本，并非通用安装要求。

| 项目 | 本次环境 |
| --- | --- |
| GPU | NVIDIA GeForce RTX 5090 |
| 显存 | 32607 MiB，约 32GB |
| CPU / 内存 | 14 核 / 64GB |
| 系统 | Ubuntu 22.04 |
| Python | 3.12 |
| vLLM | 0.25.1 |
| PyTorch | 2.11.0+cu130 |
| PyTorch CUDA Runtime | 13.0 |
| nvidia-smi 显示的 CUDA 版本 | 13.3 |
| 模型 | Qwen2.5-7B-Instruct |

这里把 PyTorch Runtime 与 `nvidia-smi` 的显示值分开记录，避免把两个数字当成同一个软件包版本。

启动前，先看 GPU 与运行环境：

```bash
nvidia-smi
command -v python
command -v vllm
vllm --version
```

再做一次最小 GPU 运算：

```python
import torch

print("PyTorch:", torch.__version__)
print("CUDA runtime:", torch.version.cuda)
print("CUDA available:", torch.cuda.is_available())
print("GPU:", torch.cuda.get_device_name(0))
x = torch.ones(1, device="cuda")
print("GPU test:", (x + x).item())
```

本次 `CUDA available` 返回 `True`，识别到 RTX 5090，运算结果为 `2.0`。

模型复用了平台挂载的公共目录，省去了重复下载。以下命令均在 GPU 容器的 Bash 终端执行：

```bash
vllm serve /model/ModelScope/Qwen/Qwen2.5-7B-Instruct \
  --served-model-name qwen7b \
  --host 127.0.0.1 \
  --port 8000 \
  --dtype half \
  --max-model-len 4096 \
  --max-num-seqs 4 \
  --gpu-memory-utilization 0.85
```

几个参数直接影响后面的理解：

| 参数 | 含义 |
| --- | --- |
| `--served-model-name qwen7b` | API 请求使用的模型别名 |
| `--dtype half` | 使用 FP16 |
| `--max-model-len 4096` | 单条序列的上下文上限，包含输入与输出 |
| `--max-num-seqs 4` | 每轮调度允许处理的最大 sequence 数 |
| `--gpu-memory-utilization 0.85` | 为当前实例设置 GPU 显存预算比例，并不表示 GPU 计算利用率达到 85% |

参数语义可对照 [vLLM serve 文档](https://docs.vllm.ai/en/latest/cli/serve/)；不同版本的选项以运行环境的帮助输出为准。

服务监听在容器的回环地址，因此下面的调用和压测也在容器内执行。首次启动需要等待模型加载及初始化。旧部署记录里第一次请求遇到过 `Connection refused`，稍后服务就绪后重试成功。

```bash
curl -sS http://127.0.0.1:8000/v1/models

curl -sS http://127.0.0.1:8000/v1/chat/completions \
  -H 'Content-Type: application/json' \
  -d '{
    "model": "qwen7b",
    "messages": [
      {"role": "user", "content": "用简单中文解释什么是大模型推理。"}
    ],
    "max_tokens": 256,
    "temperature": 0.7
  }'
```

到这一步，接口已经能正常返回中文回答。接下来才是这次实验的重点。

## 三组压测，先把条件摆在一起

测试使用随机输入，目标输入长度 512 tokens、输出长度 128 tokens，开启 `--ignore-eos`。服务端保持前面的启动参数。

单并发的命令如下：

```bash
vllm bench serve \
  --backend openai-chat \
  --base-url http://127.0.0.1:8000 \
  --endpoint /v1/chat/completions \
  --model qwen7b \
  --tokenizer /model/ModelScope/Qwen/Qwen2.5-7B-Instruct \
  --dataset-name random \
  --num-prompts 20 \
  --max-concurrency 1 \
  --random-input-len 512 \
  --random-output-len 128 \
  --ignore-eos
```

第二组把 `--max-concurrency` 改为 `4`。第三组把它改为 `8`，**同时将 `--num-prompts` 改为 `40`**，并非所有条件完全相同。基准工具选项见 [vLLM bench serve 文档](https://docs.vllm.ai/en/latest/cli/bench/serve/)。

| 指标 | 客户端并发 1 | 客户端并发 4 | 客户端并发 8 |
| --- | ---: | ---: | ---: |
| 请求数 | 20 | 20 | 40 |
| 成功 / 失败 | 20 / 0 | 20 / 0 | 40 / 0 |
| 测试耗时（s） | 25.29 | 6.31 | 13.15 |
| 请求吞吐（req/s） | 0.79 | 3.17 | 3.04 |
| 输出 token 吞吐（tok/s） | 101.22 | 405.67 | 389.46 |
| 输入与输出总吞吐（tok/s） | 529.05 | 2120.25 | 2035.55 |
| Mean TTFT（ms） | 53.62 | 37.09 | 1249.35 |
| P99 TTFT（ms） | 60.99 | 55.24 | 1511.11 |
| Mean TPOT（ms） | 9.53 | 9.64 | 9.78 |
| P99 TPOT（ms） | 9.55 | 9.67 | 未记录 |

第三组的 Median TTFT 为 1310.22 ms。由于请求数不同，三组不能只比较总耗时；吞吐和请求延迟更适合放在一起观察。

输入 512 tokens 是命令中的目标值。表格保留原始 benchmark 输出，没有用“请求数 × 512”重新计算总吞吐；聊天模板、分词与工具的实际统计口径需要结合完整日志核对。

## 4 并发：总吞吐提高，单路输出节奏基本不变

从 1 到 4 并发，输出吞吐提升约 **4.01 倍**，而平均 TPOT 仅从 9.53 ms 变成 9.64 ms。

这两个数字放在一起，比单独看“406 tok/s”更有意义。406 tok/s 是所有请求合计的输出吞吐，不代表每个用户都以这个速度收到回答。单路开始输出后的平均节奏，仍大约是每 10 ms 一个 token。

自回归生成需要依据之前的 token 继续生成。只有一个请求时，一轮解码中的计算规模可能不足以充分利用 GPU；多个请求一起执行时，可以把它们当前需要的计算组织成批次。vLLM 的 continuous batching 允许随请求完成和进入持续调整批次。

本次结果与这种批处理收益一致。不过我没有同步记录 GPU 利用率曲线，因此只能确认吞吐提高，不能据此声称已经测到 GPU 被完全吃满。

4 并发的平均 TTFT 还从 53.62 ms 降到了 37.09 ms，但这只是短测试的观测值。没有重复实验和受控预热，不能把它推广成“提高并发一定降低首 token 延迟”。

## 8 并发：吞吐趋于平台，首 token 开始变慢

客户端并发到 8 后，总输出吞吐为 389.46 tok/s，比 4 并发略低；平均 TTFT 则从 37.09 ms 上升到 1249.35 ms，约为原来的 33.7 倍。与此同时，平均 TPOT 只有 9.78 ms。

用户感受到的变化大致是：等待回答开始的时间明显拉长，一旦开始输出，速度仍然接近之前。

这时需要区分两个参数：

| 参数 | 控制什么 |
| --- | --- |
| 客户端 `--max-concurrency 8` | 压测工具最多维持 8 个未完成请求 |
| 服务端 `--max-num-seqs 4` | 每轮最多调度 4 条 sequence |

对于这次每个请求生成一条序列的简单场景，可以近似理解成：客户端维持 8 个请求，而服务端同一轮只给其中最多 4 条序列安排计算，其他请求需要等待调度。sequence 与 HTTP 请求并非在所有生成配置下都一一对应。

因此，客户端继续加压不会自动提高服务端的调度上限，也不意味着第 5 个请求必然被拒绝。本次 40 个请求全部成功，但等待时间已经反映在 TTFT 上。

**调度等待是这组现象的主要解释，但还不是独立测量出的排队耗时。** TTFT 还包含首 token 之前的其他处理过程。要进一步确认，应结合等待队列指标和请求级时间记录；同样，这次约 4% 的吞吐下降不足以证明更高并发必然降低吞吐。

## TTFT 和 TPOT，对应两段不同的体验

TTFT（Time To First Token）衡量请求发出到收到首个 token 的时间。token 不一定对应一个汉字，所以“多久看到第一个字”只是体验上的近似说法。

TPOT（Time Per Output Token）描述首 token 之后，平均每个输出 token 所花的时间。流式基准通常按每条请求首 token 之后的耗时，除以后续输出 token 数来统计。它与整体输出吞吐的分母和聚合方式不同。

这次 8 并发的 TTFT 明显变差，而 TPOT 相对稳定，提示我优先检查排队和调度情况。只看总 tok/s，很容易漏掉用户已经开始“等半天才有反应”的问题。

## 用监控补齐压测看不到的部分

vLLM 提供 Prometheus 指标端点，可以先在容器里查看：

```bash
curl -sS http://127.0.0.1:8000/metrics
```

本次记录中关注的指标包括：

```text
vllm:num_requests_running
vllm:num_requests_waiting
vllm:kv_cache_usage_perc
vllm:prompt_tokens_total
vllm:generation_tokens_total
vllm:prefix_cache_queries_total
vllm:prefix_cache_hits_total
```

具体名称与标签以运行版本的 `/metrics` 为准。空闲时曾观察到 running、waiting 和 KV Cache 使用指标为 0，这说明当时没有活动负载；单凭这几个值，不能判定服务的所有功能都正常，仍需配合实际请求验证。

下一轮我更想把 waiting、KV Cache 和 TTFT 放在同一条时间线上，观察请求增加后到底先出现什么变化。

## 这次能下的结论，以及还不能下的结论

在单卡 RTX 5090、Qwen2.5-7B-Instruct、目标输入 512 tokens、输出 128 tokens、服务端 `max-num-seqs=4` 的配置下，4 路客户端并发比单路获得了约 4 倍的总输出吞吐。继续加到 8 路，没有观察到更多吞吐，却出现了明显的首 token 延迟增长。

这是一组阶段性记录。每组只有 20 或 40 个请求，未记录重复轮次、预热与缓存控制情况；P99 尤其容易受少数样本影响。它足以帮我理解调度上限与体验之间的关系，还不足以作为硬件极限或生产容量承诺。

容量规划也不能直接拿注册用户数来换算并发。500 名员工可能只有少数人同时发起生成；更长的输入、更长的回答、请求到达速率以及允许的等待时间，都会改变系统实际承受的负载。

接下来优先做三件事：

1. 将服务端 `max-num-seqs` 设为 4、8、16，分别测试客户端 8、16、32 并发；统一请求数、预热方式和重复轮次。
2. 改变输入与输出长度，记录 KV Cache、等待队列、TTFT 和 TPOT，找出不同负载下的吞吐与延迟边界。
3. 单独比较前缀缓存开关及命中情况，再逐步探索 BF16、FP8、INT4 的可用方案，并同时评价回答质量。

之后再补 Prometheus + Grafana、Docker 部署、LiteLLM Gateway 和应用侧 tracing。这些是后续计划，不属于本次已经验证的能力。

第一次接口返回中文时，我确认的是模型能跑。做完这三组测试，我开始关心的是：请求多起来以后，吞吐涨了多少，用户先在哪一步感到变慢。这是这次从部署走向推理服务工程最具体的一点收获。
