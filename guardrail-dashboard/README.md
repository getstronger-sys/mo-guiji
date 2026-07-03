# GuardTrace

> **摸轨迹不摸鱼** · 安全可信 AI 赛道 · 智能体级联护栏系统

面向智能体全链路执行轨迹的安全防护方案：轻量规则 → AgentDoG 基座 → 精确定位，在 Tool 执行前完成审查与拦截。

## 队伍

| 成员 | 方向 |
|------|------|
| 组长 | 大模型代码溯源安全、软件漏洞挖掘、AIGC 安全 |
| 北航 | 大模型安全测评、自动化红队、Agent 安全 |
| 软件安全 | 代码检测、深度漏洞检测、多智能体修复 |

## 快速启动

```bash
npm install
npm run dev
```

浏览器打开 http://localhost:3000

## 架构

```
用户输入 → [L1 轻量规则] → [L2 AgentDoG] → [L3 精定位] → 允许 / 拦截
              ↓ 实时拦           ↓ 轨迹审查          ↓ 可解释输出
         单步显性风险        多步组合风险         step / 代码级归因
```

## 功能模块

| 模块 | 说明 |
|------|------|
| **轨迹审查** | LangSmith 风格时间线，逐步展示 thought / tool_call / observation |
| **级联决策链** | 三层护栏决策流程，拦截点高亮 |
| **风险诊断** | AgentDoG 三维分类 + L3 精定位归因 |
| **评测面板** | 拦截率、误拦率、延迟、Token 成本、攻击类型分布 |
| **实时演示** | 逐步播放轨迹，拦截时全屏弹窗（答辩 Demo 用） |

## 后端接入

默认使用 `online-guardrail` 后端（见仓库 `online-guardrail/MO-GUIJI.md`）。

```powershell
# 终端 1
cd online-guardrail
$env:GUARDRAIL_MOCK = "1"
python -m guardrail serve --port 8340

# 终端 2
cd guardrail-dashboard
$env:NEXT_PUBLIC_USE_MOCK = "false"
npm run dev
```

也可继续纯 Mock：不设 `NEXT_PUBLIC_USE_MOCK=false` 即可。

修改 `src/lib/api.ts` 中 `USE_MOCK` 逻辑，或实现以下接口：


```
GET  /api/trajectories        → Trajectory[]
GET  /api/trajectories/:id    → Trajectory
GET  /api/metrics             → MetricsSummary
POST /api/guardrail/check     → GuardrailCheckResponse
```

数据类型定义见 `src/lib/types.ts`，Mock 样例见 `src/lib/mock-data.ts`。

## 技术栈

Next.js 16 · React 19 · Tailwind CSS 4 · Framer Motion · Recharts · Lucide Icons

## License

MIT
