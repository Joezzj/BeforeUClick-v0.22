# BeforeUClick v0.22.17.1 patch notes

## Browser-integration cancellation regression

- Fixed the browser integration failure at `v019_browser_integration_test.cjs:93` where **Stop checking** removed the panel, but a pending asynchronous provider step could finish immediately afterwards and the progressive-status updater recreated the panel.
- `bucUpdateBeforeUClickStatus()` is now strictly an in-place updater. If the panel has been removed, it does nothing instead of rendering a replacement loading panel.
- Added cancellation checks immediately after asynchronous preference loading, provider-detail acquisition, Outlook/header acquisition, and scan-counter recording so a stopped scan exits before it can mutate UI/state.
- This is a lifecycle/UI race fix only. Outlook v0.22.16.9 acquisition, Microsoft identity/authentication fixes, scoring weights and visible score bands are unchanged.

## v0.22.17 base changes
## Microsoft / Outlook identity-family audit

- Keeps the proven v0.22.16.9 Outlook unpinned header-acquisition DOM chain unchanged.
- Adds sourced Microsoft 365 endpoint relationships for `outlook.cloud.microsoft`, `outlook.office.com`, and `outlook.office365.com`.
- Uses the Microsoft-controlled `.microsoft` namespace as organisation-ownership context for sender/body/link mismatch checks without automatically granting official-sender reassurance.
- Fixes Outlook `Authentication-Results` trust when Microsoft appends a numeric authserv version such as `mx.microsoft.com 1`.
- Trusts authserv hosts beneath the Microsoft-only `.microsoft` TLD for Outlook provider results.
- Fixes multiple-DKIM metadata selection: `signed-by` now prefers a passing signature aligned with the visible From domain instead of the first signature in the header.
- Suppresses weak "passed but unaligned" authentication concern when trusted DMARC passes or another trusted aligned mechanism already establishes identity.
- Keeps `*.onmicrosoft.com` explicitly tenant-controlled and score-neutral rather than treating it as Microsoft first-party identity.
- Adds regression coverage for Microsoft Outlook digest-style mail and Bitdefender/Mandrill-style multi-DKIM mail.
- No visible risk-band threshold changes and no Outlook acquisition timing changes.

# BeforeUClick v0.22.16.9

## Outlook exact View-chain fix

This patch replaces the relaxed/global Outlook `View` fallback with the exact Fluent UI relationship observed in live Outlook DOM inspection.

- After opening the active message's **More items** menu, BeforeUClick now searches only inside that linked menu for a submenu trigger whose `.fui-MenuItem__content` is exactly `View`.
- It requires submenu semantics (`aria-haspopup="menu"`) and follows the trigger's current generated `id` to the second `role="menu"` through `aria-labelledby`.
- Inside that linked submenu it looks for the exact `View message details` menu item.
- The normal route no longer searches Outlook globally for another element named `View`.
- Diagnostics now expose the exact chain, including `view-expanded-before/after`, `view-linked-submenu-found`, and `view-message-details-item-found`.
- The existing ~2.5 second target / 3.3 second cold-path ceiling is retained.
- No scoring, privacy, storage, or visible risk-band changes.

## Outlook trigger-linked Fluent menu targeting

Real Outlook testing reached the intended ~2.5 s cold-path timing but still stopped at `message-details-command-not-found`. The inspected DOM shows a stronger relationship than text/proximity matching: Fluent UI links each portal menu to the live trigger element through `aria-labelledby=<trigger id>`.

This patch:
- follows the active **More items** button's runtime `id` to the exact `role=menu` whose `aria-labelledby` references it;
- follows the runtime **View** trigger `id` to the exact second-level submenu rendered in a separate Fluent portal;
- searches for **View message details** inside that linked submenu before using the older global compatibility fallback;
- adds `more-menu-linked-by-trigger`, `view-submenu-linked-surface-found`, and `view-submenu-linked-surface-without-command` diagnostics;
- keeps the existing ~2.5 s target / 3.3 s ceiling and does not alter scoring, evidence, storage, or privacy behaviour.

## Outlook submenu timing tolerance

- Keeps the unpinned Outlook cold-check target around 2–3 seconds, with ~2.5 seconds as the intended feel.
- Raises only the hard cold-path ceiling from 3.0 s to 3.3 s so Fluent UI has enough time to mount the nested **View → View message details** submenu on slower renders.
- Gives the View trigger a longer passive settle period after native click and hover before sending another activation. This is intended to avoid toggling the submenu again before its portal has mounted.
- Adds `view-submenu-settle-wait` and `view-submenu-hover-settle-wait` diagnostics.
- No scoring, evidence-weight, storage, or privacy changes.

## Outlook default-menu targeting fix
- Scopes the `View` lookup to the Fluent menu surface created by the active message's **More items** button, rather than allowing an unrelated Outlook control named `View` to win the relaxed matcher.
- Detects the newly portal-rendered menu by comparing visible menu surfaces before and after the More-items click.
- Tries the actual scoped `View` submenu trigger with native click first, then Fluent-style `mousemove -> mouseover`, ArrowRight, and indicator fallbacks.
- Adds diagnostics including `more-menu-surface-found`, `view-menu-found-in-more-surface`, `view-submenu-native-click`, and `view-submenu-expanded-after-*`.
- Retains the 3 second cold-path ceiling and does not change scoring, storage, or privacy behaviour.

# BeforeUClick v0.22.16.9 patch notes

## Outlook default-menu selector regression

Real Outlook testing on v0.22.16.4 completed the More-items click in about 1.5 seconds but stopped at `view-menu-not-found`. Comparing the working earlier path showed that the newer selector had become too strict: it required the visible **View** row to be `role=button` with `aria-haspopup=menu`. Fluent UI can expose the same visible row with different transient semantics while the menu is mounting.

This patch:
- matches the visible **View** action by accessible text first, then ranks `aria-haspopup`, submenu indicator, role, portal/menu context and proximity as confidence hints instead of mandatory requirements;
- keeps the existing 3-second cold-path budget and ~2.5-second UX target;
- adds `view-menu-relaxed-match` diagnostics whenever Outlook's current markup did not expose the older strict submenu semantics;
- does not change scoring, evidence weights, privacy behaviour or storage.

## Earlier v0.22.16.4 notes

## Outlook ~2.5 second cold-path tuning

Real Outlook testing showed that the previous 480 ms failure was too aggressive: the extension could give up before Fluent UI had mounted the first menu. This patch tunes the unpinned Outlook path around a **~2.5 second target**, with a **3 second bounded cold-path budget**.

- no artificial minimum wait is added; every stage still proceeds immediately when its DOM appears;
- first-menu detection now allows an 800 ms fast window plus a 650 ms extended window;
- the View submenu gets a longer real-hover opportunity before keyboard/click fallbacks;
- all default-route menu/submenu/dialog/header waits share one 3 s budget so the extension cannot drift back toward the old ~5 s behaviour;
- diagnostics report budget exhaustion if Outlook has not produced the required UI in time;
- scoring, evidence weights, privacy behaviour and the optional pinned fast path are unchanged.

## Previous notes

# BeforeUClick v0.22.16.3

## Outlook first-menu timing follow-up

Real Outlook testing showed an unpinned acquisition ending at only ~480 ms with `more-items-found -> view-menu-not-found`. That is faster than Outlook sometimes mounts/animates the first Fluent menu.

Changes:
- keeps the fast 450 ms DOM-driven menu wait;
- if the `View` action has not appeared yet, extends the wait by up to 650 ms instead of failing immediately;
- both windows still resolve immediately as soon as Outlook renders the action, so fast machines do not pay the full delay;
- adds `more-menu-wait-extended` and `more-menu-rendered-after-extended-wait` diagnostics;
- keeps the ~2 second cold-path UX target and does not change scoring, privacy, storage, or evidence weights.

# BeforeUClick v0.22.16.2

Real Outlook testing confirmed that the speed target is already met (~1.19 s), but the default unpinned route still could not expose the second-level **View message details** command. This patch narrows the issue to Fluent UI submenu activation and detection without changing scoring.

- targets the **View** submenu parent specifically by `role=button + aria-haspopup=menu + accessible text View`;
- sends hover/pointer events at the actual centre of the View row instead of the previous implicit `(0,0)` coordinates;
- allows a bounded ~420 ms Fluent submenu hover-delay window while keeping the overall ~2 s performance budget;
- searches the entire document for the separately portal-rendered `role=menuitem` / `.fui-MenuItem__content` named **View message details**;
- removes the repeated Enter/Space cascade that could re-toggle or close Fluent flyouts;
- adds diagnostics for `view-submenu-hover-start`, `view-submenu-command-mounted-hidden`, `view-submenu-indicator-native-click`, and `view-submenu-row-native-click`;
- fixes provider-test/export version reporting so it falls back to the packaged build version instead of displaying `Version: unknown` if the runtime manifest call is unavailable.

No scoring weights, visible bands, storage policy, or privacy behaviour changed.

---

# v0.22.16.1 — Outlook unpinned fast-path experiment

Real Outlook testing showed the v0.22.16 timing target was already met (about 1.18 s), but the normal unpinned route still stopped at `message-details-command-not-found`. The remaining problem is therefore submenu activation, not raw-header parsing or speed.

Changes:
- checks for a dormant Fluent UI `data-overflow-item` named **View message details** before opening the nested menu;
- if Outlook keeps that command mounted while unpinned, invokes it directly without changing the user's Outlook preference;
- limits the dormant-command attempt to a short 260 ms budget so a stale/non-functional element does not make the fallback noticeably slower;
- tries the View submenu parent's native `HTMLElement.click()` before lower-level synthetic pointer/keyboard fallbacks;
- adds diagnostics `dormant-message-details-action-found/not-found`, `dormant-message-details-action-fallback`, and `view-submenu-native-click`;
- reports successful dormant-command capture as `outlook-overflow-message-details`.

No scoring, assessment thresholds, storage/privacy settings, or Outlook customisation preferences are changed.

# v0.22.16 — Outlook performance and progressive loading

The Outlook Message-details route was functionally working but the normal unpinned path could take about five seconds, which felt like waiting rather than normal loading.

Changes:
- replaces long fixed Outlook UI sleeps with MutationObserver/short-poll waits that continue as soon as the next menu/dialog element exists;
- caps the fallback `View` submenu activation sequence to well under one second instead of serial multi-second waits;
- reduces the normal Message-details dialog/header-text wait budget while retaining compatibility fallbacks;
- measures header-acquisition time and includes it in **Copy test summary**;
- adds progressive panel text: reading the email -> checking Outlook authentication -> reviewing links/wording -> finishing assessment;
- keeps one successful full-header acquisition in tab memory for the same message so **Check again** can reuse it immediately;
- the cache is session-only, one-message only, and never written to `chrome.storage`.

No scoring weights, assessment thresholds, provider permissions, or persistent privacy/storage behaviour changed.

# v0.22.15.3 — Pinned action is optional; default Outlook route remains primary

The latest Outlook inspection confirmed that **View message details** can be pinned to the reading-pane toolbar, but that pin is **off by default**. Requiring it would therefore be inappropriate for normal users.

Changes:
- detects a visible pinned **View message details** action as an optional fast path only;
- does **not** change or persist any Outlook reading-pane preference;
- when the pin is absent, proceeds directly to the normal **More items -> View -> View message details** route;
- if a pinned shortcut is present but fails to yield usable headers, closes any partial dialog and falls back to the normal menu route;
- records the acquisition source as `outlook-pinned-message-details`, `outlook-view-menu-message-details`, or `outlook-existing-message-details`;
- keeps raw-header validation and SPF/DKIM/DMARC parsing unchanged.

No scoring, evidence weights, privacy/storage behaviour, or visible assessment thresholds changed.

# v0.22.15.2 — Outlook Fluent submenu activation follow-up

Real Outlook testing of v0.22.15.1 still stopped at `message-details-command-not-found`. Inspection confirmed that the command exists in a second Fluent UI portal after the View submenu opens.

Changes:
- polls for the actual `View message details` command after every submenu activation attempt instead of relying only on `aria-expanded`;
- sends a full pointer/mouse activation sequence (down/up/click) because `HTMLElement.click()` omits phases Fluent UI may listen for;
- preferentially activates the inspected `.fui-MenuItem__submenuIndicator`;
- retains row, ArrowRight, hover, Enter and Space fallbacks;
- adds diagnostics such as `view-submenu-indicator-activated`, `view-submenu-row-activated`, and `view-submenu-command-visible`.

No scoring, evidence-weight, privacy, storage, or visible-state changes are included.

# v0.22.15.1 — Outlook View submenu activation hotfix

## v0.22.15.1 hotfix

Real Outlook testing of v0.22.15 reached `more-items-found -> view-menu-found` but stopped at `message-details-command-not-found`. The inspected DOM showed that Outlook's **View** entry is a Fluent UI submenu parent (`role="button"`, `aria-haspopup="menu"`) rather than a normal `role="menuitem"`.

This hotfix changes submenu activation to:
- focus the **View** submenu parent and send the standard `ArrowRight` menu command first;
- dispatch real `PointerEvent` hover/move events when supported, with mouse-event fallbacks;
- use click only as a last fallback so an already-open flyout is not immediately toggled closed;
- wait longer for the portal-rendered **View message details** command;
- record detailed stages such as `view-submenu-arrow-right`, `view-submenu-hovered`, and `view-submenu-expanded` in provider-test summaries.

No scoring, evidence weights, privacy/storage behaviour, or user-facing assessment thresholds changed.

## Original v0.22.15 changes

### Why this patch exists

Real Outlook testing showed that `View message details` contains complete Internet headers, including provider-trusted SPF, DKIM and DMARC results, but v0.22.14 still failed to capture them automatically. DOM inspection of the current Outlook Web interface identified stable accessibility hooks for the whole interaction.

## Outlook Message details acquisition

- Uses the current Outlook accessibility flow observed during provider testing:
  - `aria-label="More items"` / `aria-haspopup="menu"`
  - submenu parent **View** (`role="button"`)
  - **View message details** (`role="menuitem"`)
  - modal `role="dialog"`, heading **Message details**
  - header text in `.fui-DialogContent.allowTextSelection`
  - **Close** button inside the same dialog
- Avoids generated Fluent UI ids/classes such as `menur...`, `dialog-title-...` and random class suffixes.
- Reconstructs Outlook-rendered continuation lines before passing the text to the strict shared RFC-header parser. This handles cases where DOM rendering removes the leading whitespace normally used for folded header lines.
- Adds acquisition-stage diagnostics such as `more-items-found`, `view-menu-found`, `message-details-command-found`, `dialog-opened`, `header-text-found` and `header-parse-success`.
- Provider-test summaries include those diagnostics if available, without copying raw header/message content.

## Outlook visible sender fallback

Current Outlook builds can render a visible sender such as `BrightTALK <address@domain>` without a stable sender `data-testid`. v0.22.15 adds a bounded search near the active message body to recover that visible sender while avoiding message-body/footer addresses.

## Microsoft short-link context

- Added `aka.ms` as a Microsoft-owned short-link domain, grounded in Microsoft Support documentation.
- Recognition provides short-link ownership context only; it does not mark the unseen redirected destination as safe.

## Wording context

- The `account-compromised` group now requires nearby recipient/action context before contributing concern.
- Security-news/newsletter discussion such as generic suspicious-activity/account-takeover reporting is therefore not treated as a claim about the reader's own account.
- Recipient-directed messages such as “we detected suspicious activity on your account” still match.

## Repeated campaign-wrapper stability

Distinct URLs using the same inferred campaign-wrapper domain now count as one mechanism for the small multi-link bonus. The highest-risk link is still retained, and independent suspicious destinations still add the existing limited bonus.

## Scoring

No score weights or visible assessment breakpoints changed in this patch.

## Validation added

`tests/v02215_outlook_dom_context_test.js` covers:
- rendered Outlook header reconstruction;
- SPF/DKIM/DMARC parsing from the reconstructed Message details text;
- current Outlook accessibility hooks;
- `aka.ms` Microsoft short-link recognition;
- account-compromise newsletter-vs-recipient context;
- repeated-wrapper multi-link bonus grouping.