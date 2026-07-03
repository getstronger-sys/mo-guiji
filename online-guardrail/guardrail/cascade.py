from __future__ import annotations

import time
from typing import Any

from guardrail.agentdog_l2 import evaluate_l2_xai
from guardrail.config import GuardrailConfig
from guardrail.l1_rules import check_pending_step
from guardrail.risk_scoring import cumulative_for_steps
from guardrail.trajectory import extract_tool_list, extract_trajectory_text


def _l3_localize(
    trajectory: str,
    *,
    diagnostic_only: bool,
    step_index: int | None,
    pending_tool: str | None,
    labels: dict[str, str] | None,
    confidence: float,
) -> dict[str, Any]:
    snippet = ""
    for line in trajectory.splitlines():
        if any(k in line.lower() for k in ("attacker", "curl", "rm -rf", "tool_call")):
            snippet = line.strip()[:200]
            break

    return {
        "passed": False,
        "diagnosticOnly": diagnostic_only,
        "stepIndex": step_index,
        "toolName": pending_tool,
        "labels": labels,
        "reason": "L3 精确定位：高风险 tool 参数片段",
        "codeSpan": {
            "start": 0,
            "end": len(snippet),
            "snippet": snippet or trajectory[:160],
        },
        "latencyMs": 8.0,
        "confidence": confidence,
    }


def _extract_context_from_steps(steps: list[dict[str, Any]] | None) -> tuple[str | None, dict[str, Any], str | None, str]:
    if not steps:
        return None, {}, None, ""
    last = steps[-1]
    action = last.get("action", {})
    tool = action.get("tool")
    args = action.get("args") or {}
    thought = last.get("thought")
    prior = "\n".join(
        str(s.get("observation", ""))
        for s in steps[:-1]
        if s.get("observation")
    )
    return tool, args if isinstance(args, dict) else {}, thought, prior


def run_cascade(
    session_events_text: str,
    config: GuardrailConfig,
    *,
    step_index: int | None = None,
    accumulated_steps: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    started = time.perf_counter()
    trajectory = extract_trajectory_text(session_events_text)
    tool_list = extract_tool_list(session_events_text)

    pending_tool, pending_args, thought, prior_obs = _extract_context_from_steps(accumulated_steps)

    l1 = check_pending_step(
        tool=pending_tool,
        args=pending_args,
        thought=thought,
        trajectory=trajectory,
        prior_observations=prior_obs,
    )

    l1_payload: dict[str, Any] = {
        "passed": l1.passed,
        "rule": l1.rule,
        "ruleId": l1.rule_id,
        "message": l1.message,
        "latencyMs": l1.latency_ms,
        "confidence": l1.confidence,
        "severity": l1.severity,
    }
    if l1.scanner:
        l1_payload["scanner"] = l1.scanner
    if l1.cwe_id:
        l1_payload["cweId"] = l1.cwe_id
    if l1.detail:
        l1_payload["detail"] = l1.detail

    if not l1.passed:
        labels = {
            "riskSource": "Malicious Tool Execution",
            "failureMode": "Cross-Tool Attack Chaining",
            "realWorldHarm": "Privacy & Confidentiality Harm",
        }
        l3 = _l3_localize(
            trajectory,
            diagnostic_only=True,
            step_index=step_index,
            pending_tool=pending_tool,
            labels=labels,
            confidence=float(l1.confidence or 0.97),
        )
        guardrail_payload = {
            "l1": l1_payload,
            "l3": l3,
            "finalDecision": "block",
            "blockedAt": "l1",
        }
        risk = cumulative_for_steps(
            accumulated_steps or [],
            final_guardrail=guardrail_payload,
        )
        return {
            "guardrail": guardrail_payload,
            "status": "blocked",
            "trajectory": trajectory,
            "tool_list": tool_list,
            "elapsedMs": round((time.perf_counter() - started) * 1000, 2),
            "stepIndex": step_index if step_index is not None else 0,
            **risk,
        }

    l2 = evaluate_l2_xai(session_events_text, config)
    l2_passed = l2.prediction == 0
    labels = None
    if l2.risk_source and l2.failure_mode and l2.real_world_harm:
        labels = {
            "riskSource": l2.risk_source,
            "failureMode": l2.failure_mode,
            "realWorldHarm": l2.real_world_harm,
        }

    l2_payload: dict[str, Any] = {
        "passed": l2_passed,
        "latencyMs": l2.latency_ms,
        "tokens": l2.tokens,
        "model": l2.model,
        "confidence": l2.confidence,
        "unsafeProbability": l2.unsafe_probability,
        "reason": l2.reason,
        "analysis": l2.analysis,
    }
    if labels:
        l2_payload["labels"] = labels

    guardrail: dict[str, Any] = {
        "l1": l1_payload,
        "l2": l2_payload,
        "finalDecision": "allow" if l2_passed else "block",
    }

    status: str = "safe" if l2_passed else "blocked"
    if not l2_passed:
        guardrail["blockedAt"] = "l2"
        guardrail["l3"] = _l3_localize(
            trajectory,
            diagnostic_only=False,
            step_index=step_index,
            pending_tool=pending_tool,
            labels=labels,
            confidence=l2.confidence,
        )
        status = "blocked"
    elif l1.rule == "sensitive_path_read":
        status = "suspicious"

    risk = cumulative_for_steps(
        accumulated_steps or [],
        final_guardrail=guardrail,
    )

    return {
        "guardrail": guardrail,
        "status": status,
        "trajectory": trajectory,
        "tool_list": tool_list,
        "reason": l2.reason,
        "prediction": l2.prediction,
        "elapsedMs": round((time.perf_counter() - started) * 1000, 2),
        "stepIndex": step_index if step_index is not None else 0,
        **risk,
    }
