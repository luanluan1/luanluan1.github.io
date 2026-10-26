---
title: "Transformer 数学基础（一）：张量、矩阵乘法与广播"
description: "从 PyTorch 张量的 shape、dtype、device 开始，解释 768 维向量、矩阵乘法、逐元素运算和广播之间的关系。"
published: 2026-08-06T10:00:00+08:00
tags: ["Transformer", "深度学习", "PyTorch", "张量", "矩阵乘法"]
category: "模型原理"
comment: false
---

刚开始学习 Transformer 时，很容易直接记住下面这些公式：

```text
Q = XWq
K = XWk
V = XWv
```

但只要遇到 `[batch, seq, hidden]`、`768` 维向量或广播，公式里的每个字母就又会变得抽象。这篇笔记先不讨论 Attention，而是解决更基础的问题：数据在 PyTorch 里是什么形状，矩阵乘法怎样改变形状，以及为什么偏置可以自动加到所有 Token 上。

## Python、NumPy 和 PyTorch 分别负责什么

三者都能保存一组数字，但用途并不相同。

| 工具 | 主要作用 | 自动求导 | GPU |
| --- | --- | --- | --- |
| Python List | 保存通用对象、编写程序逻辑 | 不支持 | 不支持 |
| NumPy Array | 在 CPU 上进行数组和矩阵计算 | 不支持 | 默认不支持 |
| PyTorch Tensor | 深度学习中的张量计算 | 支持 | 支持 |

例如：

```python
import numpy as np
import torch

python_list = [1, 2, 3]
numpy_array = np.array([1, 2, 3])
torch_tensor = torch.tensor([1, 2, 3])
```

它们看起来相似，但乘法含义并不完全相同：

```python
[1, 2, 3] * 2
# [1, 2, 3, 1, 2, 3]

np.array([1, 2, 3]) * 2
# [2, 4, 6]

torch.tensor([1, 2, 3]) * 2
# tensor([2, 4, 6])
```

Python List 的乘法表示重复列表，NumPy 和 PyTorch 的乘法才是数值运算。

## Tensor 最重要的三个属性

观察一个 PyTorch Tensor 时，先看三个属性：

```text
shape   数据的形状
dtype   每个数字的数据类型
device  数据存放和计算的位置
```

```python
x = torch.tensor([
    [1.0, 2.0, 3.0],
    [4.0, 5.0, 6.0],
])

print(x.shape)   # torch.Size([2, 3])
print(x.dtype)   # torch.float32
print(x.device)  # cpu
```

整数 Tensor 通常用于 Token ID、分类标签和索引，浮点 Tensor 通常用于模型参数、向量和梯度计算。

## `[8, 20, 768]` 到底表示什么

在 Transformer 中经常看到：

```text
x.shape = [8, 20, 768]
```

它可以解释为：

```text
8     一个 Batch 中有 8 个样本
20    每个样本包含 20 个 Token
768   每个 Token 使用 768 个数字表示
```

因此，这个 Batch 中共有：

```text
8 × 20 = 160 个 Token
```

每个 Token 都是一个 `768` 维向量。

这里有一个很容易混淆的地方：

> `768` 维向量不是 `768 × 768` 矩阵。

一个 Token 的向量只是：

```text
[x1, x2, x3, ..., x768]
```

它的形状是 `[768]`，也可以为了矩阵乘法写成 `[1, 768]`。如果一句话包含 20 个 Token，把这些向量按行排列，才会得到一个 `[20, 768]` 的矩阵。

```text
一个 Token       [768]
一句话            [20, 768]
一批句子          [8, 20, 768]
```

## 矩阵乘法的中间维度去了哪里

矩阵乘法的形状规则是：

```text
[m, n] @ [n, p] -> [m, p]
```

例如：

```text
[2, 3] @ [3, 2] -> [2, 2]
```

可以把中间两个 `3` 暂时记成“消掉了”，但它并不是分数约分。更准确地说，中间维度会逐项相乘并求和。

假设：

```text
x.shape = [4]
W.shape = [4, 5]
```

第一个输出是：

```text
y1 = x1×w11 + x2×w21 + x3×w31 + x4×w41
```

`W` 有 5 列，因此会得到 5 个这样的结果：

```text
[4] @ [4, 5] -> [5]
```

中间的 `4` 没有失去作用，它参与计算后被求和了。这个过程也叫对共享维度进行收缩。

## 高维 Tensor 怎样做矩阵乘法

假设：

```text
x.shape = [8, 20, 768]
W.shape = [768, 3072]
```

可以先只看一个 Token：

```text
[768] @ [768, 3072] -> [3072]
```

同一个 `W` 会作用于 Batch 中的全部 160 个 Token，前面的 Batch 和序列维度保留：

```text
[8, 20, 768] @ [768, 3072]
-> [8, 20, 3072]
```

也就是每个 Token 从 `768` 维变成了 `3072` 维，但样本数量和 Token 数量没有改变。

Transformer 里计算 Q 时也会使用相同规则：

```text
X.shape  = [8, 20, 768]
Wq.shape = [768, 768]

Q = X @ Wq
Q.shape  = [8, 20, 768]
```

这里的 `Wq` 才可能是 `768 × 768` 的矩阵，Token 本身仍然只是 `768` 维向量。

## `*` 和 `@` 不是同一种乘法

在 PyTorch 中：

```text
*  表示逐元素乘法
@  表示矩阵乘法
```

```python
A = torch.tensor([
    [1, 2],
    [3, 4],
])

B = torch.tensor([
    [5, 6],
    [7, 8],
])
```

逐元素乘法：

```python
A * B

# tensor([
#     [ 5, 12],
#     [21, 32],
# ])
```

矩阵乘法：

```python
A @ B

# tensor([
#     [19, 22],
#     [43, 50],
# ])
```

前者把相同位置的数字相乘，后者执行“行乘列并求和”。

## 为什么 `[8, 20, 3072] + [3072]` 成立

神经网络里的线性变换经常写成：

```python
y = x @ W + b
```

假设：

```text
x @ W = [8, 20, 3072]
b     = [3072]
```

`b` 表示针对一个 Token 的 3072 个特征分别设置一个偏置。PyTorch 会把它临时理解成：

```text
[3072]
-> [1, 1, 3072]
-> [8, 20, 3072]
```

于是同一个 `b` 会加到全部 160 个 Token 上：

```text
第 1 个 Token + b
第 2 个 Token + b
...
第 160 个 Token + b
```

用下标表示就是：

```text
y[i, j, k] = x[i, j, k] + b[k]
```

其中 `i` 表示样本，`j` 表示 Token，`k` 表示特征。加法只改变数值，不增加或删除 Token，因此最终形状仍然是：

```text
[8, 20, 3072]
```

## 广播不是任何形状都能扩展

广播会从最右侧维度开始比较。两个维度满足下列条件之一才能兼容：

1. 两个维度相同。
2. 其中一个维度是 `1`。
3. 某一方缺少这个维度，缺少的前置维度可以看作 `1`。

可以广播：

```text
[2, 3]
   [3]

等价于比较：
[2, 3]
[1, 3]
```

不能广播：

```text
[2, 3]
   [2]
```

因为最后一维的 `3` 和 `2` 不同，并且都不是 `1`。

还有一个更需要注意的问题：能广播不代表业务逻辑一定正确。例如：

```text
[3, 1] + [3] -> [3, 3]
```

代码能够执行，但如果原本只想让三个数字一一对应相加，那么就得到了错误的形状。因此，每次广播后都应该检查结果的 `shape`。

## 用一段代码串起来

```python
import torch

batch_size = 8
seq_len = 20
hidden_size = 768
output_size = 3072

x = torch.randn(batch_size, seq_len, hidden_size)
W = torch.randn(hidden_size, output_size)
b = torch.randn(output_size)

hidden = x @ W
y = hidden + b

print(x.shape)       # torch.Size([8, 20, 768])
print(W.shape)       # torch.Size([768, 3072])
print(hidden.shape)  # torch.Size([8, 20, 3072])
print(y.shape)       # torch.Size([8, 20, 3072])
```

读 PyTorch 代码时，不要只盯着运算符。先在纸上写出每个 Tensor 的形状，再判断当前执行的是逐元素运算、矩阵乘法还是广播。

## 这一篇需要记住什么

```text
1. 768 维向量只有 768 个数字，不是 768×768 矩阵。
2. [m, n] @ [n, p] 会得到 [m, p]。
3. 矩阵乘法的中间维度参与逐项乘法并被求和。
4. * 是逐元素乘法，@ 是矩阵乘法。
5. [8, 20, 3072] + [3072] 会把同一个偏置加到所有 Token 上。
6. 能广播只代表形状兼容，不代表业务含义一定正确。
```

第一阶段后续会继续拆成三篇：

```text
第二篇：导数、梯度与链式法则
第三篇：概率、Softmax 与交叉熵
第四篇：张量维度变换、GPU 与显存
```

把这些基础补齐后，再回头看 Q、K、V 和 Attention，重点就不再是死记公式，而是沿着每一步的 Tensor 形状检查计算是否成立。
