"use client";

import { motion } from "framer-motion";
import { Code2, MessageSquare, Terminal, Wrench } from "lucide-react";
import type { TrajectoryStep } from "@/lib/types";
import { cn, formatLatency } from "@/lib/utils";
import { StatusBadge } from "../shared/StatusBadge";
import { RiskScoreHint } from "../guardrail/RiskScoreHint";

interface StepCardProps {
  step: TrajectoryStep;
  isSelected: boolean;
  isActive?: boolean;
  onClick: () => void;
  showConnector?: boolean;
  isLast?: boolean;
}

const actionIcons = {
  tool_call: Wrench,
  message: MessageSquare,
  code: Code2,
  plan: Terminal,
};

export function StepCard({
  step,
  isSelected,
  isActive,
  onClick,
  showConnector = true,
  isLast,
}: StepCardProps) {
  const ActionIcon = actionIcons[step.action.type];
  const riskPercent = Math.round((step.cumulativeRisk ?? 0) * 100);

  return (
    <div className="relative flex gap-3">
      {showConnector && (
        <div className="flex flex-col items-center">
          <div
            className={cn(
              "z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 transition-all",
              step.status === "blocked"
                ? "border-danger bg-danger/20 glow-danger"
                : step.status === "suspicious"
                  ? "border-warning bg-warning/20"
                  : step.status === "running"
                    ? "border-accent bg-accent/20 animate-pulse"
                    : isSelected
                      ? "border-accent bg-accent/10"
                      : "border-border bg-card"
            )}
          >
            <span className="font-mono text-[11px] font-bold">{step.index}</span>
          </div>
          {!isLast && (
            <div
              className={cn(
                "w-0.5 flex-1 min-h-[24px]",
                step.status === "blocked" ? "bg-danger/40" : "bg-border"
              )}
            />
          )}
        </div>
      )}

      <motion.button
        layout
        onClick={onClick}
        className={cn(
          "mb-3 flex-1 rounded-xl border p-3 text-left transition-all",
          isSelected
            ? "border-accent/40 bg-accent/5 ring-1 ring-accent/20"
            : "border-border-subtle bg-card hover:border-border hover:bg-card-hover",
          isActive && "border-accent/60 glow-safe",
          step.status === "blocked" && !isSelected && "border-danger/30 bg-danger/5"
        )}
        whileHover={{ scale: 1.005 }}
        whileTap={{ scale: 0.995 }}
      >
        <div className="mb-2 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <ActionIcon className="h-3.5 w-3.5 text-muted" />
            <span className="font-mono text-[11px] text-muted">{step.timestamp}</span>
            {step.action.tool && (
              <span className="rounded bg-background px-1.5 py-0.5 font-mono text-[10px] text-accent">
                {step.action.tool}
              </span>
            )}
          </div>
          <StatusBadge status={step.status} />
        </div>

        {step.thought && (
          <p className="mb-2 line-clamp-2 text-xs leading-relaxed text-muted">{step.thought}</p>
        )}

        <div className="rounded-lg bg-background/60 p-2 font-mono text-[11px] leading-relaxed">
          {step.action.type === "tool_call" && step.action.args && (
            <span className="text-foreground/80">
              {JSON.stringify(step.action.args, null, 0).slice(0, 120)}
              {JSON.stringify(step.action.args).length > 120 && "…"}
            </span>
          )}
          {step.action.content && (
            <span className="text-foreground/80">{step.action.content}</span>
          )}
        </div>

        <div className="mt-2 flex items-center justify-between">
          <div className="flex items-center gap-3 text-[10px] text-muted">
            <span>L1 {formatLatency(step.guardrail.l1.latencyMs)}</span>
            {step.guardrail.l2 && (
              <span>L2 {formatLatency(step.guardrail.l2.latencyMs)}</span>
            )}
            {step.guardrail.l3 && (
              <span>L3 {formatLatency(step.guardrail.l3.latencyMs)}</span>
            )}
          </div>
          {step.cumulativeRisk !== undefined && (
            <div className="flex items-center gap-1.5">
              <div className="h-1 w-16 overflow-hidden rounded-full bg-border">
                <div
                  className={cn(
                    "h-full rounded-full transition-all",
                    riskPercent > 70 ? "bg-danger" : riskPercent > 40 ? "bg-warning" : "bg-safe"
                  )}
                  style={{ width: `${riskPercent}%` }}
                />
              </div>
              <span className="font-mono text-[10px] text-muted">{riskPercent}%</span>
              <RiskScoreHint
                compact
                cumulativeRisk={step.cumulativeRisk}
                stepUnsafeProbability={step.stepUnsafeProbability}
              />
            </div>
          )}
        </div>
      </motion.button>
    </div>
  );
}
