"use client";

import { useEffect, useRef, useState } from "react";
import { Crosshair, FileCode, MapPin } from "lucide-react";
import { fetchXaiAttribution } from "@/lib/api";
import type { AgentSetting } from "@/lib/taxonomy";
import type { TrajectoryStep, XaiAttributionResult } from "@/lib/types";
import { resolveActiveLabels } from "@/lib/taxonomy";
import { cn } from "@/lib/utils";
import { Modal } from "../shared/Modal";
import { StatusBadge } from "../shared/StatusBadge";
import { TaxonomyPanel } from "./TaxonomyPanel";
import { XaiAttributionPanel } from "./XaiAttributionPanel";

interface DiagnosisModalProps {
  open: boolean;
  onClose: () => void;
  step: TrajectoryStep;
  accumulatedSteps: TrajectoryStep[];
  agentSetting?: AgentSetting;
  initialTab?: "summary" | "taxonomy" | "xai";
}

type Tab = "summary" | "taxonomy" | "xai";

export function DiagnosisModal({
  open,
  onClose,
  step,
  accumulatedSteps,
  agentSetting = "codex",
  initialTab = "summary",
}: DiagnosisModalProps) {
  const [tab, setTab] = useState<Tab>(initialTab);
  const [xaiData, setXaiData] = useState<XaiAttributionResult | null>(null);
  const [xaiLoading, setXaiLoading] = useState(false);
  const [xaiError, setXaiError] = useState<string | null>(null);
  const prevOpenRef = useRef(false);

  const showXai = step.status === "blocked" || step.status === "suspicious";

  useEffect(() => {
    const justOpened = open && !prevOpenRef.current;
    if (justOpened) {
      setTab(initialTab);
    }
    prevOpenRef.current = open;
  }, [open, initialTab]);

  useEffect(() => {
    if (!open || tab !== "xai" || !showXai) return;

    let cancelled = false;
    setXaiLoading(true);
    setXaiError(null);

    fetchXaiAttribution({
      stepIndex: step.index,
      accumulatedSteps,
    })
      .then((result) => {
        if (cancelled) return;
        if (!result) {
          setXaiError("XAI 归因服务不可用，请确认后端 8340 已启动");
          setXaiData(null);
        } else {
          setXaiData(result);
        }
      })
      .catch(() => {
        if (!cancelled) setXaiError("加载 XAI 归因失败");
      })
      .finally(() => {
        if (!cancelled) setXaiLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, tab, showXai, step.index, accumulatedSteps.length]);

  const labels = step.guardrail.l2?.labels ?? step.guardrail.l3?.labels;
  const resolved = resolveActiveLabels(labels);
  const l3 = step.guardrail.l3;
  const l2 = step.guardrail.l2;

  const modalTitle =
    tab === "xai"
      ? "XAI 溯源 · 轨迹归因"
      : tab === "taxonomy"
        ? "AgentDoG 完整分类"
        : "风险诊断详情";

  const modalSubtitle =
    tab === "xai"
      ? `Step ${step.index} · Drop+Hold 句子级归因`
      : tab === "taxonomy"
        ? `Step ${step.index} · ATBench 三维 taxonomy`
        : `Step ${step.index} · ${step.action.tool ?? step.action.type}`;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={modalTitle}
      subtitle={modalSubtitle}
      size="full"
    >
      <div className="flex h-full min-h-0 flex-col overflow-hidden">
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-3">
          <div className="flex flex-wrap gap-1 rounded-lg bg-background/60 p-0.5 ring-1 ring-border">
            <TabButton active={tab === "summary"} onClick={() => setTab("summary")}>
              诊断摘要
            </TabButton>
            {showXai && (
              <TabButton active={tab === "xai"} onClick={() => setTab("xai")}>
                XAI 溯源
              </TabButton>
            )}
            <TabButton active={tab === "taxonomy"} onClick={() => setTab("taxonomy")}>
              完整分类
            </TabButton>
          </div>
          <StatusBadge status={step.status} />
        </div>

        {tab === "taxonomy" ? (
          <div className="min-h-0 flex-1 overflow-hidden">
            <TaxonomyPanel activeLabels={labels} agentSetting={agentSetting} variant="modal" />
          </div>
        ) : tab === "xai" ? (
          <div className="min-h-0 flex-1 overflow-hidden">
            <XaiAttributionPanel
              data={xaiData}
              loading={xaiLoading}
              error={xaiError}
              currentStepIndex={step.index}
            />
          </div>
        ) : (
          <div className="grid min-h-0 flex-1 gap-6 overflow-y-auto overscroll-contain p-5 xl:grid-cols-2">
            <div className="min-w-0 space-y-5">
              {(resolved.riskSource || resolved.failureMode || resolved.realWorldHarm) && (
                <section>
                  <p className="mb-3 text-[10px] font-medium uppercase tracking-wider text-muted">
                    当前 Step 三维标签
                  </p>
                  <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-3">
                    {resolved.riskSource && (
                      <HitChip where="Where" name={resolved.riskSource.name} color="cyan" />
                    )}
                    {resolved.failureMode && (
                      <HitChip where="How" name={resolved.failureMode.name} color="violet" />
                    )}
                    {resolved.realWorldHarm && (
                      <HitChip where="What" name={resolved.realWorldHarm.name} color="rose" />
                    )}
                  </div>
                </section>
              )}

              {l2?.reason && (
                <section>
                  <h4 className="mb-2 text-[11px] font-medium uppercase tracking-wider text-muted">
                    AgentDoG XAI 判决
                  </h4>
                  <p className="rounded-xl border border-[var(--l2)]/20 bg-[var(--l2)]/5 p-4 text-sm leading-relaxed">
                    {l2.reason}
                  </p>
                </section>
              )}

              {l2?.analysis && (
                <section>
                  <h4 className="mb-2 text-[11px] font-medium uppercase tracking-wider text-muted">
                    可解释分析
                  </h4>
                  <p className="rounded-xl border border-border bg-background/50 p-4 text-sm leading-relaxed text-foreground/90">
                    {l2.analysis}
                  </p>
                </section>
              )}

              {step.thought && (
                <section>
                  <h4 className="mb-2 text-[11px] font-medium uppercase tracking-wider text-muted">
                    Agent 意图
                  </h4>
                  <p className="rounded-xl border border-border bg-background/50 p-4 text-sm leading-relaxed text-muted italic">
                    &ldquo;{step.thought}&rdquo;
                  </p>
                </section>
              )}

              {l3?.reason && !l2?.analysis && (
                <section>
                  <h4 className="mb-2.5 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-muted">
                    <FileCode className="h-3.5 w-3.5" />
                    执行点报告
                  </h4>
                  <p className="rounded-xl border border-border bg-background/50 p-4 text-sm leading-relaxed text-foreground/90">
                    {l3.reason}
                  </p>
                </section>
              )}
            </div>

            <div className="min-w-0 space-y-5">
              {l3?.codeSpan && (
                <section>
                  <h4 className="mb-2.5 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-muted">
                    <Crosshair className="h-3.5 w-3.5 shrink-0" />
                    PRE_TOOL 执行点
                  </h4>
                  <div className="rounded-xl border border-[var(--l3)]/25 bg-[var(--l3)]/5 p-4">
                    <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
                      <MapPin className="h-3.5 w-3.5 shrink-0 text-[var(--l3)]" />
                      <span className="font-medium text-[var(--l3)]">Step {l3.stepIndex}</span>
                      {l3.toolName && (
                        <span className="rounded-md bg-background px-2 py-0.5 font-mono text-[11px]">
                          {l3.toolName}
                        </span>
                      )}
                    </div>
                    <pre className="max-w-full overflow-x-auto whitespace-pre-wrap break-all rounded-lg bg-background p-4 font-mono text-xs leading-relaxed text-danger/90">
                      <code>{l3.codeSpan.snippet}</code>
                    </pre>
                  </div>
                </section>
              )}

              {showXai && (
                <section className="rounded-xl border border-dashed border-[var(--l2)]/30 bg-[var(--l2)]/5 p-4">
                  <p className="text-xs text-muted">
                    查看 AgentDoG 论文级轨迹/句子归因（Δᵢ、Drop+Hold）请切换到
                    <button
                      type="button"
                      onClick={() => setTab("xai")}
                      className="mx-1 font-medium text-[var(--l2)] hover:underline"
                    >
                      XAI 溯源
                    </button>
                    标签页。
                  </p>
                </section>
              )}

              <section className="rounded-xl border border-dashed border-border bg-background/30 p-4">
                <p className="text-xs text-muted">
                  完整 taxonomy 见
                  <button
                    type="button"
                    onClick={() => setTab("taxonomy")}
                    className="mx-1 font-medium text-accent hover:underline"
                  >
                    完整分类
                  </button>
                  标签页。
                </p>
              </section>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-md px-4 py-2 text-xs font-medium transition-all ${
        active
          ? "bg-card text-foreground shadow-sm ring-1 ring-border"
          : "text-muted hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

function HitChip({
  where,
  name,
  color,
}: {
  where: string;
  name: string;
  color: "cyan" | "violet" | "rose";
}) {
  const styles = {
    cyan: "border-cyan-500/20 bg-cyan-500/5 text-cyan-400",
    violet: "border-violet-500/20 bg-violet-500/5 text-violet-400",
    rose: "border-rose-500/20 bg-rose-500/5 text-rose-400",
  };

  return (
    <div className={cn("min-w-0 rounded-xl border px-3 py-3", styles[color])}>
      <span className="font-mono text-[10px] uppercase opacity-70">{where}</span>
      <p className="mt-1 text-sm font-medium leading-snug break-words">{name}</p>
    </div>
  );
}
