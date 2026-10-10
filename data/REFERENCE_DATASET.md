# BeforeUClick Reference Dataset v1.4

This folder contains the role-aware local reference data used by the BeforeUClick checker. v1.4 adds redirect-wrapper context, Como/ComoSense email infrastructure recognition, Mercury/Mercury Online organisation-family context, and clearer destination provenance on top of the v1.3 sender-role/recipient cleanup.

## Core rule

Reference data and score policy are kept separate from checking logic:

- `organisation_references.js` — organisations, aliases, official domains, email domains and domain roles.
- `shared_platform_references.js` — known multi-tenant hosting/user-content services; recognition only, never a trust signal.
- `controlled_namespaces.js` — moderated/restricted namespaces.
- `wording_patterns.js` — sourced wording/behaviour categories and implementation regex examples.
- `threat_sources.js` — external known-bad/threat-intelligence source definitions.
- `reputation_sources.js` — optional/future positive reputation sources.
- `evidence_classes.js` — central evidence classes and suggested score effects.
- `README_REFERENCES.md` — full `[n]` source details.
- `DATASET_SUMMARY.md` — counts, scope and integration notes.

## Important scoring rules

1. The normal uncertainty baseline remains **15**.
2. No match / unavailable data = **0 score change**.
3. A score below 15 requires explicit reassuring evidence.
4. Official-domain evidence is not a guarantee of safety.
5. Multi-tenant/user-content platforms do **not** receive normal reassuring deductions merely because the provider is legitimate.
6. Strong and critical evidence cannot be cancelled by reassuring evidence.
7. Wording is supporting evidence and remains capped by the scoring engine.
8. Known-threat feeds are treated as much stronger evidence than wording or ordinary URL heuristics.
9. Score values in `evidence_classes.js` are **suggested starting values for calibration**, not probabilities.

## Domain roles

- `first-party` — organisation-controlled destination; eligible for normal reassurance.
- `sender-domain` — legitimate email-sending domain; supports sender identity only.
- `short-link` — organisation-controlled short-link; small reassurance only and destination should still be resolved.
- `platform` — legitimate provider but can host user/customer-controlled content; identify the provider but normally give no reassurance deduction.
- `user-content` — explicitly user-hosted/shared content; no reassurance deduction.
- `infrastructure` — technical/CDN/API infrastructure; normally no user-facing trust deduction.
- `tracking-redirect` — recognised campaign click-tracking intermediary; prevents false brand/destination comparison against the tracker host but does not make the unseen final target safe.
- `mail-delivery` — recognised bulk/transactional email delivery infrastructure; neutral context only.
- `signature-link` — recognised email-signature link wrapper/tracker; neutral context only.

## Status

Reference Dataset v1.5 — integrated with v0.22.15.
Reviewed: 2 October 2026.


## v0.22.12 integration notes

- A domain can legitimately be both a platform/user-content destination and an official sender domain. LinkedIn and Instagram now use that distinction so sender identity can be recognised without treating user-hosted/platform content as automatically safe.
- ANZ Banking Group's `careers.anz.com` is represented as first-party destination context under the ANZ organisation reference; third-party recruiting senders remain separate.
- Body contact identity now excludes addresses already identified as message recipients, preventing newsletter/footer recipient text from becoming brand-contact evidence.


## v0.22.13 integration notes

- Message-wide link analysis can infer probable redirect/campaign wrapper domains from repeated link structure plus sender/authentication/mailed-by context. Inference is neutral and never marks the unseen final destination safe.
- First-party redirect wrappers belonging to the same sourced organisation as the sender suppress false +35 display/brand mismatch evidence while withholding destination reassurance for the wrapped link.
- Very dominant repeated wrapper domains without trusted sender/authentication context can be reduced to Review-level uncertainty rather than treated as strong impersonation; strong structural threat indicators still bypass this inference.
- Added Como/ComoSense email infrastructure context from provider documentation and team validation.
- Added `mercuryonline.co.nz` to the Mercury organisation family from aligned real-provider bill validation.
- Official-destination reassurance now names the analysed domain as well as the organisation, so an external Google/Apple link inside another organisation's email is not mistaken for sender identity evidence.


## v0.22.15 integration notes

- Added `aka.ms` as a Microsoft-owned short-link domain from Microsoft Support documentation. This provides short-link ownership context only; the redirected destination remains separately assessed.
- Real Outlook DOM inspection is used only to improve local header acquisition; no raw message/header data is added to the reference dataset.
- Repeated links sharing one inferred campaign-wrapper domain now count as one mechanism for the small multi-link bonus while independent suspicious destinations remain separate.

## v1.6 Microsoft identity/authentication hardening (v0.22.17)

- Added sourced Microsoft 365 first-party endpoint relationships for `outlook.cloud.microsoft`, `outlook.office.com`, and `outlook.office365.com`.
- Organisation-controlled `.microsoft` namespace ownership now participates in identity-consistency checks without automatically granting OFFICIAL_SENDER_DOMAIN reassurance.
- `*.onmicrosoft.com` remains tenant-controlled Microsoft 365 namespace context and is deliberately not promoted to Microsoft first-party sender/destination trust.
- Outlook `Authentication-Results` authserv ids with a numeric version suffix (for example `mx.microsoft.com 1`) are normalised for provider-trust checks.
- Multiple DKIM signatures now prefer an aligned passing signature for the compact `signed-by` identity field.

