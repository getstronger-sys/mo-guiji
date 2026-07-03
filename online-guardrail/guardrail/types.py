from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class GuardrailResult:
    prediction: int  # 0=safe, 1=unsafe, -1=error
    reason: str
    raw_response: str
    model: str
    error: str | None
