#!/usr/bin/env python3
"""Hook Claude Code: hlídá velikost kontextu relace a šetří tokeny.

Od 200 tis. tokenů upozorní (po každých dalších 10 tis.), od 250 tis. zablokuje další práci kromě
dokončení: git, zápis předávacího promptu do docs/dalsi-session.md a operace na GitHubu.
Velikost kontextu se čte z poslední odpovědi modelu v přepisu relace.
"""
import json
import sys
from pathlib import Path

SOFT_LIMIT = 200_000
HARD_LIMIT = 250_000
STEP = 10_000
HANDOFF_FILE = "docs/dalsi-session.md"


def context_tokens(transcript: str) -> int:
    path = Path(transcript)
    if not path.is_file():
        return 0
    with path.open("rb") as handle:
        handle.seek(0, 2)
        handle.seek(max(0, handle.tell() - 400_000))
        lines = handle.read().decode("utf-8", errors="ignore").splitlines()
    for line in reversed(lines):
        try:
            usage = json.loads(line).get("message", {}).get("usage")
        except (json.JSONDecodeError, AttributeError):
            continue
        if usage:
            return sum(usage.get(key, 0) for key in ("input_tokens", "cache_creation_input_tokens", "cache_read_input_tokens"))
    return 0


def allowed_when_over(event: dict) -> bool:
    tool = event.get("tool_name", "")
    params = event.get("tool_input", {}) or {}
    if tool == "Bash":
        return str(params.get("command", "")).lstrip().startswith("git ")
    if tool in ("Edit", "Write"):
        return str(params.get("file_path", "")).endswith(HANDOFF_FILE)
    return tool.startswith("mcp__github__")


def main() -> int:
    event = json.load(sys.stdin)
    tokens = context_tokens(event.get("transcript_path", ""))
    phase = event.get("hook_event_name")
    if phase == "PreToolUse" and tokens >= HARD_LIMIT and not allowed_when_over(event):
        print(
            f"Limit kontextu {HARD_LIMIT // 1000} tis. tokenů překročen ({tokens // 1000} tis.). "
            f"Dokonči práci: commitni rozpracované změny, zapiš navazující prompt do {HANDOFF_FILE} "
            "a ukonči relaci. Další práce pokračuje v nové relaci.",
            file=sys.stderr,
        )
        return 2
    if phase == "PostToolUse" and SOFT_LIMIT <= tokens < HARD_LIMIT:
        marker = Path("/tmp") / f"limit-kontextu-{event.get('session_id', 'x')}"
        bucket = tokens // STEP
        if not marker.exists() or marker.read_text() != str(bucket):
            marker.write_text(str(bucket))
            print(f"Kontext má {tokens // 1000} tis. tokenů (limit {HARD_LIMIT // 1000} tis.). Směřuj k dokončení.", file=sys.stderr)
            return 2
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
