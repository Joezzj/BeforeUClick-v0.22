# BeforeUClick independent validation report

- Validation set: **0.22.3-independent-validation-v1**
- Scoring model: `0.22.17-auth-identity-family`
- Whole-email scenarios: **42**
- PASS: **36**
- ACCEPTABLE: **6**
- FAIL: **0**
- Major state misses (2+ state steps): **0**
- Scores outside broad diagnostic ranges: **3**

> This is a hold-out validation set. Score ranges are deliberately broad and diagnostic only. Do not rewrite production weights to make individual validation fixtures pass. Investigate repeated patterns/clusters first.

## Group summary

| Group | Total | Pass | Acceptable | Fail | Major misses | Score range outside | Score min / median / max | State distribution |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- |
| validation-legitimate | 14 | 10 | 4 | 0 | 0 | 2 | 3 / 15.5 / 26 | unknown:4, no-concerns:4, review:6 |
| validation-ambiguous | 14 | 13 | 1 | 0 | 0 | 0 | 20 / 25 / 38 | review:11, caution:3 |
| validation-phishing | 14 | 13 | 1 | 0 | 0 | 1 | 27 / 50.5 / 100 | high:5, caution:8, review:1 |

## Cases needing review

| Case | Group | Status | Expected | Actual | Score | Band | Range | Range check | Main modules | Why |
| --- | --- | --- | --- | --- | ---: | --- | --- | --- | --- | --- |
| VAL-L05 | validation-legitimate | ACCEPTABLE | review (unknown acceptable) | unknown | 15 | Limited evidence | 14–24 | IN_RANGE | I:0 L:0 W:2 C:0 R:-2 | Diagnostic range only |
| VAL-L07 | validation-legitimate | PASS | review (unknown acceptable) | review | 25 | Review recommended | 10–24 | HIGH | I:0 L:0 W:15 C:0 R:-5 | Diagnostic range only |
| VAL-L12 | validation-legitimate | ACCEPTABLE | review (unknown acceptable) | unknown | 16 | Limited evidence | 10–30 | IN_RANGE | I:5 L:0 W:0 C:0 R:-4 | Diagnostic range only |
| VAL-L13 | validation-legitimate | ACCEPTABLE | review (unknown/no-concerns acceptable) | unknown | 13 | Limited evidence | 8–24 | IN_RANGE | I:0 L:0 W:5 C:0 R:-7 | Diagnostic range only |
| VAL-L14 | validation-legitimate | ACCEPTABLE | review (unknown/no-concerns acceptable) | no-concerns | 5 | Reassuring | 8–24 | LOW | I:0 L:0 W:2 C:0 R:-12 | Diagnostic range only |
| VAL-A06 | validation-ambiguous | ACCEPTABLE | review (caution acceptable) | caution | 35 | Caution advised | 25–44 | IN_RANGE | I:20 L:0 W:0 C:0 R:0 | Diagnostic range only |
| VAL-P04 | validation-phishing | ACCEPTABLE | high (caution acceptable) | caution | 39 | Caution advised | 50–100 | LOW | I:0 L:4 W:15 C:5 R:0 | Diagnostic range only |

## Validation rule

A single surprising case is a prompt to inspect the evidence trace, not permission to retune the model. Change production scoring only when multiple independent validation cases expose the same systematic problem, then rerun the original 78-scenario regression/challenge calibration and the 171-pair exploration before accepting the change.
