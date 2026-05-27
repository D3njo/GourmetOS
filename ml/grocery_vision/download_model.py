#!/usr/bin/env python3
"""Download and place the Norwegian grocery detector ONNX for local/browser use."""

from __future__ import annotations

import argparse
import json
import os
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parent
REPO = ROOT.parents[1]
OUT_DIR = REPO / "assets" / "models" / "gourmetos-grocery-detector"

# Hugging Face repo (user must accept license on HF before download in some setups)
HF_REPO = "valiantlynxz/norwegian-grocery-detector"
HF_ONNX_FILE = "submission_yolo12n/best.onnx"


def main() -> None:
    # Keep HF cache inside the project (avoids permission issues on shared ~/.cache).
    os.environ.setdefault("HF_HOME", str(REPO / ".cache" / "huggingface"))

    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--skip-download",
        action="store_true",
        help="Only refresh labels/metadata from repo mapping",
    )
    args = parser.parse_args()

    OUT_DIR.mkdir(parents=True, exist_ok=True)

    labels_src = ROOT / "norwegian_class_mapping.json"
    if labels_src.exists():
        shutil.copy(labels_src, OUT_DIR / "labels.json")
    else:
        default_labels = {
            "version": "0.1.0",
            "modelClassNames": [],
            "classes": [],
            "mapping": {},
            "notes": "Run with full mapping file or download from HF metadata."
        }
        (OUT_DIR / "labels.json").write_text(json.dumps(default_labels, indent=2), encoding="utf-8")

    mapping_path = ROOT / "norwegian_class_mapping.json"
    mapping = json.loads(mapping_path.read_text(encoding="utf-8")) if mapping_path.exists() else {}
    metadata = {
        "name": "gourmetos-grocery-detector",
        "version": "0.1.0",
        "inputSize": 640,
        "classes": sorted(set(mapping.get("mapping", {}).values())),
        "modelClassCount": len(mapping.get("modelClassNames", [])),
        "source": HF_REPO,
        "license": "Apache-2.0",
        "format": "yolo-onnx",
    }

    (OUT_DIR / "metadata.json").write_text(json.dumps(metadata, indent=2), encoding="utf-8")

    onnx_out = OUT_DIR / "model.onnx"
    if args.skip_download:
        print(f"Skipped ONNX download. Expected at {onnx_out}")
        return

    try:
        from huggingface_hub import hf_hub_download
    except ImportError as exc:
        raise SystemExit("pip install huggingface_hub") from exc

    downloaded = hf_hub_download(repo_id=HF_REPO, filename=HF_ONNX_FILE)
    shutil.copy(downloaded, onnx_out)
    print(f"Vendored ONNX to {onnx_out} ({onnx_out.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    main()
