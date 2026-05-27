# GourmetOS V2 Grocery Vision Bake-off

Fixtures only: **True**

## Targets

- Auto-select precision ≥ 85%
- Show recall ≥ 70%

## Candidates

| Candidate | Show P | Show R | Auto P | Auto R | Size (MB) | Pass |
|-----------|--------|--------|--------|--------|-----------|------|
| GourmetOS Grocery Detector (Norwegian YOLO12n ONNX) | 0.83 | 1.00 | 1.00 | 0.89 | — | yes |
| Transformers.js YOLOS-tiny + CLIP baseline | 0.89 | 0.89 | 0.33 | 0.11 | — | no |

## Winner

**GourmetOS Grocery Detector (Norwegian YOLO12n ONNX)** (`gourmetos-grocery-detector`) — auto precision 1.00, show recall 1.00.

## Per-case errors

### gourmetos-grocery-detector
- `fridge_001` FP: ['cheese'] FN: —
- `fridge_003` FP: ['butter'] FN: —

### baseline-clip-yolos
- `fridge_003` FP: ['bananas'] FN: ['berries']
