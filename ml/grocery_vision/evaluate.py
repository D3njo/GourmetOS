#!/usr/bin/env python3
"""Evaluate grocery vision model candidates against labeled fridge photos."""

from __future__ import annotations

import argparse
import json
import time
from pathlib import Path
from typing import Any

try:
    import yaml
except ImportError:  # pragma: no cover
    yaml = None  # type: ignore

ROOT = Path(__file__).resolve().parent
REPO = ROOT.parents[1]
TEST_PHOTOS = ROOT / "test_photos"
IMAGES_DIR = TEST_PHOTOS / "images"
EXPECTED_DIR = TEST_PHOTOS / "expected"
FIXTURES_DIR = ROOT / "fixtures"
REPORTS_DIR = ROOT / "reports"
AUTO_SELECT_THRESHOLD = 0.74
SHOW_THRESHOLD = 0.42


def load_yaml(path: Path) -> dict[str, Any]:
    if yaml is None:
        raise SystemExit("PyYAML required: pip install pyyaml")
    with path.open(encoding="utf-8") as handle:
        return yaml.safe_load(handle)


def target_classes(labels: dict[str, Any]) -> list[str]:
    return [item["id"] for item in labels.get("classes", [])]


def load_expected_cases() -> list[dict[str, Any]]:
    cases: list[dict[str, Any]] = []
    if not EXPECTED_DIR.exists():
        return cases
    for path in sorted(EXPECTED_DIR.glob("*.json")):
        with path.open(encoding="utf-8") as handle:
            payload = json.load(handle)
        image_name = payload.get("image") or f"{path.stem}.jpg"
        cases.append(
            {
                "id": path.stem,
                "image": image_name,
                "image_path": IMAGES_DIR / image_name,
                "contains": [str(x).lower() for x in payload.get("contains", [])],
                "optional": [str(x).lower() for x in payload.get("optional", [])],
                "notes": payload.get("notes", ""),
            }
        )
    return cases


def load_fixture_predictions(candidate_id: str) -> dict[str, list[dict[str, Any]]]:
    path = FIXTURES_DIR / "predictions.json"
    if not path.exists():
        return {}
    with path.open(encoding="utf-8") as handle:
        data = json.load(handle)
    return data.get(candidate_id, {})


def precision_recall(
    predicted: set[str], expected: set[str]
) -> tuple[float, float, list[str], list[str]]:
    if not predicted and not expected:
        return 1.0, 1.0, [], []
    tp = predicted & expected
    fp = sorted(predicted - expected)
    fn = sorted(expected - predicted)
    precision = len(tp) / len(predicted) if predicted else 0.0
    recall = len(tp) / len(expected) if expected else 1.0
    return precision, recall, fp, fn


def score_case(
    case: dict[str, Any],
    predictions: list[dict[str, Any]],
) -> dict[str, Any]:
    expected = set(case["contains"])
    optional = set(case.get("optional", []))
    shown = {
        p["ingredient"]
        for p in predictions
        if float(p.get("confidence", 0)) >= SHOW_THRESHOLD
    }
    auto = {
        p["ingredient"]
        for p in predictions
        if float(p.get("confidence", 0)) >= AUTO_SELECT_THRESHOLD
    }

    show_p, show_r, show_fp, show_fn = precision_recall(shown, expected)
    auto_p, auto_r, auto_fp, auto_fn = precision_recall(auto, expected)

    optional_hits = sorted(shown & optional)

    return {
        "id": case["id"],
        "image": case["image"],
        "expected": sorted(expected),
        "optional": sorted(optional),
        "predicted_show": sorted(shown),
        "predicted_auto": sorted(auto),
        "show_precision": round(show_p, 4),
        "show_recall": round(show_r, 4),
        "auto_precision": round(auto_p, 4),
        "auto_recall": round(auto_r, 4),
        "false_positives": show_fp,
        "false_negatives": show_fn,
        "auto_false_positives": auto_fp,
        "optional_hits": optional_hits,
        "notes": case.get("notes", ""),
    }


def aggregate(cases: list[dict[str, Any]]) -> dict[str, Any]:
    if not cases:
        return {
            "cases": 0,
            "mean_show_precision": 0.0,
            "mean_show_recall": 0.0,
            "mean_auto_precision": 0.0,
            "mean_auto_recall": 0.0,
        }

    def mean(key: str) -> float:
        return sum(c[key] for c in cases) / len(cases)

    class_fp: dict[str, int] = {}
    class_fn: dict[str, int] = {}
    for case in cases:
        for label in case["false_positives"]:
            class_fp[label] = class_fp.get(label, 0) + 1
        for label in case["false_negatives"]:
            class_fn[label] = class_fn.get(label, 0) + 1

    return {
        "cases": len(cases),
        "mean_show_precision": round(mean("show_precision"), 4),
        "mean_show_recall": round(mean("show_recall"), 4),
        "mean_auto_precision": round(mean("auto_precision"), 4),
        "mean_auto_recall": round(mean("auto_recall"), 4),
        "class_false_positives": dict(sorted(class_fp.items(), key=lambda x: -x[1])),
        "class_false_negatives": dict(sorted(class_fn.items(), key=lambda x: -x[1])),
    }


def run_onnx_candidate(
    candidate: dict[str, Any],
    case: dict[str, Any],
) -> list[dict[str, Any]]:
    onnx_path = REPO / candidate["onnx_path"]
    labels_path = REPO / candidate["labels_path"]
    if not onnx_path.exists() or not labels_path.exists():
        return []

    try:
        import numpy as np
        from PIL import Image
    except ImportError:
        return []

    try:
        import onnxruntime as ort
    except ImportError:
        return []

    with labels_path.open(encoding="utf-8") as handle:
        label_meta = json.load(handle)

    session = ort.InferenceSession(str(onnx_path), providers=["CPUExecutionProvider"])
    input_name = session.get_inputs()[0].name
    input_size = int(candidate.get("input_size", 640))

    if not case["image_path"].exists():
        return []

    image = Image.open(case["image_path"]).convert("RGB")
    image = image.resize((input_size, input_size))
    arr = np.array(image, dtype=np.float32) / 255.0
    arr = np.transpose(arr, (2, 0, 1))[None, ...]

    started = time.perf_counter()
    outputs = session.run(None, {input_name: arr})
    elapsed_ms = (time.perf_counter() - started) * 1000

    # Heuristic: use fixture mapping helper when full YOLO decode not wired in Python
    mapping = label_meta.get("mapping", {})
    model_classes = label_meta.get("modelClassNames", [])
    predictions: list[dict[str, Any]] = []

    # If output looks like detection tensor, take top scores per class index (simplified)
    tensor = outputs[0]
    flat = np.array(tensor).reshape(-1)
    if flat.size == 0:
        return predictions

    top_indices = np.argsort(flat)[-12:][::-1]
    for rank, idx in enumerate(top_indices):
        score = float(flat[idx])
        if score < candidate.get("conf_threshold", 0.35):
            continue
        class_idx = int(idx % max(len(model_classes), 1))
        model_label = model_classes[class_idx] if class_idx < len(model_classes) else str(class_idx)
        ingredient = mapping.get(str(class_idx)) or mapping.get(model_label) or mapping.get(model_label.lower())
        if not ingredient:
            continue
        predictions.append(
            {
                "ingredient": ingredient,
                "confidence": min(0.98, 0.4 + score * 0.01),
                "raw": model_label,
                "runtime_ms": elapsed_ms if rank == 0 else None,
            }
        )

    return predictions


def evaluate_candidate(
    candidate: dict[str, Any],
    cases: list[dict[str, Any]],
    fixtures_only: bool,
) -> dict[str, Any]:
    fixture_preds = load_fixture_predictions(candidate["id"])
    per_case: list[dict[str, Any]] = []
    model_size_mb = None

    onnx_path = candidate.get("onnx_path")
    if onnx_path:
        path = REPO / onnx_path
        if path.exists():
            model_size_mb = round(path.stat().st_size / (1024 * 1024), 2)

    for case in cases:
        predictions: list[dict[str, Any]] = []
        if fixtures_only or candidate.get("type") == "transformers-js":
            predictions = fixture_preds.get(case["id"], [])
        elif candidate.get("type") == "yolo-onnx":
            if fixture_preds.get(case["id"]):
                predictions = fixture_preds[case["id"]]
            else:
                predictions = run_onnx_candidate(candidate, case)

        scored = score_case(case, predictions)
        scored["predictions"] = predictions
        per_case.append(scored)

    summary = aggregate(per_case)
    summary["candidate_id"] = candidate["id"]
    summary["candidate_name"] = candidate.get("name", candidate["id"])
    summary["model_size_mb"] = model_size_mb
    summary["type"] = candidate.get("type")
    return {
        "summary": summary,
        "cases": per_case,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Evaluate grocery vision candidates")
    parser.add_argument(
        "--fixtures-only",
        action="store_true",
        help="Use ml/grocery_vision/fixtures/predictions.json only (CI-safe)",
    )
    parser.add_argument(
        "--candidate",
        action="append",
        help="Limit to candidate id(s); default: all enabled in models.yml",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=REPORTS_DIR / "bakeoff-results.json",
        help="Output JSON path",
    )
    args = parser.parse_args()

    labels = load_yaml(ROOT / "labels.yml")
    models = load_yaml(ROOT / "models.yml")
    cases = load_expected_cases()

    if not cases:
        print("No test cases in test_photos/expected/. Using fixture-only smoke checks.")
        cases = [
            {
                "id": "fridge_001",
                "image": "fridge_001.jpg",
                "image_path": IMAGES_DIR / "fridge_001.jpg",
                "contains": ["milk", "eggs", "tomatoes"],
                "optional": ["cheese"],
                "notes": "fixture",
            },
            {
                "id": "fridge_002",
                "image": "fridge_002.jpg",
                "image_path": IMAGES_DIR / "fridge_002.jpg",
                "contains": ["chicken", "spinach", "carrots"],
                "optional": [],
                "notes": "fixture",
            },
            {
                "id": "fridge_003",
                "image": "fridge_003.jpg",
                "image_path": IMAGES_DIR / "fridge_003.jpg",
                "contains": ["yogurt", "berries", "bread"],
                "optional": ["butter"],
                "notes": "fixture",
            },
        ]

    candidates = models.get("candidates", [])
    if args.candidate:
        wanted = set(args.candidate)
        candidates = [c for c in candidates if c.get("id") in wanted]

    results = {
        "version": 2,
        "target_classes": target_classes(labels),
        "thresholds": labels.get("thresholds", {}),
        "fixtures_only": args.fixtures_only,
        "candidates": [],
    }

    for candidate in candidates:
        if candidate.get("enabled") is False:
            continue
        print(f"Evaluating {candidate.get('id')} …")
        results["candidates"].append(evaluate_candidate(candidate, cases, args.fixtures_only))

    args.output.parent.mkdir(parents=True, exist_ok=True)
    with args.output.open("w", encoding="utf-8") as handle:
        json.dump(results, handle, indent=2)

    print(f"Wrote {args.output}")


if __name__ == "__main__":
    main()
