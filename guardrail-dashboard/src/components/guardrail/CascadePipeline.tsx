"use client";

import { motion } from "framer-motion";
import { Ban, CheckCircle2, Layers, ShieldAlert, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

export type CascadePhase = "idle" | "l1" | "l2" | "l3" | "done";
export type CascadeOutcome = "pending" | "allow" | "block";

interface CascadePipelineProps {
  phase: CascadePhase;
  outcome?: CascadeOutcome;
  blockedAt?: "l1" | "l2" | "l3";
  compact?: boolean;
  className?: string;
}

const NODES = [
  {
    id: "l1" as const,
    icon: Zap,
    label: "L1 轻量规则",
    sub: "PRE_TOOL · 0 Token",
    color: "var(--l1)",
  },
  {
    id: "l2" as const,
    icon: Layers,
    label: "L2 AgentDoG",
    sub: "轨迹 XAI 归因",
    color: "var(--l2)",
  },
  {
    id: "l3" as const,
    icon: ShieldAlert,
    label: "L3 精定位",
    sub: "Step / 代码级",
    color: "var(--l3)",
  },
];

function phaseIndex(phase: CascadePhase): number {
  if (phase === "idle") return -1;
  if (phase === "l1") return 0;
  if (phase === "l2") return 1;
  if (phase === "l3") return 2;
  return 3;
}

export function CascadePipeline({
  phase,
  outcome = "pending",
  blockedAt,
  compact = false,
  className,
}: CascadePipelineProps) {
  const activeIdx = phaseIndex(phase);

  return (
    <div
      className={cn(
        "rounded-3xl border border-border bg-card/70 backdrop-blur-md",
        compact ? "p-4" : "p-6 sm:p-8",
        className
      )}
    >
      <div className="flex items-center justify-between gap-2 sm:gap-4">
        {NODES.map((node, i) => {
          const Icon = node.icon;
          const isRunning = activeIdx === i && phase !== "done";
          const isDone = activeIdx > i || phase === "done";
          const isBlockedHere = outcome === "block" && blockedAt === node.id;
          const lit = isRunning || isDone;

          return (
            <div key={node.id} className="relative flex flex-1 flex-col items-center">
              {i < NODES.length - 1 && (
                <div className="absolute left-[calc(50%+24px)] top-6 h-0.5 w-[calc(100%-48px)] overflow-hidden bg-border sm:left-[calc(50%+28px)] sm:top-7 sm:w-[calc(100%-56px)]">
                  <motion.div
                    className="h-full bg-gradient-to-r from-[var(--l1)] via-[var(--l2)] to-[var(--l3)]"
                    initial={{ width: "0%" }}
                    animate={{ width: lit ? "100%" : "0%" }}
                    transition={{ duration: 0.55, delay: i * 0.08 }}
                  />
                  {isRunning && (
                    <motion.span
                      className="absolute top-1/2 h-2 w-2 -translate-y-1/2 rounded-full shadow-[0_0_10px_currentColor]"
                      style={{ color: node.color }}
                      animate={{ left: ["0%", "100%"] }}
                      transition={{
                        duration: 0.9,
                        repeat: Infinity,
                        ease: "easeInOut",
                      }}
                    />
                  )}
                </div>
              )}

              <motion.div
                animate={
                  isRunning
                    ? {
                        scale: [1, 1.08, 1],
                        boxShadow: `0 0 28px color-mix(in srgb, ${node.color} 40%, transparent)`,
                      }
                    : isBlockedHere
                      ? {
                          boxShadow: "0 0 24px color-mix(in srgb, var(--danger) 35%, transparent)",
                        }
                      : { scale: 1 }
                }
                transition={{ duration: 0.45, repeat: isRunning ? Infinity : 0, repeatType: "reverse" }}
                className={cn(
                  "flex items-center justify-center rounded-2xl border bg-background ring-1",
                  compact ? "h-11 w-11" : "h-14 w-14",
                  isBlockedHere
                    ? "border-danger/40 ring-danger/30"
                    : isDone && outcome === "allow"
                      ? "border-safe/30 ring-safe/20"
                      : "border-border ring-border"
                )}
                style={{ color: isBlockedHere ? "var(--danger)" : node.color }}
              >
                <Icon className={compact ? "h-5 w-5" : "h-6 w-6"} />
              </motion.div>

              <p className={cn("mt-2 font-semibold", compact ? "text-[10px]" : "text-xs")}>
                {node.label}
              </p>
              <p className="text-[9px] text-muted sm:text-[10px]">{node.sub}</p>

              {isBlockedHere && (
                <motion.span
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-1 rounded-full bg-danger/10 px-2 py-0.5 text-[9px] font-medium text-danger ring-1 ring-danger/20"
                >
                  拦截
                </motion.span>
              )}
            </div>
          );
        })}
      </div>

      {phase === "done" && outcome !== "pending" && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className={cn(
            "mt-4 flex items-center justify-center gap-2 rounded-xl border px-4 py-2 text-center text-xs font-medium",
            outcome === "allow"
              ? "border-safe/25 bg-safe/5 text-safe"
              : "border-danger/25 bg-danger/5 text-danger"
          )}
        >
          {outcome === "allow" ? (
            <>
              <CheckCircle2 className="h-4 w-4" />
              允许执行 · Tool 已放行
            </>
          ) : (
            <>
              <Ban className="h-4 w-4" />
              已拦截 · {blockedAt?.toUpperCase() ?? "GUARD"} 层触发
            </>
          )}
        </motion.div>
      )}
    </div>
  );
}
