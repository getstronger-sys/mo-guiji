"""AgentDoG fine-grained diagnosis via OpenAI-compatible API.

Uses official prompts from ../AgentDoG/prompts/v1.0/
Outputs: safe/unsafe + Risk Source / Failure Mode / Real World Harm
"""

from __future__ import annotations

import os
import re
import urllib.request
import json
from pathlib import Path
from typing import Any

from guardrail.config import GuardrailConfig
from guardrail.trajectory import extract_tool_list, extract_trajectory_text

_PROMPTS = Path(__file__).resolve().parents[2] / "AgentDoG" / "prompts" / "v1.0"
_RISK_RE = re.compile(r"attacker|curl\s+.*file=|rm\s+-rf", re.I)


def _read_prompt(name: str) -> str:
    path = _PROMPTS / name
    if path.exists():
        return path.read_text(encoding="utf-8")
    raise FileNotFoundError(f"AgentDoG prompt not found: {path}")


def _call_api(prompt: str, config: GuardrailConfig) -> str:
    if not config.api_base or not config.api_key:
        raise ValueError("GUARDRAIL_API_BASE and GUARDRAIL_API_KEY required")
    url = f"{config.api_base.rstrip('/')}/chat/completions"
    body = json.dumps(
        {
            "model": config.model,
            "messages": [{"role": "user", "content": prompt}],
            "temperature": 0.2,
            "max_tokens": 512,
        }
    ).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=body,
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {config.api_key}",
        },
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=config.timeout_seconds) as resp:
        data = json.loads(resp.read().decode("utf-8"))
    choices = data.get("choices") or []
    return choices[0]["message"]["content"]


def _parse_finegrained(content: str) -> dict[str, Any]:
    lines = [ln.strip() for ln in content.strip().splitlines() if ln.strip()]
    verdict = lines[0].lower() if lines else "safe"
    unsafe = verdict == "unsafe"
    out: dict[str, Any] = {
        "verdict": "unsafe" if unsafe else "safe",
        "prediction": 1 if unsafe else 0,
        "raw": content,
    }
    if unsafe:
        for line in lines[1:]:
            if line.lower().startswith("risk source:"):
                out["riskSource"] = line.split(":", 1)[1].strip()
            elif line.lower().startswith("failure mode:"):
                out["failureMode"] = line.split(":", 1)[1].strip()
            elif line.lower().startswith("real world harm:"):
                out["realWorldHarm"] = line.split(":", 1)[1].strip()
    return out


def mock_finegrained(trajectory: str) -> dict[str, Any]:
    if _RISK_RE.search(trajectory):
        return {
            "verdict": "unsafe",
            "prediction": 1,
            "riskSource": "Malicious Tool Execution",
            "failureMode": "Cross-Tool Attack Chaining",
            "realWorldHarm": "Privacy & Confidentiality Harm",
            "raw": "unsafe\nRisk Source: Malicious Tool Execution\n...",
            "model": "mock",
        }
    return {"verdict": "safe", "prediction": 0, "raw": "safe", "model": "mock"}


def evaluate_finegrained(session_events_text: str, config: GuardrailConfig) -> dict[str, Any]:
    trajectory = extract_trajectory_text(session_events_text)
    tool_list = extract_tool_list(session_events_text)
    tool_text = ", ".join(tool_list) if tool_list else "(none)"
    full_text = f"{trajectory}\n\n<Available Tools>\n{tool_text}\n</Available Tools>"

    use_mock = os.environ.get("GUARDRAIL_MOCK", "").lower() in {"1", "true", "yes"} or (
        not config.api_key or not config.api_base
    )
    if use_mock:
        result = mock_finegrained(full_text)
        result["model"] = f"{config.model} (mock)"
        return result

    template = _read_prompt("trajectory_finegrained.txt")
    taxonomy = _read_prompt("taxonomy_finegrained.txt")
    prompt = template.format(trajectory=full_text, taxonomy=taxonomy)
    content = _call_api(prompt, config)
    parsed = _parse_finegrained(content)
    parsed["model"] = config.model
    return parsed
