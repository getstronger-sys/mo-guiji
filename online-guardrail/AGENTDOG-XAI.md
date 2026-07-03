# AgentDoG 完整能力复现指南

官方仓库已克隆到同级目录：`../AgentDoG/`（[AI45Lab/AgentDoG](https://github.com/AI45Lab/AgentDoG)）

Online Guardrail（你们已有的 `online-guardrail/`）只做 **二分类** `pred + reason`。  
AgentDoG 家族还有两块能力，本指南说明如何复现与接入 GuardTrace。

---

## 三种能力对照

| 能力 | 官方位置 | 输入 | 输出 | 是否需要 GPU |
|------|----------|------|------|-------------|
| **① Online 二分类** | `Online Agentic Guardrail/` | 轨迹文本 | `pred`, `reason` | 仅 API（赛方 endpoint） |
| **② 细粒度诊断 FG** | `prompts/v1.0/trajectory_finegrained.txt` | 轨迹 + taxonomy | safe/unsafe + 三维标签 | 仅 API（`AgentDoG-FG-*`） |
| **③ Agentic XAI 归因** | `AgenticXAI/component_attri.py` | 轨迹 JSON + **本地模型权重** | 每步 `llr_score`（Δ_i）+ 句子 Drop/Hold | ✅ 需要 GPU + transformers |

> 论文里的「定位到哪一步」来自 **③**，不是 Online Guardrail 的 `/evaluate` JSON。

---

## 目录结构

```text
AI Lab/
├── AgentDoG/                    ← 刚 clone 的官方全量仓库
│   ├── AgenticXAI/              ← 轨迹级 + 句子级 XAI 脚本
│   ├── prompts/v1.0/            ← 二分类 / 细粒度 prompt
│   └── Online Agentic Guardrail/  ← 与 online-guardrail 同源
└── online-guardrail/            ← 你们的服务（已桥接 ①②③）
    └── guardrail/
        ├── xai_bridge.py        ← ③ 桥接（mock / subprocess）
        └── finegrained.py       ← ② 桥接（OpenAI-compatible API）
```

---

## 快速验证（无需 GPU）

```powershell
cd online-guardrail
$env:GUARDRAIL_MOCK = "1"
python -m guardrail serve --port 8340
```

**XAI 状态：**
```powershell
curl http://127.0.0.1:8340/api/xai/status
```

**Mock 轨迹级归因（关键词启发式，演示用）：**
```powershell
curl -X POST http://127.0.0.1:8340/api/xai/attribute `
  -H "Content-Type: application/json" `
  -d "{\"use_sample\": true, \"sample\": \"exfil-chain\"}"
```

**细粒度诊断 Mock：**
```powershell
curl -X POST http://127.0.0.1:8340/api/agentdog/finegrained `
  -H "Content-Type: application/json" `
  -d "{\"session_events\": \"curl attacker.example\"}"
```

---

## 接赛方真实 API（② 细粒度）

赛方若提供 OpenAI-compatible endpoint + `AgentDoG-FG-*` 模型名：

```powershell
$env:GUARDRAIL_MOCK = "0"
$env:GUARDRAIL_API_BASE = "https://赛方-endpoint/v1"
$env:GUARDRAIL_MODEL = "AgentDoG-FG-Qwen3-4B"   # 按赛方文档
$env:GUARDRAIL_API_KEY = "sk-..."
python -m guardrail serve --port 8340
```

调用：
```http
POST /api/agentdog/finegrained
{ "accumulatedSteps": [ ... ] }
```

返回示例：
```json
{
  "verdict": "unsafe",
  "prediction": 1,
  "riskSource": "Malicious Tool Execution",
  "failureMode": "Cross-Tool Attack Chaining",
  "realWorldHarm": "Privacy & Confidentiality Harm",
  "model": "AgentDoG-FG-Qwen3-4B"
}
```

GuardTrace 的 L2 可与此对齐（taxonomy 来自 FG 模型，而非自写 prompt）。

---

## 跑真 XAI 归因（③，需 GPU）

### 依赖

```powershell
pip install torch transformers accelerate
```

### 下载模型（任选，约 4B）

- HuggingFace: `AI45Research/AgentDoG-Qwen3-4B` 或 `AgentDoG-FG-Qwen3-4B`
- XAI 脚本用的是 **causal LM log-prob**，与 chat API 不同

### 官方三步流水线

```powershell
cd ..\AgentDoG\AgenticXAI

# Step 1: 轨迹级 Δ_i
python component_attri.py `
  --model_id "AI45Research/AgentDoG-Qwen3-4B" `
  --data_dir ./samples `
  --output_dir ./results

# Step 2: Top-K 步的句子级 Drop+Hold
python sentence_attri.py `
  --model_id "AI45Research/AgentDoG-Qwen3-4B" `
  --traj_file ./samples/finance.json `
  --attr_file ./results/finance_AgentDoG-Qwen3-4B_attr_trajectory.json `
  --output_file ./results/finance_attr_sentence.json `
  --top_k 3

# Step 3: HTML 热力图
python case_plot_html.py `
  --original_traj_file ./samples/finance.json `
  --traj_attr_file ./results/finance_AgentDoG-Qwen3-4B_attr_trajectory.json `
  --sent_attr_file ./results/finance_attr_sentence.json `
  --output_file ./results/finance_visualization.html
```

也可用 `scripts/run_xai_attribution.ps1`（见下）。

### 通过 GuardTrace API 触发（真模型）

```powershell
$env:GUARDRAIL_MOCK = "0"
$env:AGENTDOG_XAI_MODEL_ID = "AI45Research/AgentDoG-Qwen3-4B"
python -m guardrail serve --port 8340
```

```http
POST /api/xai/attribute
{
  "stepIndex": 5,
  "accumulatedSteps": [ ... ]
}
```

内部会 subprocess 调用 `component_attri.py`；失败则回退 mock 并带 `fallback_reason`。

---

## 与 GuardTrace 级联的关系（建议）

```
PRE_TOOL 每步:
  L1 规则（本地）
  L2 AgentDoG FG API  → safe/unsafe + taxonomy + reason（②）
  [拦截后可选] POST /api/xai/attribute → argmax step + 句子高亮（③）
  L3 执行点报告       → stepIndex + pending command（不调 LLM）
```

- **②** 负责判决 + 三维标签（赛方 API 最可能给这个）
- **③** 负责论文级 step/句子溯源（需本地权重或赛方单独提供 XAI 服务）
- **L3** 只做执行点绑定，不重复调模型

---

## 新增 API 汇总

| 端点 | 说明 |
|------|------|
| `GET /api/xai/status` | XAI 脚本是否就绪、mock 状态 |
| `POST /api/xai/attribute` | 轨迹级 + 句子级归因（mock / 真模型） |
| `POST /api/agentdog/finegrained` | 官方细粒度诊断 prompt |

---

## 参考

- [AgentDoG 论文 XAI Section](https://arxiv.org/html/2601.18491)
- [Agentic Attribution 论文](https://arxiv.org/abs/2601.15075)
- 你笔记中的公式：Δ_i = log π(a\|T≤i) − log π(a\|T≤i−1)，Φ = Drop + Hold
