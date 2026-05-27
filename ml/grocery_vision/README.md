# GourmetOS Grocery Vision (V2)

Offline evaluation harness for fridge-photo ingredient detection. Compares open-model candidates before browser integration.

## Layout

```text
ml/grocery_vision/
  labels.yml          # V2 target classes (30)
  models.yml          # Candidate registry
  evaluate.py         # Run metrics on test_photos/
  export_report.py    # Markdown/JSON report from results
  download_model.py   # Vendor ONNX from Hugging Face (optional)
  train.py            # Fine-tune YOLO when bake-off is insufficient
  export_onnx.py      # Export fine-tuned weights to browser ONNX
  datasets/gourmetos.yaml
  test_photos/
    images/           # fridge_001.jpg … (not committed if private)
    expected/         # fridge_001.json ground truth
  reports/            # Generated bake-off output
```

## Quick start

```bash
# Manjaro/Arch: system pip is blocked (PEP 668) — use a project venv:
cd /path/to/GourmetOS
python3 -m venv .venv
source .venv/bin/activate
pip install huggingface_hub pyyaml

# Vendor ONNX (~11 MB):
python ml/grocery_vision/download_model.py

# Optional training/eval deps:
pip install ultralytics onnxruntime pillow numpy

# Add labeled photos under test_photos/images + expected/
# Or use bundled fixture predictions for CI:
python ml/grocery_vision/evaluate.py --fixtures-only
python ml/grocery_vision/export_report.py
```

## Metrics

- Per-image precision / recall on `contains` labels
- Auto-select precision (threshold 0.74)
- Class-level false positives / misses
- Runtime and model size (when model file present)

## V2 targets

| Metric | Target |
|--------|--------|
| Auto-select precision | ≥ 85% |
| Recall (top-30 classes) | ≥ 70% on own fridge set |
| Model size | prefer &lt; 25 MB, max 50 MB |
| Cached scan (mobile) | &lt; 4 s |

## Privacy

Do not commit private fridge photos. Commit only `expected/*.json` schemas and public fixture images if licensed.
