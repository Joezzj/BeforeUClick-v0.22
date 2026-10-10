# BeforeUClick BEC / changed-payment probe report

- Probe set: **0.22.5-bec-payment-probe-v2**
- Scoring model: `0.22.17-auth-identity-family`
- Whole-email probe scenarios: **22**
- PASS: **21**
- ACCEPTABLE: **1**
- FAIL: **0**
- Major state misses (2+ state steps): **0**
- Scores outside broad diagnostic ranges: **0**

> This is a focused development probe, not the independent hold-out set. Its purpose is to test whether the VAL-P04 changed-payment finding repeats across realistic variants before production scoring is changed.

## Group summary

| Group | Total | Pass | Acceptable | Fail | Major misses | Score range outside | Score min / median / max | State distribution |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- |
| bec-legitimate | 5 | 5 | 0 | 0 | 0 | 0 | 3 / 18 / 21 | review:3, no-concerns:1, unknown:1 |
| bec-ambiguous | 7 | 7 | 0 | 0 | 0 | 0 | 20 / 28 / 38 | review:4, caution:3 |
| bec-phishing | 10 | 9 | 1 | 0 | 0 | 0 | 34 / 48.5 / 99 | caution:7, high:2, review:1 |

## Probe cases needing review

| Case | Group | Status | Expected | Actual | Score | Band | Range | Range check | Main modules | Why |
| --- | --- | --- | --- | --- | ---: | --- | --- | --- | --- | --- |
| BEC-P08 | bec-phishing | ACCEPTABLE | caution (review acceptable) | review | 34 | Review recommended | 30–50 | IN_RANGE | I:0 L:4 W:15 C:5 R:-5 | Diagnostic range only |

## Probe rule

A single probe miss is not enough to change scoring. A targeted production change is justified only when several related BEC/payment-change variants show the same under-sensitive behaviour while legitimate controls remain low. Any accepted change must then rerun the 78-scenario calibration, 171-pair exploration and 42-message independent validation set.
