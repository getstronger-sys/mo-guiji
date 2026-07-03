"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Activity, Clock, Shield, Target, TrendingUp, Zap } from "lucide-react";
import { useTheme } from "@/components/theme/ThemeProvider";
import type { MetricsSummary } from "@/lib/types";
import { chartColors } from "@/lib/theme";
import { formatLatency, formatTokens } from "@/lib/utils";

interface MetricsDashboardProps {
  metrics: MetricsSummary;
}

export function MetricsDashboard({ metrics }: MetricsDashboardProps) {
  const { resolvedTheme } = useTheme();
  const colors = chartColors[resolvedTheme];

  return (
    <div className="h-full overflow-y-auto p-5">
      <div className="mb-6">
        <h2 className="text-lg font-semibold">红队评测面板</h2>
        <p className="text-sm text-muted">拦截率 · 误拦率 · 延迟 · Token 成本</p>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4 xl:grid-cols-6">
        <MetricCard
          icon={Shield}
          label="拦截率"
          value={`${(metrics.interceptionRate * 100).toFixed(1)}%`}
          sub={`${metrics.blockedCount} / ${metrics.totalChecks}`}
          accent="safe"
        />
        <MetricCard
          icon={Target}
          label="精确率"
          value={`${(metrics.precision * 100).toFixed(1)}%`}
          sub="Precision"
          accent="accent"
        />
        <MetricCard
          icon={TrendingUp}
          label="召回率"
          value={`${(metrics.recall * 100).toFixed(1)}%`}
          sub="Recall"
          accent="accent"
        />
        <MetricCard
          icon={Activity}
          label="误拦率"
          value={`${(metrics.falsePositiveRate * 100).toFixed(1)}%`}
          sub="False Positive"
          accent="warning"
        />
        <MetricCard
          icon={Clock}
          label="P50 延迟"
          value={formatLatency(metrics.latencyP50)}
          sub={`P99 ${formatLatency(metrics.latencyP99)}`}
          accent="muted"
        />
        <MetricCard
          icon={Zap}
          label="平均 Token"
          value={formatTokens(metrics.avgTokensPerCheck)}
          sub="per check"
          accent="muted"
        />
      </div>

      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <ChartCard title="攻击类型分布" subtitle="按类型统计拦截效果">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={metrics.attackTypeBreakdown} layout="vertical" margin={{ left: 8, right: 16 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 10, fill: colors.muted }} />
              <YAxis
                type="category"
                dataKey="type"
                width={140}
                tick={{ fontSize: 9, fill: colors.muted }}
              />
              <Tooltip content={<CustomTooltip foreground={colors.foreground} />} />
              <Bar dataKey="count" name="总数" radius={[0, 4, 4, 0]}>
                {metrics.attackTypeBreakdown.map((_, i) => (
                  <Cell key={i} fill={colors.barBg} />
                ))}
              </Bar>
              <Bar dataKey="blocked" name="已拦截" radius={[0, 4, 4, 0]} fill={colors.safe} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="实时延迟 & 拦截" subtitle="过去 35 分钟">
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={metrics.timeline} margin={{ left: 0, right: 8 }}>
              <defs>
                <linearGradient id="latencyGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={colors.accent} stopOpacity={0.3} />
                  <stop offset="100%" stopColor={colors.accent} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} />
              <XAxis dataKey="time" tick={{ fontSize: 10, fill: colors.muted }} />
              <YAxis tick={{ fontSize: 10, fill: colors.muted }} />
              <Tooltip content={<CustomTooltip foreground={colors.foreground} />} />
              <Area
                type="monotone"
                dataKey="latency"
                name="延迟 (ms)"
                stroke={colors.accent}
                fill="url(#latencyGrad)"
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <ChartCard title="级联护栏层级统计" subtitle="各层拦截贡献与成本">
        <div className="grid gap-3 md:grid-cols-3">
          {metrics.layerStats.map((layer) => {
            const blockRate = layer.blocks / layer.checks;
            const colors = { L1: "var(--l1)", L2: "var(--l2)", L3: "var(--l3)" };
            return (
              <div
                key={layer.layer}
                className="rounded-xl border border-border bg-card p-4"
              >
                <div className="mb-3 flex items-center justify-between">
                  <span
                    className="font-mono text-sm font-bold"
                    style={{ color: colors[layer.layer] }}
                  >
                    {layer.layer}
                  </span>
                  <span className="text-[10px] text-muted">
                    {(blockRate * 100).toFixed(1)}% 拦截
                  </span>
                </div>
                <div className="space-y-2 text-[11px]">
                  <div className="flex justify-between">
                    <span className="text-muted">检查次数</span>
                    <span>{layer.checks}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted">拦截次数</span>
                    <span className="text-safe">{layer.blocks}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted">平均延迟</span>
                    <span>{formatLatency(layer.avgLatencyMs)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted">平均 Token</span>
                    <span>{formatTokens(layer.avgTokens)}</span>
                  </div>
                </div>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-border">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${blockRate * 100}%`,
                      backgroundColor: colors[layer.layer],
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </ChartCard>
    </div>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  sub,
  accent,
}: {
  icon: typeof Shield;
  label: string;
  value: string;
  sub: string;
  accent: "safe" | "warning" | "accent" | "muted";
}) {
  const accentMap = {
    safe: "text-safe",
    warning: "text-warning",
    accent: "text-accent",
    muted: "text-foreground",
  };

  return (
    <div className="glass-panel rounded-xl p-4">
      <div className="mb-2 flex items-center gap-2">
        <Icon className={`h-3.5 w-3.5 ${accentMap[accent]}`} />
        <span className="text-[10px] font-medium uppercase tracking-wider text-muted">{label}</span>
      </div>
      <p className={`text-xl font-bold ${accentMap[accent]}`}>{value}</p>
      <p className="text-[10px] text-muted">{sub}</p>
    </div>
  );
}

function ChartCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="glass-panel rounded-xl p-4">
      <div className="mb-4">
        <h3 className="text-sm font-semibold">{title}</h3>
        <p className="text-[11px] text-muted">{subtitle}</p>
      </div>
      {children}
    </div>
  );
}

function CustomTooltip({
  active,
  payload,
  label,
  foreground = "#e8ecf4",
}: {
  active?: boolean;
  payload?: { name: string; value: number; color: string }[];
  label?: string;
  foreground?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 text-xs shadow-xl">
      <p className="mb-1 font-medium">{label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color || foreground }}>
          {p.name}: {p.value}
        </p>
      ))}
    </div>
  );
}
