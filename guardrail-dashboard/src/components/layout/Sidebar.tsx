"use client";

import {
  Activity,
  BarChart3,
  ChevronRight,
  ExternalLink,
  GitBranch,
  Layers,
  Play,
  Route,
  Shield,
  ShieldAlert,
  Zap,
} from "lucide-react";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { GUARDTRACE_REPO } from "@/lib/project";
import { cn } from "@/lib/utils";

export type NavView = "trace" | "metrics" | "demo" | "official";

interface SidebarProps {
  activeView: NavView;
  onViewChange: (view: NavView) => void;
}

const navItems: { id: NavView; label: string; icon: typeof Route; desc: string }[] = [
  { id: "trace", label: "轨迹审查", icon: Route, desc: "Trace Inspector" },
  { id: "metrics", label: "评测面板", icon: BarChart3, desc: "Red Team Metrics" },
  { id: "demo", label: "实时演示", icon: Play, desc: "Live Guardrail" },
  { id: "official", label: "官方护栏", icon: ExternalLink, desc: "AgentDoG Official" },
];

export function Sidebar({ activeView, onViewChange }: SidebarProps) {
  return (
    <aside className="flex h-full w-[var(--sidebar-width)] shrink-0 flex-col border-r border-border bg-card">
      <div className="flex items-center gap-3 border-b border-border px-5 py-4">
        <div className="relative flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-accent/20 to-l2/20 ring-1 ring-accent/30">
          <Shield className="h-5 w-5 text-accent" />
          <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-safe animate-pulse-ring" />
        </div>
        <div>
          <h1 className="text-sm font-semibold tracking-tight">GuardTrace</h1>
          <p className="text-[10px] text-muted">Agent Safety Platform</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 p-3">
        <p className="mb-2 px-2 text-[10px] font-medium uppercase tracking-wider text-muted">工作台</p>
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = activeView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onViewChange(item.id)}
              className={cn(
                "group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-all",
                active
                  ? "bg-accent/10 text-foreground ring-1 ring-accent/20"
                  : "text-muted hover:bg-card-hover hover:text-foreground"
              )}
            >
              <Icon className={cn("h-4 w-4 shrink-0", active && "text-accent")} />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium">{item.label}</div>
                <div className="text-[10px] opacity-60">{item.desc}</div>
              </div>
              {active && <ChevronRight className="h-3.5 w-3.5 text-accent" />}
            </button>
          );
        })}
      </nav>

      <div className="border-t border-border p-4">
        <p className="mb-3 text-[10px] font-medium uppercase tracking-wider text-muted">级联护栏</p>
        <div className="space-y-2">
          {[
            { layer: "L1", name: "轻量规则", color: "text-[var(--l1)]", icon: Zap },
            { layer: "L2", name: "AgentDoG", color: "text-[var(--l2)]", icon: Layers },
            { layer: "L3", name: "精定位", color: "text-[var(--l3)]", icon: ShieldAlert },
          ].map((l) => (
            <div key={l.layer} className="flex items-center gap-2 rounded-md bg-background/50 px-2.5 py-1.5">
              <l.icon className={cn("h-3 w-3", l.color)} />
              <span className={cn("font-mono text-[10px] font-bold", l.color)}>{l.layer}</span>
              <span className="text-[10px] text-muted">{l.name}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-3 border-t border-border p-4">
        <ThemeToggle />
        <a
          href={GUARDTRACE_REPO}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 rounded-lg border border-border/60 px-2.5 py-2 text-[10px] text-muted transition-colors hover:border-border hover:text-foreground"
        >
          <GitBranch className="h-3 w-3 shrink-0" />
          <span className="truncate">GitHub · mo-guiji</span>
          <ExternalLink className="ml-auto h-3 w-3 shrink-0 opacity-50" />
        </a>
        <div className="flex items-center gap-2 text-[10px] text-muted">
          <Activity className="h-3 w-3 text-safe" />
          <span>系统在线 · GuardTrace API</span>
        </div>
      </div>
    </aside>
  );
}
