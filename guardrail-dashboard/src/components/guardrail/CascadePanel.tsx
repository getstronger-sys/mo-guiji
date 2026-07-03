"use client";

import { ArrowRight, Ban, CheckCircle2, ChevronDown, Layers, ScanSearch, ShieldAlert, Zap } from "lucide-react";
import type { GuardrailResult, L2Result, L3Result, TrajectoryStep } from "@/lib/types";
import { cn, formatLatency, formatTokens } from "@/lib/utils";
import { RiskScoreHint } from "./RiskScoreHint";

interface CascadePanelProps {
  step: TrajectoryStep | null;
}

export function CascadePanel({ step }: CascadePanelProps) {
  if (!step) {
    return (
      <div className="flex h-full items-center justify-center p-8 text-center">
        <div>
          <Layers className="mx-auto mb-3 h-8 w-8 text-muted/40" />
          <p className="text-sm text-muted">选择轨迹步骤查看护栏决策链</p>
        </div>
      </div>
    );
  }

  const { guardrail } = step;
  const layers = buildLayers(guardrail);

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border px-4 py-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold">级联决策链</h3>
            <p className="text-[11px] text-muted">Step {step.index} · Tool 执行前审查</p>
          </div>
          <RiskScoreHint
            cumulativeRisk={step.cumulativeRisk}
            stepUnsafeProbability={step.stepUnsafeProbability}
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <div className="space-y-0">
          {layers.map((layer, i) => (
            <div key={layer.id}>
              <LayerCard layer={layer} />
              {i < layers.length - 1 && (
                <div className="flex justify-center py-1">
                  {guardrail.blockedAt === layer.id && !layer.diagnosticOnly ? (
                    <div className="flex items-center gap-1 rounded-full bg-danger/10 px-3 py-1 text-[10px] font-medium text-danger ring-1 ring-danger/20">
                      <Ban className="h-3 w-3" />
                      在此层拦截
                    </div>
                  ) : layer.diagnosticOnly ? (
                    <div className="flex items-center gap-1 rounded-full bg-[var(--l3)]/10 px-3 py-1 text-[10px] font-medium text-[var(--l3)] ring-1 ring-[var(--l3)]/20">
                      <ScanSearch className="h-3 w-3" />
                      并行诊断
                    </div>
                  ) : (
                    <ArrowRight className="h-4 w-4 rotate-90 text-border" />
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        <FinalDecision guardrail={guardrail} />
      </div>
    </div>
  );
}

interface LayerData {
  id: "l1" | "l2" | "l3";
  name: string;
  subtitle: string;
  icon: typeof Zap;
  color: string;
  passed: boolean;
  skipped?: boolean;
  diagnosticOnly?: boolean;
  latencyMs: number;
  tokens?: number;
  details: { label: string; value: string }[];
}

function l2Executed(l2: L2Result): boolean {
  return l2.latencyMs > 0 || l2.tokens > 0;
}

function l3Executed(l3: L3Result): boolean {
  return l3.latencyMs > 0 || Boolean(l3.reason || l3.codeSpan || l3.labels);
}

function buildLayers(guardrail: GuardrailResult): LayerData[] {
  const layers: LayerData[] = [
    {
      id: "l1",
      name: "L1 轻量规则",
      subtitle: "实时 · 零 Token",
      icon: Zap,
      color: "var(--l1)",
      passed: guardrail.l1.passed,
      latencyMs: guardrail.l1.latencyMs,
      details: [
        ...(guardrail.l1.ruleId
          ? [{ label: "规则 ID", value: guardrail.l1.ruleId }]
          : []),
        ...(guardrail.l1.rule ? [{ label: "触发规则", value: guardrail.l1.rule }] : []),
        ...(guardrail.l1.message ? [{ label: "说明", value: guardrail.l1.message }] : []),
        ...(guardrail.l1.confidence
          ? [{ label: "置信度", value: `${(guardrail.l1.confidence * 100).toFixed(0)}%` }]
          : [{ label: "结果", value: guardrail.l1.passed ? "通过" : "拦截" }]),
      ],
    },
  ];

  const l2 = guardrail.l2;
  if (l2) {
    const executed = l2Executed(l2);
    layers.push({
      id: "l2",
      name: "L2 AgentDoG",
      subtitle: executed ? (l2.model ?? "轨迹级 XAI 归因") : "未执行 · 节省 Token",
      icon: Layers,
      color: "var(--l2)",
      passed: l2.passed,
      skipped: !executed,
      latencyMs: l2.latencyMs,
      tokens: l2.tokens,
      details: executed
        ? [
            ...(l2.reason ? [{ label: "XAI 判决", value: l2.reason }] : []),
            ...(l2.analysis ? [{ label: "可解释分析", value: l2.analysis }] : []),
            ...(l2.labels
              ? [
                  { label: "Risk Source", value: l2.labels.riskSource },
                  { label: "Failure Mode", value: l2.labels.failureMode },
                  { label: "Real-world Harm", value: l2.labels.realWorldHarm },
                ]
              : []),
            ...(l2.confidence
              ? [{ label: "置信度", value: `${(l2.confidence * 100).toFixed(0)}%` }]
              : []),
            ...(l2.unsafeProbability !== undefined
              ? [
                  {
                    label: "P(不安全)",
                    value: `${(l2.unsafeProbability * 100).toFixed(0)}%`,
                  },
                ]
              : []),
          ]
        : [],
    });
  } else if (guardrail.blockedAt === "l1" && guardrail.l3?.diagnosticOnly) {
    layers.push({
      id: "l2",
      name: "L2 AgentDoG",
      subtitle: "L1 已拦截 · 跳过以节省 Token",
      icon: Layers,
      color: "var(--l2)",
      passed: true,
      skipped: true,
      latencyMs: 0,
      tokens: 0,
      details: [],
    });
  }

  const l3 = guardrail.l3;
  if (l3) {
    const executed = l3Executed(l3);
    layers.push({
      id: "l3",
      name: "L3 精定位",
      subtitle: l3.diagnosticOnly
        ? "诊断模式 · Step / 代码级归因"
        : "Step / 代码级归因",
      icon: ShieldAlert,
      color: "var(--l3)",
      passed: l3.passed,
      skipped: !executed,
      diagnosticOnly: l3.diagnosticOnly,
      latencyMs: l3.latencyMs,
      details: executed
        ? [
            ...(l3.toolName ? [{ label: "工具", value: l3.toolName }] : []),
            ...(l3.stepIndex !== undefined
              ? [{ label: "定位步骤", value: `Step ${l3.stepIndex}` }]
              : []),
            ...(l3.reason ? [{ label: "归因", value: l3.reason }] : []),
          ]
        : [],
    });
  }

  return layers;
}

function LayerCard({ layer }: { layer: LayerData }) {
  const Icon = layer.icon;

  return (
    <div
      className={cn(
        "rounded-xl border p-4 transition-all",
        layer.skipped
          ? "border-border/50 opacity-40"
          : layer.diagnosticOnly
            ? "border-[var(--l3)]/30 bg-[var(--l3)]/5"
            : layer.passed
              ? "border-safe/20 bg-safe/5"
              : "border-danger/30 bg-danger/5 glow-danger"
      )}
    >
      <div className="mb-3 flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div
            className="flex h-9 w-9 items-center justify-center rounded-lg"
            style={{ backgroundColor: `color-mix(in srgb, ${layer.color} 15%, transparent)` }}
          >
            <Icon className="h-4 w-4" style={{ color: layer.color }} />
          </div>
          <div>
            <h4 className="text-sm font-semibold">{layer.name}</h4>
            <p className="text-[10px] text-muted">{layer.subtitle}</p>
          </div>
        </div>
        {layer.skipped ? (
          <span className="text-[10px] text-muted">已跳过</span>
        ) : layer.diagnosticOnly ? (
          <span className="rounded-full bg-[var(--l3)]/10 px-2 py-0.5 text-[10px] font-medium text-[var(--l3)] ring-1 ring-[var(--l3)]/20">
            诊断完成
          </span>
        ) : layer.passed ? (
          <CheckCircle2 className="h-5 w-5 text-safe" />
        ) : (
          <Ban className="h-5 w-5 text-danger" />
        )}
      </div>

      {!layer.skipped && (
        <>
          <div className="mb-3 flex gap-4 text-[10px] text-muted">
            <span>延迟 {formatLatency(layer.latencyMs)}</span>
            {layer.tokens !== undefined && layer.tokens > 0 && (
              <span>Token {formatTokens(layer.tokens)}</span>
            )}
          </div>

          {layer.details.length > 0 && (
            <div className="space-y-1.5 rounded-lg bg-background/50 p-2.5">
              {layer.details.map((d) => (
                <div key={d.label} className="flex gap-2 text-[11px]">
                  <span className="shrink-0 text-muted">{d.label}</span>
                  <span className="text-foreground/90">{d.value}</span>
                </div>
              ))}
            </div>
          )}

          {layer.id === "l3" && layer.details.find((d) => d.label === "归因") && (
            <details className="mt-2">
              <summary className="flex cursor-pointer items-center gap-1 text-[10px] text-muted hover:text-foreground">
                <ChevronDown className="h-3 w-3" />
                展开完整归因
              </summary>
              <p className="mt-1.5 text-[11px] leading-relaxed text-foreground/80">
                {layer.details.find((d) => d.label === "归因")?.value}
              </p>
            </details>
          )}
        </>
      )}
    </div>
  );
}

function FinalDecision({ guardrail }: { guardrail: GuardrailResult }) {
  const isBlock = guardrail.finalDecision === "block";
  const hasDiagnosticL3 = guardrail.l3?.diagnosticOnly && l3Executed(guardrail.l3);

  return (
    <div
      className={cn(
        "mt-4 rounded-xl border p-4 text-center",
        isBlock ? "border-danger/30 bg-danger/5" : "border-safe/20 bg-safe/5"
      )}
    >
      <p className="mb-1 text-[10px] uppercase tracking-wider text-muted">最终决策</p>
      <p className={cn("text-lg font-bold", isBlock ? "text-danger" : "text-safe")}>
        {isBlock ? "⛔ 拦截执行" : "✓ 允许执行"}
      </p>
      {guardrail.blockedAt && (
        <p className="mt-1 text-[11px] text-muted">
          由 {guardrail.blockedAt.toUpperCase()} 层触发拦截
          {hasDiagnosticL3 && " · L3 已完成诊断归因"}
        </p>
      )}
    </div>
  );
}
