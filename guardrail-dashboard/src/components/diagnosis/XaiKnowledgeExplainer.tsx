"use client";

import { BookOpen, ChevronRight, Lightbulb, Search, Scissors, Target } from "lucide-react";
import { Modal } from "@/components/shared/Modal";

interface XaiKnowledgeExplainerProps {
  open: boolean;
  onClose: () => void;
  /** 当前面板展示的 argmax step，用于举例 */
  exampleStepIndex?: number;
}

function StoryBlock({
  icon: Icon,
  title,
  children,
  accent,
}: {
  icon: typeof Search;
  title: string;
  children: React.ReactNode;
  accent?: "l2" | "l3" | "accent";
}) {
  const ring =
    accent === "l2"
      ? "border-[var(--l2)]/30 bg-[var(--l2)]/5"
      : accent === "l3"
        ? "border-[var(--l3)]/30 bg-[var(--l3)]/5"
        : "border-accent/30 bg-accent/5";

  return (
    <div className={`rounded-xl border p-4 ${ring}`}>
      <div className="mb-2 flex items-center gap-2">
        <Icon className="h-4 w-4 text-accent" />
        <h3 className="text-sm font-semibold">{title}</h3>
      </div>
      <div className="space-y-2 text-sm leading-relaxed text-foreground/90">{children}</div>
    </div>
  );
}

function MiniTimeline() {
  const steps = [
    { n: 1, label: "列目录", hot: false },
    { n: 2, label: "读配置", hot: false },
    { n: "…", label: "", hot: false },
    { n: 8, label: "环境变量里出现密钥", hot: true },
    { n: 9, label: "准备外传", hot: false },
  ];
  const hasHot = steps.some((s) => s.hot);

  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-background/50 p-3">
      <p className="mb-2 text-[10px] font-medium uppercase tracking-wider text-muted">
        类比：回放 Agent 执行录像，找「态度突然变危险」的那一帧
      </p>
      <div className="flex min-w-max items-end gap-1">
        {steps.map((s, i) => (
          <div key={i} className="flex flex-col items-center gap-1">
            <div
              className={
                s.hot
                  ? "flex h-12 w-14 flex-col items-center justify-center rounded-lg border-2 border-danger bg-danger/15 text-danger shadow-[0_0_12px_var(--danger-glow)]"
                  : "flex h-10 w-12 items-center justify-center rounded-lg border border-border bg-card/60 text-[10px] text-muted"
              }
            >
              {typeof s.n === "number" ? `Step ${s.n}` : s.n}
            </div>
            {s.label && (
              <span
                className={`max-w-[4.5rem] text-center text-[9px] leading-tight ${s.hot ? "font-medium text-danger" : "text-muted"}`}
              >
                {s.label}
              </span>
            )}
          </div>
        ))}
      </div>
      {hasHot && (
        <p className="mt-2 text-center text-[10px] text-danger">
          ↑ Δᵢ 最大：从这一步起，模型更坚定要做危险动作
        </p>
      )}
    </div>
  );
}

function DropHoldDemo() {
  return (
    <div className="space-y-2 rounded-lg border border-border bg-background/50 p-3 text-xs">
      <p className="text-[10px] font-medium uppercase tracking-wider text-muted">
        类比：在同一步里，用「划掉 / 只留一句」做对照实验
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        <div className="rounded-lg border border-border/60 bg-card/40 p-2">
          <p className="mb-1 font-mono text-[10px] text-muted">sent #0 · API_KEY=…</p>
          <p className="text-foreground/80">划掉后，模型仍想外传 → 影响中等</p>
          <p className="mt-1 font-mono text-accent">Φ ≈ 0.78</p>
        </div>
        <div className="rounded-lg border border-danger/40 bg-danger/5 p-2 ring-1 ring-danger/20">
          <p className="mb-1 font-mono text-[10px] text-danger">sent #1 · DB_PASSWORD=…</p>
          <p className="text-foreground/80">划掉后，模型明显不想外传 → 影响最大</p>
          <p className="mt-1 font-mono text-danger">Φ ≈ 0.85 · 标红</p>
        </div>
      </div>
    </div>
  );
}

export function XaiKnowledgeExplainer({
  open,
  onClose,
  exampleStepIndex,
}: XaiKnowledgeExplainerProps) {
  const stepLabel =
    exampleStepIndex !== undefined ? `Step ${exampleStepIndex}` : "某一步（如 Step 8）";

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="归因分析 · 知识卡片"
      subtitle="不用懂公式，也能明白「为什么拦在这一步、这一句」"
      size="lg"
    >
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4">
        <div className="mb-5 flex items-start gap-3 rounded-xl border border-accent/25 bg-accent/5 p-4">
          <Lightbulb className="mt-0.5 h-5 w-5 shrink-0 text-accent" />
          <p className="text-sm leading-relaxed text-foreground/90">
            GuardTrace 不是「凭感觉猜」哪一步有问题，而是让 AgentDoG
            像<strong>回放录像的裁判</strong>：先找轨迹里的<strong>转折点</strong>
            ，再在该步里找<strong>最关键的一句话</strong>。你看到的进度条和 Φ
            分数，就是「这一步 / 这一句有多关键」的量化结果。
          </p>
        </div>

        <div className="space-y-4">
          <StoryBlock icon={Search} title="第一步：轨迹级 —— 哪一步是「拐点」？" accent="l2">
            <p>
              想象 Agent 已经走到要执行危险操作（比如外传文件）。我们问模型一个 counterfactual
              问题：
            </p>
            <p className="rounded-md border border-border bg-background/60 px-3 py-2 italic text-muted">
              「如果只看到第 1～i 步的历史，你有多想继续做这件危险的事？」
            </p>
            <p>
              每多看到一步，意愿可能会跳变。<strong>跳变最大的那一步</strong>就是 Δᵢ（llr_score）
              最高的 step —— 面板里标成 <span className="text-accent">argmax Δᵢ</span>
              {exampleStepIndex !== undefined ? (
                <>
                  ，你当前数据里是 <span className="font-mono text-accent">{stepLabel}</span>
                </>
              ) : null}
              。
            </p>
            <MiniTimeline />
            <p className="text-xs text-muted">
              常见情况：前几步只是「读目录、读配置」看起来无害；某一步 observation 里突然出现
              密钥 / 被注入的指令，模型从这里开始认真规划攻击链。
            </p>
          </StoryBlock>

          <StoryBlock icon={Scissors} title="第二步：句子级 —— 这一步里哪一句最要命？" accent="l3">
            <p>
              锁定拐点 step 之后，还要解释「具体是哪段文字带偏了模型」。做法像做对照实验：
            </p>
            <ul className="list-inside list-disc space-y-1 text-foreground/85">
              <li>
                <strong>Drop（划掉）</strong>：去掉某一句，看模型还坚持危险动作吗？
              </li>
              <li>
                <strong>Hold（只留）</strong>：只保留某一句，看模型是否就被带偏？
              </li>
            </ul>
            <p>
              两者加起来是 <span className="font-mono text-accent">Φ = Drop + Hold</span>
              。Φ 越大，说明<strong>删掉或单独看这一句</strong>，对模型决策影响越大 —— 所以
              sent #1（如 DB_PASSWORD）会比 sent #0（API_KEY）更红。
            </p>
            <DropHoldDemo />
          </StoryBlock>

          <StoryBlock icon={Target} title="和 L1 / L2 / L3 护栏的关系" accent="accent">
            <div className="space-y-2 font-mono text-[11px]">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded bg-[var(--l1)]/15 px-2 py-0.5 text-[var(--l1)]">L1</span>
                <span className="text-foreground/80 font-sans text-xs">
                  规则/CodeShield · 快 · 拦显性坏命令
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded bg-[var(--l2)]/15 px-2 py-0.5 text-[var(--l2)]">L2</span>
                <span className="text-foreground/80 font-sans text-xs">
                  AgentDoG · 判整条轨迹 safe/unsafe + 风险类型
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded bg-[var(--l3)]/15 px-2 py-0.5 text-[var(--l3)]">L3</span>
                <span className="text-foreground/80 font-sans text-xs">
                  XAI 归因 · 解释「哪一步、哪一句」· 不给用户看公式也能讲清楚
                </span>
              </div>
            </div>
            <p className="mt-2 text-xs text-muted">
              L2 告诉你「拦对了」；L3 / XAI 告诉你「为什么拦在这里」—— 方便答辩、运维和 red
              team 复盘。
            </p>
          </StoryBlock>
        </div>

        <details className="mt-5 rounded-xl border border-border bg-card/30 px-4 py-3">
          <summary className="cursor-pointer text-xs font-medium text-muted">
            给评委 / 技术同学：公式原文
          </summary>
          <div className="mt-3 space-y-2 font-mono text-[11px] leading-relaxed text-foreground/80">
            <p>轨迹级：Δᵢ = log π(a|𝒯≤i) − log π(a|𝒯≤i−1)</p>
            <p>句子级：Φ = Drop + Hold</p>
            <p className="font-sans text-[10px] text-muted">
              来源：AgentDoG Agentic XAI（AI45Lab）
            </p>
          </div>
        </details>
      </div>
    </Modal>
  );
}

/** 面板顶部可点击的知识卡片入口 */
export function XaiKnowledgeTeaser({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group mb-4 flex w-full items-center gap-3 rounded-xl border border-dashed border-accent/35 bg-accent/5 px-4 py-3 text-left transition-colors hover:border-accent/55 hover:bg-accent/10"
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent/15 text-accent">
        <BookOpen className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground">这是怎么找到这一步的？</p>
        <p className="text-xs text-muted">
          点击看中「录像回放找拐点 + 划掉句子做对照」的通俗解释
        </p>
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-accent" />
    </button>
  );
}
