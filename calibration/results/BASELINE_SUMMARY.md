# BeforeUClick scoring calibration baseline

- Scenarios: **78**
- Scoring model: `0.22.17-auth-identity-family`
- PASS: **70**
- ACCEPTABLE: **8**
- FAIL: **0**

The **regression** track preserves the original scenario corpus. v0.22.2 intentionally re-baselines a small set of human-authored expected ranges to match the agreed low-end user-warning philosophy; the scenarios themselves remain regression evidence. The **challenge** track contains harder context-sensitive cases.

## Track summary

| Track | Total | Pass | Acceptable | Fail | State distribution |
| --- | ---: | ---: | ---: | ---: | --- |
| regression | 48 | 41 | 7 | 0 | unknown:7, no-concerns:3, review:19, caution:10, high:9 |
| challenge | 30 | 29 | 1 | 0 | review:17, high:3, caution:9, unknown:1 |

## Group summary

| Group | Total | Pass | Acceptable | Fail | State distribution |
| --- | ---: | ---: | ---: | ---: | --- |
| legitimate | 12 | 8 | 4 | 0 | unknown:6, no-concerns:3, review:3 |
| ambiguous | 12 | 10 | 2 | 0 | review:10, caution:2 |
| phishing | 12 | 12 | 0 | 0 | high:7, caution:4, review:1 |
| invariant | 12 | 11 | 1 | 0 | review:5, caution:4, unknown:1, high:2 |
| challenge-legitimate | 10 | 9 | 1 | 0 | review:8, caution:1, unknown:1 |
| challenge-ambiguous | 10 | 10 | 0 | 0 | review:9, caution:1 |
| challenge-phishing | 10 | 10 | 0 | 0 | high:3, caution:7 |

## Internal score-band distribution

These bands are calibration diagnostics. The ordinary interface still shows only the five user-facing states.

- limited-evidence: **8**
- reassuring: **3**
- review-suggested: **29**
- review-recommended: **7**
- caution-advised: **13**
- high-concern: **12**
- strong-caution: **6**

## Cases needing attention

| Case | Track | Focus | Status | Expected | Actual | Score | Main module scores | Why |
| --- | --- | --- | --- | --- | --- | ---: | --- | --- |
| LEG-07 | regression | - | ACCEPTABLE | review, unknown (acceptable) | unknown | 13 | I:0 L:0 W:5 C:0 R:-7 | Neighbouring acceptable state |
| LEG-10 | regression | - | ACCEPTABLE | review, unknown (acceptable) | unknown | 16 | I:5 L:0 W:0 C:0 R:-4 | Neighbouring acceptable state |
| LEG-11 | regression | - | ACCEPTABLE | unknown, review (acceptable) | review | 17 | I:0 L:0 W:2 C:0 R:0 | Neighbouring acceptable state |
| LEG-12 | regression | - | ACCEPTABLE | unknown, review (acceptable) | review | 17 | I:0 L:0 W:2 C:0 R:0 | Neighbouring acceptable state |
| AMB-03 | regression | - | ACCEPTABLE | review, caution (acceptable) | caution | 35 | I:0 L:20 W:0 C:0 R:0 | Neighbouring acceptable state |
| AMB-07 | regression | - | ACCEPTABLE | unknown, review (acceptable) | review | 19 | I:4 L:0 W:0 C:0 R:0 | Neighbouring acceptable state |
| INV-01 | regression | - | ACCEPTABLE | unknown, review (acceptable) | review | 19 | I:0 L:4 W:0 C:0 R:0 | Neighbouring acceptable state |
| CH-PUNY-L | challenge | punycode-link | ACCEPTABLE | review, caution (acceptable) | caution | 35 | I:0 L:20 W:0 C:0 R:0 | Neighbouring acceptable state |

## Important interpretation

This is a calibration harness, not ground truth. Expected ranges are human-authored hypotheses and should be revised when realistic testing shows they are unreasonable. The runner must not automatically rewrite production weights simply to maximise its own pass rate. That would overfit the fixture set.

Use the final state, internal score band, score-derived state and evidence explanation together. Small score differences inside the same useful region are acceptable. Change a weight or rule only when a repeated pattern produces an unreasonable user-facing warning or an implausible ordering of evidence, then rerun both tracks and the pairwise matrix.
