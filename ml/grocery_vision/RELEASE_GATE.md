# V2 Grocery Vision Release Gate

Checklist before merging to `main`:

- [x] `npm test` green (includes `eval:vision` bake-off on fixtures)
- [x] Evaluation harness: `ml/grocery_vision/evaluate.py`
- [x] Bake-off report: `ml/grocery_vision/reports/v2-bakeoff-summary.md`
- [ ] `model.onnx` vendored (`python ml/grocery_vision/download_model.py`) for production offline scan
- [ ] Manual mobile test: first scan online, second scan offline, poor lighting, full door
- [ ] 20+ real fridge photos in `test_photos/` with `expected/*.json` (private photos stay local)

## Fixture bake-off (CI)

| Candidate | Auto P | Show R | Pass V2 targets |
|-----------|--------|--------|-----------------|
| gourmetos-grocery-detector | 1.00 | 1.00 | yes |
| baseline-clip-yolos | 0.00 | 0.89 | no |

Winner: **gourmetos-grocery-detector** (Norwegian YOLO12n ONNX + class mapping).

Fine-tuning (`train.py`) only required if real-photo eval falls below targets after ONNX vendor.
