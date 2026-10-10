// adapters/gmail/inbox_preview.js
// Optional Gmail inbox sender preview.
// This is provider-specific UI because it depends on Gmail inbox-row DOM selectors.
// It is opt-in, sender-only, and never counts as a completed email check.

let bucInboxPreviewObserver = null;
let bucInboxPreviewPreferences = null;
let bucInboxPreviewTimer = 0;

function bucInboxPreviewIsGmail() {
    return String(location.hostname || "").toLowerCase() === "mail.google.com";
}

function bucInboxPreviewRemoveAll() {
    document.querySelectorAll(".beforeuclick-inbox-preview").forEach(node => node.remove());
    document.querySelectorAll("tr.zA[data-buc-preview-key]").forEach(row => {
        delete row.dataset.bucPreviewKey;
    });
}

function bucInboxPreviewInstallStyle() {
    if (document.getElementById("beforeuclick-inbox-preview-style")) return;
    const style = document.createElement("style");
    style.id = "beforeuclick-inbox-preview-style";
    style.textContent = `
        .beforeuclick-inbox-preview {
            display: inline-flex !important;
            align-items: center !important;
            gap: 4px !important;
            margin-left: 6px !important;
            padding: 1px 6px !important;
            border: 1px solid currentColor !important;
            border-radius: 999px !important;
            font: 700 10px/1.45 Arial, Helvetica, sans-serif !important;
            white-space: nowrap !important;
            vertical-align: middle !important;
            box-sizing: border-box !important;
        }
        .beforeuclick-inbox-preview[data-state="review"] {
            color: #725d00 !important;
            background: #fff8d8 !important;
        }
        .beforeuclick-inbox-preview[data-state="caution"] {
            color: #8a5300 !important;
            background: #fef7e0 !important;
        }
        .beforeuclick-inbox-preview[data-state="high"] {
            color: #b42318 !important;
            background: #fce8e6 !important;
        }
    `;
    document.head.appendChild(style);
}

function bucInboxPreviewSenderFromRow(row) {
    if (!row) return null;
    const element = row.querySelector("span[email], [email]");
    if (!element) return null;
    const email = String(element.getAttribute("email") || "").trim().toLowerCase();
    if (!email || !email.includes("@")) return null;
    const displayName = String(element.getAttribute("name") || element.textContent || "").trim();
    return { email, displayName };
}

/**
 * Inbox preview intentionally uses a higher bar than the full checker. Weak sender clues are
 * omitted here because the inbox row has no message/link/authentication context to corroborate them.
 */
function bucInboxPreviewState(senderResult) {
    const evidence = (senderResult?.evidence || []).filter(item => (Number(item.points) || 0) > 0);
    if (!evidence.length) return null;

    const critical = evidence.find(item => item.strength === "critical");
    if (critical) {
        return { key: "high", text: "! High concern sender", title: critical.text || "Sender identity has a high-concern indicator." };
    }

    const strong = evidence.find(item => item.strength === "strong");
    if (strong) {
        return { key: "caution", text: "⚠ Check sender", title: strong.text || "Sender identity needs a closer look." };
    }

    const medium = evidence.find(item => item.strength === "medium");
    if (medium) {
        return { key: "review", text: "i Review sender", title: medium.text || "Sender identity is worth reviewing." };
    }

    return null;
}

function bucInboxPreviewProcessRow(row) {
    if (!row || bucInboxPreviewPreferences?.inboxPreviewMode !== "concerns") return;
    const sender = bucInboxPreviewSenderFromRow(row);
    if (!sender) return;

    const key = `${sender.email}|${sender.displayName}`;
    if (row.dataset.bucPreviewKey === key) return;
    row.dataset.bucPreviewKey = key;
    row.querySelector(".beforeuclick-inbox-preview")?.remove();

    const result = analyseSender(sender.email, sender.displayName, {
        knownSender: bucIsKnownSender(sender.email, bucInboxPreviewPreferences)
    });
    const state = bucInboxPreviewState(result);
    if (!state) return;

    bucInboxPreviewInstallStyle();
    const badge = document.createElement("span");
    badge.className = "beforeuclick-inbox-preview";
    badge.dataset.state = state.key;
    badge.textContent = state.text;
    badge.title = `${state.title} Sender-only inbox preview; open the email and run Check this email for the full analysis.`;
    badge.setAttribute("aria-label", state.text);

    const target = row.querySelector(".y6") || row.querySelector(".xT") || row.querySelector(".yW") || row;
    target.appendChild(badge);
}

function bucInboxPreviewScanRows() {
    if (!bucInboxPreviewIsGmail() || bucInboxPreviewPreferences?.inboxPreviewMode !== "concerns") return;
    document.querySelectorAll("tr.zA").forEach(bucInboxPreviewProcessRow);
}

function bucInboxPreviewSchedule() {
    if (bucInboxPreviewPreferences?.inboxPreviewMode !== "concerns") return;
    clearTimeout(bucInboxPreviewTimer);
    bucInboxPreviewTimer = setTimeout(bucInboxPreviewScanRows, 220);
}

function bucInboxPreviewStopObserver() {
    if (bucInboxPreviewObserver) bucInboxPreviewObserver.disconnect();
    bucInboxPreviewObserver = null;
    clearTimeout(bucInboxPreviewTimer);
    bucInboxPreviewTimer = 0;
}

function bucInboxPreviewStartObserver() {
    if (bucInboxPreviewObserver || !document.body) return;
    bucInboxPreviewObserver = new MutationObserver(bucInboxPreviewSchedule);
    bucInboxPreviewObserver.observe(document.body, { childList: true, subtree: true });
}

async function bucInboxPreviewRefreshPreferences() {
    try {
        bucInboxPreviewPreferences = await bucGetPreferences();
    } catch (_error) {
        bucInboxPreviewPreferences = { ...BUC_DEFAULT_PREFERENCES, knownSenders: [] };
    }

    if (bucInboxPreviewPreferences.inboxPreviewMode !== "concerns") {
        bucInboxPreviewStopObserver();
        bucInboxPreviewRemoveAll();
        return;
    }

    // Gmail reuses inbox rows. Preference changes (especially adding/removing a known sender)
    // must invalidate the row cache or a previously-rendered badge can stay stale indefinitely.
    bucInboxPreviewRemoveAll();
    bucInboxPreviewStartObserver();
    bucInboxPreviewSchedule();
}

function bucInitialiseInboxPreview() {
    if (!bucInboxPreviewIsGmail()) return;
    bucInboxPreviewRefreshPreferences();

    chrome.storage.onChanged.addListener((changes, areaName) => {
        if (areaName === "local" && changes[BUC_PREFERENCE_KEY]) {
            bucInboxPreviewRefreshPreferences();
        }
    });
}

bucInitialiseInboxPreview();
