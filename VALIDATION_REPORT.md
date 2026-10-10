> **v0.22.17 audit note:** Microsoft identity-family and multi-DKIM/authserv fixes did not change the hold-out outcome: **36 PASS / 6 ACCEPTABLE / 0 FAIL**. Current scoring/evidence revision: `0.22.17-auth-identity-family`.

# BeforeUClick v0.22.13 — Independent validation status

## Current hold-out result

The original 42-message independent whole-email validation set has been rerun against scoring/evidence revision `0.22.13-redirect-wrapper-provenance` after the BEC/payment, content-context and domain/intermediary cleanup. The 42 hold-out outcomes remain **36 PASS / 6 ACCEPTABLE / 0 FAIL**.

```text
42 whole-email scenarios
36 PASS / 6 ACCEPTABLE / 0 FAIL
Major state misses: 0
Diagnostic score-range flags: 3

Legitimate: 10 pass / 4 acceptable / 0 fail
Ambiguous:  13 pass / 1 acceptable / 0 fail
Phishing:   13 pass / 1 acceptable / 0 fail
```

The previous open `VAL-P04` changed-payment case now reaches **39 / Caution**. It is marked ACCEPTABLE rather than PASS because the original hold-out preferred High concern, but Caution is intentionally accepted under the current product philosophy: the extension has produced a strong enough intervention to stop normal action without overstating certainty.

No legitimate hold-out case moved into a new failure state.

## Interpretation

The hold-out set remains validation evidence rather than a target to optimise case-by-case. The v0.22.5 production change was not made from `VAL-P04` alone; it followed a separate 22-message development probe showing the same repeated BEC/payment-change cluster while legitimate controls stayed low.

The user-facing objective remains:

- **Review** — something is worth checking before acting, including legitimate but consequential processes;
- **Caution** — meaningful warning signs or corroborating concerns are present;
- **High concern** — strong or critical evidence justifies a stronger stop signal.
