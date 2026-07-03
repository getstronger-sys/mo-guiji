/** 官方 AgentDoG Online Guardrail 面板地址（本地复现或赛方部署） */
export const OFFICIAL_GUARDRAIL_URL =
  process.env.NEXT_PUBLIC_OFFICIAL_GUARDRAIL_URL ?? "http://127.0.0.1:8340";

export const OFFICIAL_GUARDRAIL_INSPECTIONS_URL = `${OFFICIAL_GUARDRAIL_URL}/inspections.html`;

export const OFFICIAL_GUARDRAIL_REPO =
  "https://github.com/AI45Lab/AgentDoG/tree/main/Online%20Agentic%20Guardrail";
