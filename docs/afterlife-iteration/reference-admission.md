# Reference admission evidence

Both ImageGen references passed the deterministic admission gate. The check was run with `forge/stage1_intake/check_reference_admission.py --json`.

| Reference | Resolution | Foreground coverage | Largest component | Verdict |
| --- | ---: | ---: | ---: | --- |
| `references/wheelchair.png` | 1254×1254 | 0.3515 | 0.9998 | admitted |
| `references/mourning-cabinet.png` | 1254×1254 | 0.3524 | 1.0000 | admitted |

The images are suitable single-object references for silhouette and visible material decisions. Hidden undersides, rear surfaces, and internal cabinet construction remain approximations in the procedural factories.
