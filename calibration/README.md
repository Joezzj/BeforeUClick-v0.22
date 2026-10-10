# BeforeUClick scoring calibration and validation — v0.22.5

The internal score starts at **15 = uncertainty**. Reassuring evidence lowers uncertainty; concerning evidence raises concern. Review is deliberately a broad **“check this before acting”** state and can include legitimate but consequential workflows.

## User-facing bands

```text
0–9      No obvious concerns
10–16    Not enough evidence
17–34    Review
35–59    Caution
60–100   High concern
```

## Development calibration

```text
node calibration/run_calibration.js
```

Current result:

```text
78 scenarios: 70 PASS / 8 ACCEPTABLE / 0 FAIL
```

## Pairwise exploration

```text
node calibration/run_pairwise_matrix.js
```

Current result:

```text
19 signals / 171 pairs
Review flags: 1 single / 0 pairs
```

The remaining prompt is punycode alone at score 35 / Caution.

## Independent whole-email validation

```text
node calibration/run_validation.js
```

Current result after the v0.22.5 targeted payment change:

```text
42 scenarios: 36 PASS / 6 ACCEPTABLE / 0 FAIL
Major state misses: 0
```

The validation set is still a hold-out. The production change was justified by the separate focused probe rather than by tuning directly against one hold-out fixture.

## Focused BEC / changed-payment probe

```text
node calibration/run_bec_payment_probe.js
```

Current result:

```text
22 scenarios: 21 PASS / 1 ACCEPTABLE / 0 FAIL
Legitimate controls: 5 / 0 / 0
Ambiguous:          7 / 0 / 0
BEC/phishing:       9 / 1 / 0
```

The probe includes ordinary overdue/pay-today controls. Payment pressure alone is not intended to produce Caution. The +5 changed-payment corroboration path requires payment change + pressure/urgency + an independent concern such as secrecy, identity inconsistency or a concerning destination.

## Validation discipline

Do not change weights to make one fixture pass. Look for repeated patterns, use a separate development probe when possible, then rerun all four suites before accepting a scoring change.
