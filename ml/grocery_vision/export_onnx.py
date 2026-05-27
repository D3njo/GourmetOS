#!/usr/bin/env python3
"""Export fine-tuned YOLO weights to browser-friendly ONNX."""

from __future__ import annotations

import argparse
import json
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parent
REPO = ROOT.parents[1]
OUT_DIR = REPO / "assets" / "models" / "gourmetos-grocery-detector"


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--weights", type=Path, required=True, help="best.pt from training")
    parser.add_argument("--imgsz", type=int, default=640)
    parser.add_argument("--version", default="0.2.0-finetune")
    args = parser.parse_args()

    try:
        from ultralytics import YOLO
    except ImportError as exc:
        raise SystemExit("pip install ultralytics") from exc

    model = YOLO(str(args.weights))
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    export_path = model.export(format="onnx", imgsz=args.imgsz, simplify=True, opset=17)
    export_file = Path(export_path)
    shutil.copy(export_file, OUT_DIR / "model.onnx")

    metadata_path = OUT_DIR / "metadata.json"
    metadata = {}
    if metadata_path.exists():
        metadata = json.loads(metadata_path.read_text(encoding="utf-8"))
    metadata.update(
        {
            "version": args.version,
            "source": "gourmetos-finetune",
            "inputSize": args.imgsz,
            "format": "yolo-onnx",
        }
    )
    metadata_path.write_text(json.dumps(metadata, indent=2), encoding="utf-8")
    print(f"Exported {OUT_DIR / 'model.onnx'}")


if __name__ == "__main__":
    main()
