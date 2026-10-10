# BeforeUClick Provider Validation Guide — v0.22.13

## Goal

Real-mail validation is intended to discover provider extraction problems and evidence-context mistakes that synthetic fixtures cannot reproduce. It is **not** a requirement to collect a large arbitrary number of emails.

## Faster workflow

1. In Settings, enable **Show provider-validation tools**.
2. Open and check a real message.
3. Optionally choose a broad type label in the panel.
4. Press **Record test**.
5. Open the next message. The validation batch remains in memory in that webmail tab.
6. When finished, press **Export batch** and upload the single JSON file with any screenshots that show a UI/layout issue.
7. Refresh/close the tab to discard the in-memory batch, or press **Clear batch**.

## Suggested broad coverage

Aim for coverage rather than raw count:

- ordinary/personal or routine work/education;
- transaction/receipt;
- billing/payment;
- security/account notification;
- promotion/retail;
- newsletter/digest;
- jobs/recruitment;
- social/network;
- utility/service;
- spam/phishing if safely available.

It is normal not to have every category in one mailbox.

## Behaviour-pattern stopping rule

Each recorded result receives a content-free behaviour signature based on provider, coverage, component states, evidence codes, wording categories and link-count bucket.

If the panel says a new test is **similar to an existing test**, it may still be useful once or twice for confidence, but repeated same-theme messages quickly become diminishing returns.

A reasonable provider stopping point is reached when:

- several consecutive messages repeat existing patterns;
- no new extraction/UI failure class appears;
- the important common categories available in that mailbox have been sampled.

At that point, move to another provider/browser combination rather than forcing another 20–30 near-identical messages.

## What still needs synthetic tests

Use the calibration/validation harness for scenarios that are rare, unsafe or difficult to obtain naturally, for example:

- known malicious domains;
- credential theft;
- MFA-code theft;
- changed-payment + secrecy combinations;
- punycode/typosquat combinations;
- multiple corroborating phishing indicators;
- known-threat overrides.

Synthetic fixtures complement real-provider tests; they do not replace provider/DOM validation.

## Privacy

The live validation batch is not stored by the extension. It exists only in memory in the current webmail tab until explicit export. Exported records omit:

- subject;
- message body;
- recipients;
- full email addresses;
- raw headers;
- full URLs;
- provider message identifiers.

Domain-only and evidence-code diagnostics remain because they are needed to reproduce and classify validation failures.
