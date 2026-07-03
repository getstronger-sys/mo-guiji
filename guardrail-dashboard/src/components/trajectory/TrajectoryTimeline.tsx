"use client";

import { useMemo } from "react";
import { GitBranch, Shield } from "lucide-react";
import type { Trajectory, TrajectoryStep } from "@/lib/types";
import { StepCard } from "./StepCard";

interface TrajectoryTimelineProps {
  trajectory: Trajectory;
  selectedStep: number | null;
  activeStep?: number | null;
  onSelectStep: (index: number) => void;
}

export function TrajectoryTimeline({
  trajectory,
  selectedStep,
  activeStep,
  onSelectStep,
}: TrajectoryTimelineProps) {
  const combinationChain = useMemo(() => {
    if (!trajectory.summary?.isCombinationAttack) return [];
    return trajectory.steps
      .filter((s) => s.status === "suspicious" || s.status === "blocked")
      .map((s) => s.index);
  }, [trajectory]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-accent" />
          <h3 className="text-sm font-semibold">执行轨迹</h3>
          <span className="rounded-full bg-background px-2 py-0.5 font-mono text-[10px] text-muted">
            {trajectory.steps.length} steps
          </span>
        </div>
        {trajectory.summary?.isCombinationAttack && (
          <div className="flex items-center gap-1.5 rounded-full bg-warning/10 px-2.5 py-1 text-[10px] font-medium text-warning ring-1 ring-warning/20">
            <GitBranch className="h-3 w-3" />
            组合攻击链
          </div>
        )}
      </div>

      {combinationChain.length > 0 && (
        <div className="border-b border-border bg-warning/5 px-4 py-2.5">
          <p className="text-[11px] text-warning/90">
            <span className="font-semibold">攻击链：</span>
            Step {combinationChain.join(" → ")} — 单步低风险，组合构成{" "}
            {trajectory.summary?.attackType}
          </p>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-4">
        {trajectory.steps.map((step, i) => (
          <StepCard
            key={step.index}
            step={step}
            isSelected={selectedStep === step.index}
            isActive={activeStep === step.index}
            onClick={() => onSelectStep(step.index)}
            isLast={i === trajectory.steps.length - 1}
          />
        ))}
      </div>
    </div>
  );
}

export function TrajectoryList({
  trajectories,
  selectedId,
  onSelect,
}: {
  trajectories: Trajectory[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="space-y-2 p-3">
      {trajectories.map((t) => (
        <button
          key={t.id}
          onClick={() => onSelect(t.id)}
          className={`w-full rounded-lg border p-3 text-left transition-all ${
            selectedId === t.id
              ? "border-accent/40 bg-accent/5"
              : "border-border-subtle bg-card hover:border-border"
          }`}
        >
          <div className="mb-1 flex items-center justify-between">
            <span className="text-xs font-medium line-clamp-1">{t.name}</span>
            <span
              className={`shrink-0 rounded px-1.5 py-0.5 text-[9px] font-medium ${
                t.status === "blocked"
                  ? "bg-danger/10 text-danger"
                  : t.status === "completed"
                    ? "bg-safe/10 text-safe"
                    : "bg-accent/10 text-accent"
              }`}
            >
              {t.status === "blocked" ? "拦截" : t.status === "completed" ? "安全" : "运行中"}
            </span>
          </div>
          <p className="font-mono text-[10px] text-muted">{t.id}</p>
        </button>
      ))}
    </div>
  );
}
