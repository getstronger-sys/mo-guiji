"use client";

import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  GitBranch,
  Pause,
  Play,
  Radio,
  RotateCcw,
  SkipForward,
  Sparkles,
} from "lucide-react";
import { checkGuardrail } from "@/lib/api";
import { cumulativeForSteps } from "@/lib/risk-scoring";
import { GUARDTRACE_REPO } from "@/lib/project";
import type { Trajectory, TrajectoryStep } from "@/lib/types";
import { CascadePanel } from "../guardrail/CascadePanel";
import {
  CascadePipeline,
  type CascadePhase,
} from "../guardrail/CascadePipeline";
import { DiagnosisPanel } from "../diagnosis/DiagnosisPanel";
import { StepCard } from "../trajectory/StepCard";

interface LiveDemoPlayerProps {
  trajectory: Trajectory;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function LiveDemoPlayer({ trajectory }: LiveDemoPlayerProps) {
  const [runtimeSteps, setRuntimeSteps] = useState<TrajectoryStep[]>([]);
  const [currentStep, setCurrentStep] = useState(-1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [selectedStep, setSelectedStep] = useState<number | null>(null);
  const [showBlockOverlay, setShowBlockOverlay] = useState(false);
  const [diagnosisOpen, setDiagnosisOpen] = useState(false);
  const [diagnosisTab, setDiagnosisTab] = useState<"summary" | "taxonomy" | "xai">("summary");

  const [checkPhase, setCheckPhase] = useState<CascadePhase>("idle");
  const [isChecking, setIsChecking] = useState(false);
  const [apiOnline, setApiOnline] = useState<boolean | null>(null);

  const totalSteps = trajectory.steps?.length ?? 0;
  const isComplete = totalSteps > 0 && currentStep >= totalSteps - 1;
  const activeStep =
    selectedStep !== null
      ? (runtimeSteps.find((s) => s.index === selectedStep) ?? null)
      : null;
  const lastOutcome = activeStep?.guardrail.finalDecision;
  const blockedAt = activeStep?.guardrail.blockedAt;

  useEffect(() => {
    fetch("/api/trajectories")
      .then((r) => setApiOnline(r.ok))
      .catch(() => setApiOnline(false));
  }, []);

  const reset = useCallback(() => {
    setRuntimeSteps([]);
    setCurrentStep(-1);
    setIsPlaying(false);
    setShowBlockOverlay(false);
    setDiagnosisOpen(false);
    setSelectedStep(null);
    setCheckPhase("idle");
    setIsChecking(false);
  }, []);

  const openDiagnosis = (tab: "summary" | "taxonomy" | "xai" = "summary") => {
    setDiagnosisTab(tab);
    setDiagnosisOpen(true);
    setShowBlockOverlay(false);
  };

  const runGuardrailForStep = useCallback(
    async (stepIndex: number): Promise<TrajectoryStep> => {
      const template = trajectory.steps?.[stepIndex];
      if (!template) {
        throw new Error(`Missing step template at index ${stepIndex}`);
      }
      const accumulated = trajectory.steps.slice(0, stepIndex + 1);

      setIsChecking(true);
      setCheckPhase("l1");
      await sleep(280 / speed);

      setCheckPhase("l2");
      const apiPromise = checkGuardrail({
        trajectoryId: trajectory.id,
        stepIndex,
        accumulatedSteps: accumulated,
      });

      await sleep(420 / speed);
      setCheckPhase("l3");

      let response;
      try {
        response = await apiPromise;
        if (!response?.guardrail?.l1) {
          throw new Error("Invalid guardrail response");
        }
      } catch {
        const risk = cumulativeForSteps(accumulated, template.guardrail);
        response = {
          stepIndex,
          guardrail: template.guardrail,
          status: template.status,
          ...risk,
        };
      }

      await sleep(260 / speed);
      setCheckPhase("done");
      setIsChecking(false);

      return {
        ...template,
        guardrail: response.guardrail,
        status: response.status,
        cumulativeRisk: response.cumulativeRisk,
        stepUnsafeProbability: response.stepUnsafeProbability,
      };
    },
    [trajectory, speed]
  );

  const advance = useCallback(async () => {
    if (isChecking) return;
    const next = currentStep + 1;
    if (next >= totalSteps) {
      setIsPlaying(false);
      return;
    }

    const resolved = await runGuardrailForStep(next);
    setRuntimeSteps((prev) => [...prev, resolved]);
    setCurrentStep(next);
    setSelectedStep(next);

    if (resolved.status === "blocked") {
      setShowBlockOverlay(true);
      setIsPlaying(false);
    }

    await sleep(400 / speed);
    if (next < totalSteps - 1) setCheckPhase("idle");
  }, [currentStep, isChecking, runGuardrailForStep, speed, totalSteps]);

  useEffect(() => {
    if (!isPlaying || isChecking) return;
    const timer = setTimeout(() => {
      void advance();
    }, 1200 / speed);
    return () => clearTimeout(timer);
  }, [isPlaying, isChecking, advance, speed, currentStep]);

  const hasStarted = currentStep >= 0;

  if (totalSteps === 0) {
    return (
      <div className="flex h-full items-center justify-center p-8 text-center text-sm text-muted">
        轨迹数据未加载，请确认后端 /api/trajectories/:id 可访问。
      </div>
    );
  }

  return (
    <div className="relative flex h-full flex-col overflow-hidden">
      <div className="grid-bg pointer-events-none absolute inset-0 opacity-30" />
      <motion.div
        className="pointer-events-none absolute -left-20 top-0 h-64 w-64 rounded-full bg-[var(--l1)]/10 blur-3xl"
        animate={{ opacity: [0.3, 0.5, 0.3] }}
        transition={{ duration: 5, repeat: Infinity }}
      />
      <motion.div
        className="pointer-events-none absolute -right-20 bottom-0 h-64 w-64 rounded-full bg-[var(--l2)]/10 blur-3xl"
        animate={{ opacity: [0.25, 0.45, 0.25] }}
        transition={{ duration: 4.5, repeat: Infinity }}
      />

      <div className="relative z-10 flex items-center justify-between border-b border-border bg-card/60 px-5 py-3 backdrop-blur-sm">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold">实时级联护栏</h2>
            {apiOnline === true && (
              <span className="flex items-center gap-1 rounded-full bg-safe/10 px-2 py-0.5 text-[10px] text-safe ring-1 ring-safe/20">
                <Radio className="h-3 w-3" />
                API 在线
              </span>
            )}
            {apiOnline === false && (
              <span className="rounded-full bg-warning/10 px-2 py-0.5 text-[10px] text-warning ring-1 ring-warning/20">
                离线 · 回退样例
              </span>
            )}
          </div>
          <p className="text-[11px] text-muted">PRE_TOOL · 每步调用 L1 → AgentDoG → L3</p>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={speed}
            onChange={(e) => setSpeed(Number(e.target.value))}
            className="h-8 rounded-lg border border-border bg-background px-2 text-xs"
          >
            <option value={0.5}>0.5x</option>
            <option value={1}>1x</option>
            <option value={2}>2x</option>
            <option value={4}>4x</option>
          </select>
          <button
            onClick={reset}
            className="flex h-8 items-center gap-1.5 rounded-lg border border-border px-3 text-xs hover:bg-card-hover"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            重置
          </button>
          <button
            onClick={() => {
              if (isComplete) reset();
              else setIsPlaying(!isPlaying);
            }}
            disabled={isChecking}
            className="flex h-8 items-center gap-1.5 rounded-lg bg-gradient-to-r from-accent to-[var(--l2)] px-4 text-xs font-medium text-white shadow-md shadow-accent/20 hover:opacity-95 disabled:opacity-50"
          >
            {isPlaying ? (
              <>
                <Pause className="h-3.5 w-3.5" /> 暂停
              </>
            ) : (
              <>
                <Play className="h-3.5 w-3.5" /> {isComplete ? "重播" : "播放"}
              </>
            )}
          </button>
          <button
            onClick={() => void advance()}
            disabled={isComplete || isPlaying || isChecking}
            className="flex h-8 items-center gap-1.5 rounded-lg border border-border px-3 text-xs hover:bg-card-hover disabled:opacity-40"
          >
            <SkipForward className="h-3.5 w-3.5" />
            单步
          </button>
        </div>
      </div>

      {!hasStarted ? (
        <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-6 py-8">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8 max-w-lg text-center"
          >
            <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.2em] text-accent">
              GuardTrace · Live Runtime
            </p>
            <h3 className="text-2xl font-semibold tracking-tight">实时护栏运行台</h3>
            <p className="mt-3 text-sm leading-relaxed text-muted">
              Agent 每生成一步 tool 调用，级联护栏在{" "}
              <span className="font-medium text-foreground">执行前</span>{" "}
              依次经过 L1 规则、AgentDoG XAI 判决与 L3 精确定位。
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 }}
            className="mb-8 w-full max-w-2xl"
          >
            <CascadePipeline phase="idle" />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="flex flex-col items-center gap-3"
          >
            <button
              type="button"
              onClick={() => setIsPlaying(true)}
              className="group flex items-center gap-2 rounded-xl bg-gradient-to-r from-[var(--l2)] to-accent px-8 py-3.5 text-sm font-medium text-white shadow-lg shadow-accent/25"
            >
              <Sparkles className="h-4 w-4" />
              开始实时监控演示
            </button>
            <a
              href={GUARDTRACE_REPO}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 rounded-lg border border-border/60 px-4 py-2 text-xs text-muted transition-colors hover:border-border hover:text-foreground"
            >
              <GitBranch className="h-3.5 w-3.5" />
              GitHub · 摸轨迹不摸鱼
            </a>
          </motion.div>
          <p className="mt-3 text-[11px] text-muted">{trajectory.name}</p>
        </div>
      ) : (
        <>
          <div className="relative z-10 border-b border-border bg-card/40 px-5 py-4 backdrop-blur-sm">
            <CascadePipeline
              compact
              phase={checkPhase}
              outcome={
                checkPhase === "done"
                  ? lastOutcome === "block"
                    ? "block"
                    : "allow"
                  : isChecking
                    ? "pending"
                    : "pending"
              }
              blockedAt={blockedAt}
            />
          </div>

          <div className="relative z-10 flex flex-1 overflow-hidden">
            <div className="flex-1 overflow-y-auto p-5">
              <AnimatePresence mode="popLayout">
                {runtimeSteps.map((step, i) => (
                  <motion.div
                    key={step.index}
                    initial={{ opacity: 0, y: 20, filter: "blur(4px)" }}
                    animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                    transition={{ duration: 0.45 }}
                  >
                    <StepCard
                      step={step}
                      isSelected={selectedStep === step.index}
                      isActive={currentStep === step.index && (isPlaying || isChecking)}
                      onClick={() => setSelectedStep(step.index)}
                      isLast={i === runtimeSteps.length - 1}
                    />
                  </motion.div>
                ))}
              </AnimatePresence>

              {isChecking && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="mt-3 flex items-center gap-3 rounded-xl border border-accent/20 bg-accent/5 px-4 py-3"
                >
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                    className="h-5 w-5 rounded-full border-2 border-accent border-t-transparent"
                  />
                  <div>
                    <p className="text-xs font-medium text-accent">护栏审查中…</p>
                    <p className="text-[10px] text-muted">
                      {checkPhase === "l1" && "L1 规则扫描 pending tool"}
                      {checkPhase === "l2" && "L2 AgentDoG 轨迹 XAI 归因"}
                      {checkPhase === "l3" && "L3 精确定位风险片段"}
                      {checkPhase === "done" && "生成最终决策"}
                    </p>
                  </div>
                </motion.div>
              )}
            </div>

            <div className="flex w-[var(--detail-width)] shrink-0 flex-col border-l border-border bg-card/40 backdrop-blur-sm">
              <div className="min-h-0 flex-1 overflow-hidden">
                <CascadePanel step={activeStep} />
              </div>
              {activeStep && (
                <div className="shrink-0 border-t border-border bg-card/80 p-3 backdrop-blur-sm">
                  <DiagnosisPanel
                    step={activeStep}
                    accumulatedSteps={runtimeSteps}
                    agentSetting={trajectory.agentSetting ?? "general"}
                    layout="footer"
                    modalOpen={diagnosisOpen}
                    onModalOpenChange={setDiagnosisOpen}
                    initialModalTab={diagnosisTab}
                    onModalTabChange={setDiagnosisTab}
                  />
                </div>
              )}
            </div>

            <AnimatePresence>
              {showBlockOverlay && activeStep?.status === "blocked" && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="overlay-backdrop absolute inset-0 z-20 flex items-center justify-center backdrop-blur-sm"
                  onClick={() => setShowBlockOverlay(false)}
                >
                  <motion.div
                    initial={{ scale: 0.92, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="mx-4 max-w-md rounded-2xl border border-danger/30 bg-card p-8 text-center glow-danger"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <motion.div
                      animate={{ scale: [1, 1.05, 1] }}
                      transition={{ duration: 1.5, repeat: Infinity }}
                      className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-danger/10"
                    >
                      <span className="text-3xl">⛔</span>
                    </motion.div>
                    <h3 className="mb-1 text-xl font-bold text-danger">Tool 执行已拦截</h3>
                    <p className="mb-1 text-xs text-muted">
                      {activeStep.guardrail.blockedAt?.toUpperCase()} 层 · PRE_TOOL
                    </p>
                    <p className="mb-4 text-sm text-muted">
                      {activeStep.guardrail.l2?.reason ??
                        activeStep.guardrail.l1.message ??
                        activeStep.guardrail.l3?.reason ??
                        "检测到安全风险"}
                    </p>
                    <button
                      type="button"
                      onClick={() => openDiagnosis("summary")}
                      className="rounded-lg bg-danger/10 px-6 py-2 text-sm font-medium text-danger ring-1 ring-danger/20 hover:bg-danger/20"
                    >
                      查看诊断详情
                    </button>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </>
      )}

      <div className="relative z-10 border-t border-border bg-card/50 px-5 py-2 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-border">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-[var(--l1)] via-[var(--l2)] to-accent"
              initial={{ width: 0 }}
              animate={{
                width: `${(Math.max(0, currentStep + 1) / totalSteps) * 100}%`,
              }}
              transition={{ duration: 0.5 }}
            />
          </div>
          <span className="font-mono text-[10px] text-muted">
            {Math.max(0, currentStep + 1)} / {totalSteps}
          </span>
        </div>
      </div>
    </div>
  );
}
