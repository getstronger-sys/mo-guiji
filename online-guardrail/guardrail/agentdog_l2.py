from __future__ import annotations

import json
import os
import time
import urllib.request
from dataclasses import dataclass
from typing import Any

from guardrail.config import GuardrailConfig
from guardrail.mock_evaluator import mock_evaluate_xai
from guardrail.prompt import AGENTDOG_L2_XAI_PROMPT
from guardrail.risk_scoring import l2_confidence_from_unsafe_prob
from guardrail.trajectory import extract_tool_list, extract_trajectory_text


@dataclass(frozen=True)
class L2XAIResult:
    prediction: int
    reason: str
    analysis: str
    risk_source: str | None
    failure_mode: str | None
    real_world_harm: str | None
    model: str
    tokens: int
    latency_ms: float
    confidence: float = 0.93
    unsafe_probability: float = 0.05
    error: str | None = None


def evaluate_l2_xai(session_events_text: str, config: GuardrailConfig) -> L2XAIResult:
    started = time.perf_counter()
    trajectory = extract_trajectory_text(session_events_text)
    tool_list = extract_tool_list(session_events_text)
    tokens = max(96, len(trajectory) // 4)

    if not trajectory:
        return L2XAIResult(
            prediction=0,
            reason="无轨迹数据",
            analysis="",
            risk_source=None,
            failure_mode=None,
            real_world_harm=None,
            model=config.model,
            tokens=0,
            latency_ms=0,
        )

    if _use_mock(config):
        mock = mock_evaluate_xai(trajectory, config.model)
        unsafe_prob = float(mock.get("unsafe_probability", 0.05))
        confidence = float(mock.get("confidence", l2_confidence_from_unsafe_prob(int(mock["prediction"]), unsafe_prob)))
        return L2XAIResult(
            prediction=mock["prediction"],
            reason=mock["reason"],
            analysis=mock["analysis"],
            risk_source=mock.get("risk_source"),
            failure_mode=mock.get("failure_mode"),
            real_world_harm=mock.get("real_world_harm"),
            model=mock["model"],
            tokens=tokens,
            latency_ms=round((time.perf_counter() - started) * 1000, 2),
            confidence=confidence,
            unsafe_probability=unsafe_prob,
        )

    prompt = AGENTDOG_L2_XAI_PROMPT.format(
        trajectory=trajectory,
        tool_list_text=", ".join(tool_list) if tool_list else "(none)",
    )
    try:
        raw = _call_api(prompt, config)
        content = _extract_content(raw)
        parsed = _parse_xai_response(content)
        unsafe_prob = float(parsed.get("unsafe_probability", 0.88 if parsed["prediction"] == 1 else 0.05))
        if parsed.get("confidence") is not None:
            confidence = float(parsed["confidence"])
            if parsed["prediction"] == 0:
                unsafe_prob = max(0.02, 1.0 - confidence)
            else:
                unsafe_prob = confidence
        else:
            confidence = l2_confidence_from_unsafe_prob(parsed["prediction"], unsafe_prob)
        return L2XAIResult(
            prediction=parsed["prediction"],
            reason=parsed["reason"],
            analysis=parsed.get("analysis", ""),
            risk_source=parsed.get("risk_source"),
            failure_mode=parsed.get("failure_mode"),
            real_world_harm=parsed.get("real_world_harm"),
            model=config.model,
            tokens=tokens,
            latency_ms=round((time.perf_counter() - started) * 1000, 2),
            confidence=confidence,
            unsafe_probability=unsafe_prob,
        )
    except Exception as exc:
        return L2XAIResult(
            prediction=-1,
            reason=f"AgentDoG 调用失败: {exc}",
            analysis="",
            risk_source=None,
            failure_mode=None,
            real_world_harm=None,
            model=config.model,
            tokens=tokens,
            latency_ms=round((time.perf_counter() - started) * 1000, 2),
            error=str(exc),
        )


def _use_mock(config: GuardrailConfig) -> bool:
    if os.environ.get("GUARDRAIL_MOCK", "").lower() in {"1", "true", "yes"}:
        return True
    return not config.api_key or not config.api_base


def _call_api(prompt: str, config: GuardrailConfig) -> dict[str, Any]:
    url = f"{config.api_base.rstrip('/')}/chat/completions"
    body = json.dumps(
        {
            "model": config.model,
            "messages": [{"role": "user", "content": prompt}],
            "temperature": 0.2,
            "max_tokens": 2048,
        }
    ).encode("utf-8")
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {config.api_key}",
    }
    req = urllib.request.Request(url, data=body, headers=headers, method="POST")
    with urllib.request.urlopen(req, timeout=config.timeout_seconds) as resp:
        return json.loads(resp.read().decode("utf-8"))


def _extract_content(response: dict[str, Any]) -> str:
    choices = response.get("choices")
    if not isinstance(choices, list) or not choices:
        raise ValueError("No choices in API response")
    message = choices[0].get("message")
    if not isinstance(message, dict):
        raise ValueError("No message in first choice")
    content = message.get("content")
    if not isinstance(content, str):
        raise ValueError("No content in message")
    return content


def _parse_xai_response(content: str) -> dict[str, Any]:
    text = content.strip()
    if text.startswith("```"):
        lines = text.split("\n", 1)
        text = lines[1] if len(lines) > 1 else text[3:]
        if text.endswith("```"):
            text = text[:-3]
        text = text.strip()
    data = json.loads(text)
    if not isinstance(data, dict):
        raise ValueError("Expected JSON object")
    pred = int(data.get("pred", data.get("prediction", 0)))
    if pred not in (0, 1):
        raise ValueError(f"pred must be 0 or 1, got {pred}")
    return {
        "prediction": pred,
        "reason": str(data.get("reason", "")),
        "analysis": str(data.get("analysis", "")),
        "risk_source": data.get("riskSource") or data.get("risk_source"),
        "failure_mode": data.get("failureMode") or data.get("failure_mode"),
        "real_world_harm": data.get("realWorldHarm") or data.get("real_world_harm"),
        "confidence": data.get("confidence"),
        "unsafe_probability": data.get("unsafeProbability") or data.get("unsafe_probability"),
    }
