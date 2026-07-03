import { NextResponse } from "next/server";
import {
  OFFICIAL_GUARDRAIL_INSPECTIONS_URL,
  OFFICIAL_GUARDRAIL_REPO,
  OFFICIAL_GUARDRAIL_URL,
} from "@/lib/official-guardrail";

/** 赛方 / 评委可用的官方护栏跳转元数据 */
export async function GET() {
  return NextResponse.json({
    name: "AgentDoG Online Agentic Guardrail",
    dashboard: OFFICIAL_GUARDRAIL_URL,
    inspections: OFFICIAL_GUARDRAIL_INSPECTIONS_URL,
    repository: OFFICIAL_GUARDRAIL_REPO,
    description:
      "GuardTrace 增强展示层；官方 PRE_REPLY 在线护栏与 OpenClaw 监控见 dashboard URL。",
  });
}
