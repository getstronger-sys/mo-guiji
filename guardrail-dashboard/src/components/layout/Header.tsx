"use client";

import { Bell, Circle, Search } from "lucide-react";
import type { Trajectory } from "@/lib/types";
import { cn } from "@/lib/utils";

interface HeaderProps {
  trajectory?: Trajectory;
  isLive?: boolean;
}

export function Header({ trajectory, isLive }: HeaderProps) {
  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-card/80 px-5 backdrop-blur-sm">
      <div className="flex items-center gap-4">
        {trajectory ? (
          <>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold">{trajectory.name}</h2>
                <StatusBadge status={trajectory.status} />
              </div>
              <p className="text-[11px] text-muted">
                {trajectory.agent} · {trajectory.environment} · {trajectory.id}
              </p>
            </div>
          </>
        ) : (
          <h2 className="text-sm font-semibold text-muted">选择轨迹开始审查</h2>
        )}
      </div>

      <div className="flex items-center gap-3">
        {isLive && (
          <div className="flex items-center gap-1.5 rounded-full bg-danger/10 px-2.5 py-1 ring-1 ring-danger/20">
            <Circle className="h-2 w-2 fill-danger text-danger animate-pulse" />
            <span className="text-[11px] font-medium text-danger">LIVE</span>
          </div>
        )}

        <div className="relative hidden md:block">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
          <input
            type="text"
            placeholder="搜索轨迹、工具、风险类型..."
            className="h-8 w-64 rounded-lg border border-border bg-background pl-8 pr-3 text-xs placeholder:text-muted/60 focus:border-accent/50 focus:outline-none focus:ring-1 focus:ring-accent/20"
          />
        </div>

        <button className="relative rounded-lg p-2 text-muted transition-colors hover:bg-card-hover hover:text-foreground">
          <Bell className="h-4 w-4" />
          <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-danger" />
        </button>
      </div>
    </header>
  );
}

function StatusBadge({ status }: { status: Trajectory["status"] }) {
  const config = {
    completed: { label: "已完成", className: "bg-safe/10 text-safe ring-safe/20" },
    blocked: { label: "已拦截", className: "bg-danger/10 text-danger ring-danger/20" },
    running: { label: "运行中", className: "bg-accent/10 text-accent ring-accent/20" },
  }[status];

  return (
    <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium ring-1", config.className)}>
      {config.label}
    </span>
  );
}
