---
title: "为什么 Transformer 的 Attention 使用点积，而不是余弦相似度？"
description: "从方向与长度的区别出发，用一个 Softmax 小例子理解缩放点积、√d_k 的作用，以及余弦注意力为什么需要考虑分数尺度。"
published: 2026-10-26T16:50:00+08:00
tags: ["Transformer", "Attention", "深度学习", "余弦相似度"]
category: "模型原理"
comment: false
---

最近在学习 Transformer 的 Attention 机制时，我产生了一个疑问：

**既然余弦相似度可以衡量两个向量的相似程度，为什么标准 Transformer 计算 Q 和 K 的匹配分数时，使用的是点积，而不是余弦相似度？**

可以先记住一个区别：Attention 要学习的是“当前 Token 应该怎样汇总其他位置的信息”，不只是判断两个 Token 的语义是否相近。点积保留了方向和长度两个方面的信息，缩放则用来控制分数的尺度。但这并不意味着 Attention 只能使用点积，余弦注意力也是一种可行的设计。

## 一、点积和余弦相似度有什么区别？

为了区分单个向量和一整组向量，下面用小写 $q$、$k$ 表示一个 Query 和一个 Key，用大写 $Q$、$K$、$V$ 表示由多个向量组成的矩阵。

对于两个非零向量，点积可以写成：

$$
q \cdot k = \lVert q \rVert_2 \lVert k \rVert_2 \cos\theta
$$

余弦相似度则是：

$$
\operatorname{cos\_sim}(q,k) = \frac{q \cdot k}{\lVert q \rVert_2 \lVert k \rVert_2} = \cos\theta
$$

其中，$\lVert q \rVert_2$ 和 $\lVert k \rVert_2$ 是向量的长度，$\theta$ 是两个向量之间的夹角。两者最大的区别在于：

- **余弦相似度只关注方向，不考虑长度。**
- **点积既考虑方向，也保留长度的影响。**

例如：

    q  = [1, 0]
    k₁ = [1, 0]
    k₂ = [3, 0]

它们的方向完全一致，但长度不同：

| 比较对象 | 余弦相似度 | 点积 |
| --- | --- | --- |
| $q$ 与 $k_1$ | 1 | 1 |
| $q$ 与 $k_2$ | 1 | 3 |

余弦相似度把这两个 Key 看成同样匹配；点积则能保留它们在长度上的区别。

## 二、为什么标准 Attention 使用点积？

**Attention 的目的，不只是判断两个 Token 是否相似，而是为不同位置的 Value 分配权重，再汇总信息。**

在最基本的 Self-Attention 中，Q、K、V 都由输入经过可训练的线性投影得到：

$$
Q = XW_Q,\qquad K = XW_K,\qquad V = XW_V
$$

这里省略了偏置、位置编码等细节。Q 和 K 并不是直接拿来做语义检索的原始词向量，而是模型为了注意力匹配学习出来的表示。

使用点积，模型既可以通过向量方向学习匹配关系，也可以通过向量长度影响注意力分数。

### 用同一个例子看 Softmax 的区别

仍然使用前面的 $q$、$k_1$ 和 $k_2$。假设只有这两个可见的 Key，没有额外的偏置或掩码，Key 维度为 $d_k=2$。

如果直接把余弦相似度送进 Softmax，两个分数都是 1：

$$
\operatorname{softmax}([1,1]) = [0.5,0.5]
$$

如果使用缩放点积，两个分数分别为 $1/\sqrt{2}$ 和 $3/\sqrt{2}$：

$$
\operatorname{softmax}\!\left(\left[\frac{1}{\sqrt{2}},\frac{3}{\sqrt{2}}\right]\right)
\approx [0.196,0.804]
$$

也就是：

- $k_1$ 对应的注意力权重约为 **19.6%**。
- $k_2$ 对应的注意力权重约为 **80.4%**。

这样，模型就能够利用长度信息进一步调整注意力分配。

不过，**向量越长，不代表 Token 一定越重要**。点积还取决于方向：当夹角对应的余弦值为负时，增大 Key 的长度会让分数更负。对同一个 Query 来说，增大它的长度则会共同放大这一行分数，在分数有差异时让 Softmax 更集中。长度不是一个可以脱离上下文解读的“重要性标签”。

另外，点积方便写成 $QK^\mathsf{T}$，能够使用高效的矩阵乘法。余弦相似度也可以通过“先归一化，再矩阵相乘”来计算，所以矩阵计算效率是点积的实用优势，但不能据此认为余弦注意力无法高效实现。

## 三、为什么点积还要除以 √d_k？

标准 Transformer 使用的并不是普通点积，而是**缩放点积注意力（Scaled Dot-Product Attention）**：

$$
\operatorname{Attention}(Q,K,V) =
\operatorname{softmax}\!\left(\frac{QK^\mathsf{T}}{\sqrt{d_k}}\right)V
$$

其中，$d_k$ 是每个注意力头中 Query 和 Key 的维度，Softmax 沿 Key 的方向计算。这里暂时省略了实际模型中的掩码。

为什么要缩放？可以用原始 Transformer 论文中的简化假设理解：如果 $q$ 和 $k$ 的各个分量相互独立、均值为 0、方差为 1，那么：

$$
q \cdot k = \sum_{i=1}^{d_k}q_i k_i,\qquad
\operatorname{Var}(q \cdot k) = d_k
$$

也就是说，点积的标准差会随 $\sqrt{d_k}$ 增长。分数幅度过大时，Softmax 容易过于集中，进入梯度很小的区域。除以 $\sqrt{d_k}$，可以在这个假设下把分数的方差控制回 1，缓解维度增大带来的尺度问题。

这是一种帮助理解设计的统计假设，并不是说训练后的 Q、K 永远满足独立、单位方差。

还需要注意，**除以 $\sqrt{d_k}$ 不等于余弦归一化**：前者除以由维度决定的常数，后者除以每一对向量各自的长度乘积。缩放点积仍然保留 Q 和 K 的长度信息。

## 四、那为什么向量数据库经常使用余弦相似度？

因为两者的目标和表示方式不同。

向量数据库常用于语义检索，比如判断“如何申请年假”和“员工休假申请流程”是否表达相近的意思。如果嵌入模型把语义关系主要编码在向量方向上，余弦相似度就是自然的选择。实际检索时，仍应遵循所用嵌入模型推荐的度量方式；点积和欧氏距离也都有应用。

Attention 学习的则是当前上下文中各个位置之间的信息交互关系：先计算匹配分数，再用 Softmax 转成权重，最后对 Value 加权求和。这种关联可以包含语义相似，也可以包含指代、语法依赖等关系。

点积和余弦相似度也不是绝对对立的。如果两个非零向量都进行了 L2 归一化：

$$
\hat q = \frac{q}{\lVert q \rVert_2},\qquad
\hat k = \frac{k}{\lVert k \rVert_2}
$$

那么：

$$
\hat q \cdot \hat k = \operatorname{cos\_sim}(q,k)
$$

### 余弦相似度也能用于 Attention

确实有对 Q、K 做归一化的 Attention 变体。例如，Query-Key Normalization 对每个头的 Query 和 Key 沿特征维度做 L2 归一化，并使用可学习的缩放参数。

一种简化的表达方式是：

$$
\operatorname{softmax}\!\left(\alpha\,\hat Q\hat K^\mathsf{T}\right)V
$$

这里的 $\alpha$ 调整分数尺度。未经额外缩放的余弦相似度被限制在 $[-1,1]$，直接送入 Softmax 时，能拉开的分数差距有限；因此，采用余弦注意力时也要考虑缩放或温度，而不是只把点积公式替换掉就结束了。

所以，更准确的说法是：**标准 Transformer 选择了缩放点积这一种设计，而不是 Attention 在原理上不能使用余弦相似度。**

## 最后总结

**余弦相似度主要比较方向，点积同时保留方向和长度信息。标准 Transformer 使用缩放点积，在保留这些可学习信息的同时控制分数尺度，并方便地通过矩阵乘法实现。**

更重要的是，Attention 计算的不是简单的语义相似度，而是模型学习出来的信息匹配关系。余弦注意力同样可行，只是它对向量长度和分数尺度作出了不同的设计选择。

如果想把 Q、K、V 和 Softmax 的完整计算过程串起来，可以继续看：[从词向量到 Self-Attention：手算一遍 Transformer 注意力](/posts/transformer-self-attention-from-scratch/)。

## 参考资料

- [Attention Is All You Need](https://arxiv.org/abs/1706.03762)：第 3.2.1 节与脚注 4，介绍缩放点积注意力和 $\sqrt{d_k}$ 缩放的动机。
- [Query-Key Normalization for Transformers](https://aclanthology.org/2020.findings-emnlp.379/)：对 Query、Key 做 L2 归一化，并引入可学习的缩放参数。
