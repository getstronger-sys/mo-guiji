import type { AgentSetting } from "./taxonomy";

export type { AgentSetting };
export type StepStatus = "safe" | "suspicious" | "blocked" | "pending" | "running";

export interface RiskLabels {
  riskSource: string;
  failureMode: string;
  realWorldHarm: string;
}

export interface L1Result {
  passed: boolean;
  rule?: string;
  ruleId?: string;
  message?: string;
  latencyMs: number;
  confidence?: number;
  severity?: "block" | "warn";
}

export interface L2Result {
  passed: boolean;
  labels?: RiskLabels;
  /** AgentDoG XAI 判决理由 */
  reason?: string;
  /** AgentDoG 可解释分析 */
  analysis?: string;
  latencyMs: number;
  tokens: number;
  confidence?: number;
  /** P(unsafe) from L2 model */
  unsafeProbability?: number;
  model?: string;
}

export interface L3Result {
  passed: boolean;
  stepIndex?: number;
  toolName?: string;
  codeSpan?: { start: number; end: number; snippet: string };
  reason?: string;
  labels?: RiskLabels;
  latencyMs: number;
  confidence?: number;
  /** L1/L2 已拦截时，L3 仅以诊断模式运行，不参与放行决策 */
  diagnosticOnly?: boolean;
}

export interface GuardrailResult {
  l1: L1Result;
  l2?: L2Result;
  l3?: L3Result;
  finalDecision: "allow" | "block" | "pending";
  blockedAt?: "l1" | "l2" | "l3";
}

export interface TrajectoryStep {
  index: number;
  timestamp: string;
  thought?: string;
  action: {
    type: "tool_call" | "message" | "code" | "plan";
    tool?: string;
    args?: Record<string, unknown>;
    content?: string;
  };
  observation?: string;
  guardrail: GuardrailResult;
  status: StepStatus;
  cumulativeRisk?: number;
  stepUnsafeProbability?: number;
}

export interface Trajectory {
  id: string;
  name: string;
  agent: string;
  environment: string;
  /** ATBench / Codex / OpenClaw — 决定 taxonomy 锐化说明 */
  agentSetting?: AgentSetting;
  startedAt: string;
  durationMs: number;
  status: "completed" | "blocked" | "running";
  steps: TrajectoryStep[];
  summary?: {
    totalSteps: number;
    blockedStep?: number;
    attackType?: string;
    isCombinationAttack?: boolean;
  };
}

export interface MetricsSummary {
  interceptionRate: number;
  falsePositiveRate: number;
  precision: number;
  recall: number;
  latencyP50: number;
  latencyP99: number;
  avgTokensPerCheck: number;
  totalChecks: number;
  blockedCount: number;
  attackTypeBreakdown: { type: string; count: number; blocked: number }[];
  layerStats: {
    layer: "L1" | "L2" | "L3";
    checks: number;
    blocks: number;
    avgLatencyMs: number;
    avgTokens: number;
  }[];
  timeline: { time: string; latency: number; blocks: number }[];
}

export interface GuardrailCheckRequest {
  trajectoryId: string;
  stepIndex: number;
  accumulatedSteps: TrajectoryStep[];
}

export interface GuardrailCheckResponse {
  stepIndex: number;
  guardrail: GuardrailResult;
  status: StepStatus;
  cumulativeRisk?: number;
  stepUnsafeProbability?: number;
}

export interface XaiTopStep {
  step_index: number;
  traj_index?: number | null;
  llr_score: number;
  role?: string;
  preview?: string;
}

export interface XaiSentenceScore {
  sentence_index: number;
  text: string;
  scores: {
    drop_score: number;
    hold_score: number;
    total_score: number;
  };
}

export interface XaiSentenceAttribution {
  step_index: number;
  traj_index: number;
  role: string;
  original_content: string;
  sentence_analysis: XaiSentenceScore[];
}

export interface XaiAttributionResult {
  mode: "mock" | "agentdog-xai" | string;
  model?: string;
  argmax_step_index?: number;
  target_preview?: string;
  top_steps?: XaiTopStep[];
  sentence_attribution?: XaiSentenceAttribution[];
  fallback_reason?: string;
}

export interface XaiAttributeRequest {
  stepIndex: number;
  accumulatedSteps: TrajectoryStep[];
}
