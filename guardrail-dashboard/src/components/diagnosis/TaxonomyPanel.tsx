"use client";

import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { ActiveLabels, AgentSetting, TaxonomyDimension, TaxonomyLabel } from "@/lib/taxonomy";
import {
  DIMENSION_META,
  getSettingBadge,
  groupByParentCategory,
  isNewCategory,
  resolveActiveLabels,
} from "@/lib/taxonomy";
import { cn } from "@/lib/utils";

interface TaxonomyPanelProps {
  activeLabels?: ActiveLabels;
  agentSetting?: AgentSetting;
  /** sidebar = 窄栏；modal = 弹窗大面板 */
  variant?: "sidebar" | "modal";
}

const DIMENSIONS: TaxonomyDimension[] = ["riskSource", "failureMode", "realWorldHarm"];

export function TaxonomyPanel({
  activeLabels,
  agentSetting = "codex",
  variant = "sidebar",
}: TaxonomyPanelProps) {
  const resolved = useMemo(() => resolveActiveLabels(activeLabels), [activeLabels]);
  const hitIds = useMemo(
    () =>
      new Set(
        [resolved.riskSource?.id, resolved.failureMode?.id, resolved.realWorldHarm?.id].filter(
          Boolean
        ) as string[]
      ),
    [resolved]
  );

  const [expandedDim, setExpandedDim] = useState<TaxonomyDimension | null>("failureMode");
  const [expandedLabelId, setExpandedLabelId] = useState<string | null>(
    resolved.failureMode?.id ?? null
  );

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <div className="shrink-0 border-b border-border px-4 py-3">
        <h3 className="text-sm font-semibold">AgentDoG 1.5 三维分类</h3>
        <p className="text-[11px] text-muted">
          完整 taxonomy · 当前 step 命中高亮
        </p>
        <div className="mt-2 flex flex-wrap gap-2 text-[9px]">
          <LegendDot className="bg-orange-400/80" label="OC 新增/加强" />
          <LegendDot className="bg-sky-400/80" label="CX 新增/加强" />
          <LegendDot className="ring-2 ring-accent ring-offset-1 ring-offset-background" label="当前命中" />
        </div>
      </div>

      {hitIds.size > 0 && (
        <div className="shrink-0 border-b border-border bg-accent/5 px-4 py-2">
          <p className="mb-1.5 text-[10px] font-medium text-muted">当前 Step 诊断标签</p>
          <div className="flex flex-wrap gap-1.5">
            {DIMENSIONS.map((dim) => {
              const label = resolved[dim];
              if (!label) return null;
              return (
                <button
                  key={label.id}
                  type="button"
                  onClick={() => {
                    setExpandedDim(dim);
                    setExpandedLabelId(label.id);
                  }}
                  className="rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-medium text-accent ring-1 ring-accent/25"
                >
                  {DIMENSION_META[dim].where}: {label.name}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div
        className={cn(
          "min-h-0 flex-1 overflow-y-auto overscroll-contain p-3",
          variant === "modal" ? "space-y-3 p-5" : "space-y-2"
        )}
      >
        {DIMENSIONS.map((dim) => (
          <DimensionSection
            key={dim}
            dimension={dim}
            agentSetting={agentSetting}
            hitIds={hitIds}
            isOpen={expandedDim === dim}
            onToggle={() => setExpandedDim(expandedDim === dim ? null : dim)}
            expandedLabelId={expandedLabelId}
            onExpandLabel={setExpandedLabelId}
            variant={variant}
          />
        ))}
      </div>
    </div>
  );
}

function LegendDot({ className, label }: { className: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1 text-muted">
      <span className={cn("h-2 w-2 rounded-sm", className)} />
      {label}
    </span>
  );
}

function DimensionSection({
  dimension,
  agentSetting,
  hitIds,
  isOpen,
  onToggle,
  expandedLabelId,
  onExpandLabel,
  variant = "sidebar",
}: {
  dimension: TaxonomyDimension;
  agentSetting: AgentSetting;
  hitIds: Set<string>;
  isOpen: boolean;
  onToggle: () => void;
  expandedLabelId: string | null;
  onExpandLabel: (id: string | null) => void;
  variant?: "sidebar" | "modal";
}) {
  const meta = DIMENSION_META[dimension];
  const groups = groupByParentCategory(dimension);
  const hitCount = [...hitIds].filter((id) =>
    [...groups.values()].some((labels) => labels.some((l) => l.id === id))
  ).length;

  const colorRing = {
    cyan: "ring-cyan-500/30 border-cyan-500/20",
    violet: "ring-violet-500/30 border-violet-500/20",
    rose: "ring-rose-500/30 border-rose-500/20",
  }[meta.color];

  return (
    <div className={cn("rounded-xl border bg-card/50", colorRing)}>
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between px-3 py-2.5 text-left"
      >
        <div className="flex items-center gap-2">
          {isOpen ? (
            <ChevronDown className="h-3.5 w-3.5 text-muted" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 text-muted" />
          )}
          <div>
            <p className="text-xs font-semibold">
              <span className="font-mono text-[10px] opacity-60">{meta.where}</span>{" "}
              {meta.subtitle}
            </p>
            <p className="text-[10px] text-muted">{meta.title}</p>
          </div>
        </div>
        {hitCount > 0 && (
          <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-medium text-accent">
            {hitCount} 命中
          </span>
        )}
      </button>

      {isOpen && (
        <div className="space-y-2 border-t border-border px-2 pb-2 pt-1">
          {[...groups.entries()].map(([parent, labels]) => (
            <div key={parent}>
              <p className="px-1 py-1 text-[9px] font-medium uppercase tracking-wider text-muted">
                {parent}
              </p>
              <div className="space-y-1">
                {labels.map((label) => (
                  <LabelRow
                    key={label.id}
                    label={label}
                    agentSetting={agentSetting}
                    isHit={hitIds.has(label.id)}
                    isExpanded={expandedLabelId === label.id}
                    onToggle={() =>
                      onExpandLabel(expandedLabelId === label.id ? null : label.id)
                    }
                    variant={variant}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function LabelRow({
  label,
  agentSetting,
  isHit,
  isExpanded,
  onToggle,
  variant = "sidebar",
}: {
  label: TaxonomyLabel;
  agentSetting: AgentSetting;
  isHit: boolean;
  isExpanded: boolean;
  onToggle: () => void;
  variant?: "sidebar" | "modal";
}) {
  const badges = getSettingBadge(label);
  const isNew = isNewCategory(label, agentSetting);

  return (
    <div
      className={cn(
        "rounded-lg border transition-all",
        isHit
          ? "border-accent/50 bg-accent/10 ring-1 ring-accent/30"
          : "border-border-subtle bg-background/40"
      )}
    >
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-start gap-2 px-2.5 py-2 text-left"
      >
        {isExpanded ? (
          <ChevronDown className="mt-0.5 h-3 w-3 shrink-0 text-muted" />
        ) : (
          <ChevronRight className="mt-0.5 h-3 w-3 shrink-0 text-muted" />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1">
            <span
              className={cn(
                "font-medium leading-snug",
                variant === "modal" ? "text-sm" : "text-[11px]",
                isHit && "text-accent"
              )}
            >
              {label.name}
            </span>
            {isHit && (
              <span className="rounded bg-accent/20 px-1 py-px text-[8px] font-bold text-accent">
                HIT
              </span>
            )}
            {badges.includes("OC") && <SettingBadge type="OC" isNew={label.isNewOpenClaw} />}
            {badges.includes("CX") && <SettingBadge type="CX" isNew={label.isNewCodex} />}
            {isNew && (
              <span className="rounded bg-muted/20 px-1 py-px text-[8px] text-muted">新增</span>
            )}
          </div>
        </div>
      </button>

      {isExpanded && (
        <div
          className={cn(
            "space-y-2 border-t border-border/60 px-3 pb-2.5 pt-2 leading-relaxed",
            variant === "modal" ? "text-sm" : "text-[11px]"
          )}
        >
          <div>
            <p className="mb-0.5 text-[9px] font-medium uppercase text-muted">通用定义</p>
            <p className="text-foreground/85">{label.description}</p>
          </div>

          {label.clawNote && (
            <div className="rounded-md border border-orange-500/20 bg-orange-500/5 p-2">
              <p className="mb-0.5 flex items-center gap-1 text-[9px] font-medium text-orange-400">
                <SettingBadge type="OC" isNew={label.isNewOpenClaw} />
                OpenClaw 锐化含义
              </p>
              <p className="text-foreground/80">{label.clawNote}</p>
            </div>
          )}

          {label.codexNote && (
            <div className="rounded-md border border-sky-500/20 bg-sky-500/5 p-2">
              <p className="mb-0.5 flex items-center gap-1 text-[9px] font-medium text-sky-400">
                <SettingBadge type="CX" isNew={label.isNewCodex} />
                Codex 锐化含义
              </p>
              <p className="text-foreground/80">{label.codexNote}</p>
            </div>
          )}

          {!label.clawNote && !label.codexNote && (
            <p className="text-[10px] text-muted italic">
              该类别在 ATBench 通用 setting 下无额外 scenario 锐化说明。
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function SettingBadge({ type, isNew }: { type: "OC" | "CX"; isNew?: boolean }) {
  const styles =
    type === "OC"
      ? "bg-orange-500/15 text-orange-400 ring-orange-500/25"
      : "bg-sky-500/15 text-sky-400 ring-sky-500/25";

  return (
    <span
      className={cn(
        "inline-flex items-center rounded px-1 py-px font-mono text-[8px] font-bold ring-1",
        styles
      )}
      title={isNew ? `${type} 新增叶子类别` : `${type} 加强继承类别`}
    >
      {type}
    </span>
  );
}
