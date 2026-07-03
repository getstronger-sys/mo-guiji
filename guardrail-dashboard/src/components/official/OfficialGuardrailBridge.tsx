"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowUpRight,
  ExternalLink,
  GitBranch,
  Layers,
  Radio,
  Shield,
  Sparkles,
} from "lucide-react";
import {
  OFFICIAL_GUARDRAIL_INSPECTIONS_URL,
  OFFICIAL_GUARDRAIL_REPO,
  OFFICIAL_GUARDRAIL_URL,
} from "@/lib/official-guardrail";

type Phase = "idle" | "connecting" | "handoff";

export function OfficialGuardrailBridge() {
  const [phase, setPhase] = useState<Phase>("idle");

  const openOfficial = (path: "" | "/inspections.html" = "") => {
    setPhase("connecting");
    const url = path ? `${OFFICIAL_GUARDRAIL_URL}${path}` : OFFICIAL_GUARDRAIL_URL;

    window.setTimeout(() => {
      setPhase("handoff");
      window.open(url, "_blank", "noopener,noreferrer");
      window.setTimeout(() => setPhase("idle"), 1200);
    }, 1400);
  };

  return (
    <div className="relative flex h-full flex-col overflow-hidden">
      <div className="grid-bg absolute inset-0 opacity-40" />
      <motion.div
        className="pointer-events-none absolute left-1/2 top-1/3 h-72 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--l2)]/10 blur-3xl"
        animate={{ scale: [1, 1.15, 1], opacity: [0.35, 0.55, 0.35] }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
      />

      <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-6 py-10">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-10 text-center"
        >
          <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.2em] text-[var(--l2)]">
            AgentDoG · Application 2
          </p>
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            官方 Online Guardrail
          </h2>
          <p className="mx-auto mt-3 max-w-lg text-sm leading-relaxed text-muted">
            GuardTrace 负责级联增强与可视化；官方面板负责 PRE_REPLY 在线护栏与 OpenClaw
            会话监控。点击下方进入赛方参考实现。
          </p>
        </motion.div>

        <div className="relative mb-12 w-full max-w-2xl">
          <PipelineAnimation active={phase !== "idle"} phase={phase} />

          {phase !== "idle" && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="absolute inset-0 flex items-center justify-center rounded-3xl bg-background/60 backdrop-blur-[2px]"
            >
              <div className="text-center">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1.2, repeat: Infinity, ease: "linear" }}
                  className="mx-auto mb-3 h-10 w-10 rounded-full border-2 border-[var(--l2)] border-t-transparent"
                />
                <p className="text-sm font-medium">
                  {phase === "connecting" ? "正在连接官方护栏服务…" : "已打开官方面板"}
                </p>
                <p className="mt-1 text-xs text-muted">{OFFICIAL_GUARDRAIL_URL}</p>
              </div>
            </motion.div>
          )}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="flex flex-wrap items-center justify-center gap-3"
        >
          <button
            type="button"
            disabled={phase !== "idle"}
            onClick={() => openOfficial()}
            className="group flex items-center gap-2 rounded-xl bg-gradient-to-r from-[var(--l2)] to-accent px-6 py-3 text-sm font-medium text-white shadow-lg shadow-accent/20 transition-all hover:shadow-accent/30 disabled:opacity-60"
          >
            <Sparkles className="h-4 w-4" />
            进入官方监控面板
            <ArrowUpRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </button>

          <button
            type="button"
            disabled={phase !== "idle"}
            onClick={() => openOfficial("/inspections.html")}
            className="flex items-center gap-2 rounded-xl border border-border bg-card px-5 py-3 text-sm font-medium transition-colors hover:bg-card-hover disabled:opacity-60"
          >
            <ExternalLink className="h-4 w-4" />
            检查 / 审计页
          </button>

          <a
            href={OFFICIAL_GUARDRAIL_REPO}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 rounded-xl border border-border/60 px-5 py-3 text-sm text-muted transition-colors hover:text-foreground"
          >
            <GitBranch className="h-4 w-4" />
            GitHub 源码
          </a>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="mt-10 grid max-w-2xl gap-3 text-center sm:grid-cols-3"
        >
          {[
            { title: "GuardTrace", desc: "L1/L2/L3 级联 · 轨迹可视化" },
            { title: "官方 Guardrail", desc: "PRE_REPLY · OpenClaw 接入" },
            { title: "分工", desc: "增强展示 + 官方底座跳转" },
          ].map((item) => (
            <div
              key={item.title}
              className="rounded-xl border border-border/80 bg-card/60 px-4 py-3 backdrop-blur-sm"
            >
              <p className="text-xs font-semibold">{item.title}</p>
              <p className="mt-1 text-[11px] text-muted">{item.desc}</p>
            </div>
          ))}
        </motion.div>
      </div>
    </div>
  );
}

function PipelineAnimation({
  active,
  phase,
}: {
  active: boolean;
  phase: Phase;
}) {
  const nodes = [
    { icon: Layers, label: "GuardTrace", sub: "级联 & 诊断", color: "var(--accent)" },
    { icon: Radio, label: "Bridge", sub: "官方接口", color: "var(--l2)" },
    { icon: Shield, label: "AgentDoG", sub: "Online Guardrail", color: "var(--safe)" },
  ];

  return (
    <div className="rounded-3xl border border-border bg-card/70 p-8 backdrop-blur-md">
      <div className="flex items-center justify-between gap-4">
        {nodes.map((node, i) => {
          const Icon = node.icon;
          const lit = active && (phase === "handoff" ? i <= 2 : i <= 1);
          return (
            <div key={node.label} className="relative flex flex-1 flex-col items-center">
              {i < nodes.length - 1 && (
                <div className="absolute left-[calc(50%+28px)] top-7 h-0.5 w-[calc(100%-56px)] overflow-hidden bg-border">
                  <motion.div
                    className="h-full bg-gradient-to-r from-[var(--l2)] to-[var(--safe)]"
                    initial={{ width: "0%" }}
                    animate={{ width: lit ? "100%" : "0%" }}
                    transition={{ duration: 0.8, delay: i * 0.2 }}
                  />
                  {active && (
                    <motion.span
                      className="absolute top-1/2 h-2 w-2 -translate-y-1/2 rounded-full bg-[var(--l2)] shadow-[0_0_12px_var(--l2)]"
                      initial={{ left: "0%" }}
                      animate={{ left: ["0%", "100%"] }}
                      transition={{
                        duration: 1.2,
                        repeat: Infinity,
                        ease: "easeInOut",
                        delay: i * 0.15,
                      }}
                    />
                  )}
                </div>
              )}
              <motion.div
                animate={
                  lit
                    ? { scale: [1, 1.06, 1], boxShadow: "0 0 24px color-mix(in srgb, var(--l2) 35%, transparent)" }
                    : { scale: 1 }
                }
                transition={{ duration: 0.5 }}
                className="flex h-14 w-14 items-center justify-center rounded-2xl border border-border bg-background ring-1 ring-border"
                style={{ color: node.color }}
              >
                <Icon className="h-6 w-6" />
              </motion.div>
              <p className="mt-3 text-xs font-semibold">{node.label}</p>
              <p className="text-[10px] text-muted">{node.sub}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
