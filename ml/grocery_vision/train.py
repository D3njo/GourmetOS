#!/usr/bin/env python3
"""Fine-tune YOLO on labeled GourmetOS fridge photos when bake-off targets are not met."""

from __future__ import annotations

import argparse
from pathlib import Path

ROOT = Path(__file__).resolve().parent
DEFAULT_DATA = ROOT / "datasets" / "gourmetos.yaml"


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--data", type=Path, default=DEFAULT_DATA)
    parser.add_argument("--model", default="yolo11n.pt", help="Base checkpoint")
    parser.add_argument("--epochs", type=int, default=100)
    parser.add_argument("--imgsz", type=int, default=640)
    parser.add_argument("--batch", type=int, default=16)
    parser.add_argument("--project", type=Path, default=ROOT / "runs")
    args = parser.parse_args()

    try:
        from ultralytics import YOLO
    except ImportError as exc:
        raise SystemExit("pip install ultralytics") from exc

    if not args.data.exists():
        raise SystemExit(
            f"Dataset config missing: {args.data}\n"
            "Label 50–200 fridge images locally and point path in gourmetos.yaml."
        )

    model = YOLO(args.model)
    model.train(
        data=str(args.data),
        epochs=args.epochs,
        imgsz=args.imgsz,
        batch=args.batch,
        project=str(args.project),
        name="gourmetos-fridge",
        patience=20,
        augment=True,
    )
    print("Training complete. Export with export_onnx.py")


if __name__ == "__main__":
    main()
