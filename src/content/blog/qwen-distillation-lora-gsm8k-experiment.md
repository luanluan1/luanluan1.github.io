---
title: '单卡 RTX 5090 做 Qwen 回答蒸馏，为什么训练后还少答对了 3 题'
pubDate: '2026-09-11T09:00:00+08:00'
description: '用 RTX 5090 完成 Qwen2.5-7B 到 0.5B 的回答蒸馏。474 道配对训练题、两组 LoRA 和 200 道固定测试，教师回答组得到 45% 正确率，高于原始解答组的 35%，却仍未超过原始学生。记录训练过程、评分修正，以及总分背后的逐题变化。'
image: '/assets/images/distillation/cover.png'
tags: ['知识蒸馏', 'LoRA', 'Qwen', '模型评测', 'vLLM']
category: 'AI 工程'
comment: false
---

两组 LoRA 都顺利训练完了，每组只用了两分钟左右。把 200 道测试题跑完，我得到的却是一个不太好写成“成功案例”的结果。

**教师回答组答对 90 题，普通微调组答对 70 题。未经训练的原始学生，答对了 93 题。**

7B 教师生成的解答在这次对照中更有效，但这轮训练没有提高 0.5B 学生的总体数学准确率。继续逐题看，蒸馏组学会了原先不会的 21 题，也答错了原先会的 24 题。只看总分，几乎看不到这 45 道题发生过变化。

![四组模型在固定 200 道 GSM8K 测试题上的最终数值正确率，原始学生 46.5%、A 组 35%、B 组 45%、教师 87%](/assets/images/distillation/results.png)

这篇记录从租用 GPU、部署教师服务开始，一直写到 LoRA 训练和评分修正。所有数字来自这轮实验记录；图表由保存的结果重新绘制，训练没有为写文章而重跑。原始学生还有一道人工判分争议题，后面会交代它对结论的影响。

## 我做的是什么蒸馏

我采用的是序列级回答蒸馏。教师模型先根据问题生成完整解答，学生模型再通过监督微调学习这些回答。

```text
GSM8K 问题
    ↓
Qwen2.5-7B 教师生成解答
    ↓
用标准答案检查最终数字
    ↓
保留教师答对的题目
    ↓
构造两份题目相同的训练集
    ↓
A 组学习 GSM8K 原始解答
B 组学习 7B 教师解答
    ↓
分别从原始 0.5B 训练 LoRA
    ↓
在同一批 200 道测试题上比较
```

本次训练没有读取教师 logits，也没有让学生拟合教师的 token 概率分布。这类实验可以称为教师回答蒸馏、序列级蒸馏，或者离线教师数据加 LoRA SFT。

## 云服务器配置

我在优云智算租用了独占式 GPU 容器，创建页面显示的按量价格为每小时 3.20 元，这是当时页面记录的价格。最终使用的配置如下。

| 项目 | 配置 |
|---|---|
| GPU | NVIDIA GeForce RTX 5090 32GB |
| GPU 数量 | 1 |
| CPU | 14 核 |
| 内存 | 64GB |
| 系统盘 | 100GB |
| 镜像 | Ubuntu 22.04，CUDA 13 系列，PyTorch 与 vLLM 环境 |
| vLLM | 0.25.1 |
| Python | 3.12 |
| PyTorch | 2.11.0+cu130 |

我原本担心 50GB 系统盘不够，所以将系统盘扩到了 100GB。实际模型已经挂载在平台公共目录 `/model`，没有复制到系统盘。训练数据、日志和两份 LoRA adapter 的占用也不大，因此本次 100GB 很充裕。如果平台已经提供公共模型，7B 加 0.5B 的这类 LoRA 实验通常不需要继续扩盘。

GPU 容器本身已经运行在平台的容器环境中。实验直接在这个环境里运行 Python 和 vLLM，没有必要再套一层 Docker。额外嵌套 Docker 会增加设备映射、共享内存和 NVIDIA Runtime 配置工作，对这次单机实验没有帮助。

## 先确认教师服务能正常回答

GPU 检查、公共模型目录和接口验证，我在[上一篇 vLLM 部署与压测记录](/posts/rtx-5090-vllm-qwen25-serving-benchmark/)中写过。这次继续使用同一套环境，教师选 Qwen2.5-7B-Instruct，学生选 Qwen2.5-0.5B-Instruct，模型直接从 `/model/ModelScope/Qwen/` 读取。

教师服务按下面的参数启动，命令在 GPU 容器内执行。

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

我先确认 `/v1/models` 返回 `qwen7b`，再发送一次真实问答。模型能生成中文回答后，才开始准备教师数据。

## 固定实验数据

实验使用公开的 GSM8K 数学应用题。数据提前划分并保存为 JSONL 文件。

| 文件 | 数量 | 用途 |
|---|---|---|
| `math_data/train.jsonl` | 500 | 生成候选教师训练答案 |
| `math_data/valid.jsonl` | 100 | 训练验证与基线排查 |
| `math_data/test.jsonl` | 200 | 最终统一测试 |
| `math_data/smoke.jsonl` | 20 | 教师生成试跑 |

三份正式数据之间没有重复题目。划分使用固定随机种子，并在 manifest 中保存来源、原始行号和校验信息。测试集在训练、教师样本过滤和参数选择中都不使用。

每条原始数据包含问题、参考解答和编号。训练脚本最后会把它转换成聊天格式。

```json
{
  "id": "train_0000",
  "input": "一道 GSM8K 问题",
  "reference": "数据集提供的推理过程\n#### 42"
}
```

教师收到的提示要求简短解释计算过程，并在最后单独输出 `#### 数字`。请求中没有发送参考答案，所以教师需要自行解题。

```text
Solve the math problem. Explain your calculation briefly.
End with a separate line: #### <numeric answer>.
Do not include a unit or currency symbol after ####.
```

## 先用 20 道题检查教师生成

正式生成 500 条回答之前，我先跑了 20 条 smoke 数据。

```bash
cd /root/distill-lab
mkdir -p results/math

python math_ab.py generate \
  --input math_data/smoke.jsonl \
  --output results/math/teacher_train.jsonl \
  --model qwen7b

python math_ab.py score \
  --input math_data/smoke.jsonl \
  --responses results/math/teacher_train.jsonl \
  --output results/math/teacher_smoke_score.json
```

20 道题全部答对，说明 API 请求、回答保存、答案解析和评分可以共同工作。

## 生成并筛选 500 条教师回答

试跑通过后，我对 500 道训练题生成教师答案，使用四个 worker 并发请求。

```bash
python math_ab.py generate \
  --input math_data/train.jsonl \
  --output results/math/teacher_train.jsonl \
  --model qwen7b \
  --workers 4
```

生成脚本会在每条请求完成后立即追加写入 JSONL。重新执行时，已经正常结束的编号会被跳过，网络错误也会自动重试。这能避免长任务因一次中断全部重来。

随后按照最终数值严格评分。

```bash
python math_ab.py score \
  --input math_data/train.jsonl \
  --responses results/math/teacher_train.jsonl \
  --output results/math/teacher_train_score.json
```

教师在 500 道候选题中答对 474 道，严格正确率为 94.8%。497 条回答能解析出规定格式，另外 3 条格式异常或生成未完整结束。只有最终数字正确、生成正常结束、长度不超过 1024 tokens 的样本才能进入训练集。

```bash
python math_ab.py pair \
  --input math_data/train.jsonl \
  --responses results/math/teacher_train.jsonl \
  --student /model/ModelScope/Qwen/Qwen2.5-0.5B-Instruct \
  --output math_data/paired
```

最终生成两份各 474 条的配对数据。

```bash
wc -l math_data/paired/A.jsonl
wc -l math_data/paired/B.jsonl
```

A、B 使用完全相同的问题和顺序。A 的目标回答来自 GSM8K 原始参考解答，B 的目标回答来自 7B 教师。两组差别集中在学生学习的回答内容上。

教师最终数字正确，也不能证明中间每个推理步骤都正确。脚本额外生成了 `audit.jsonl`，正式使用前应抽样检查推理过程。

## 修复一次 JSONL 读取错误

第一次读取完整训练集时，程序抛出了 `JSONDecodeError`，提示字符串没有结束。我逐行调用 `json.loads` 检查，却得到全部正常；调用项目里的 `read()` 函数又会复现错误。

问题出在旧实现使用了 `read_text().splitlines()`。Python 的 `splitlines()` 会把某些 Unicode 行分隔符也当成换行，而这些字符可能合法出现在 JSON 字符串内部。一个物理 JSONL 记录因此被拆成两段，随后解析失败。

修复方法是按文件中的物理行迭代。

```python
def read(path):
    with pathlib.Path(path).open(encoding="utf-8") as source:
        return [json.loads(line) for line in source if line.strip()]
```

修改后再次调用 `read("math_data/train.jsonl")`，500 条记录可以全部读取。这次问题也说明，独立验证代码如果没有经过与生产函数相同的处理路径，可能得出文件正常而程序仍然失败的结果。

## 建立独立训练环境

平台原有 `py312` 环境已经可以稳定运行 vLLM。为了避免训练依赖升级破坏推理环境，我另外创建训练环境。

```bash
python -m venv /root/distill-train
source /root/distill-train/bin/activate

python -m pip install --upgrade pip
python -m pip install torch==2.11.0 --index-url https://download.pytorch.org/whl/cu130
python -m pip install transformers trl peft datasets accelerate
python -m pip check
```

安装完成后，我检查了关键库版本，并实际执行一次反向传播。

```bash
python - <<'PY'
import torch
import transformers
import trl
import peft

print("PyTorch", torch.__version__)
print("CUDA", torch.version.cuda)
print("GPU", torch.cuda.get_device_name(0))
print("Transformers", transformers.__version__)
print("TRL", trl.__version__)
print("PEFT", peft.__version__)

x = torch.ones(1, device="cuda", requires_grad=True)
(x * x).sum().backward()
print("gradient", x.grad.item())
PY
```

实测版本包括 Transformers 5.14.1、TRL 1.13.0 和 PEFT 0.20.0，反向传播结果为 2.0。

## 配置 LoRA 训练

A、B 两组都从原始 Qwen2.5-0.5B-Instruct 开始，不能先训练 A 再在 A 的 adapter 上继续训练 B。

| 参数 | 设置 |
|---|---|
| 精度 | BF16 |
| LoRA rank | 16 |
| LoRA alpha | 32 |
| LoRA dropout | 0.05 |
| 最大序列长度 | 1024 |
| 单卡 batch | 1 |
| 梯度累积 | 8 |
| 有效 batch | 8 |
| 学习率 | 1e-4 |
| 训练轮数 | 1 |
| 随机种子 | 42 |
| 训练目标 | 只计算 completion loss |

LoRA 覆盖注意力层的 `q_proj`、`k_proj`、`v_proj`、`o_proj`，以及前馈层的 `gate_proj`、`up_proj`、`down_proj`。训练同时启用梯度检查点，关闭 KV Cache。

## 先做 20 步训练试跑

在正式训练前，我用 A 组数据运行 20 个优化器更新步。

```bash
python lab.py train \
  --model /model/ModelScope/Qwen/Qwen2.5-0.5B-Instruct \
  --input math_data/paired/A.jsonl \
  --valid math_data/valid_sft.jsonl \
  --output results/math/adapter_A_smoke \
  --steps 20
```

试跑时，我检查 loss、梯度和保存文件是否正常。

- loss 和 grad norm 是否为有限值
- 第一批数据是否同时含有监督 token 和被屏蔽的提示 token
- 是否发生 CUDA OOM
- adapter、tokenizer 和运行指标是否正常保存

试跑耗时约 49.9 秒，PyTorch 峰值分配显存约 1.69 GiB。保存目录中出现 `adapter_model.safetensors`、`adapter_config.json` 和 `run_metrics.json`，训练链路通过。

峰值分配显存来自 `torch.cuda.max_memory_allocated()`，只统计 PyTorch 分配的张量内存，不能当成整个进程或整张显卡的完整显存占用。

## 正式训练 A、B 两组

正式训练重新从基础学生开始，不加载 smoke adapter。

```bash
python lab.py train \
  --model /model/ModelScope/Qwen/Qwen2.5-0.5B-Instruct \
  --input math_data/paired/A.jsonl \
  --valid math_data/valid_sft.jsonl \
  --output results/math/adapter_A

python lab.py train \
  --model /model/ModelScope/Qwen/Qwen2.5-0.5B-Instruct \
  --input math_data/paired/B.jsonl \
  --valid math_data/valid_sft.jsonl \
  --output results/math/adapter_B
```

A 组耗时约 123 秒，B 组约 120 秒。两组 PyTorch 峰值分配显存都在 1.70 GiB 左右。B 组结束时训练 loss 约为 0.2295，验证 loss 约为 0.8067。

训练 loss 下降可以说明模型在拟合训练目标，不能直接说明独立测试题的正确率会提高。最终判断仍依赖固定测试集。

## 加载基础学生和两个 LoRA

训练完成后，我退出训练环境，回到可以运行 vLLM 的 `py312` 环境。启动服务前先确认没有旧的教师服务占用显存。

```bash
deactivate
conda activate py312
nvidia-smi
```

随后让同一个基础学生同时挂载 A、B 两份 LoRA。

```bash
vllm serve /model/ModelScope/Qwen/Qwen2.5-0.5B-Instruct \
  --served-model-name student \
  --host 127.0.0.1 \
  --port 8000 \
  --dtype bfloat16 \
  --max-model-len 4096 \
  --max-num-seqs 4 \
  --gpu-memory-utilization 0.80 \
  --enable-lora \
  --max-lora-rank 16 \
  --lora-modules \
    sftA=/root/distill-lab/results/math/adapter_A \
    distilledB=/root/distill-lab/results/math/adapter_B
```

服务就绪后，`/v1/models` 同时列出了 `student`、`sftA` 和 `distilledB`。调用不同模型名，就可以让同一个基础权重使用不同 adapter。

## 在固定测试集生成四组回答

三组学生模型使用同一份 `math_data/test.jsonl` 和同一套生成代码。

```bash
python math_ab.py generate \
  --input math_data/test.jsonl \
  --output results/math/test_student.jsonl \
  --model student

python math_ab.py generate \
  --input math_data/test.jsonl \
  --output results/math/test_A.jsonl \
  --model sftA

python math_ab.py generate \
  --input math_data/test.jsonl \
  --output results/math/test_B.jsonl \
  --model distilledB
```

教师测试回答在 7B 服务下单独生成。运行这一步前，需要停止学生服务，再按前面的教师启动命令运行 7B 服务。

```bash
python math_ab.py generate \
  --input math_data/test.jsonl \
  --output results/math/test_teacher.jsonl \
  --model qwen7b
```

生成完成后，我先检查四个文件的行数，确认每组都有 200 条记录。

```bash
wc -l \
  results/math/test_student.jsonl \
  results/math/test_A.jsonl \
  results/math/test_B.jsonl \
  results/math/test_teacher.jsonl
```

严格格式评分可以分别执行下面四条命令。

```bash
python math_ab.py score \
  --input math_data/test.jsonl \
  --responses results/math/test_student.jsonl \
  --output results/math/test_student_score.json

python math_ab.py score \
  --input math_data/test.jsonl \
  --responses results/math/test_A.jsonl \
  --output results/math/test_A_score.json

python math_ab.py score \
  --input math_data/test.jsonl \
  --responses results/math/test_B.jsonl \
  --output results/math/test_B_score.json

python math_ab.py score \
  --input math_data/test.jsonl \
  --responses results/math/test_teacher.jsonl \
  --output results/math/test_teacher_score.json
```

这些命令生成的是严格格式分。原始学生没有遵守 `#### 数字` 格式，所以还需要使用保守提取脚本生成待复核清单。

```bash
python score_math_audit.py \
  --input math_data/test.jsonl \
  --responses results/math/test_student.jsonl \
  --output results/math/test_student_audit
```

脚本会保存 `report.json`、`details.jsonl` 和 `review.csv`。我检查 `review.csv` 中无法自动确定的答案，并把人工结论与对应响应文件的校验值一起保存。A、B 和教师回答也采用相同规则处理。

## 第一次评分为什么失真

最初的严格评分器只接受回答最后一行的 `#### 数字`。原始学生在 100 道验证题上只得到 1 分，看起来几乎完全不会做题。

检查原始回答后，我发现许多回答已经给出正确数字，只是结尾使用了粗体、`\boxed{}` 或普通自然语言，没有遵循指定格式。严格解析器把这些回答全部记为未解析。

这时不能直接把解析规则改成从全文搜索所有数字。数学推理中经常出现多个中间数，如果评分器根据标准答案从全文挑选恰好相等的数字，就会把答案泄漏进判分过程。

我后来采用两层评分。

- 严格格式分只认最后一行的 `#### 数字`
- 数值正确率先保守提取明确结论，再人工检查无法确定的记录

保守提取支持末段中唯一的 `\boxed{数字}`，或者带有 therefore、answer 等结论词且只出现一个数字的结尾。仍然含有多个候选数字的回答会进入人工复核。人工复核文件与原始响应 SHA256 绑定，避免误用到另一批回答。

重新评分后，原始学生在 100 道验证题上的数值正确率从表面上的 1% 变成 56%。这个变化完全来自评分修正，期间模型没有重新训练。

## 最终测试结果

四组模型在同一批 200 道测试题上分别统计格式遵循和最终数值正确率。两种指标分开看。

| 模型 | 训练材料 | 严格格式成功 | 最终数值正确 |
|---|---|---|---|
| 原始学生 0.5B | 无 | 0/200 | 93/200，46.5% |
| A 组 | 474 条 GSM8K 原始解答 | 198/200 | 70/200，35.0% |
| B 组 | 474 条 7B 教师正确回答 | 198/200 | 90/200，45.0% |
| 教师 7B | 无 | 200/200 | 174/200，87.0% |

原始学生的 93 题正确来自保守自动提取和 21 条人工判读。其中 `test_0003` 存在口径争议；若要求回答必须明确给出合计数值，这题应判错，原始学生为 **92/200，也就是 46.0%**。无论采用哪种口径，B 组的 45.0% 都没有超过原始学生。

B 组比 A 组多答对 20 道。两组都成功按严格格式回答 198 道题，所以这 20 道差距主要来自解题结果。

B 组仍比原始学生少答对 3 道。为了理解接近的总分，我又按题目比较训练前后的变化。

| 对比 | 前者独对 | 后者独对 | 两者都对 | 两者都错 |
|---|---|---|---|---|
| A 与原始学生 | 20 | 43 | 50 | 87 |
| B 与原始学生 | 21 | 24 | 69 | 86 |
| B 与 A | 41 | 21 | 49 | 89 |
| 教师与 B | 85 | 1 | 89 | 25 |

![B 组相对原始学生有 69 题保持正确、21 题错转对、24 题对转错、86 题均错误](/assets/images/distillation/transitions.png)

B 组让 21 道原本错误的题变对，同时让 24 道原本正确的题变错。总分只下降了 3 道，却掩盖了 45 道题的状态变化。A 组也新增了 20 道正确答案，同时损失 43 道原有正确题。

这组逐题变化提示了能力退化或遗忘的可能，但仅凭单次生成，还不能确定背后的机制。只看一个总准确率，无法解释这种交换。

## 怎样理解这次结果

我对这轮结果的判断需要同时看对照组和原始学生。

教师生成解答在本次配置下优于 GSM8K 原始参考解答。A、B 使用相同问题、相同基础学生、相同 LoRA 参数和相同训练轮数，B 最终比 A 多答对 20 道。

LoRA 微调明显改善了格式遵循。原始学生没有一条回答满足严格格式，A、B 各有 198 条满足格式要求。

本轮训练没有提升学生的总体数学准确率。B 为 45%，原始学生为 46.5%。因此不能把这次结果写成 7B 成功提升了 0.5B 的数学能力。

这个负结果仍然有价值。实验已经把数据生成、教师过滤、配对对照、LoRA 训练、多 adapter 推理、独立测试和逐题分析全部连起来，也暴露出格式收益、数学收益和遗忘之间的差别。

## 本次实验的限制

本次只使用一个随机种子并训练一轮，不能判断 20 道题的 A、B 差距在重复实验中是否稳定。GSM8K 是公开数据，Qwen 可能在预训练阶段接触过相关内容。教师样本只按最终数字过滤，正确答案不能证明整个推理过程可靠。

A、B 虽然样本数相同，回答长度和表达方式并不相同。相同 epoch 不等于相同监督 token 数，因此对照仍有一个未控制的变量。人工判分由单人完成，也没有进行双盲复核。

原始学生有 2 条回答因长度限制未正常结束，A、B 各有 1 条，教师没有截断。最终结果把这些记录计为错误。

## 下一轮怎样改进

下一轮我会保留当前固定测试集，至少运行三个随机种子，报告平均值和波动范围。学习率可以从 `1e-4` 降到 `5e-5`，训练两到三轮，并用验证集选择 checkpoint。

对照条件还可以改成固定监督 token 预算，避免教师解答与原始解答长度不同。增加一组只学习输出格式的训练数据，可以单独估计格式收益。教师数据除了检查最终数字，还应抽样验证推理步骤，并记录被拒绝样本的错误类型。

若下一轮仍然出现新题学会、旧题遗忘，可以减小学习率、加入一部分通用数学数据，或者使用带 KL 约束的训练方式减轻模型偏移。

## 可以继续核对的实验记录

[下载最终实验报告](/assets/images/distillation/REPORT.md) · [下载逐题对照 CSV](/assets/images/distillation/per_question_comparison.csv) · [下载汇总 JSON](/assets/images/distillation/summary.json)

这些文件保留了四组模型的评分和逐题变化，便于核对图表。CSV 的人工判读沿用本轮实验口径。
