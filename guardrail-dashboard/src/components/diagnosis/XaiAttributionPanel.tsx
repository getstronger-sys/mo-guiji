"use client";

import { useEffect, useState } from "react";
import { AlertCircle, HelpCircle, Loader2, Sparkles } from "lucide-react";
import type { XaiAttributionResult, XaiSentenceAttribution } from "@/lib/types";
import { cn } from "@/lib/utils";
import {
  XaiKnowledgeExplainer,
  XaiKnowledgeTeaser,
} from "./XaiKnowledgeExplainer";

interface XaiAttributionPanelProps {
  data: XaiAttributionResult | null;
  loading: boolean;
  error?: string | null;
  currentStepIndex: number;
}

export function XaiAttributionPanel({
  data,
  loading,
  error,
  currentStepIndex,
}: XaiAttributionPanelProps) {
  const [expandedTraj, setExpandedTraj] = useState<number | null>(null);
  const [knowledgeOpen, setKnowledgeOpen] = useState(false);

  useEffect(() => {
    if (data?.top_steps?.[0]?.traj_index !== undefined && data.top_steps[0].traj_index !== null) {
      setExpandedTraj(data.top_steps[0].traj_index);
    }
  }, [data]);

  if (loading) {
    return (
      <div className="flex h-full min-h-0 flex-col items-center justify-center gap-3 p-10 text-muted">
        <Loader2 className="h-8 w-8 animate-spin text-accent" />
        <p className="text-sm">AgentDoG XAI 轨迹归因计算中…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full min-h-0 items-center justify-center p-8">
        <p className="flex items-center gap-2 text-sm text-danger">
          <AlertCircle className="h-4 w-4" />
          {error}
        </p>
      </div>
    );
  }

  if (!data?.top_steps?.length) {
    return (
      <div className="flex h-full min-h-0 items-center justify-center p-8 text-center text-sm text-muted">
        当前轨迹未检测到需 XAI 溯源的高影响步骤。
      </div>
    );
  }

  const maxScore = Math.max(...data.top_steps.map((s) => s.llr_score), 0.01);
  const sentenceByTraj = new Map<number, XaiSentenceAttribution>();
  for (const item of data.sentence_attribution ?? []) {
    sentenceByTraj.set(item.traj_index, item);
  }

  const argmaxStep =
    data.argmax_step_index ??
    data.top_steps[0]?.step_index ??
    currentStepIndex + 1;

  return (
    <div className="h-full min-h-0 overflow-y-auto overscroll-contain p-5">
      <XaiKnowledgeTeaser onClick={() => setKnowledgeOpen(true)} />
      <XaiKnowledgeExplainer
        open={knowledgeOpen}
        onClose={() => setKnowledgeOpen(false)}
        exampleStepIndex={argmaxStep}
      />
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--l2)]/10 px-2.5 py-1 text-[10px] font-medium text-[var(--l2)] ring-1 ring-[var(--l2)]/20">
          <Sparkles className="h-3 w-3" />
          AgentDoG XAI · {data.mode === "mock" ? "演示模式" : data.mode}
        </span>
        {data.argmax_step_index !== undefined && (
          <span className="text-[11px] text-muted">
            Δᵢ 峰值 Step <span className="font-mono text-foreground">{data.argmax_step_index}</span>
            {data.argmax_step_index === currentStepIndex + 1 && " · 含当前 pending 步"}
          </span>
        )}
        {data.fallback_reason && (
          <span className="text-[10px] text-warning">回退 mock：{data.fallback_reason}</span>
        )}
      </div>

      {data.target_preview && (
        <div className="mb-5 rounded-xl border border-border bg-background/40 p-3">
          <p className="mb-1 text-[10px] font-medium uppercase tracking-wider text-muted">
            目标动作 a_target
          </p>
          <p className="font-mono text-xs leading-relaxed text-foreground/90">{data.target_preview}</p>
        </div>
      )}

      <section className="mb-6">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h4 className="text-[11px] font-medium uppercase tracking-wider text-muted">
            轨迹级归因 · Top Steps（按 llr_score / Δᵢ）
          </h4>
          <button
            type="button"
            onClick={() => setKnowledgeOpen(true)}
            className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[10px] text-muted transition-colors hover:border-accent/40 hover:text-accent"
          >
            <HelpCircle className="h-3 w-3" />
            怎么理解这些分数？
          </button>
        </div>
        <div className="space-y-2">
          {data.top_steps.map((item, rank) => {
            const trajIdx = item.traj_index ?? item.step_index - 1;
            const isPending = item.step_index === currentStepIndex + 1;
            const isExpanded = expandedTraj === trajIdx;
            const sentBlock = sentenceByTraj.get(trajIdx);

            return (
              <div
                key={`${item.step_index}-${rank}`}
                className={cn(
                  "rounded-xl border transition-colors",
                  rank === 0
                    ? "border-accent/40 bg-accent/5 ring-1 ring-accent/20"
                    : "border-border bg-card/40"
                )}
              >
                <button
                  type="button"
                  onClick={() => setExpandedTraj(isExpanded ? null : trajIdx)}
                  className="flex w-full items-start gap-3 p-3 text-left"
                >
                  <span
                    className={cn(
                      "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[10px] font-bold",
                      rank === 0 ? "bg-accent text-white" : "bg-muted/20 text-muted"
                    )}
                  >
                    {rank + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs font-semibold">
                        Step {item.step_index}
                      </span>
                      {item.role && (
                        <span className="rounded bg-background px-1.5 py-0.5 text-[10px] text-muted">
                          {item.role}
                        </span>
                      )}
                      {isPending && (
                        <span className="rounded bg-danger/10 px-1.5 py-0.5 text-[10px] text-danger">
                          PRE_TOOL 执行点
                        </span>
                      )}
                      {rank === 0 && (
                        <span className="text-[10px] font-medium text-accent">argmax Δᵢ</span>
                      )}
                    </div>
                    <p className="line-clamp-2 text-[11px] text-muted">{item.preview}</p>
                    <div className="mt-2 flex items-center gap-2">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-border">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-[var(--l2)] to-accent"
                          style={{ width: `${(item.llr_score / maxScore) * 100}%` }}
                        />
                      </div>
                      <span className="font-mono text-[10px] text-muted">
                        {item.llr_score.toFixed(3)}
                      </span>
                    </div>
                  </div>
                </button>

                {isExpanded && sentBlock && (
                  <div className="border-t border-border/60 px-3 pb-3 pt-2">
                    <p className="mb-2 text-[10px] font-medium uppercase tracking-wider text-muted">
                      句子级归因 · Drop + Hold
                    </p>
                    <div className="space-y-2">
                      {[...sentBlock.sentence_analysis]
                        .sort((a, b) => b.scores.total_score - a.scores.total_score)
                        .map((sent, si) => {
                        const isTop = si === 0;
                        return (
                          <div
                            key={sent.sentence_index}
                            className={cn(
                              "rounded-lg border px-3 py-2",
                              isTop
                                ? "border-danger/30 bg-danger/5"
                                : "border-border/60 bg-background/30"
                            )}
                          >
                            <div className="mb-1 flex items-center justify-between gap-2">
                              <span className="font-mono text-[9px] text-muted">
                                sent #{sent.sentence_index}
                              </span>
                              <span className="font-mono text-[10px] text-accent">
                                Φ={sent.scores.total_score.toFixed(3)}
                              </span>
                            </div>
                            <p
                              className={cn(
                                "text-xs leading-relaxed",
                                isTop ? "text-danger/90" : "text-foreground/85"
                              )}
                            >
                              {sent.text}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <p className="text-[10px] leading-relaxed text-muted">
        上方进度条表示该步对「危险动作意愿」的贡献大小；展开后可看句子级 Drop+Hold 对照。
        <button
          type="button"
          onClick={() => setKnowledgeOpen(true)}
          className="ml-1 text-accent underline-offset-2 hover:underline"
        >
          查看知识卡片
        </button>
      </p>
    </div>
  );
}
