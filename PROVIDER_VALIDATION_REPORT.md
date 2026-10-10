> **v0.22.17 Outlook/Microsoft note:** Live Outlook testing now captures full headers through the unpinned default route. The subsequent Microsoft digest outlier exposed incomplete Microsoft 365 identity relationships plus multi-DKIM/authserv handling; v0.22.17 addresses those shared-analysis issues while preserving the successful v0.22.16.9 DOM acquisition chain.

# BeforeUClick v0.22.13 — Real-provider validation findings

## v0.22.13 follow-up

User and team validation converged on redirect-wrapper false positives rather than new score-threshold problems. Mercury, Club+/Foodstuffs, Mailpost, PropertySuite and Como/ComoSense examples all showed visible external brands being compared directly against campaign wrapper hosts. v0.22.13 adds conservative message-wide wrapper inference, with no reassurance for unseen final destinations, plus clearer evidence provenance and Mercury Online organisation-family context.


## Privacy note

This development report records only technical outcomes and issue classes from manual Gmail/Chrome testing. It does not store the user's message bodies, recipients, full email addresses, raw headers or full URLs.

## v0.22.11 live recheck / third Gmail batch

The v0.22.11 relationship changes substantially improved the previous false-positive families. New World moved from **High concern 81** to **No obvious concerns 8**, with all 44 extracted Foodstuffs-family links recognised correctly. The remaining weak finding was the user's Gmail recipient address repeated in the footer being mistaken for a Foodstuffs contact address.

The same batch exposed three narrow reference-role gaps rather than a new scoring problem:

| Case family | v0.22.11 result | Finding | v0.22.12 response |
| --- | ---: | --- | --- |
| LinkedIn notification | Caution 36 | `linkedin.com` was platform/user-content but missing the general LinkedIn sender-domain role | Add sourced `linkedin.com` sender role while keeping destination content score-neutral |
| ANZ careers notification | Caution 58 | `careers.anz.com` was not connected to the ANZ NZ reference | Add ANZ Banking Group `anz.com` careers destination relationship |
| Instagram notifications | Review 33 / Caution 36 | `mail.instagram.com` lacked sender-domain role; recipient Gmail address in footer was treated as brand contact | Add Instagram sender role and ignore extracted recipient addresses in body-contact identity analysis |

These are evidence/reference corrections. The numerical score model remains unchanged.

## v0.22.12 provider-validation workflow

The extension can now collect a whole live-provider batch in tab memory and export it once. The runner records privacy-reduced diagnostics plus a behaviour-pattern signature. Repeated message structures are explicitly marked as similar, allowing testing to stop when additional Gmail mail is no longer exercising new mechanisms.

A practical stopping rule for each provider is now:

1. cover the major broad categories available;
2. keep recording while tests add new behaviour signatures or expose a new failure class;
3. when several consecutive emails are only variants of existing signatures, move to the next provider;
4. use synthetic fixtures for rare scenarios that are unsafe or impractical to source from a real mailbox.

## v0.22.10 live recheck / second batch

The v0.22.10 context cleanup produced the intended large reductions on the first false-positive cluster: the Quora digest fell from **High concern 61** to **Not enough evidence 12**, Patreon fell from **High concern 69** to **Review 18**, and a normal Mercury account-closing message reached **No obvious concerns 6**.

The same recheck exposed a narrower domain-relationship/infrastructure cluster:

| Case family | v0.22.10 result | Finding | v0.22.11 response |
| --- | ---: | --- | --- |
| Legitimate 2degrees overdue/payment message | High concern 71 | `mandrillapp.com` tracking wrapper treated as 2degrees brand inconsistency; payment wording itself reasonably sat at Review level | Recognise Mandrill as neutral tracking/mail infrastructure; keep payment rules unchanged |
| Legitimate 360Net support/signature mail | Caution 56 | Exclaimer signature links treated as display/Meta brand mismatch | Recognise Exclaimer tracking/signature intermediary |
| New World / Foodstuffs promotion | High concern 81 | `newworld.co.nz`, `foodstuffs.co.nz` and Club+ relationship treated too literally; long tracking URLs produced many Review links | Add Foodstuffs organisation-family context; make standalone long URL informational |
| Prosple job recommendations | Caution 58 | Customer.io social-link wrappers treated as Meta/LinkedIn/Google impersonation | Recognise Customer.io tracking infrastructure |
| Club+ promotion | High concern 81 | Foodstuffs/Club+ sender/reply/link family plus app-store wrappers compounded | Organisation-family context + intermediary handling |
| Air New Zealand promotion | High concern 86 | `comms.airnz.co.nz` / `clicks.airnz.co.nz` were absent from the Air NZ reference and repeated the same +35 explanation across many links | Add `airnz.co.nz` first-party/sender relationship and deduplicate repeated display evidence |
| Woolworths promotion | Not enough evidence 10 | Large 62-link promotional mail produced no concern evidence | Kept as a real-world control; no special-case change needed |

## v0.22.11 design rule

A recognised intermediary or related organisation-domain relationship is **context, not proof of safety**. It can prevent a false identity claim such as “Customer.io is pretending to be LinkedIn,” but it does not make the hidden/final destination trustworthy. Strong evidence from the actual destination, identity, authentication or wording continues to score normally.

The score thresholds remain unchanged. The next live action is to recheck the 2degrees, 360Net, New World/Club+, Prosple and Air New Zealand examples in Gmail/Chrome, then continue the provider matrix if their explanations are now sensible.

---

# BeforeUClick v0.22.10 — Real Gmail validation findings

## Purpose

This report records the first Gmail/Chrome real-message validation batch that motivated v0.22.10. To preserve the project's privacy-first rule, this file stores only technical outcomes and issue classes; it does **not** include message bodies, recipients, full email addresses, raw headers or full URLs.

## Pre-fix observations from v0.22.9

| Case | v0.22.9 result | Assessment | Main finding |
| --- | --- | --- | --- |
| RW-GMAIL-01 | Review 18 | Reasonable | Legitimate subscription/payment message; weak HTTP/long-URL evidence worth rechecking, but Review is appropriate. |
| RW-GMAIL-02 | Not enough evidence 14 | Good | Clean education confirmation with partial Gmail authentication coverage. |
| RW-GMAIL-03 | High concern 61 | False positive | Newsletter/digest article brands and authority language were mistaken for impersonation/social-engineering claims. |
| RW-GMAIL-04 | Review 19 | Mostly reasonable | Marketing email; ordinary delivery/reward wording created avoidable noise. |
| RW-GMAIL-05 | High concern 85 | False positive | Google sender/reference mismatch plus Google `c.gle` redirect produced overlapping strong evidence. |
| RW-GMAIL-06 | Review 19 | Outcome acceptable, reasoning noisy | Transaction addresses inside a PayPal receipt were misread as body brand/contact identity claims. |
| RW-GMAIL-07 | High concern 69 | False positive | Ordinary app-store/update language and same-sender Patreon links were over-interpreted as remote-access and Google impersonation. |
| RW-GMAIL-08 | High concern 94 | False positive | `pb.co.nz` short-domain edit-distance collision, Mailchimp tracking redirects, social-brand mentions and generic click wording compounded. |

The batch also exposed a presentation problem: **Show all links** could cover long newsletters with dozens of neutral status chips, and edge-of-viewport targets could leave detached-looking chips.

## v0.22.10 response

The patch addresses the repeated mechanisms rather than tuning scores to individual emails:

- context-aware brand/domain comparison;
- body contact-address checks require local contact/support context;
- Google sender/`c.gle` reference cleanup;
- Mailchimp tracking/delivery infrastructure recognition;
- conservative short-domain typosquat matching;
- narrower remote-access, parcel-delivery and police/legal wording;
- quieter all-links highlighting and stronger viewport clamping.

## Regression status

Synthetic reproductions of the observed mechanisms are in `tests/v02210_real_world_context_test.js` and pass. Existing calibration/validation suites also remain stable:

```text
78 calibration scenarios: 70 PASS / 8 ACCEPTABLE / 0 FAIL
171 pairwise combinations: 1 single review prompt / 0 pair prompts
42 independent validation scenarios: 36 PASS / 6 ACCEPTABLE / 0 FAIL
22 BEC/payment probes: 21 PASS / 1 ACCEPTABLE / 0 FAIL
```

## Next validation action

The exact live messages should be rechecked in Gmail/Chrome with v0.22.10. The expected direction is not a forced target score: the false evidence families should disappear while genuinely concerning independent evidence remains. After the recheck, continue the provider matrix with Gmail/Edge, Outlook/Chrome+Edge and Yahoo/Chrome+Edge.
