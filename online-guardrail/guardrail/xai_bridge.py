"""Bridge GuardTrace trajectories ↔ AgentDoG AgenticXAI attribution.

Official repo: AI45Lab/AgentDoG/AgenticXAI
  - component_attri.py  → trajectory-level Δ_i (llr_score per step)
  - sentence_attri.py   → sentence-level Drop + Hold on top-K steps

Real attribution needs a local AgentDoG checkpoint + GPU (transformers).
Mock mode uses keyword heuristics for demo without weights.
"""

from __future__ import annotations

import json
import os
import re
import subprocess
import sys
import tempfile
from pathlib import Path
from typing import Any

_AGENTDOG_ROOT = Path(__file__).resolve().parents[2] / "AgentDoG"
_XAI_DIR = _AGENTDOG_ROOT / "AgenticXAI"
_SAMPLES = Path(__file__).resolve().parents[1] / "samples" / "xai"

_RISK_KEYWORDS = re.compile(
    r"attacker|evil\.com|curl\s+.*file=|rm\s+-rf|api_key|sk-live|password|secret|\.env",
    re.I,
)


def agentdog_repo_path() -> Path:
    return _AGENTDOG_ROOT


def xai_scripts_available() -> bool:
    return (_XAI_DIR / "component_attri.py").exists()


def steps_to_xai_trajectory(steps: list[dict[str, Any]]) -> list[dict[str, str]]:
    """Convert GuardTrace accumulated steps to AgenticXAI message list."""
    messages: list[dict[str, str]] = []
    for step in steps:
        thought = step.get("thought") or ""
        action = step.get("action") or {}
        obs = step.get("observation") or ""
        atype = action.get("type", "message")

        if atype == "tool_call":
            tool = action.get("tool", "tool")
            args = action.get("args") or {}
            content_parts = []
            if thought:
                content_parts.append(f"Thought: {thought}")
            content_parts.append(f"Action: {tool}({json.dumps(args, ensure_ascii=False)})")
            messages.append({"role": "agent", "content": "\n".join(content_parts)})
        elif action.get("content"):
            text = action["content"]
            if thought:
                text = f"Thought: {thought}\n{text}"
            messages.append({"role": "agent", "content": str(text)})
        elif thought:
            messages.append({"role": "agent", "content": f"Thought: {thought}"})

        if obs:
            messages.append(
                {
                    "role": "environment",
                    "content": str(obs)[:2000],
                }
            )

    if not messages:
        messages.append({"role": "agent", "content": "(empty trajectory)"})
    return messages


def _heuristic_llr(text: str, step_index: int, total: int) -> float:
    hits = len(_RISK_KEYWORDS.findall(text))
    position_boost = (step_index / max(total, 1)) * 0.15
    return hits * 0.35 + position_boost


def mock_trajectory_attribution(
    steps: list[dict[str, Any]],
    *,
    target_step_index: int | None = None,
) -> dict[str, Any]:
    """Demo attribution without loading AgentDoG weights."""
    traj = steps_to_xai_trajectory(steps)
    if not traj:
        return {"trajectory_analysis": [], "top_steps": [], "mode": "mock"}

    target = traj[-1]
    history = traj[:-1]
    results: list[dict[str, Any]] = []
    prev_llr = 0.0

    for k in range(len(history) + 1):
        if k == 0:
            llr = 0.0
            role = "START"
            preview = "Empty Context"
        else:
            event = history[k - 1]
            llr = _heuristic_llr(event.get("content", ""), k, len(history))
            role = event.get("role", "?")
            preview = event.get("content", "")[:80].replace("\n", " ")

        prob_diff = llr - prev_llr
        results.append(
            {
                "step_index": k,
                "traj_index": k - 1 if k > 0 else None,
                "event_role": role,
                "event_content_preview": preview,
                "metrics": {
                    "llr_score": round(llr, 4),
                    "prob_diff": round(prob_diff, 4),
                    "avg_log_prob": round(-2.0 + llr, 4),
                    "raw_prob": round(min(0.99, 0.1 + llr), 4),
                },
            }
        )
        prev_llr = llr

    ranked = sorted(
        [r for r in results if r["step_index"] > 0],
        key=lambda x: x["metrics"]["llr_score"],
        reverse=True,
    )
    top_steps = ranked[:3]

    sentence_attr: list[dict[str, Any]] = []
    for item in top_steps:
        t_idx = item.get("traj_index")
        if t_idx is None or t_idx < 0 or t_idx >= len(traj):
            continue
        content = traj[t_idx].get("content", "")
        sents = [s.strip() for s in re.split(r"(?<=[.!?])\s+|\n", content) if s.strip()]
        if not sents:
            continue
        sent_scores = []
        for i, sent in enumerate(sents):
            score = _heuristic_llr(sent, i + 1, len(sents))
            sent_scores.append(
                {
                    "sentence_index": i,
                    "text": sent,
                    "scores": {
                        "drop_score": round(score * 0.6, 4),
                        "hold_score": round(score * 0.4, 4),
                        "total_score": round(score, 4),
                    },
                }
            )
        sentence_attr.append(
            {
                "step_index": item["step_index"],
                "traj_index": t_idx,
                "role": traj[t_idx].get("role", "agent"),
                "original_content": content,
                "sentence_analysis": sorted(
                    sent_scores, key=lambda x: x["scores"]["total_score"], reverse=True
                ),
            }
        )

    argmax_step = top_steps[0]["step_index"] if top_steps else 0
    if target_step_index is not None:
        argmax_step = target_step_index

    return {
        "mode": "mock",
        "target_preview": target.get("content", "")[:200],
        "trajectory_analysis": results,
        "top_steps": [
            {
                "step_index": t["step_index"],
                "traj_index": t.get("traj_index"),
                "llr_score": t["metrics"]["llr_score"],
                "role": t["event_role"],
                "preview": t["event_content_preview"],
            }
            for t in top_steps
        ],
        "argmax_step_index": argmax_step,
        "sentence_attribution": sentence_attr,
    }


def run_component_attribution_subprocess(
    model_id: str,
    trajectory_payload: dict[str, Any],
    *,
    timeout_seconds: int = 600,
) -> dict[str, Any]:
    """Run official component_attri.py (requires torch + GPU + model weights)."""
    if not xai_scripts_available():
        raise FileNotFoundError(
            f"AgentDoG AgenticXAI not found at {_XAI_DIR}. "
            "Clone https://github.com/AI45Lab/AgentDoG next to online-guardrail."
        )

    with tempfile.TemporaryDirectory() as tmp:
        data_dir = Path(tmp) / "data"
        out_dir = Path(tmp) / "results"
        data_dir.mkdir()
        out_dir.mkdir()
        sample_path = data_dir / "request.json"
        sample_path.write_text(json.dumps(trajectory_payload, ensure_ascii=False), encoding="utf-8")

        cmd = [
            sys.executable,
            str(_XAI_DIR / "component_attri.py"),
            "--model_id",
            model_id,
            "--data_dir",
            str(data_dir),
            "--output_dir",
            str(out_dir),
        ]
        proc = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout_seconds)
        if proc.returncode != 0:
            raise RuntimeError(
                f"component_attri failed (code {proc.returncode}): {proc.stderr[-2000:]}"
            )

        outputs = list(out_dir.glob("*_attr_trajectory.json"))
        if not outputs:
            raise RuntimeError("component_attri produced no output JSON")
        return json.loads(outputs[0].read_text(encoding="utf-8"))


def attribute_trajectory(
    steps: list[dict[str, Any]],
    *,
    step_index: int | None = None,
    model_id: str | None = None,
) -> dict[str, Any]:
    """Entry point for HTTP API."""
    model_id = model_id or os.environ.get("AGENTDOG_XAI_MODEL_ID", "").strip()
    use_mock = os.environ.get("GUARDRAIL_MOCK", "").lower() in {"1", "true", "yes"}

    if not use_mock and model_id:
        try:
            payload = {"trajectory": steps_to_xai_trajectory(steps)}
            raw = run_component_attribution_subprocess(model_id, payload)
            analysis = raw.get("trajectory_analysis", [])
            ranked = sorted(
                [a for a in analysis if a.get("step_index", 0) > 0],
                key=lambda x: x.get("metrics", {}).get("llr_score", 0),
                reverse=True,
            )
            return {
                "mode": "agentdog-xai",
                "model": model_id,
                "meta_info": raw.get("meta_info", {}),
                "trajectory_analysis": analysis,
                "top_steps": [
                    {
                        "step_index": r["step_index"],
                        "traj_index": r["step_index"] - 1,
                        "llr_score": r.get("metrics", {}).get("llr_score", 0),
                        "role": r.get("event_role"),
                        "preview": r.get("event_content_preview"),
                    }
                    for r in ranked[:3]
                ],
                "argmax_step_index": ranked[0]["step_index"] if ranked else step_index,
            }
        except Exception as exc:
            mock = mock_trajectory_attribution(steps, target_step_index=step_index)
            mock["fallback_reason"] = str(exc)
            return mock

    return mock_trajectory_attribution(steps, target_step_index=step_index)


def load_sample_attribution(name: str = "exfil-chain") -> dict[str, Any] | None:
    path = _SAMPLES / f"{name}.json"
    if path.exists():
        return json.loads(path.read_text(encoding="utf-8"))
    return None
