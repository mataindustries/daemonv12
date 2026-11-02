"""Read-only artifact accounting. Never deletes artifacts or changes retention."""
import argparse
import json
import os
import urllib.request
from pathlib import Path

# Decimal MB, deliberately below the user's 500 MB total allowance.
LIMIT = 400_000_000
RESERVE = 64_000_000


def check_total(artifacts):
    total = sum(a["size_in_bytes"] for a in artifacts if not a.get("expired"))
    if total + RESERVE > LIMIT:
        raise RuntimeError(f"Retained artifacts use {total:,} bytes; need {RESERVE:,} more under {LIMIT:,}. "
                           "Download and remove old artifacts manually; nothing was deleted.")
    return {"retainedBytes": total, "gateAReserveBytes": RESERVE, "workingCeilingBytes": LIMIT}


def remote_budget():
    repo = os.environ["GITHUB_REPOSITORY"]
    api = os.environ.get("GITHUB_API_URL", "https://api.github.com")
    artifacts, page = [], 1
    while True:
        req = urllib.request.Request(
            f"{api}/repos/{repo}/actions/artifacts?per_page=100&page={page}",
            headers={"Authorization": "Bearer " + os.environ["GH_TOKEN"],
                     "Accept": "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28"})
        with urllib.request.urlopen(req, timeout=30) as response:
            batch = json.load(response)["artifacts"]
        artifacts.extend(batch)
        if len(batch) < 100:
            break
        page += 1
    return check_total(artifacts)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--output", type=Path)
    ap.add_argument("--directory", type=Path)
    args = ap.parse_args()
    if args.directory:
        size = sum(p.stat().st_size for p in args.directory.rglob("*") if p.is_file())
        print(f"Gate A artifact: {size:,} bytes (reservation {RESERVE:,})")
        if size > RESERVE:
            raise SystemExit("Artifact exceeded reservation; completed frames kept. Do not launch another run before review.")
    else:
        result = remote_budget()
        if args.output:
            args.output.write_text(json.dumps(result, indent=2) + "\n")
        print(json.dumps(result))


if __name__ == "__main__":
    main()

