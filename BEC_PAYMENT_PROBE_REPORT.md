> **v0.22.17 audit note:** The Microsoft/authentication cleanup does not change BEC/payment thresholds or weights. Focused probe remains **21 PASS / 1 ACCEPTABLE / 0 FAIL** under `0.22.17-auth-identity-family`.

# BeforeUClick v0.22.13 — BEC / changed-payment status

## Purpose

The v0.22.5 BEC/payment follow-up remains unchanged in v0.22.13. The real-world domain/intermediary cleanup does not alter these payment weights. The goal is **not** to make payment language itself look dangerous. Review remains the intended home for legitimate-but-consequential processes such as overdue invoices, changed bank details and other instructions that are worth checking before money moves.

The targeted rule only adds extra corroboration when changed payment details plus urgency/payment pressure are reinforced by another independent concern such as secrecy, sender/metadata inconsistency or a concerning destination.

## Changes

1. `payment-pressure` now recognises natural forms such as `pay this invoice today`, `settle the outstanding bill immediately`, and `payment is due today`.
2. The generic phrase `please pay this invoice to ...` was removed from `changed-payment-details`; a normal payment instruction is not evidence that bank details changed.
3. Added one narrow `changed-payment-plus-independent-concern` combination worth **+5**.
4. Added two controls covering ordinary overdue/pay-today reminders so the probe explicitly protects legitimate payment workflows from Caution/High over-escalation.

## Current focused probe

```text
22 scenarios
PASS 21 | ACCEPTABLE 1 | FAIL 0

bec-legitimate: 5 pass / 0 acceptable / 0 fail
bec-ambiguous:  7 pass / 0 acceptable / 0 fail
bec-phishing:   9 pass / 1 acceptable / 0 fail
Major state misses: 0
Diagnostic score-range flags: 0
```

The previous three failures now land at Caution through the new corroboration path:

| Case | v0.22.4 | v0.22.5 | Why |
| --- | --- | --- | --- |
| `BEC-P01` | 29 / Review | 39 / Caution | payment pressure is now recognised; weak concerning link supplies independent corroboration |
| `BEC-P02` | 30 / Review | 35 / Caution | changed payment + urgency + secrecy receives the +5 corroboration rule |
| `BEC-P04` | 33 / Review | 43 / Caution | payment pressure is recognised and the HTTP destination independently corroborates the request |

`BEC-P08`, the authenticated known-supplier/account-compromise style case, remains **34 / Review** and is explicitly acceptable. That is consistent with the agreed product philosophy: authentication is reassuring but not proof of safety, and Review means the user should genuinely verify the payment before acting.

## Ordinary-payment controls

The new controls behave as intended:

- authenticated known supplier + ordinary overdue/pay-today wording does **not** reach Caution/High;
- unknown supplier + overdue/pay-today wording alone remains Review-level rather than being treated as a danger warning;
- changed payment details alone remain Review;
- stronger independent identity/link evidence can still escalate to Caution or High concern.

This preserves the distinction between **“worth checking”** and **“we found meaningful warning signs.”**
