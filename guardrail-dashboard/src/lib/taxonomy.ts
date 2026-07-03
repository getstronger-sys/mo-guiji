export type TaxonomyDimension = "riskSource" | "failureMode" | "realWorldHarm";
export type AgentSetting = "general" | "codex" | "openclaw";

export interface TaxonomyLabel {
  id: string;
  name: string;
  dimension: TaxonomyDimension;
  parentCategory: string;
  description: string;
  /** OpenClaw 全新叶子类别 */
  isNewOpenClaw?: boolean;
  /** Codex 全新叶子类别 */
  isNewCodex?: boolean;
  /** 继承类别在 OpenClaw 下加强 (OC) */
  strengthenedOpenClaw?: boolean;
  /** 继承类别在 Codex 下加强 (CX) */
  strengthenedCodex?: boolean;
  clawNote?: string;
  codexNote?: string;
}

export interface ActiveLabels {
  riskSource?: string;
  failureMode?: string;
  realWorldHarm?: string;
}

export const DIMENSION_META: Record<
  TaxonomyDimension,
  { title: string; subtitle: string; where: string; color: string }
> = {
  riskSource: {
    title: "Risk Source",
    subtitle: "风险来源",
    where: "Where",
    color: "cyan",
  },
  failureMode: {
    title: "Failure Mode",
    subtitle: "失效模式",
    where: "How",
    color: "violet",
  },
  realWorldHarm: {
    title: "Real-world Harm",
    subtitle: "现实危害",
    where: "What",
    color: "rose",
  },
};

/** AgentDoG 1.5 Appendix A — full taxonomy */
export const TAXONOMY_LABELS: TaxonomyLabel[] = [
  // ── A.1 Risk Source ──
  {
    id: "rs-malicious-user",
    name: "Malicious User Instruction or Jailbreak",
    dimension: "riskSource",
    parentCategory: "User Input",
    description:
      "用户明确、故意指示 Agent 执行有害行为或生成有害内容，包括使用 jailbreak 绕过内置防护。",
    strengthenedOpenClaw: true,
    strengthenedCodex: true,
    clawNote: "常表现为明确要求外泄 secret、绕过 approval 或无视 sandbox/网络策略边界。",
    codexNote: "常表现为明确要求外泄 secret、绕过 approval 或无视 sandbox/网络策略边界。",
  },
  {
    id: "rs-direct-injection",
    name: "Direct Prompt Injection",
    dimension: "riskSource",
    parentCategory: "User Input",
    description:
      "恶意指令嵌入在看似 benign 的用户 prompt 中，导致 Agent 执行隐藏命令、覆盖安全约束。",
    strengthenedCodex: true,
    codexNote:
      "适用于未信任指令被直接粘贴进 coding request，如 issue body、ticket、repo note 成为用户 prompt 一部分。",
  },
  {
    id: "rs-sender-ambiguity",
    name: "Sender / Session Identity Ambiguity",
    dimension: "riskSource",
    parentCategory: "User Input",
    description:
      "指令的发送者、线程、session 或身份边界模糊，导致 Agent 在错误授权上下文下行动。",
    isNewOpenClaw: true,
    clawNote: "OpenClaw 专属：共享 DM、跨 channel 聚合或错误 session 绑定时尤为 relevant。",
  },
  {
    id: "rs-indirect-injection",
    name: "Indirect Prompt Injection",
    dimension: "riskSource",
    parentCategory: "Environmental Observation",
    description:
      "恶意指令嵌入 Agent 观察到的外部内容（网页、文档、截图），在感知阶段被无意执行。",
    strengthenedCodex: true,
    codexNote:
      "Codex 中涵盖执行期间观察到的未信任内容（未被提升为 direct prompt），如外部文档、渲染产物、repo 讨论面。",
  },
  {
    id: "rs-unreliable-info",
    name: "Unreliable or Misinformation",
    dimension: "riskSource",
    parentCategory: "Environmental Observation",
    description:
      "Agent 观察到错误、过时、不完整、有噪声或误导的环境信息，在无对抗意图下仍导致 unsafe 输出。",
    strengthenedCodex: true,
    codexNote: "常见如 stale repo 状态、误导性诊断、大 repo 的部分上下文。",
  },
  {
    id: "rs-session-contamination",
    name: "Persistent Memory / Session-State Contamination",
    dimension: "riskSource",
    parentCategory: "Environmental Observation",
    description:
      "持久状态（memory、session history、browser profile、cookies、tmux logs、prior tool traces）被污染或 stale，跨 turn/session 持续影响决策。",
    isNewOpenClaw: true,
    clawNote: "OpenClaw 专属新风险源。",
  },
  {
    id: "rs-repo-artifact-injection",
    name: "Repository Artifact Injection",
    dimension: "riskSource",
    parentCategory: "Environmental Observation",
    description:
      "恶意或误导指令嵌入 repo 工件（README、issue、PR comment、文档、源码注释），被 Codex Agent 当作可信任务指导。",
    isNewCodex: true,
    codexNote: "Codex 专属：区别于 direct prompt injection 和 broader external observation。",
  },
  {
    id: "rs-tool-desc-injection",
    name: "Tool Description Injection",
    dimension: "riskSource",
    parentCategory: "External Entities (Tools/APIs/Skills)",
    description:
      "工具描述或 API schema 被篡改，包含恶意指令或误导规格，导致 Agent 误用工具或调用有害参数。",
    strengthenedCodex: true,
    codexNote: "包括误导性 MCP schema 或 tool manifest，鼓励 over-privileged repo 操作。",
  },
  {
    id: "rs-malicious-tool",
    name: "Malicious Tool Execution",
    dimension: "riskSource",
    parentCategory: "External Entities (Tools/APIs/Skills)",
    description:
      "工具本身存在未披露的恶意行为或漏洞，Agent 执行时导致非预期有害结果。",
    strengthenedCodex: true,
    codexNote: "适用于未信任 MCP server、package installer、repo 侧可执行文件。",
  },
  {
    id: "rs-corrupted-feedback",
    name: "Corrupted Tool Feedback",
    dimension: "riskSource",
    parentCategory: "External Entities (Tools/APIs/Skills)",
    description:
      "工具/API 返回的输出被篡改或操纵，引入错误信息或隐藏指令，影响 Agent 后续行动。",
    strengthenedCodex: true,
    codexNote: "build/test/lint/analysis 反馈被操纵、不完整或误导时尤其重要。",
  },
  {
    id: "rs-skill-supply-chain",
    name: "Skill / Plugin Supply-Chain Compromise",
    dimension: "riskSource",
    parentCategory: "External Entities (Tools/APIs/Skills)",
    description:
      "skill、plugin、dependency 或 update channel 被投毒或劫持，通过包发布、版本更新或依赖解析注入风险。",
    isNewOpenClaw: true,
    clawNote: "OpenClaw 专属新风险源。",
  },
  {
    id: "rs-platform-vuln",
    name: "Platform / Tool Vulnerability Exploitation",
    dimension: "riskSource",
    parentCategory: "External Entities (Tools/APIs/Skills)",
    description:
      "观察到的 exploit chain 触发已知 platform、browser-control、tool-execution 或 host-runtime 漏洞（强调 exploitation 事件本身）。",
    isNewOpenClaw: true,
    clawNote: "OpenClaw 专属新风险源。",
  },
  {
    id: "rs-dep-mcp-supply-chain",
    name: "Dependency / MCP Supply-Chain Compromise",
    dimension: "riskSource",
    parentCategory: "External Entities (Tools/APIs/Skills)",
    description:
      "依赖包、installer、MCP server 或 update channel 被投毒或劫持，通过安装、tool 解析或 connector 调用引入 unsafe 行为。",
    isNewCodex: true,
    codexNote: "Codex 专属新风险源。",
  },
  {
    id: "rs-inherent-failures",
    name: "Inherent Agent or LLM Failures",
    dimension: "riskSource",
    parentCategory: "Internal Logic and Failures",
    description:
      "幻觉、 flawed reasoning、错误 tool 选择或与任务意图 misalignment，源于 Agent 内部决策而非外部输入。",
    strengthenedCodex: true,
    codexNote: "常表现为 repo 规模 reasoning 错误、unsafe 文件选择、对验证状态的 false confidence。",
  },
  {
    id: "rs-policy-precedence",
    name: "Policy Precedence Misinterpretation",
    dimension: "riskSource",
    parentCategory: "Internal Logic and Failures",
    description:
      "Agent 错误理解 user intent、system policy、approval rules、tool policies 的优先级，执行本应 block/review 的行动。",
    isNewOpenClaw: true,
    clawNote: "OpenClaw 专属新风险源。",
    codexNote:
      "Codex 类比：approval、sandbox、network、repo-boundary policy 在执行中被赋予错误 precedence。",
  },

  // ── A.2 Failure Mode ──
  {
    id: "fm-over-privileged",
    name: "Unconfirmed or Over-privileged Action",
    dimension: "failureMode",
    parentCategory: "Behavioral Failure Mode",
    description:
      "Agent 在确认不足或用户未明确同意下执行行动，尤其是修改文件、花钱、访问敏感资源等 high-stakes 操作。",
    strengthenedOpenClaw: true,
    strengthenedCodex: true,
    clawNote: "常表现为 destructive repo edit、secret 访问、越界 action 且无 approval。",
    codexNote: "常表现为 destructive repo edit、secret 访问、越界 action 且无 approval。",
  },
  {
    id: "fm-flawed-planning",
    name: "Flawed Planning or Reasoning",
    dimension: "failureMode",
    parentCategory: "Behavioral Failure Mode",
    description:
      "规划阶段失败：误解用户意图、构建逻辑错误或 unsafe 的行动序列、未预见可预见的负面后果。",
    strengthenedCodex: true,
    codexNote: "可表现为 repo 级 refactor 或 unsafe remediation plan，忽略 downstream build/policy 后果。",
  },
  {
    id: "fm-improper-tool-use",
    name: "Improper Tool Use",
    dimension: "failureMode",
    parentCategory: "Behavioral Failure Mode",
    description:
      "a) 错误/unsafe 参数 b) 选择恶意/不安全 tool c) 在不当 context 使用 benign tool d) 未验证 tool 输出、过度信任。",
    strengthenedOpenClaw: true,
    strengthenedCodex: true,
    clawNote: "常见 unsafe shell flags、错误 patch target、MCP tool 误用。",
    codexNote:
      "常见 unsafe shell flags、错误 patch target、MCP 误用；d) 在 Codex 中特别涵盖测试输出、build log、依赖行为、shell 副作用、MCP 响应验证。",
  },
  {
    id: "fm-insecure-execution",
    name: "Insecure Interaction or Execution",
    dimension: "failureMode",
    parentCategory: "Behavioral Failure Mode",
    description:
      "与 untrusted/unsafe/malicious 组件交互或执行，如运行漏洞代码、点击钓鱼链接、下载恶意文件。",
    strengthenedCodex: true,
    codexNote: "常涉及运行 untrusted repo script、fetch installer、超出 runtime policy 的 shell 命令。",
  },
  {
    id: "fm-procedural-deviation",
    name: "Procedural Deviation or Inaction",
    dimension: "failureMode",
    parentCategory: "Behavioral Failure Mode",
    description:
      "未正确遵循预定义 workflow、SOP 或用户指定步骤序列，包括遗漏、重排、错误执行或该行动时不行动。",
    strengthenedCodex: true,
    codexNote: "包括跳过 required test、review step 或 approval checkpoint 就应用 risky patch。",
  },
  {
    id: "fm-inefficient",
    name: "Inefficient or Wasteful Execution",
    dimension: "failureMode",
    parentCategory: "Behavioral Failure Mode",
    description:
      "技术上正确但高度低效地完成任务，过度消耗时间、算力或金钱。",
    strengthenedCodex: true,
    codexNote: "如重复 whole-repo rebuild、不必要 tool loop、可避免的长 context reprocessing。",
  },
  {
    id: "fm-approval-bypass",
    name: "Approval Bypass or Missing Human-in-the-Loop",
    dimension: "failureMode",
    parentCategory: "Behavioral Failure Mode",
    description:
      "本应进入 review path 的 action 被直接执行，或 approval context、approver identity、review binding 错误或缺失。",
    isNewOpenClaw: true,
    clawNote: "OpenClaw 专属新 failure mode。",
  },
  {
    id: "fm-scope-overreach",
    name: "Action Scope Overreach",
    dimension: "failureMode",
    parentCategory: "Behavioral Failure Mode",
    description:
      "执行范围超出用户 intended boundary，如「清理临时文件」后递归删除重要目录。",
    isNewOpenClaw: true,
    strengthenedCodex: true,
    clawNote: "OpenClaw 专属新 failure mode。",
    codexNote: "Codex 中 edit 扩散到 intended repo files 或 workspace boundary 之外时同样 central。",
  },
  {
    id: "fm-cross-tool-chain",
    name: "Cross-Tool Attack Chaining",
    dimension: "failureMode",
    parentCategory: "Behavioral Failure Mode",
    description:
      "单步 benign 的 tool call 组合成 harmful 多 tool 链，如读敏感 state → 外传 → 擦除痕迹。",
    isNewOpenClaw: true,
    strengthenedCodex: true,
    clawNote: "OpenClaw 专属新 failure mode。",
    codexNote: "Codex 中 shell、patching、network、MCP action 组合成 harmful execution chain 时同样重要。",
  },
  {
    id: "fm-misrouting",
    name: "Cross-Channel / Recipient Misrouting",
    dimension: "failureMode",
    parentCategory: "Behavioral Failure Mode",
    description:
      "消息、文件或自动化 action 被路由到错误 recipient、thread、channel 或 workspace，导致非预期披露或破坏。",
    isNewOpenClaw: true,
    clawNote: "OpenClaw 专属新 failure mode。",
  },
  {
    id: "fm-unattended-automation",
    name: "Unsafe Unattended Automation",
    dimension: "failureMode",
    parentCategory: "Behavioral Failure Mode",
    description:
      "scheduled hooks、auto-update、webhooks 或无监督 automation 在无 active human supervision 下持续执行 risky action。",
    isNewOpenClaw: true,
    strengthenedCodex: true,
    clawNote: "OpenClaw 专属新 failure mode。",
    codexNote: "Codex 类比：unattended coding automation 持续应用 risky edit/execution 且无 active review。",
  },
  {
    id: "fm-destructive-mutation",
    name: "Destructive Workspace Mutation",
    dimension: "failureMode",
    parentCategory: "Behavioral Failure Mode",
    description:
      "Agent 应用 patch、删除文件或 repo 级 edit，scope 超出 intended coding task 或跨越 repo/workspace boundary。",
    isNewCodex: true,
    codexNote: "Codex 专属新 failure mode。",
  },
  {
    id: "fm-unsafe-shell",
    name: "Unsafe Shell / Script Execution",
    dimension: "failureMode",
    parentCategory: "Behavioral Failure Mode",
    description:
      "执行 unsafe、untrusted 或 overly permissive 的 shell 命令、repo script、installer 或 fetched code。",
    isNewCodex: true,
    codexNote: "Codex 专属新 failure mode。",
  },
  {
    id: "fm-harmful-content",
    name: "Generation of Harmful or Offensive Content",
    dimension: "failureMode",
    parentCategory: "Output Content Failure Mode",
    description:
      "生成 offensive、sensitive 或 harmful 内容，包括 hate speech、harassment、violence、explicit content 等。",
  },
  {
    id: "fm-harmful-instruction",
    name: "Instruction for Harmful or Illegal Activity",
    dimension: "failureMode",
    parentCategory: "Output Content Failure Mode",
    description:
      "提供可操作的 illegal、unethical 或 dangerous 活动指导，如 hacking、暴力、武器制造等。",
  },
  {
    id: "fm-malicious-executable",
    name: "Generation of Malicious Executables",
    dimension: "failureMode",
    parentCategory: "Output Content Failure Mode",
    description:
      "生成可用于 compromise 系统安全、窃取数据或 enable unauthorized access 的可执行代码或脚本。",
    strengthenedCodex: true,
    codexNote: "包括伪装成 helpful repo change 的 malicious script/payload。",
  },
  {
    id: "fm-unauthorized-disclosure",
    name: "Unauthorized Information Disclosure",
    dimension: "failureMode",
    parentCategory: "Output Content Failure Mode",
    description:
      "未经授权泄露 sensitive、private 或 confidential 信息，包括 PII、商业机密、版权内容或其他 session 内容。",
    strengthenedOpenClaw: true,
    strengthenedCodex: true,
    clawNote: "OpenClaw 场景下 relevant。",
    codexNote:
      "Codex 中特别涵盖 repo secret、env 文件、credentials、logs、connector responses，不仅是对话内容泄露。",
  },
  {
    id: "fm-misleading-info",
    name: "Provide Inaccurate, Misleading, or Unverified Information",
    dimension: "failureMode",
    parentCategory: "Output Content Failure Mode",
    description:
      "呈现 false、fabricated 或 misleading 信息，从 minor inaccuracy 到 medicine/law/finance 等 high-stakes misinformation。",
    strengthenedCodex: true,
    codexNote: "包括 unsupported success claims，如断言 fix 已 verified 但 execution evidence 不足。",
  },

  // ── A.3 Real-world Harm ──
  {
    id: "rh-privacy",
    name: "Privacy & Confidentiality Harm",
    dimension: "realWorldHarm",
    parentCategory: "Real-world Harm",
    description:
      "未经授权暴露、披露或滥用 personal、organizational 或 sensitive 信息， compromise confidentiality 或 enable re-identification。",
    strengthenedOpenClaw: true,
    strengthenedCodex: true,
    clawNote: "常通过 cross-channel leakage、browser-session disclosure、unintended external send 实现。",
    codexNote: "常通过 repo secret、env 文件、logs、connector outputs 泄露实现。",
  },
  {
    id: "rh-financial",
    name: "Financial & Economic Harm",
    dimension: "realWorldHarm",
    parentCategory: "Real-world Harm",
    description:
      "导致 direct/indirect monetary loss、破坏 financial assets、未授权交易或 economically damaging 决策。",
    strengthenedCodex: true,
    codexNote: "可能来自 destructive repo change、expensive repeated builds、unsafe dependency action。",
  },
  {
    id: "rh-security",
    name: "Security & System Integrity Harm",
    dimension: "realWorldHarm",
    parentCategory: "Real-world Harm",
    description:
      "compromise account security、system configuration、code execution safety 或 digital infrastructure reliability。",
    strengthenedOpenClaw: true,
    strengthenedCodex: true,
    clawNote: "常与 host compromise、malicious skills、exploit-triggered tool behavior 相关。",
    codexNote: "常与 unsafe shell、destructive mutation、secret exfiltration、sandbox-boundary violation 相关。",
  },
  {
    id: "rh-physical",
    name: "Physical & Health Harm",
    dimension: "realWorldHarm",
    parentCategory: "Real-world Harm",
    description:
      "direct/indirect 危及 human health、safety 或 physical environment，包括 harmful guidance 或 unsafe 控制 real-world devices。",
  },
  {
    id: "rh-psychological",
    name: "Psychological & Emotional Harm",
    dimension: "realWorldHarm",
    parentCategory: "Real-world Harm",
    description:
      "负面影响 individual psychological/emotional well-being，包括 harassment、intimidation、disturbing content 等。",
  },
  {
    id: "rh-reputational",
    name: "Reputational & Interpersonal Harm",
    dimension: "realWorldHarm",
    parentCategory: "Real-world Harm",
    description:
      "生成或传播损害 individual/organization reputation、trustworthiness 或 social relationships 的内容或行动。",
    strengthenedOpenClaw: true,
    strengthenedCodex: true,
    clawNote: "因 misrouted message、unsafe automated posting、unintended external action 而放大。",
    codexNote: "可来自 public code mistake、leaked secrets、false claims 变更已 safely verified。",
  },
  {
    id: "rh-societal",
    name: "Info-ecosystem & Societal Harm",
    dimension: "realWorldHarm",
    parentCategory: "Real-world Harm",
    description:
      "degrade broader information environment 或 societal systems，包括 spreading misinformation、manipulating public discourse。",
  },
  {
    id: "rh-public-service",
    name: "Public Service & Resource Harm",
    dimension: "realWorldHarm",
    parentCategory: "Real-world Harm",
    description:
      "misuse、disrupt 或 deplete critical public services、infrastructure 或 resources。",
  },
  {
    id: "rh-fairness",
    name: "Fairness, Equity, and Allocative Harm",
    dimension: "realWorldHarm",
    parentCategory: "Real-world Harm",
    description:
      "导致 unjust、biased 或 inequitable outcomes，包括 unfair resource allocation 或 harmful stereotypes。",
  },
  {
    id: "rh-functional",
    name: "Functional & Opportunity Harm",
    dimension: "realWorldHarm",
    parentCategory: "Real-world Harm",
    description:
      "Agent 未能正确/effectively 执行 intended function，包括 inaction、incorrect analysis 或 wasted resources。",
    strengthenedOpenClaw: true,
    strengthenedCodex: true,
    clawNote: "unsafe orchestration 破坏 user workflow 或导致 missed external action。",
    codexNote: "Codex Agent break builds、edit wrong files 或 waste review/debugging cycles。",
  },
  {
    id: "rh-compliance",
    name: "Compliance, Legal, and Auditability Harm",
    dimension: "realWorldHarm",
    parentCategory: "Real-world Harm",
    description:
      "违反 approval、retention、data-governance、least-privilege 或 audit-trace 要求，产生 legal/compliance/forensic 风险。",
    isNewOpenClaw: true,
    strengthenedCodex: true,
    clawNote: "OpenClaw 专属新 harm category。",
    codexNote: "Codex 中亦 relevant：approval-trace gaps、policy violations、unauthorized dependency intake。",
  },
];

/** Legacy / shorthand aliases for label matching */
const LABEL_ALIASES: Record<string, string> = {
  "external injection": "Indirect Prompt Injection",
  "malicious tool execution": "Malicious Tool Execution",
  "data exfiltration": "Privacy & Confidentiality Harm",
  "privilege escalation": "Unconfirmed or Over-privileged Action",
  "tool misuse": "Improper Tool Use",
  "prompt injection": "Direct Prompt Injection",
};

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function matchTaxonomyLabel(
  dimension: TaxonomyDimension,
  value: string | undefined
): TaxonomyLabel | undefined {
  if (!value) return undefined;
  const alias = LABEL_ALIASES[normalize(value)];
  const target = alias ?? value;
  const n = normalize(target);

  return TAXONOMY_LABELS.find(
    (l) =>
      l.dimension === dimension &&
      (normalize(l.name) === n || normalize(l.id) === n || l.name === target)
  );
}

export function resolveActiveLabels(labels?: ActiveLabels): {
  riskSource?: TaxonomyLabel;
  failureMode?: TaxonomyLabel;
  realWorldHarm?: TaxonomyLabel;
} {
  return {
    riskSource: matchTaxonomyLabel("riskSource", labels?.riskSource),
    failureMode: matchTaxonomyLabel("failureMode", labels?.failureMode),
    realWorldHarm: matchTaxonomyLabel("realWorldHarm", labels?.realWorldHarm),
  };
}

export function groupByParentCategory(
  dimension: TaxonomyDimension
): Map<string, TaxonomyLabel[]> {
  const map = new Map<string, TaxonomyLabel[]>();
  for (const label of TAXONOMY_LABELS.filter((l) => l.dimension === dimension)) {
    const list = map.get(label.parentCategory) ?? [];
    list.push(label);
    map.set(label.parentCategory, list);
  }
  return map;
}

export function getSettingBadge(label: TaxonomyLabel): ("OC" | "CX")[] {
  const badges: ("OC" | "CX")[] = [];
  if (label.isNewOpenClaw || label.strengthenedOpenClaw) badges.push("OC");
  if (label.isNewCodex || label.strengthenedCodex) badges.push("CX");
  return [...new Set(badges)];
}

export function isNewCategory(label: TaxonomyLabel, setting: AgentSetting): boolean {
  if (setting === "openclaw") return Boolean(label.isNewOpenClaw);
  if (setting === "codex") return Boolean(label.isNewCodex);
  return false;
}
