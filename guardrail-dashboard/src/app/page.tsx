"use client";

import { useEffect, useState } from "react";
import { fetchMetrics, fetchTrajectories } from "@/lib/api";
import type { MetricsSummary, Trajectory } from "@/lib/types";
import { Header } from "@/components/layout/Header";
import { Sidebar, type NavView } from "@/components/layout/Sidebar";
import { CascadePanel } from "@/components/guardrail/CascadePanel";
import { DiagnosisPanel } from "@/components/diagnosis/DiagnosisPanel";
import { LiveDemoPlayer } from "@/components/demo/LiveDemoPlayer";
import { OfficialGuardrailBridge } from "@/components/official/OfficialGuardrailBridge";
import { MetricsDashboard } from "@/components/metrics/MetricsDashboard";
import {
  TrajectoryList,
  TrajectoryTimeline,
} from "@/components/trajectory/TrajectoryTimeline";

export default function Dashboard() {
  const [activeView, setActiveView] = useState<NavView>("trace");
  const [trajectories, setTrajectories] = useState<Trajectory[]>([]);
  const [metrics, setMetrics] = useState<MetricsSummary | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedStep, setSelectedStep] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  const selectedTrajectory = trajectories.find((t) => t.id === selectedId) ?? null;
  const currentStep =
    selectedStep !== null && selectedTrajectory?.steps
      ? (selectedTrajectory.steps[selectedStep] ?? null)
      : null;

  useEffect(() => {
    Promise.all([fetchTrajectories(), fetchMetrics()])
      .then(([trajs, m]) => {
        setTrajectories(trajs);
        setMetrics(m);
        if (trajs.length > 0) {
          setSelectedId(trajs[0].id);
          const blocked = trajs[0].summary?.blockedStep;
          const last = Math.max(0, (trajs[0].steps?.length ?? 1) - 1);
          setSelectedStep(blocked ?? last);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="text-center">
          <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
          <p className="text-sm text-muted">加载 GuardTrace...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar activeView={activeView} onViewChange={setActiveView} />

      <div className="flex min-w-0 flex-1 flex-col">
        <Header
          trajectory={activeView !== "metrics" ? selectedTrajectory ?? undefined : undefined}
          isLive={activeView === "demo"}
        />

        {activeView === "trace" && selectedTrajectory && selectedTrajectory.steps?.length > 0 && (
          <div className="flex flex-1 overflow-hidden">
            <div className="w-56 shrink-0 border-r border-border bg-card/50">
              <p className="border-b border-border px-3 py-2 text-[10px] font-medium uppercase tracking-wider text-muted">
                轨迹列表
              </p>
              <TrajectoryList
                trajectories={trajectories}
                selectedId={selectedId}
                onSelect={(id) => {
                  setSelectedId(id);
                  const t = trajectories.find((tr) => tr.id === id);
                  if (t) {
                    const blocked = t.summary?.blockedStep;
                    setSelectedStep(blocked ?? 0);
                  }
                }}
              />
            </div>

            <div className="flex min-w-0 flex-1 overflow-hidden">
              <div className="min-w-0 flex-1 border-r border-border">
                <TrajectoryTimeline
                  trajectory={selectedTrajectory}
                  selectedStep={selectedStep}
                  onSelectStep={setSelectedStep}
                />
              </div>

              <div className="flex w-[var(--detail-width)] shrink-0 flex-col overflow-hidden">
                <div className="min-h-0 flex-1 overflow-hidden">
                  <CascadePanel step={currentStep} />
                </div>
                {currentStep && (
                  <div className="shrink-0 border-t border-border bg-card/80 p-3">
                    <DiagnosisPanel
                      step={currentStep}
                      accumulatedSteps={selectedTrajectory.steps.slice(0, (selectedStep ?? 0) + 1)}
                      agentSetting={selectedTrajectory.agentSetting ?? "general"}
                      layout="footer"
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeView === "metrics" && metrics && <MetricsDashboard metrics={metrics} />}

        {activeView === "demo" && selectedTrajectory && (selectedTrajectory.steps?.length ?? 0) > 0 && (
          <LiveDemoPlayer trajectory={selectedTrajectory} />
        )}

        {activeView === "official" && <OfficialGuardrailBridge />}
      </div>
    </div>
  );
}
