# BeforeUClick v0.22.17 code audit

## Why this audit was run

The Outlook unpinned header path is now working in live Edge/Outlook testing. That exposed a legitimate Microsoft Outlook digest reaching High concern because several Microsoft-owned/tenant/infrastructure domains were being interpreted independently. Because v0.22.15–v0.22.16.9 also changed Outlook DOM acquisition repeatedly, this audit checked both the new false-positive family and recent integration integrity before further provider testing.

## Issues found and corrected

1. **Incomplete Microsoft 365 endpoint relationships.** `outlook.office365.com` and related current Outlook service endpoints were missing from the organisation dataset. Added sourced first-party destination context for `outlook.cloud.microsoft`, `outlook.office.com`, and `outlook.office365.com`.
2. **Controlled `.microsoft` ownership was not used by identity mismatch checks.** The dataset already knew that `.microsoft` is Microsoft-controlled, but sender/body/link brand checks did not use that ownership relationship. They now use it to suppress false Microsoft impersonation mismatches. This does not grant every `.microsoft` sender OFFICIAL_SENDER_DOMAIN reassurance.
3. **Outlook authserv version suffix bug.** Microsoft can render `Authentication-Results` with an authserv id such as `mx.microsoft.com 1`. The trailing numeric version caused provider-trust checks to fail, so SPF/DKIM/DMARC could display as PASS while contributing no authentication evidence. Provider trust now normalises the numeric suffix and accepts the Microsoft-only `.microsoft` authserv namespace.
4. **First-DKIM-wins metadata bug.** The compact `signed-by` field used the first DKIM domain even when another passing DKIM signature aligned with the visible From domain. It now prefers a provider-trusted passing aligned signature, then progressively weaker fallbacks.
5. **Unaligned-pass over-warning.** A passing but unaligned SPF/DKIM mechanism was still penalised even when trusted DMARC passed or another aligned mechanism already established identity. That weak warning is now suppressed in those cases; authentication failures remain concerning.
6. **`onmicrosoft.com` trust boundary checked.** Microsoft documents `onmicrosoft.com` as a tenant fallback namespace. It remains non-first-party/score-neutral and is not promoted to Microsoft sender or destination trust.
7. **Reference bookkeeping.** The existing Air New Zealand provider-validation source `[79]` was documented but not attached to the Air New Zealand organisation entry. The reference linkage is now corrected; scoring behaviour is unchanged.

## Similar relationship families rechecked

Existing regressions were rerun for Google/Instagram/LinkedIn sender roles, Foodstuffs/New World/Club+, Mercury/MercuryOnline, Air New Zealand/AirNZ, and neutral campaign infrastructure including Mailchimp/Mandrill, Customer.io, Exclaimer and Como/ComoSense. No new failures were introduced.

## Recent Outlook code integrity checks

- The successful v0.22.16.9 exact `More items -> View -> View message details` DOM chain was not changed.
- Manifest content-script paths all exist and contain no duplicate entries.
- Loaded global function declarations contain no duplicate names across content-script files.
- Organisation/shared-platform/controlled-namespace owner IDs all resolve.
- All curated reference IDs used by the data files are defined; no recent reference IDs are orphaned.
- Raw full headers remain cached for only one current message in tab memory and are not persisted.

## Automated results

- JavaScript/CJS/MJS syntax checks: 108 files pass.
- Node regression tests: 48 pass.
- Calibration: 70 PASS / 8 ACCEPTABLE / 0 FAIL.
- Independent validation: 36 PASS / 6 ACCEPTABLE / 0 FAIL.
- BEC/payment probe: 21 PASS / 1 ACCEPTABLE / 0 FAIL.
- Pairwise: 1 single review flag / 0 pair flags.
- Playwright browser integration was not run in this environment because the Playwright package is not installed; run `node tests/v019_browser_integration_test.cjs` locally.
