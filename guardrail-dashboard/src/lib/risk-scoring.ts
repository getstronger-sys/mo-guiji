import type { GuardrailResult, TrajectoryStep } from "./types";

function l1UnsafeProbability(l1: GuardrailResult["l1"] | undefined): number {
  if (!l1) return 0.02;

  const passed = l1.passed !== false;
  const confidence = l1.confidence;
  const rule = l1.rule ?? "";

  if (!passed) {
    return confidence ?? 0.97;
  }

  if (rule === "sensitive_path_read") {
    const conf = confidence ?? 0.72;
    return Math.min(0.45, Math.max(0.15, (1 - conf) * 0.85 + 0.12));
  }

  const conf = confidence ?? 0.99;
  return Math.max(0.02, (1 - conf) * 0.5);
}

function l2UnsafeProbability(l2: GuardrailResult["l2"] | undefined): number | null {
  if (!l2) return null;

  if (l2.unsafeProbability !== undefined) {
    return l2.unsafeProbability;
  }

  if (l2.passed === false) {
    return l2.confidence ?? 0.88;
  }

  if (l2.confidence !== undefined) {
    return Math.max(0.02, 1 - l2.confidence);
  }

  return 0.05;
}

export function stepUnsafeProbability(guardrail: GuardrailResult): number {
  const p1 = l1UnsafeProbability(guardrail.l1);
  const p2 = l2UnsafeProbability(guardrail.l2);
  if (p2 === null) return p1;
  return 1 - (1 - p1) * (1 - p2);
}

export function updateCumulativeRisk(previous: number, stepP: number): number {
  const prev = Math.max(0, Math.min(1, previous));
  const step = Math.max(0, Math.min(1, stepP));
  return 1 - (1 - prev) * (1 - step);
}

export function enrichStepsWithRisk(steps: TrajectoryStep[]): TrajectoryStep[] {
  let cumulative = 0;
  return steps.map((step) => {
    const stepP = stepUnsafeProbability(step.guardrail);
    cumulative = updateCumulativeRisk(cumulative, stepP);
    return {
      ...step,
      stepUnsafeProbability: Math.round(stepP * 10000) / 10000,
      cumulativeRisk: Math.round(cumulative * 10000) / 10000,
    };
  });
}

export function cumulativeForSteps(
  steps: TrajectoryStep[],
  finalGuardrail?: GuardrailResult
): { stepUnsafeProbability: number; cumulativeRisk: number } {
  let cumulative = 0;
  let lastStepP = 0;

  steps.forEach((step, i) => {
    const guardrail =
      finalGuardrail && i === steps.length - 1 ? finalGuardrail : step.guardrail;
    lastStepP = stepUnsafeProbability(guardrail);
    cumulative = updateCumulativeRisk(cumulative, lastStepP);
  });

  return {
    stepUnsafeProbability: Math.round(lastStepP * 10000) / 10000,
    cumulativeRisk: Math.round(cumulative * 10000) / 10000,
  };
}
