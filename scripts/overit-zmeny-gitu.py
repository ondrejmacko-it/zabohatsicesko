#!/usr/bin/env python3
"""Kontroluje cesty přidaných nebo upravených souborů v Gitu."""
import argparse
import fnmatch
import subprocess
from pathlib import PurePosixPath

BLOCKED_ROOT_DIRS = {
    "podklady", "pro-annu", ".firemni-podklady", "secrets", "credentials",
    "private", "uploads", "recordings", "transcripts",
}
BLOCKED_NAMES = (
    "*.pem", "*.key", "*.p12", "*.pfx", "*.jks", "*.keystore",
    "credentials*.json", "client_secret*.json", "service-account*.json",
    ".npmrc.local", "settings.local.json", "claude.local.md", ".mcp.local.json",
    "*.sqlite", "*.sqlite3", "*.db", "*.db-wal", "*.db-shm", "*.sqlite-wal",
    "*.sqlite-shm", "*.dump", "*.sql.gz", "zbc_claude_code*.zip",
)
SAFE_ENV_NAMES = {".env.example", ".env.sample"}


def blocked(path):
    parts = PurePosixPath(path.lower()).parts
    name = parts[-1]
    if len(parts) > 1 and parts[0] in BLOCKED_ROOT_DIRS:
        return True
    if len(parts) > 2 and parts[0] == "data" and parts[1] in {"private", "uploads", "recordings"}:
        return True
    if name == ".env" or name.startswith(".env."):
        return name not in SAFE_ENV_NAMES
    return any(fnmatch.fnmatchcase(name, pattern) for pattern in BLOCKED_NAMES)


def git_paths(*args):
    output = subprocess.check_output(["git", *args, "--"])
    return {
        raw.decode("utf-8", errors="surrogateescape")
        for raw in output.split(b"\0") if raw.strip()
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    source = parser.add_mutually_exclusive_group(required=True)
    source.add_argument("--staged", action="store_true")
    source.add_argument("--range", nargs=2, metavar=("BASE", "HEAD"))
    args = parser.parse_args()
    common = ("--name-only", "-z", "--no-renames", "--diff-filter=AMT")
    if args.staged:
        changed = git_paths("diff", "--cached", *common)
    else:
        base, head = args.range
        commits = f"{base}..{head}"
        changed = git_paths("diff", *common, f"{base}...{head}")
        changed |= git_paths("log", "--format=", "-m", *common, commits)
    rejected = sorted(path for path in changed if blocked(path))
    if rejected:
        print("Zakázané cesty v kontrolovaných změnách:")
        for path in rejected:
            print(repr(path))
        return 1
    print("Kontrola citlivých cest prošla.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
