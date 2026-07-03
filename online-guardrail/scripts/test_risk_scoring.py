#!/usr/bin/env python3
"""Smoke tests for cumulative risk scoring."""

from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from guardrail.risk_scoring import (  # noqa: E402
    cumulative_for_steps,
    enrich_steps_with_risk,
    step_unsafe_probability,
    update_cumulative_risk,
)


def test_noisy_or_chain() -> None:
    r = 0.0
    for p in [0.05, 0.08, 0.12]:
        r = update_cumulative_risk(r, p)
    assert 0.2 < r < 0.25, r


def test_attack_trajectory_narrative() -> None:
    path = ROOT / "samples" / "trajectories" / "traj-7f3a2b.json"
    data = json.loads(path.read_text(encoding="utf-8"))
    steps = enrich_steps_with_risk(data["steps"])
    risks = [s["cumulativeRisk"] for s in steps]
    assert risks[-1] >= 0.9
    assert risks[0] < 0.08
    assert risks[3] > risks[2]
    print("cumulative risks:", risks)


def test_l1_block_dominates() -> None:
    p = step_unsafe_probability(
        {"passed": False, "confidence": 0.99},
        None,
    )
    assert p >= 0.95


def test_l2_safe_high_confidence() -> None:
    p = step_unsafe_probability(
        {"passed": True, "confidence": 0.99},
        {"passed": True, "confidence": 0.97},
    )
    assert 0.03 < p < 0.08


def test_cumulative_with_final_guardrail() -> None:
    steps = [{"guardrail": {"l1": {"passed": True, "confidence": 0.99}, "l2": {"passed": True, "confidence": 0.97}}}]
    out = cumulative_for_steps(
        steps,
        final_guardrail={"l1": {"passed": False, "confidence": 0.98}, "l3": {}},
    )
    assert out["cumulativeRisk"] >= 0.95


if __name__ == "__main__":
    test_noisy_or_chain()
    test_attack_trajectory_narrative()
    test_l1_block_dominates()
    test_l2_safe_high_confidence()
    test_cumulative_with_final_guardrail()
    print("All risk scoring tests passed.")
