import { mockMetrics, mockTrajectory, mockTrajectories } from "./mock-data";
import { enrichStepsWithRisk, cumulativeForSteps } from "./risk-scoring";
import type {
  GuardrailCheckRequest,
  GuardrailCheckResponse,
  MetricsSummary,
  Trajectory,
  XaiAttributeRequest,
  XaiAttributionResult,
} from "./types";

/** 默认走后端级联 API；仅当 NEXT_PUBLIC_USE_MOCK=true 时用前端 mock */
const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK === "true";

export async function fetchTrajectories(): Promise<Trajectory[]> {
  if (USE_MOCK) {
    await delay(200);
    return mockTrajectories;
  }
  const res = await fetch("/api/trajectories");
  if (!res.ok) throw new Error("Failed to fetch trajectories");
  const list = (await res.json()) as Trajectory[];
  const full = await Promise.all(
    list.map(async (item) => {
      try {
        return await fetchTrajectory(item.id);
      } catch {
        return item;
      }
    })
  );
  return full.filter((t) => Array.isArray(t.steps) && t.steps.length > 0);
}

export async function fetchTrajectory(id: string): Promise<Trajectory> {
  if (USE_MOCK) {
    await delay(150);
    const found = mockTrajectories.find((t) => t.id === id);
    const traj = found ?? mockTrajectory;
    return { ...traj, steps: enrichStepsWithRisk(traj.steps) };
  }
  const res = await fetch(`/api/trajectories/${id}`);
  if (!res.ok) throw new Error("Failed to fetch trajectory");
  const data = (await res.json()) as Trajectory;
  return { ...data, steps: enrichStepsWithRisk(data.steps) };
}

export async function fetchMetrics(): Promise<MetricsSummary> {
  if (USE_MOCK) {
    await delay(100);
    return mockMetrics;
  }
  const res = await fetch("/api/metrics");
  if (!res.ok) throw new Error("Failed to fetch metrics");
  return res.json();
}

export async function checkGuardrail(req: GuardrailCheckRequest): Promise<GuardrailCheckResponse> {
  if (USE_MOCK) {
    await delay(80);
    const step = req.accumulatedSteps[req.stepIndex];
    const risk = cumulativeForSteps(
      req.accumulatedSteps.slice(0, req.stepIndex + 1),
      step?.guardrail
    );
    return {
      stepIndex: req.stepIndex,
      guardrail: step.guardrail,
      status: step.status,
      ...risk,
    };
  }
  const res = await fetch("/api/guardrail/check", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });
  if (!res.ok) throw new Error("Guardrail check failed");
  const data = await res.json();
  if (!data?.guardrail?.l1) {
    const step = req.accumulatedSteps[req.stepIndex];
    if (step) {
      const risk = cumulativeForSteps(
        req.accumulatedSteps.slice(0, req.stepIndex + 1),
        step.guardrail
      );
      return {
        stepIndex: req.stepIndex,
        guardrail: step.guardrail,
        status: step.status,
        ...risk,
      };
    }
  }
  return data;
}

export async function fetchXaiAttribution(
  req: XaiAttributeRequest
): Promise<XaiAttributionResult | null> {
  if (!req.accumulatedSteps.length) return null;

  if (USE_MOCK) {
    await delay(120);
    const risky = req.accumulatedSteps.some((s) =>
      JSON.stringify(s).toLowerCase().includes("attacker")
    );
    if (!risky) return { mode: "mock", top_steps: [], sentence_attribution: [] };
    return {
      mode: "mock",
      argmax_step_index: Math.max(0, req.stepIndex - 1),
      top_steps: [
        {
          step_index: 3,
          traj_index: 2,
          llr_score: 0.72,
          role: "environment",
          preview: "API_KEY=sk-live-xxx...",
        },
        {
          step_index: req.stepIndex + 1,
          traj_index: req.stepIndex,
          llr_score: 0.68,
          role: "agent",
          preview: "pending tool exfiltration",
        },
      ],
      sentence_attribution: [
        {
          step_index: 3,
          traj_index: 2,
          role: "environment",
          original_content: "API_KEY=sk-live-xxx found in .env",
          sentence_analysis: [
            {
              sentence_index: 0,
              text: "API_KEY=sk-live-xxx found in .env",
              scores: { drop_score: 0.42, hold_score: 0.28, total_score: 0.7 },
            },
          ],
        },
      ],
    };
  }

  try {
    const res = await fetch("/api/xai/attribute", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        stepIndex: req.stepIndex,
        accumulatedSteps: req.accumulatedSteps,
      }),
    });
    if (!res.ok) return null;
    return (await res.json()) as XaiAttributionResult;
  } catch {
    return null;
  }
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
