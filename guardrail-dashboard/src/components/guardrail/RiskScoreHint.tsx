"use client";

import { useState } from "react";
import { HelpCircle, TrendingUp } from "lucide-react";
import { Modal } from "@/components/shared/Modal";

interface RiskScoreHintProps {
  cumulativeRisk?: number;
  stepUnsafeProbability?: number;
  compact?: boolean;
}

export function RiskScoreHint({
  cumulativeRisk,
  stepUnsafeProbability,
  compact = false,
}: RiskScoreHintProps) {
  const [open, setOpen] = useState(false);

  if (cumulativeRisk === undefined) return null;

  const cumPct = Math.round(cumulativeRisk * 100);
  const stepPct =
    stepUnsafeProbability !== undefined ? Math.round(stepUnsafeProbability * 100) : null;

  if (compact) {
    return (
      <>
        <span
          role="button"
          tabIndex={0}
          onClick={(e) => {
            e.stopPropagation();
            setOpen(true);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              e.stopPropagation();
              setOpen(true);
            }
          }}
          className="inline-flex cursor-pointer items-center gap-0.5 text-muted transition-colors hover:text-accent"
          title="风险累计怎么算？"
        >
          <HelpCircle className="h-3 w-3" />
        </span>
        <RiskScoreExplainerModal
          open={open}
          onClose={() => setOpen(false)}
          cumulativeRisk={cumulativeRisk}
          stepUnsafeProbability={stepUnsafeProbability}
        />
      </>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-md border border-border px-2 py-1 text-[10px] text-muted transition-colors hover:border-accent/40 hover:text-accent"
      >
        <TrendingUp className="h-3 w-3" />
        累计 {cumPct}%
        {stepPct !== null && <span className="text-muted/70">· 本步 {stepPct}%</span>}
        <HelpCircle className="h-3 w-3" />
      </button>
      <RiskScoreExplainerModal
        open={open}
        onClose={() => setOpen(false)}
        cumulativeRisk={cumulativeRisk}
        stepUnsafeProbability={stepUnsafeProbability}
      />
    </>
  );
}

function RiskScoreExplainerModal({
  open,
  onClose,
  cumulativeRisk,
  stepUnsafeProbability,
}: {
  open: boolean;
  onClose: () => void;
  cumulativeRisk: number;
  stepUnsafeProbability?: number;
}) {
  const cumPct = Math.round(cumulativeRisk * 100);
  const stepPct =
    stepUnsafeProbability !== undefined ? Math.round(stepUnsafeProbability * 100) : null;

  return (
    <Modal open={open} onClose={onClose} title="风险累计 · 怎么算出来的？" size="lg">
      <div className="overflow-y-auto overscroll-contain px-5 py-5 sm:px-6 sm:py-6">
        <div className="space-y-5 text-sm leading-7">
          <p className="text-foreground/90">
            把 Agent 的每一步想象成「体检一次」。每一步都会得到一个
            <strong className="text-accent">本步不安全概率 p</strong>，然后按轨迹累加：
          </p>

          <div className="rounded-xl border border-accent/30 bg-accent/5 px-4 py-3.5">
            <p className="font-mono text-[13px] leading-relaxed tracking-wide">
              R<sub>i</sub> = 1 − (1 − R<sub>i−1</sub>) × (1 − p<sub>i</sub>)
            </p>
          </div>

          <div className="space-y-3 text-foreground/85">
            <p className="font-medium">本步 p 从哪来？</p>
            <ul className="ml-1 space-y-2.5 text-[13px] leading-6 text-muted">
              <li className="flex gap-2">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-muted/60" />
                <span>
                  <strong className="text-foreground/80">L1</strong>：规则命中 → p ≈ 规则置信度；敏感路径告警
                  → 中等 p；全通过 → 很低（~2%）
                </span>
              </li>
              <li className="flex gap-2">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-muted/60" />
                <span>
                  <strong className="text-foreground/80">L2</strong>：AgentDoG 给出 P(不安全)；判 safe 时 p =
                  1 − 置信度
                </span>
              </li>
              <li className="flex gap-2">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-muted/60" />
                <span>L1 与 L2 用 noisy-OR 合并：任一层觉得可疑，本步 p 就会升高</span>
              </li>
            </ul>
          </div>

          {(cumPct > 0 || stepPct !== null) && (
            <div className="rounded-xl border border-border bg-card/60 px-4 py-4">
              <p className="mb-3 text-xs font-medium uppercase tracking-wider text-muted">
                当前这一步
              </p>
              <div className="space-y-1.5 text-[13px] leading-6">
                {stepPct !== null && (
                  <p>
                    本步不安全概率：<span className="font-mono text-accent">{stepPct}%</span>
                  </p>
                )}
                <p>
                  轨迹累计风险：<span className="font-mono text-accent">{cumPct}%</span>
                </p>
              </div>
              <p className="mt-3 border-t border-border/60 pt-3 text-xs leading-5 text-muted">
                累计不是简单相加——早期低危步骤不会一下子拉满，但连续可疑会快速逼近 100%。
              </p>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
