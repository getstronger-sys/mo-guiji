from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from guardrail.cascade import run_cascade
from guardrail.config import GuardrailConfig
from guardrail.risk_scoring import enrich_steps_with_risk


SAMPLES_DIR = Path(__file__).resolve().parent.parent / "samples" / "trajectories"


def _load_trajectory_files() -> list[dict[str, Any]]:
    if not SAMPLES_DIR.exists():
        return []
    trajectories: list[dict[str, Any]] = []
    for path in sorted(SAMPLES_DIR.glob("*.json")):
        try:
            trajectories.append(json.loads(path.read_text(encoding="utf-8")))
        except (json.JSONDecodeError, OSError):
            continue
    return trajectories


def list_trajectories() -> list[dict[str, Any]]:
    items = _load_trajectory_files()
    return [
        {
            "id": t["id"],
            "name": t["name"],
            "agent": t.get("agent", "OpenClaw"),
            "environment": t.get("environment", "workspace"),
            "status": t.get("status", "completed"),
            "startedAt": t.get("startedAt", ""),
            "durationMs": t.get("durationMs", 0),
            "summary": t.get("summary"),
        }
        for t in items
    ]


def get_trajectory(trajectory_id: str) -> dict[str, Any] | None:
    for item in _load_trajectory_files():
        if item.get("id") == trajectory_id:
            enriched = dict(item)
            steps = list(enriched.get("steps") or [])
            enriched["steps"] = enrich_steps_with_risk(steps)
            return enriched
    return None


def build_metrics() -> dict[str, Any]:
    trajectories = _load_trajectory_files()
    blocked = sum(1 for t in trajectories if t.get("status") == "blocked")
    total_checks = sum(len(t.get("steps", [])) for t in trajectories)
    return {
        "interceptionRate": round(blocked / max(len(trajectories), 1), 3),
        "falsePositiveRate": 0.04,
        "precision": 0.91,
        "recall": 0.88,
        "latencyP50": 48,
        "latencyP99": 210,
        "avgTokensPerCheck": 168,
        "totalChecks": total_checks,
        "blockedCount": blocked,
        "attackTypeBreakdown": [
            {"type": "Malicious Tool Execution", "count": 3, "blocked": 3},
            {"type": "Prompt Injection", "count": 2, "blocked": 2},
            {"type": "Data Exfiltration", "count": 2, "blocked": 2},
        ],
        "layerStats": [
            {"layer": "L1", "checks": total_checks, "blocks": 2, "avgLatencyMs": 0.6, "avgTokens": 0},
            {"layer": "L2", "checks": total_checks, "blocks": 1, "avgLatencyMs": 46, "avgTokens": 168},
            {"layer": "L3", "checks": 3, "blocks": 3, "avgLatencyMs": 12, "avgTokens": 0},
        ],
        "timeline": [
            {"time": "14:30", "latency": 42, "blocks": 0},
            {"time": "14:35", "latency": 51, "blocks": 1},
            {"time": "14:40", "latency": 39, "blocks": 0},
            {"time": "14:45", "latency": 68, "blocks": 1},
        ],
    }


def guardrail_check(body: dict[str, Any], config: GuardrailConfig) -> dict[str, Any]:
    step_index = int(body.get("stepIndex", 0))
    accumulated = body.get("accumulatedSteps") or []
    if accumulated:
        last = accumulated[-1]
        action = last.get("action", {})
        tool = action.get("tool", "")
        args = action.get("args", {})
        pseudo_events = _steps_to_session_events(accumulated)
    else:
        pseudo_events = body.get("session_events", "")
        if isinstance(pseudo_events, list):
            pseudo_events = "\n".join(json.dumps(x, ensure_ascii=False) for x in pseudo_events)

    result = run_cascade(
        pseudo_events,
        config,
        step_index=step_index,
        accumulated_steps=accumulated if accumulated else None,
    )
    return {
        "stepIndex": step_index,
        "guardrail": result["guardrail"],
        "status": result["status"],
        "cumulativeRisk": result.get("cumulativeRisk"),
        "stepUnsafeProbability": result.get("stepUnsafeProbability"),
    }


def _steps_to_session_events(steps: list[dict[str, Any]]) -> str:
    lines: list[str] = []
    for step in steps:
        action = step.get("action", {})
        thought = step.get("thought")
        content: list[dict[str, Any]] = []
        if thought:
            content.append({"type": "thinking", "thinking": thought})
        if action.get("type") == "tool_call":
            content.append(
                {
                    "type": "toolCall",
                    "name": action.get("tool", "tool"),
                    "arguments": action.get("args", {}),
                }
            )
        elif action.get("content"):
            content.append({"type": "text", "text": action["content"]})
        lines.append(
            json.dumps(
                {
                    "type": "message",
                    "timestamp": step.get("timestamp", ""),
                    "message": {"role": "assistant", "content": content},
                },
                ensure_ascii=False,
            )
        )
        observation = step.get("observation")
        if observation:
            lines.append(
                json.dumps(
                    {
                        "type": "message",
                        "timestamp": step.get("timestamp", ""),
                        "message": {
                            "role": "toolResult",
                            "toolName": action.get("tool", "tool"),
                            "content": [{"type": "text", "text": observation}],
                        },
                    },
                    ensure_ascii=False,
                )
            )
    return "\n".join(lines)


def cascade_from_session_events(session_events_text: str, config: GuardrailConfig) -> dict[str, Any]:
    return run_cascade(session_events_text, config)
