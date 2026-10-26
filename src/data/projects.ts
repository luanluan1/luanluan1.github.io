export interface ProjectLink {
	label: string;
	href: string;
}

export interface ProjectImage {
	src: string;
	alt: string;
	caption: string;
}

export interface Project {
	number: string;
	slug: string;
	kind: string;
	title: string;
	shortDescription: string;
	context: string;
	work: string;
	highlight: string;
	stack: string[];
	links: ProjectLink[];
	images?: ProjectImage[];
}

export const projects: Project[] = [
	{
		number: "10",
		slug: "codex-enterprise-agent",
		kind: "自主项目 / 内部试用",
		title: "Codex Enterprise Agent 企业工作台",
		shortDescription:
			"基于 Codex App Server 构建员工工作台与企业控制面，支持办公材料、多轮任务、工具审批和个人 Agent。",
		context:
			"员工需要上传表格或文档完成工作，任务离开页面后继续执行；管理员需要控制成员资格、模型请求额度及外部工具写入。",
		work: "实现多轮对话、办公文件输入与产物交付、Task/Run/Lease 管理、组织权限和配额；通过 Runtime Adapter 接入 Codex App Server。补充内部 Skill 版本目录、管理员 HTTPS MCP 接入与分发，以及员工个人 Agent 的创建、模板复制和能力组合。",
		highlight:
			"执行前复核成员与工具授权，旧审批不随重新授权复活；远程调用结果丢失时标记待核实并阻止自动重放。已通过真实 TLS、数据库、浏览器和固定运行物验证，当前为本机试用阶段，真实企业 MCP 和生产可靠性仍待验收。",
		stack: ["Node.js", "PostgreSQL", "Codex App Server", "Docker", "MCP", "Playwright"],
		links: [
			{
				label: "阅读项目总结",
				href: "/posts/codex-enterprise-agent-control-plane/",
			},
		],
	},
	{
		number: "01",
		slug: "rag-knowledge-retrieval",
		kind: "工作项目",
		title: "RAG 知识检索与问答系统",
		shortDescription:
			"处理多知识库接入、向量检索、缓存与 API 调度，让回答来源、权限和时效可控。",
		context:
			"创投信息分散在不同知识库和业务系统中，需要统一检索入口，并控制返回内容的版本、来源与访问权限。",
		work: "参与 RAG 架构、多知识库调度、HTTP API 接入、检索逻辑和缓存优化；将 document_id、chunk_id、版本与权限写入元数据，在检索过滤后保留权威权限校验和引用核验。",
		highlight:
			"将 document_id、chunk_id、文档版本与访问权限贯穿切片、检索和引用链路，在向量召回与缓存命中后继续执行权限过滤，让回答来源可追溯、知识版本可控制。",
		stack: ["Python", "Dify", "RAGFlow", "向量检索", "权限过滤"],
		links: [],
	},
	{
		number: "02",
		slug: "meeting-minutes",
		kind: "工作项目",
		title: "会议纪要与结构化总结系统",
		shortDescription:
			"组合语音转写、说话人处理与 LLM 总结，稳定产出决策点和待办事项。",
		context:
			"会议录音需要自动转写，并从长对话中稳定提取摘要、决策点和待办事项。",
		work: "组合 Paraformer 语音转写、CAM++ 说话人处理、行业词典与 LLM 总结流程，统一输出会议摘要、关键决策和行动项。",
		highlight:
			"将语音转写、说话人处理、行业词典和 LLM 总结组合为稳定流程，把长会议统一转换为摘要、关键决策与行动项，降低不同模型输出格式不一致带来的处理成本。",
		stack: ["Paraformer", "CAM++", "LLM", "Python", "结构化输出"],
		links: [],
	},
	{
		number: "03",
		slug: "venture-intelligence-workbench",
		kind: "自主项目 / 全栈开发",
		title: "创投情报与多渠道发布工作台",
		shortDescription:
			"将公开创投资讯转化为可审核、可检索的结构化情报，并生成图卡与多渠道内容包。",
		context:
			"创投资讯来源分散、字段不统一，人工整理融资事件与相关人物观点耗时，也难以稳定复用到后续内容生产。",
		work: "使用 Playwright、MySQL 和 LLM 构建增量采集、去重与结构化抽取流程，围绕公司、赛道、轮次、金额、投资方和相关观点建立审核工作台；审核通过后生成固定尺寸图卡、文案和 manifest 发布包，并保留来源链接与人工修改入口。",
		highlight:
			"用来源链接、结构化字段和人工审核串联采集到发布包的完整链路，既保留事实追溯能力，也让同一份情报能够快速复用为图卡、文案和多渠道内容素材。",
		stack: ["TypeScript", "React", "MySQL", "Playwright", "LLM", "内容审核"],
		links: [],
		images: [
			{
				src: "/assets/images/projects/venture-review-workbench.png",
				alt: "创投情报审核工作台",
				caption: "结构化审核工作台",
			},
			{
				src: "/assets/images/projects/venture-publish-pack.png",
				alt: "创投融资速递发布包",
				caption: "图卡与文案发布包",
			},
			{
				src: "/assets/images/projects/venture-timeline.png",
				alt: "创投事件检索时间线",
				caption: "可筛选的创投事件时间线",
			},
			{
				src: "/assets/images/projects/venture-article-details.png",
				alt: "创投文章结构化详情",
				caption: "关键事实与相关观点详情",
			},
		],
	},
	{
		number: "04",
		slug: "enterprise-email-intelligence",
		kind: "自主项目 / 全栈开发",
		title: "企业邮箱智能识别与数据处理平台",
		shortDescription:
			"批量采集企业与官网信息，通过 DNS MX 和 146 条规则识别邮箱服务商，并输出可复核的数据结果。",
		context:
			"企业名单处理需要在工商信息、官网域名、邮箱系统和人工补录之间反复切换，批量任务缺少统一的进度跟踪、异常恢复与结果交付入口。",
		work: "独立实现“企业名称 → 天眼查企业信息 → 官网域名 → DNS MX 查询 → 邮箱服务商分类”链路，支持粘贴、CSV 和 Excel 导入。使用 Playwright 持久化浏览器 Profile 处理登录状态、验证码、延迟重试、冷却与调试快照；将网页采集和 MX 查询拆分为独立任务通道，支持优先级、并发控制、失败重试、过期任务恢复和事务保护。建立 146 条 MX 分类规则，开发任务中心、企业邮箱库、人工处理中心和格式化 Excel 导出，并围绕 API、队列、解析、分类及前端交互建立 224 项自动化测试。",
		highlight:
			"将网页采集与 DNS 查询拆分为独立任务通道，用优先级、并发控制、事务保护、失败重试和过期恢复处理长链路任务；146 条分类规则与人工补录机制共同覆盖常见服务商和边缘结果。",
		stack: [
			"React",
			"TypeScript",
			"Express",
			"MySQL",
			"Playwright",
			"ExcelJS",
			"Vitest",
		],
		links: [],
		images: [
			{
				src: "/assets/images/projects/enterprise-mail-library.png",
				alt: "企业邮箱库与企业详情抽屉",
				caption: "企业邮箱库与识别详情",
			},
			{
				src: "/assets/images/projects/enterprise-mail-new-task.png",
				alt: "企业邮箱批量识别任务创建页面",
				caption: "粘贴或上传文件创建批量任务",
			},
		],
	},
	{
		number: "05",
		slug: "xiaohongshu-ai-publishing-platform",
		kind: "个人项目 / 全栈开发",
		title: "小红书 AI 内容生产与跨平台自动发布平台",
		shortDescription:
			"把内容检索、AI 改写、图片处理、人工审核和发布管理编排为可私有化部署的完整流水线。",
		context:
			"针对官方 MCP 方案在实际浏览器环境中的稳定性与部署限制，重写一套支持 Windows、Linux 私有化部署的小红书内容生产平台，并为多账号任务保留独立运行环境。",
		work: "使用 Go、Node.js、Express、MySQL、MCP、Rod、CloakBrowser 与 LangGraph 编排“内容搜索 → 详情获取 → AI 改写 → 图片下载 → 人工审核 → 发布”流程。自主实现扫码登录、状态检测、搜索、详情、图文或视频发布及互动工具；通过状态机处理标题正文生成、标签提取、质量校验、有限重试和异常恢复。任务中心持久化状态、结构化日志、失败原因和单篇结果，并针对登录失效、页面异常、上传跳转和请求超时补充会话管理、结果校验与错误传播，避免实际失败但前端显示成功。",
		highlight:
			"围绕浏览器自动化的不确定性设计独立会话、页面状态校验、有限重试、异常恢复与发布结果核验机制，并支持 Windows/Linux 私有化部署、多账号隔离运行和发布前人工审核。",
		stack: [
			"Go",
			"Node.js",
			"Express",
			"MySQL",
			"MCP",
			"Rod / CDP",
			"CloakBrowser",
			"LangGraph",
		],
		links: [
			{
				label: "查看项目仓库",
				href: "https://github.com/luanluan1/xiaohongshu-mcp",
			},
		],
		images: [
			{
				src: "/assets/images/projects/xhs-platform-workflow.png",
				alt: "小红书内容生产与发布主工作台",
				caption: "普通模式下的内容生产入口",
			},
			{
				src: "/assets/images/projects/xhs-platform-agent-mode.png",
				alt: "基于 LangGraph 的小红书智能体模式",
				caption: "带候选内容区的智能体模式",
			},
			{
				src: "/assets/images/projects/xhs-platform-publish-review.jpg",
				alt: "小红书图文发布前人工审核界面",
				caption: "图片、文案与标签发布前审核",
			},
			{
				src: "/assets/images/projects/xhs-platform-login.png",
				alt: "小红书内容平台用户登录页面",
				caption: "多用户登录入口",
			},
		],
	},
	{
		number: "06",
		slug: "code-archaeology-skill",
		kind: "自主开源项目",
		title: "Code Archaeology Skill",
		shortDescription:
			"从本地 Git 历史采集可核验证据，辅助 Agent 解释模块演化和遗留约束。",
		context:
			"帮助接手旧模块的工程师回答‘这段代码为什么变成今天这样’，把零散 Git 历史整理成可核验的演化报告。",
		work: "实现本地 Git 证据采集器，支持文件、目录、glob、模块名和符号查询，整理 rename、revert、blame 存活度与提交评分；可选补充 Python AST 差异、GitHub/GitLab 协作记录，并渲染离线 HTML 时间线。",
		highlight:
			"以 Git 历史而不是模型猜测作为分析依据，把 rename、revert、blame 存活度、关键 diff 和协作记录组织为可核验证据，帮助 Agent 更可靠地解释代码演化。",
		stack: ["Python", "Git", "AST", "Codex Skill", "HTML"],
		links: [
			{
				label: "查看开源仓库",
				href: "https://github.com/luanluan1/code-archaeology-skill",
			},
		],
	},
	{
		number: "07",
		slug: "trend-publish",
		kind: "开源二次开发",
		title: "TrendPublish 微信公众号系统",
		shortDescription:
			"研究自动选题、组稿、质量审查、排版与微信公众号草稿发布链路。",
		context:
			"基于开源 TrendPublish 研究微信公众号的自动选题与文章生产，包括抓取、去重、证据补全、组稿、审查、排版和草稿发布。",
		work: "围绕本地运行完成 Windows Dashboard 路径兼容、运行时配置 API 类型修正和公众号账号配置适配，并梳理 Deno、React Dashboard、Cloudflare 与本地存储之间的运行边界。",
		highlight:
			"围绕开源系统的真实运行环境完成 Windows Dashboard 路径兼容、运行时配置修正和公众号账号适配，并梳理前端、云端服务与本地存储之间的数据流和部署关系。",
		stack: [
			"Deno",
			"TypeScript",
			"React",
			"Cloudflare",
			"SQLite / D1",
			"微信 API",
		],
		links: [
			{
				label: "查看上游项目",
				href: "https://github.com/liyown/ai-trend-publish",
			},
		],
	},
	{
		number: "08",
		slug: "topic-intelligence",
		kind: "自主原型",
		title: "热点线索台与 IP 选题库",
		shortDescription:
			"持续采集热点并记录变化，为内容选题提供可检索、可追踪的数据入口。",
		context:
			"为个人 IP 孵化建立一个持续更新的热点入口，集中查看不同来源的主题、热度变化和来源健康状态。",
		work: "从 NewsNow 公共源定时采集热点，使用唯一键增量入库，只在排名、热度或摘要变化时写快照；通过 MySQL FULLTEXT ngram 支持中文检索，并提供精简的 AI 搜索接口和同步运行状态。",
		highlight:
			"使用唯一键完成热点增量入库，只在排名、热度或摘要发生变化时保存快照；结合中文全文检索和来源运行状态，让热点不仅能被搜索，也能追踪变化过程。",
		stack: ["Node.js", "MySQL", "FULLTEXT", "NewsNow", "定时采集"],
		links: [],
		images: [
			{
				src: "/assets/images/projects/topic-intelligence-dashboard.png",
				alt: "热点线索台的热点聚合、搜索与数据源状态界面",
				caption: "热点聚合、检索与采集状态工作台",
			},
		],
	},
	{
		number: "09",
		slug: "multimodal-evaluation",
		kind: "工作项目",
		title: "多模态技术选型与名片识别",
		shortDescription:
			"评估视觉、ASR 与 OCR 方案，将图片和语音稳定转换为结构化字段。",
		context:
			"业务需要从图片、语音和文档中提取稳定的结构化字段，并评估不同模型方案的适用边界。",
		work: "对视觉、ASR 和 OCR 候选方案进行测试与选型，使用 Qwen2.5-VL 完成名片字段提取、格式校验与结构化存储。",
		highlight:
			"围绕真实业务样本比较视觉、ASR 与 OCR 候选方案，将模型输出统一为可校验的结构化字段，并通过格式检查与数据存储把一次性模型调用转化为可接入业务的处理流程。",
		stack: ["Qwen2.5-VL", "OCR", "ASR", "模型评测", "结构化输出"],
		links: [],
	},
];
