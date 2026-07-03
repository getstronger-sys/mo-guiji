# GuardTrace

> **摸轨迹不摸鱼** · 上海 AI Lab Track 07 安全可信 AI · 智能体级联护栏系统

面向 Agent 全链路执行轨迹的安全防护：**L1 规则 → L2 AgentDoG → L3 XAI 精定位**，在 Tool 执行前完成审查与拦截。

## 仓库结构

| 目录 | 说明 |
|------|------|
| [`online-guardrail/`](online-guardrail/) | Python 后端：级联护栏 API、L1 规则引擎、CodeShield 桥接、XAI 归因 |
| [`guardrail-dashboard/`](guardrail-dashboard/) | Next.js 前端：轨迹可视化、级联决策链、风险诊断与 XAI 溯源 |
| [`eval/`](eval/) | 评测脚本与数据 |

以下目录体积较大，**未纳入 Git**，需在本仓库同级目录自行 clone（后端 CodeShield 会自动查找 `../PurpleLlama`）：

| 目录 | 获取方式 |
|------|----------|
| `AgentDoG/` | `git clone https://github.com/AI45Lab/AgentDoG.git` |
| `PurpleLlama/` | `git clone https://github.com/meta-llama/PurpleLlama.git` |
| `论文/` | 本地阅读笔记与 PDF，仅保留在本地 |

## 快速启动

### 1. 后端（8340）

```bash
cd online-guardrail
python -m venv .venv
# Windows: .venv\Scripts\activate
pip install -e .
set GUARDRAIL_MOCK=1
python -m guardrail serve --port 8340
```

### 2. 前端（3000）

```bash
cd guardrail-dashboard
npm install
npm run dev
```

浏览器打开 http://localhost:3000（`/api/*` 会代理到 8340）。

## 架构

```
PRE_TOOL → [L1 轻量规则 + CodeShield] → [L2 AgentDoG XAI] → [L3 精定位] → allow / block
                ↓ 零 Token 实时拦              ↓ 轨迹级判决              ↓ 诊断归因
```

## License

Hackathon / research use. Third-party subfolders retain their upstream licenses.
