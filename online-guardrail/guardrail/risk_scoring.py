"""Step-level and cumulative risk scoring for GuardTrace.

Cumulative risk uses a noisy-OR update over per-step unsafe probabilities:

    R_i = 1 - (1 - R_{i-1}) * (1 - p_i)

where p_i combines L1/L2 signals for step i.
"""

from __future__ import annotations

from typing import Any


def l1_unsafe_probability(l1: dict[str, Any] | None) -> float:
    if not l1:
        return 0.02

    passed = bool(l1.get("passed", True))
    confidence = l1.get("confidence")
    rule = str(l1.get("rule") or "")
    severity = str(l1.get("severity") or ("warn" if rule == "sensitive_path_read" else "block"))

    if not passed:
        return float(confidence if confidence is not None else 0.97)

    if rule == "sensitive_path_read" or severity == "warn":
        conf = float(confidence if confidence is not None else 0.72)
        return min(0.45, max(0.15, (1.0 - conf) * 0.85 + 0.12))

    conf = float(confidence if confidence is not None else 0.99)
    return max(0.02, (1.0 - conf) * 0.5)


def l2_unsafe_probability(l2: dict[str, Any] | None) -> float | None:
    if not l2:
        return None

    if l2.get("unsafeProbability") is not None:
        return float(l2["unsafeProbability"])

    passed = l2.get("passed")
    confidence = l2.get("confidence")

    if passed is False or l2.get("prediction") == 1:
        if confidence is not None:
            return float(confidence)
        return 0.88

    if confidence is not None:
        return max(0.02, 1.0 - float(confidence))

    return 0.05


def step_unsafe_probability(
    l1: dict[str, Any] | None,
    l2: dict[str, Any] | None,
) -> float:
    p1 = l1_unsafe_probability(l1)
    p2 = l2_unsafe_probability(l2)
    if p2 is None:
        return p1
    return 1.0 - (1.0 - p1) * (1.0 - p2)


def update_cumulative_risk(previous: float, step_p: float) -> float:
    prev = max(0.0, min(1.0, previous))
    step = max(0.0, min(1.0, step_p))
    return 1.0 - (1.0 - prev) * (1.0 - step)


def l2_confidence_from_unsafe_prob(prediction: int, unsafe_prob: float) -> float:
    """Confidence in the predicted class (safe vs unsafe)."""
    p = max(0.0, min(1.0, unsafe_prob))
    if prediction == 1:
        return p
    return 1.0 - p


def score_guardrail_dict(guardrail: dict[str, Any]) -> dict[str, float]:
    l1 = guardrail.get("l1") or {}
    l2 = guardrail.get("l2")
    step_p = step_unsafe_probability(l1, l2)
    return {
        "stepUnsafeProbability": round(step_p, 4),
    }


def enrich_steps_with_risk(steps: list[dict[str, Any]]) -> list[dict[str, Any]]:
    cumulative = 0.0
    for step in steps:
        guardrail = step.get("guardrail") or {}
        step_p = step_unsafe_probability(guardrail.get("l1"), guardrail.get("l2"))
        cumulative = update_cumulative_risk(cumulative, step_p)
        step["stepUnsafeProbability"] = round(step_p, 4)
        step["cumulativeRisk"] = round(cumulative, 4)
    return steps


def cumulative_for_steps(
    steps: list[dict[str, Any]],
    *,
    final_guardrail: dict[str, Any] | None = None,
) -> dict[str, float]:
    cumulative = 0.0
    last_step_p = 0.0
    for i, step in enumerate(steps):
        if final_guardrail is not None and i == len(steps) - 1:
            guardrail = final_guardrail
        else:
            guardrail = step.get("guardrail") or {}
        last_step_p = step_unsafe_probability(guardrail.get("l1"), guardrail.get("l2"))
        cumulative = update_cumulative_risk(cumulative, last_step_p)
    return {
        "stepUnsafeProbability": round(last_step_p, 4),
        "cumulativeRisk": round(cumulative, 4),
    }
