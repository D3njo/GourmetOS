# GourmetOS Grocery Detector

Primary V2 on-device detector (YOLO12n ONNX, mapped to GourmetOS inventory classes).

## Files

| File | Required | Description |
|------|----------|-------------|
| `labels.json` | yes | Model class names → GourmetOS ingredient mapping |
| `metadata.json` | yes | Input size, version, license |
| `model.onnx` | for inference | ~11 MB from Hugging Face (not committed by default) |

## Vendor ONNX

```bash
pip install huggingface_hub
python ml/grocery_vision/download_model.py
```

## Offline PWA

The service worker caches `model.onnx` after the first successful fetch. It is not in the core install bundle to keep install fast.
