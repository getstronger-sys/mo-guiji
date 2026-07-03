# 本地实时模拟 — 无需 OpenClaw

## 原理

官方 dashboard 通过 **轮询 `*.jsonl` session 文件** 实现实时监控（`watcher.py`）。
Agent 每产生一条事件，文件追加一行，dashboard SSE 就会推送新事件。

## 三步演示

### 1. 启动护栏服务（指向模拟 session 目录）

```powershell
cd online-guardrail
.\.venv\Scripts\Activate.ps1
$env:GUARDRAIL_MOCK = "1"
python -m guardrail serve --host 127.0.0.1 --port 8340 `
  --sessions-dir "samples/live-sim/agents/demo-agent/sessions"
```

浏览器打开：**http://127.0.0.1:8340/**

### 2. 另一个终端 — 模拟 Agent 逐步执行

```powershell
cd online-guardrail
.\.venv\Scripts\python.exe scripts/simulate_live_agent.py --unsafe
```

每 ~1.8 秒写入一条 message（user → tool_call → tool_result → …）。

### 3. 在 dashboard 里

1. 左侧 session 列表选 **`live_demo`**
2. 看事件流实时增加
3. 最后一步含 `attacker.example` 时，可点 Evaluate → 判 **unsafe**

## 真机 OpenClaw（有环境时）

```text
Terminal 1: openclaw gateway
Terminal 2: python -m guardrail serve --port 8340
Terminal 3: python -m guardrail ws-proxy --port 18790 --gateway ws://127.0.0.1:18789 --guardrail-url http://127.0.0.1:8340
Terminal 4: openclaw tui --url ws://127.0.0.1:18790
```

这是 **PRE_REPLY 真拦截**；文件模拟只演示 **监控 + 事后判决**。

## GuardTrace 前端

`localhost:3000` 的轨迹审查是 **回放/样例** 或接 `/api/*`；
**真正边跑边看 session 文件** 请用官方面板 `:8340`。
