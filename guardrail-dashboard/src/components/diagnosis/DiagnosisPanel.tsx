"use client";

import { useEffect, useRef, useState } from "react";
import { Expand, Layers } from "lucide-react";
import type { AgentSetting } from "@/lib/taxonomy";
import type { TrajectoryStep } from "@/lib/types";
import { resolveActiveLabels } from "@/lib/taxonomy";
import { StatusBadge } from "../shared/StatusBadge";
import { DiagnosisModal } from "./DiagnosisModal";

interface DiagnosisPanelProps {
  step: TrajectoryStep | null;
  accumulatedSteps?: TrajectoryStep[];
  agentSetting?: AgentSetting;
  /** full = 右侧半栏；footer = 底部入口条（详情全在弹窗） */
  layout?: "full" | "footer";
  modalOpen?: boolean;
  onModalOpenChange?: (open: boolean) => void;
  initialModalTab?: "summary" | "taxonomy" | "xai";
  /** 受控模式下同步父组件 tab（避免打开时被 initialModalTab 覆盖） */
  onModalTabChange?: (tab: "summary" | "taxonomy" | "xai") => void;
}

export function DiagnosisPanel({
  step,
  accumulatedSteps = [],
  agentSetting = "codex",
  layout = "full",
  modalOpen: controlledOpen,
  onModalOpenChange,
  initialModalTab = "summary",
  onModalTabChange,
}: DiagnosisPanelProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const [modalTab, setModalTab] = useState<"summary" | "taxonomy" | "xai">(initialModalTab);
  const openedViaFooterRef = useRef(false);
  const modalOpen = controlledOpen ?? internalOpen;
  const setModalOpen = onModalOpenChange ?? setInternalOpen;

  const openModal = (tab: "summary" | "taxonomy" | "xai" = "summary") => {
    openedViaFooterRef.current = true;
    setModalTab(tab);
    onModalTabChange?.(tab);
    setModalOpen(true);
  };

  // 父组件外部打开（如拦截弹窗）时同步 tab；底部按钮打开时跳过，避免被 stale initialModalTab 覆盖
  useEffect(() => {
    if (!modalOpen) {
      openedViaFooterRef.current = false;
      return;
    }
    if (openedViaFooterRef.current) {
      openedViaFooterRef.current = false;
      return;
    }
    if (controlledOpen !== undefined) {
      setModalTab(initialModalTab);
    }
  }, [controlledOpen, modalOpen, initialModalTab]);

  if (!step) {
    if (layout === "footer") return null;
    return (
      <div className="flex h-full items-center justify-center p-6 text-center">
        <p className="text-sm text-muted">选择被拦截或可疑步骤查看诊断详情</p>
      </div>
    );
  }

  const labels = step.guardrail.l2?.labels ?? step.guardrail.l3?.labels;
  const resolved = resolveActiveLabels(labels);
  const l3 = step.guardrail.l3;
  const hasLabels = resolved.riskSource || resolved.failureMode || resolved.realWorldHarm;
  const showXai = step.status === "blocked" || step.status === "suspicious";

  if (layout === "footer") {
    return (
      <>
        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={() => openModal("summary")}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-accent px-3 py-2.5 text-xs font-medium text-white transition-colors hover:bg-accent/90"
          >
            <Expand className="h-3.5 w-3.5" />
            打开完整诊断
          </button>
          {showXai && (
            <button
              type="button"
              onClick={() => openModal("xai")}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-[var(--l2)]/40 bg-[var(--l2)]/5 px-3 py-2.5 text-xs font-medium text-[var(--l2)] transition-colors hover:bg-[var(--l2)]/10"
            >
              XAI 溯源
            </button>
          )}
          <button
            type="button"
            onClick={() => openModal("taxonomy")}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-border px-3 py-2.5 text-xs font-medium text-foreground transition-colors hover:bg-card-hover"
          >
            <Layers className="h-3.5 w-3.5" />
            AgentDoG 完整分类
          </button>
        </div>
        <DiagnosisModal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          step={step}
          accumulatedSteps={accumulatedSteps}
          agentSetting={agentSetting}
          initialTab={modalTab}
        />
      </>
    );
  }

  return (
    <>
      <div className="flex h-full flex-col overflow-hidden">
        <div className="border-b border-border px-4 py-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">风险诊断</h3>
            <StatusBadge status={step.status} />
          </div>
        </div>

        <div className="flex flex-1 flex-col overflow-y-auto p-4">
          {hasLabels && (
            <section className="mb-4">
              <p className="mb-2 text-[10px] font-medium uppercase tracking-wider text-muted">
                三维标签
              </p>
              <div className="space-y-1.5">
                {resolved.riskSource && (
                  <CompactChip where="Where" name={resolved.riskSource.name} />
                )}
                {resolved.failureMode && (
                  <CompactChip where="How" name={resolved.failureMode.name} />
                )}
                {resolved.realWorldHarm && (
                  <CompactChip where="What" name={resolved.realWorldHarm.name} />
                )}
              </div>
            </section>
          )}

          {l3?.codeSpan && (
            <section className="mb-4">
              <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wider text-muted">
                精确定位预览
              </p>
              <pre className="line-clamp-3 rounded-lg border border-border bg-background/60 p-2.5 font-mono text-[10px] leading-relaxed text-danger/80">
                {l3.codeSpan.snippet}
              </pre>
            </section>
          )}

          {l3?.reason && (
            <p className="mb-4 line-clamp-3 text-[11px] leading-relaxed text-muted">
              {l3.reason}
            </p>
          )}

          <div className="mt-auto space-y-2 pt-2">
            <button
              type="button"
              onClick={() => openModal("summary")}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-3 py-2.5 text-xs font-medium text-white transition-colors hover:bg-accent/90"
            >
              <Expand className="h-3.5 w-3.5" />
              打开完整诊断
            </button>
            {showXai && (
              <button
                type="button"
                onClick={() => openModal("xai")}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-[var(--l2)]/40 bg-[var(--l2)]/5 px-3 py-2 text-xs font-medium text-[var(--l2)] transition-colors hover:bg-[var(--l2)]/10"
              >
                XAI 溯源
              </button>
            )}
            <button
              type="button"
              onClick={() => openModal("taxonomy")}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-border px-3 py-2 text-xs font-medium text-foreground transition-colors hover:bg-card-hover"
            >
              <Layers className="h-3.5 w-3.5" />
              AgentDoG 完整分类
            </button>
          </div>
        </div>
      </div>

      <DiagnosisModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        step={step}
        accumulatedSteps={accumulatedSteps}
        agentSetting={agentSetting}
        initialTab={modalTab}
      />
    </>
  );
}

function CompactChip({ where, name }: { where: string; name: string }) {
  return (
    <div className="rounded-lg border border-border bg-background/40 px-2.5 py-1.5">
      <span className="font-mono text-[9px] text-muted">{where}</span>
      <p className="truncate text-[11px] font-medium">{name}</p>
    </div>
  );
}
