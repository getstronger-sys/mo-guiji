from __future__ import annotations

import json
import re
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Literal

from guardrail.codeshield_bridge import scan_generated_code


@dataclass(frozen=True)
class L1CheckResult:
    passed: bool
    rule: str | None = None
    rule_id: str | None = None
    message: str | None = None
    severity: Literal["block", "warn"] = "block"
    latency_ms: float = 0.0
    confidence: float | None = None
    scanner: str | None = None
    cwe_id: str | None = None
    detail: dict[str, Any] = field(default_factory=dict)


_CONFIG_PATH = Path(__file__).with_name("l1_rules.json")

_DEFAULT_CONFIG: dict[str, Any] = {
    "blocked_domains": ["attacker.example", "evil.com"],
    "blocked_tools": [],
    "sensitive_path_patterns": [r"\.env", "/etc/passwd"],
    "shell_tools": ["run_shell", "shell", "bash"],
    "write_tools": ["write_file", "write"],
    "read_tools": ["read_file", "read"],
    "network_tools": ["http_request", "fetch"],
    "destructive_tools": ["delete_file"],
    "exfil_tools": ["send_email"],
    "code_content_keys": ["content", "code", "command"],
    "dangerous_shell_patterns": [r"rm\s+-rf\s+/"],
    "reverse_shell_patterns": [],
    "prompt_injection_patterns": [r"ignore\s+(all\s+)?previous\s+instructions"],
    "path_traversal_patterns": [r"\.\./"],
    "secret_patterns": [],
    "sql_injection_patterns": [],
    "ssrf_patterns": [],
    "system_write_path_patterns": [],
    "insecure_code_patterns": [],
}


def _load_config() -> dict[str, Any]:
    if _CONFIG_PATH.exists():
        try:
            data = json.loads(_CONFIG_PATH.read_text(encoding="utf-8"))
            if isinstance(data, dict):
                return {**_DEFAULT_CONFIG, **data}
        except (json.JSONDecodeError, OSError):
            pass
    return dict(_DEFAULT_CONFIG)


def _compile_list(patterns: list[str], *, flags: int = re.IGNORECASE) -> list[re.Pattern[str]]:
    compiled: list[re.Pattern[str]] = []
    for p in patterns:
        try:
            compiled.append(re.compile(p, flags))
        except re.error:
            continue
    return compiled


def _domain_pattern(domains: list[str]) -> re.Pattern[str]:
    escaped = "|".join(re.escape(d) for d in domains)
    return re.compile(rf"https?://(?:[\w.-]*\.)?(?:{escaped})\b", re.IGNORECASE)


def _tool_set(names: list[str]) -> set[str]:
    return {n.lower() for n in names}


def _fail(
    *,
    rule_id: str,
    rule: str,
    message: str,
    confidence: float,
    severity: Literal["block", "warn"] = "block",
    scanner: str | None = None,
    cwe_id: str | None = None,
    detail: dict[str, Any] | None = None,
) -> L1CheckResult:
    return L1CheckResult(
        passed=severity != "block",
        rule=rule,
        rule_id=rule_id,
        message=message,
        severity=severity,
        confidence=confidence,
        scanner=scanner,
        cwe_id=cwe_id,
        detail=detail or {},
    )


class L1RuleEngine:
    """GuardTrace L1 — PRE_TOOL 规则 + CodeShield 静态扫描，零 Token。"""

    def __init__(self, config: dict[str, Any] | None = None) -> None:
        cfg = config or _load_config()
        self.blocked_domain_re = _domain_pattern(cfg.get("blocked_domains", []))
        self.sensitive_path_res = _compile_list(cfg.get("sensitive_path_patterns", []))
        self.dangerous_shell_res = _compile_list(cfg.get("dangerous_shell_patterns", []))
        self.reverse_shell_res = _compile_list(cfg.get("reverse_shell_patterns", []))
        self.injection_res = _compile_list(cfg.get("prompt_injection_patterns", []))
        self.traversal_res = _compile_list(cfg.get("path_traversal_patterns", []))
        self.secret_res = _compile_list(cfg.get("secret_patterns", []))
        self.sql_injection_res = _compile_list(cfg.get("sql_injection_patterns", []))
        self.ssrf_res = _compile_list(cfg.get("ssrf_patterns", []))
        self.system_write_res = _compile_list(cfg.get("system_write_path_patterns", []))

        self.blocked_tools = _tool_set(cfg.get("blocked_tools", []))
        self.shell_tools = _tool_set(cfg.get("shell_tools", []))
        self.write_tools = _tool_set(cfg.get("write_tools", []))
        self.read_tools = _tool_set(cfg.get("read_tools", []))
        self.network_tools = _tool_set(cfg.get("network_tools", []))
        self.destructive_tools = _tool_set(cfg.get("destructive_tools", []))
        self.exfil_tools = _tool_set(cfg.get("exfil_tools", []))
        self.code_content_keys = [k.lower() for k in cfg.get("code_content_keys", [])]
        self.insecure_code_patterns: list[dict[str, str]] = list(
            cfg.get("insecure_code_patterns", [])
        )

    def check(
        self,
        *,
        pending_tool: str | None = None,
        pending_args: dict[str, Any] | None = None,
        thought: str | None = None,
        trajectory: str = "",
        prior_observations: str = "",
    ) -> L1CheckResult:
        started = time.perf_counter()
        pending_args = pending_args or {}
        tool = (pending_tool or "").lower()
        blobs = self._gather_text(pending_tool, pending_args, thought, trajectory, prior_observations)

        checks = [
            lambda: self._check_blocked_tool(tool),
            lambda: self._check_blocked_domain(blobs),
            lambda: self._check_ssrf(tool, pending_args, blobs),
            lambda: self._check_prompt_injection(blobs),
            lambda: self._check_path_traversal(pending_args, blobs),
            lambda: self._check_blocked_tool_policy(tool, pending_args),
            lambda: self._check_destructive_tool(tool, pending_args, blobs),
            lambda: self._check_dangerous_shell(tool, pending_args, blobs),
            lambda: self._check_reverse_shell(tool, pending_args, blobs),
            lambda: self._check_sql_injection(tool, pending_args, blobs),
            lambda: self._check_secret_exfil(tool, pending_args, blobs, prior_observations),
            lambda: self._check_exfil_chain(prior_observations, tool, pending_args, blobs),
            lambda: self._check_system_path_write(tool, pending_args),
            lambda: self._check_unauthorized_delete(tool, pending_args),
            lambda: self._check_codeshield(tool, pending_args),
        ]

        for run in checks:
            hit = run()
            if hit and hit.severity == "block" and not hit.passed:
                return self._with_latency(hit, started)

        warn = self._check_sensitive_access(tool, pending_args, blobs)
        if warn:
            return self._with_latency(warn, started)

        return L1CheckResult(
            passed=True,
            latency_ms=round((time.perf_counter() - started) * 1000, 3),
            confidence=0.99,
        )

    @staticmethod
    def _with_latency(result: L1CheckResult, started: float) -> L1CheckResult:
        return L1CheckResult(
            passed=result.passed,
            rule=result.rule,
            rule_id=result.rule_id,
            message=result.message,
            severity=result.severity,
            confidence=result.confidence,
            scanner=result.scanner,
            cwe_id=result.cwe_id,
            detail=result.detail,
            latency_ms=round((time.perf_counter() - started) * 1000, 3),
        )

    @staticmethod
    def _gather_text(
        pending_tool: str | None,
        pending_args: dict[str, Any],
        thought: str | None,
        trajectory: str,
        prior_observations: str,
    ) -> str:
        parts = [
            pending_tool or "",
            json.dumps(pending_args, ensure_ascii=False),
            thought or "",
            trajectory,
            prior_observations,
        ]
        return "\n".join(p for p in parts if p)

    def _extract_code_fragments(self, pending_args: dict[str, Any]) -> list[tuple[str, str | None]]:
        """Return (code_text, path_hint) from tool args."""
        fragments: list[tuple[str, str | None]] = []
        path_hint = str(pending_args.get("path", "") or pending_args.get("file", "") or "")

        for key, value in pending_args.items():
            if key.lower() not in self.code_content_keys:
                continue
            if isinstance(value, str) and len(value.strip()) >= 4:
                fragments.append((value, path_hint or None))

        if not fragments:
            for key in ("command", "cmd", "query"):
                val = pending_args.get(key)
                if isinstance(val, str) and len(val.strip()) >= 4:
                    fragments.append((val, path_hint or None))
        return fragments

    def _check_blocked_tool(self, tool: str) -> L1CheckResult | None:
        if tool and tool in self.blocked_tools:
            return _fail(
                rule_id="L1-R001",
                rule="blocked_tool",
                message=f"工具 {tool} 在黑名单中，禁止调用",
                confidence=0.99,
            )
        return None

    def _check_blocked_domain(self, blob: str) -> L1CheckResult | None:
        if self.blocked_domain_re.search(blob):
            return _fail(
                rule_id="L1-R002",
                rule="blocked_domain",
                message="检测到对外访问黑名单域名",
                confidence=0.98,
            )
        return None

    def _check_ssrf(
        self, tool: str, pending_args: dict[str, Any], blob: str
    ) -> L1CheckResult | None:
        if tool not in self.network_tools and "url" not in pending_args and "uri" not in pending_args:
            return None
        target = "\n".join(
            str(pending_args.get(k, "")) for k in ("url", "uri", "endpoint", "host") if pending_args.get(k)
        )
        target = f"{target}\n{blob}"
        for pattern in self.ssrf_res:
            if pattern.search(target):
                return _fail(
                    rule_id="L1-R003",
                    rule="ssrf_internal_target",
                    message="检测到 SSRF 内网/metadata 目标地址",
                    confidence=0.94,
                    cwe_id="CWE-918",
                )
        return None

    def _check_prompt_injection(self, blob: str) -> L1CheckResult | None:
        for pattern in self.injection_res:
            if pattern.search(blob):
                return _fail(
                    rule_id="L1-R004",
                    rule="prompt_injection_pattern",
                    message="检测到疑似 prompt injection 指令",
                    confidence=0.92,
                    cwe_id="CWE-74",
                )
        return None

    def _check_path_traversal(
        self, pending_args: dict[str, Any], blob: str
    ) -> L1CheckResult | None:
        path = str(pending_args.get("path", pending_args.get("file", "")))
        target = f"{path}\n{blob}"
        for pattern in self.traversal_res:
            if pattern.search(target):
                return _fail(
                    rule_id="L1-R005",
                    rule="path_traversal",
                    message="检测到路径穿越访问",
                    confidence=0.95,
                    cwe_id="CWE-22",
                )
        return None

    def _check_blocked_tool_policy(
        self, tool: str, pending_args: dict[str, Any]
    ) -> L1CheckResult | None:
        command = str(pending_args.get("command", pending_args.get("cmd", ""))).lower()
        if tool in self.shell_tools or command:
            if self.blocked_domain_re.search(command):
                return _fail(
                    rule_id="L1-R006",
                    rule="shell_blocked_destination",
                    message="shell 命令指向黑名单外联地址",
                    confidence=0.98,
                )
        return None

    def _check_destructive_tool(
        self, tool: str, pending_args: dict[str, Any], blob: str
    ) -> L1CheckResult | None:
        command = str(pending_args.get("command", pending_args.get("cmd", ""))).lower()
        path = str(pending_args.get("path", "")).lower()
        destructive_cmds = (
            "rm -rf",
            "mkfs",
            "dd if=/dev/zero",
            "drop table",
            "truncate ",
            "format c:",
            "del /f /s /q",
        )
        if tool in self.destructive_tools:
            return _fail(
                rule_id="L1-R007",
                rule="destructive_tool",
                message=f"破坏性工具 {tool} 被禁止",
                confidence=0.96,
                cwe_id="CWE-732",
            )
        if any(k in command for k in destructive_cmds) or any(k in blob.lower() for k in destructive_cmds):
            return _fail(
                rule_id="L1-R007",
                rule="destructive_operation",
                message="检测到破坏性操作命令",
                confidence=0.96,
                cwe_id="CWE-732",
            )
        if path and any(p.search(path) for p in self.sensitive_path_res) and tool in self.destructive_tools:
            return _fail(
                rule_id="L1-R007",
                rule="destructive_sensitive_path",
                message="尝试对敏感路径执行删除/破坏操作",
                confidence=0.97,
            )
        return None

    def _check_dangerous_shell(
        self, tool: str, pending_args: dict[str, Any], blob: str
    ) -> L1CheckResult | None:
        command = str(pending_args.get("command", pending_args.get("cmd", "")))
        shell_blob = f"{command}\n{blob}" if command else blob
        if tool not in self.shell_tools and not command:
            return None
        for pattern in self.dangerous_shell_res:
            if pattern.search(shell_blob):
                return _fail(
                    rule_id="L1-R008",
                    rule="dangerous_shell_pattern",
                    message="检测到高危 shell 命令模式",
                    confidence=0.97,
                    cwe_id="CWE-78",
                )
        return None

    def _check_reverse_shell(
        self, tool: str, pending_args: dict[str, Any], blob: str
    ) -> L1CheckResult | None:
        command = str(pending_args.get("command", ""))
        shell_blob = f"{command}\n{blob}"
        if tool not in self.shell_tools and not command:
            return None
        for pattern in self.reverse_shell_res:
            if pattern.search(shell_blob):
                return _fail(
                    rule_id="L1-R009",
                    rule="reverse_shell",
                    message="检测到反弹 shell 特征",
                    confidence=0.98,
                    cwe_id="CWE-78",
                )
        return None

    def _check_sql_injection(
        self, tool: str, pending_args: dict[str, Any], blob: str
    ) -> L1CheckResult | None:
        sql_blob = str(pending_args.get("query", pending_args.get("sql", "")))
        if not sql_blob:
            for frag, _ in self._extract_code_fragments(pending_args):
                if "SELECT" in frag.upper() or "INSERT" in frag.upper() or "DELETE" in frag.upper():
                    sql_blob = frag
                    break
        target = f"{sql_blob}\n{blob}"
        if not target.strip():
            return None
        for pattern in self.sql_injection_res:
            if pattern.search(target):
                return _fail(
                    rule_id="L1-R010",
                    rule="sql_injection_pattern",
                    message="检测到 SQL 注入或不安全 SQL 模式",
                    confidence=0.93,
                    cwe_id="CWE-89",
                    scanner="regex",
                )
        return None

    def _check_secret_exfil(
        self,
        tool: str,
        pending_args: dict[str, Any],
        blob: str,
        prior_observations: str,
    ) -> L1CheckResult | None:
        if tool not in self.exfil_tools and tool not in self.network_tools:
            return None
        outbound = blob
        has_secret_in_context = any(p.search(prior_observations) for p in self.secret_res) or any(
            p.search(prior_observations) for p in self.sensitive_path_res
        )
        secret_in_payload = any(p.search(outbound) for p in self.secret_res)
        if has_secret_in_context and (secret_in_payload or self.blocked_domain_re.search(outbound)):
            return _fail(
                rule_id="L1-R011",
                rule="secret_exfiltration",
                message="外发内容含密钥/凭证或敏感上下文外传",
                confidence=0.97,
                cwe_id="CWE-200",
            )
        return None

    def _check_exfil_chain(
        self,
        prior_observations: str,
        tool: str,
        pending_args: dict[str, Any],
        blob: str,
    ) -> L1CheckResult | None:
        has_secrets = any(p.search(prior_observations) for p in self.sensitive_path_res) or any(
            k in prior_observations.lower()
            for k in ("api_key", "sk-live", "password", "secret", "token", "credential")
        )
        is_exfil = self.blocked_domain_re.search(blob) or (
            "curl" in blob.lower() and ("file=" in blob.lower() or "--data" in blob.lower())
        )
        if has_secrets and is_exfil:
            return _fail(
                rule_id="L1-R012",
                rule="cross_tool_exfil_chain",
                message="组合攻击：先读取敏感信息再外传",
                confidence=0.99,
                cwe_id="CWE-200",
            )
        command = str(pending_args.get("command", ""))
        if tool in self.shell_tools and self.blocked_domain_re.search(command):
            return _fail(
                rule_id="L1-R012",
                rule="cross_tool_exfil_chain",
                message="shell 命令指向黑名单外联地址",
                confidence=0.98,
            )
        return None

    def _check_system_path_write(
        self, tool: str, pending_args: dict[str, Any]
    ) -> L1CheckResult | None:
        if tool not in self.write_tools:
            return None
        path = str(pending_args.get("path", pending_args.get("file", "")))
        for pattern in self.system_write_res:
            if pattern.search(path):
                return _fail(
                    rule_id="L1-R013",
                    rule="system_path_write",
                    message="禁止写入系统关键路径",
                    confidence=0.94,
                    cwe_id="CWE-732",
                )
        return None

    def _check_unauthorized_delete(
        self, tool: str, pending_args: dict[str, Any]
    ) -> L1CheckResult | None:
        if tool not in self.destructive_tools:
            return None
        path = str(pending_args.get("path", ""))
        for pattern in self.sensitive_path_res:
            if pattern.search(path):
                return _fail(
                    rule_id="L1-R014",
                    rule="sensitive_path_delete",
                    message="禁止删除敏感路径文件",
                    confidence=0.96,
                )
        return None

    def _check_codeshield(
        self, tool: str, pending_args: dict[str, Any]
    ) -> L1CheckResult | None:
        if tool not in self.shell_tools | self.write_tools and not self._extract_code_fragments(
            pending_args
        ):
            return None

        for code, path_hint in self._extract_code_fragments(pending_args):
            hit = scan_generated_code(
                code,
                path_hint=path_hint,
                builtin_patterns=self.insecure_code_patterns,
            )
            if hit and hit.insecure:
                return _fail(
                    rule_id="L1-R015",
                    rule="codeshield_insecure_code",
                    message=hit.description or "CodeShield 检测到不安全代码",
                    confidence=0.95,
                    cwe_id=hit.cwe_id,
                    scanner=f"codeshield/{hit.tier}",
                    detail={
                        "line": hit.line,
                        "language": hit.language,
                        "tier": hit.tier,
                        "codeshieldLatencyMs": hit.latency_ms,
                    },
                )
        return None

    def _check_sensitive_access(
        self, tool: str, pending_args: dict[str, Any], blob: str
    ) -> L1CheckResult | None:
        path = str(pending_args.get("path", pending_args.get("file", "")))
        if tool in self.read_tools or "path" in pending_args or "file" in pending_args:
            for pattern in self.sensitive_path_res:
                if pattern.search(path) or pattern.search(blob):
                    return _fail(
                        rule_id="L1-W001",
                        rule="sensitive_path_read",
                        message="访问敏感路径（告警，不拦截）",
                        severity="warn",
                        confidence=0.72,
                    )
        return None


_ENGINE = L1RuleEngine()


def list_rules() -> list[dict[str, str]]:
    return [
        {"id": "L1-R001", "name": "blocked_tool", "action": "block", "desc": "黑名单工具禁止调用"},
        {"id": "L1-R002", "name": "blocked_domain", "action": "block", "desc": "黑名单外联域名"},
        {"id": "L1-R003", "name": "ssrf_internal_target", "action": "block", "desc": "SSRF 内网/metadata 地址"},
        {"id": "L1-R004", "name": "prompt_injection_pattern", "action": "block", "desc": "注入指令特征"},
        {"id": "L1-R005", "name": "path_traversal", "action": "block", "desc": "路径穿越"},
        {"id": "L1-R006", "name": "shell_blocked_destination", "action": "block", "desc": "shell 指向黑名单域名"},
        {"id": "L1-R007", "name": "destructive_operation", "action": "block", "desc": "破坏性工具/命令"},
        {"id": "L1-R008", "name": "dangerous_shell_pattern", "action": "block", "desc": "高危 shell 模式"},
        {"id": "L1-R009", "name": "reverse_shell", "action": "block", "desc": "反弹 shell 特征"},
        {"id": "L1-R010", "name": "sql_injection_pattern", "action": "block", "desc": "SQL 注入/危险 SQL"},
        {"id": "L1-R011", "name": "secret_exfiltration", "action": "block", "desc": "凭证/密钥外传"},
        {"id": "L1-R012", "name": "cross_tool_exfil_chain", "action": "block", "desc": "跨工具敏感数据外传链"},
        {"id": "L1-R013", "name": "system_path_write", "action": "block", "desc": "系统路径写入"},
        {"id": "L1-R014", "name": "sensitive_path_delete", "action": "block", "desc": "敏感路径删除"},
        {
            "id": "L1-R015",
            "name": "codeshield_insecure_code",
            "action": "block",
            "desc": "CodeShield/ICD 静态代码扫描",
        },
        {"id": "L1-W001", "name": "sensitive_path_read", "action": "warn", "desc": "敏感路径读取告警"},
    ]


def check_pending_step(
    *,
    tool: str | None = None,
    args: dict[str, Any] | None = None,
    thought: str | None = None,
    trajectory: str = "",
    prior_observations: str = "",
) -> L1CheckResult:
    return _ENGINE.check(
        pending_tool=tool,
        pending_args=args,
        thought=thought,
        trajectory=trajectory,
        prior_observations=prior_observations,
    )


def check_trajectory_text(trajectory: str) -> L1CheckResult:
    return _ENGINE.check(trajectory=trajectory)


def check_tool_call(tool_name: str, args: dict[str, Any] | None = None) -> L1CheckResult:
    return _ENGINE.check(pending_tool=tool_name, pending_args=args or {})
