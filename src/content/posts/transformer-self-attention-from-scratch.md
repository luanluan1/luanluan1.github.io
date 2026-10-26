---
title: "从词向量到 Self-Attention：手算一遍 Transformer 注意力"
description: "用“我爱北京”这个小例子，把输入向量、Q/K/V、Softmax、注意力矩阵和 O(n²) 串成一条完整计算链路。"
published: 2026-08-04T16:05:26+08:00
tags: ["Transformer", "Attention", "QKV", "深度学习"]
category: "模型原理"
comment: false
---

刚接触 Transformer 时，Attention、Q/K/V、Softmax 和矩阵乘法很容易变成一组互不相干的术语。这篇笔记只解决一个问题：一句话进入 Transformer 后，Self-Attention 到底做了什么？

## Transformer 为什么需要 Attention

RNN 和 LSTM 通常按顺序处理文本，前面的计算结果会传给后面。Transformer 则可以让一段文本中的 token 同时观察其他 token，再根据相关程度汇总信息。

例如：

```text
The animal didn't cross the street because it was too tired.
```

模型理解 `it` 时，需要重点联系 `animal` 和 `tired`，而不是只看紧挨着它的词。Attention 的作用就是为这些联系分配不同权重。

## 神经网络看到的是向量

用一个很短的输入举例：

```text
我 爱 北京
```

神经网络不能直接计算汉字，因此每个 token 都要先转换为数字向量。可以暂时写成：

```text
我   -> x1
爱   -> x2
北京 -> x3
```

`x1`、`x2`、`x3` 不是三个特殊概念，只是三个输入向量的名字。例如：

```text
x1 = [0.2, -0.5,  0.8,  0.1]
x2 = [0.7,  0.3, -0.2,  0.9]
x3 = [0.4,  0.6,  0.5, -0.1]
```

在最基础的位置编码方案中，真正送进 Attention 的输入还会加入位置信息：

```text
x = token embedding + position embedding
```

因此，同一个“我”出现在第一个位置和第三个位置时，最终输入向量并不相同。现代模型也常使用 RoPE 等方式把位置作用在 Q 和 K 上，但目的仍然是让模型区分顺序。

## Q、K、V 来自同一个输入

每个输入向量都会分别乘三组可训练的权重矩阵，得到 Q、K、V：

```text
Q = XWq
K = XWk
V = XWv
```

它们不是三份独立输入，而是同一组输入 `X` 的三种投影。可以用下面的分工建立直觉：

| 向量 | 作用 | 直觉 |
| --- | --- | --- |
| Q，Query | 发起匹配 | 当前 token 想找什么 |
| K，Key | 接受匹配 | 当前 token 可以怎样被找到 |
| V，Value | 提供内容 | 当前 token 真正贡献什么信息 |

于是每个 token 都会得到自己的 Q、K、V：

```text
我   -> Q1, K1, V1
爱   -> Q2, K2, V2
北京 -> Q3, K3, V3
```

## 先计算“爱”应该关注谁

假设现在要更新“爱”的表示，就拿 `Q2` 和所有 token 的 K 分别做点积：

```text
Q2 · K1    “爱”和“我”的匹配分数
Q2 · K2    “爱”和“爱”的匹配分数
Q2 · K3    “爱”和“北京”的匹配分数
```

假设得到的分数是：

```text
我:   2
爱:   1
北京: 3
```

这些值只表示相对大小，还不能直接作为加权比例。下一步要用 Softmax 把它们变成总和为 1 的权重。

## Softmax 怎样把分数变成权重

Softmax 对每个分数取指数，再除以所有指数之和：

```text
softmax(zi) = exp(zi) / sum(exp(z))
```

对 `[2, 1, 3]` 计算：

```text
exp(2) ≈  7.39
exp(1) ≈  2.72
exp(3) ≈ 20.09
总和   ≈ 30.20
```

分别除以总和：

```text
我:    7.39 / 30.20 ≈ 0.245
爱:    2.72 / 30.20 ≈ 0.090
北京: 20.09 / 30.20 ≈ 0.665
```

因此：

```text
[2, 1, 3] -> Softmax -> [0.245, 0.090, 0.665]
```

分数越大的位置获得越高权重，所有权重相加等于 1。

## 用权重汇总 V

得到权重后，再对所有 V 做加权求和：

```text
新的“爱” = 0.245 × V1 + 0.090 × V2 + 0.665 × V3
```

新的表示不再只包含“爱”本身的信息，也混入了模型认为相关的“我”和“北京”的信息。这就是 Self-Attention 中“根据上下文更新 token 表示”的核心。

整个过程可以压缩为一个公式：

```text
Attention(Q, K, V) = softmax(QK^T / sqrt(dk))V
```

按执行顺序拆开：

```text
QK^T             -> 计算匹配分数
/ sqrt(dk)       -> 缩放分数
Softmax          -> 转换为注意力权重
乘 V             -> 汇总上下文信息
```

`dk` 是 Q 和 K 的向量维度。维度较大时，点积的绝对值也容易变大，Softmax 会变得过于尖锐，梯度可能很小。除以 `sqrt(dk)` 可以让分数保持在更合适的范围。

## 所有 token 会并行计算

刚才只观察了“爱”这一行。实际上，每个 token 的 Q 都会和每个 token 的 K 匹配：

|  | K我 | K爱 | K北京 |
| --- | --- | --- | --- |
| Q我 | Q1·K1 | Q1·K2 | Q1·K3 |
| Q爱 | Q2·K1 | Q2·K2 | Q2·K3 |
| Q北京 | Q3·K1 | Q3·K2 | Q3·K3 |

每一行单独执行 Softmax，然后使用该行权重汇总全部 V。三个 token 因而会同时得到各自的新表示。

如果序列有 `n` 个 token，注意力分数矩阵就是 `n × n`。普通 Self-Attention 的计算量和显存开销会随序列长度近似按 `O(n²)` 增长，这也是长上下文成本较高的原因之一。

## 把整条链路记成五步

```text
1. token 转为输入向量 X，并加入位置信息
2. X 分别投影为 Q、K、V
3. 每个 Q 与所有 K 计算匹配分数
4. 每一行经过缩放和 Softmax 得到权重
5. 使用权重加权汇总 V，得到新的 token 表示
```

最短的一句话总结是：

> 每个 token 用自己的 Q 寻找相关的 K，再按匹配权重读取对应的 V。

理解这条计算链路后，再学习 Multi-Head Attention、残差连接、LayerNorm 和前馈网络，就能逐步拼出一个完整的 Transformer Block。
