# Mo-Guiji · Online Guardrail 复现

基于官方 [AgentDoG Online Agentic Guardrail](https://github.com/AI45Lab/AgentDoG/tree/main/Online%20Agentic%20Guardrail) 的本地复现，并扩展 **L1/L2/L3 级联** 与 **GuardTrace Dashboard** 桥接 API。

## 目录

```text
online-guardrail/
├── guardrail/           # 官方核心 + 扩展模块
│   ├── server.py        # HTTP 服务（含 /api/* 桥接）
│   ├── ws_proxy.py      # PRE_REPLY WebSocket 代理
│   ├── cascade.py       # L1→L2→L3 级联（Mo-Guiji 扩展）
│   ├── l1_rules.py      # L1 轻量规则
│   └── bridge.py        # GuardTrace API 适配
├── samples/             # 演示轨迹与 session 样例
└── plugin/              # OpenClaw 插件
```

## 快速启动（无需 OpenClaw / 无需 API Key）

```powershell
cd online-guardrail
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -e .
$env:GUARDRAIL_MOCK = "1"
python -m guardrail serve --host 127.0.0.1 --port 8340
```

浏览器打开：

- 官方面板：http://127.0.0.1:8340/
- 检查页：http://127.0.0.1:8340/inspections.html
- 健康检查：http://127.0.0.1:8340/health

CLI 演示：

```powershell
python -m guardrail check samples/demo-session/session_events.jsonl
```

## 接 GuardTrace 前端

```powershell
# 终端 1：后端
cd online-guardrail
$env:GUARDRAIL_MOCK = "1"
python -m guardrail serve --port 8340

# 终端 2：前端
cd guardrail-dashboard
$env:NEXT_PUBLIC_USE_MOCK = "false"
npm run dev
```

Next.js 会把 `/api/*` 代理到 `http://127.0.0.1:8340`（见 `guardrail-dashboard/next.config.ts`）。

## 接真实 AgentDoG 模型

```powershell
$env:GUARDRAIL_MOCK = "0"
$env:GUARDRAIL_API_BASE = "https://your-endpoint/v1"
$env:GUARDRAIL_MODEL = "agentdog"
$env:GUARDRAIL_API_KEY = "sk-..."
python -m guardrail serve --port 8340
```

## 接 OpenClaw（完整 PRE_REPLY 链路）

见官方 `README.zh-CN.md`。简要步骤：

1. `openclaw gateway`
2. `python -m guardrail serve --port 8340`
3. `python -m guardrail ws-proxy --port 18790 --gateway ws://127.0.0.1:18789 --guardrail-url http://127.0.0.1:8340`
4. `openclaw tui --url ws://127.0.0.1:18790`

## 扩展 API（Mo-Guiji）

| 端点 | 说明 |
|------|------|
| `POST /api/guardrail/check` | GuardTrace 级联检查 |
| `POST /api/cascade/check` | 对 session_events 做 L1/L2/L3 |
| `GET /api/trajectories` | 样例轨迹列表 |
| `GET /api/trajectories/:id` | 单条轨迹详情 |
| `GET /api/metrics` | 评测指标（演示数据） |

官方端点保持不变：`POST /evaluate`、`POST /check`、`GET /dashboard/events` 等。

## 与官方差异

| 项 | 官方 | 本复现 |
|----|------|--------|
| L2 评判 | AgentDoG API | 同左；`GUARDRAIL_MOCK=1` 时用规则 mock |
| L1/L3 | 无 | `cascade.py` 级联扩展 |
| Dashboard | 内置 HTML | 保留 + 可接 GuardTrace Next.js |
| 样例数据 | 不含私有 replay | `samples/` 内置演示轨迹 |

## License

Apache 2.0（与上游 AgentDoG 一致）
