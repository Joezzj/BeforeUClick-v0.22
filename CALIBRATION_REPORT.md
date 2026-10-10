> **v0.22.17 audit note:** Authentication/identity evidence handling was hardened without changing the score thresholds or evidence weights. Current scoring/evidence revision: `0.22.17-auth-identity-family`. The 78-scenario calibration remains **70 PASS / 8 ACCEPTABLE / 0 FAIL**.

> **v0.22.13 note:** Real-provider validation converged on redirect-wrapper false positives rather than score-threshold errors. The major 17/35/60 breakpoints and v0.22.5 BEC corroboration weights remain unchanged. Current scoring/evidence revision: `0.22.13-redirect-wrapper-provenance`. The 78-scenario calibration remains **70 PASS / 8 ACCEPTABLE / 0 FAIL**.

# BeforeUClick v0.22.13 — Calibration status
## Calibration objective

v0.22.2 calibrates the internal evidence score around the product's actual user-facing purpose: help an ordinary user notice when an email deserves another look before they click, reply, pay, disclose a secret, or otherwise act.

The score is not a probability of phishing and is not shown in the primary result. It remains available in the detailed report/diagnostics so the evidence and calculation can be inspected.

The agreed design principles are:

1. **15 means uncertainty, not suspicion.**
2. **Reassuring evidence primarily reduces uncertainty.** It is not proof of safety.
3. **Concerning evidence is asymmetric and generally takes precedence.** Legitimate-looking sender/authentication properties can coexist with compromised or deceptive mail.
4. **Resolution matters most at the low/middle end.** The difference between 15, 20, 30 and 40 is more operationally useful than fine distinctions after a message is already High concern.
5. **Final user-facing reasonableness matters more than an exact target number.** Neighbouring/boundary outcomes can be acceptable when the warning still makes sense.
6. **Critical or explicitly defined evidence may impose a minimum verdict.** Generic `strong` wording no longer does so automatically.

## Score model

### User-facing bands

| Score | User-facing assessment | Intended meaning |
| ---: | --- | --- |
| 0–9 | No obvious concerns | Reassuring evidence is present and no meaningful concern stands out. |
| 10–16 | Not enough evidence | The extension does not have enough useful evidence to make a stronger judgement. |
| 17–34 | Review | Something is worth checking before acting. |
| 35–59 | Caution | Meaningful warning signs are present. |
| 60–100 | High concern | Strong/corroborating evidence is sufficient that further numerical precision adds little practical value. |

### Internal diagnostic sub-bands

| Score | Internal band |
| ---: | --- |
| 0–9 | reassuring |
| 10–16 | limited-evidence |
| 17–24 | review-suggested |
| 25–34 | review-recommended |
| 35–44 | caution-advised |
| 45–59 | strong-caution |
| 60–100 | high-concern |

These sub-bands are shown only in calibration/developer diagnostics.

## Weight changes

### Reassuring evidence

The reassurance side was intentionally softened. The normal cap is now 12, reduced to 7 with medium concern and 5 with strong concern; critical concern permits no reassurance subtraction.

Key values:

| Evidence | v0.22.1 | v0.22.2 |
| --- | ---: | ---: |
| Official sender domain | -5 | -4 |
| Official destination | -4 | -3 |
| Controlled namespace | -2 | -1 |
| SPF aligned | -2 | -1 |
| DKIM aligned | -3 | -2 |
| DMARC pass | -2 | -2 |
| Known local sender | -2 | -2 |
| Established domain | -2 | -1 |

Aligned SPF + DKIM + DMARC therefore moves the 15-point baseline to 10 rather than 8. Authentication is reassuring, but authentication alone does not prove that the message content/action is safe.

### Concern evidence

The useful wording steps remain 2 / 5 / 8 with a 15-point wording cap. SPF and DKIM failures are now +5 and DMARC failure +10. Link evidence remains the main structural escalation path, with strong deceptive destinations capable of moving a message well into Caution before corroboration.

### Corroboration

Narrow combinations add evidence only when distinct behaviours reinforce one another. New v0.22.2 rules include urgent secret gift-card requests, urgent remote access, secrecy plus identity inconsistency, and secret credential requests paired with a concerning link.

## 78-scenario result

```text
PASS 70 | ACCEPTABLE 8 | FAIL 0

regression: 41 pass, 7 acceptable, 0 fail / 48
challenge:  29 pass, 1 acceptable, 0 fail / 30
```

Group results:

| Group | Preferred | Acceptable | Fail |
| --- | ---: | ---: | ---: |
| legitimate | 8 | 4 | 0 |
| ambiguous | 10 | 2 | 0 |
| phishing | 12 | 0 | 0 |
| invariant | 11 | 1 | 0 |
| challenge-legitimate | 9 | 1 | 0 |
| challenge-ambiguous | 10 | 0 | 0 |
| challenge-phishing | 10 | 0 | 0 |

The eight acceptable cases are all neighbouring/boundary outcomes. There are no cases outside the agreed range.

### Previously failing challenge cases

| Case | v0.22.1 | v0.22.2 | Explanation |
| --- | --- | --- | --- |
| CH-MFA-L | Caution, 18 | Review | Generic strong wording no longer bypasses the score band. |
| CH-SECRECY-L | Caution, 18 | Review | Legitimate confidentiality wording can remain a review prompt rather than an automatic Caution. |
| CH-GIFTCARD-P | Caution, 30; old target High | Caution, 40 | The urgent + secret + gift-card request receives +10 corroboration. Under the agreed user-warning philosophy, Caution is the preferred result and High remains acceptable. |

## Pairwise exploration

```text
19 signals
171 unique pairs

Singles: 14 Review, 3 Caution, 2 Not enough evidence
Pairs:   100 Review, 54 Caution, 6 Not enough evidence, 10 High concern, 1 No obvious concerns

Single review flags: 1
Pair review flags:   0
```

Internal score bands for the pairs are also well distributed across the low/middle regions: 22 review-suggested, 78 review-recommended, 25 caution-advised, 29 strong-caution, 10 high-concern, 6 limited-evidence and 1 reassuring.

The only remaining automated human-review prompt is `punycode-link` at exactly score 35 / Caution. This is deliberately retained as a calibration question rather than changed simply to produce a clean flag count.

## Interpretation

The v0.22.2 result is not statistical proof of detection accuracy. The corpus is still a controlled calibration/regression set. Its purpose is to make the scoring behaviour explicit, repeatable and resistant to ad-hoc weight changes.

Future calibration should therefore preserve three checks:

- Is the **final warning reasonable** for what the email contains?
- Does the **internal score/order** respond sensibly when evidence is added or reassurance is present?
- Does a proposed change improve a repeated pattern rather than merely making one fixture pass?

Run both calibration scripts after every material scoring change.
