"""Bridge to Meta CodeShield / ICD (Insecure Code Detector).

Tier 1 — ICD regex rules from PurpleLlama (no semgrep required).
Tier 2 — Full CodeShield scan with Semgrep when installed (optional).

Set GUARDRAIL_CODE_SHIELD=0 to disable. Set GUARDRAIL_CODE_SHIELD_FULL=1 to
force Tier-2 Semgrep when available.
"""

from __future__ import annotations

import asyncio
import logging
import os
import re
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any

LOG = logging.getLogger(__name__)

_EXT_TO_LANG: dict[str, str] = {
    ".py": "python",
    ".js": "javascript",
    ".ts": "javascript",
    ".jsx": "javascript",
    ".tsx": "javascript",
    ".java": "java",
    ".php": "php",
    ".rb": "ruby",
    ".rs": "rust",
    ".c": "c",
    ".h": "c",
    ".cpp": "cpp",
    ".cc": "cpp",
    ".cs": "csharp",
    ".go": "go",
    ".sql": "sql",
    ".sh": "shell",
    ".bash": "shell",
}


@dataclass(frozen=True)
class CodeScanHit:
    insecure: bool
    tier: str  # "regex" | "semgrep" | "builtin"
    cwe_id: str | None = None
    description: str | None = None
    line: int | None = None
    language: str | None = None
    latency_ms: float = 0.0


def _purple_llama_root() -> Path | None:
    env = os.environ.get("PURPLELLAMA_PATH")
    if env:
        p = Path(env)
        if (p / "CodeShield").is_dir():
            return p
    here = Path(__file__).resolve()
    for parent in here.parents:
        candidate = parent / "PurpleLlama"
        if (candidate / "CodeShield").is_dir():
            return candidate
    return None


def _icd_regex_dir() -> Path | None:
    root = _purple_llama_root()
    if not root:
        return None
    rules = root / "CodeShield" / "insecure_code_detector" / "rules" / "regex"
    return rules if rules.is_dir() else None


def _detect_language(code: str, path_hint: str | None) -> str | None:
    if path_hint:
        ext = Path(path_hint).suffix.lower()
        if ext in _EXT_TO_LANG:
            return _EXT_TO_LANG[ext]
    sample = code.strip()[:2000].lower()
    if "def " in sample or "import " in sample or "exec(" in sample:
        return "python"
    if "function " in sample or "const " in sample or "=>" in sample:
        return "javascript"
    if "SELECT " in code.upper() or "INSERT " in code.upper():
        return "sql"
    if sample.startswith("#!") or "curl " in sample or "rm -" in sample:
        return "shell"
    return None


def _load_yaml_patterns(path: Path) -> list[dict[str, Any]]:
    try:
        import yaml  # type: ignore[import-untyped]
    except ImportError:
        return []
    try:
        data = yaml.safe_load(path.read_text(encoding="utf-8"))
    except OSError:
        return []
    if not isinstance(data, list):
        return []
    out: list[dict[str, Any]] = []
    for item in data:
        if isinstance(item, dict) and item.get("rule"):
            out.append(item)
    return out


def _is_comment_line(line: str) -> bool:
    s = line.strip()
    return s.startswith("#") or s.startswith("//") or s.startswith("/*") or s.endswith("*/")


def _regex_scan_rule(pattern: str, code: str, meta: dict[str, Any]) -> CodeScanHit | None:
    try:
        match = re.search(pattern, code, re.MULTILINE)
    except re.error:
        return None
    if not match:
        return None
    line_no = code[: match.start()].count("\n") + 1
    lines = code.splitlines()
    if 0 < line_no <= len(lines) and _is_comment_line(lines[line_no - 1]):
        return None
    return CodeScanHit(
        insecure=True,
        tier="regex",
        cwe_id=str(meta.get("cwe_id", "")) or None,
        description=str(meta.get("description", "insecure code pattern")),
        line=line_no,
    )


def _scan_icd_regex(code: str, language: str | None) -> CodeScanHit | None:
    rules_dir = _icd_regex_dir()
    if not rules_dir:
        return None

    files: list[Path] = [rules_dir / "language_agnostic.yaml"]
    if language and language not in ("shell", "sql", "go"):
        lang_file = rules_dir / f"{language}.yaml"
        if lang_file.exists():
            files.append(lang_file)

    for ypath in files:
        for meta in _load_yaml_patterns(ypath):
            hit = _regex_scan_rule(str(meta["rule"]), code, meta)
            if hit:
                return CodeScanHit(
                    insecure=True,
                    tier="regex",
                    cwe_id=hit.cwe_id,
                    description=hit.description,
                    line=hit.line,
                    language=language,
                )
    return None


def _scan_builtin_patterns(code: str, patterns: list[dict[str, str]]) -> CodeScanHit | None:
    for entry in patterns:
        pattern = entry.get("pattern", "")
        if not pattern:
            continue
        try:
            if re.search(pattern, code, re.IGNORECASE | re.MULTILINE):
                return CodeScanHit(
                    insecure=True,
                    tier="builtin",
                    cwe_id=entry.get("cwe_id"),
                    description=entry.get("description", "insecure code pattern"),
                )
        except re.error:
            continue
    return None


def _try_codeshield_full(code: str, language: str | None) -> CodeScanHit | None:
    if os.environ.get("GUARDRAIL_CODE_SHIELD_FULL", "0") != "1":
        return None
    root = _purple_llama_root()
    if not root:
        return None
    root_str = str(root)
    if root_str not in sys.path:
        sys.path.insert(0, root_str)
    try:
        from CodeShield.codeshield import CodeShield  # type: ignore[import-untyped]
        from CodeShield.insecure_code_detector.languages import Language  # type: ignore[import-untyped]

        lang_enum = None
        if language:
            try:
                lang_enum = Language[language.upper()]
            except KeyError:
                lang_enum = None

        result = asyncio.run(CodeShield.scan_code(code, lang_enum))
        if result.is_insecure and result.issues_found:
            issue = result.issues_found[0]
            return CodeScanHit(
                insecure=True,
                tier="semgrep",
                cwe_id=getattr(issue, "cwe_id", None),
                description=getattr(issue, "description", None),
                line=getattr(issue, "line", None),
                language=language,
            )
    except Exception as exc:
        LOG.debug("CodeShield full scan unavailable: %s", exc)
    return None


def codeshield_available() -> dict[str, Any]:
    root = _purple_llama_root()
    regex_dir = _icd_regex_dir()
    full = False
    if root:
        try:
            import semgrep  # noqa: F401

            full = True
        except ImportError:
            pass
    return {
        "purple_llama": str(root) if root else None,
        "icd_regex_rules": str(regex_dir) if regex_dir else None,
        "semgrep_installed": full,
        "enabled": os.environ.get("GUARDRAIL_CODE_SHIELD", "1") != "0",
    }


def scan_generated_code(
    code: str,
    *,
    path_hint: str | None = None,
    builtin_patterns: list[dict[str, str]] | None = None,
) -> CodeScanHit | None:
    """Scan a code snippet. Returns first hit or None."""
    import time

    if os.environ.get("GUARDRAIL_CODE_SHIELD", "1") == "0":
        return None
    if not code or len(code.strip()) < 4:
        return None

    started = time.perf_counter()
    language = _detect_language(code, path_hint)

    hit = _scan_icd_regex(code, language)
    if hit is None and builtin_patterns:
        hit = _scan_builtin_patterns(code, builtin_patterns)
    if hit is None:
        hit = _try_codeshield_full(code, language)
    if hit is None:
        return None

    elapsed = round((time.perf_counter() - started) * 1000, 3)
    return CodeScanHit(
        insecure=hit.insecure,
        tier=hit.tier,
        cwe_id=hit.cwe_id,
        description=hit.description,
        line=hit.line,
        language=language,
        latency_ms=elapsed,
    )
