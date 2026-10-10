# BeforeUClick v0.22.17.1 — Microsoft identity/authentication audit

## v0.22.17 real-provider false-positive cleanup

After the Outlook header-acquisition path became reliable, real Microsoft/Outlook mail exposed two separate identity issues: incomplete Microsoft 365 domain relationships and authentication metadata that selected the first DKIM signature rather than the aligned one. This release keeps the working Outlook DOM chain unchanged and hardens the shared identity/authentication layer instead.

Key changes:
- recognises sourced Outlook service endpoints (`outlook.cloud.microsoft`, `outlook.office.com`, `outlook.office365.com`) as Microsoft first-party destinations;
- treats the Microsoft-controlled `.microsoft` namespace as Microsoft organisation context for mismatch suppression, without granting every `.microsoft` sender the stronger OFFICIAL_SENDER_DOMAIN deduction;
- normalises Outlook authserv ids such as `mx.microsoft.com 1`, allowing provider-trusted SPF/DKIM/DMARC evidence to score correctly;
- when multiple DKIM signatures pass, prefers an aligned passing signature for the compact `signed-by` metadata field;
- does not penalise an unaligned passing SPF/DKIM mechanism when trusted DMARC passes or another trusted aligned mechanism already establishes identity;
- explicitly keeps `*.onmicrosoft.com` tenant-controlled rather than Microsoft first-party trust;
- preserves the v0.22.16.9 exact Outlook `More items -> View -> View message details` acquisition path.

# BeforeUClick v0.22.16.9 — Outlook exact View-chain pass

## v0.22.16.9 Outlook menu correction

Live Outlook DOM inspection confirmed that the default unpinned route is linked as `More items` → its `role=menu` → exact `View` submenu trigger → second `role=menu` labelled by that trigger → `View message details`. v0.22.16.9 follows that relationship directly and removes the relaxed/global `View` fallback from the normal route.

## v0.22.16.9 Outlook menu-linkage follow-up

Provider testing showed that timing is now on target (~2.5 s), but the unpinned path can still select or wait on the wrong Fluent portal. This build uses Outlook/Fluent's live `aria-labelledby` relationship between a menu and its trigger element: the More-items menu is linked to the More button's runtime id, and the View submenu is linked to the View trigger's runtime id. Generated ids are never hard-coded; they are read from the current DOM only.

## v0.22.16.9 Outlook timing-budget follow-up

The normal unpinned Outlook route is now tuned for a **~2.5 second** cold-check target (roughly 2–3 seconds in practice). It uses a single 3 second DOM-driven budget rather than a chain of independent long waits, so slow Fluent UI renders get enough time without returning to the earlier ~5 second experience. Fast renders still advance immediately.

The unpinned Outlook route now allows a second, bounded DOM-driven wait for the first More-items menu. Real provider testing showed that declaring `view-menu-not-found` at roughly 480 ms could be premature. The extra window resolves immediately if `View` appears and remains within the intended normal-loading UX budget.



## v0.22.16.3 Outlook follow-up

The unpinned Outlook test reached about **1.18 s** acquisition time but still failed to open the nested **View message details** submenu. This patch preserves the speed work and adds two provider-DOM fallbacks: a dormant Fluent `data-overflow-item` fast path (when Outlook keeps the command mounted even though it is not pinned) and a native `HTMLElement.click()` attempt on the **View** submenu parent before synthetic event fallbacks. Neither path changes Outlook settings.

## v0.22.16 performance pass

The default unpinned Outlook route now aims to feel like normal loading rather than a blocked wait. It uses DOM-driven waits instead of long fixed sleeps, shows progressive status text while authentication is being collected, and keeps one successful full-header result in tab memory for a near-instant **Check again** on the same email.

- earlier v0.22.16 target: roughly 2 seconds or less; v0.22.16.9 supersedes this with a more reliable ~2.5 second target;
- pinned **View message details** remains an optional faster path, never a requirement;
- full headers are cached only for the current message in tab memory; they are not written to storage;
- copied provider summaries now include measured header-acquisition time and whether the session cache was used.



## v0.22.15.3 follow-up

- Outlook's optional pinned **View message details** action is now treated only as a fast path. It is not required and BeforeUClick never changes Outlook settings to pin it.
- The normal/default route remains **More items -> View -> View message details** and is attempted whenever the pinned action is absent.
- Header diagnostics now distinguish `outlook-pinned-message-details`, `outlook-view-menu-message-details`, and an already-open Message details dialog.

## v0.22.15 changes

- Outlook Web header acquisition now follows the current inspected accessibility path: **More items → View → View message details**, reads the confirmed `Message details` dialog content, reconstructs visually folded header lines, and closes the dialog after analysis.
- Provider-test summaries now include privacy-reduced Outlook acquisition stage diagnostics when automatic header capture fails.
- Outlook visible-sender extraction has a bounded nearby-text fallback for current builds that render `Name <address>` without stable sender attributes.
- Microsoft `aka.ms` is recognised as a sourced Microsoft short-link domain; this is ownership context only and does not guarantee the redirect target.
- `account-compromised` wording now requires nearby recipient/action context so cybersecurity/newsletter discussion is not treated as a claim that the reader's own account is compromised.
- Repeated suspicious links sharing one inferred campaign-wrapper domain count as one mechanism for the small multi-link bonus, reducing Review/Caution instability from blocked images or repeated tracking URLs.


BeforeUClick is a local-first Chrome/Chromium extension that helps ordinary users inspect an opened webmail message before following links or acting on a request. It is decision support: the product is designed to say **“we found something worth checking”**, not to claim a probability that an email is safe or malicious.

### v0.22.14 accessibility/test hotfix

The provider-validation buttons now keep visible-text accessible names (`Record test`, `Export batch`, `Clear batch`) while retaining their longer help text as tooltips. This fixes the Playwright role-name regression without changing scoring or provider logic.

### v0.22.13 redirect-wrapper + provenance cleanup

Real Gmail and team Gmail/Outlook validation converged on one repeated false-positive mechanism: legitimate campaigns often route visible external destinations through first-party or third-party click wrappers. v0.22.13 therefore infers message-wide wrapper context from repeated link structure plus sender/authentication/mailed-by evidence, while keeping the final unseen destination untrusted.

Key changes:
- sender-owned/organisation-family redirect wrappers no longer create automatic +35 display/brand mismatch evidence;
- dominant third-party campaign wrappers can be recognised from message context without maintaining an endless provider whitelist;
- unauthenticated/untrusted dominant wrappers are only reduced to Review-level uncertainty, not declared safe;
- Como/ComoSense is added as score-neutral email/tracking infrastructure from provider documentation;
- Mercury Online and `mercury.co.nz` share one organisation family for identity consistency;
- wrapper links do not earn first-party destination reassurance for an unseen final target;
- official-destination explanations name both the analysed domain and organisation;
- Outlook header acquisition now also tries common "View" submenu/source/detail variants before falling back to visible-message metadata.

The score bands and BEC/payment weights are unchanged.


### v0.22.12 reference-role and validation-speed cleanup

The latest Gmail/Chrome batch showed that the broad relationship fixes were working, but three smaller reference-role issues remained: `linkedin.com` was not accepted as a LinkedIn sender domain, `mail.instagram.com` inherited Instagram platform context but not sender context, and ANZ's official careers site at `careers.anz.com` was not linked to the ANZ New Zealand reference. Recipient addresses repeated in newsletter footers could also be mistaken for brand contact addresses.

v0.22.12 fixes those issues without changing the score bands. It also adds an **opt-in, session-only provider-validation runner** so the Capstone validation phase no longer requires copying one diagnostic block per email. When enabled in Settings, the in-email panel can record a privacy-reduced result, identify whether it represents a new or repeated evidence pattern, and export the whole batch as one JSON file. Nothing from the batch is written to extension storage; refreshing or closing the webmail tab clears it unless the tester explicitly exports.

### v0.22.11 real-provider relationship cleanup

The second Gmail/Chrome validation batch showed that legitimate organisations often use related brand-family domains and neutral email infrastructure between the visible button and the eventual destination. v0.22.11 therefore adds organisation-family context (including Foodstuffs/New World/Club+ and Air New Zealand's `airnz.co.nz`), score-neutral Customer.io/Mandrill/Exclaimer intermediary recognition, same-organisation display-domain handling, informational-only standalone long URLs, repeated-evidence condensation, and a small body-address extraction repair. The score bands and BEC weights are unchanged.

### v0.22.10 real-world content-context cleanup

The previous pass stopped ordinary article/newsletter content from being mistaken for sender impersonation merely because it mentioned Microsoft, Apple, police, app stores or similar topics. It also introduced neutral Mailchimp tracking context and quieter all-links highlighting.


This release keeps the v0.22.5 scoring model unchanged and focuses on control over optional local memory and the in-email panel.

- Replaced developer-facing “Local storage mode” wording with **Remember email-related information on this device**, off by default.
- Settings now explicitly separate **ordinary app preferences** (text size, contrast, panel size/position) from optional email-related information (Known senders and unique daily check memory).
- Added plain-language explanations for every display/accessibility setting, plus a short privacy facts section covering what is saved, what is not retained as history, and the MVP’s local/no-telemetry architecture.
- Added **Clear remembered email data**, which removes optional email-related memory while keeping app preferences.
- Re-checking the same email still does **not** increase the daily checked count.
- Text size now includes **Very large**.
- Panel width presets now cover **Small screen (320 px), Standard (412 px), Large (540 px), and Extra large / 4K (720 px)**. All presets still shrink to fit the current browser viewport.
- Panel placement remains **Movable** or **Fixed top-right**, the floating quick-check button remains optional, and high contrast remains on by default.
- Dark mode and a separate colour-blind palette remain deferred while real-provider usability testing is underway.


### v0.22.7.1 mobile navigation hotfix

The four workspace destinations now reflow into a two-column grid at phone widths. This fixes the v0.22.7 horizontal-overflow regression without hiding overflow or removing any navigation option. The Playwright integration test now checks all four workspace views at 390 px.

### Provider-validation clipboard helper (introduced in v0.22.6)

The in-mail panel includes **Copy test summary** for manual Gmail / Outlook / Yahoo testing. It copies the diagnostic fields useful for validation while omitting the message subject/body, recipients, raw headers, full email addresses and full URLs. Pair the pasted summary with screenshots when reporting a real-provider test.

## Scoring foundation carried forward from v0.22.5

This release makes two connected refinements:

1. **Review is visually an attention state, not a danger state.** It now uses calm blue rather than yellow/orange and an information-style `i` symbol rather than a warning triangle.
2. **Changed-payment/BEC escalation is narrow and corroboration-based.** Ordinary invoices and overdue/pay-now wording can remain normal or Review-level; Caution requires additional independent concern.

## User-facing scale

```text
0–9      No obvious concerns      green
10–16    Not enough evidence      blue-grey / neutral
17–34    Review                   blue / attention
35–59    Caution                  amber
60–100   High concern             red
```

Review means **“something here is worth checking before you act.”** That can include a perfectly legitimate process such as changed bank details, an overdue invoice, an MFA/security notice or another consequential request. Review is not an accusation that the message is malicious.

The internal diagnostic sub-bands remain:

```text
0–9      Reassuring
10–16    Limited evidence
17–24    Review suggested
25–34    Review recommended
35–44    Caution advised
45–59    Strong caution
60–100   High concern / saturation
```

## Payment/BEC handling

`payment-pressure` recognises natural phrases such as `pay this invoice today`, but that wording remains moderate evidence. A normal invoice instruction is no longer treated as changed-payment evidence merely because it says where to pay.

The new +5 BEC corroboration rule requires:

```text
changed payment details
AND (payment pressure OR urgency)
AND (secrecy OR identity inconsistency OR concerning link)
```

That lets legitimate-but-consequential payment changes live comfortably in Review while a combination of independent concerns can cross into Caution.

## Current evidence

```text
Focused BEC/payment probe: 22 scenarios
21 PASS / 1 ACCEPTABLE / 0 FAIL

Independent validation: 42 scenarios
36 PASS / 6 ACCEPTABLE / 0 FAIL

Development calibration: 78 scenarios
70 PASS / 8 ACCEPTABLE / 0 FAIL

Pairwise exploration: 171 unique pairs
1 single review flag / 0 pair flags
```

All 36 active non-browser Node regression tests pass. All 96 JavaScript/CJS files pass syntax checking. The optional Playwright browser integration test requires Playwright and could not run in the build environment; run it on the local development machine where Playwright is installed.

## Current MVP functions

- Gmail, Outlook Web/Microsoft 365 and Yahoo Mail adapters.
- Manual Check/Stop workflow.
- Sender, metadata and provider-specific header/authentication analysis.
- SPF/DKIM/DMARC/ARC and alignment interpretation where available.
- Role-aware organisation/domain references, controlled namespaces, shared platforms and Public Suffix handling.
- Actual-destination URL checks, display mismatch, typosquat checks, link badges/popovers and click guard.
- Local wording taxonomy and evidence-weighted scoring.
- Component assessments plus overall five-state assessment.
- Coverage separate from risk.
- Unified panel/full report/settings/accessibility.
- Explicit Share with privacy-reduced summary and clipboard fallback.
- Optional developer/provider-validation runner with session-only batch recording, behaviour-pattern deduplication and explicit JSON export.

## Install

Extract the ZIP, open `chrome://extensions` (or the Edge equivalent), enable Developer mode, choose **Load unpacked**, and select the `BeforeUClick_v0.22.16.9` folder containing `manifest.json`. Disable older unpacked copies first to avoid confusing results.

## Privacy

Analysis remains local-first. No live threat/reputation network lookup is enabled in the MVP. Email-related persistence is opt-in through “Remember email-related information on this device”; when it is off, Known senders and daily activity memory are disabled. General interface preferences still remain in local browser storage so user choices persist. The Share action only sends/copies a locally prepared summary after explicit user action. The optional provider-validation batch is also session-only until an explicit export; it is not written to extension storage.

See `PATCH_NOTES.md`, `PROVIDER_VALIDATION_REPORT.md`, `BEC_PAYMENT_PROBE_REPORT.md`, `CALIBRATION_REPORT.md`, `VALIDATION_REPORT.md`, and `calibration/README.md` for the development evidence trail.

## v0.22.7 workspace organisation

The in-email panel now provides direct top-right access to **Settings**, **Known senders**, and **Reference data** alongside its window controls. Known senders are managed on their own page rather than inside general settings, while the active read-only reference catalogue has its own Reference data page. Today's aggregate checked/review counters can also be reset directly from the panel. High contrast is the default for new preference profiles; an explicit user choice is still respected.

Dark mode and a separate colour-blind palette are not enabled in this release. The current design deliberately uses text labels, symbols and state wording in addition to colour so colour is never the only status cue.