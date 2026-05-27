# GourmetOS Model Assets

On-device models for fridge photo scanning. Images stay in the browser; nothing is sent to cloud vision APIs.

## Primary: Grocery detector (V2)

```text
assets/models/gourmetos-grocery-detector/
  model.onnx          # ~11 MB — vendor via ml/grocery_vision/download_model.py
  labels.json         # Class mapping → GourmetOS ingredients
  metadata.json       # Input size, version, license
```

When `model.onnx` is present, the app uses ONNX Runtime Web and disables Transformers.js remote bootstrap.

## Fallback: Transformers.js (YOLOS + CLIP)

```text
assets/models/Xenova/
  yolos-tiny/
  clip-vit-base-patch32/
```

Optional self-hosting for fully offline fallback when grocery ONNX is unavailable. See previous Xenova layout in git history.

## Evaluation

```bash
python ml/grocery_vision/evaluate.py --fixtures-only
python ml/grocery_vision/export_report.py
```

Reports: `ml/grocery_vision/reports/`
