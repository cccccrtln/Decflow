# DocFlow

一个旨在实现整洁高效，可用于深度阅读与便捷整理的 AI 阅读平台。用户上传 `PDF`、`HTML`、`DOCX` 文档后，系统提供完整阅读工作流，核心功能包括文档翻译、摘要解析、章节导航、用户问答、多文档对比，同时支持文档分类、笔记批注、收藏对话等知识管理能力。

## 主要功能

- 支持上传 `PDF`、`HTML`、`DOCX` 文档，或手动粘贴
- 自动检测语言，对非中文文档生成中文翻译版本
- ai生成文档摘要、章节导航、关键观点和术语解释
- 支持用户基于当前文档或当前章节进行对话式提问，回答附带原文证据
- 支持多文档对比，输出共识点、差异点和冲突点
- 支持文档分类，多文档对比亦可用于分类文件夹内文档总结
- 支持用户对文档或文档分类进行笔记批注
- 支持对话收藏，存入收藏夹，收藏夹可进行分类
- 支持基于当前对话和用户笔记生成ai阅读报告并导出

## Agent 任务流

平台采用可控的多 Agent 编排，核心角色包括：
- `Ingestion Agent`：接收文件、解析文档内容、提取元信息、建立结构化分段
- `Translation Agent`：检测文档语言，对非中文文档进行翻译，并维护原文与译文对照
- `Retrieval Agent`：根据用户问题检索相关段落，召回可引用证据
- `Reading Agent`：生成文档摘要、回答用户问题、解释文档术语、生成章节分层
- `Comparison Agent`：对多篇文档进行主题对齐，输出共识点与差异点
- `Synthesis Agent`：生成阅读报告，整理批注，总结内容

典型流程：

1. 用户上传文档
2. `Ingestion Agent` 完成解析与结构化切分
3. `Translation Agent` 处理语言检测与翻译
4. 基于 `Reading Agent`建立章节索引，生成文章总体摘要和章节导航
5. 用户提问，由 `Retrieval Agent` 检索证据，`Reading Agent` 根据证据生成回答
6. 多文档对比功能：用户需先将文档分类并命名分类名称，在文档分类条目内找到多文档对比，由 `Comparison Agent` 生成分类内文档的对比分析
7. 用户可在单个文档或文档分类内做批注
8. `Synthesis Agent`可针对用户批注和对话内容总结生成阅读报告，此功能仅限单个文档。报告可导出。
9. 用户可收藏对话内容并放入收藏夹

## 页面设计

平台采用单工作台式布局，核心区域包括：
- 左侧边栏：展示文档列表与文档分类，支持按分类浏览和切换当前阅读文档
- 中间主区域：展示当前文档正文、章节导航、引用高亮和问答交互页
- 右侧栏：笔记功能，报告生成功能，支持保存阅读结论

## 数据模型

核心实体包括：
- `users`
- `documents`
- `document_sections`
- `document_chunks`
- `translations`
- `categories`
- `document_categories`
- `annotations`
- `conversations`
- `messages`
- `citations`
- `favorites`
- `comparison_jobs`
- `reports`
- `agent_runs`

## 技术方案

### 前端

- `Next.js`
- `TypeScript`
- `Tailwind CSS`

### 后端

- `Next.js Route Handlers` 或 `NestJS`
- 异步任务队列处理解析、翻译、索引和报告生成

### 数据与检索

- `PostgreSQL`
- `pgvector`
- `Redis`

### Agent 与模型层

- 自定义轻量 orchestrator
- 模型使用国内云端 API
- 通过 provider adapter 统一封装 `chat`、`embedding`、`translation`

## MVP

第一版聚焦以下能力：

1. 上传 `PDF / HTML / DOCX`
2. 文档解析与语言检测
3. 非中文文档翻译为中文
4. 自动摘要与章节导航
5. 基于证据引用的问答
6. 多文档对比
7. 文章分类、用户批注、收藏对话
