"use client";

import { AlertTriangle, Ban, CheckCircle2, Clock, Loader2 } from "lucide-react";
import type { StepStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

const statusConfig: Record<
  StepStatus,
  { icon: typeof CheckCircle2; color: string; bg: string; ring: string; label: string }
> = {
  safe: {
    icon: CheckCircle2,
    color: "text-safe",
    bg: "bg-safe/10",
    ring: "ring-safe/30",
    label: "安全",
  },
  suspicious: {
    icon: AlertTriangle,
    color: "text-warning",
    bg: "bg-warning/10",
    ring: "ring-warning/30",
    label: "可疑",
  },
  blocked: {
    icon: Ban,
    color: "text-danger",
    bg: "bg-danger/10",
    ring: "ring-danger/30",
    label: "拦截",
  },
  pending: {
    icon: Clock,
    color: "text-muted",
    bg: "bg-muted/10",
    ring: "ring-muted/20",
    label: "待检",
  },
  running: {
    icon: Loader2,
    color: "text-accent",
    bg: "bg-accent/10",
    ring: "ring-accent/30",
    label: "检测中",
  },
};

interface StatusBadgeProps {
  status: StepStatus;
  size?: "sm" | "md";
  showLabel?: boolean;
}

export function StatusBadge({ status, size = "sm", showLabel = true }: StatusBadgeProps) {
  const config = statusConfig[status];
  const Icon = config.icon;
  const iconSize = size === "sm" ? "h-3 w-3" : "h-4 w-4";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full font-medium ring-1",
        config.bg,
        config.color,
        config.ring,
        size === "sm" ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-xs"
      )}
    >
      <Icon className={cn(iconSize, status === "running" && "animate-spin")} />
      {showLabel && config.label}
    </span>
  );
}

export function getStatusColor(status: StepStatus): string {
  return statusConfig[status].color;
}
