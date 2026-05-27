#!/usr/bin/env python3
"""Export markdown summary from bake-off JSON results."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent
DEFAULT_INPUT = ROOT / "reports" / "bakeoff-results.json"
DEFAULT_OUTPUT = ROOT / "reports" / "v2-bakeoff-summary.md"

V2_TARGETS = {
    "auto_precision": 0.85,
    "show_recall": 0.70,
}


def load_results(path: Path) -> dict:
    with path.open(encoding="utf-8") as handle:
        return json.load(handle)


def passes_targets(summary: dict) -> bool:
    return (
        summary.get("mean_auto_precision", 0) >= V2_TARGETS["auto_precision"]
        and summary.get("mean_show_recall", 0) >= V2_TARGETS["show_recall"]
    )


def pick_winner(results: dict) -> dict | None:
    ranked = []
    for entry in results.get("candidates", []):
        summary = entry.get("summary", {})
        ranked.append(
            (
                passes_targets(summary),
                summary.get("mean_auto_precision", 0),
                summary.get("mean_show_recall", 0),
                summary.get("candidate_id"),
                summary,
            )
        )
    if not ranked:
        return None
    ranked.sort(reverse=True)
    return ranked[0][4]


def render_markdown(results: dict) -> str:
    lines = [
        "# GourmetOS V2 Grocery Vision Bake-off",
        "",
        f"Fixtures only: **{results.get('fixtures_only', False)}**",
        "",
        "## Targets",
        "",
        f"- Auto-select precision ≥ {int(V2_TARGETS['auto_precision'] * 100)}%",
        f"- Show recall ≥ {int(V2_TARGETS['show_recall'] * 100)}%",
        "",
        "## Candidates",
        "",
        "| Candidate | Show P | Show R | Auto P | Auto R | Size (MB) | Pass |",
        "|-----------|--------|--------|--------|--------|-----------|------|",
    ]

    for entry in results.get("candidates", []):
        s = entry.get("summary", {})
        ok = "yes" if passes_targets(s) else "no"
        size = s.get("model_size_mb")
        size_str = str(size) if size is not None else "—"
        lines.append(
            f"| {s.get('candidate_name', s.get('candidate_id'))} "
            f"| {s.get('mean_show_precision', 0):.2f} "
            f"| {s.get('mean_show_recall', 0):.2f} "
            f"| {s.get('mean_auto_precision', 0):.2f} "
            f"| {s.get('mean_auto_recall', 0):.2f} "
            f"| {size_str} "
            f"| {ok} |"
        )

    winner = pick_winner(results)
    lines.extend(["", "## Winner", ""])
    if winner:
        lines.append(
            f"**{winner.get('candidate_name')}** (`{winner.get('candidate_id')}`) — "
            f"auto precision {winner.get('mean_auto_precision', 0):.2f}, "
            f"show recall {winner.get('mean_show_recall', 0):.2f}."
        )
    else:
        lines.append("No candidate evaluated.")

    lines.extend(
        [
            "",
            "## Per-case errors",
            "",
        ]
    )

    for entry in results.get("candidates", []):
        cid = entry.get("summary", {}).get("candidate_id")
        lines.append(f"### {cid}")
        for case in entry.get("cases", []):
            if not case.get("false_positives") and not case.get("false_negatives"):
                continue
            lines.append(
                f"- `{case['id']}` FP: {case.get('false_positives') or '—'} "
                f"FN: {case.get('false_negatives') or '—'}"
            )
        lines.append("")

    return "\n".join(lines).strip() + "\n"


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", type=Path, default=DEFAULT_INPUT)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    args = parser.parse_args()

    if not args.input.exists():
        raise SystemExit(f"Missing results: {args.input}. Run evaluate.py first.")

    results = load_results(args.input)
    markdown = render_markdown(results)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(markdown, encoding="utf-8")
    print(f"Wrote {args.output}")


if __name__ == "__main__":
    main()
