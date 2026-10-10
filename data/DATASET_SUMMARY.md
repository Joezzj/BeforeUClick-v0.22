# Reference Dataset v1.4 — Summary

## Coverage

### Organisation references
44 organisation groups currently represented:

Global / account services:
- Microsoft
- Google
- Apple
- PayPal
- Amazon / AWS
- Meta / Facebook / Instagram
- LinkedIn
- Dropbox
- Adobe
- Netflix
- Docusign
- Xero

New Zealand government / public:
- Inland Revenue
- NZTA Waka Kotahi
- ACC
- New Zealand Police
- Work and Income
- RealMe
- Auckland Council
- Immigration New Zealand
- Health New Zealand | Te Whatu Ora

New Zealand consumer / marketplace:
- NZ Post
- Trade Me

New Zealand banks:
- ANZ
- ASB
- BNZ
- Westpac NZ
- Kiwibank

New Zealand telecommunications:
- Spark
- One New Zealand
- 2degrees

New Zealand utilities:
- Contact Energy
- Mercury
- Meridian Energy
- Genesis Energy

Additional account / payment / collaboration services:
- Wise
- Stripe
- Discord
- GitHub

New Zealand grocery / retail:
- Foodstuffs New Zealand / New World / Club+

Travel / shipping:
- Air New Zealand
- DHL
- FedEx
- UPS

### Shared hosting / user-content references
13 score-neutral platform/infrastructure domains are explicitly identified:
- github.io
- netlify.app
- vercel.app
- pages.dev
- web.app
- firebaseapp.com
- wixsite.com
- myshopify.com
- list-manage.com (Mailchimp tracking intermediary)
- mcdlv.net (Mailchimp delivery infrastructure)
- customeriomail.com (Customer.io tracking/delivery intermediary)
- mandrillapp.com (Mailchimp Transactional / Mandrill tracking intermediary)
- exclaimer.net (Exclaimer signature/click-tracking intermediary)

Recognition identifies the hosting/infrastructure provider only; it does not mark user-hosted content or a redirect target as safe or malicious.

### Wording / behaviour categories
32 grouped categories, including:
- urgency
- account suspension
- account compromise
- credential verification
- password/PIN request
- MFA/OTP request
- personal information
- card/banking data
- payment/invoice pressure
- changed bank details
- refund/reward
- prize/giveaway
- gift cards
- secrecy
- remote access/software install
- parcel delivery
- toll/vehicle
- link pressure
- unexpected attachments
- generic greetings
- boss/favour requests
- mailbox quota
- investment/crypto
- seed phrase
- friend/family emergency
- job/recruitment
- subscription renewal
- document/e-sign
- QR/quishing
- fake support/callback
- police/legal authority
- charity/disaster

## Score-affecting evidence classes

Reassuring:
- OFFICIAL_SENDER_DOMAIN *
- OFFICIAL_DESTINATION *
- CONTROLLED_NAMESPACE *
- OFFICIAL_SHORT_LINK *
- KNOWN_LOCAL_SENDER *

Neutral/context only:
- PLATFORM_PROVIDER
- USER_CONTENT_HOST
- INFRASTRUCTURE_DOMAIN
- DNSSEC_PRESENT

Concerning:
- WORDING_WEAK *
- WORDING_MEDIUM *
- WORDING_STRONG *
- KNOWN_PHISHING *
- KNOWN_MALWARE *
- DOMAIN_BLOCKLIST_STRONG *

Future weak reassuring:
- ESTABLISHED_DOMAIN *
- LONG_REGISTRATION_HISTORY *
- HSTS_PRELOAD *

`*` = intended to affect the score after calibration/integration.

## Key safety improvement over older reference lists

The dataset no longer treats every legitimate provider domain as equally reassuring.

Example:
- `microsoft.com` can provide first-party reassurance.
- `sharepoint.com` is recognised as Microsoft infrastructure/platform but is score-neutral because tenants can host their own content.
- `dropbox.com` and `docusign.com` are recognised providers but are score-neutral for destination safety because legitimate platform accounts can be abused.
- `amazonaws.com` is recognised infrastructure/user-hosting, not a trusted destination.

This prevents the positive scoring system from becoming an easy bypass.

## v0.22.10 integration notes

- Most-specific domain rules prevent user-content surfaces such as `sites.google.com` from inheriting broad first-party reassurance from `google.com`.
- Shared-hosting platforms are a separate score-neutral dataset rather than a blacklist or trust list.
- Deterministic references remain grounding; experimental local AI can supplement language/context analysis but does not replace authoritative domain or threat data.
- Real-provider validation now also checks whether brand mentions belong to sender/action identity or are merely newsletter/article content.
- Tracking intermediaries are identified as context rather than compared as though their hostname were the final claimed-brand destination.
- Calibration against representative legitimate and phishing samples remains a separate task.


## v0.22.11 integration notes

- Domain identity comparisons can recognise multiple sourced domains in one organisation family instead of requiring literal registrable-domain equality.
- Normal subdomains inherit a sourced parent-domain role unless a more-specific rule deliberately overrides it.
- Known mail/tracking/signature intermediaries are neutral context: they can suppress a false wrapper-domain mismatch but never create reassurance by themselves.
- Long URL length alone is informational. It keeps weak score weight only when another independent concerning signal exists on the same link.
- Repeated identical evidence is condensed for presentation with an affected-link count; the underlying scoring inputs remain unchanged.


## v0.22.12 integration notes

- Added LinkedIn base-domain sender context while preserving platform/user-content destination neutrality.
- Added Instagram base-domain sender context for aligned `mail.instagram.com` messages while preserving platform/user-content destination neutrality.
- Added ANZ Banking Group `anz.com` / `careers.anz.com` first-party careers destination context.
- Body contact-address analysis now excludes provider-extracted recipients before generating identity evidence.
- Provider validation now tracks repeated versus novel evidence patterns in a session-only batch so additional same-theme real emails can be deprioritised.


## v0.22.13 integration notes

- Added redirect-wrapper inference for repeated campaign/link-delivery domains using sender/authentication/mailed-by context.
- Added score-neutral Como/ComoSense email tracking context.
- Added Mercury Online (`mercuryonline.co.nz`) to the Mercury organisation family.
- Wrapper recognition suppresses false direct brand/display mismatch but does not create reassurance for an unseen final destination.
- Official-destination explanations now carry domain provenance to avoid ambiguous organisation labels in unrelated messages.


## v0.22.15 integration notes

- Added sourced Microsoft `aka.ms` short-link recognition.
- Account-compromise wording now requires nearby recipient/action context, reducing false positives in security-industry newsletters while preserving recipient-directed alerts.
- Repeated campaign-wrapper destinations are grouped for the small multi-link bonus to reduce rendering-dependent category movement.

### v1.6 Microsoft / multi-DKIM update

- Microsoft 365 Outlook endpoints `outlook.cloud.microsoft`, `outlook.office.com`, and `outlook.office365.com` are sourced first-party destination context.
- The single-registrant `.microsoft` namespace can establish Microsoft organisation ownership for mismatch suppression, while sender reassurance still requires an explicit sender-domain rule.
- `*.onmicrosoft.com` is customer-tenant namespace context, not Microsoft first-party identity evidence.
- Provider-trusted authentication passes are preserved across Outlook authserv version suffixes and multi-signature DKIM mail.

